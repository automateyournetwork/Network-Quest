// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Explicit isolated browser harness; no production provider, preview or save.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { firefox } from '@playwright/test';
const output = resolve(process.argv[2] ?? 'docs/evidence/spec001/epilogues/panel-dom.json');
const screenshot = resolve(process.argv[3] ?? 'docs/evidence/spec001/epilogues/panel-200-percent.png');
const server = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', envDir: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } });
server.middlewares.use((req, res, next) => {
  if (req.url !== '/epilogue-panel') return next();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>T087 isolated epilogue</title><style>body{margin:0;background:#171519;color:#faf7ee;font:18px system-ui}#frame{box-sizing:border-box;width:min(900px,100vw);height:660px;padding:12px;overflow:hidden;border:8px solid #626054}button{font:inherit;max-width:100%;white-space:normal;margin:.3em;padding:.35em}h2{margin:.25em 0}p{line-height:1.45}</style><body><button id="opener">Ending</button><main id="frame"></main>
<script type="module">
import {createEpiloguePanel} from '/src/ui/epilogue.ts';
import {validateEndingsContent,projectEpilogue,projectFailure} from '/src/content/endings.ts';
import raw from '/content/spec001/endings.json';
const validated=validateEndingsContent(raw);if(!validated.ok)throw Error(validated.issues.join());const content=validated.value;
let panel,current,nonce=0,calls=[],saved=[],captured=[];
function makeView(kind='E01'){
 if(kind==='failure')return projectFailure(content,content.hazard.id);
 const event={id:'event-1',outcome:kind,attemptId:'attempt-1',route:'copper',caveatIds:[]};
 const game={contentVersion:'1.0.0',episodeId:'spec001',adventureId:'adventure-1',world:{attemptId:'attempt-1',route:'copper',completedObjectiveIds:['spec001:O12'],completedQuestIds:[],recruits:[],activeAllyIds:[]},notebook:{factIds:[]},outcomeHistory:[event]};
 return projectEpilogue(content,game,event);
}
window.fixture={
 reset(){panel?.dispose();document.querySelector('#frame').replaceChildren();document.querySelector('#frame').hidden=false;document.querySelector('#frame').inert=false;document.querySelector('#opener').focus();calls=[];saved=[];captured=[];nonce++;
  panel=createEpiloguePanel(document.querySelector('#frame'),{dispatch(command){calls.push(command)},isCurrent(projection){return current===projection&&projection.nonce===nonce}});},
 render(kind='E01',restore='sign-in',retryAvailable=true){const token=nonce;current={nonce:token,storyKey:kind+'-event-1',view:makeView(kind),content,caveats:kind==='E02'?['Temporary dependency: borrowed installation. Limitation: not permanent. Follow-up: install and validate the permanent route before returning it.']:kind==='E03'?['The severed conduit is unresolved. Repair it at preparation and repeat the link and endpoint tests.']:[],retryAvailable,restore,capture(intent){captured.push(intent);return{intent,nonce:token}}};panel.render(current)},
 newStory(){current={...current,storyKey:current.storyKey+'-new-attempt'};panel.render(current)},
 remount(){panel.mount(document.body);const holder=document.createElement('div');holder.style.height='100%';document.querySelector('#frame').replaceChildren(holder);panel.mount(holder)},
 same(){panel.render(current)},save(){saved=[...panel.element.querySelectorAll('button')]},
 clickSaved(key){saved.find(b=>b.dataset.epilogueControl===key)?.click()},
 reinsert(){panel.element.append(...saved)},invalidate(){nonce++},hide(){panel.render(null)},dispose(){panel.dispose()},
 detached(){panel.element.remove()},hiddenHost(){document.querySelector('#frame').hidden=true},inertHost(){document.querySelector('#frame').inert=true},
 malicious(){current={...current,view:{...current.view,title:'<img src=x onerror="window.injection=true">',scene:['<scr'+'ipt>window.injection=true</scr'+'ipt>']}};panel.render(current)},
 state(){return{calls,captured,hidden:panel.element.hidden,sceneHidden:panel.element.querySelector('[data-epilogue-scene]')?.hidden,focus:document.activeElement?.textContent,html:panel.element.innerHTML,nonce}}
};window.fixture.reset();window.fixture.render();window.ready=true;
</script></body></html>`);
});
let browser;
const report = { task: 'T087', scope: 'isolated production epilogue panel, not accepted full outcome/recovery integration', observedAt: new Date().toISOString(),
  sources: {}, results: [], pageErrors: [] };
try {
  for (const path of ['src/ui/epilogue.ts','src/content/endings.ts','content/spec001/endings.json', 'tests/ui/epilogue-panel.browser.mjs']) {
    try { report.sources[path] = createHash('sha256').update(await readFile(path)).digest('hex'); }
    catch { report.sources[path] = 'MISSING'; }
  }
  await server.listen(); const address=server.httpServer.address(); if(!address||typeof address==='string')throw Error('Missing ephemeral listener');
  browser=await firefox.launch({headless:true});report.browserVersion=browser.version();report.executable=firefox.executablePath();
  const page=await browser.newPage({viewport:{width:1000,height:850}});page.on('pageerror',e=>report.pageErrors.push(e.message));
  await page.goto(`http://127.0.0.1:${address.port}/epilogue-panel`);await page.waitForFunction(()=>window.ready,{},{timeout:10000});
  const run=async(name,test)=>{await page.evaluate(()=>{window.fixture.reset();window.fixture.render()});try{await test();report.results.push({name,status:'PASS'})}catch(error){report.results.push({name,status:'FAIL',error:String(error)})}};
  const button=key=>page.locator('[data-epilogue-control="'+key+'"]');
  const state=()=>page.evaluate(()=>window.fixture.state());
  await run('scene starts readable; Continue is immediately available with no timer',async()=>{
    assert.equal(await page.getByRole('dialog',{name:'The Steady Light'}).count(),1);assert.equal(await button('continue').isDisabled(),false);
    assert.equal(await page.locator('[role="timer"]').count(),0);assert.equal((await state()).sceneHidden,false);assert.equal((await state()).focus,'The Steady Light');
  });
  await run('Skip and Replay affect narrative only; immutable result and controls remain',async()=>{
    const before=await page.locator('[data-epilogue-result]').innerText();await button('skip').click();assert.equal((await state()).sceneHidden,true);
    assert.equal(await page.locator('[data-epilogue-result]').innerText(),before);assert.equal(await button('continue').isVisible(),true);
    await button('replay').click();assert.equal((await state()).sceneHidden,false);assert.deepEqual((await state()).calls,[]);
  });
  await run('Escape skips once and never continues, retries or closes the result',async()=>{
    await button('skip').focus();await page.keyboard.press('Escape');await page.keyboard.press('Escape');const s=await state();
    assert.equal(s.sceneHidden,true);assert.equal(s.hidden,false);assert.equal(s.calls.length,0);assert.equal(s.focus,'Replay scene');
  });
  await run('modified or composing Escape does not skip',async()=>{
    await button('skip').focus();await page.keyboard.press('Shift+Escape');assert.equal((await state()).sceneHidden,false);
    await page.locator('[role="dialog"]').evaluate(el=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,isComposing:true})));assert.equal((await state()).sceneHidden,false);
  });
  await run('native Enter dispatches exact captured Continue only once',async()=>{
    await button('continue').focus();await page.keyboard.press('Enter');await button('continue').evaluate(el=>el.click());
    const s=await state();assert.deepEqual(s.calls,[{intent:'continue',nonce:s.nonce}]);
  });
  await run('new render invalidates old buttons even if reinserted',async()=>{
    const s=await page.evaluate(()=>{const f=window.fixture;f.save();f.render('E02');f.reinsert();f.clickSaved('continue');f.clickSaved('skip');return f.state()});assert.equal(s.calls.length,0);assert.equal(s.sceneHidden,false);
  });
  await run('identical text after a state refresh still retires prior command captures',async()=>{
    await button('skip').click();await button('continue').focus();const old=await state();
    const scroll=await page.getByRole('dialog').evaluate(el=>el.scrollTop);
    await page.evaluate(()=>{const f=window.fixture;f.save();f.invalidate();f.render('E01');f.reinsert();f.clickSaved('continue')});assert.equal((await state()).calls.length,0);
    assert.equal((await state()).sceneHidden,true);assert.equal((await state()).focus,'Continue');assert.equal(await page.getByRole('dialog').evaluate(el=>el.scrollTop),scroll);
    await page.locator('[data-epilogue-control="continue"]').first().click();const now=await state();assert.equal(now.calls[0].nonce,old.nonce+1);
  });
  await run('a new attempt resets narrative even when hazard text is identical',async()=>{
    await page.evaluate(()=>window.fixture.render('failure'));await button('skip').click();await page.evaluate(()=>window.fixture.newStory());
    assert.equal((await state()).sceneHidden,false);assert.equal((await state()).focus,'A Shortcut Too Short');
  });
  await run('an authorized shell replacement preserves same-story skip, scroll and focus with fresh controls',async()=>{
    await button('skip').click();await button('continue').focus();const scroll=await page.getByRole('dialog').evaluate(el=>el.scrollTop);
    await page.evaluate(()=>{const f=window.fixture;f.save();f.remount();f.invalidate();f.render('E01');f.clickSaved('continue')});
    const s=await state();assert.equal(s.calls.length,0);assert.equal(s.sceneHidden,true);assert.equal(s.focus,'Continue');assert.equal(await page.getByRole('dialog').evaluate(el=>el.scrollTop),scroll);
  });
  for(const action of ['invalidate','hide','dispose','detached','hiddenHost','inertHost'])await run(action+' blocks delayed captured controls',async()=>{
    const s=await page.evaluate(action=>{const f=window.fixture;f.save();f[action]();f.clickSaved('continue');f.clickSaved('skip');return f.state()},action);assert.equal(s.calls.length,0);
  });
  await run('a control moved outside its owning dialog is inert',async()=>{
    const s=await button('continue').evaluate(el=>{document.body.append(el);el.click();el.remove();return window.fixture.state()});assert.equal(s.calls.length,0);
  });
  await run('a whole dialog moved outside its supplied host cannot deliver commands',async()=>{
    const s=await page.getByRole('dialog').evaluate(el=>{document.body.append(el);el.querySelector('[data-epilogue-control="continue"]').click();return window.fixture.state()});assert.equal(s.calls.length,0);
  });
  await run('same projection preserves skip and focus; replacement captures a new scope',async()=>{
    await button('skip').click();await page.evaluate(()=>window.fixture.same());assert.equal((await state()).sceneHidden,true);assert.equal((await state()).focus,'Replay scene');
    await page.evaluate(()=>window.fixture.render('E02'));assert.equal((await state()).sceneHidden,false);assert.equal((await state()).focus,'The Borrowed Dawn');
  });
  await run('temporary caveat persists after scene skip',async()=>{
    await page.evaluate(()=>window.fixture.render('E02'));await button('skip').click();const text=await page.getByRole('dialog').innerText();
    assert.match(text,/Temporary dependency: borrowed installation/);assert.match(text,/Limitation: not permanent/);assert.match(text,/Follow-up: install and validate/);
  });
  await run('E03 Continue stays distinct from Restore and explains rollback, stale readings and save preservation',async()=>{
    await page.evaluate(()=>window.fixture.render('E03','available'));await button('skip').click();const text=await page.getByRole('dialog').innerText();
    assert.match(text,/service is unresolved/);assert.match(text,/Preparation and inventory rewind/);assert.match(text,/stale/);assert.match(text,/does not overwrite/);
    assert.equal(await button('continue').isVisible(),true);assert.equal(await button('restore').isVisible(),true);await button('continue').click();assert.equal((await state()).calls[0].intent,'continue');
  });
  await run('failure keeps its cause after skip with exact retry label and guest sign-in boundary',async()=>{
    await page.evaluate(()=>window.fixture.render('failure'));await button('skip').click();const text=await page.getByRole('dialog').innerText();
    assert.match(text,/ledge collapsed/);assert.match(text,/not the result of an incorrect diagnosis/);assert.match(text,/temporary session recovery/);
    assert.equal(await button('continue').count(),0);assert.equal(await button('retry').innerText(),'Retry from Encounter Preparation');
    assert.equal(await button('sign-in-to-restore').innerText(),'Sign in to Restore Save');assert.equal(await button('restore').count(),0);
    await button('retry').click();assert.equal((await state()).calls[0].intent,'retry');
  });
  await run('guest sign-in request is explicit and cannot claim a restore',async()=>{
    await page.evaluate(()=>window.fixture.render('failure'));await button('sign-in-to-restore').click();assert.equal((await state()).calls[0].intent,'sign-in-to-restore');
  });
  await run('missing preparation and unavailable account save disable their distinct actions',async()=>{
    await page.evaluate(()=>window.fixture.render('failure','unavailable',false));assert.equal(await button('retry').isDisabled(),true);assert.equal(await button('restore').isDisabled(),true);
    await button('retry').evaluate(el=>el.click());await button('restore').evaluate(el=>el.click());assert.equal((await state()).calls.length,0);
  });
  await run('E03 Continue is disabled without its checkpoint',async()=>{
    await page.evaluate(()=>window.fixture.render('E03','available',false));assert.equal(await button('continue').isDisabled(),true);await button('continue').evaluate(el=>el.click());assert.equal((await state()).calls.length,0);
  });
  await run('Restore dispatches a request only; copy warns that unsaved state is replaced',async()=>{
    await page.evaluate(()=>window.fixture.render('failure','available'));assert.match(await page.getByRole('dialog').innerText(),/replaces this in-memory adventure and its unsaved changes/);
    await button('restore').click();assert.equal((await state()).calls[0].intent,'restore');
  });
  await run('plain-text rendering does not interpret authored markup',async()=>{
    await page.evaluate(()=>window.fixture.malicious());assert.equal(await page.locator('[role="dialog"] img, [role="dialog"] script').count(),0);
    assert.equal(await page.evaluate(()=>window.injection),undefined);assert.match(await page.getByRole('heading').innerText(),/<img/);
  });
  await run('Tab and Shift+Tab stay inside the contained dialog',async()=>{
    await button('continue').focus();await page.keyboard.press('Tab');assert.equal((await state()).focus,'Skip scene');
    await page.keyboard.press('Shift+Tab');assert.equal((await state()).focus,'Continue');
  });
  await run('frame-owned Game control remains in the keyboard cycle',async()=>{
    await page.getByRole('dialog').evaluate(el=>{const b=document.createElement('button');b.type='button';b.textContent='Game';el.querySelector('h2').after(b)});
    await button('continue').focus();await page.keyboard.press('Tab');assert.equal((await state()).focus,'Game');
    await page.keyboard.press('Shift+Tab');assert.equal((await state()).focus,'Continue');
  });
  await run('closing from application returns focus; retired same-view callbacks stay inert',async()=>{
    const s=await page.evaluate(()=>{const f=window.fixture;f.save();f.hide();f.clickSaved('continue');return f.state()});assert.equal(s.focus,'Ending');assert.equal(s.calls.length,0);
  });
  await run('desktop result remains inside the supplied adventure frame',async()=>{
    const rects=await page.evaluate(()=>{const frame=document.querySelector('#frame').getBoundingClientRect(),panel=document.querySelector('[role="dialog"]').getBoundingClientRect();return{frame:{left:frame.left,right:frame.right,top:frame.top,bottom:frame.bottom},panel:{left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom}}});
    assert.ok(rects.panel.left>=rects.frame.left&&rects.panel.right<=rects.frame.right&&rects.panel.top>=rects.frame.top&&rects.panel.bottom<=rects.frame.bottom);
    await mkdir(resolve(screenshot,'..'),{recursive:true});await page.screenshot({path:screenshot.replace('.png','-desktop.png'),fullPage:true});
  });
  await run('390px at 200 percent text contains all text/actions and recovery remains reachable',async()=>{
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.querySelector('#frame').style.fontSize='200%';window.fixture.render('failure')});
    const sizes=await page.evaluate(()=>{const e=document.querySelector('[role="dialog"]');return{page:document.documentElement.scrollWidth,width:innerWidth,client:e.clientWidth,scroll:e.scrollWidth}});
    assert.ok(sizes.page<=sizes.width);assert.ok(sizes.scroll<=sizes.client);await button('retry').scrollIntoViewIfNeeded();
    await mkdir(resolve(screenshot,'..'),{recursive:true});await page.screenshot({path:screenshot,fullPage:true});await button('retry').click();assert.equal((await state()).calls[0].intent,'retry');
  });
}catch(error){report.results.push({name:'harness',status:'FAIL',error:String(error)});}
finally{await browser?.close();await server.close();await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({passed:report.results.filter(r=>r.status==='PASS').length,failed:report.results.filter(r=>r.status==='FAIL').length,pageErrors:report.pageErrors}));
if(report.results.some(r=>r.status==='FAIL')||report.pageErrors.length)process.exitCode=1;
