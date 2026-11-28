# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Run one T153 guest compatibility cell against a prebuilt, sealed client."""
import argparse
import base64
import hashlib
import json
import mimetypes
from pathlib import Path
import re
import socket
import struct
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

BASE = '/arcade/play/network-quest/'
HERE = Path(__file__).resolve().parent

def digest(value):
    return hashlib.sha256(value).hexdigest()

def bundle_identity(dist):
    manifest = []
    for path in sorted(p for p in dist.rglob('*') if p.is_file()):
        manifest.append([path.relative_to(dist).as_posix(), digest(path.read_bytes())])
    return {'files': len(manifest), 'sha256': digest(json.dumps(manifest, separators=(',', ':')).encode())}

def send(url, method='GET', body=None):
    data = None if body is None else json.dumps(body).encode()
    req = Request(url, data=data, method=method, headers={'Content-Type':'application/json'})
    try:
        with urlopen(req, timeout=45) as res:
            return json.load(res)['value']
    except HTTPError as error:
        raise RuntimeError(error.read().decode()[:1800]) from error

def free_port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1',0))
        return listener.getsockname()[1]

class Driver:
    def __init__(self, engine, driver, browser, directory):
        self.engine = engine
        port = free_port()
        self.base = f'http://127.0.0.1:{port}'
        self.log = (directory/'driver.log').open('w')
        if engine == 'chromium':
            cmd = [str(driver), f'--port={port}']
        else:
            cmd = [str(driver), '--port', str(port)]
        self.proc = subprocess.Popen(cmd, stdout=self.log, stderr=subprocess.STDOUT)
        self.session = None
        try:
            for _ in range(100):
                try:
                    send(self.base+'/status')
                    break
                except OSError:
                    time.sleep(0.1)
            if engine=='safari-webdriver':
                caps = {'browserName':'safari'}
            elif engine=='firefox':
                caps = {'browserName':'firefox','moz:firefoxOptions':{'binary':str(browser),'args':['-headless'],
                  'prefs':{'app.update.auto':False}}}
            else:
                caps = {'browserName':'chrome','goog:chromeOptions':{'binary':str(browser),'args':['--headless=new','--window-size=1620,1100',
                   '--no-first-run','--disable-background-networking','--no-default-browser-check','--disable-component-update',
                   '--user-data-dir='+str(directory/'profile')]}}
            created = send(self.base+'/session','POST',{'capabilities':{'alwaysMatch':caps}})
            self.session = self.base+'/session/'+created['sessionId']
            c = created['capabilities']
            self.identity = {k:c[k] for k in ['browserName','browserVersion','platformName','moz:buildID'] if k in c}
            if engine=='safari-webdriver':
                self.identity['CFBundleVersion']=subprocess.check_output(['plutil','-extract','CFBundleVersion','raw','/Applications/Safari.app/Contents/Info.plist'],text=True).strip()
            self.identity['browserExeSha256'] = digest(browser.read_bytes())
            self.identity['driverExeSha256'] = digest(driver.read_bytes())
            send(self.session+'/window/rect','POST',{'width':1620,'height':1100})
        except BaseException:
            self.close()
            raise
    def open(self,url):
        send(self.session+'/url','POST',{'url':url})
    def open_desktop(self, fixture, size):
        width, height = (int(n) for n in size.split('x'))
        self.open(fixture.origin+BASE+'?size='+size+'&input=keyboard&suite='+fixture.suite)
        for _ in range(4):
            view = send(self.session+'/execute/sync','POST',{'script':'return [innerWidth,innerHeight,outerWidth,outerHeight]','args':[]})
            if view[:2] == [width,height]: break
            send(self.session+'/window/rect','POST',{'width':view[2]+width-view[0], 'height':view[3]+height-view[1]})
        send(self.session+'/execute/sync','POST',{'script':'void import("/journey.mjs")','args':[]})
    def perform(self, command):
        kind = command['kind']
        if kind=='pointer':
            events = [{'type':'pointerMove','duration':0,'x':command['x'],'y':command['y']},{'type':'pointerDown','button':0},{'type':'pointerUp','button':0}]
            source = {'type':'pointer','id':'t153-pointer','parameters':{'pointerType':'mouse'},'actions':events}
        else:
            if kind=='tab': keys = ['\ue004']*command['count']
            elif kind=='enter': keys = ['\ue006']
            elif kind=='space': keys = [' ']
            elif kind in ['shortcut','text']: keys = list(command['value'])
            else: raise ValueError('Unknown input')
            events = [{'type':event,'value':key} for key in keys for event in ['keyDown','keyUp']]
            if kind=='tab':
                modifiers=[]
                if self.engine=='safari-webdriver': modifiers.append('\ue00a')  # Safari Option+Tab visits every control.
                if command.get('reverse'): modifiers.append('\ue008')
                events=[*[{'type':'keyDown','value':m} for m in modifiers],*events,*[{'type':'keyUp','value':m} for m in reversed(modifiers)]]
            source = {'type':'key','id':'t153-keyboard','actions':events}
        send(self.session+'/actions','POST',{'actions':[source]})
    def screenshot(self, path):
        path.write_bytes(base64.b64decode(send(self.session+'/screenshot')))
    def close(self):
        try:
            if self.session: send(self.session,'DELETE')
        finally:
            self.proc.terminate()
            self.proc.wait(timeout=12)
            self.log.close()

