// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Targeted actual guest regression for the final attempt-label display correction.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { firefox, expect } from '@playwright/test';
import { clickButton, closeFrame, openFrame } from '../../../../tests/e2e/support/adventure-controls.ts';
const directory='docs/evidence/spec001/compendium/';
const report={task:'T095',scope:'targeted actual guest R01 measurement, real Walk to R02, final readable provenance at390px/200%; no injected state',observedAt:new Date().toISOString(),sources:{},errors:[]};
for(const path of ['src/ui/notebook.ts','src/ui/compendium.ts','src/ui/compendium.css','src/app/application.ts','src/app/adventure.ts','src/state/reducer.ts',directory+'provenance-application.browser.mjs'])report.sources[path]=createHash('sha256').update(await readFile(path)).digest('hex');
const server=await createServer({server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error'});let browser;
try{
 await server.listen();browser=await firefox.launch({headless:true});report.browser=browser.version();
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(12000);page.on('pageerror',error=>report.errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/arcade/play/network-quest/`);
 await clickButton(page,'New Adventure');await clickButton(page,'Look');await clickButton(page,'Look at power indication');await clickButton(page,'Look at link indication');
 await clickButton(page,'Talk');await clickButton(page,'Talk to Photon the Firefly');await clickButton(page,'Skip dialogue');await clickButton(page,'Use');await clickButton(page,'Inspect physical path');
 await clickButton(page,'Walk');await clickButton(page,"Walk to The Titan's Workshop");await expect(page.locator('.nq-game-location')).toHaveText("The Titan's Workshop");
 await closeFrame(page);await openFrame(page,'Sound and reading');await page.getByRole('slider',{name:'Text size',exact:true}).focus();await page.keyboard.press('End');await closeFrame(page);
 await page.setViewportSize({width:390,height:900});await clickButton(page,'Compendium');const panel=page.getByRole('dialog',{name:'Compendium',exact:true});
 const entry=panel.locator('ul[aria-label="Evidence across rooms"] > li').filter({has:page.getByRole('heading',{name:'Physical inspection',exact:true})});
 const text=await entry.innerText();assert.match(text,/105 m/);assert.match(text,/Freshness: stale/);assert.match(text,/this attempt/);assert.doesNotMatch(text,/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
 assert.equal(await panel.evaluate(node=>getComputedStyle(node).fontSize),'32px');
 await entry.locator('p').filter({hasText:'this attempt'}).evaluate(node=>{
   const text=node.firstChild,range=document.createRange();range.setStart(text,text.textContent.indexOf('Configuration'));range.setEnd(text,text.textContent.length);
   const dialog=node.closest('[role=dialog]'),rect=range.getBoundingClientRect();dialog.scrollTop+=rect.top-(dialog.getBoundingClientRect().top+120);
 });
 await page.screenshot({path:directory+'application-390-200-provenance-final.png'});
 await entry.getByRole('button',{name:'Open notebook source: Physical inspection',exact:true}).press('Enter');
 const notebook=page.getByRole('dialog',{name:'Notebook',exact:true});await expect(notebook.getByRole('heading',{name:'Physical inspection',exact:true})).toBeFocused();
 await expect(notebook).toContainText('this attempt');await expect(notebook).toContainText('Freshness: stale');await expect(page.locator('.nq-game-location')).toHaveText("The Titan's Workshop");
 await page.screenshot({path:directory+'application-notebook-390-provenance-final.png'});
 assert.deepEqual(report.errors,[]);const changed=[];for(const[path,hash]of Object.entries(report.sources))if(createHash('sha256').update(await readFile(path)).digest('hex')!==hash)changed.push(path);
 assert.deepEqual(changed,[]);report.changedSources=changed;report.status='PASS';report.evidenceText=text;
}catch(error){report.status='FAIL';report.error=String(error)}finally{await browser?.close();await server.close();await writeFile(directory+'provenance-application-final.json',JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify({status:report.status,error:report.error}));if(report.status!=='PASS')process.exitCode=1;
