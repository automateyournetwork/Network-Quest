// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Native music production checks; this fixture has no application state.
import { chromium, firefox } from '@playwright/test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';

const dir = new URL('./', import.meta.url);
const slugs = ['radio', 'clockworks', 'rift', 'epilogue'];
const read = path => readFile(new URL(path, dir));
const refs = await Promise.all(slugs.map(async slug => JSON.parse(await read('records/'+slug+'-export.json'))));
const voice = JSON.parse(await read('records/listening-mix.json')).voice;
const files = new Map();
for (const {web} of refs) files.set('/'+web.path, await read('../../../'+web.path));
files.set('/'+voice.path, await read('../../../'+voice.path));
const server = createServer((req,res) => {
  if(req.url==='/') {res.setHeader('Content-Type','text/html'); res.end('<button>Enable sound</button>'); return;}
  if(files.has(req.url)) {res.setHeader('Content-Type','audio/mpeg');res.end(files.get(req.url));return;}
  res.writeHead(404).end();
});
server.listen(0,'127.0.0.1');
await once(server,'listening');

async function probe({refs,voice}) {
  const live = window.live;
  await window.unlocked;
  const rate = 48000;
  const assert = (ok,msg) => { if (!ok) throw new Error(msg); };
  const copied = (buf, offset, n, ch=0) => {
    const a = new Float32Array(n);
    buf.copyFromChannel(a,ch,offset);
    return a;
  };
  async function decode(file) {
    const resp = await fetch('/'+file.path);
    assert(resp.ok,'HTTP read '+file.path);
    const raw=await resp.arrayBuffer();
    const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(x=>x.toString(16).padStart(2,'0')).join('');
    assert(sha===file.sha256 && raw.byteLength===file.bytes,'Asset changed '+file.path);
    const buf = await live.decodeAudioData(raw);
    assert(buf.sampleRate===rate,'Rate mismatch');
    return buf;
  }
  function align(ref, data) {
    const a=ref.anchor, s=data.getChannelData(a.channel);
    let offset=0, correlation=-1;
    for(let shift=0;shift<=4096;shift++) {
      let xx=0,xy=0,yy=0;
      for(let i=0;i<a.samples.length;i++) {
        const x=a.samples[i],y=s[a.frame+shift+i*a.stride];
        xx+=x*x; xy+=x*y; yy+=y*y;
      }
      const score=xy/Math.sqrt(xx*yy);
      if(score>correlation) { correlation=score;offset=shift; }
    }
    assert(correlation>.92 && offset+ref.frames<=data.length,'Decoder alignment '+ref.slug);
    return {offset,correlation};
  }
  function source(context,buffer) {
    const node=context.createBufferSource();
    node.buffer=buffer;
    return node;
  }
  async function boundaries(ref, data, offset) {
    const n=ref.frames, looping=ref.loopStartSample!==null;
    const rounds = looping ? 3 : 1;
    const render=new OfflineAudioContext(2,n*rounds+rate/4,rate);
    const heads=[0,1].map(ch=>copied(data,offset,512,ch));
    const tails=[0,1].map(ch=>copied(data,offset+n-512,512,ch));
    const node=source(render,data);
    node.loop=looping;
    if(looping) {node.loopStart=offset/rate; node.loopEnd=(offset+n)/rate;}
    node.connect(render.destination);
    node.start(0,offset/rate);
    const output=await render.startRendering(), joins=[];
    if(looping) {
      for(let i=1;i<=rounds;i++) {
        let error=0, edge=0;
        for(let ch=0;ch<2;ch++) {
          const samples=output.getChannelData(ch), at=i*n;
          edge=Math.max(edge,Math.abs(samples[at]-samples[at-1]));
          for(let j=0;j<512;j++) {
            error=Math.max(error,Math.abs(samples[at+j]-heads[ch][j]), Math.abs(samples[at-512+j]-tails[ch][j]));
          }
        }
        assert(Number.isFinite(error) && error<.0005, ref.slug+' loop '+i+' error '+error);
        joins.push({sample:i*n,maximumError:error,maximumBoundaryStep:edge});
      }
      return {joins};
    }
    let finalReleasePeak=0,postSongPeak=0;
    for(let ch=0;ch<2;ch++) {
      const samples=output.getChannelData(ch);
      for(let i=n-rate/8;i<n;i++) finalReleasePeak=Math.max(finalReleasePeak,Math.abs(samples[i]));
      for(let i=n;i<samples.length;i++) postSongPeak=Math.max(postSongPeak,Math.abs(samples[i]));
    }
    assert(finalReleasePeak<.0001 && postSongPeak<.0001,'One-shot tail restarted');
    return {loop:node.loop,finalReleasePeak,postSongPeak,postSongFrames:rate/4};
  }
  const spoken = await decode(voice);
  assert(spoken.numberOfChannels===1,'Reference speech must be mono');
  const rows=[];
  let previous;
  for(const ref of refs) {
    const data=await decode(ref.web);
    assert(data.numberOfChannels===2,'Music must be stereo');
    const {offset,correlation}=align(ref,data);
    const behavior=await boundaries(ref,data,offset);
    let transition=null;
    if(previous) {
      const offline=new OfflineAudioContext(2,rate,rate);
      const fromAt=previous.offset+previous.frames-rate;
      const from=copied(previous.data,fromAt,rate), to=copied(data,offset,rate);
      for(const [buf,at,first,last] of [[previous.data,fromAt,1,0],[data,offset,0,1]]) {
        const v=source(offline,buf), g=offline.createGain();
        g.gain.setValueAtTime(first,0); g.gain.linearRampToValueAtTime(last,.25);
        v.connect(g).connect(offline.destination);v.start(0,at/rate);
      }
      const measured=(await offline.startRendering()).getChannelData(0);
      let error=0,peak=0;
      for(let i=0;i<rate;i++) {
        const f=Math.min(1,i/(rate*.25)), want=from[i]*(1-f)+to[i]*f;
        error=Math.max(error,Math.abs(measured[i]-want));peak=Math.max(peak,Math.abs(measured[i]));
      }
      assert(Number.isFinite(error)&&error<.001&&peak<1&&peak>.00001,'Transition '+previous.slug+' to '+ref.slug);
      transition={from:previous.slug,to:ref.slug,seconds:.25,peak,maximumReferenceError:error};
    }
    // Drive actual WebAudio gain automation under a separately decoded approved voice.
    // Check speech + bed sample by sample, then check an explicit mute and restoration.
    const t0=1, t1=t0+spoken.duration, mute=Math.ceil(t1)+1, finish=mute+1;
    const offline=new OfflineAudioContext(2,finish*rate,rate);
    const pos=offset+Math.floor(ref.frames/3), bed=copied(data,pos,finish*rate), words=copied(spoken,0,spoken.length);
    const node=source(offline,data), gain=offline.createGain(), speech=source(offline,spoken);
    const floor=10**(-6/20);
    gain.gain.setValueAtTime(1,0);gain.gain.setValueAtTime(1,t0-.12);
    gain.gain.linearRampToValueAtTime(floor,t0);gain.gain.setValueAtTime(floor,t1);
    gain.gain.linearRampToValueAtTime(1,t1+.35);gain.gain.setValueAtTime(0,mute);
    gain.gain.setValueAtTime(1,mute+.5);
    node.connect(gain).connect(offline.destination);speech.connect(offline.destination);
    node.start(0,pos/rate);speech.start(t0);
    const measured=(await offline.startRendering()).getChannelData(0);
    let error=0,mutePeak=0,unmutedPeak=0;
    for(let i=0;i<measured.length;i++) {
      const t=i/rate;
      let f=1;
      if(t>=t0-.12&&t<t0) f=1+(floor-1)*(t-t0+.12)/.12;
      else if(t>=t0&&t<t1) f=floor;
      else if(t>=t1&&t<t1+.35) f=floor+(1-floor)*(t-t1)/.35;
      else if(t>=mute&&t<mute+.5) f=0;
      const v=words[i-rate]??0;
      error=Math.max(error, Math.abs(measured[i]-(bed[i]*f+v)));
      if(t>=mute && t<mute+.5) mutePeak=Math.max(mutePeak,Math.abs(measured[i]));
      if(t>=mute+.5) unmutedPeak=Math.max(unmutedPeak,Math.abs(measured[i]));
    }
    assert(Number.isFinite(error)&&error<.001&&mutePeak===0&&unmutedPeak>.0001, 'Speech/mute '+ref.slug+' '+JSON.stringify({error,mutePeak,unmutedPeak}));
    previous={slug:ref.slug,data,frames:ref.frames,offset};
    rows.push({slug:ref.slug,sha256:ref.web.sha256,decodedFrames:data.length,decodedOffset:offset,anchorCorrelation:correlation,
      loopStartSample:ref.loopStartSample===null?null:offset,loopEndSample:ref.loopEndSample===null?null:offset+ref.frames,
      behavior,transition,voiceSha256:voice.sha256,duckDb:-6,attackMs:120,releaseMs:350,mutePeak,unmutedPeak,mixMaximumError:error});
  }
  const playing=source(live,previous.data), silent=live.createGain(); silent.gain.value=0;
  playing.connect(silent).connect(live.destination);playing.start();
  await live.suspend();
  const state=live.state,at=live.currentTime;
  await new Promise(ok=>setTimeout(ok,100));
  assert(state==='suspended' && live.currentTime===at,'Clock advanced during pause');
  await live.resume();
  await new Promise(ok=>setTimeout(ok,150));
  const resumed=live.state,delta=live.currentTime-at;
  assert(resumed==='running'&&delta>0,'Resume failed');
  playing.stop();await live.close();
  return {rows,suspended:state,suspendedTimeAdvanced:false,resumed,resumedSeconds:delta,closed:live.state};
}

try {
  const engines=[];
  for(const driver of [chromium,firefox]) {
    const browser=await driver.launch();
    try {
      const page=await browser.newPage();
      await page.goto('http://127.0.0.1:'+server.address().port+'/');
      await page.evaluate(()=> {document.querySelector('button').onclick=()=>{window.live=new AudioContext({sampleRate:48000});window.unlocked=window.live.resume();};});
      await page.getByRole('button').click();
      engines.push({name:driver.name(),version:browser.version(),...await page.evaluate(probe,{refs,voice})});
      console.log(driver.name(),browser.version(),'passed');
    } finally {await browser.close();}
  }
  await writeFile(new URL('records/browser.json',dir),JSON.stringify({
      testedAt:new Date().toISOString(),method:'Exact HTTP bytes, native decoder and PCM anchor. Native offline buffer-source scheduling and gain automation; live gesture/suspend/resume/close. Isolated production fixture.',
      rate:48000,engines},null,2)+'\n');
} finally {server.close();}