class Fixture:
    def __init__(self, directory, driver, size, mode, screenshot, suite):
        self.suite=suite
        self.done = threading.Event()
        self.result = {}
        self.image = None
        self.served = set()
        self.failures = []
        self.api = []
        self.requests = 0
        self.probe = (HERE/'journey.mjs').read_bytes()
        owner = self
        width, height = (int(x) for x in size.split('x'))
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*_args):
                pass
            def reply(self,status,body=b'',mime='text/plain',headers=()):
                self.send_response(status)
                self.send_header('Content-Type',mime)
                self.send_header('Content-Length',str(len(body)))
                self.send_header('Cache-Control','no-store')
                for k,v in headers: self.send_header(k,v)
                self.end_headers()
                try: self.wfile.write(body)
                except (ConnectionResetError,BrokenPipeError): pass
            def do_GET(self):
                path = urlparse(self.path).path
                if self.headers.get('Host') != f'127.0.0.1:{self.server.server_port}':
                    return self.reply(403)
                if path=='/test':
                    html = f'<!doctype html><html><head><meta charset="utf-8"><title>Network Quest isolated compatibility check</title><style>html,body{{margin:0;background:#12151c}}iframe{{display:block;border:0;width:{width}px;height:{height}px}}</style></head><body><iframe src="{BASE}" title="Guest game"></iframe><script>const frame=document.querySelector("iframe");frame.addEventListener("load",()=>import("/journey.mjs"),{{once:true}})</script></body></html>'
                    return self.reply(200,html.encode(),'text/html')
                if path=='/refinements.mjs' and suite!='baseline':
                    return self.reply(200,(HERE/'refinements.mjs').read_bytes(),'text/javascript')
                if path=='/journey.mjs':
                    return self.reply(200,owner.probe,'text/javascript')
                if path.startswith(BASE+'api/'):
                    owner.api.append([self.command,path[len(BASE):]])
                    return self.reply(503,b'{"code":"unavailable","message":"Guest compatibility fixture."}','application/json')
                if path.startswith(BASE):
                    rel = path.removeprefix(BASE) or 'index.html'
                    if not any(part.startswith('.') or part in ['.','..'] for part in rel.split('/')):
                        file = directory/rel
                        if file.is_file() and file.resolve().is_relative_to(directory):
                            data = file.read_bytes()
                            mime = mimetypes.guess_type(rel)[0] or 'application/octet-stream'
                            owner.served.add(rel)
                            if self.headers.get('Range') and file.suffix=='.mp3':
                                match = re.fullmatch(r'bytes=(\d+)-(\d*)',self.headers['Range'])
                                if not match: return self.reply(416)
                                start=int(match[1]); end=min(int(match[2]),len(data)-1) if match[2] else len(data)-1
                                if not 0<=start<=end<len(data): return self.reply(416)
                                return self.reply(206,data[start:end+1],mime,[('Accept-Ranges','bytes'),('Content-Range',f'bytes {start}-{end}/{len(data)}')])
                            return self.reply(200,data,mime)
                    owner.failures.append(path)
                self.reply(404)
            def do_POST(self):
                if self.headers.get('Origin')!=owner.origin or self.headers.get('Content-Type')!='application/json':
                    return self.reply(403)
                length = int(self.headers.get('Content-Length','0'))
                if not 0 < length < 200000: return self.reply(400)
                value = json.loads(self.rfile.read(length))
                if self.path=='/input':
                    owner.requests += 1
                    try: driver.perform(value)
                    except Exception as error: return self.reply(500,str(error).encode())
                    return self.reply(204)
                if self.path=='/room':
                    if not re.fullmatch(r'spec001:R(?:0[1-9]|1[0-2])',str(value.get('id',''))):
                        return self.reply(400)
                    print(value['id'],value['actions'],flush=True)
                    return self.reply(204)
                if self.path=='/capture':
                    if screenshot:
                        try:
                            with tempfile.TemporaryDirectory(prefix='nq-t153-image-') as tmp:
                                raw=Path(tmp)/'native.png'
                                driver.screenshot(raw)
                                iw, ih=struct.unpack('>II',raw.read_bytes()[16:24])
                                scale=iw/value['hostViewport'][0]
                                cw,ch=round(width*scale),round(height*scale)
                                y=round(ih-value['hostViewport'][1]*scale) if driver.engine=='safari-private' else 0
                                if cw>iw or ch>ih-y or y<0: raise ValueError('Guest capture exceeds native content area')
                                screenshot.parent.mkdir(parents=True,exist_ok=True)
                                crop=Path(tmp)/'crop.png'
                                subprocess.run(['/usr/bin/osascript','-l','JavaScript',str(HERE/'crop.js'),str(raw),str(crop),
                                    '0',str(y),str(cw),str(ch)],check=True,stdout=subprocess.DEVNULL)
                                if struct.unpack('>II',crop.read_bytes()[16:24])!=(cw,ch):
                                    raise ValueError('Native capture crop dimensions disagree')
                                subprocess.run(['sips','--resampleWidth',str(min(768,cw)),'-s','format','jpeg','-s','formatOptions','80',
                                    str(crop),'--out',str(screenshot)],check=True,stdout=subprocess.DEVNULL)
                                owner.image={'phase':value['phase'],'file':screenshot.name,'sha256':digest(screenshot.read_bytes()),
                                    'nativeCanvas':[iw,ih], 'guestCrop':[0,y,cw,ch]}
                        except Exception as error: return self.reply(500,str(error).encode())
                    return self.reply(204)
                if self.path=='/result':
                    owner.result=value
                    self.reply(204)
                    owner.done.set()
                    return
                self.reply(404)
        self.server = ThreadingHTTPServer(('127.0.0.1',0),Handler)
        self.origin=f'http://127.0.0.1:{self.server.server_port}'
        self.url=f'{self.origin}/test?size={size}&input={mode}&suite={suite}'
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--suite',choices=['baseline','performance','credits'],default='baseline')
    parser.add_argument('--capture',type=Path,help='Save the cropped native R12 ending as JPEG')
    parser.add_argument('--engine',choices=['chromium','firefox','safari','safari-webdriver'],required=True)
    parser.add_argument('--browser',type=Path)
    parser.add_argument('--driver',type=Path)
    parser.add_argument('--size',choices=['1280x720','1440x900','768x900','390x844'],required=True)
    parser.add_argument('--input',choices=['keyboard','pointer'],required=True)
    args=parser.parse_args()
    dist=args.dist.resolve()
    identity=bundle_identity(dist)
    with tempfile.TemporaryDirectory(prefix='nq-t153-') as tmp:
        if args.engine=='safari':
            from safari import Safari
            driver=Safari()
        else:
            driver=Driver(args.engine,args.driver.resolve(),args.browser.resolve(),Path(tmp))
        fixtures = [HERE/'run.py',HERE/'journey.mjs',HERE/'crop.js',*([HERE/'refinements.mjs'] if args.suite!='baseline' else []),*([HERE/'safari.py'] if args.engine=='safari' else [])]
        source_hashes = {p.name:digest(p.read_bytes()) for p in fixtures}
        fixture=Fixture(dist,driver,args.size,args.input,args.capture,args.suite)
        assert digest(fixture.probe) == source_hashes['journey.mjs']
        try:
            if args.engine != 'safari' and args.input=='keyboard':
                driver.open_desktop(fixture,args.size)
            else:
                driver.open(fixture.url)
            if not fixture.done.wait(900): raise RuntimeError('No browser result within 15 minutes')
            record=fixture.result
        except Exception as e:
            record={'status':'failed','error':str(e)}
        finally:
            fixture.close()
            driver.close()
        record.update({'candidate':identity,'engine':driver.identity,'input':args.input,'size':args.size,
            'capture':fixture.image,'trustedDriverCommands':fixture.requests,'servedUniqueFiles':len(fixture.served),'missingFiles':fixture.failures,'guestApiRequests':fixture.api,
            'harness':source_hashes})
        if fixture.failures: record['status']='failed'
        if bundle_identity(dist)!=identity: raise RuntimeError('Candidate changed during the cell')
        args.out.parent.mkdir(parents=True,exist_ok=True)
        args.out.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
        print(args.out,record['status'],record.get('error',''),flush=True)
        return record['status']!='passed'

if __name__=='__main__':
    raise SystemExit(main())
