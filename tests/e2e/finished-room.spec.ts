// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { test, expect, button, installCookie } from './support/t056-journey';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import composition from '../../content/spec001/presentation/R01.json' with { type: 'json' };
import arrival from '../../content/spec001/rooms/R01.json' with { type: 'json' };

/** Real application + strict local TLS + isolated PHP fixture. No replacement renderer or state hooks. */
test.describe('T066 finished R01', () => {
  test('desktop entry shows primary verbs and most of the composed room before scrolling', async ({ journey: j }, info) => {
    const measurements = [];
    for (const viewport of [{width:1280,height:720},{width:1440,height:900}]) {
      await j.page.setViewportSize(viewport); await j.start();
      await expect(j.page.locator('.nq-room')).toHaveAttribute('data-rendered','true');
      const stage = (await j.page.locator('.nq-room-stage').boundingBox())!;
      const scrollY = await j.page.evaluate(()=>window.scrollY);
      expect(scrollY).toBe(0);
      expect(stage.y).toBeLessThan(viewport.height * 0.45);
      expect(Math.min(viewport.height-stage.y,stage.height)/stage.height).toBeGreaterThan(0.65);
      for (const name of ['Walk','Look','Talk','Use']) {
        const control=(await button(j.page,name).boundingBox())!;
        expect(control.y).toBeGreaterThanOrEqual(0); expect(control.y+control.height).toBeLessThan(viewport.height);
      }
      await expect(j.page.locator('.nq-shell-description')).toContainText('POWER lit, LINK unlit');
      await expect(j.page.locator('.nq-shell-help')).toContainText('Tab moves between controls');
      await expect(j.page.locator('.nq-shell-objects > li')).toHaveCount(10);
      measurements.push({viewport,stage,scrollY});
      await j.page.screenshot({path:info.outputPath(`t066-entry-${viewport.width}x${viewport.height}.png`)});
    }
    await writeFile(info.outputPath('t066-entry-layout.json'),JSON.stringify(measurements,null,2));
    expect(j.writes()).toHaveLength(0);
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
    for (const verb of ['Look','Talk','Use','Walk','Look']) await button(j.page,verb).click();
    expect(await canvas!.evaluate(el => el === document.querySelector('.nq-room canvas'))).toBe(true);
    expect(responses).toHaveLength(16); expect(await scene.getAttribute('data-geometries')).toBe(baseline['geometries']);
    await button(j.page,'Power indication').click(); const evidence = await j.page.locator('.nq-shell-evidence').innerText();
    await j.page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(scene).toHaveAttribute('data-paused','true'); const paused = await scene.getAttribute('data-render-count'); await j.page.waitForTimeout(100); expect(await scene.getAttribute('data-render-count')).toBe(paused);
    await j.page.evaluate(() => { Reflect.deleteProperty(document,'hidden');document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(async () => Number(await scene.getAttribute('data-render-count'))).toBeGreaterThan(Number(paused));
    expect(await j.page.locator('.nq-shell-evidence').innerText()).toBe(evidence);
    await scene.screenshot({path:info.outputPath('t066-composed-room-1440.png')});
    await j.page.screenshot({path:info.outputPath('t066-page-1440.png'),fullPage:true});
    await writeFile(info.outputPath('t066-runtime-budget.json'),JSON.stringify({ browser:j.context.browser()?.version(),userAgent:await j.page.evaluate(()=>navigator.userAgent),viewport:j.page.viewportSize(),network:'Unthrottled local strict TLS; not 20 Mb/s/50 ms acceptance',baseline,final:await scene.evaluate(el=>({... (el as HTMLElement).dataset})),transfer:responses,bytes:responses.reduce((n,r)=>n+r.bytes,0),visibility:'Synthetic document.hidden event verifies application wiring; not native background-tab visibility acceptance'},null,2));
    await button(j.page,'Text scene').click(); await expect(scene).toHaveCount(0); await button(j.page,'Link indication').click(); await expect(j.page.locator('.nq-shell-evidence')).toContainText('Link indication');
    await button(j.page,'Low detail scene').click(); await expect(scene).toHaveAttribute('data-rendered','true'); await expect(scene).toHaveAttribute('data-detail','low');
    expect(await scene.getAttribute('data-geometries')).toBe(baseline['geometries']); expect(Number(await scene.getAttribute('data-textures'))).toBeLessThanOrEqual(3);
    await button(j.page,'New Adventure').click(); await button(j.page,'Start new adventure').click(); await expect(scene).toHaveAttribute('data-rendered','true');
    expect(await canvas!.evaluate(el=>(el as HTMLCanvasElement).getContext('webgl2')!.isContextLost())).toBe(true);
    expect(j.writes()).toHaveLength(0);
  });
  test('reviewed audio has text, replay, skip, explicit trigger and account preferences survive reload without a save', async ({ journey: j }, info) => {
    const audioResponses: { path:string; sha256:string; bytes:number }[] = [], audioLoads: Promise<void>[] = [];
    j.page.on('response', response => { const path = new URL(response.url()).pathname; if (path.endsWith('.mp3')) audioLoads.push((async () => {
      try { const body = await response.body(); audioResponses.push({path,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')}); } catch { /* An explicitly skipped first request may be canceled; a successful replay must still prove the full frozen export below. */ }
    })()); });
    await j.start(); await expect(j.page.locator('.nq-room')).toHaveAttribute('data-rendered','true');
    await j.page.getByText('Sound and reading',{exact:true}).click();
    const audio = (id:string) => j.page.locator(`.nq-media-cue[data-asset-id="spec001:ASSET-${id}"]`);
    for (const cue of composition.audio) await expect(j.page.locator(`.nq-media-cue[data-asset-id="${cue.assetId}"]`)).toContainText(cue.text);
    await button(j.page,'Replay Narrator').click(); await expect(audio('VOICE-001')).toHaveAttribute('data-audio-status','playing');
    await button(j.page,'Skip Narrator').click(); await expect(audio('VOICE-001')).toHaveAttribute('data-audio-status','stopped'); await expect(audio('VOICE-001')).toContainText('Welcome to the Underworld.');
    await button(j.page,'Look').click(); await button(j.page,'Power indication').click();
    await button(j.page,'Talk').click(); await button(j.page,'Talk to Photon the Firefly').click(); await expect(audio('VOICE-035')).toHaveAttribute('data-audio-status','playing');
    await button(j.page,'Skip dialogue').click(); await expect(audio('VOICE-035')).toHaveAttribute('data-audio-status','stopped');
    const volume = j.page.getByRole('slider',{name:'Voice volume',exact:true}); await volume.fill('0');
    await expect(j.page.locator('.nq-media-preferences-status')).toHaveText('Presentation preferences saved to your account.');
    await button(j.page,'Replay Photon').click(); await expect(audio('VOICE-035')).toHaveAttribute('data-audio-status','muted');
    await button(j.page,'Replay Title theme').click(); await expect(audio('MUSIC-title')).toHaveAttribute('data-audio-status','playing');
    await j.page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange')); });
    await expect(audio('MUSIC-title')).toHaveAttribute('data-audio-status','paused');
    await j.page.evaluate(() => { Reflect.deleteProperty(document,'hidden');document.dispatchEvent(new Event('visibilitychange')); });
    await expect(audio('MUSIC-title')).toHaveAttribute('data-audio-status','paused');
    await Promise.all(audioLoads);
    for (const binding of arrival.mediaBindings.filter(b=>b.exportPath.endsWith('.mp3'))) {
      const hash = createHash('sha256').update(await readFile(binding.exportPath)).digest('hex');
      expect(audioResponses.some(r=>r.path.endsWith(binding.exportPath.slice(7)) && r.sha256===hash)).toBe(true);
    }
    await writeFile(info.outputPath('t066-audio-runtime.json'),JSON.stringify({browser:j.context.browser()?.version(),responses:audioResponses,loop:false,scope:'Actual native HTMLAudioElement play, stop, mute, hidden-tab pause and frozen response hashes. Human listening belongs to T065.'},null,2));
    const notes='Audio preferences do not replace progress'; await j.notes(notes); expect(j.writes()).toHaveLength(0);
    await j.page.screenshot({path:info.outputPath('t066-audio-transcripts.png'),fullPage:true});
    await j.page.reload(); await j.page.getByText('Sound and reading',{exact:true}).click(); await expect(j.page.getByRole('slider',{name:'Voice volume',exact:true})).toHaveValue('0');
    expect(j.writes()).toHaveLength(0); expect((await j.local.inspectAccount()).saves).toBe(0);
  });
  test('conflicting account preferences require an explicit read and fresh choice without replacing either adventure', async ({ journey: j }) => {
    await j.start(); await j.page.getByText('Sound and reading', {exact:true}).click();
    const other = await j.context.newPage(); await other.goto(j.local.url); await other.getByText('Sound and reading', {exact:true}).click();
    await j.page.getByRole('slider', {name:'Music volume',exact:true}).fill('0.4');
    await expect(j.page.locator('.nq-media-preferences-status')).toHaveText('Presentation preferences saved to your account.');
    await other.getByRole('slider', {name:'Music volume',exact:true}).fill('0.7');
    await expect(other.locator('.nq-media-preferences-status')).toContainText('changed in another tab');
    await expect(other.getByRole('slider', {name:'Music volume',exact:true})).toBeDisabled();
    const patches = () => j.mutations.filter(m=>m.method==='PATCH' && m.path.endsWith('/preferences'));
    expect(patches().map(p=>p.headers['if-match'])).toEqual(['"prefs-1"','"prefs-1"']);
    await button(other,'Reload account presentation preferences').click();
    await expect(other.getByRole('slider', {name:'Music volume',exact:true})).toBeEnabled();
    await expect(other.getByRole('slider', {name:'Music volume',exact:true})).toHaveValue('0.4'); expect(patches()).toHaveLength(2);
    await other.getByRole('slider', {name:'Music volume',exact:true}).fill('0.7');
    await expect(other.locator('.nq-media-preferences-status')).toHaveText('Presentation preferences saved to your account.');
    expect(patches().at(-1)!.headers['if-match']).toBe('"prefs-2"'); expect(j.writes()).toHaveLength(0);
    await other.close();
  });
  test('a later synthetic account with the same preference etag gets its own values after explicit session adoption', async ({ journey: j }) => {
    await j.start(); await j.page.getByText('Sound and reading',{exact:true}).click();
    await j.page.getByRole('slider',{name:'Voice volume',exact:true}).fill('0.2');
    await expect(j.page.locator('.nq-media-preferences-status')).toHaveText('Presentation preferences saved to your account.');
    const google = await j.local.syntheticSession('google'); await installCookie(j.context,google.cookie);
    const other = await j.context.newPage(); await other.goto(j.local.url); await other.getByText('Sound and reading',{exact:true}).click();
    await other.getByRole('slider',{name:'Voice volume',exact:true}).fill('0.8');
    await expect(other.locator('.nq-media-preferences-status')).toHaveText('Presentation preferences saved to your account.');
    await other.close();
    // Both actual accounts are now at prefs-2. Read detects changed CSRF/session;
    // it cannot adopt an account or authorize a write in the old gameplay view.
    await button(j.page,'Reload account presentation preferences').click();
    await expect(j.page.locator('.nq-media-preferences-status')).toContainText('account session changed');
    await expect(j.page.getByRole('slider',{name:'Voice volume',exact:true})).toBeDisabled();
    await button(j.page,'Save').click(); await button(j.page,'Check Session').click();
    await expect(j.page.getByText('Synthetic T056 Google player (google)',{exact:true})).toBeVisible();
    await j.page.getByText('Sound and reading',{exact:true}).click();
    await expect(j.page.getByRole('slider',{name:'Voice volume',exact:true})).toHaveValue('0.8');
    expect(j.mutations.filter(m=>m.method==='PATCH'&&m.path.endsWith('/preferences')).map(m=>m.headers['if-match'])).toEqual(['"prefs-1"','"prefs-1"']);
    expect(j.writes()).toHaveLength(0); expect((await j.local.inspectAccount()).saves).toBe(0);
  });
  test('missing image/model and media decode failures keep actionable text and permit explicit retry', async ({journey:j}) => {
    await j.page.route('**/assets/images/R01/midground.png',route=>route.fulfill({status:503,body:'Unavailable'}));
    await j.start(); await expect(j.page.locator('.nq-shell-presentation-status')).toContainText('unavailable');
    await button(j.page,'Look').click(); await button(j.page,'Power indication').click(); await expect(j.page.locator('.nq-shell-evidence')).toContainText('Power indication');
    await j.page.unroute('**/assets/images/R01/midground.png'); await button(j.page,'Retry visual scene').click(); await expect(j.page.locator('.nq-room')).toHaveAttribute('data-rendered','true');
    await j.page.route('**/assets/audio/auditions/photon-035.mp3',route=>route.fulfill({status:200,contentType:'audio/mpeg',body:'bad audio'}));
    await j.page.getByText('Sound and reading',{exact:true}).click(); await button(j.page,'Replay Photon').click();
    await expect(j.page.locator('.nq-media-cue[data-asset-id="spec001:ASSET-VOICE-035"]')).toHaveAttribute('data-audio-status','unavailable');
    await expect(j.page.locator('.nq-media')).toContainText('I am Photon. I carry light'); expect(j.writes()).toHaveLength(0);
  });
});
