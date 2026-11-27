// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Exercise the actual listening packet on an isolated loopback origin.
import {chromium, firefox} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import assert from 'node:assert/strict';

const root = new URL('../../../',import.meta.url);
const relative = 'assets-src/audio/T128/';
const exports = JSON.parse(await readFile(new URL(relative+'records/exports.json',root),'utf8'));
const entries = exports.effects;
const pagePath = relative+'review.html';
const files = new Map([[pagePath,await readFile(new URL(pagePath,root))]]);
for (const e of entries) for (const f of [e.web,e.context.file]) {
  files.set(f.path,await readFile(new URL(f.path,root)));
}
const server = createServer((req,res) => {
  const path = (req.url??'').slice(1);
  if (!files.has(path)) { res.writeHead(404).end(); return; }
  res.writeHead(200,{'Content-Type':path===pagePath?'text/html; charset=utf-8':'audio/mpeg'});
  res.end(files.get(path));
});
server.listen(0,'127.0.0.1');
await once(server,'listening');

async function probe(driver) {
  const browser = await driver.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:'+server.address().port+'/'+pagePath);
    const before = await page.evaluate(() => [...document.querySelectorAll('audio')].every(a=>a.paused&&!a.autoplay&&!a.loop));
    assert(before);
    await page.evaluate(() => {
      window.starts = [];
      window.ends = [];
      // Keep headless playback off the owner's physical devices. HTMLMediaElement transport remains live.
      window.addEventListener('click', () => {
        window.testContext = new AudioContext({sampleRate:48000});
        const sink = testContext.createGain();
        sink.gain.value = 0;
        sink.connect(testContext.destination);
        for (const player of document.querySelectorAll('audio')) testContext.createMediaElementSource(player).connect(sink);
        window.resumeContext = testContext.resume();
      }, {capture:true,once:true});
      document.addEventListener('play', e=>window.starts.push(e.target.getAttribute('aria-label')),true);
      document.addEventListener('ended', e=>window.ends.push(e.target.getAttribute('aria-label')),true);
    });
    await page.getByRole('button',{name:'Play all effects',exact:true}).click();
    await page.waitForFunction(()=>window.starts.length>0);
    await page.getByRole('button',{name:'Stop playback'}).click();
    const stopped = await page.evaluate(()=>[...document.querySelectorAll('audio')].every(a=>a.paused&&a.currentTime<.03));
    assert(stopped);
    const data = await page.evaluate(async rows=>{
      await window.resumeContext;
      if(testContext.state!=='running') throw Error('gesture unlock');
      const found = [];
      for (const row of rows) {
        const article = document.querySelector(`article[data-number="${row.number}"]`);
        const caption = article.querySelector('.caption');
        const expected = row.brief.caption;
        if(caption.textContent!==expected||!caption.getClientRects().length) throw Error('caption before sound '+row.number);
        const item = {number:row.number,caption:expected,formats:[]};
        for(const [i,f] of [row.web,row.context.file].entries()) {
          const player = article.querySelectorAll('audio')[i];
          const res = await fetch(player.src);
          const raw = await res.arrayBuffer();
          const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(x=>x.toString(16).padStart(2,'0')).join('');
          if(!res.ok||hash!==f.sha256) throw Error('wrong asset '+row.number);
          const audio = await testContext.decodeAudioData(raw);
          const wanted = i===0 ? row.frameCount : row.context.durationFrames;
          const pad = audio.length-wanted;
          if(audio.sampleRate!==48000||audio.numberOfChannels!==i+1||Math.abs(pad)>2400) throw Error('decoded format '+row.number);
          let peak=0,square=0;
          for (const sample of audio.getChannelData(0)) {peak=Math.max(peak,Math.abs(sample));square+=sample*sample}
          if(!Number.isFinite(square)||peak<.005||peak>=.9) throw Error('decoded level '+row.number);
          item.formats.push({sha256:hash,channels:audio.numberOfChannels,frames:audio.length,
            extraDecodedFrames:pad,rate:audio.sampleRate,samplePeak:peak,rms:Math.sqrt(square/audio.length)});
        }
        const solo=article.querySelector('audio');
        solo.muted=true;
        if(caption.textContent!==expected||!caption.getClientRects().length) throw Error('mute caption '+row.number);
        solo.muted=false;
        found.push(item);
      }
      window.starts=[]; window.ends=[];
      return found;
    },entries);
    const playlists = [];
    for(const [button,prefix] of [['Play all effects','Effect '],['Play all room mixes','Room mix ']]){
      await page.getByRole('button',{name:button,exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#state').textContent==='Finished',null,{timeout:100000});
      const events = await page.evaluate(()=>{const result={starts:window.starts,ends:window.ends};window.starts=[];window.ends=[];return result;});
      const expected=entries.map(e=>prefix+e.number);
      assert.deepEqual(events.starts,expected);
      assert.deepEqual(events.ends,expected);
      playlists.push({button,...events});
    }
    await page.getByRole('button',{name:'Play all effects',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('output').textContent==='Playing Effect 21');
    const pageHideStopped = await page.evaluate(()=>{
      window.dispatchEvent(new Event('pagehide'));
      return document.querySelector('output').textContent==='Stopped' &&
        [...document.querySelectorAll('audio')].every(a=>a.paused);
    });
    assert(pageHideStopped);
    await page.evaluate(()=>testContext.close());
    return {engine:driver.name(),version:browser.version(),initiallySilent:before,
      stopVerified:stopped,dispatchedPageHideStopped:pageHideStopped,decoded:data,playlists,captionTest:'All captions rendered before their own playback and retained while muted.'};
  } finally {
    await browser.close();
  }
}

try {
  const reports = await Promise.all([probe(chromium),probe(firefox)]);
  await writeFile(new URL(relative+'records/browser.json',root),JSON.stringify({
    utc:new Date().toISOString(),packetId:exports.packetId,scope:'Listening packet on loopback HTTP. Headless HTML media transports connected to a silent test sink.',
    reports},null,2)+'\n');
  console.log(reports.map(x=>x.engine+' '+x.version+': '+x.decoded.length+' dry/mix pairs, complete transport and captions').join('\n'));
} finally {server.close();}
