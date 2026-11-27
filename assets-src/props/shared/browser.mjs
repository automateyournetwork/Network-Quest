// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Native headless Firefox with an ephemeral trusted TLS endpoint. Run from the repository root.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:https';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {firefox} from 'playwright';

const {rooms}=JSON.parse(await readFile('assets-src/rooms/scene-layouts.json','utf8'));
const models=new Map();
for(const [index,room] of rooms.entries()){
    if (!index) continue;
    const pair=2*Math.floor(index/2)+1;
    const folder=index===1?'R02/':(pair===3||pair===7)?'R'+String(pair).padStart(2,'0')+'-R'+String(pair+1).padStart(2,'0')+'/':'';
    for(const p of room.propPlacements){
        const id=p.semanticId.slice(-5);
        models.set('/model/'+id+'.glb','public/assets/models/'+(p.sourceAllocation==='Shared'?'shared/':folder)+id+'.glb');
    }
}
const reports='docs/evidence/spec001/prop-production/T116';
const scratch=await mkdtemp(join(tmpdir(),'nq-t116-'));
const profile=join(scratch,'profile');
const run=(bin,args)=>execFileSync(bin,args,{cwd:scratch,stdio:'ignore',timeout:20000});
const runtimeBounds=([[x,y,z],[X,Y,Z]])=>[[x,z,-Y],[X,Z,-y]];
const maxError=(a,b)=>Math.max(...a.flat().map((v,i)=>Math.abs(v-b.flat()[i])));
let server,context;
try {
    await mkdir(profile,{mode:0o700});
    await writeFile(join(scratch,'san'),'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n');
    run('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=T116 asset CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign','-keyout','ca.key','-out','ca.pem']);
    run('openssl',['req','-newkey','rsa:2048','-nodes','-subj','/CN=127.0.0.1','-keyout','leaf.key','-out','leaf.csr']);
    run('openssl',['x509','-req','-in','leaf.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-days','1','-extfile','san','-out','leaf.pem']);
    run('certutil',['-N','-d','sql:'+profile,'--empty-password']);
    run('certutil',['-A','-d','sql:'+profile,'-n','T116 local asset CA','-t','C,,','-i','ca.pem']);
    server=createServer({key:await readFile(join(scratch,'leaf.key')),cert:await readFile(join(scratch,'leaf.pem'))},async(req,res)=>{
        const p=new URL(req.url,'https://127.0.0.1').pathname;
        const filename=p==='/'?'assets-src/props/shared/inspect.html':
            models.has(p)?models.get(p):
            /^\/three\/(build|examples\/jsm)\/[\w/.-]+\.js$/.test(p)?'node_modules'+p:null;
        if (!filename || p.includes('..')) {res.writeHead(404).end();return;}
        try {res.setHeader('Content-Type',p==='/'?'text/html':p.endsWith('.js')?'text/javascript':'model/gltf-binary'); res.end(await readFile(filename));}
        catch {res.writeHead(404).end();}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    context=await firefox.launchPersistentContext(profile,{headless:true,ignoreHTTPSErrors:false,viewport:{width:448,height:448},deviceScaleFactor:1});
    const page=await context.newPage(), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto('https://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>typeof window.loadModel==='function');
    for (const id of process.argv.slice(2)) {
        assert.match(id,/^PR1(?:2[1-9]|[34][0-9]|50)$/);
        const native=JSON.parse(await readFile(join(reports,id+'-native.json'),'utf8'));
        const stats=await page.evaluate(([id,native])=>window.loadModel(id,native),[id,native]);
        const png=Buffer.from(stats.png,'base64');
        delete stats.png;
        const boundError=maxError(stats.bounds,runtimeBounds(native.nativeBounds));
        assert.ok(Number.isFinite(boundError) && boundError<1e-5,id+' bounds');
        assert.deepEqual(stats.materials,native.materials,id+' materials');
        assert.equal(stats.geometryTriangles,Object.values(native.editableMeshes).reduce((a,b)=>a+b,0),id+' geometry');
        assert.equal(stats.revision,'187');
        stats.maxBoundsErrorMetres=boundError;
        stats.browser=context.browser().version();
        stats.strictTLS=true;
        stats.exportSha256=native.exportSha256;
        stats.capturedAt=new Date().toISOString();
        await writeFile(join(reports,id+'-browser.png'),png);
        await writeFile(join(reports,id+'-browser.json'),JSON.stringify(stats,null,2)+'\n');
        console.log(id,stats.geometryTriangles,'triangles',stats.draws,'draws',boundError,'m');
    }
    if(process.argv.length===32){
        for(const room of rooms.slice(1)){
            const id=room.roomId.slice(-3);
            const fits=JSON.parse(await readFile('assets-src/props/shared/mounts.json','utf8'));
            for(const mode of ['frozen','mounted']){
                const placed=structuredClone(room);
                if(mode==='mounted'){
                    for(const p of placed.propPlacements){
                        const fit=fits[p.semanticId.slice(-5)];
                        if(!fit)continue;
                        const parent=room.propPlacements.find(q=>q.instanceId===p.mountedToInstanceId);
                        const [x,y,z]=fit.parentRelativeNative;
                        p.position=[parent.position[0]+x,parent.position[1]+z,parent.position[2]-y];
                        p.mountEuler=fit.runtimeEuler??[0,0,0];
                    }
                }
                const result=await page.evaluate(r=>window.stageRoom(r),placed);
                await writeFile(join(reports,id+'-'+mode+'.png'),Buffer.from(result.png,'base64'));
                delete result.png;
                await writeFile(join(reports,id+'-'+mode+'-identities.png'),Buffer.from(result.idMap,'base64'));
                delete result.idMap;
                result.camera=room.camera;
                result.inputs=await Promise.all(placed.propPlacements.map(async p=>{
                    const path=models.get('/model/'+p.semanticId.slice(-5)+'.glb');
                    return {assetId:p.assetId,path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')};
                }));
                result.scope='Ten room fixtures plus all allocated shared models. '+(mode==='frozen'?'Unmodified frozen staging.':'Proposed parent-relative placements for room integration.');
                result.transforms=placed.propPlacements.map(p=>({id:p.semanticId,position:p.position,euler:p.mountEuler??[0,0,0]}));
                await writeFile(join(reports,id+'-'+mode+'.json'),JSON.stringify(result,null,2)+'\n');
            }

        }
    }
    assert.deepEqual(errors,[]);
} finally {
    await context?.close();
    if(server) await new Promise(resolve=>server.close(resolve));
    await rm(scratch,{recursive:true,force:true});
}
