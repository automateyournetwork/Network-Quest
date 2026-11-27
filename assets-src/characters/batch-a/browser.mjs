// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Dedicated HTTPS static GLB inspection. Only exact inspection HTML, assigned models and Three modules are served.
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:https';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {firefox} from 'playwright';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const local=path.join(root,'.local/t107');
const out=path.join(root,'docs/evidence/spec001/assets/t107');
const raw=path.join(root,'docs/evidence/spec001/character-production/T107');
const ids=['CH02','CH04','CH05','CH06','CH07','CH08','CH09'];
const dir=await mkdtemp(path.join(local,'tls-'));
let server,context;
try {
    const file=name=>path.join(dir,name);
    const profile=file('profile');
    await mkdir(profile,{mode:0o700});
    const quiet={cwd:dir,stdio:'ignore',timeout:15000};
    await writeFile(file('leaf.ext'),'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n');
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','1','-subj','/CN=T107 local CA','-addext','basicConstraints=critical,CA:TRUE,pathlen:0','-addext','keyUsage=critical,keyCertSign,cRLSign','-keyout','ca.key','-out','ca.pem'],quiet);
    execFileSync('openssl',['req','-newkey','rsa:2048','-nodes','-subj','/CN=127.0.0.1','-keyout','leaf.key','-out','leaf.csr'],quiet);
    execFileSync('openssl',['x509','-req','-in','leaf.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-days','1','-sha256','-extfile','leaf.ext','-out','leaf.pem'],quiet);
    execFileSync('openssl',['verify','-CAfile','ca.pem','leaf.pem'],quiet);
    execFileSync('certutil',['-N','-d','sql:'+profile,'--empty-password'],quiet);
    execFileSync('certutil',['-A','-d','sql:'+profile,'-n','T107 local CA','-t','C,,','-i','ca.pem'],quiet);
    server=createServer({cert:await readFile(file('leaf.pem')),key:await readFile(file('leaf.key'))},async(req,res)=>{
        const p=new URL(req.url,'https://127.0.0.1').pathname;
        let relative;
        if(p==='/') relative='assets-src/characters/batch-a/inspect.html';
        else if(ids.some(id=>p==='/models/'+id+'.glb')) relative='public/assets'+p;
        else if(/^\/three\/(?:build|examples\/jsm)\/[A-Za-z0-9_./-]+\.js$/.test(p) && !p.includes('..')) relative='node_modules'+p;
        if(!relative){ res.writeHead(404).end();return; }
        try{
            const bytes=await readFile(path.join(root,relative));
            res.writeHead(200,{'content-type':p==='/'?'text/html':p.endsWith('.js')?'text/javascript':'model/gltf-binary'}).end(bytes);
        } catch {res.writeHead(404).end();}
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    context=await firefox.launchPersistentContext(profile,{headless:true,ignoreHTTPSErrors:false,viewport:{width:540,height:540},deviceScaleFactor:1,env:{PATH:process.env.PATH,LANG:'C',LC_ALL:'C'}});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto('https://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>window.ready);
    for(const id of ids){
        const native=JSON.parse(await readFile(path.join(raw,id+'-native.json'),'utf8'));
        const matrices=JSON.parse(await readFile(path.join(local,id+'-matrices.json'),'utf8'));
        const result=await page.evaluate(([id,camera])=>window.openModel(id,camera),[id,native.runtimeCamera]);
        result.asset=id;result.browser=context.browser().version();result.three='0.187.0';result.strictTLS=true;
        result.exportSha256=native.exportSha256;result.errors=errors;
        assert.deepEqual(result.clips.map(c=>c.name).sort(),Object.keys(native.clips).sort());
        assert.equal(result.triangles,Object.values(native.editableMeshes).reduce((a,b)=>a+b,0));
        assert.deepEqual(Object.keys(result.materials).sort(),Object.keys(native.nativeMaterials).sort());
        for(const [key,mat] of Object.entries(native.nativeMaterials)){
            const other=result.materials[key];
            for(const [i,value] of mat.linearBaseColor.entries())assert(Math.abs(value-other.linearBaseColor[i])<1e-5);
            assert(Math.abs(mat.metallic-other.metallic)<1e-5 && Math.abs(mat.roughness-other.roughness)<1e-5);
        }
        result.linearPbrMaterialParity=true;
        const rest=await page.evaluate(()=>window.pose(null,0,[],true));
        await writeFile(path.join(out,id+'-browser.png'),Buffer.from(rest.png,'base64'));
        for(const clip of result.clips){
            const name=clip.name;
            assert(clip.varyingChannels>0);
            assert(Math.abs(clip.duration-native.clips[name].seconds)<1e-5);
            clip.runtimeSweptBounds=await page.evaluate(([name,frames])=>window.sweptBounds(name,frames),[name,native.clips[name].frames]);
            clip.maximumJointMatrixError=0;
            for(const f of native.clips[name].sampleFractions){
                const reference=matrices[name][String(f)];
                const save=f===(name==='idle'?.25:.5);
                const shot=await page.evaluate(([name,f,nodes,save])=>window.pose(name,f,nodes,save),[name,f,Object.keys(reference),save]);
                for(const [node,expected] of Object.entries(reference)){
                    for(let i=0;i<16;i++){
                        const error=Math.abs(shot.matrices[node][i]-expected[i]);
                        clip.maximumJointMatrixError=Math.max(clip.maximumJointMatrixError,error);
                        assert(error<1e-4,id+' '+name+' '+f+' '+node+' matrix error '+error);
                    }
                }
                clip.sampledJoints=Object.keys(reference).length;
                if(save) await writeFile(path.join(local,id+'-'+name+'-browser.png'),Buffer.from(shot.png,'base64'));
            }
        }
        assert.deepEqual(errors,[]);
        await writeFile(path.join(raw,id+'-browser.json'),JSON.stringify(result,null,2)+'\n');
        console.log(id,result.draws,result.triangles,result.clips.map(c=>[c.name,c.varyingChannels,c.maximumJointMatrixError]));
    }
} finally {
    await context?.close();
    if(server)await new Promise(resolve=>server.close(resolve));
    await rm(dir,{recursive:true,force:true});
}
