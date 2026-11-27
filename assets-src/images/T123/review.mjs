// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Play the guest build exclusively through production controls and verify image bytes at their point of use.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, firefox } from '@playwright/test';
import { build, preview } from 'vite';
import { clickButton, closeFrame, openFrame } from '../../../tests/e2e/support/adventure-controls.ts';

const output = process.argv[2];
const fallbackOnly = process.argv[3] === '--fallback-only';
if (!output) throw Error('Supply a new evidence directory for this run.');
await mkdir(output, { recursive: true });
assert.equal((await readdir(output)).length, 0, 'Preserve earlier evidence in its own directory.');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path));
const images = (await json('docs/evidence/spec001/image-production/T123/exports.json')).images;
const base = '/arcade/play/network-quest/';
const root = process.cwd(), outDir = resolve('.local/t123-reviewed-build');
const config = {root, configFile:resolve('vite.config.ts'),logLevel:'error',build:{outDir,emptyOutDir:true}};
await build(config);
const server = await preview({...config,preview:{host:'127.0.0.1',port:0,strictPort:true}});
const url = 'http://127.0.0.1:' + server.httpServer.address().port + base;
const browser = await firefox.launch({headless:true});
const report = {started:new Date().toISOString(),browser:'Firefox ' + browser.version(),mode:'Production guest build, ephemeral local HTTP, nested deployment base.',
  size:[1280,900],base,inputs:{},bundles:{},observations:[],negativeChecks:[],errors:[],requests:[]};
