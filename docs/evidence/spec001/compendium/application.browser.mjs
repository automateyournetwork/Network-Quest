// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Actual public guest application. No injected adventure state or provider/save fixture.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { firefox, expect } from '@playwright/test';
import { clickButton, closeFrame, openFrame } from '../../../../tests/e2e/support/adventure-controls.ts';

const directory='docs/evidence/spec001/compendium/', output=process.argv[2]??directory+'application-initial.json';
const report={task:'T095',scope:'actual guest application, no state injection; CH01 New Adventure discovery is T094 work, no other character discovery/recruitment acceptance',observedAt:new Date().toISOString(),results:[],errors:[],requests:[],sources:{}};
const paths=['src/ui/compendium.ts','src/ui/compendium.css','src/ui/notebook.ts','src/app/application.ts','src/app/adventure.ts','src/state/reducer.ts','src/state/party.ts','src/ui/action-bus.ts','src/ui/verbs.ts','src/ui/adventure-frame.ts','src/app/application.css','content/spec001/characters.json','content/spec001/world.json',directory+'application.browser.mjs'];
for(const path of paths){try{report.sources[path]=createHash('sha256').update(await readFile(path)).digest('hex')}catch{report.sources[path]='ABSENT'}}
const server=await createServer({server:{port:0,host:'127.0.0.1',hmr:false},logLevel:'error'});let browser;
try{
 await server.listen();browser=await firefox.launch({headless:true});report.browser=browser.version();
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(12000);
 page.on('pageerror',error=>report.errors.push(error.message));page.on('request',request=>{const url=new URL(request.url());if(url.pathname.includes('/api/')||request.method()!=='GET')report.requests.push({path:url.pathname,method:request.method()})});
 const url=`http://127.0.0.1:${server.httpServer.address().port}/arcade/play/network-quest/`;
 const compendium=()=>page.getByRole('dialog',{name:'Compendium',exact:true}), notebook=()=>page.getByRole('dialog',{name:'Notebook',exact:true});
 const room=async label=>expect(page.locator('.nq-game-location')).toHaveText(label);
 const evidence=(label)=>compendium().locator('ul[aria-label="Evidence across rooms"] > li').filter({has:page.getByRole('heading',{name:label,exact:true})});
 const checked=(name)=>report.results.push({name,status:'PASS'});
 await page.goto(url);await clickButton(page,'New Adventure');await room('The Arrival Lift');
 await clickButton(page,'Look');await clickButton(page,'Look at power indication');await closeFrame(page);
 await page.getByRole('button',{name:'Compendium',exact:true}).focus();await page.keyboard.press('c');await expect(compendium()).toBeVisible();
 const countBefore=await compendium().locator(':scope > p').filter({hasText:/[0-9]+ discovered/}).innerText();assert.match(countBefore,/discovered.*undiscovered/);
 await expect(evidence('Power indication')).toContainText('Power indication does not prove');await expect(evidence('Power indication')).toContainText('Freshness: observation');
 assert.equal(await compendium().locator('img').count(),0);assert.equal(await compendium().getByText('Photon the Firefly',{exact:true}).count(),0);
 checked('real New Adventure and Look evidence appear through C without revealing or recruiting Photon');
 const oldSource=await compendium().getByRole('button',{name:'Open notebook source: Power indication',exact:true}).elementHandle();
 await compendium().getByRole('button',{name:'Open notebook source: Power indication',exact:true}).press('Enter');await expect(notebook()).toBeVisible();
 await expect(notebook().getByRole('heading',{name:'Power indication',exact:true})).toBeFocused();
 await expect(notebook()).toContainText('Selected source reference.');await expect(notebook().getByRole('list',{name:'Maps',exact:true})).toContainText('The Arrival Lift — visited — Highlighted');await room('The Arrival Lift');
 checked('captured source action opens actual notebook, highlights visited source and focuses the real evidence heading without moving');
 await clickButton(page,'Close notebook');await clickButton(page,'Compendium');assert.equal(await compendium().locator(':scope > p').filter({hasText:/[0-9]+ discovered/}).innerText(),countBefore);await clickButton(page,'Close compendium');
 await oldSource.evaluate(button=>button.click());assert.equal(await notebook().isVisible(),false);checked('opening/viewing leaves discovery unchanged and hidden retained source control is inert');
 await clickButton(page,'Look');await clickButton(page,'Look at link indication');await clickButton(page,'Talk');await clickButton(page,'Talk to Photon the Firefly');await clickButton(page,'Skip dialogue');
 await clickButton(page,'Use');await clickButton(page,'Inspect physical path');await closeFrame(page);await clickButton(page,'Compendium');
 await expect(evidence('Physical inspection')).toContainText('Freshness: current');const original=await evidence('Physical inspection').innerText();assert.match(original,/105 m/);await clickButton(page,'Close compendium');
 await clickButton(page,'Walk');await clickButton(page,"Walk to The Titan's Workshop");await room("The Titan's Workshop");await closeFrame(page);await clickButton(page,'Compendium');
 const stale=await evidence('Physical inspection').innerText();assert.match(stale,/Freshness: stale/);assert.match(stale,/105 m/);assert.match(stale,/Walk:.*Arrival Lift/);assert.match(stale,/Directions do not move you or refresh a reading/);
 await room("The Titan's Workshop");checked('actual Walk makes the R01 reading stale; cross-room evidence retains reading/source and derives the real return exit');
 await compendium().getByRole('button',{name:'Open notebook source: Physical inspection',exact:true}).press('Enter');await expect(notebook()).toBeVisible();
 await expect(notebook().getByRole('heading',{name:'Physical inspection',exact:true})).toBeFocused();await expect(notebook()).toContainText('Freshness: stale');await room("The Titan's Workshop");
 const focusVisible=await notebook().getByRole('heading',{name:'Physical inspection',exact:true}).evaluate(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.x+Math.min(r.width/2,100),r.y+r.height/2);return {top:r.top,bottom:r.bottom,unobscured:node.contains(hit)}});
 assert.ok(focusVisible.unobscured&&focusVisible.top>=0&&focusVisible.bottom<=900);report.focusedNotebook=focusVisible;
 await page.screenshot({path:directory+'application-notebook-reference.png'});checked('cross-room notebook selection keeps the measurement stale and the selected heading unobscured');
 await clickButton(page,'Close notebook');await clickButton(page,'Walk');await clickButton(page,'Walk to The Arrival Lift');await room('The Arrival Lift');checked('following the shown real Walk exit returns to the source room');
 await closeFrame(page);await openFrame(page,'Sound and reading');const text=page.getByRole('slider',{name:'Text size',exact:true});await text.focus();await page.keyboard.press('End');await closeFrame(page);
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});await clickButton(page,'Compendium');await expect(compendium()).toBeVisible();
  const size=await compendium().evaluate(node=>({font:getComputedStyle(node).fontSize,width:node.clientWidth,scroll:node.scrollWidth,x:node.getBoundingClientRect().x,right:node.getBoundingClientRect().right}));assert.equal(size.font,'32px');assert.ok(size.scroll<=size.width+1&&size.x>=0&&size.right<=width);
  await page.screenshot({path:directory+`application-${width}-200-initial.png`});
  await compendium().getByRole('button',{name:'Open notebook source: Physical inspection',exact:true}).focus();
  const visible=await compendium().getByRole('button',{name:'Open notebook source: Physical inspection',exact:true}).evaluate(node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,unobscured:node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}});assert.ok(visible.unobscured&&visible.top>=0&&visible.bottom<=900);
  await page.screenshot({path:directory+`application-${width}-200-source.png`});
  await page.keyboard.press('Escape');assert.equal(await compendium().isVisible(),false);assert.equal(await page.getByRole('button',{name:'Compendium',exact:true}).evaluate(node=>document.activeElement===node),true);
  report.results.push({name:`actual ${width}px/200% guest UI keeps source controls unobscured and Escape returns focus`,status:'PASS',size,visible});
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);
 const changed=[];for(const[path,before]of Object.entries(report.sources)){let now;try{now=createHash('sha256').update(await readFile(path)).digest('hex')}catch{now='ABSENT'}if(now!==before)changed.push(path)}report.changedSources=changed;assert.deepEqual(changed,[]);
}catch(error){report.error=String(error)}finally{await browser?.close();await server.close();await writeFile(output,JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify({output,pass:report.results.length,error:report.error}));if(report.error)process.exitCode=1;
