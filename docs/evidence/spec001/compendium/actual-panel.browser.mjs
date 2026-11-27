// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Actual modules in an isolated host. No main application/provider/owner preview/save.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { firefox } from '@playwright/test';

const directory = 'docs/evidence/spec001/compendium/';
const output = process.argv[2] ?? `${directory}actual-panel-first.json`;
const report = { task: 'T095', scope: 'actual compendium module with actual adventure-frame and CSS; isolated injected discovery/evidence, not full application or T094 acceptance', observedAt: new Date().toISOString(), results: [], pageErrors: [], sources: {} };
const files = ['src/ui/compendium.ts', 'src/ui/compendium.css', 'src/ui/notebook.ts', directory+'actual-panel.browser.mjs', 'src/ui/adventure-frame.ts', 'src/styles.css', 'src/ui/app-shell.css', 'src/app/application.css', 'content/spec001/world.json', 'content/spec001/sources.json', 'content/spec001/characters.json'];
const content = new Map();
for (const file of files) { const text = await readFile(file, 'utf8'); content.set(file, text); report.sources[file] = createHash('sha256').update(text).digest('hex'); }
const data = JSON.stringify({ metadata: JSON.parse(content.get('content/spec001/world.json')), characters: JSON.parse(content.get('content/spec001/characters.json')).records, sourceCatalog: JSON.parse(content.get('content/spec001/sources.json')).sources }).replaceAll('<', '\\u003c');
const resources = new Map([
  ['/style.css', ['text/css', ['src/styles.css', 'src/ui/app-shell.css', 'src/app/application.css'].map(file => content.get(file)).join('\n')]],
]);
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>T095 actual compendium panel</title><link rel="stylesheet" href="/style.css"><body><main id="fixture"></main><script type="module">
import {createCompendiumPanel,projectCompendium} from '/src/ui/compendium.ts';
import {createAdventureFrame} from '/src/ui/adventure-frame.ts';
const data=${data}, root=document.querySelector('#fixture');
let panel,frame,shell,view,scope=0,capture,calls=[],saved,open=true;
const element=(tag='div')=>document.createElement(tag);
function reset(){
 panel?.dispose();frame?.dispose();root.replaceChildren();calls=[];scope++;
 const menu=element(),saves=element(),settings=element(),sound=element(),adventure=element();adventure.className='nq-adventure-host';
 const saveSection=element();saveSection.className='nq-save';saveSection.append(element('p'),element('p'));saves.append(saveSection);
 menu.append(element('p'));sound.append(element('p'));
 frame=createAdventureFrame(root,{menu,saves,settings,sound,adventure});
 const section=element('section');section.className='nq-shell';section.innerHTML='<h1>Fiber Gardens</h1><div class="nq-shell-scene"><h2>Scene</h2></div><div class="nq-shell-evidence"></div><div class="nq-shell-captions"></div><div class="nq-shell-status" role="status"></div><div class="nq-shell-presentation-status"></div><div class="nq-shell-controls"><button id="opener">Compendium</button></div>';
 shell={element:section,presentationHost:element(),panelHost:element()};section.append(shell.presentationHost,shell.panelHost);adventure.append(section);frame.attach(shell,element());
 const registry={record:id=>data.characters.find(row=>row.id===id)};
 const game={world:{roomId:'spec001:R05',compendiumIds:['spec001:COMPENDIUM-CH03'],recruits:[],activeAllyIds:[]},notebook:{mapRoomIds:['spec001:R05'],personalNotes:'The laser probably routes packets. <img src=x onerror="window.injection=true">',hypotheses:[{id:'hypothesis',text:'A possibility, not a fact.',status:'supported',subjectIds:[]}]}};
 view=projectCompendium({registry,metadata:data.metadata,game,sourceCatalog:data.sourceCatalog,evidence:[{id:'recorded-reading',heading:'Optical compatibility',sourceRoomId:'spec001:R05',sourceRoom:'Fiber Gardens',kind:'Measurement',text:'Historical match. Configuration 4; attempt 1. Repeat the physical checks after a change.',freshness:'stale'}],navigation:{resolve(){return {ok:false}}},activity:'stable-exploration'});
 capture=makeCapture();open=false;
 panel=createCompendiumPanel(shell.panelHost,{dispatch(action){calls.push(action);if(action.input.kind==='close-panel'){open=false;render()}}});
 document.querySelector('#opener').addEventListener('click',()=>{open=true;render()});
 render();document.querySelector('#opener').focus();
}
function makeCapture(){const original=scope;return input=>({input,scope:original})}
function render(){frame.preparePanels();panel.render(view,open,capture);frame.sync(true)}
window.fixture={reset,open(){open=true;render()},render,save(){saved=panel.element.querySelector('li button')},reinsert(){panel.element.append(saved)},clickSaved(){saved.click()},refresh(){scope++;capture=makeCapture();render()},
 hide(){open=false;render()},dispose(){panel.dispose()},detached(){panel.element.remove()},hiddenHost(){shell.panelHost.hidden=true},inertHost(){shell.panelHost.inert=true},
 malicious(){view.entries[0].name='<img src=x onerror="window.injection=true">';view.entries[0].sources[0].supportedClaim='<script>window.injection=true<'+ '/script>';render()},
 badImage(){view.entries[0].portrait={status:'available',assetId:'synthetic',text:'Exact caption remains',src:'/missing-image.png'};render()},
 state(){return {calls,scope,focus:document.activeElement?.textContent,hidden:panel.element.hidden,text:panel.element.textContent,scroll:panel.element.scrollTop}},
 scale(value){frame.element.style.fontSize=value+'rem'},panel(){return panel.element}};
