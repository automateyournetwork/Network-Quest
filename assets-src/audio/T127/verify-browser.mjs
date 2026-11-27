// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Read the exact review bytes, exercise local-file controls and render the one-shots.
import AxeBuilder from '@axe-core/playwright';
import { chromium, firefox } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';

const here = new URL('./', import.meta.url);
const root = new URL('../../../', here);
const json = async (name) => JSON.parse(await readFile(new URL(name, here), 'utf8'));
const { cues } = await json('records/exports.json');
const seal = await json('records/listening-seal.json');
const tracks = cues.map(row => ({
  id: 'fx-' + row.assetId.slice(-3), label: row.name, caption: row.caption,
  file: row.web, frames: row.webFrames, channels: 1, levelDb: row.webSamplePeakDbfs,
}));
tracks.push({ id: 'mix', label: 'Effects under dialogue', file: seal.context, frames: 52*48000, channels: 2 });
const served = new Map();
for (const row of tracks) served.set('/'+row.file.path, await readFile(new URL(row.file.path, root)));
const server = createServer((req, res) => {
  const data = served.get(req.url);
  if (data) return res.writeHead(200, {'Content-Type':'audio/mpeg'}).end(data);
  if (req.url === '/') return res.writeHead(200, {'Content-Type':'text/html'}).end('<button>Enable playback check</button>');
  res.writeHead(404).end();
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const observations = [];
try {
  for (const driver of [chromium, firefox]) {
    const browser = await driver.launch();
    try {
      const session = await browser.newContext({viewport:{width:390,height:844}});
      const page = await session.newPage();
      await page.goto(new URL('review.html', here).href);
      const pageResult = await page.evaluate(async () => {
        const audio = [...document.querySelectorAll('audio')];
        await Promise.all(audio.map(el => el.readyState >= 1 ? Promise.resolve() : new Promise((ok, fail) => {
          el.addEventListener('loadedmetadata', ok, {once:true});
          el.addEventListener('error', fail, {once:true});
        })));
        return audio.map(el => ({id:el.id, label:el.getAttribute('aria-label'), seconds:el.duration,
          paused:el.paused, controls:el.controls, auto:el.autoplay}));
      });
      if (pageResult.length !== 21) throw Error('Missing review tracks');
      for (const row of tracks) {
        const data = pageResult.find(v=>v.id===row.id);
        if (!data || data.label !== row.label || !data.paused || data.auto || !data.controls ||
            Math.abs(data.seconds-row.frames/48000)>.1) throw Error('Invalid offline track '+row.id);
        if (row.caption && !(await page.locator('section').filter({has:page.locator('audio#'+row.id)})
                                      .getByText(row.caption,{exact:false}).count())) throw Error('Missing action text: '+row.id);
      }
      await page.addStyleTag({content:'html { font-size: 200%; }'});
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      if (!fits) throw Error('Overflow at a narrow viewport with 200% text');
      const audit = await new AxeBuilder({page}).analyze();
      if (audit.violations.length) throw Error('Accessibility violations '+audit.violations.map(r=>r.id).join(','));
      // Check keyboard playback for every linked file, including short transients.
      await page.evaluate(() => {
        window.seenPlaying = new Set();
        for (const el of document.querySelectorAll('audio')) el.addEventListener('playing',()=>window.seenPlaying.add(el.id));
      });
      for (const row of tracks) {
        const replay = page.getByRole('button', {name:'Replay '+row.label,exact:true});
        await replay.focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(id=>window.seenPlaying.has(id),row.id);
      }
      await page.getByRole('button',{name:'Stop playback'}).click();
      await page.getByRole('button',{name:'Mute packet'}).click();
      const mute = await page.locator('audio').evaluateAll(elements=>elements.every(el=>el.muted && el.paused));
      if (!mute || !(await page.getByText(cues[1].caption,{exact:false}).count())) throw Error('Muted text/playback check');
      await page.goto('http://127.0.0.1:'+server.address().port+'/');
      await page.evaluate(() => {
        document.querySelector('button').onclick=() => {
          window.ctx=new AudioContext({sampleRate:48000});
          window.started=window.ctx.resume();
        };
      });
      await page.getByRole('button').click();
      const measured = await page.evaluate(async tracks => {
        await window.started;
        const ctx=window.ctx;
        if(ctx.state!=='running') throw Error('Web Audio context did not start');
        const outputs=[];
        for (const row of tracks) {
          const response=await fetch('/'+row.file.path);
          if(!response.ok) throw Error(row.id+' fetch failed');
          const bytes=await response.arrayBuffer();
          const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
            .map(x=>x.toString(16).padStart(2,'0')).join('');
          if(digest!==row.file.sha256 || bytes.byteLength!==row.file.bytes) throw Error(row.id+' changed');
          const decoded=await ctx.decodeAudioData(bytes);
          if(decoded.numberOfChannels!==row.channels || decoded.sampleRate!==48000 ||
             Math.abs(decoded.length-row.frames)>2304) throw Error(row.id+' decode shape '+decoded.length);
          const offline=new OfflineAudioContext(row.channels,decoded.length,decoded.sampleRate);
          const event=offline.createBufferSource(); event.buffer=decoded; event.loop=false;
          event.connect(offline.destination); event.start(0);
          const render=await offline.startRendering();
          let peak=0, energy=0;
          for(let ch=0;ch<render.numberOfChannels;ch++) {
            const samples=render.getChannelData(ch);
            for(const v of samples) {peak=Math.max(peak,Math.abs(v)); energy+=v*v;}
          }
          const peakDb=20*Math.log10(peak);
          if(!Number.isFinite(energy) || peak<=.001 || peak>=1 ||
             (row.levelDb!==undefined && Math.abs(peakDb-row.levelDb)>1)) throw Error(row.id+' rendered levels '+peakDb);
          outputs.push({id:row.id,sha256:digest,rate:decoded.sampleRate,channels:decoded.numberOfChannels,
            decodedFrames:decoded.length,nativeWebReferenceFrames:row.frames,renderedPeakDbfs:peakDb,
            renderedMeanSquare:energy/(render.length*render.numberOfChannels)});
        }
        await ctx.close();
        return outputs;
      },tracks);
      observations.push({engine:driver.name(),version:browser.version(),offlineFileControls:pageResult,
        keyboardPlayedEveryTrack:true,stopAndMuteVerified:mute,
        narrowLayout:{width:390,textScalePercent:200,contained:fits},axeViolationCount:audit.violations.length,webAudio:measured});
      console.log(driver.name(),browser.version(),measured.length,'verified');
    } finally { await browser.close(); }
  }
  await writeFile(new URL('records/browser.json', here),JSON.stringify({
    testedUtc:new Date().toISOString(),environment:'macOS ARM64; local file packet and loopback HTTP; headless; no physical listening',
    packetId:seal.packetId,observations},null,2)+'\n');
} finally {server.close();}
