// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Isolated browser probe for the four actual encoded music assets.
import { chromium, firefox } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { once } from 'node:events';

const dir = new URL('./',import.meta.url);
const cues = ['title','workshop','copper','fiber'];
const refs = await Promise.all(cues.map(async slug =>
  JSON.parse(await readFile(new URL('records/'+slug+'-export.json', dir),'utf8'))));
const files = new Map(await Promise.all(cues.map(async slug => [
  '/'+slug+'.mp3', await readFile(new URL('../../../public/assets/audio/music/'+slug+'.mp3',dir))
])));
const server = createServer((req,res) => {
  const data=files.get(req.url);
  if (data) { res.setHeader('Content-Type','audio/mpeg'); return res.end(data); }
  if (req.url==='/') { res.setHeader('Content-Type','text/html'); return res.end('<button>Start cue check</button>'); }
  res.writeHead(404).end();
});
server.listen(0,'127.0.0.1');
await once(server,'listening');

try {
 const records=[];
 for (const driver of [chromium,firefox]) {
  const browser = await driver.launch({ headless:true });
  try {
   const page = await browser.newPage();
   await page.goto('http://127.0.0.1:'+server.address().port+'/');
   await page.evaluate(() => {
     document.querySelector('button').onclick = () => {
       window.cueContext = new AudioContext({sampleRate:48000});
       window.unlocked = window.cueContext.resume();
     };
   });
   await page.getByRole('button').click();
   const rows = await page.evaluate(async refs => {
     await window.unlocked;
     const live=window.cueContext;
     if(live.state!=='running') throw Error('Gesture did not unlock WebAudio');
     const results=[];
     let last=null;
     for(const ref of refs) {
       const response=await fetch('/'+ref.slug+'.mp3'), bytes=await response.arrayBuffer();
       const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
       if(!response.ok || hash!==ref.mp3Sha256) throw Error('Cue fetch/hash mismatch');
       const data=await live.decodeAudioData(bytes), rate=data.sampleRate;
       if(rate!==48000 || data.numberOfChannels!==2) throw Error('Incorrect decoded format');
       // Align the decoder to a preserved PCM24 anchor; never assume an encoder delay.
       const a=ref.anchor,s=data.getChannelData(a.channel);
       let offset=0,corr=-1;
       for(let shift=0;shift<=4096;shift++){
         let xx=0,xy=0,yy=0;
         for(let i=0;i<a.samples.length;i++){
           const x=a.samples[i],y=s[a.start+shift+i*a.stride];
           xx+=x*x;xy+=x*y;yy+=y*y;
         }
         const v=xy/Math.sqrt(xx*yy);
         if(v>corr){offset=shift;corr=v;}
       }
       const frames=ref.frames;
       if(corr<.92 || offset+frames>data.length) throw Error(ref.slug+' invalid alignment '+JSON.stringify({offset,corr,frames,decoded:data.length}));
       const render=new OfflineAudioContext(2,frames*3+1024,rate);
       const source=render.createBufferSource();
       source.buffer=data; source.loop=true; source.loopStart=offset/rate; source.loopEnd=(offset+frames)/rate;
       source.connect(render.destination); source.start(0,offset/rate);
       const rendered=await render.startRendering();
       const joins=[];
       for(let loop=1;loop<=3;loop++){
         let error=0,peak=0,edge=0;
         for(let ch=0;ch<2;ch++){
           const actual=rendered.getChannelData(ch),original=data.getChannelData(ch),index=frames*loop;
           edge=Math.max(edge,Math.abs(actual[index]-actual[index-1]));
           for(let j=-512;j<512;j++){
             const expected=original[offset+(j+frames)%frames];
             error=Math.max(error,Math.abs(actual[index+j]-expected));
             peak=Math.max(peak,Math.abs(actual[index+j]));
           }
         }
         if(error>.0005 || peak<=.00001) throw Error(ref.slug+' join '+loop+' '+JSON.stringify({error,peak}));
         joins.push({join:loop,observedLoopFrame:frames*loop,maximumReferenceSampleError:error,peak,absoluteBoundaryStep:edge});
       }
       // Render a 250 ms room-to-room transition, driven by the actual previous/current web audio.
       let transition=null;
       if(last){
         const mix=new OfflineAudioContext(2,rate,rate),ramp=rate/4;
         const previousTail=new Float32Array(rate),nextHead=new Float32Array(rate);
         last.data.copyFromChannel(previousTail,0,last.offset+last.frames-rate);
         data.copyFromChannel(nextHead,0,offset);
         const setup=(buf,start,g0,g1) => {
           const voice=mix.createBufferSource(),gain=mix.createGain();voice.buffer=buf;
           voice.connect(gain).connect(mix.destination);
           gain.gain.setValueAtTime(g0,0); gain.gain.linearRampToValueAtTime(g1,.25);
           voice.start(0,start/rate);return voice;
         };
         setup(last.data,last.offset+last.frames-rate,1,0); setup(data,offset,0,1);
         const signal=(await mix.startRendering()).getChannelData(0);
         let peak=0,error=0;
         for(let i=0;i<rate;i++){
           const f=Math.min(1,i/ramp),expected=(1-f)*previousTail[i]+f*nextHead[i];
           error=Math.max(error,Math.abs(signal[i]-expected));peak=Math.max(peak,Math.abs(signal[i]));
         }
         if(!Number.isFinite(error)||error>.001||peak<=0||peak>=1) throw Error('Transition '+JSON.stringify({error,peak}));
         transition={from:last.slug,to:ref.slug,durationSeconds:.25,peak,maximumReferenceSampleError:error};
       }
       last={data,slug:ref.slug,offset,frames};
       results.push({slug:ref.slug,sha256:hash,decodedFrames:data.length,channels:data.numberOfChannels,rate,
         loopStartSample:offset,loopEndSample:offset+frames,anchorCorrelation:corr,joins,transition});
     }
     await live.suspend(); const suspended=live.state;
     await live.resume(); const resumed=live.state;
     await live.close();
     if(suspended!=='suspended'||resumed!=='running') throw Error('Pause/resume failed');
     return {results,suspended,resumed,closed:live.state};
   },refs);
   records.push({engine:driver.name(),version:browser.version(),...rows});
   console.log(driver.name(),browser.version(),rows.results.map(r=>[r.slug,r.loopStartSample,r.decodedFrames]));
  } finally {await browser.close();}
 }
 await writeFile(new URL('records/browser.json',dir),JSON.stringify({utc:new Date().toISOString(),
   environment:'macOS ARM64, locally installed pinned Playwright, loopback HTTP, headless Chromium/Firefox. No acoustic playback or user account.',
   methods:'Exact-byte WebAudio decode, independent PCM master anchor, three full native-size loops with sample comparison, pairwise 250 ms transition renders, gesture unlock/suspend/resume/close.',
   records},null,2)+'\n');
} finally {server.close();}