reset();window.fixture.open();window.ready=true;
</script></body></html>`;
resources.set('/', ['text/html; charset=utf-8', html]);
const server = await createServer({ configFile:false, root:process.cwd(), appType:'custom', envDir:false, envPrefix:[], logLevel:'error', server:{host:'127.0.0.1',port:0,hmr:false} });
server.middlewares.use((request,response,next)=>{
  const path=(request.url??'').split('?')[0],resource=resources.get(path);
  if(resource){response.writeHead(200,{'Content-Type':resource[0],'Cache-Control':'no-store'});response.end(resource[1]);return;}
  if (/^\/src\/[A-Za-z0-9_./-]+\.(?:ts|js|css)$/.test(path) || /^\/content\/spec001\/[A-Za-z0-9_./-]+\.json$/.test(path) || path.startsWith('/node_modules/.vite/')) return next();
  response.writeHead(404,{'Cache-Control':'no-store'}).end();
});
let browser;
try {
  await server.listen();
  browser = await firefox.launch({ headless: true }); report.browser = browser.version();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => report.pageErrors.push(error.message));
  const requested = []; page.on('request', request => requested.push(new URL(request.url()).pathname));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`); await page.waitForFunction(() => window.ready);
  const state = () => page.evaluate(() => window.fixture.state());
  const run = async (name, check) => { await page.evaluate(() => { window.fixture.reset();window.fixture.open(); }); try { await check(); report.results.push({ name, status: 'PASS' }); } catch(error) { report.results.push({ name, status: 'FAIL', error: String(error) }); } };
  await run('contains only discovered identity and planned portrait text; no image request', async () => {
    assert.equal(await page.getByRole('dialog',{name:'Compendium'}).count(),1); assert.equal((await state()).focus,'Compendium');
    assert.match((await state()).text,/Photon the Firefly/); assert.doesNotMatch((await state()).text,/Copperhead/);
    await page.locator('summary').first().click(); assert.match((await state()).text,/Portrait not yet available/);
    assert.equal(await page.locator('.nq-compendium img').count(),0); assert.equal(requested.some(path => /portrait|CH03/.test(path)),false);
  });
  await run('native details keyboard exposes limits, source claim and recruitment without reward', async () => {
    const summary=page.locator('.nq-compendium > div > details > summary').first();await summary.focus();await page.keyboard.press('Enter');
    assert.equal(await summary.evaluate(node=>node.parentElement.open),true);
    assert.match(await page.getByRole('dialog',{name:'Compendium'}).innerText(),/Light transmission is not delivery of electrical power/);
    await page.getByText('Technical sources and scope',{exact:true}).focus();await page.keyboard.press('Enter');
    assert.match(await page.getByRole('dialog',{name:'Compendium'}).innerText(),/ITU-T X.200/);assert.deepEqual((await state()).calls,[]);
    const links=await page.locator('.nq-compendium a').evaluateAll(links=>links.map(link=>({target:link.target,rel:link.rel,href:link.href})));
    assert.ok(links.length>0);assert.ok(links.every(link=>link.target==='_blank'&&link.rel==='noopener noreferrer'&&link.href.startsWith('https://')));
  });
  await run('evidence source dispatch is only the existing captured identity; stale text remains', async () => {
    await page.getByRole('button',{name:'Open notebook source: Optical compatibility'}).focus();await page.keyboard.press('Enter');
    const s=await state();assert.deepEqual(s.calls,[{input:{kind:'inspect-evidence',evidenceId:'recorded-reading'},scope:s.scope}]);
    assert.match(s.text,/Freshness: stale/);assert.match(s.text,/Configuration 4; attempt 1/);assert.match(s.text,/measurements/);
  });
  await run('notes and supported hypotheses remain player writing; authored markup stays text', async () => {
    await page.evaluate(()=>window.fixture.malicious());await page.getByText('Your notes and hypotheses',{exact:true}).click();
    const text=await page.getByRole('dialog',{name:'Compendium'}).innerText();assert.match(text,/not established observations/);assert.match(text,/Player hypothesis · supported/);
    assert.equal(await page.locator('.nq-compendium img, .nq-compendium script').count(),0);assert.equal(await page.evaluate(()=>window.injection),undefined);
  });
  await run('same projection preserves details, native focus and scroll on status redraw', async () => {
    await page.locator('.nq-compendium > div > details > summary').first().click();await page.getByRole('button',{name:'Open notebook source: Optical compatibility'}).focus();
    const before=await state();await page.evaluate(()=>window.fixture.render());const after=await state();assert.equal(after.focus,before.focus);assert.equal(after.scroll,before.scroll);
    assert.equal(await page.locator('.nq-compendium > div > details').first().evaluate(node=>node.open),true);
  });
  await run('retired source button cannot use a new projection even if reinserted', async () => {
    await page.evaluate(()=>{const f=window.fixture;f.save();f.refresh();f.reinsert();f.clickSaved()});assert.deepEqual((await state()).calls,[]);
  });
  await run('replacement source control retains focus and scroll, and dispatches only its fresh scope', async () => {
    await page.locator('.nq-compendium > div > details > summary').first().click();
    await page.getByRole('button',{name:'Open notebook source: Optical compatibility'}).focus();const before=await state();
    await page.evaluate(()=>window.fixture.refresh());const refreshed=await state();assert.equal(refreshed.focus,before.focus);assert.equal(refreshed.scroll,before.scroll);
    await page.keyboard.press('Enter');const s=await state();assert.deepEqual(s.calls,[{input:{kind:'inspect-evidence',evidenceId:'recorded-reading'},scope:s.scope}]);
  });
  for(const action of ['hide','dispose','detached','hiddenHost','inertHost']) await run(`${action} blocks delayed source controls`,async()=>{
    await page.evaluate(action=>{const f=window.fixture;f.save();f[action]();f.clickSaved()},action);assert.deepEqual((await state()).calls,[]);
  });
  await run('Escape closes to the original opener; modified Escape does not close', async () => {
    await page.getByRole('button',{name:'Open notebook source: Optical compatibility'}).focus();await page.keyboard.press('Shift+Escape');assert.equal((await state()).hidden,false);
    await page.keyboard.press('Escape');assert.equal((await state()).hidden,true);assert.equal(await page.locator('#opener').evaluate(node=>document.activeElement===node),true);
  });
  await run('actual frame contains Tab cycle including the Game control',async()=>{
    await page.getByRole('button',{name:'Open notebook source: Optical compatibility'}).focus();await page.keyboard.press('Tab');assert.equal((await state()).focus,'Your notes and hypotheses');
    await page.keyboard.press('Tab');assert.equal((await state()).focus,'Close compendium');
  });
  await run('a failed synthetic portrait decode leaves its exact readable caption', async () => {
    await page.evaluate(()=>window.fixture.badImage());await page.locator('.nq-compendium > div > details > summary').first().click();
    await page.waitForFunction(()=>window.fixture.state().text.includes('Portrait unavailable. Exact caption remains'));
    assert.equal(await page.locator('.nq-compendium img').count(),0);
  });
  for(const width of [1280,390]) await run(`${width}px at 200 percent text keeps readable contained controls`,async()=>{
    await page.setViewportSize({width,height:900});await page.evaluate(()=>window.fixture.scale(2));
    const heading=await page.getByRole('heading',{name:'Compendium',exact:true}).evaluate(node=>{
      const rect=node.getBoundingClientRect(), hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
      return {top:rect.top,bottom:rect.bottom,unobscured:node.contains(hit)};
    });
    assert.ok(heading.top>=0&&heading.bottom<=900&&heading.unobscured);
    await page.screenshot({path:`${directory}actual-panel-${width}-200-initial.png`});
    await page.locator('.nq-compendium > div > details > summary').first().click();await page.getByRole('button',{name:'Open notebook source: Optical compatibility'}).focus();
    const sizes=await page.getByRole('dialog',{name:'Compendium'}).evaluate(node=>({x:node.getBoundingClientRect().x,right:node.getBoundingClientRect().right,width:node.clientWidth,scrollWidth:node.scrollWidth,fontSize:getComputedStyle(node).fontSize,focus:node.contains(document.activeElement),scroll:node.scrollTop}));
    assert.ok(sizes.x>=0);assert.ok(sizes.right<=width);assert.ok(sizes.scrollWidth<=sizes.width+1);assert.equal(sizes.fontSize,'32px');assert.equal(sizes.focus,true);
    report.results.push({name:`${width}px geometry`,status:'OBSERVED',sizes});
    await page.screenshot({path:`${directory}actual-panel-${width}-200.png`});
    const controls=await page.locator('.nq-compendium > .nq-panel-game, .nq-compendium > .nq-sticky-close').evaluateAll(nodes=>nodes.map(node=>({position:getComputedStyle(node).position,float:getComputedStyle(node).float})));
    assert.ok(controls.length===2&&controls.every(control=>control.position==='static'&&control.float==='none'));
    await page.getByText('Technical sources and scope',{exact:true}).click();await page.getByText('Your notes and hypotheses',{exact:true}).click();
    const reading=await page.getByRole('dialog',{name:'Compendium'}).evaluate(dialog=>{
      const checked=[],errors=[];
      for(const node of dialog.querySelectorAll('h2,h3,h4,p,li,summary,a,button,figcaption')){
        if(!node.getClientRects().length||node.closest('details:not([open])')&&node.tagName!=='SUMMARY')continue;
        const texts=[];const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let text;while(text=walker.nextNode())if(text.textContent.trim())texts.push(text);
        if(!texts.length)continue;
        for(const edge of ['first','last']){
          const text=edge==='first'?texts[0]:texts.at(-1),range=document.createRange();
          const start=edge==='first'?text.textContent.search(/\S/):text.textContent.trimEnd().length-1;
          range.setStart(text,start);range.setEnd(text,start+1);
          const before=range.getBoundingClientRect(),bounds=dialog.getBoundingClientRect();
          dialog.scrollTop+=before.top-(bounds.top+Math.min(120,bounds.height/3));
          const rect=range.getBoundingClientRect(),x=rect.x+rect.width/2,y=rect.y+rect.height/2,hit=document.elementFromPoint(x,y);
          const good=x>=bounds.left&&x<bounds.right&&y>bounds.top&&y<bounds.bottom&&!!hit&&node.contains(hit);
          const result={text:node.textContent.trim().slice(0,95),edge,good};checked.push(result);if(!good)errors.push(result);
        }
      }
      return {checked:checked.length,errors};
    });
    assert.ok(reading.checked>30);assert.deepEqual(reading.errors,[]);report.results.push({name:`${width}px first/last text glyphs`,status:'OBSERVED',reading});
    await page.screenshot({path:`${directory}actual-panel-${width}-200-last-passage.png`});
  });
  assert.deepEqual(report.pageErrors,[]);
} catch(error) { report.error=String(error); }
finally { await browser?.close();await server.close();await writeFile(output,JSON.stringify(report,null,2)+'\n'); }
console.log(JSON.stringify({output,pass:report.results.filter(result=>result.status==='PASS').length,fail:report.results.filter(result=>result.status==='FAIL').length,error:report.error}));
if(report.error||report.results.some(result=>result.status==='FAIL'))process.exitCode=1;
