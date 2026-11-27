// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Isolated Web Audio fixture for the exact room files and the authored walking graph.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium,firefox} from '@playwright/test';

const here=new URL('./',import.meta.url);
const root=new URL('../../../',here);
const json=async url=>JSON.parse(await readFile(url));
const plans=(await json(new URL('../production-plan.json',here))).ambience;
const refs=[],edges=[], files=new Map();
const voice=(await json(new URL('records/listening-mix.json',here))).voice;
for(const plan of plans) {
  const room=plan.roomId.slice(-3);
  const ref=await json(new URL('records/'+room.toLowerCase()+'-export.json',here));
  refs.push(ref);
  const record=await json(new URL('content/spec001/rooms/'+room+'.json',root));
  for(const exit of record.exits) edges.push([ref.slug,exit.toRoomId.slice(-3).toLowerCase()]);
}
assert.equal(refs.length,12);
assert.equal(edges.length,28);
for(const value of [...refs.map(r=>r.web),voice]) files.set('/'+value.path,await readFile(new URL(value.path,root)));
const server=createServer((req,res)=>{
  if(req.url==='/') return res.setHeader('Content-Type','text/html').end('<button>Enable sound</button>');
  if(files.has(req.url)) return res.setHeader('Content-Type','audio/mpeg').end(files.get(req.url));
  res.writeHead(404).end();
});
server.listen(0,'127.0.0.1');
await once(server,'listening');

