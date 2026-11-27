// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium,firefox} from '@playwright/test';

const here=new URL('./',import.meta.url),engines=[];
for(const engine of [chromium,firefox]) {
  const browser=await engine.launch();
  try {
    const page=await browser.newPage();
    await page.goto(new URL('review.html',here).href);
    await page.waitForFunction(()=>document.querySelectorAll('audio').length===27 &&
      [...document.querySelectorAll('audio')].every(a=>a.readyState>=1 || a.error));
    const readings=await page.evaluate(async()=>{
      const players=[...document.querySelectorAll('audio')], rows=[];
      for(const p of players) {
        p.muted=true;
        const label=p.labels?.[0]?.textContent || document.querySelector('label[for="'+p.id+'"]')?.textContent;
        await p.play();
        await new Promise(ok=>setTimeout(ok,80));
        rows.push({id:p.id,label,duration:p.duration,controls:p.controls,started:!p.paused,
          otherPlayersPaused:players.every(q=>q===p || q.paused),error:p.error?.code??null,autoplay:p.autoplay,loop:p.loop});
      }
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      return {rows,pausedAfterPageHide:players.every(p=>p.paused)};
    });
    assert(readings.rows.every(r=>r.duration>0 && r.label && r.controls && r.started && r.otherPlayersPaused && !r.error && !r.autoplay && !r.loop));
    assert(readings.pausedAfterPageHide);
    for(let i=0;i<12;i++) assert(Math.abs(readings.rows[2*i+1].duration-12.3)<.01);
    engines.push({name:engine.name(),version:browser.version(),...readings});
    console.log(engine.name(),'27 labeled native playback controls passed');
  } finally {await browser.close();}
}
await writeFile(new URL('records/packet-browser.json',here),JSON.stringify({at:new Date().toISOString(),
  scope:'Exact file URLs. Muted playback, exclusive player, duration and explicit pagehide dispatch. No listening findings.',engines},null,2)+'\n');
