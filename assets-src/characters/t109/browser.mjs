// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// TLS/NSS pattern adapted from the original project R01 asset inspection.
// Every route serves either this viewer, the local Three distribution or the eight explicit GLBs.
import {readFile,writeFile,mkdir,mkdtemp,rm,chmod} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:https';
import path from 'node:path';
import {firefox} from 'playwright';

const raw='docs/evidence/spec001/character-production/T109';
const work='.local/t109';
const scratch=await mkdtemp(path.join(work,'browser-'));
let server,context;
function run(cmd,args){
  const r=spawnSync(cmd,args,{cwd:scratch,stdio:'ignore',timeout:15000});
  if(r.status!==0)throw Error(cmd+' failed');
}
try{
  const profile=path.resolve(scratch,'profile');
  await chmod(scratch,0o700);await mkdir(profile,{mode:0o700});
  await writeFile(path.join(scratch,'ext'),'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n');
  run('openssl',['req','-x509','-newkey','rsa:2048','-sha256','-nodes','-days','1','-subj','/CN=T109 disposal CA','-addext','basicConstraints=critical,CA:TRUE,pathlen:0','-addext','keyUsage=critical,keyCertSign,cRLSign','-keyout','ca.key','-out','ca.pem']);
  run('openssl',['req','-newkey','rsa:2048','-sha256','-nodes','-subj','/CN=127.0.0.1','-keyout','leaf.key','-out','leaf.csr']);
  run('openssl',['x509','-req','-in','leaf.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-days','1','-sha256','-extfile','ext','-out','leaf.pem']);
  run('openssl',['verify','-CAfile','ca.pem','leaf.pem']);
  run('certutil',['-N','-d','sql:'+profile,'--empty-password']);
  run('certutil',['-A','-d','sql:'+profile,'-n','T109 disposable TLS','-t','C,,','-i','ca.pem']);
  server=createServer({key:await readFile(path.join(scratch,'leaf.key')),cert:await readFile(path.join(scratch,'leaf.pem'))},async(req,res)=>{
    const p=new URL(req.url,'https://127.0.0.1').pathname;
    const f=p==='/'?'assets-src/characters/t109/viewer.html':/^\/models\/CH(1[89]|2[0-5])\.glb$/.test(p)?'public/assets'+p:p.startsWith('/three/')?'node_modules/three/'+p.slice(7):null;
    try{
      if(!f)throw Error();
      const body=await readFile(f);
      res.writeHead(200,{'Content-Type':f.endsWith('.glb')?'model/gltf-binary':f.endsWith('.html')?'text/html':'text/javascript'});
      res.end(body);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  context=await firefox.launchPersistentContext(profile,{headless:true,ignoreHTTPSErrors:false,viewport:{width:480,height:480},deviceScaleFactor:1,env:{PATH:process.env.PATH,LANG:'C',LC_ALL:'C'}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>!!window.inspect);
  for(let i=18;i<=25;i++){
    const id='CH'+i;
    const native=JSON.parse(await readFile(path.join(raw,id,'native.json'),'utf8'));
    const report=await page.evaluate(([id,n])=>window.inspect.load(id,n),[id,native]);
    report.browser=context.browser().version();
    report.strictLoopbackTLS=true;
    report.sourceSha256=native.nativeSourceSha256;report.exportSha256=native.exportSha256;
    report.date=new Date().toISOString();report.scope='Isolated Three.js GLB inspection';
    const capture=label=>page.locator('canvas').screenshot({path:path.join(work,'render',id,'web-'+label+'.png')});
    await capture('rest');
    for(const clip of report.clips){
      clip.comparison=[];
      for(const fraction of [0,.25,.5,.75,1]){
        const pose=native.clips[clip.name].poses[String(fraction)];
        const result=await page.evaluate(([c,f,p,r])=>window.inspect.pose(c,f,p,r),[clip.name,fraction,pose,native.root]);
        const yaw={CH19:-46,CH20:64,CH22:15}[id];
        if(yaw!==undefined){
          result.partyYawDegrees=yaw;
          result.partyBounds=await page.evaluate(y=>window.inspect.partyBounds(y),yaw);
        }
        clip.comparison.push(result);
        if(fraction===(clip.name==='idle'?.25:.5))await capture(clip.name);
      }
    }
    report.pageErrors=errors;
    await writeFile(path.join(raw,id,'browser.json'),JSON.stringify(report,null,2)+'\n');
    console.log(id,report.triangles,report.draws,Math.max(...report.clips.flatMap(c=>c.comparison.map(v=>v.maxBoundsErrorMetres))));
  }
  const layouts=JSON.parse(await readFile('assets-src/rooms/scene-layouts.json','utf8'));
  const room=layouts.rooms.find(r=>r.roomId==='spec001:R11');
  await page.setViewportSize({width:960,height:540});
  const stage=await page.evaluate(r=>window.inspect.stageR11(r),room);
  await page.locator('canvas').screenshot({path:path.join(raw,'R11-clearance.png')});
  await writeFile(path.join(raw,'R11-clearance.json'),JSON.stringify(stage,null,2)+'\n');
  if(errors.length)throw Error(JSON.stringify(errors));
}finally{
  await context?.close();
  if(server)await new Promise(r=>server.close(r));
  await rm(scratch,{recursive:true,force:true});
}
