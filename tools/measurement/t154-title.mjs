// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Isolate T154's two natural startup failures. This control delays a session
// response and therefore contributes no sample to the calibrated timing table.
import { firefox } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { localTls } from '../../tests/e2e/support/local-tls.ts';
import { t067Server } from './t067-frame-server.ts';

const [dist,output]=process.argv.slice(2);
if(!dist || !output || process.version!=='v26.13.1') throw Error('Use pinned Node, a frozen dist and a new output directory.');
await mkdir(output);
const tls=await localTls(), result={events:[]};
let server,browser,release;
try {
  const material={};
  for(const [field,file] of Object.entries({cert:'leaf.pem',key:'leaf.key',ca:'ca.pem'})) material[field]=await readFile(join(tls.directory,file));
  server=await t067Server({dist,log:join(output,'private-server.ndjson'),tls:material});
  browser=await firefox.launchPersistentContext(tls.profile,{headless:true,ignoreHTTPSErrors:false,viewport:{width:1280,height:720},reducedMotion:'no-preference'});
  for(const phase of ['before settlement','straddling settlement']) {
    const page=await browser.newPage(), notes=[];
    const trial={phase,notes};result.events.push(trial);
    const held=new Promise(resolve=>{release=resolve;});
    let intercepted;
    const offered=new Promise(resolve=>{intercepted=resolve;});
    await page.route('**/api/v1/session',async route=>{intercepted();await held;await route.continue();});
    await page.goto(server.url+'?t067=review',{waitUntil:'domcontentloaded'});
    const button=page.getByRole('button',{name:'New Adventure',exact:true});
    const room=page.locator('.nq-graybox[data-room-id="spec001:R01"][data-rendered=true]');
    await offered;await button.waitFor();
    await page.evaluate(()=>{
      window.__nqClickTrace=[];
      for (const kind of ['pointerdown','pointerup','click']) document.addEventListener(kind,e=>{
        window.__nqClickTrace.push({type:e.type,target:e.target.textContent.trim().slice(0,70),trusted:e.isTrusted,x:e.clientX,y:e.clientY});
      },true);
    });
    const snapshot=async label=>notes.push({label,utc:new Date().toISOString(),titleVisible:await button.isVisible(),roomVisible:await room.isVisible(),
      menuMessage:await page.locator('.nq-menu p[aria-live=polite]').allTextContents(),
      rect:await button.isVisible()?await button.boundingBox():null});
    await snapshot('bootstrap held');
    if(phase==='before settlement'){
      await button.click(); release();
    }else{
      const r=await button.boundingBox(); await page.mouse.move(r.x+r.width/2,r.y+r.height/2);
      await page.mouse.down();
      const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/api/v1/session'));
      release();await response;await page.waitForTimeout(150);
      await snapshot('settled before releasing pointer');await page.mouse.up();
    }
    await page.waitForTimeout(600);
    const advanced=!(await button.isVisible());
    if(advanced) await room.waitFor({timeout:15000});
    await snapshot('first action settled');
    if(!advanced){await button.click();await room.waitFor({timeout:15000});await snapshot('second trusted click');}
    Object.assign(trial,{firstActionStartedAdventure:advanced,inputs:await page.evaluate(()=>window.__nqClickTrace)});
    await page.close();
  }
  result.status='completed';
} catch(error){result.status='failed';result.error=String(error);process.exitCode=1;}
finally {release?.();try{await browser?.close();}finally{try{await server?.stop();}finally{await tls.stop();}}result.cleanup=true;await writeFile(join(output,'result.json'),JSON.stringify(result,null,2)+'\n');}
