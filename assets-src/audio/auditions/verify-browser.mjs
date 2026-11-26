// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Strict local HTTPS, real Firefox decode/metadata; no listening or runtime claim.
import { firefox } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { localTls } from '../../../tests/e2e/support/local-tls.ts';

if (process.versions.node !== '26.13.1') throw new Error('Use pinned Node26.13.1');
const out=new URL('./provenance/browser-decode.json',import.meta.url);
const seal=JSON.parse(await readFile(new URL('./provenance/review-packet-seal.json',import.meta.url),'utf8'));
let local,context;
const startedUtc=new Date().toISOString();
try {
 local=await localTls();
 context=await firefox.launchPersistentContext(local.profile,{headless:true,ignoreHTTPSErrors:false,
  env:{PATH:process.env.PATH??'',LANG:'C',LC_ALL:'C'}});
 const page=await context.newPage();
 await page.goto(local.url,{waitUntil:'load'});
 await page.setContent('<!doctype html><meta charset="utf-8"><title>T065 decoder check</title><button id="start">Check audio files</button><output id="status">Ready</output>');
 const requests=seal.candidates.map(c=>({slug:c.slug,file:c.files.find(f=>f.path.endsWith('.mp3'))}));
 const records=await page.evaluate(async({requests,base})=>{
  const context=new AudioContext({sampleRate:48000});const rows=[];
  try {
   for(const row of requests) {
    const url=new URL('assets/audio/auditions/'+row.slug+'.mp3',base).href;
    const response=await fetch(url);if(!response.ok)throw new Error('HTTP '+response.status);
    const bytes=await response.arrayBuffer();
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
    if(digest!==row.file.sha256||bytes.byteLength!==row.file.bytes)throw new Error('Frozen bytes mismatch');
    const decoded=await context.decodeAudioData(bytes.slice(0));let peak=0,finite=true;
    for(let ch=0;ch<decoded.numberOfChannels;ch++)for(const x of decoded.getChannelData(ch)){finite&&=Number.isFinite(x);peak=Math.max(peak,Math.abs(x));}
    const media=document.createElement('audio');media.preload='metadata';media.muted=true;media.controls=true;
    document.body.append(media);
    const loaded=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('metadata timeout')),5000);media.onloadedmetadata=()=>{clearTimeout(timer);resolve();};media.onerror=()=>{clearTimeout(timer);reject(new Error('media decode error'));};});
    media.src=url;await loaded;
    rows.push({slug:row.slug,path:row.file.path,sha256:digest,bytes:bytes.byteLength,status:response.status,
      mimeType:response.headers.get('content-type'),mediaDuration:media.duration,mediaReadyState:media.readyState,
      webAudioDuration:decoded.duration,sampleRate:decoded.sampleRate,frames:decoded.length,
      channels:decoded.numberOfChannels,peakAbsolute:peak,finite,canPlayMpeg:media.canPlayType('audio/mpeg')});
    media.removeAttribute('src');media.load();media.remove();
   }
   return rows;
  }finally{await context.close();}
 },{requests,base:local.url});
 if(records.length!==12||records.some(r=>!r.finite||r.peakAbsolute<=0))throw new Error('Invalid decoded audio');
 const record={startedUtc,finishedUtc:new Date().toISOString(),browser:context.browser()?.version(),
  node:process.version,environment:'macOS26.6.2 arm64; Firefox native headless; isolated trusted NSS profile; ignoreHTTPSErrors:false; loopback HTTPS; no production host',
  packetId:seal.packetId,packetSealSha256:createHash('sha256').update(await readFile(new URL('./provenance/review-packet-seal.json',import.meta.url))).digest('hex'),
  methods:['WebAudio decodeAudioData','HTMLMediaElement loadedmetadata','fetch exact SHA256'],records,
  limits:'No audible listening from this run; no Safari/Chrome acceptance, in-game skip/ducking/loop/lifecycle or performance gate claim.'};
 await writeFile(out,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({browser:record.browser,candidates:records.length,strictTls:true,exactFrozenHashes:true}));
}finally{await context?.close();await local?.stop();}
