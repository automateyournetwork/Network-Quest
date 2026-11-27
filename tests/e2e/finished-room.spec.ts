// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { clickButton, openFrame, closeFrame } from './support/adventure-controls';
import { test, expect, button, installCookie } from './support/t056-journey';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import composition from '../../content/spec001/presentation/R01.json' with { type: 'json' };
import arrival from '../../content/spec001/rooms/R01.json' with { type: 'json' };

/** Real application + strict local TLS + isolated PHP fixture. No replacement renderer or state hooks. */
test.describe('T066 finished R01', () => {
  test('one contained desktop frame gives the room most of the screen and keeps reading on demand', async ({ journey: j }, info) => {
    const measurements = [];
    for (const viewport of [{width:1280,height:720},{width:1440,height:900}]) {
      await j.page.setViewportSize(viewport); await j.start();
      await expect(j.page.locator('.nq-room')).toHaveAttribute('data-rendered','true');
      await expect(j.page.locator('[aria-modal=true]')).toHaveCount(0);
      const stage = (await j.page.locator('.nq-room-stage').boundingBox())!;
      expect(stage.height / viewport.height).toBeGreaterThan(.75);
      const overflow = await j.page.evaluate(() => ({ x:document.documentElement.scrollWidth-innerWidth, y:document.documentElement.scrollHeight-innerHeight }));
      expect(overflow).toEqual({x:0,y:0});
      for (const name of ['Walk','Look','Talk','Use','Inventory','Notebook','Compendium','Scene','Evidence','Game']) {
        const bounds=(await button(j.page,name).boundingBox())!;
        expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y+bounds.height).toBeLessThanOrEqual(viewport.height);
      }
      await expect(j.page.locator('.nq-shell-objects')).toBeHidden();
      await expect(j.page.locator('.nq-shell-evidence')).toBeHidden();
      await expect(j.page.locator('.nq-graybox-pin').first()).toHaveCSS('opacity','0');
      measurements.push({viewport,stage,overflow});
      await j.page.screenshot({path:info.outputPath(`t077-entry-${viewport.width}x${viewport.height}.png`),fullPage:true});
      await openFrame(j.page,'Scene');
      await expect(j.page.locator('.nq-shell-description')).toContainText('POWER lit, LINK unlit');
      await expect(j.page.locator('.nq-shell-help')).toContainText('Tab moves between controls');
      await expect(j.page.locator('.nq-shell-objects > li')).toHaveCount(10);
      await clickButton(j.page,'Show hotspots'); await closeFrame(j.page);
      await expect(j.page.locator('.nq-graybox-pin').first()).toHaveCSS('opacity','1');
      await openFrame(j.page,'Scene'); await clickButton(j.page,'Show hotspots'); await closeFrame(j.page);
    }
    await writeFile(info.outputPath('t077-entry-layout.json'),JSON.stringify(measurements,null,2));
    expect(j.writes()).toHaveLength(0);
  });
  test('in-frame windows contain focus, restore their opener, and remain scrollable at 390/768 with 200% text', async ({journey:j},info) => {
    await j.start();
    await button(j.page,'Notebook').focus(); await j.page.keyboard.press('n');
    const notebook = j.page.getByRole('dialog',{name:'Notebook',exact:true});
    await expect(notebook).toHaveAttribute('aria-modal','true');
    const notes = j.page.getByRole('textbox',{name:'Personal notes',exact:true});
    await notes.fill('wl tuin c — these are notes, not shortcuts');
    await notes.press('n'); await expect(notes).toBeFocused();
    await expect(notebook).toBeVisible();
    await j.page.keyboard.press('Escape'); await expect(button(j.page,'Notebook')).toBeFocused();
    for (const key of ['w','l','t','u']) { await j.page.keyboard.press(key); await expect(button(j.page,{w:'Walk',l:'Look',t:'Talk',u:'Use'}[key]!)).toHaveAttribute('aria-pressed','true'); }
    await openFrame(j.page,'Scene');
    const sceneWindow = j.page.getByRole('dialog',{name:'Scene objects and exits',exact:true});
    const close = button(j.page,'Close Scene objects and exits');
    await close.focus(); await close.press('Shift+Tab');
    expect(await sceneWindow.evaluate(el=>el.contains(document.activeElement))).toBe(true);
    await close.press('Escape'); await expect(button(j.page,'Scene')).toBeFocused();
    await button(j.page,'Talk').click(); await button(j.page,'Scene').click();
    await button(j.page,'Talk to Photon the Firefly').click();
    await expect(j.page.getByRole('dialog',{name:'Dialogue',exact:true})).toHaveAttribute('aria-modal','true');
    await j.page.keyboard.press('Escape');
    await expect(sceneWindow).toHaveAttribute('aria-modal','true');
    await expect(button(j.page,'Talk to Photon the Firefly')).toBeFocused();
    await closeFrame(j.page);
    await openFrame(j.page,'Sound and reading'); await j.page.getByRole('slider',{name:'Text size',exact:true}).fill('2');
    await expect(j.page.locator('.nq-media-preferences-status')).toHaveText('Presentation preferences saved to your account.');
    await closeFrame(j.page);
    const results=[];
    for (const width of [390,768]) {
      await j.page.setViewportSize({width,height:900}); await openFrame(j.page,'Scene');
      await sceneWindow.press('l'); await button(j.page,'Power indication').click();
      const feedback = j.page.locator('.nq-shell-status');
      const feedbackBounds=(await feedback.boundingBox())!, headerBounds=(await sceneWindow.locator('.nq-window-bar').boundingBox())!;
      expect(feedbackBounds.y).toBeGreaterThanOrEqual(headerBounds.y+headerBounds.height);
      await j.page.screenshot({path:info.outputPath(`t077-feedback-start-${width}-200percent.png`),fullPage:true});
      const line = () => feedback.evaluate(el=>{const range=document.createRange();const text=el.firstChild!;range.setStart(text,Math.max(0,(text.textContent?.length??0)-12));range.setEnd(text,text.textContent?.length??0);return range.getBoundingClientRect().toJSON();});
      const tail=await line(); if (tail.bottom>850) { await sceneWindow.hover(); await j.page.mouse.wheel(0,tail.bottom-820); }
      await expect.poll(async()=>{const last=await line(),header=(await sceneWindow.locator('.nq-window-bar').boundingBox())!;return last.bottom<880 && last.top>=header.y+header.height;}).toBe(true);
      await expect(close).toBeInViewport();
      await j.page.screenshot({path:info.outputPath(`t077-feedback-end-${width}-200percent.png`),fullPage:true});
      const frame=(await j.page.locator('.nq-game').boundingBox())!, panel=(await sceneWindow.boundingBox())!;
      expect(panel.x).toBeGreaterThanOrEqual(frame.x); expect(panel.y).toBeGreaterThanOrEqual(frame.y);
      expect(panel.x+panel.width).toBeLessThanOrEqual(frame.x+frame.width); expect(panel.y+panel.height).toBeLessThanOrEqual(frame.y+frame.height);
      expect(await j.page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight && document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await j.page.locator('.nq-shell-objects > li').last().locator('button').last().scrollIntoViewIfNeeded();
      await expect(close).toBeInViewport();
      const axe=await new AxeBuilder({page:j.page}).analyze(); expect(axe.violations).toEqual([]);
      results.push({width,frame,panel,axeViolations:axe.violations});
      await j.page.screenshot({path:info.outputPath(`t077-scene-${width}-200percent.png`),fullPage:true});
      await closeFrame(j.page);
      await j.page.screenshot({path:info.outputPath(`t077-room-${width}-200percent.png`),fullPage:true});
      await expect(j.page.locator('.nq-shell-status')).toHaveAttribute('tabindex','0');
      await expect(j.page.locator('.nq-media-caption')).toHaveAttribute('tabindex','0');
      const stageAxe=await new AxeBuilder({page:j.page}).analyze(); expect(stageAxe.violations).toEqual([]);
    }
    await writeFile(info.outputPath('t077-access.json'),JSON.stringify(results,null,2));
    expect(j.writes()).toHaveLength(0);
  });
  test('confirmed New and Restore dismiss Game, return usable focus, and preserve explicit save decisions', async ({journey:j}) => {
    await j.start(); await j.notes('Saved room notes'); await j.firstSave();
    await closeFrame(j.page); await j.notes('Unsaved room notes');
    await button(j.page,'Game').click(); await button(j.page,'New Adventure').click(); await button(j.page,'Cancel').click();
    await expect(j.page.getByRole('dialog',{name:'Game menu',exact:true})).toBeVisible();
    await button(j.page,'New Adventure').click(); await button(j.page,'Start new adventure').click();
    await expect(j.page.locator('[aria-modal=true]')).toHaveCount(0);
    expect(await j.page.locator('.nq-adventure-host').evaluate(el=>!el.closest('[inert]') && el.contains(document.activeElement))).toBe(true);
    await j.page.keyboard.press('l'); await expect(button(j.page,'Look')).toHaveAttribute('aria-pressed','true');
    await button(j.page,'Game').click(); await button(j.page,'Restore Save').click(); await button(j.page,'Discard current progress and load').click();
    await expect(j.page.locator('[aria-modal=true]')).toHaveCount(0);
    expect(await j.page.locator('.nq-adventure-host').evaluate(el=>!el.closest('[inert]') && el.contains(document.activeElement))).toBe(true);
    await j.expectNotes('Saved room notes'); expect(j.writes()).toHaveLength(1);
  });
  test('loads exact source exports, preserves same-room residency and pauses/reclaims real animation', async ({ journey: j }, info) => {
    await j.page.setViewportSize({ width:1440,height:900 }); await j.page.emulateMedia({ reducedMotion:'no-preference' });
    const responses: { path:string; bytes:number; sha256:string }[] = [], pending: Promise<void>[] = [];
    j.page.on('response', response => { const path = new URL(response.url()).pathname; if (/\/assets\/(models|images)\//.test(path)) pending.push((async () => { const body = await response.body(); responses.push({ path,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex') }); })()); });
    await j.start(); const scene = j.page.locator('.nq-room'); await expect(scene).toHaveAttribute('data-rendered','true');
    await expect(scene).toHaveAttribute('data-model-count','13'); await expect(scene).toHaveAttribute('data-animated-actors','2');
    await expect.poll(async () => Number(await scene.getAttribute('data-render-count'))).toBeGreaterThan(60);
    const firstPose = await scene.locator('.nq-room-stage').screenshot(); await j.page.waitForTimeout(200);
    expect((await scene.locator('.nq-room-stage').screenshot()).equals(firstPose)).toBe(false);
    const canvas = await scene.locator('canvas').elementHandle(), baseline = await scene.evaluate(el => ({... (el as HTMLElement).dataset}));
    await Promise.all(pending); expect(responses).toHaveLength(16);
    for (const binding of arrival.mediaBindings.filter(b => /\.(glb|png)$/.test(b.exportPath))) {
      const observed = responses.find(r => r.path.endsWith(binding.exportPath.slice(7)))!; expect(observed).toBeTruthy();
      expect(observed.sha256).toBe(createHash('sha256').update(await readFile(binding.exportPath)).digest('hex'));
    }
    for (const verb of ['Look','Talk','Use','Walk','Look']) await clickButton(j.page, verb);
    expect(await canvas!.evaluate(el => el === document.querySelector('.nq-room canvas'))).toBe(true);
    expect(responses).toHaveLength(16); expect(await scene.getAttribute('data-geometries')).toBe(baseline['geometries']);
    await clickButton(j.page, 'Power indication'); const evidence = await j.page.locator('.nq-shell-evidence').innerText();
    await j.page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(scene).toHaveAttribute('data-paused','true'); const paused = await scene.getAttribute('data-render-count'); await j.page.waitForTimeout(100); expect(await scene.getAttribute('data-render-count')).toBe(paused);
    await j.page.evaluate(() => { Reflect.deleteProperty(document,'hidden');document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(async () => Number(await scene.getAttribute('data-render-count'))).toBeGreaterThan(Number(paused));
    expect(await j.page.locator('.nq-shell-evidence').innerText()).toBe(evidence);
    await scene.screenshot({path:info.outputPath('t066-composed-room-1440.png')});
    await j.page.screenshot({path:info.outputPath('t066-page-1440.png'),fullPage:true});
    await writeFile(info.outputPath('t066-runtime-budget.json'),JSON.stringify({ browser:j.context.browser()?.version(),userAgent:await j.page.evaluate(()=>navigator.userAgent),viewport:j.page.viewportSize(),network:'Unthrottled local strict TLS; not 20 Mb/s/50 ms acceptance',baseline,final:await scene.evaluate(el=>({... (el as HTMLElement).dataset})),transfer:responses,bytes:responses.reduce((n,r)=>n+r.bytes,0),visibility:'Synthetic document.hidden event verifies application wiring; not native background-tab visibility acceptance'},null,2));
    await clickButton(j.page, 'Text scene'); await expect(scene).toHaveCount(0); await clickButton(j.page, 'Link indication'); await expect(j.page.locator('.nq-shell-evidence')).toContainText('Link indication');
    await clickButton(j.page, 'Low detail scene'); await expect(scene).toHaveAttribute('data-rendered','true'); await expect(scene).toHaveAttribute('data-detail','low');
    expect(await scene.getAttribute('data-geometries')).toBe(baseline['geometries']); expect(Number(await scene.getAttribute('data-textures'))).toBeLessThanOrEqual(3);
    await clickButton(j.page, 'New Adventure'); await clickButton(j.page, 'Start new adventure'); await expect(scene).toHaveAttribute('data-rendered','true');
    expect(await canvas!.evaluate(el=>(el as HTMLCanvasElement).getContext('webgl2')!.isContextLost())).toBe(true);
    expect(j.writes()).toHaveLength(0);
  });
  test('reviewed audio has text, replay, skip, explicit trigger and account preferences survive reload without a save', async ({ journey: j }, info) => {
    const audioResponses: { path:string; sha256:string; bytes:number }[] = [], audioLoads: Promise<void>[] = [];
    j.page.on('response', response => { const path = new URL(response.url()).pathname; if (path.endsWith('.mp3')) audioLoads.push((async () => {
      try { const body = await response.body(); audioResponses.push({path,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')}); } catch { /* An explicitly skipped first request may be canceled; a successful replay must still prove the full frozen export below. */ }
    })()); });
    await j.start(); await expect(j.page.locator('.nq-room')).toHaveAttribute('data-rendered','true');
    await openFrame(j.page, 'Sound and reading');
    const audio = (id:string) => j.page.locator(`.nq-media-cue[data-asset-id="spec001:ASSET-${id}"]`);
    for (const cue of composition.audio) await expect(j.page.locator(`.nq-media-cue[data-asset-id="${cue.assetId}"]`)).toContainText(cue.text);
    await clickButton(j.page, 'Replay Narrator'); await expect(audio('VOICE-001')).toHaveAttribute('data-audio-status','playing');
    await clickButton(j.page, 'Skip Narrator'); await expect(audio('VOICE-001')).toHaveAttribute('data-audio-status','stopped'); await expect(audio('VOICE-001')).toContainText('Welcome to the Underworld.');
    await clickButton(j.page, 'Look'); await clickButton(j.page, 'Power indication');
    await clickButton(j.page, 'Talk'); await clickButton(j.page, 'Talk to Photon the Firefly'); await expect(audio('VOICE-035')).toHaveAttribute('data-audio-status','playing');
    await clickButton(j.page, 'Skip dialogue'); await expect(audio('VOICE-035')).toHaveAttribute('data-audio-status','stopped');
    await openFrame(j.page,'Sound and reading');
    const volume = j.page.getByRole('slider',{name:'Voice volume',exact:true}); await volume.fill('0');
    await expect(j.page.locator('.nq-media-preferences-status')).toHaveText('Presentation preferences saved to your account.');
    await clickButton(j.page, 'Replay Photon'); await expect(audio('VOICE-035')).toHaveAttribute('data-audio-status','muted');
    await clickButton(j.page, 'Replay Title theme'); await expect(audio('MUSIC-title')).toHaveAttribute('data-audio-status','playing');
    await j.page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange')); });
    await expect(audio('MUSIC-title')).toHaveAttribute('data-audio-status','paused');
    await j.page.evaluate(() => { Reflect.deleteProperty(document,'hidden');document.dispatchEvent(new Event('visibilitychange')); });
    await expect(audio('MUSIC-title')).toHaveAttribute('data-audio-status','paused');
    await Promise.all(audioLoads);
    for (const binding of arrival.mediaBindings.filter(b => composition.audio.some(cue => cue.assetId === b.assetId))) {
      const hash = createHash('sha256').update(await readFile(binding.exportPath)).digest('hex');
      expect(audioResponses.some(r=>r.path.endsWith(binding.exportPath.slice(7)) && r.sha256===hash)).toBe(true);
    }
    await writeFile(info.outputPath('t066-audio-runtime.json'),JSON.stringify({browser:j.context.browser()?.version(),responses:audioResponses,loop:false,scope:'Actual native HTMLAudioElement play, stop, mute, hidden-tab pause and frozen response hashes. Human listening belongs to T065.'},null,2));
    const notes='Audio preferences do not replace progress'; await j.notes(notes); expect(j.writes()).toHaveLength(0);
    await j.page.screenshot({path:info.outputPath('t066-audio-transcripts.png'),fullPage:true});
    await j.page.reload(); await openFrame(j.page, 'Sound and reading'); await expect(j.page.getByRole('slider',{name:'Voice volume',exact:true})).toHaveValue('0');
    expect(j.writes()).toHaveLength(0); expect((await j.local.inspectAccount()).saves).toBe(0);
  });
  test('conflicting account preferences require an explicit read and fresh choice without replacing either adventure', async ({ journey: j }) => {
    await j.start(); await openFrame(j.page, 'Sound and reading');
    const other = await j.context.newPage(); await other.goto(j.local.url); await openFrame(other, 'Sound and reading');
    await j.page.getByRole('slider', {name:'Music volume',exact:true}).fill('0.4');
    await expect(j.page.locator('.nq-media-preferences-status')).toHaveText('Presentation preferences saved to your account.');
    await other.getByRole('slider', {name:'Music volume',exact:true}).fill('0.7');
    await expect(other.locator('.nq-media-preferences-status')).toContainText('changed in another tab');
    await expect(other.getByRole('slider', {name:'Music volume',exact:true})).toBeDisabled();
    const patches = () => j.mutations.filter(m=>m.method==='PATCH' && m.path.endsWith('/preferences'));
    expect(patches().map(p=>p.headers['if-match'])).toEqual(['"prefs-1"','"prefs-1"']);
    await clickButton(other, 'Reload account presentation preferences');
    await expect(other.getByRole('slider', {name:'Music volume',exact:true})).toBeEnabled();
    await expect(other.getByRole('slider', {name:'Music volume',exact:true})).toHaveValue('0.4'); expect(patches()).toHaveLength(2);
    await other.getByRole('slider', {name:'Music volume',exact:true}).fill('0.7');
    await expect(other.locator('.nq-media-preferences-status')).toHaveText('Presentation preferences saved to your account.');
    expect(patches().at(-1)!.headers['if-match']).toBe('"prefs-2"'); expect(j.writes()).toHaveLength(0);
    await other.close();
  });
  test('a later synthetic account with the same preference etag gets its own values after explicit session adoption', async ({ journey: j }) => {
    await j.start(); await openFrame(j.page, 'Sound and reading');
    await j.page.getByRole('slider',{name:'Voice volume',exact:true}).fill('0.2');
    await expect(j.page.locator('.nq-media-preferences-status')).toHaveText('Presentation preferences saved to your account.');
    const google = await j.local.syntheticSession('google'); await installCookie(j.context,google.cookie);
    const other = await j.context.newPage(); await other.goto(j.local.url); await openFrame(other, 'Sound and reading');
    await other.getByRole('slider',{name:'Voice volume',exact:true}).fill('0.8');
    await expect(other.locator('.nq-media-preferences-status')).toHaveText('Presentation preferences saved to your account.');
    await other.close();
    // Both actual accounts are now at prefs-2. Read detects changed CSRF/session;
    // it cannot adopt an account or authorize a write in the old gameplay view.
    await clickButton(j.page, 'Reload account presentation preferences');
    await expect(j.page.locator('.nq-media-preferences-status')).toContainText('account session changed');
    await expect(j.page.getByRole('slider',{name:'Voice volume',exact:true})).toBeDisabled();
    await clickButton(j.page, 'Save'); await clickButton(j.page, 'Check Session');
    await openFrame(j.page,'Game'); await expect(j.page.getByText('Synthetic T056 Google player (google)',{exact:true})).toBeVisible();
    await openFrame(j.page, 'Sound and reading');
    await expect(j.page.getByRole('slider',{name:'Voice volume',exact:true})).toHaveValue('0.8');
    expect(j.mutations.filter(m=>m.method==='PATCH'&&m.path.endsWith('/preferences')).map(m=>m.headers['if-match'])).toEqual(['"prefs-1"','"prefs-1"']);
    expect(j.writes()).toHaveLength(0); expect((await j.local.inspectAccount()).saves).toBe(0);
  });
  test('missing image/model and media decode failures keep actionable text and permit explicit retry', async ({journey:j}) => {
    await j.page.route('**/assets/images/R01/midground.png',route=>route.fulfill({status:503,body:'Unavailable'}));
    await j.start(j.page,{textFallback:true}); await expect(j.page.locator('.nq-shell-presentation-status')).toContainText('unavailable');
    await clickButton(j.page, 'Look'); await clickButton(j.page, 'Power indication'); await expect(j.page.locator('.nq-shell-evidence')).toContainText('Power indication');
    await j.page.unroute('**/assets/images/R01/midground.png'); await clickButton(j.page, 'Retry visual scene'); await expect(j.page.locator('.nq-room')).toHaveAttribute('data-rendered','true');
    await j.page.route('**/assets/audio/auditions/photon-035.mp3',route=>route.fulfill({status:200,contentType:'audio/mpeg',body:'bad audio'}));
    await openFrame(j.page, 'Sound and reading'); await clickButton(j.page, 'Replay Photon');
    await expect(j.page.locator('.nq-media-cue[data-asset-id="spec001:ASSET-VOICE-035"]')).toHaveAttribute('data-audio-status','unavailable');
    await expect(j.page.locator('.nq-media')).toContainText('I am Photon. I carry light'); expect(j.writes()).toHaveLength(0);
  });
});
