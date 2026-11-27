// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Earn the power-audit reward from a new guest adventure and inspect its actual Workshop mounting.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, firefox } from '@playwright/test';
import { build, preview } from 'vite';
import { clickButton, closeFrame, openFrame } from '../../../tests/e2e/support/adventure-controls.ts';

const root='docs/evidence/spec001/image-production/T122', base='/arcade/play/network-quest/';
const output=process.argv[2] || root+'/workshop';
await mkdir(output);
const outDir=await mkdtemp(resolve('.local/test-results/T122-workshop-'));
await build({logLevel:'silent',build:{outDir}});
const server=await preview({configFile:false,base,build:{outDir},logLevel:'error',preview:{host:'127.0.0.1',port:0}});
const url='http://127.0.0.1:'+server.httpServer.address().port+base;
const browser=await firefox.launch();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=['src/app/application.ts','src/app/application.css','src/presentation/introduction-graybox.ts','src/content/illustrations.ts','content/spec001/quests/SQ02.json','content/spec001/rooms/R09.json','public/assets/illustrations/18.webp','assets-src/images/T122/workshop.mjs'];
const report={browser:'Firefox '+browser.version(),startedUtc:new Date().toISOString(),inputs:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f))]))),checks:[],layouts:[],requests:[],pageErrors:[]};
const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
page.setDefaultTimeout(7000);
page.on('request',request=>{if(request.url().endsWith('/illustrations/18.webp')) report.requests.push(new URL(request.url()).pathname);});
page.on('pageerror',err=>report.pageErrors.push(err.message));
const mounted=page.locator('img.nq-workshop-decoration[data-illustration="spec001:ASSET-ILLUSTRATION-18"]');
const dialog=name=>page.getByRole('dialog',{name,exact:true});
async function click(...names){for(const n of names){if(['Open Energy audit','Diagnostics'].includes(n)) await closeFrame(page);await clickButton(page,n);}}
async function walk(name){await click('Walk','Walk to '+name);await expect(page.locator('.nq-game-location')).toHaveText(name);}
async function measure(submit){await click('Diagnostics','Take measurement');if(submit){await dialog('Diagnostics').locator('ol li').last().getByRole('button',{name:'Submit this reading'}).click();await expect(dialog('Diagnostics')).toContainText('Objective complete.');}await click('Close diagnostics');}
try {
 await page.goto(url);await click('New Adventure','Look','Look at power indication','Look at link indication','Talk','Talk to Photon the Firefly','Skip dialogue','Use','Inspect physical path');
 await walk("The Titan's Workshop");await expect(mounted).toHaveCount(0);
 await click('Talk','Talk to the Titan','Skip dialogue','Look','Identify known-good endpoints','Identify physical path under test','Notebook');
 await page.getByRole('textbox',{name:'Hypothesis',exact:true}).fill('Check both endpoint records before accepting a suggested route.');
 await click('Pin hypothesis','Close notebook','Continue as guest');
 await walk('The Copper Warrens');await click('Use','Read and keep the supplied compatibility card','Read and keep the diagnosed-defect card; this is not a performed measurement');await measure(false);
 await click('Use','Fit the supplied replacement section: 85 m + 10 m');await measure(true);await walk('The Echo Cavern');
 await click('Use','Read and keep the before-record instructions; retain an actual measured open result','Read and keep the repeater role and limits','Conclude: a repeater needs the physical connection restored');await measure(true);
 await walk('The Copper Warrens');await walk("The Titan's Workshop");await expect(mounted).toHaveCount(0);await walk('The Shell Market');
 await click('Open Energy audit','Audit the three-card ledger');
 const activity=dialog('Optional activity');
 await activity.getByRole('combobox').selectOption('over-budget');await activity.getByRole('spinbutton').fill('3');
 assert.deepEqual(report.requests,[]);report.checks.push('No ledger mounted during both pre-award R02 visits, and no artwork request through SQ02 answer preparation.');
 await click('Check the audit');await expect(activity).toContainText('proposal remains over budget');await click('Close the ledger');
 await click('Use','Read and record all separate equipment checks','Select 100/full','Choose complete kit B: 12 W + 11 W + 7 W');await measure(true);
 await expect(mounted).toHaveCount(0);assert.deepEqual(report.requests,[]);
 await walk("The Titan's Workshop");await closeFrame(page);
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:width===390?844:900});
  await expect(mounted).toBeVisible();await mounted.evaluate(el=>el.decode());
  await expect(page.locator('.nq-graybox[data-room-id="spec001:R02"] canvas')).toBeVisible();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const geometry=await mounted.evaluate(el=>{
    const box=el.getBoundingClientRect(), stage=el.closest('.nq-game-stage');
    const props=[...stage.querySelectorAll('.nq-graybox-pin,.nq-graybox-position,.nq-scene-fallback,.nq-media-caption,.nq-shell-status')].filter(x=>x.getClientRects().length);
    const overlaps=props.filter(x=>{const b=x.getBoundingClientRect();return box.left<b.right && b.left<box.right && box.top<b.bottom && b.top<box.bottom;}).map(x=>x.getAttribute('aria-label')??x.textContent);
    return {image:[el.naturalWidth,el.naturalHeight],x:box.x,y:box.y,width:box.width,height:box.height,viewport:innerWidth,src:new URL(el.currentSrc).pathname,pointerEvents:getComputedStyle(el).pointerEvents,interceptsPointer:document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)===el,overlaps,hotspotsChecked:stage.querySelectorAll('.nq-graybox-pin').length};
  });
  assert.equal(geometry.src,base+'assets/illustrations/18.webp');assert.equal(geometry.pointerEvents,'none');assert.equal(geometry.interceptsPointer,false);assert.ok(geometry.x>0 && geometry.x+geometry.width<width && geometry.hotspotsChecked>0);assert.deepEqual(geometry.overlaps,[]);
  const capture=output+'/R02-'+width+'.png';await page.screenshot({path:capture});report.layouts.push({...geometry,capture,sha256:hash(await readFile(capture))});
 }
 await openFrame(page,'Evidence');const detail=dialog('Evidence and captions').locator('details[data-illustration$="-18"]');await detail.locator('summary').press('Enter');await detail.locator('img').evaluate(el=>el.decode());await expect(detail.locator('figcaption')).toContainText('30 W');report.checks.push('R02 Evidence shares the registered R09 ledger, with its own caption and full-size disclosure.');
 await closeFrame(page);await walk('The Shell Market');await expect(mounted).toHaveCount(0);report.checks.push('Leaving R02 removes the decoration.');assert.deepEqual(report.pageErrors,[]);report.status='PASS';
} catch(err){report.failure=String(err);await page.screenshot({path:output+'/last-screen.png'});throw err;}
finally {report.finishedUtc=new Date().toISOString();await writeFile(output+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
