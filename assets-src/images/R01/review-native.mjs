// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Standalone image review only. Does not launch or change the game or a service.
import { firefox } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';

const dir=dirname(fileURLToPath(import.meta.url));
const root=resolve(dir,'../../..');
const out=resolve(root,'docs/evidence/spec001/assets');
await mkdir(out,{recursive:true});
const source=JSON.parse(await readFile(resolve(dir,'reference-inputs/registration-v2.json'),'utf8'));
const browser=await firefox.launch({headless:true});
const result={date:new Date().toISOString(),browser:await browser.version(),scope:'Native Firefox file-page image composition; not T066 gameplay or browser acceptance',captures:[]};
try {
  for(const [name,width,height,query] of [
    ['composition-1280',1280,720,''],['composition-1440',1440,900,''],
    ['composition-768',768,900,''],['composition-390',390,844,''],
    ['midground-light',1280,720,'&layer=midground&matte=light'],
    ['midground-dark',1280,720,'&layer=midground&matte=dark'],
    ['foreground-light',1280,720,'&layer=foreground&matte=light'],
    ['foreground-dark',1280,720,'&layer=foreground&matte=dark'],
  ]) {
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(resolve(dir,'review.html')).href+'?capture=1'+query);
    await page.evaluate(()=>window.reviewReady);
    const observed=await page.evaluate(()=>({registration:window.registration,images:[...document.images].map(i=>({id:i.id,width:i.naturalWidth,height:i.naturalHeight,complete:i.complete,rect:i.getBoundingClientRect().toJSON()}))}));
    const {heightSpan,widthSpan,plateRect}=observed.registration;
    const camera=new OrthographicCamera(-widthSpan/2,widthSpan/2,heightSpan/2,-heightSpan/2,.1,80);
    camera.position.set(12,13,16);camera.up.set(0,1,0);camera.lookAt(5,1,3);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
    const anchors=source.anchors.map(a=>{
      const p=new Vector3(...a.runtimeWorld).project(camera);
      const actual=[(p.x+1)*width/2,(1-p.y)*height/2];
      const registered=[plateRect.left+a.uvTopLeft[0]*plateRect.width,plateRect.top+a.uvTopLeft[1]*plateRect.height];
      return {semanticId:a.semanticId,projectedPixel:actual,platePixel:registered,deltaPixels:Math.hypot(actual[0]-registered[0],actual[1]-registered[1])};
    });
    const screenshot=`docs/evidence/spec001/assets/t064-${name}.png`;
    await page.screenshot({path:resolve(root,screenshot)});
    result.captures.push({name,viewport:[width,height],screenshot,errors,...observed,anchors,maxAnchorDeltaPixels:Math.max(...anchors.map(a=>a.deltaPixels))});
    await page.close();
  }
} finally {await browser.close();}
await writeFile(resolve(dir,'native-review-observations.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({browser:result.browser,captures:result.captures.map(c=>({name:c.name,errors:c.errors,maxAnchorDeltaPixels:c.maxAnchorDeltaPixels}))},null,2));
