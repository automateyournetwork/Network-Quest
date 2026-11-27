// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Dedicated HTTPS static GLB inspection. Only exact inspection HTML, assigned models and Three modules are served.
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:https';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {firefox} from 'playwright';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const local=path.join(root,'.local/t111');
await mkdir(local,{recursive:true});
const raw=path.join(root,'docs/evidence/spec001/prop-production/T111');
const all=Array.from({length:20},(_,i)=>'PR'+String(i+21).padStart(3,'0'));
const ids=process.argv.length>2?process.argv.slice(2):all;
assert(ids.length && ids.every(id=>all.includes(id)));
const dir=await mkdtemp(path.join(local,'tls-'));
let server,context;
try {
    const file=name=>path.join(dir,name);
    const profile=file('profile');
    await mkdir(profile,{mode:0o700});
    const quiet={cwd:dir,stdio:'ignore',timeout:15000};
    await writeFile(file('leaf.ext'),'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n');
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','1','-subj','/CN=T111 local CA','-addext','basicConstraints=critical,CA:TRUE,pathlen:0','-addext','keyUsage=critical,keyCertSign,cRLSign','-keyout','ca.key','-out','ca.pem'],quiet);
    execFileSync('openssl',['req','-newkey','rsa:2048','-nodes','-subj','/CN=127.0.0.1','-keyout','leaf.key','-out','leaf.csr'],quiet);
    execFileSync('openssl',['x509','-req','-in','leaf.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-days','1','-sha256','-extfile','leaf.ext','-out','leaf.pem'],quiet);
    execFileSync('openssl',['verify','-CAfile','ca.pem','leaf.pem'],quiet);
    execFileSync('certutil',['-N','-d','sql:'+profile,'--empty-password'],quiet);
    execFileSync('certutil',['-A','-d','sql:'+profile,'-n','T111 local CA','-t','C,,','-i','ca.pem'],quiet);
    server=createServer({cert:await readFile(file('leaf.pem')),key:await readFile(file('leaf.key'))},async(req,res)=>{
        const p=new URL(req.url,'https://127.0.0.1').pathname;
        let relative;
        if(p==='/') relative='assets-src/characters/batch-a/inspect.html';
        else if(ids.some(id=>p==='/models/'+id+'.glb')) relative='public/assets/models/R03-R04/'+path.basename(p);
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
        const data=await readFile(path.join(root,'public/assets/models/R03-R04/'+id+'.glb'));
        const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
        assert.equal(digest(data),native.glbSha256);
        const result=await page.evaluate(([id,camera])=>window.openModel(id,camera),[id,native.runtimeCamera]);
        assert.deepEqual(result.clips,[]);
        assert.equal(result.triangles,native.triangles);
        assert.deepEqual(Object.keys(result.materials).sort(),Object.keys(native.materials).sort());
        for(const [name,mat] of Object.entries(native.materials)){
            const other=result.materials[name];
            for(const [i,value] of mat.linearBaseColor.entries())assert(Math.abs(value-other.linearBaseColor[i])<1e-5);
            assert(Math.abs(mat.metallic-other.metallic)<1e-5 && Math.abs(mat.roughness-other.roughness)<1e-5);
        }
        const shot=await page.evaluate(()=>window.pose(null,0,[],true));
        const pixels=Buffer.from(shot.png,'base64');
        await writeFile(path.join(raw,id+'-browser.png'),pixels);
        assert.deepEqual(errors,[]);
        const report={id,browser:context.browser().version(),three:'0.187.0',strictTLS:true,
            glbSha256:digest(data),browserRenderSha256:digest(pixels),runtimeCamera:native.runtimeCamera,
            screenshotPixels:[540,540],linearPbrColorMetalnessRoughnessParity:true,errors:[...errors],...result};
        await writeFile(path.join(raw,id+'-browser.json'),JSON.stringify(report,null,2)+'\n');
        console.log(id,result.triangles,result.draws);
    }
} finally {
    await context?.close();
    if(server)await new Promise(resolve=>server.close(resolve));
    await rm(dir,{recursive:true,force:true});
}