for (const path of ['src/app/application.ts','src/ui/signal-comparison-figure.ts','src/ui/signal-comparison-figure.css',
  'src/ui/illustration.ts','src/content/illustrations.ts','src/ui/notebook.ts','src/ui/inventory.ts','src/ui/diagnostics.ts','src/ui/optional-activities.ts','src/ui/repair-plan.ts',
  'assets-src/images/T123/review.mjs',...['07','08','09','10','11','12'].map(id=>'content/spec001/rooms/R'+id+'.json')]) {
  report.inputs[path] = hash(await readFile(path));
}
for (const file of (await readdir(outDir+'/assets')).filter(file=>/\.(js|css)$/.test(file))) {
  report.bundles[file] = hash(await readFile(outDir+'/assets/'+file));
}
async function journey(failure) {
  const context = await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.includes('/illustrations/')) report.requests.push({journey: failure ? 'fallback' : 'standard',path});
  });
  if (failure) await page.route('**/assets/illustrations/13.webp', route=>route.fulfill({status:200,contentType:'image/webp',body:'invalid webp for native decode-failure regression'}));
  const panel = name=>page.getByRole('dialog',{name,exact:true});
  const click = async (...names) => {
    for (const name of names) {
      if (['Diagnostics','Repair plan','Validate repair','Open Weather Diary','Open Energy audit'].includes(name)) await closeFrame(page);
      await clickButton(page,name);
    }
  };
  const walk = async (name,label='Walk to '+name) => {
    await click('Walk',label); await expect(page.locator('.nq-game-location')).toHaveText(name);
  };
  const measure = async (submit=true, reading) => {
    await click('Diagnostics','Take measurement');
    const current=panel('Diagnostics').locator('ol[aria-label="Recorded measurements"] > li').last();
    if (reading) await expect(current).toContainText(reading);
    if (submit) {
      await current.getByRole('button',{name:'Submit this reading',exact:true}).click();
      await expect(panel('Diagnostics')).toContainText('Objective complete.');
    }
    await click('Close diagnostics');
  };
  const selector = id=>`details[data-illustration="spec001:ASSET-ILLUSTRATION-${id}"]`;
  const absent = async (host,id,why) => {
    await expect(host.locator(selector(id))).toHaveCount(0);
    report.negativeChecks.push({id,why});
  };
  const see = async (host, id, use) => {
    const row=images.find(row=>row.id===id);
    const room=await json('content/spec001/rooms/'+row.room+'.json');
    const binding=room.illustrationBindings.find(b=>b.assetId.endsWith('-'+id));
    const details=host.locator(selector(id));
    await expect(details).toHaveCount(1);
    await expect(details.locator('img')).toHaveCount(0);
    const trigger=details.locator('summary'); await trigger.scrollIntoViewIfNeeded(); await trigger.press('Enter');
    if (failure) {
      await expect(details).toContainText(/unavailable/i);
      await expect(details.locator('img')).toHaveCount(0);
      await expect(details).toContainText(binding.caption);
      await expect(details).toContainText(binding.alt);
      const capture=output+'/13-decode-failure.png';
      await page.screenshot({path:capture});
      report.fallback={id,failedResponse:'200 image/webp with invalid WebP bytes',visibleText:await details.innerText(),capture,sha256:hash(await readFile(capture))};
      return;
    }
    const image=details.locator('img'); await expect(image).toBeVisible(); await image.scrollIntoViewIfNeeded();
    const observed=await image.evaluate(async element=>{
      await element.decode();
      const bounds=element.getBoundingClientRect();
      return {path:new URL(element.currentSrc).pathname,alt:element.alt,width:element.naturalWidth,height:element.naturalHeight,
        drawnWidth:Math.round(bounds.width),drawnHeight:Math.round(bounds.height)};
    });
    const caption=await details.locator('figcaption').innerText();
    assert.ok(caption.includes(binding.caption)); assert.equal(observed.alt,binding.alt);
    assert.equal(observed.path,base+binding.exportPath.replace(/^public\//,''));
    assert.deepEqual([observed.width,observed.height], row.export.dimensions);
    assert.ok(observed.drawnWidth>=80 && observed.drawnHeight>=40);
    const response=await context.request.get(url+row.export.path.replace(/^public\//,''));
    assert.equal(response.status(),200); assert.equal(hash(await response.body()),row.export.sha256);
    const capture=output+'/'+id+'-'+use+'.png'; await page.screenshot({path:capture});
    report.observations.push({id,use,room:await page.locator('.nq-game-location').innerText(),contentId:binding.contentId,
      keyboardOpened:true,caption,...observed,webpSha256:row.export.sha256,capture,captureSha256:hash(await readFile(capture))});
    if (id==='14') {
      const chart=details.getByRole('group',{name:/Worked example of received signal/});
      for(const label of ['Signal −65 dBm','Noise −90 dBm','Difference 25 dB']) await expect(chart).toContainText(label);
      await chart.scrollIntoViewIfNeeded();
      const chartCapture = output+'/14-labeled-difference.png';
      await page.screenshot({path:chartCapture});
      const widths = await chart.locator('i').evaluateAll(marks=>marks.map(mark=>mark.getBoundingClientRect().width));
      assert.ok(Math.abs(widths[0]-widths[1]-widths[2])<1);
      report.signalExample={text:await chart.innerText(),widths,capture:chartCapture,sha256:hash(await readFile(chartCapture))};
    }
    await trigger.press('Enter');
    console.log('Observed '+id+' '+use);
  };
  const inventory=async id=>{
    await click('Inventory'); const host=panel('Inventory');
    const select=host.getByRole('button',{name:'Select Reusable inspection kit',exact:true});
    if (await select.count()) {await absent(host,id,'unselected reusable kit');await select.press('Enter');}
    await see(host,id,'inventory'); await click('Deselect Reusable inspection kit','Close Inventory');
  };
  const inspect=async(id,panelName,use)=>{await click(panelName);await see(panel(panelName),id,use);await click(panelName==='Notebook'?'Close notebook':'Close diagnostics');};
  const absentJournal=async id=>{await click('Notebook');await absent(panel('Notebook'),id,'fact not yet recorded');await click('Close notebook');};
  try {
    await page.goto(url);
    await click('New Adventure','Look','Look at power indication','Look at link indication','Talk','Talk to Photon the Firefly','Skip dialogue','Use','Inspect physical path');
    await walk("The Titan's Workshop"); await click('Talk','Talk to the Titan','Skip dialogue','Look','Identify known-good endpoints','Identify physical path under test','Notebook');
    await page.getByRole('textbox',{name:'Hypothesis',exact:true}).fill('Compare this path with fresh readings after changing its configuration.');
    await click('Pin hypothesis','Close notebook','Continue as guest');
    if(!failure){await openFrame(page,'Evidence');await absent(panel('Evidence and captions'),'18','Workshop before Energy Audit');await closeFrame(page);}
    await walk('The Skywell');
    await inventory('13');
    if (failure) return;
    await inspect('14','Diagnostics','diagnostic');
    await click('Use','Keep the path survey in the notebook','Keep the endpoint settings card','Select the alternate surveyed path','Match both endpoint band, channel and PHY settings');await measure();
    await walk('The Storm Observatory'); await inventory('15');await absentJournal('16');
    await click('Use','Keep the survey and freshness instructions','Isolate the local emitter and return to surveyed conditions');await measure(true,'25 dB');
    await click('Use','Reconnect the local emitter for the raised-noise scenario');await measure(false,'13 dB');
    await click('Open Weather Diary','Compare my actual observations');
    const opt=panel('Optional activity');
    const earlier=opt.getByRole('combobox',{name:'Earlier actual radio reading',exact:true});
    const earlierIndex=(await earlier.locator('option').allTextContents()).findIndex(s=>s.includes(': 25 dB'));
    assert.ok(earlierIndex>0); await earlier.selectOption({index:earlierIndex});
    await opt.getByRole('combobox',{name:'Later current radio reading',exact:true}).selectOption({index:1});
    await opt.getByRole('combobox',{name:'How did the SNR change?',exact:true}).selectOption('decreased');
    await opt.getByRole('combobox',{name:'Does the later reading meet the supplied threshold?',exact:true}).selectOption('below-threshold');
    await opt.getByRole('radio',{name:'Use the current reading; cause and throughput remain unproven',exact:true}).check();
    await click('Check the comparison');await expect(opt).toContainText('diary has repaired nothing');
    await click('Close the diary');await inspect('16','Notebook','journal');
    await walk('The Skywell');await walk("The Titan's Workshop");await walk('The Shell Market');await inspect('17','Diagnostics','diagnostic');await absentJournal('18');
    await click('Open Energy audit','Practice with two demand cards','Close the ledger');await absentJournal('18');
    await click('Open Energy audit','Audit the three-card ledger');await opt.getByRole('combobox').selectOption('over-budget');await opt.getByRole('spinbutton').fill('3');
    await click('Check the audit');await expect(opt).toContainText('proposal remains over budget');
    await see(opt,'18','earned-activity');
    await click('Close the ledger');await inspect('18','Notebook','journal');
    await click('Use','Read and record all separate equipment checks','Select 100/full','Choose complete kit B: 12 W + 11 W + 7 W');await measure();
    await walk("The Titan's Workshop");await openFrame(page,'Evidence');await see(panel('Evidence and captions'),'18','earned-decoration');await closeFrame(page);
    await walk('The Clockworks');await inspect('19','Diagnostics','diagnostic');await absentJournal('20');
    await click('Use','Read both advertised lists and their shared 100/full option; selecting it cannot prove an application service.');
    await inspect('20','Notebook','journal');
    await click('Use','Read and record the physical-role and upper-layer explanation','Use untimed step-by-step decoding','Explain: sample physical signals representing bits; this does not discover addresses');
    for(const [index,pair] of ['00','10','11','01'].entries())await click('Inspect sample position '+index,'Write '+pair+' for sample position '+index);
    await measure();await walk('The Backhoe Rift','Walk toward The Backhoe Rift');await inventory('21');await absentJournal('22');
    await click('Repair plan','Radio path B — 20 dB SNR','Permanent installation','Read and keep plan requirements','Close repair controls');await inspect('22','Notebook','journal');
    await click('Repair plan','Review current plan');await page.getByRole('checkbox',{name:'I understand that execution changes the route and makes earlier readings stale',exact:true}).check();
    await click('Execute reviewed plan','Close repair controls');await walk('The Iron Threshold','Walk to the validation balcony');await inspect('23','Diagnostics','diagnostic');
    await absentJournal('24');await click('Validate repair','Read classification criteria','Measure repaired link','Run endpoint test','Close repair controls');await inspect('24','Notebook','journal');
  } catch (e) {
    report.failedAt={message:e.message,room:await page.locator('.nq-game-location').textContent().catch(()=>null)};
    await page.screenshot({path:output+'/failure.png'}).catch(()=>{});
    throw e;
  } finally { await context.close(); }
}
try {
  if (!fallbackOnly) {
    await journey(false);
    assert.equal(new Set(report.observations.map(row=>row.id)).size,12);
  }
  await journey(true);
  assert.ok(report.fallback);assert.deepEqual(report.errors,[]);
  report.status='PASS';
} finally {
  await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));
  report.finished=new Date().toISOString();
  await writeFile(output+'/browser.json',JSON.stringify(report,null,2)+'\n');
}
