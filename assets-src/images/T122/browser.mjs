// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// The built guest application and its ordinary controls earn every evidence entry.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { firefox, expect } from '@playwright/test';
import { build, preview } from 'vite';
import { clickButton, closeFrame } from '../../../tests/e2e/support/adventure-controls.ts';

const base = '/arcade/play/network-quest/';
const verificationOnly = process.argv.includes('--verify-joined');
const evidence = 'docs/evidence/spec001/image-production/T122' + (verificationOnly ? '/verified-joined' : process.argv.includes('--with-workshop') ? '/with-workshop' : '');
await mkdir(evidence,{recursive:true});
const hash = data => createHash('sha256').update(data).digest('hex');
const rooms = await Promise.all(Array.from({length:6}, (_, i) => readFile('content/spec001/rooms/R0'+(i+1)+'.json','utf8').then(JSON.parse)));
const bindings = rooms.flatMap(room => room.illustrationBindings);
const inputs = [...rooms.map(r=>'content/spec001/rooms/'+r.id.slice(-3)+'.json'), 'src/app/application.ts', 'src/app/application.css', 'src/presentation/introduction-graybox.ts', 'src/content/registry.ts', 'src/content/illustrations.ts', 'src/ui/app-shell.ts','src/ui/illustration.ts','src/ui/notebook.ts','src/ui/diagnostics.ts','src/ui/optional-activities.ts','src/ui/inventory.ts','src/ui/packet-journey.ts','assets-src/images/T122/browser.mjs'];
const outDir = await mkdtemp(resolve('.local/test-results/T122-'));
await build({logLevel:'silent',build:{outDir}});
const server = await preview({configFile:false,base,build:{outDir},logLevel:'error',preview:{host:'127.0.0.1',port:0,strictPort:true}});
const origin = 'http://127.0.0.1:'+server.httpServer.address().port;
const browser = await firefox.launch();
const report = {browser:'Firefox '+browser.version(),startedUtc:new Date().toISOString(),scope:'Built guest application. No injected state, credentials or server fixture. Only the separate unavailable-image case intercepts a request.', inputs:Object.fromEntries(await Promise.all(inputs.map(async f=>[f,hash(await readFile(f))]))),observed:[],errors:[],requests:[],checks:[]};
let page;
async function show(number,dialog,place, failure=false) {
  const n = String(number).padStart(2,'0'), b=bindings.find(b=>b.assetId.endsWith('-'+n));
  const panel=page.getByRole('dialog',{name:dialog,exact:true}), detail=panel.locator('details[data-illustration="'+b.assetId+'"]').last();
  await detail.locator('summary').press('Enter');
  const image=detail.locator('img');
  await expect(detail.locator('figcaption')).toHaveText(b.caption);
  if (failure) {
    await expect(detail).toContainText('unavailable');
    await expect(detail).toContainText(b.alt);
    await expect(image).toHaveCount(0);
  } else {
    await expect(image).toBeVisible();
    await image.evaluate(el=>el.decode());
    await expect(image).toHaveAttribute('alt',b.alt);
    const imageData=await image.evaluate(async el=>({width:el.naturalWidth,height:el.naturalHeight,src:new URL(el.currentSrc).pathname,
      sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',await (await fetch(el.currentSrc)).arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('')}));
    assert.equal(imageData.src,base+b.exportPath.slice(7));assert.equal(imageData.sha256,hash(await readFile(b.exportPath)));
    report.observed.push({assetId:b.assetId,contentId:b.contentId,room:await page.locator('.nq-game-location').innerText(),surface:dialog,place,...imageData});
  }
  await detail.locator('figcaption').scrollIntoViewIfNeeded();
  if (!verificationOnly) await page.screenshot({path:evidence+'/'+n+'-'+place+'.png'});
  await detail.locator('summary').press('Enter');
  console.log(n,place);
}
async function start(narrow=false){
  page=await browser.newPage({viewport:narrow?{width:390,height:844}:{width:1280,height:900}, reducedMotion:'reduce'});
  page.setDefaultTimeout(6000);
  page.on('request',req=>{const u=new URL(req.url());if(u.origin===origin&&u.pathname.includes('/illustrations/')) report.requests.push(u.pathname);});
  page.on('pageerror',e=>report.errors.push(e.message));
  if(narrow) await page.route('**/assets/illustrations/02.webp',route=>route.fulfill({status:200,contentType:'image/webp',body:'deliberately invalid raster'}));
  await page.goto(origin+base);await click('New Adventure');
}
const click=async label=>{if(['Diagnostics','Open Serial Post'].includes(label))await closeFrame(page);await clickButton(page,label);};
const use=async label=>{await click('Use');await click(label);};
const walk=async label=>{await click('Walk');await click('Walk to '+label);await expect(page.locator('.nq-game-location')).toHaveText(label);};
const measure=async(shouldSubmit,number)=>{await click('Diagnostics');if(number)await show(number,'Diagnostics','diagnostics');await click('Take measurement');if(shouldSubmit){await page.getByRole('dialog',{name:'Diagnostics',exact:true}).locator('ol li').last().getByRole('button',{name:'Submit this reading'}).click();await expect(page.getByRole('dialog',{name:'Diagnostics',exact:true})).toContainText('Objective complete.');}await click('Close diagnostics');};
const item=async n=>{await click('Inventory');await click('Select Reusable inspection kit');await show(n,'Inventory','inventory');await click('Deselect Reusable inspection kit');await click('Close Inventory');};
const notebook=async n=>{await click('Notebook');await show(n,'Notebook','notebook');await click('Close notebook');};
try {
 await start();
 await click('Look');await click('Look at link indication');await click('Notebook');await expect(page.locator('details[data-illustration$="-01"]')).toHaveCount(0);await click('Close notebook');
 await click('Look');await click('Look at power indication');await notebook(1);
 await click('Look');await click('Look at message capsule');await show(2,'Packet journey','payload');await click('Return to investigation');
 await click('Talk');await click('Talk to Photon the Firefly');await click('Skip dialogue');await use('Inspect physical path');
 await walk("The Titan's Workshop");await item(3);await click('Talk');await click('Talk to the Titan');await click('Skip dialogue');await click('Look');await click('Identify known-good endpoints');await click('Identify physical path under test');
 await click('Notebook');await show(4,'Notebook','notebook');await page.getByRole('textbox',{name:'Hypothesis',exact:true}).fill('Measure the path between the known-good endpoints.');await click('Pin hypothesis');await click('Close notebook');await click('Continue as guest');
 await walk('The Copper Warrens');await item(5);await use('Read and keep the supplied compatibility card');await use('Read and keep the diagnosed-defect card; this is not a performed measurement');await measure(false,6);await use('Fit the supplied replacement section: 85 m + 10 m');await measure(true);
 await walk('The Echo Cavern');await use('Read and keep the before-record instructions; retain an actual measured open result');await use('Read and keep the repeater role and limits');await use('Conclude: a repeater needs the physical connection restored');await measure(true,7);
 await click('Open Serial Post');const opt=page.getByRole('dialog',{name:'Optional activity',exact:true});
 await expect(opt.locator('[data-illustration]')).toHaveCount(0);await click('Copy the full message');await opt.getByRole('textbox',{name:'Full message bits',exact:true}).fill('00011011');await click('Check the copied bits');await expect(opt).toContainText('That copy changes the message');await expect(opt.locator('[data-illustration]')).toHaveCount(0);assert.ok(!report.requests.some(p=>p.endsWith('/08.webp')));
 await click('Leave the post');await click('Open Serial Post');await click('Copy the full message');await opt.getByRole('textbox',{name:'Full message bits',exact:true}).fill('00101101');await click('Check the copied bits');await expect(opt).toContainText('Your journal records the delivery.');await show(8,'Optional activity','earned');await click('Leave the post');await notebook(8);
 await walk('The Copper Warrens');await walk("The Titan's Workshop");await walk('The Photon Gardens');await item(9);await use('Read and keep all five supplied compatibility checks');await use('Select the supplied fully matching optic/fiber pair: all five fields match');await use('Inspect the original connection at the dock before any intervention');await use('Have the dock fit the supplied compatible replacement to the inspected connection');await use('Reinspect the replaced connection to confirm the diagnosed defect was removed');await measure(true,10);
 await walk('The Prism Vault');await use('Read and keep the current compatibility and inspection reminder');await use('Select passive path A: total loss 8 dB');await measure(true,11);await notebook(12);
 await page.close();await start(true);await click('Look');await click('Look at message capsule');await show(2,'Packet journey','decode-failure',true);
 assert.equal(new Set(report.observed.map(x=>x.assetId)).size,12);assert.deepEqual(report.errors,[]);report.checks.push('Both indicator discoveries precede the paired illustration.','Wrong and unearned SQ01 produce no picture request.','Real delivery unlocks the strip in the activity and notebook.','A corrupt image leaves the caption readable at 390 px.');
 await writeFile(evidence+'/browser.json',JSON.stringify(report,null,2)+'\n');
} catch(error) {const dir=await mkdtemp(resolve(evidence,'attempt-'));await writeFile(dir+'/observations.json',JSON.stringify({...report,error:String(error)},null,2)+'\n');if(page&&!page.isClosed())await page.screenshot({path:dir+'/last-screen.png'});throw error;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
