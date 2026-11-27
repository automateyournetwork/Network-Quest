// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Reproduce on the pinned local stack. Only the decode failure is intercepted.
import { expect, firefox } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { clickButton, closeFrame, openFrame, pressButton } from '../../../tests/e2e/support/adventure-controls.ts';
import { localTls } from '../../../tests/e2e/support/local-tls.ts';

const scratch = '.local/T134/browser';
await mkdir(scratch,{recursive:true});
const local = await localTls();
let browser;
try {
  browser = await firefox.launchPersistentContext(local.profile,{headless:true,ignoreHTTPSErrors:false,hasTouch:true,
    reducedMotion:'no-preference',viewport:{width:1280,height:800}});
  const page = await browser.newPage();
  page.setDefaultTimeout(9500);
  const report = {browser:'Firefox '+browser.browser().version(),localTransport:'localhost HTTPS with disposable Firefox CA and PHP',
    inputHashes:{},responses:{},checks:[],errors:[],consoleErrors:[]};
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const room = JSON.parse(await readFile('content/spec001/rooms/R04.json'));
  const composition = JSON.parse(await readFile('content/spec001/presentation/R04.json'));
  const files = ['content/spec001/rooms/R04.json','content/spec001/presentation/R04.json','src/presentation/sprite-room.ts',
    'src/presentation/sprite-room.css','src/presentation/room-adapter.ts','src/presentation/three-room.ts','src/app/application.ts','src/content/registry.ts'];
  for (const f of files) report.inputHashes[f] = hash(await readFile(f));
  const responseHashes = new Map();
  let corrupt = false;
  page.on('pageerror',e => report.errors.push(e.message));
  page.on('console',m => { if (m.type()==='error' && !m.text().includes('503')) report.consoleErrors.push(m.text().replaceAll(local.origin,'local HTTPS')); });
  page.on('response',response => {
    const path='public/'+new URL(response.url()).pathname.split('/arcade/play/network-quest/')[1];
    if (!corrupt && room.mediaBindings.some(b=>b.exportPath===path) && response.ok()) {
      const digest=response.body().then(hash); void digest.catch(()=>{}); responseHashes.set(path,digest);
    }
  });
  const click = label => clickButton(page,label);
  const use = async label => { await click('Use'); await click(label); };
  const walk = async label => { await click('Walk'); await click('Walk to '+label); await expect(page.locator('.nq-game-location')).toHaveText(label); };
  const measure = async submit => {
    await closeFrame(page); await click('Diagnostics'); await click('Take measurement');
    if (submit) {
      await page.getByRole('dialog',{name:'Diagnostics',exact:true}).locator('ol li').last().getByRole('button',{name:'Submit this reading'}).click();
      await expect(page.getByRole('dialog',{name:'Diagnostics',exact:true})).toContainText('Objective complete.');
    }
    await click('Close diagnostics');
  };
  const sprite=page.locator('.nq-sprite-room');
  const sceneFingerprint=()=>page.locator('.nq-shell-scene .nq-shell-object-actions button').allTextContents();
  const geometry=async name => {
    const bounding=await sprite.locator('.nq-sprite-stage').boundingBox(), host=await page.locator('.nq-game-stage').boundingBox();
    assert.ok(bounding.width<=host.width+.1 && bounding.height<=host.height+.1);
    assert.ok(Math.abs(bounding.width/bounding.height-16/9)<.002);
    let worst=0;
    for (const a of composition.anchors) {
      const b=await sprite.locator('[data-graybox-object="'+a.objectId+'"]').boundingBox();
      worst=Math.max(worst,Math.abs(b.x+b.width/2-(bounding.x+bounding.width*a.point[0]/1024)),Math.abs(b.y+b.height/2-(bounding.y+bounding.height*a.point[1]/576)));
    }
    assert.ok(worst<1, String(worst));
    report[name]={stage:bounding,host,maxAnchorCssPixelError:worst,anchorCount:composition.anchors.length};
  };
  try {
    await page.goto(local.url);
    await click('New Adventure'); await click('Look'); await click('Look at link indication'); await click('Look at power indication');
    await click('Talk'); await click('Talk to Photon the Firefly'); await click('Skip dialogue'); await use('Inspect physical path');
    await walk("The Titan's Workshop"); await click('Talk'); await click('Talk to the Titan'); await click('Skip dialogue');
    await click('Look'); await click('Identify known-good endpoints'); await click('Identify physical path under test');
    await click('Notebook'); await page.getByRole('textbox',{name:'Hypothesis',exact:true}).fill('Compare the retained open result with a repaired conductor.');
    await click('Pin hypothesis'); await click('Close notebook'); await click('Continue as guest');
    await walk('The Copper Warrens'); await use('Read and keep the supplied compatibility card');
    await use('Read and keep the diagnosed-defect card; this is not a performed measurement'); await measure(false);
    await use('Fit the supplied replacement section: 85 m + 10 m'); await measure(true);
    assert.equal(responseHashes.size,0);
    await walk('The Echo Cavern'); await closeFrame(page);
    await expect(sprite).toHaveAttribute('data-rendered','true'); await expect(sprite).toHaveAttribute('data-animated-actors','3');
    assert.equal(await sprite.locator('canvas').evaluate(c=>getComputedStyle(c).imageRendering),'pixelated');
    report.fps=composition.fps; report.decodedImageBytes=Number(await sprite.getAttribute('data-layer-decoded-bytes'));
    for (const b of room.mediaBindings) {
      const observed=await responseHashes.get(b.exportPath);
      assert.equal(observed,hash(await readFile(b.exportPath))); report.responses[b.exportPath]=observed;
    }
    report.checks.push('Seven exact room-local public responses match their source SHA-256. Zero fetched before entering R04.');
    const idle=await sprite.getAttribute('data-frame-c-h01');
    await expect.poll(()=>sprite.getAttribute('data-frame-c-h01')).not.toBe(idle);
    await geometry('desktop'); await page.screenshot({path:scratch+'/desktop.png'});
    await click('Walk'); await openFrame(page,'Scene'); await click('Show hotspots'); await closeFrame(page);
    await sprite.locator('[data-graybox-object="spec001:WALK-R04"]').click();
    await expect(sprite).toHaveAttribute('data-frame-c-h01',/^walk@/); await expect(sprite).toHaveAttribute('data-frame-c-h01',/^idle@/);
    await click('Look'); await sprite.locator('[data-graybox-object="spec001:HOTSPOT-echo-bat"]').tap();
    await expect(sprite.locator('.nq-graybox-choices strong')).toHaveText('Echo Bat');
    await expect(sprite).toHaveAttribute('data-frame-c-h20',/^reaction@/);
    report.checks.push('Room interaction played a complete native walk and returned to idle. Touch selection chose Echo Bat and played its native reaction.');
    await openFrame(page,'Scene'); await click('Show hotspots'); await closeFrame(page);
    // Touch a solid body pixel from the bat's exact registered crop without a DOM marker.
    const bat=composition.subjects.find(s=>s.id==='CH20');
    const tortoise=composition.subjects.find(s=>s.id==='CH13');
    const canvas=await sprite.locator('canvas').boundingBox();
    await page.touchscreen.tap(canvas.x+canvas.width*tortoise.footpoint[0]/1024,canvas.y+canvas.height*(tortoise.footpoint[1]-30)/576);
    await expect(sprite.locator('.nq-graybox-choices strong')).toHaveText('Ancient Tortoise');
    await page.touchscreen.tap(canvas.x+canvas.width*(bat.footpoint[0]+1)/1024,canvas.y+canvas.height*(bat.footpoint[1]-33)/576);
    await expect(sprite.locator('.nq-graybox-choices strong')).toHaveText('Echo Bat');
    report.checks.push('Direct alpha-tested art pick selected the same bat with markers off.');
    const other=await browser.newPage(); await other.goto('about:blank'); await other.bringToFront();
    const natural=await page.evaluate(()=>document.hidden);
    if (!natural) await page.evaluate(()=>{ Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(sprite).toHaveAttribute('data-paused','true');
    const frozen=await sprite.getAttribute('data-render-count'); await page.waitForTimeout(420); assert.equal(await sprite.getAttribute('data-render-count'),frozen);
    await other.close(); await page.bringToFront();
    if (!natural) await page.evaluate(()=>{Reflect.deleteProperty(document,'hidden'); document.dispatchEvent(new Event('visibilitychange'));});
    await expect(sprite).toHaveAttribute('data-paused','false'); await expect.poll(()=>sprite.getAttribute('data-render-count')).not.toBe(frozen);
    report.checks.push('Hidden room suspended and resumed real animation. Visibility source: '+(natural?'native background tab':'explicit visibility event in headless Firefox')+'.');
    await openFrame(page,'Scene'); const reference=await sceneFingerprint(); assert.ok(reference.length>=room.hotspots.length);
    await click('Low detail scene'); await expect(sprite).toHaveAttribute('data-detail','low'); assert.deepEqual(await sceneFingerprint(),reference);
    await click('Text scene'); await expect(sprite).toHaveCount(0); assert.deepEqual(await sceneFingerprint(),reference);
    await click('Retry visual scene'); await expect(sprite).toHaveAttribute('data-rendered','true');
    await openFrame(page,'Sound and reading'); await page.getByRole('combobox',{name:'Reduced motion'}).selectOption('on'); await closeFrame(page);
    await expect(sprite).toHaveAttribute('data-animated-actors','0'); const count=await sprite.getAttribute('data-render-count');
    await page.waitForTimeout(600); assert.equal(await sprite.getAttribute('data-render-count'),count);
    const canvasPng=await sprite.locator('canvas').evaluate(c=>c.toDataURL('image/png'));
    await writeFile(scratch+'/stable-canvas.png',Buffer.from(canvasPng.split(',')[1],'base64'));
    report.checks.push('Low-detail and text preserved the full scene-action list. Reduced motion held one unchanged pose over 600 ms.');
    await page.setViewportSize({width:390,height:844}); await geometry('narrow'); await page.screenshot({path:scratch+'/narrow.png'});
    // Decode error is a real corrupt response. Only this test deliberately changes a served file.
    await openFrame(page,'Scene'); await click('Text scene'); corrupt=true;
    await page.route('**/assets/sprites/R04/CH20.webp',r=>r.fulfill({status:200,contentType:'image/webp',body:'invalid webp'}));
    await click('Retry visual scene'); await expect(page.locator('.nq-shell-presentation-status')).toContainText('unavailable');
    assert.deepEqual(await sceneFingerprint(),reference); await expect(sprite).toHaveCount(0);
    await page.unroute('**/assets/sprites/R04/CH20.webp'); corrupt=false;
    await click('Retry visual scene'); await expect(sprite).toHaveAttribute('data-rendered','true'); await closeFrame(page);
    report.checks.push('Failed sheet decode removed the composition. The same labeled controls remained and retry loaded the actual sheets.');
    await pressButton(page,'Use'); await pressButton(page,'Read and keep the before-record instructions; retain an actual measured open result');
    await use('Read and keep the repeater role and limits'); await use('Conclude: a repeater needs the physical connection restored'); await measure(true);
    report.checks.push('Guest used the ordinary controller and actual before/after measurements to complete O04 after visual retries.');
    // Hold a real request open during a second entry. Leaving the pending room must release it.
    await walk('The Copper Warrens'); await expect(sprite).toHaveCount(0);
    let release;
    const held=new Promise(resolve=>{ release=resolve; });
    await page.route('**/assets/sprites/R04/CH13.webp',async route=>{await held;await route.continue().catch(()=>{});});
    try { await Promise.all([page.waitForRequest('**/assets/sprites/R04/CH13.webp'),walk('The Echo Cavern')]); await walk('The Copper Warrens'); }
    finally {release();}
    await page.unroute('**/assets/sprites/R04/CH13.webp'); await page.waitForTimeout(250);
    await expect(sprite).toHaveCount(0); await expect(page.locator('.nq-game-location')).toHaveText('The Copper Warrens');
    report.checks.push('Leaving R04 during a held Tortoise sheet response kept the live R03 scene and discarded the stale sprite preparation.');
    assert.deepEqual(report.errors,[]);
    await writeFile(scratch+'/browser.json',JSON.stringify(report,null,2)+'\n');
  } catch(error) {
    await writeFile(scratch+'/failure.json',JSON.stringify({...report,error:String(error),status:await page.locator('.nq-shell-presentation-status').allTextContents(),buttons:await page.getByRole('button').allTextContents()},null,2)+'\n');
    await page.screenshot({path:scratch+'/failure.png'}); throw error;
  }
} finally {try {await browser?.close();} finally {await local.stop();}}
