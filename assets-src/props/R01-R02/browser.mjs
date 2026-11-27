// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// TLS/NSS pattern adapted from the original project R01 asset inspection.
// Every route serves either this viewer, the local Three distribution or the ten explicit GLBs.
import {readFile,writeFile,mkdir,mkdtemp,rm,chmod} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:https';
import path from 'node:path';
import {firefox} from 'playwright';

const raw='docs/evidence/spec001/prop-production/T110';
const work='.local/t110';
await mkdir(work,{recursive:true});
const scratch=await mkdtemp(path.join(work,'browser-'));
let server,context;
function run(cmd,args){
  const r=spawnSync(cmd,args,{cwd:scratch,stdio:'ignore',timeout:15000});
  if(r.status!==0)throw Error(cmd+' failed');
}
try{
  const profile=path.resolve(scratch,'profile');
  await chmod(scratch,0o700);await mkdir(profile,{mode:0o700});
  await writeFile(path.join(scratch,'ext'),'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n');
  run('openssl',['req','-x509','-newkey','rsa:2048','-sha256','-nodes','-days','1','-subj','/CN=T110 disposable CA','-addext','basicConstraints=critical,CA:TRUE,pathlen:0','-addext','keyUsage=critical,keyCertSign,cRLSign','-keyout','ca.key','-out','ca.pem']);
  run('openssl',['req','-newkey','rsa:2048','-sha256','-nodes','-subj','/CN=127.0.0.1','-keyout','leaf.key','-out','leaf.csr']);
  run('openssl',['x509','-req','-in','leaf.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-days','1','-sha256','-extfile','ext','-out','leaf.pem']);
  run('openssl',['verify','-CAfile','ca.pem','leaf.pem']);
  run('certutil',['-N','-d','sql:'+profile,'--empty-password']);
  run('certutil',['-A','-d','sql:'+profile,'-n','T110 disposable TLS','-t','C,,','-i','ca.pem']);
  server=createServer({key:await readFile(path.join(scratch,'leaf.key')),cert:await readFile(path.join(scratch,'leaf.pem'))},async(req,res)=>{
    const p=new URL(req.url,'https://127.0.0.1').pathname;
    const f=p==='/'?'assets-src/props/R01-R02/viewer.html':/^\/models\/R02\/PR0(1[1-9]|20)\.glb$/.test(p)?'public/assets'+p:p.startsWith('/three/')?'node_modules/three/'+p.slice(7):null;
    try{
      if(!f)throw Error();
      const body=await readFile(f);
      res.writeHead(200,{'Content-Type':f.endsWith('.glb')?'model/gltf-binary':f.endsWith('.html')?'text/html':'text/javascript'});
      res.end(body);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  context=await firefox.launchPersistentContext(profile,{headless:true,ignoreHTTPSErrors:false,viewport:{width:480,height:480},deviceScaleFactor:1,env:{PATH:process.env.PATH,LANG:'C',LC_ALL:'C'}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>!!window.inspect);
  for(let n=11;n<=20;n++){
    const id='PR'+String(n).padStart(3,'0');
    const dir=path.join(raw,id);
    const native=JSON.parse(await readFile(path.join(dir,'native.json'),'utf8'));
    const report=await page.evaluate(([id,meta])=>window.inspect(id,meta),[id,native]);
    await page.locator('canvas').screenshot({path:path.join(dir,'browser.png')});
    Object.assign(report,{browser:context.browser().version(),node:process.version,strictLoopbackTLS:true,
      asset:id,sourceSha256:native.sourceSha256,exportSha256:native.exportSha256,
      date:new Date().toISOString(),scope:'Isolated GLB review',pageErrors:[...errors]});
    await writeFile(path.join(dir,'browser.json'),JSON.stringify(report,null,2)+'\n');
    if(report.triangles!==native.triangles||report.maxBoundErrorMetres>.00002||
       !report.embeddedBuffers||report.meshes!==1||JSON.stringify(report.materialNames)!==JSON.stringify(native.materials))
      throw Error(id+' source/export parity failure');
    console.log(id,report.triangles,report.materialDraws,report.maxBoundErrorMetres);
  }
  const layouts=JSON.parse(await readFile('assets-src/rooms/scene-layouts.json','utf8'));
  const room=layouts.rooms.find(r=>r.roomId==='spec001:R02');
  await page.setViewportSize({width:960,height:540});
  const stage=await page.evaluate(r=>window.staging(r),room);
  await page.locator('canvas').screenshot({path:path.join(raw,'staging.png')});
  await writeFile(path.join(raw,'staging.json'),JSON.stringify(stage,null,2)+'\n');
  if(errors.length)throw Error(JSON.stringify(errors));
}finally{
  await context?.close();
  if(server)await new Promise(r=>server.close(r));
  await rm(scratch,{recursive:true,force:true});
}
