// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {chromium, firefox} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const task=process.argv[2];
assert.ok(['T129','T130','T131'].includes(task));
const dir=new URL('../'+task+'/',import.meta.url), root=new URL('../../../',dir);
const {voices, packetId}=JSON.parse(await readFile(new URL('records/exports.json',dir),'utf8'));
const seal=JSON.parse(await readFile(new URL('records/listening-seal.json',dir),'utf8'));
const html=await readFile(new URL('review.html',dir));
assert.equal(createHash('sha256').update(html).digest('hex'),seal.html.sha256);
const files=new Map();
for(const line of voices)files.set('/'+line.web.path,await readFile(new URL(line.web.path,root)));
const pagePath=new URL(dir).pathname.replace(root.pathname,'')+'review.html';
const server=createServer((req,res)=>{
  const body=files.get(req.url);
  if(body)return res.writeHead(200,{'Content-Type':'audio/mpeg'}).end(body);
  if(req.url==='/'+pagePath)return res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}).end(html);
  res.writeHead(404).end();
});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const reports=[];
try{
  for(const engine of [chromium,firefox]){
    const browser=await engine.launch();
    try{
      const session=await browser.newContext({viewport:{width:390,height:844}});
      const page=await session.newPage();
      await page.goto(new URL('review.html',dir).href);
      for(const line of voices){
        const section=page.locator('#line-'+line.number);
        assert.equal(await section.locator('.caption').textContent(),line.caption);
        assert.equal(await section.getByRole('heading').textContent(),line.number+' · '+line.speaker);
      }
      const observed=[];
      for(const line of voices){
        await page.getByRole('button',{name:'Replay line '+line.number,exact:true}).focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(n=>{
          const a=document.getElementById('audio-'+n);
          return !a.paused && a.currentTime>0 && [...document.querySelectorAll('audio')].every(el=>el===a||el.paused);
        },line.number);
        observed.push(line.number);
      }
      await page.getByRole('button',{name:'Skip current line'}).click();
      assert.ok(await page.locator('audio').evaluateAll(els=>els.every(x=>x.paused)));
      await page.getByRole('button',{name:'Play all lines in order'}).click();
      await page.waitForFunction(n=>document.getElementById('audio-'+n).currentTime>0,voices[0].number);
      await page.getByRole('button',{name:'Skip current line'}).click();
      await page.waitForFunction(n=>!document.getElementById('audio-'+n).paused && document.getElementById('audio-'+n).currentTime>0, voices[1].number);
      await page.locator('#audio-'+voices[1].number).evaluate(a=>{a.currentTime=a.duration-0.15});
      await page.waitForFunction(n=>!document.getElementById('audio-'+n).paused && document.getElementById('audio-'+n).currentTime>0, voices[2].number);
      await page.getByRole('button',{name:'Stop playback'}).click();
      const stopped=await page.locator('audio').evaluateAll(els=>els.every(el=>el.paused && el.currentTime===0));
      assert.ok(stopped);
      await page.addStyleTag({content:'html{font-size:200%}'});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
      const audit=await new AxeBuilder({page}).analyze();
      assert.deepEqual(audit.violations.map(r=>r.id),[]);
      await page.goto('http://127.0.0.1:'+server.address().port+'/'+pagePath);
      const decoded=await page.evaluate(async rows=>{
        const context=new OfflineAudioContext(1,1,48000), out=[];
        for(const row of rows){
          const raw=await (await fetch('/'+row.web.path)).arrayBuffer();
          const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),v=>v.toString(16).padStart(2,'0')).join('');
          const bytes=raw.byteLength;
          const sound=await context.decodeAudioData(raw);
          if(hash!==row.web.sha256 || bytes!==row.web.bytes || sound.numberOfChannels!==1 ||
            Math.abs(sound.length-row.webFrames)>2304 || sound.sampleRate!==48000)throw Error('Decode identity or duration '+row.number);
          const samples=sound.getChannelData(0);
          let peak=0,energy=0;
          for(const s of samples){energy+=s*s;peak=Math.max(peak,Math.abs(s))}
          if(!Number.isFinite(energy) || energy===0 || peak>=1)throw Error('Decoded signal '+row.number);
          out.push({number:row.number,sha256:hash,frames:sound.length,rate:sound.sampleRate,peak,energy});
        }
        return out;
      },voices);
      reports.push({engine:engine.name(),version:browser.version(),offlineKeyboardPlayback:observed,
        transcriptMatches:true,interruptsPriorPlayback:true,sequencedSkipAndNaturalAdvance:true,stopped,
        axeViolations:[],narrow390At200Percent:true,decoded});
      console.log(task,engine.name(),decoded.length,'passed');
    }finally{await browser.close()}
  }
  await writeFile(new URL('records/browser.json',dir),JSON.stringify({packetId,timeUtc:new Date().toISOString(),
    environment:'Headless browsers on Mac ARM64, offline review and ephemeral loopback HTTP; fixture playback.',reports},null,2)+'\n');
}finally{server.close()}
