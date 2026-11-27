// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium,firefox} from '@playwright/test';
const root=new URL('./',import.meta.url);
const results=[];
for(const engine of [chromium,firefox]) {
  const browser=await engine.launch();
  try {
    const page=await browser.newPage();
    await page.goto(new URL('review.html',root).href);
    await page.waitForFunction(()=>[...document.querySelectorAll('audio')].length===9 && [...document.querySelectorAll('audio')].every(a=>a.readyState>=1 || a.error));
    const checks=await page.evaluate(async()=>{
      const players=[...document.querySelectorAll('audio')];
      const rows=players.map(a=>({id:a.id,duration:a.duration,error:a.error?.code??null,controls:a.controls,autoplay:a.autoplay,loop:a.loop,label:document.querySelector('label[for="'+a.id+'"]')?.textContent}));
      for(const p of players) p.muted=true;
      const [first,second]=players;
      await first.play();await second.play();
      const exclusive=first.paused&&!second.paused;
      const ending=document.getElementById('epilogue');
      ending.currentTime=ending.duration-.3;
      const done=new Promise(ok=>ending.addEventListener('ended',ok,{once:true}));
      await ending.play();await done;
      return {rows,exclusive,oneShotEnded:ending.ended&&ending.paused,otherPlayerPaused:second.paused};
    });
    assert(checks.rows.every(r=>r.duration>0 && r.error===null && r.controls && !r.autoplay && !r.loop && r.label));
    assert(checks.exclusive && checks.oneShotEnded && checks.otherPlayerPaused);
    results.push({engine:engine.name(),version:browser.version(),...checks});
    console.log(engine.name(),'review controls and one-shot completion passed');
  } finally {await browser.close();}
}
await writeFile(new URL('records/packet-browser.json',root),JSON.stringify({testedAt:new Date().toISOString(),mode:'Local file URL, muted native controls; exact sealed media. Actual speaker/earbud listening remains pending.',results},null,2)+'\n');