async function measure({refs,edges,voice}) {
  const context=window.roomContext,rate=48000,cache=new Map(),rows=[];
  const require=(pass,msg)=>{if(!pass) throw Error(msg);};
  const source=(ctx,data)=>{const n=ctx.createBufferSource();n.buffer=data;return n;};
  const copy=(buf,pos,n,ch=0)=>{const a=new Float32Array(n);buf.copyFromChannel(a,ch,pos);return a;};
  async function fetchAudio(file) {
    const response=await fetch('/'+file.path);
    require(response.ok,file.path);
    const bytes=await response.arrayBuffer();
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(i=>i.toString(16).padStart(2,'0')).join('');
    require(digest===file.sha256 && bytes.byteLength===file.bytes,file.path+' integrity');
    return context.decodeAudioData(bytes);
  }
  const speech=await fetchAudio(voice);
  for(const ref of refs) {
    const data=await fetchAudio(ref.web),n=ref.frames;
    require(data.numberOfChannels===2 && data.sampleRate===rate && data.length>=n,ref.slug+' decode');
    const a=ref.anchor,origin=data.getChannelData(0);
    let offset=0,best=-1;
    for(let lag=0;lag<=4096;lag++) {
      let xx=0,yy=0,xy=0;
      a.samples.forEach((x,j)=>{const y=origin[a.frame+j*a.stride+lag];xx+=x*x;yy+=y*y;xy+=x*y;});
      const score=xy/Math.sqrt(xx*yy);
      if(score>best){best=score;offset=lag;}
    }
    require(best>.90 && offset+n<=data.length,ref.slug+' anchor '+JSON.stringify({offset,best,n,len:data.length}));
    const head=[0,1].map(ch=>copy(data,offset,512,ch));
    const tail=[0,1].map(ch=>copy(data,offset+n-512,512,ch));
    const render=new OfflineAudioContext(2,3*n+512,rate), loop=source(render,data);
    loop.loop=true;loop.loopStart=offset/rate;loop.loopEnd=(offset+n)/rate;
    loop.connect(render.destination);loop.start(0,offset/rate);
    const output=await render.startRendering(), joins=[];
    for(let count=1;count<=3;count++) {
      let error=0,step=0;
      for(let ch=0;ch<2;ch++){
        const samples=output.getChannelData(ch),at=count*n;
        step=Math.max(step,Math.abs(samples[at]-samples[at-1]));
        for(let j=0;j<512;j++) error=Math.max(error,Math.abs(samples[at-512+j]-tail[ch][j]),Math.abs(samples[at+j]-head[ch][j]));
      }
      require(Number.isFinite(error) && error<.0005,ref.slug+' loop seam '+error);
      joins.push({atFrame:count*n,maxError:error,maxStep:step});
    }
    const muteAt=Math.ceil(speech.duration)+2, end=muteAt+1;
    const test=new OfflineAudioContext(2,end*rate,rate),bed=source(test,data),talk=source(test,speech),gain=test.createGain();
    const pos=offset+Math.floor(n/3), under=copy(data,pos,end*rate),words=copy(speech,0,speech.length);
    const db=10**(-6/20), spokenEnd=1+speech.duration;
    gain.gain.setValueAtTime(1,0);gain.gain.setValueAtTime(1,.88);gain.gain.linearRampToValueAtTime(db,1);
    gain.gain.setValueAtTime(db,spokenEnd);gain.gain.linearRampToValueAtTime(1,spokenEnd+.35);
    gain.gain.setValueAtTime(0,muteAt);gain.gain.setValueAtTime(1,muteAt+.5);
    bed.connect(gain).connect(test.destination);talk.connect(test.destination);bed.start(0,pos/rate);talk.start(1);
    const combined=(await test.startRendering()).getChannelData(0);
    let mixError=0,mutePeak=0,restoredPeak=0;
    for(let i=0;i<combined.length;i++){
      const t=i/rate;
      let refGain=1;
      if(t>=.88&&t<1) refGain=1+(db-1)*(t-.88)/.12;
      else if(t>=1&&t<spokenEnd) refGain=db;
      else if(t>=spokenEnd&&t<spokenEnd+.35) refGain=db+(1-db)*(t-spokenEnd)/.35;
      else if(t>=muteAt&&t<muteAt+.5) refGain=0;
      mixError=Math.max(mixError,Math.abs(combined[i]-((words[i-rate]??0)+under[i]*refGain)));
      if(t>=muteAt&&t<muteAt+.5) mutePeak=Math.max(mutePeak,Math.abs(combined[i]));
      if(t>=muteAt+.5) restoredPeak=Math.max(restoredPeak,Math.abs(combined[i]));
    }
    require(mixError<.001 && mutePeak===0 && restoredPeak>.0001,'mix '+ref.slug);
    rows.push({room:ref.slug,sha256:ref.web.sha256,frames:n,decodedFrames:data.length,decodedOffset:offset,
               anchorCorrelation:best,joins,mutePeak,restoredPeak,mixError});
    cache.set(ref.slug,{data,n,offset});
  }
  const transitions=[],sink=context.createGain();
  sink.gain.value=0;sink.connect(context.destination);
  for(const [from,to] of edges) {
    const a=cache.get(from),b=cache.get(to),len=rate/2,fading=rate/4;
    const old=copy(a.data,a.offset+a.n-rate,len),next=copy(b.data,b.offset,len);
    function crossfade(ctx,dest,start) {
      const out=source(ctx,a.data),incoming=source(ctx,b.data),g1=ctx.createGain(),g2=ctx.createGain();
      g1.gain.setValueAtTime(1,start);g1.gain.linearRampToValueAtTime(0,start+.25);
      g2.gain.setValueAtTime(0,start);g2.gain.linearRampToValueAtTime(1,start+.25);
      out.connect(g1).connect(dest);incoming.connect(g2).connect(dest);
      out.start(start,(a.offset+a.n-rate)/rate);incoming.start(start,b.offset/rate);
      out.stop(start+.25);incoming.stop(start+.5);
      return [out,incoming];
    }
    const test=new OfflineAudioContext(2,len,rate);
    crossfade(test,test.destination,0);
    const samples=(await test.startRendering()).getChannelData(0);
    let error=0,peak=0;
    for(let j=0;j<len;j++){
      const t=Math.min(1,j/fading);
      error=Math.max(error,Math.abs(samples[j]-(old[j]*(1-t)+next[j]*t)));
      peak=Math.max(peak,Math.abs(samples[j]));
    }
    require(error<.001 && peak>0 && peak<1,from+' to '+to+' '+error);
    // Run the same curve on the unlocked live context. Await disposal of both
    // voices before another transition. The sink stays silent during automation.
    const live=crossfade(context,sink,context.currentTime+.035);
    await Promise.all(live.map(node=>new Promise(resolve=>{node.onended=()=>{node.disconnect();resolve();};})));
    transitions.push({from,to,peak,maxError:error,liveSourcesEnded:2,crossfadeMs:250});
  }
  await context.suspend();
  const when=context.currentTime;
  await new Promise(ok=>setTimeout(ok,120));
  require(context.state==='suspended'&&when===context.currentTime,'pause');
  await context.resume();await new Promise(ok=>setTimeout(ok,130));
  require(context.state==='running'&&context.currentTime>when,'resume');
  const resumedDelta=context.currentTime-when;
  await context.close();
  return {rows,transitions,unchangedSuspendedClock:true,resumedDelta,finalState:context.state};
}

try {
  const engines=[];
  for(const engine of [chromium,firefox]) {
    const browser=await engine.launch();
    try {
      const page=await browser.newPage();
      await page.goto('http://127.0.0.1:'+server.address().port);
      await page.evaluate(()=>{document.querySelector('button').onclick=()=>{
        window.roomContext=new AudioContext({sampleRate:48000});window.started=window.roomContext.resume();
      };});
      await page.getByRole('button').click();await page.evaluate(()=>window.started);
      const result=await page.evaluate(measure,{refs,edges,voice});
      engines.push({name:engine.name(),version:browser.version(),...result});
      console.log(engine.name(),result.rows.length,'beds',result.transitions.length,'directed transitions');
    } finally {await browser.close();}
  }
  await writeFile(new URL('records/browser.json',here),JSON.stringify({at:new Date().toISOString(),
      scope:'Isolated localhost fixture. Native sample renders and live context transitions under silent automation. Human listening and final in-game playback await review.',
      engines},null,2)+'\n');
} finally {server.close();}
