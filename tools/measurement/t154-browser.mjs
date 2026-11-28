// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Usage: node tools/measurement/t154-browser.mjs <frozen-dist> <new-output-directory> cold|rooms [1280|1440]
import { firefox } from '@playwright/test';
import { mkdir, cp, readFile, appendFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import os from 'node:os';
import { localTls } from '../../tests/e2e/support/local-tls.ts';
import { clickButton, closeFrame, revealControl } from '../../tests/e2e/support/adventure-controls.ts';
import { distribution, summarizeResponses } from '../measure-browser.ts';
import { installMeasurementProbe } from '../measurement-browser-probe.ts';
import { installT067FrameProbe } from './t067-frame-probe.mjs';
import { t067Server, calibrateT067 } from './t067-frame-server.ts';
import { allRooms } from './t154-route.mjs';

const [dist, output, mode, onlyWidth] = process.argv.slice(2);
if (!dist || !output || !['cold','rooms'].includes(mode) || (onlyWidth && !['1280','1440'].includes(onlyWidth))) throw Error('Provide a frozen dist, new output directory, mode and optional viewport width.');
if (process.version !== 'v26.13.1') throw Error('Use pinned Node 26.13.1');
await mkdir(output);
const emit = async row => { await appendFile(join(output,'samples.ndjson'), JSON.stringify({ utc:new Date().toISOString(), ...row })+'\n'); };
const trimSnapshot = snapshot => {
  const { dataset, gl, domImageDecodedBytes, estimatedWebglTextureBytes, canvas, viewport, dpr } = snapshot;
  return { dataset, gl, domImageDecodedBytes, estimatedWebglTextureBytes, canvas, viewport, dpr };
};
// WebGL2 geometry submitted while baking the offscreen architecture behind the R04 sprite canvas.
// Weak context keys allow the application and the driver to release the original objects.
function offscreenProbe() {
  const urls=new Map();
  const create=URL.createObjectURL, revoke=URL.revokeObjectURL;
  URL.createObjectURL=function(blob) {
    const url=create.call(this,blob);
    urls.set(url,{type:blob.type,bytes:blob.size});
    return url;
  };
  URL.revokeObjectURL=function(url) {const result=revoke.call(this,url); urls.delete(url); return result;};
  window.__nqRoomUrls=()=>[...urls.values()];
  const observed = [], handles = new WeakMap();
  const proto = WebGL2RenderingContext.prototype;
  for (const [index, method] of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'].entries()) {
    const original = proto[method];
    proto[method] = function(...args) {
      const value = original.apply(this,args);
      if (this.canvas.isConnected) return value;
      let record = handles.get(this);
      if (!record) { record={calls:0,triangles:0}; observed.push(record); handles.set(this,record); }
      const count = args[index%2===0 ? 2 : 1], instances = index>=2 ? args.at(-1) : 1;
      const triangles = args[0]===4 ? Math.floor(count/3) : [5,6].includes(args[0]) ? Math.max(0,count-2) : 0;
      record.calls++; record.triangles+=instances*triangles;
      return value;
    };
  }
  window.__nqOffscreen = observed;
}
async function sample(context,server, viewport, pair, cache, page, full) {
  const responses=[], failures=[];
  const onResponse = r => { if (r.status()>=400) failures.push({kind:'http',status:r.status(),path:new URL(r.url()).pathname}); };
  const onRequest = r => { if(r.url().startsWith('https:')) responses.push(new URL(r.url()).pathname); };
  const onError = e => failures.push({kind:'page',error:e.message});
  const onFailed = r => failures.push({kind:'transport',error:r.failure()?.errorText,path:new URL(r.url()).pathname});
  page.on('response',onResponse);page.on('request',onRequest);page.on('pageerror',onError);page.on('requestfailed',onFailed);
  const capture = async () => page.evaluate(() => {
    const entries=[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')].filter(r=>r.name.startsWith(location.origin+'/') && !new URL(r.name).pathname.startsWith('/__t067/'));
    return entries.map(r=>({path:new URL(r.name).pathname,status:r.responseStatus,initiator:r.initiatorType,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize,transferSize:r.transferSize,startMs:r.startTime,endMs:r.responseEnd}));
  });
  const id={viewport,pair,cache};
  const startRows=server.requestRows.length;
  try {
    await page.goto(server.url+'?t067=review',{waitUntil:'domcontentloaded'});
    const button=page.getByRole('button',{name:'New Adventure',exact:true});
    await button.waitFor();
    const shellReadyMs=await page.evaluate(()=>performance.now());
    const shell=await capture();
    await button.click();
    const stage=page.locator('.nq-graybox[data-room-id="spec001:R01"][data-rendered=true]');
    await stage.waitFor();
    const firstReadyMs=await page.evaluate(()=>performance.now());
    const atReady=await capture();
    await page.waitForLoadState('networkidle');
    const settled=await capture();
    const graphics=await stage.locator('canvas').evaluate(canvas=>{
      const gl=canvas.getContext('webgl2'), info=gl.getExtension('WEBGL_debug_renderer_info');
      return {renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),unmaskedRenderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):null,webgl:gl.getParameter(gl.VERSION)};
    });
    const roomTraffic=server.requestRows.slice(startRows).filter(r=>!r.path.startsWith('/__t067/')).map(({path,status,bodyBytes,aborted})=>({path,status,bodyBytes,aborted}));
    await emit({type:'load',...id,graphics,version:context.browser()?.version(),loadAverage:os.loadavg(),shellReadyMs,firstReadyMs,shell,atReady,settled,shellTotals:summarizeResponses(shell),readyTotals:summarizeResponses(atReady),settledTotals:summarizeResponses(settled),roomTraffic,failures:[...failures]});
    if (!full) return;
    const visited=new Set();
    await allRooms(page,async (index,floor)=>{
      const roomId='spec001:R'+String(index).padStart(2,'0');
      await closeFrame(page);
      const root=page.locator('.nq-graybox[data-rendered=true][data-room-id="'+roomId+'"]');
      await root.waitFor();
      const snapshot=async()=> {
        const scene=trimSnapshot(await page.evaluate(()=>window.__nqT067.snapshot()));
        scene.liveObjectUrls=await page.evaluate(()=>window.__nqRoomUrls());
        return scene;
      };
      if (visited.has(index)) {
        await emit({type:'revisit',...id,roomId,scene:await snapshot()}); return;
      }
      visited.add(index);
      const entry=await snapshot();
      await clickButton(page,'Walk');
      await clickButton(page,floor);
      await closeFrame(page);
      // Time the visible room in the player's ordinary Walk mode. Track actual renders
      // separately from display callbacks, including timed sprite composition.
      const frames=await page.evaluate(async()=>{
        const element=document.querySelector('.nq-graybox'), times=[]; let previous=performance.now();
        const observer=new MutationObserver(()=>{ const now=performance.now();times.push(now-previous);previous=now; });
        observer.observe(element,{attributes:true,attributeFilter:['data-render-count']});
        const began=performance.now(), before=Number(element.dataset.renderCount);
        window.__nqMeasurement.begin();
        await new Promise(resolve=>setTimeout(resolve,3000));
        const end=performance.now(), measured=window.__nqMeasurement.end();
        observer.disconnect();
        return {durationMs:end-began,actualRenders:Number(element.dataset.renderCount)-before,actualIntervals:times,frameIntervals:measured.frameIntervals,glRenderedIntervals:measured.renderedIntervals,visibilityChanges:measured.visibilityChanges,visibility:measured.visibilityState,dropped:measured.droppedFrames,
          extraRoomImageBytes:[...element.querySelectorAll('img:not(.nq-room-layer)')].reduce((sum,img)=>sum+img.naturalWidth*img.naturalHeight*4,0),
          offscreen:window.__nqOffscreen.map(r=>({...r})),activeDialogs:document.querySelectorAll('.nq-window-active').length};
      });
      const active=await snapshot();
      // Four real floor traversals between the two registered stops. A position
      // change counts once, regardless of how often an unchanged cell repaints.
      if (index===4) {
        for (const label of ['The Echo Cavern entry',floor,'The Echo Cavern entry',floor]) {
          const target=await revealControl(page,label);
          await target.evaluate(el=>{
            const scene=document.querySelector('.nq-graybox');
            el.addEventListener('click',()=>{
              const began=performance.now(), steps=[];
              const record=()=>steps.push({ms:performance.now()-began,foot:scene.dataset.playerFoot,cell:scene.dataset.frameCH01,render:Number(scene.dataset.renderCount)});
              record();
              const observer=new MutationObserver(record);
              observer.observe(scene,{attributes:true,attributeFilter:['data-render-count']});
              window.__nqStride=new Promise(resolve=>setTimeout(()=>{observer.disconnect();resolve(steps);},1300));
            },{once:true,capture:true});
          });
          await target.click();
          await closeFrame(page);
          const steps=await page.evaluate(()=>window.__nqStride);
          if (!steps?.length || new Set(steps.map(s=>s.foot)).size<3) throw Error('Walk did not move the sprite between its floor stops');
          await emit({type:'sprite-walk',...id,roomId,target:label,steps});
        }
      }
      await clickButton(page,'Text scene');
      await page.locator('.nq-graybox').waitFor({state:'detached'});
      // Context loss is queued by Three's real disposal; retain the initial and settled readings.
      const immediate=await snapshot();
      await page.waitForTimeout(180);
      const released=await snapshot();
      await clickButton(page,'Retry visual scene');
      await root.waitFor();
      await closeFrame(page);
      const resumed=await snapshot();
      await emit({type:'room',...id,roomId,walk:floor,entry,active,frames,intervalStats:distribution(frames.actualIntervals.slice(1)),fps:frames.actualRenders*1000/frames.durationMs,immediate,released,resumed,loadAverage:os.loadavg()});
    });
    await emit({type:'route-complete',...id,rooms:visited.size,resources:await capture(),decodes:await page.evaluate(()=>window.__nqT067.decodes),failures,requests:responses.length});
  } finally {
    page.off('response',onResponse);page.off('request',onRequest);page.off('pageerror',onError);page.off('requestfailed',onFailed);
  }
}
const tls=await localTls();
let server;
try {
  const material={};
  for (const [field,file] of Object.entries({cert:'leaf.pem',key:'leaf.key',ca:'ca.pem'})) material[field]=await readFile(join(tls.directory,file));
  server=await t067Server({dist:resolve(dist),log:join(output,'private-server.ndjson'),tls:material});
  await writeFile(join(output,'dist.json'),JSON.stringify(server.manifest,null,2)+'\n');
  const calibration=await calibrateT067(server);
  await emit({type:'calibration',calibration,os:os.release(),architecture:os.arch(),cpus:os.cpus().length,cpu:os.cpus()[0].model,ramBytes:os.totalmem(),loadAverage:os.loadavg()});
  if (!calibration.valid) throw Error('Network scheduling control failed');
  for(const width of onlyWidth?[Number(onlyWidth)]:[1280,1440]) for(let pair=0;pair<(mode==='cold'?3:1);pair++){
    const viewport={width,height:width===1280?720:900}, profile=join(tls.directory,'t154-'+width+'-'+pair);
    await cp(tls.profile,profile,{recursive:true});
    const context=await firefox.launchPersistentContext(profile,{headless:true,ignoreHTTPSErrors:false,viewport,deviceScaleFactor:1,reducedMotion:'no-preference',env:{PATH:process.env.PATH,LANG:'C',LC_ALL:'C'}});
    try {
      await context.addInitScript({content:'if(location.protocol === "https:"){('+installMeasurementProbe.toString()+')();('+installT067FrameProbe.toString()+')();('+offscreenProbe.toString()+')();}'});
      const page=await context.newPage();
      page.setDefaultTimeout(15000);
      for(const cache of mode==='cold'?['cold','warm']:['cold']){
        try {await sample(context,server,viewport,pair,cache,page,mode==='rooms');}
        catch(error){await emit({type:'failed',viewport,pair,cache,error:String(error),at:await page.locator('.nq-graybox').getAttribute('data-room-id',{timeout:300}).catch(()=>null),available:await page.locator('button:visible:not(:disabled)').allTextContents()});process.exitCode=1;}
      }
    } finally {await context.close();}
  }
} finally {try{await server?.stop();}finally{await tls.stop();}await emit({type:'cleanup',ownedServerAndProfilesStopped:true});}
