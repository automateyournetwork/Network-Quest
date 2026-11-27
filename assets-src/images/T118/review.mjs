// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Standalone review of production plates and camera-aligned Blender casts.
import { firefox } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const dir = 'docs/evidence/spec001/image-production/T118';
const rooms = JSON.parse(await readFile(resolve(root,'assets-src/rooms/scene-layouts.json'),'utf8')).rooms.slice(4,8);
const browser = await firefox.launch({headless:true});
try {
  for (const room of rooms) {
    const id = room.roomId.slice(-3);
    const captures = [];
    const layers = ['background','midground','cast','foreground'];
    const castPath = id==='R06' ? dir+'/R06/current-cast/cast.png' : 'assets-src/images/'+id+'/reference/cast.png';
    const pathFor = l => l==='cast' ? castPath : 'public/assets/images/'+id+'/'+l+'.webp';
    for (const [name,width,height,markers] of [
      ['desktop',1280,720,false],['laptop',1024,768,false],['narrow',390,844,false],['exits',1280,720,true],
    ]) {
      const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
      const errors = [];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(pathToFileURL(resolve(root, 'assets-src/images/R01/review.html')).href);
      const urls = layers.map(l=>pathToFileURL(resolve(root,pathFor(l))).href);
      await page.setContent('<style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:#182532;display:grid;place-items:center}main{width:min(100vw, 177.777777778vh);aspect-ratio:16/9;position:relative}img{position:absolute;inset:0;width:100%;height:100%}b{position:absolute;border:2px solid #ffecc0;color:white;text-shadow:1px 1px #000;border-radius:100%;font:bold 11px system-ui;width:44px;height:44px;display:grid;place-items:center;transform:translate(-50%,-50%);background:#00102055}</style><main aria-label="Standalone cast and plate review"></main>');
      const observed = await page.evaluate(async ({urls,exits})=>{
        const stage=document.querySelector('main');
        for(const url of urls) {const el=document.createElement('img');el.alt='';el.src=url;stage.append(el);await el.decode();}
        for(const exit of exits){const el=document.createElement('b');el.textContent=exit.toRoomId.slice(-3);el.style.left=100*exit.uvAt16by9[0]+'%';el.style.top=100*exit.uvAt16by9[1]+'%';stage.append(el);}
        return {rect:stage.getBoundingClientRect().toJSON(), dimensions:[...document.images].map(i=>[i.naturalWidth,i.naturalHeight]),areas:[...stage.getElementsByTagName('b')].map(i=>i.getBoundingClientRect().toJSON())};
      },{urls,exits:markers?room.exits:[]});
      const {rect}=observed, cam=room.camera, aspect=rect.width/rect.height;
      const hs=Math.max(cam.minimumHeightSpan, cam.span/aspect),ws=hs*aspect;
      const camera=new OrthographicCamera(-ws/2,ws/2,hs/2,-hs/2,cam.near,cam.far);
      camera.position.set(...cam.position);camera.lookAt(...cam.target);camera.updateMatrixWorld(true);
      const anchors=[...room.exits,...room.hotspots,...room.registration.coordinateAnchors];
      const deltas=anchors.map(a=>{const v=new Vector3(...(a.anchorWorld||a.world)).project(camera);
        return Math.hypot((.5+.5*v.x-a.uvAt16by9[0])*rect.width,(.5-.5*v.y-a.uvAt16by9[1])*rect.height);});
      const delta=Math.max(...deltas);
      if(delta>.01 || errors.length || rect.left<-.01 || rect.top<-.01 || rect.right>width+.01 || rect.bottom>height+.01)throw Error(id+' '+name+' registration');
      const screenshot=dir+'/'+id+'/'+name+'.png';
      await page.screenshot({path:resolve(root,screenshot)});
      captures.push({name,viewport:[width,height],screenshot,errors,frame:rect,decodedDimensions:observed.dimensions,protectedAnchors:anchors.length,maximumProjectionDeltaCssPx:delta,exitTestOverlay:markers});
      await page.close();
    }
    await writeFile(resolve(root,dir+'/'+id+'/browser.json'),JSON.stringify({castPath,browser:'Firefox '+browser.version(),scope:'Standalone file composition using exact exports and actual GLB cast render. Gold circles on the exits capture are frozen eye-height controls for diagnostic inspection.',captures},null,2)+'\n');
  }
} finally {await browser.close();}
