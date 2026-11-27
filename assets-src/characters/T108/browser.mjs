// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Native headless Firefox with an ephemeral trusted TLS endpoint. Run from the repository root.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:https';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {firefox} from 'playwright';

const out='docs/evidence/spec001/assets/T108';
const reports='docs/evidence/spec001/character-production/T108';
const scratch=await mkdtemp(join(tmpdir(),'nq-t108-'));
const profile=join(scratch,'profile');
const run=(bin,args)=>execFileSync(bin,args,{cwd:scratch,stdio:'ignore',timeout:20000});
const runtimeBounds=([[x,y,z],[X,Y,Z]])=>[[x,z,-Y],[X,Z,-y]];
const maxError=(a,b)=>Math.max(...a.flat().map((v,i)=>Math.abs(v-b.flat()[i])));
let server,context;
try {
    await mkdir(profile,{mode:0o700});
    await writeFile(join(scratch,'san'),'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n');
    run('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=T108 asset CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign','-keyout','ca.key','-out','ca.pem']);
    run('openssl',['req','-newkey','rsa:2048','-nodes','-subj','/CN=127.0.0.1','-keyout','leaf.key','-out','leaf.csr']);
    run('openssl',['x509','-req','-in','leaf.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-days','1','-extfile','san','-out','leaf.pem']);
    run('certutil',['-N','-d','sql:'+profile,'--empty-password']);
    run('certutil',['-A','-d','sql:'+profile,'-n','T108 local asset CA','-t','C,,','-i','ca.pem']);
    server=createServer({key:await readFile(join(scratch,'leaf.key')),cert:await readFile(join(scratch,'leaf.pem'))},async(req,res)=>{
        const p=new URL(req.url,'https://127.0.0.1').pathname;
        const filename=p==='/'?'assets-src/characters/T108/inspect.html':
            /^\/model\/CH(?:03|1[0-7])\.glb$/.test(p)?'public/assets/models/'+p.slice(7):
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
    const grab=async(id,label)=>{
        const png=Buffer.from(await page.evaluate(()=>window.capture()),'base64');
        await writeFile(join(out,id+'-browser-'+label+'.png'),png);
    };
    const ids=process.argv.slice(2);
    for (const id of ids) {
        assert.match(id,/^CH1[0-7]$/);
        const native=JSON.parse(await readFile(join(reports,id+'-native.json'),'utf8'));
        const stats=await page.evaluate(([id,native])=>window.loadModel(id,native),[id,native]);
        stats.restBoundsErrorMetres=maxError(stats.bounds,runtimeBounds(native.nativeBounds));
        await grab(id,'rest');
        assert.deepEqual(stats.clips.map(c=>c.name).sort(),Object.keys(native.clips).sort());
        for(const clip of stats.clips) {
            const source=native.clips[clip.name]; let start,changed=new Set();
            assert.ok(clip.varying.length>0);
            clip.samples=[];
            for (const [i,sample] of source.samples.entries()) {
                const pose=await page.evaluate(([name,t])=>window.sampleClip(name,t),[clip.name,sample.seconds]);
                start??=pose.matrices;
                pose.matrices.forEach((m,j)=>{if(m.some((v,k)=>Math.abs(v-start[j][k])>1e-5))changed.add(j);});
                clip.samples.push({seconds:sample.seconds,bounds:pose.bounds,sourceBoundsErrorMetres:maxError(pose.bounds,runtimeBounds(sample.bounds))});
                if(i===2) await grab(id,clip.name);
            }
            clip.movingDrawMeshes=changed.size;
            assert.ok(clip.movingDrawMeshes>0,id+' '+clip.name+' needs visible motion');
        }
        stats.browser=context.browser().version(); stats.strictTLS=true;stats.capturedAt=new Date().toISOString();
        stats.maxPoseBoundsErrorMetres=Math.max(stats.restBoundsErrorMetres,...stats.clips.flatMap(c=>c.samples.map(s=>s.sourceBoundsErrorMetres)));
        assert.ok(Number.isFinite(stats.maxPoseBoundsErrorMetres),'GLB or native bounds invalid');
        assert.ok(stats.maxPoseBoundsErrorMetres<1e-5,id+' native/GLB pose mismatch');
        await writeFile(join(reports,id+'-browser.json'),JSON.stringify(stats,null,2)+'\n');
        console.log(id,'draws',stats.draws,'tris',stats.triangles,'max bounds difference',stats.maxPoseBoundsErrorMetres);
    }
    if(ids.length===8){
        const layout=JSON.parse(await readFile('assets-src/rooms/scene-layouts.json','utf8'));
        const stage=[];
        for(const room of layout.rooms){
            const placements=room.characterPlacements.filter(p=>ids.includes(p.characterId.slice(-4)));
            if(!placements.length)continue;
            const frame=await page.evaluate(([room,p])=>window.roomSample(room,p),[room,placements]);
            await writeFile(join(out,room.roomId.slice(-3)+'-frozen-staging.png'),Buffer.from(frame.png,'base64'));
            stage.push({room:room.roomId,camera:room.camera,placements:frame.result,partyStaging:room.partyStaging});
        }
        await writeFile(join(reports,'frozen-staging.json'),JSON.stringify(stage,null,2)+'\n');
        const party=[];
        for(const room of layout.rooms){
            const placements=['CH03','CH16'].map((id,i)=>({characterId:'spec001:'+id,position:room.partyStaging.positions[i]}));
            const frame=await page.evaluate(([room,p])=>window.roomSample(room,p),[room,placements]);
            const [a,b]=frame.result.map(p=>p.pixels);
            const gap=Math.max(b[0]-a[2],a[0]-b[2],b[1]-a[3],a[1]-b[3]);
            const inFrame=[a,b].every(([x,y,X,Y])=>x>=0&&y>=0&&X<=1280&&Y<=720);
            assert.ok(inFrame && gap>0,room.roomId+' party envelopes overlap or clip');
            party.push({room:room.roomId, placements:frame.result,pixelGap:gap,inFrame});
            if(room.roomId==='spec001:R09')await writeFile(join(out,'R09-CH03-CH16-party.png'),Buffer.from(frame.png,'base64'));
        }
        await writeFile(join(reports,'party-staging.json'),JSON.stringify(party,null,2)+'\n');
    }
    assert.deepEqual(errors,[]);
} finally {
    await context?.close();
    if(server) await new Promise(resolve=>server.close(resolve));
    await rm(scratch,{recursive:true,force:true});
}
