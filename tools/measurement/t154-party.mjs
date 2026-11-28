// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Time the densest previously observed party using two normally earned optical allies.
import { firefox } from '@playwright/test';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { localTls } from '../../tests/e2e/support/local-tls.ts';
import { clickButton, closeFrame } from '../../tests/e2e/support/adventure-controls.ts';
import { distribution } from '../measure-browser.ts';
import { installMeasurementProbe } from '../measurement-browser-probe.ts';
import { installT067FrameProbe } from './t067-frame-probe.mjs';
import { calibrateT067,t067Server } from './t067-frame-server.ts';
import { allRooms } from './t154-route.mjs';

const [dist,output]=process.argv.slice(2);
if(!dist || !output || process.version!=='v26.13.1') throw Error('Use the pinned Node with a frozen dist and new output directory.');
await mkdir(output);
const emit=row=>appendFile(join(output,'samples.ndjson'),JSON.stringify({utc:new Date().toISOString(),...row})+'\n');
const tls=await localTls();
let server, browser;
try {
  const material={};
  for(const [name,file] of Object.entries({cert:'leaf.pem',key:'leaf.key',ca:'ca.pem'})) material[name]=await readFile(join(tls.directory,file));
  server=await t067Server({dist,log:join(output,'private-server.ndjson'),tls:material});
  const calibration=await calibrateT067(server);
  await emit({type:'calibration',calibration});
  if(!calibration.valid) throw Error('Invalid calibrated throughput');
  browser=await firefox.launchPersistentContext(tls.profile,{headless:true,ignoreHTTPSErrors:false,viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:'no-preference'});
  await browser.addInitScript({content:'if(location.protocol==="https:"){('+installMeasurementProbe.toString()+')();('+installT067FrameProbe.toString()+')();}'});
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push({kind:'page',message:e.message}));
  page.on('response',r=>{if(r.status()>=400) errors.push({kind:'http',status:r.status(),path:new URL(r.url()).pathname});});
  page.on('requestfailed',r=>errors.push({kind:'transport',message:r.failure()?.errorText,path:new URL(r.url()).pathname}));
  const click=name=>clickButton(page,name);
  const sequence=async(...labels)=>{for(const label of labels) await click(label);};
  const stage=id=>page.locator('.nq-graybox[data-room-id="spec001:'+id+'"][data-rendered=true]');
  const compactSnapshot=async()=>page.evaluate(()=>{
    const {dataset,gl,domImageDecodedBytes,estimatedWebglTextureBytes,canvas}=window.__nqT067.snapshot();
    return {dataset,gl,domImageDecodedBytes,estimatedWebglTextureBytes,canvas};
  });
  const captureParty=async(id,floor)=>{
    await stage(id).waitFor();
    await closeFrame(page);
    const party='spec001:CH05 spec001:CH06';
    await page.waitForFunction(p=>document.querySelector('.nq-graybox')?.dataset.partyCast===p,party);
    await sequence('Walk',floor); await closeFrame(page);
    const before=await compactSnapshot(), frames=await page.evaluate(async()=>{
      const node=document.querySelector('.nq-graybox'), history=[],start=performance.now();
      const obs=new MutationObserver(()=>history.push({timeMs:performance.now()-start,foot:node.dataset.playerFoot}));
      obs.observe(node,{attributes:true,attributeFilter:['data-render-count']});
      const count=Number(node.dataset.renderCount);
      window.__nqMeasurement.begin();
      await new Promise(resolve=>setTimeout(resolve,3000));
      const elapsed=performance.now()-start, delta=Number(node.dataset.renderCount)-count, metrics=window.__nqMeasurement.end();
      obs.disconnect();
      return {elapsed,delta,history,metrics};
    });
    const after=await compactSnapshot();
    await click('Text scene'); await page.locator('.nq-graybox').waitFor({state:'detached'}); await page.waitForTimeout(180);
    const released=await compactSnapshot();
    await click('Retry visual scene'); await stage(id).waitFor(); await closeFrame(page);
    await page.waitForFunction(p=>document.querySelector('.nq-graybox')?.dataset.partyCast===p,party);
    await emit({type:'party',id,before,after,released,resumed:await compactSnapshot(),fps:frames.delta*1000/frames.elapsed,
      intervals:distribution(frames.history.slice(1).map((r,i)=>r.timeMs-frames.history[i].timeMs)),frames});
  };
  await page.goto(server.url+'?t067=review',{waitUntil:'domcontentloaded'});
  const button=page.getByRole('button',{name:'New Adventure',exact:true}); await button.waitFor();
  const shellReadyMs=await page.evaluate(()=>performance.now());
  await button.click(); await stage('R01').waitFor();
  const readyMs=await page.evaluate(()=>performance.now()); await page.waitForLoadState('networkidle');
  await emit({type:'joined-load',version:browser.browser()?.version(),shellReadyMs,readyMs,
    traffic:server.requestRows.filter(r=>!r.path.startsWith('/__t067/')).map(({path,status,bodyBytes,sourceSha256})=>({path,status,bodyBytes,sourceSha256}))});
  let gardens=0;
  const done=Symbol('done');
  try {await allRooms(page,async(index)=>{
    const id='R'+String(index).padStart(2,'0');
    await stage(id).waitFor(); await closeFrame(page);
    if(index===5){
      if(++gardens===1) await sequence('Look','Single-Mode Unicorn','Multimode Hydra');
      else if(gardens===2){
        for(const actor of ['Single-Mode Unicorn','Multimode Hydra']){
          await sequence('Party','Invite '+actor,'Activate '+actor,'Close party');
        }
      }
    }
    if(index===9){
      await captureParty('R09','Clear market aisle');
      for(const [label,id] of [["Walk to The Titan's Workshop",'R02'],['Walk to The Copper Warrens','R03'],['Walk to The Echo Cavern','R04']]) {
        await sequence('Walk',label); await stage(id).waitFor(); await closeFrame(page);
      }
      await captureParty('R04','Dry cavern ledge');
      throw done;
    }
  });}catch(e){if(e!==done)throw e;}
  await emit({type:'finished',errors});
} catch(e){await emit({type:'failure',message:String(e)});process.exitCode=1;}
finally{ try{await browser?.close();}finally{try{await server?.stop();}finally{await tls.stop();}} await emit({type:'cleanup',ownedServerAndProfilesStopped:true});}
