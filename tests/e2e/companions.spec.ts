// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// T104 native guest journey. No game-state, party, measurements or verdict injection.
import { expect, firefox, test, type Page } from '@playwright/test';
import { preview } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { clickButton, closeFrame, openFrame } from './support/adventure-controls';
import { createT104RunDirectory, captureT104SourceHashes } from './support/t104-run-artifacts';

const root = process.cwd();
const run = 'native';
const q = (id: string) => `spec001:${id}`;
const roster = Array.from({ length: 25 }, (_, index) => `CH${String(index + 1).padStart(2, '0')}`);
const recruitRoster = ['CH03','CH04','CH05','CH06','CH07','CH16','CH19','CH20','CH22'];
const json = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8'));

test('T104 actual all-room companion discovery, earned progression and conventional equivalents', async () => {
  test.setTimeout(900_000);
  const evidence = await createT104RunDirectory('companions');
  const report: any = { task: 'T104', stage: 'current-canonical-companion-journey', executionCommit: null,
    observedAt: new Date().toISOString(), sourceRoot: 'current working directory', sourceMeaning: 'Actual working-tree and built-output hashes; no immutable commit claim. Guest static preview only, no API/session proof.',
    results: [], discoveries: [], lessons: [], equivalents: [], errors: [], prohibitedRequests: [], sources: {} };
  report.harnessSha256=createHash('sha256').update(await readFile(resolve('tests/e2e/companions.spec.ts'))).digest('hex');
  report.sources = await captureT104SourceHashes('companions', true);
  const world = await json('content/spec001/world.json'), characters = (await json('content/spec001/characters.json')).records;
  const names = new Map<string,string>(world.characters.map((c: any) => [c.id, c.name]));
  const name = (id: string) => names.get(q(id))!;
  const actions = new Map<string,string>();
  for (const file of ['copper','fiber','radio','equipment']) for (const record of (await json(`content/spec001/dialogue/${file}-actions.json`)).records)
    for (const node of record.nodes) for (const choice of node.choices) actions.set(choice.id,choice.text);
  const server = await preview({ root, configFile: resolve(root,'vite.config.ts'), preview: { host: '127.0.0.1', port: 0, strictPort: true }, logLevel:'error' });
  const address = server.httpServer.address(); if (!address || typeof address === 'string') throw new Error('Expected owned ephemeral preview');
  const browser = await firefox.launch({headless:true}); report.browser = browser.version();
  const context = await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const page = await context.newPage(); page.setDefaultTimeout(12_000);
  page.on('pageerror', error=>report.errors.push(error.message));
  const origin = `http://127.0.0.1:${address.port}`;
  page.on('request', request=>{const url=new URL(request.url()); if (url.pathname.includes('/api/') || request.method() !== 'GET' || /^https?:$/.test(url.protocol) && url.origin !== origin)
    report.prohibitedRequests.push({path:url.pathname,method:request.method(),external:url.origin !== origin});});
  const ui = controls(page), discovered = new Set(['CH01']);
  const checked = (check: string, details?: unknown) => { report.results.push({check,status:'PASS',...(details ? {details} : {})}); console.log(`PASS ${check}`); };
  const inspectEntry = async (id: string) => {
    const entry=ui.compendium().locator('details').filter({has:page.locator(':scope > summary').filter({hasText:`${name(id)} ·`})}).first();
    const summary=entry.locator(':scope > summary'); await summary.click();
    for(const label of ['Technology:','Ability:','Realm and dependencies:','Recruitment:','Progression:']) await expect(entry).toContainText(label);
    await entry.getByText('Technical sources and scope',{exact:true}).click();
    const links=await entry.locator('a').evaluateAll(nodes=>nodes.map(node=>({href:node.getAttribute('href'),target:node.getAttribute('target'),rel:node.getAttribute('rel')})));
    expect(links.length).toBeGreaterThan(0); expect(links.every(link=>link.href?.startsWith('https://') && link.target==='_blank' && link.rel==='noopener noreferrer')).toBe(true);
    await expect(entry.getByRole('list',{name:'Limitations',exact:true})).not.toBeEmpty();
    const binding = characters.find((character: { id: string }) => character.id === q(id)).compendium.portraitBinding;
    const image = entry.locator('figure img');
    if (binding) {
      const expectedPath = '/arcade/play/network-quest/' + binding.exportPath.slice('public/'.length);
      await expect(image).toHaveAttribute('src', expectedPath);
      await expect(image).toHaveAttribute('alt', binding.caption);
      await expect(entry.locator('figcaption')).toHaveText(binding.caption);
      const decoded = await image.evaluate(async (element: HTMLImageElement) => {
        await element.decode();
        return { width: element.naturalWidth, height: element.naturalHeight };
      });
      expect(decoded.width).toBeGreaterThan(0);
      expect(decoded.height).toBeGreaterThan(0);
      report.discoveries.push({id, name:name(id), sourceLinks:links, portrait:{ assetId:binding.assetId, path:expectedPath, caption:binding.caption, ...decoded }});
    } else {
      await expect(entry).toContainText('Portrait not yet available.');
      await expect(image).toHaveCount(0);
      report.discoveries.push({id, name:name(id), sourceLinks:links, portrait:'not yet available'});
    }
    await summary.click();
  };
  const discover = async (roomId: string) => {
    const room=await json(`content/spec001/rooms/${roomId}.json`);
    for(const actor of room.hotspots.filter((h:any)=>/^spec001:CH\d{2}$/.test(h.subjectId))) {
      const id=actor.subjectId.slice(8); if(discovered.has(id))continue;
      await ui.click('Compendium'); await expect(ui.compendium().locator('summary').filter({hasText:`${name(id)} ·`})).toHaveCount(0); await ui.click('Close compendium');
      await ui.click('Look'); await ui.click(actor.label); discovered.add(id);
      await ui.click('Compendium'); await expect(ui.compendium()).toContainText(`${discovered.size} discovered · ${25-discovered.size} undiscovered.`); await inspectEntry(id); await ui.click('Close compendium');
    }
    checked(`${roomId} actual actor discovery and scoped entries`);
  };
  const invite = async(id:string) => {await ui.click('Party');await ui.party().getByRole('button',{name:`Invite ${name(id)}`,exact:true}).press('Enter');
    await expect(ui.row(name(id))).toContainText('Level 1');await expect(ui.row(name(id))).toContainText('Resting');await ui.click('Close party');};
  const active = new Set<string>();
  const activate = async(id:string) => {await ui.click('Party');if(!active.has(id)){if(active.size===2){const rest=[...active][0]!;await ui.click(`Replace ${name(rest)} with ${name(id)}`);active.delete(rest);}else await ui.click(`Activate ${name(id)}`);active.add(id);}
    await expect(ui.party()).toContainText(`(${active.size}/2).`);await ui.click('Close party');};
  const begin = async(id:string)=>{await ui.click('Party');await ui.click(`Begin practice with ${name(id)}`);await expect(ui.party().getByRole('button',{name:`Review lesson with ${name(id)}`,exact:true})).toBeDisabled();await ui.click('Close party');};
  const review = async(id:string)=>{await ui.click('Party');await ui.party().getByRole('button',{name:`Review lesson with ${name(id)}`,exact:true}).press('Enter');await expect(ui.row(name(id))).toContainText('Level 2');report.lessons.push({id,level:2,explanation:await ui.row(name(id)).innerText()});await ui.click('Close party');checked(`${id} distinct post-recruit lesson earns level 2`);};
  const act = async(id:string)=>{await ui.click('Use');await ui.click(actions.get(q(`ACTION-${id}`))!);};
  const ability = async(id:string,level:1|2,actionId:string)=>{await activate(id);await ui.click('Party');const a=characters.find((c:any)=>c.id===q(id)).abilities[level-1];
    const label=actions.get(q(`ACTION-${actionId}`))??'Measure the current bench configuration';await ui.row(name(id)).getByRole('button',{name:`${a.name}: ${label}`,exact:true}).press('Enter');await ui.click('Close party');};
  const equivalent = async(id:string,level:1|2,actionId:string,expected:string[],applyConventional?:()=>Promise<void>,abilityMeasures=false)=>{
    await activate(id);if(applyConventional)await applyConventional();const conventional=await ui.measure(false,expected);
    await ability(id,level,actionId);const allied=abilityMeasures?await ui.latest(expected):await ui.measure(false,expected);
    expect(allied).toEqual(conventional);report.equivalents.push({id,level,actionId:q(`ACTION-${actionId}`),readings:allied});checked(`${id} level ${level} ability equals conventional physical reading`);
  };
  const connection = async(wrong:boolean)=>{await act('fiber-restore-original');await act(wrong?'fiber-profile-wrong-wavelength':'fiber-profile-matched');await act('fiber-inspect-before');await act('fiber-clean');await act('fiber-reinspect-clean');};
  const opticalEquivalent = async(id:string,level:1|2,variant:string,prepared:boolean)=>{
    await activate(id);await act('fiber-restore-original');await act(variant);await act('fiber-inspect-before');await act('fiber-clean');await act('fiber-reinspect-clean');const expected=[`Preparation complete: ${prepared?1:0} count`],ordinary=await ui.measure(false,expected);
    await act('fiber-restore-original');await ability(id,level,variant);await act('fiber-inspect-before');await act('fiber-clean');await act('fiber-reinspect-clean');const allied=await ui.measure(false,expected);expect(allied).toEqual(ordinary);report.equivalents.push({id,level,actionId:q(`ACTION-${variant}`),readings:allied});checked(`${id} level ${level} optical ability equals conventional controlled intervention`);
  };
  try {
    await page.goto(`${origin}/arcade/play/network-quest/`);await ui.click('New Adventure');await ui.click('Compendium');await expect(ui.compendium()).toContainText('1 discovered · 24 undiscovered.');await inspectEntry('CH01');await ui.click('Close compendium');
    await discover('R01');await ui.click('Party');await expect(ui.party().getByRole('button',{name:'Invite Photon the Firefly',exact:true})).toBeDisabled();await expect(ui.party()).toContainText('Active allies: none (0/2).');await ui.click('Close party');
    await ui.click('Look');await ui.click('Look at power indication');await ui.click('Look at link indication');await ui.click('Talk');await ui.click('Talk to Photon the Firefly');await ui.click('Skip dialogue');await ui.click('Use');await ui.click('Inspect physical path');
    await ui.walk("The Titan's Workshop");await discover('R02');await ui.click('Talk');await ui.click('Talk to the Titan');await ui.click('Skip dialogue');await ui.click('Look');await ui.click('Identify known-good endpoints');await ui.click('Identify physical path under test');
    await ui.click('Notebook');await page.getByRole('textbox',{name:'Hypothesis',exact:true}).fill('Compare fresh physical evidence before and after one controlled intervention.');await ui.click('Pin hypothesis');await page.getByRole('textbox',{name:'Personal notes',exact:true}).fill('T104 learner note: a confident guess is not measured evidence.');await ui.click('Close notebook');await ui.click('Continue as guest');checked('actual introduction; guest memory and explicit non-evidence hypothesis');

    await ui.walk('The Copper Warrens');await discover('R03');await act('copper-read-compatibility');await act('copper-read-defect');await ui.measure(false,['Open required conductors: 1 count']);await act('copper-replace-section');await ui.measure(true);
    await ui.walk('The Echo Cavern');await discover('R04');await act('copper-read-before');await act('copper-read-repeater');await act('copper-repeater-requires-continuity');await ui.measure(true);await invite('CH20');await activate('CH20');
    await equivalent('CH20',1,'O04-conventional-continuity-tool',['Repeater role distinguished: 1 count'],undefined,true);
    await begin('CH20');await act('copper-repeater-bridges-open');await ui.measure(false,['Repeater role distinguished: 0 count']);await act('copper-repeater-requires-continuity');await ui.measure(false,['Repeater role distinguished: 1 count']);await review('CH20');
    await equivalent('CH20',2,'copper-repeater-bridges-open',['Repeater role distinguished: 0 count'],()=>act('copper-repeater-bridges-open'));await act('copper-repeater-requires-continuity');
    await ui.walk('The Copper Warrens');await invite('CH04');await activate('CH04');await begin('CH04');await act('copper-restore-original');await ui.walk('The Echo Cavern');await ui.measure(false,['Open required conductors: 1 count']);await ui.walk('The Copper Warrens');await act('copper-replace-section');await ui.walk('The Echo Cavern');await ui.measure(false,['Open required conductors: 0 count']);await review('CH04');
    await equivalent('CH04',1,'O04-conventional-continuity-tool',['Open required conductors: 0 count'],undefined,true);await equivalent('CH04',2,'O04-conventional-continuity-tool',['Open required conductors: 0 count'],undefined,true);
    await ui.walk('The Copper Warrens');await ui.walk("The Titan's Workshop");

    await ui.walk('The Photon Gardens');await discover('R05');await act('fiber-read-matching');await connection(false);await ui.measure(true,['Preparation complete: 1 count']);await invite('CH03');await activate('CH03');
    await opticalEquivalent('CH03',1,'fiber-profile-matched',true);await begin('CH03');await connection(true);await ui.measure(false,['Preparation complete: 0 count']);await connection(false);await ui.measure(false,['Preparation complete: 1 count']);await review('CH03');
    await act('fiber-restore-original');await ability('CH03',2,'fiber-profile-wrong-wavelength');await act('fiber-inspect-before');await act('fiber-clean');await act('fiber-reinspect-clean');const photonWrong=await ui.measure(false,['Preparation complete: 0 count']);await connection(true);expect(await ui.measure(false,['Preparation complete: 0 count'])).toEqual(photonWrong);report.equivalents.push({id:'CH03',level:2,actionId:q('ACTION-fiber-profile-wrong-wavelength'),readings:photonWrong});checked('CH03 advanced mismatch equals conventional mismatch');await connection(false);
    await ui.walk('The Prism Vault');await discover('R06');await invite('CH16');await act('fiber-read-compatibility');await act('fiber-path-A');await ui.measure(true,['Receive power: -11 dBm','Sensitivity reserve: 3 dB']);
    await ui.walk('The Photon Gardens');await invite('CH05');await invite('CH06');await activate('CH16');
    await opticalEquivalent('CH16',1,'fiber-profile-matched',true);await begin('CH16');await connection(true);await ui.measure(false,['Preparation complete: 0 count']);await connection(false);await ui.measure(false,['Preparation complete: 1 count']);await review('CH16');
    await act('fiber-restore-original');await ability('CH16',2,'fiber-profile-unsupported-host');await act('fiber-inspect-before');await act('fiber-clean');await act('fiber-reinspect-clean');const hermitWrong=await ui.measure(false,['Preparation complete: 0 count']);await act('fiber-restore-original');await act('fiber-profile-unsupported-host');await act('fiber-inspect-before');await act('fiber-clean');await act('fiber-reinspect-clean');expect(await ui.measure(false,['Preparation complete: 0 count'])).toEqual(hermitWrong);report.equivalents.push({id:'CH16',level:2,actionId:q('ACTION-fiber-profile-unsupported-host'),readings:hermitWrong});checked('CH16 advanced host mismatch equals conventional mismatch');await connection(false);
    await activate('CH05');await begin('CH05');await ui.walk('The Prism Vault');await act('fiber-path-high-loss');await ui.measure(false,['Receive power: -13 dBm','Sensitivity reserve: 1 dB']);await act('fiber-path-A');await ui.measure(false,['Receive power: -11 dBm','Sensitivity reserve: 3 dB']);await review('CH05');
    await equivalent('CH05',1,'O06-passive-path-A',['Receive power: -11 dBm'],undefined,true);await equivalent('CH05',2,'fiber-path-high-loss',['Receive power: -13 dBm','Sensitivity reserve: 1 dB'],()=>act('fiber-path-high-loss'));await act('fiber-path-B');
    await activate('CH06');await begin('CH06');await ui.measure(false,['Receive power: -12 dBm','Sensitivity reserve: 2 dB']);await review('CH06');await ui.click('Party');await expect(ui.row(name('CH06'))).toContainText('Multiple propagation modes do not create guaranteed independent payload lanes');await ui.click('Close party');
    await equivalent('CH06',1,'O06-passive-path-B',['Receive power: -12 dBm'],undefined,true);await equivalent('CH06',2,'O06-passive-path-B',['Receive power: -12 dBm'],undefined,true);
    await ui.walk('The Photon Gardens');await ui.walk("The Titan's Workshop",'Walk to The Titan’s Workshop');

    await ui.walk('The Skywell');await discover('R07');await act('radio-read-path');await act('radio-read-settings');await act('radio-alternate-path');await act('radio-match-settings');await ui.measure(true);
    await ui.walk('The Storm Observatory');await discover('R08');await act('radio-read-survey');await act('radio-mitigate-emitter');await act('radio-channel-A');await ui.measure(true,['Signal-to-noise ratio: 25 dB']);await ui.walk('The Skywell');await invite('CH07');await activate('CH07');await begin('CH07');await ui.walk('The Storm Observatory');
    await act('radio-raise-noise');await ui.measure(false,['Received noise: -78 dBm','Signal-to-noise ratio: 13 dB']);await act('radio-mitigate-emitter');await ui.measure(false,['Received noise: -90 dBm','Signal-to-noise ratio: 25 dB']);await review('CH07');
    await equivalent('CH07',1,'O08-scenario-channel-A',['Signal-to-noise ratio: 25 dB'],undefined,true);await equivalent('CH07',2,'radio-raise-noise',['Signal-to-noise ratio: 13 dB'],()=>act('radio-raise-noise'));await act('radio-mitigate-emitter');
    await ui.walk('The Skywell');await ui.walk("The Titan's Workshop");await ui.walk('The Shell Market');await discover('R09');await act('market-read-checklist');await act('equipment-mode-100-full');await act('market-compatible-kit-B');await ui.measure(true,['Total delivered demand: 30 W']);await invite('CH19');await activate('CH19');
    await equivalent('CH19',1,'O09-compatible-kit-B',['Total delivered demand: 30 W'],undefined,true);await begin('CH19');await act('market-original-over-budget');await ui.measure(false,['Delivered excess: 3 W']);await act('market-compatible-kit-B');await ui.measure(false,['Delivered headroom: 0 W']);await review('CH19');
    await equivalent('CH19',2,'market-original-over-budget',['Delivered excess: 3 W'],()=>act('market-original-over-budget'));await act('market-compatible-kit-B');
    await ui.walk("The Titan's Workshop");await ui.walk('The Clockworks');await discover('R10');await invite('CH22');await activate('CH22');await begin('CH22');await ui.walk("The Titan's Workshop");await ui.walk('The Shell Market');
    await act('equipment-mode-1000-full');await ui.measure(false,['Common mode supported: 0 count']);await act('equipment-mode-100-full');await ui.measure(false,['Common mode supported: 1 count']);await review('CH22');
    await equivalent('CH22',1,'equipment-mode-100-full',['Common mode supported: 1 count'],()=>act('equipment-mode-100-full'));await equivalent('CH22',2,'equipment-mode-1000-full',['Common mode supported: 0 count'],()=>act('equipment-mode-1000-full'));await act('equipment-mode-100-full');
    const inventoryText=async()=>{await ui.click('Inventory');const text=await page.getByRole('dialog',{name:'Inventory',exact:true}).getByRole('list',{name:'Inventory items',exact:true}).innerText();await ui.click('Close Inventory');return text;};
    const beforeSwap=await inventoryText();await ui.measure(false,['Common mode supported: 1 count']);await activate('CH03');await ui.click('Diagnostics');const prior=page.getByRole('dialog',{name:'Diagnostics',exact:true}).locator('ol[aria-label="Recorded measurements"] > li').last();await expect(prior).toContainText('Stale reading');await expect(prior.getByRole('button',{name:'Submit this reading',exact:true})).toBeDisabled();await ui.click('Close diagnostics');expect(await inventoryText()).toEqual(beforeSwap);checked('preparation replacement preserves inventory and makes prior measurements stale');
    await ui.click('Party');await expect(ui.party().locator('h3').filter({hasText:'Level 2'})).toHaveCount(9);await expect(ui.party()).toContainText('(2/2).');const detached=await ui.party().getByRole('button',{name:`Rest ${name('CH22')}`,exact:true}).elementHandle();await ui.click('Close party');await detached!.evaluate(button=>(button as HTMLButtonElement).click());await ui.click('Party');await expect(ui.row(name('CH22'))).toContainText('Active ally');await ui.click('Close party');checked('all nine earned level 2; max-two free replacements and retained hidden control rejected');

    await ui.walk("The Titan's Workshop");await ui.walk('The Clockworks');await ui.click('Use');await ui.click('Read and record the physical-role and upper-layer explanation');await ui.click('Use untimed step-by-step decoding');await ui.click('Explain: sample physical signals representing bits; this does not discover addresses');
    for(const [position,pair] of ['00','10','11','01'].entries()){await ui.click(`Inspect sample position ${position}`);await ui.click(`Write ${pair} for sample position ${position}`);}await ui.measure(true,['Represented bits: 8 bit']);await ui.walk('The Backhoe Rift','Walk toward The Backhoe Rift');await discover('R11');expect([...discovered].sort()).toEqual(roster);checked('all 25 authored entries reached through actual encounters');
    await ui.click('Compendium');await expect(ui.compendium()).toContainText('25 discovered · 0 undiscovered.');const cross=ui.compendium().getByRole('list',{name:'Evidence across rooms',exact:true});await expect(cross).toContainText('Source: The Photon Gardens');await expect(cross).toContainText('Freshness: stale');await expect(cross).toContainText('Directions do not move you or refresh a reading');await ui.compendium().getByText('Your notes and hypotheses',{exact:true}).click();await expect(ui.compendium()).toContainText('your writing, not established observations');await expect(ui.compendium()).toContainText('T104 learner note:');const source=cross.getByRole('button').first();await source.press('Enter');await expect(page.getByRole('dialog',{name:'Notebook',exact:true})).toBeVisible();await expect(page.locator('.nq-game-location')).toHaveText('The Backhoe Rift');await ui.click('Close notebook');checked('cross-room facts retain source/freshness; source navigation leaves position unchanged; notes remain distinct');
    await openFrame(page,'Sound and reading');await page.getByRole('slider',{name:'Text size',exact:true}).focus();await page.keyboard.press('End');await closeFrame(page);
    for(const width of [1280,768,390]) for(const panelName of ['Party','Compendium'] as const){await page.setViewportSize({width,height:900});await ui.click(panelName);const panel=panelName==='Party'?ui.party():ui.compendium();const geometry=await panel.evaluate(node=>({font:getComputedStyle(node).fontSize,width:node.clientWidth,scroll:node.scrollWidth,x:node.getBoundingClientRect().x,right:node.getBoundingClientRect().right}));expect(geometry.font).toBe('32px');expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);expect(geometry.x).toBeGreaterThanOrEqual(0);expect(geometry.right).toBeLessThanOrEqual(width);const target=panel.getByRole('button',{name:`Close ${panelName.toLowerCase()}`,exact:true});await target.focus();const focus=await target.evaluate(node=>{const r=node.getBoundingClientRect();return{top:r.top,bottom:r.bottom,visible:node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});expect(focus.visible).toBe(true);expect(focus.top).toBeGreaterThanOrEqual(0);expect(focus.bottom).toBeLessThanOrEqual(900);await page.screenshot({path:resolve(evidence,`${run}-${panelName.toLowerCase()}-${width}-200.png`)});await page.keyboard.press('Escape');await expect(panel).toBeHidden();await expect(page.getByRole('button',{name:panelName,exact:true})).toBeFocused();checked(`${panelName} ${width}px 200% text fits and retains keyboard focus`,{geometry,focus});}
    await page.setViewportSize({width:1280,height:900});for(const panel of ['Party','Compendium']){await ui.click(panel);const violations=(await new AxeBuilder({page}).include(`[aria-label="${panel}"]`).analyze()).violations;expect(violations).toEqual([]);await ui.click(`Close ${panel.toLowerCase()}`);checked(`${panel} native axe scan`);}
    await openFrame(page,'Sound and reading');await page.getByRole('slider',{name:'Text size',exact:true}).focus();await page.keyboard.press('Home');await closeFrame(page);
    await ui.click('Repair plan');await ui.click('Copper replacement — 95 m');await ui.click('Permanent installation');await ui.click('Read and keep plan requirements');await ui.click('Review current plan');await page.getByRole('checkbox',{name:'I understand that execution changes the route and makes earlier readings stale',exact:true}).check();await ui.click('Execute reviewed plan');await ui.click('Close repair controls');await ui.walk('The Iron Threshold','Walk to the validation balcony');await ui.click('Validate repair');await ui.click('Read classification criteria');await ui.click('Measure repaired link');await ui.click('Run endpoint test');await ui.click('Classify permanent restoration');await expect(page.getByRole('dialog',{name:'The Steady Light',exact:true})).toContainText('Permanent restoration');await page.screenshot({path:resolve(evidence,`${run}-earned-party-ending.png`)});checked('earned party accompanies an actual conventional copper repair and independent endpoint validation at R12');
    expect(report.lessons.map((r:any)=>r.id).sort()).toEqual(recruitRoster.slice().sort());expect(report.equivalents).toHaveLength(18);expect(report.errors).toEqual([]);expect(report.prohibitedRequests).toEqual([]);
    expect(await captureT104SourceHashes('companions', true)).toEqual(report.sources);
    report.status='PASS';checked('current source and built output remained unchanged; no browser errors, API writes or external requests');
  } catch(error) {report.status='FAIL';report.error=String(error);report.lastText=(await page.locator('body').innerText()).slice(-15000);await page.screenshot({path:resolve(evidence,`${run}-failure.png`)});throw error;
  } finally {await writeFile(resolve(evidence,`${run}.json`),JSON.stringify(report,null,2)+'\n');await context.close();await browser.close();await new Promise<void>(resolve=>server.httpServer.close(()=>resolve()));}
});

function controls(page:Page){
  const party=()=>page.getByRole('dialog',{name:'Party',exact:true}),compendium=()=>page.getByRole('dialog',{name:'Compendium',exact:true}),diag=()=>page.getByRole('dialog',{name:'Diagnostics',exact:true});
  const click=async(name:string)=>{if(['Party','Compendium','Diagnostics','Repair plan','Validate repair'].includes(name))await closeFrame(page);await clickButton(page,name);};
  const capture=async(expected:string[])=>{const latest=diag().locator('ol[aria-label="Recorded measurements"] > li').last();for(const text of expected)await expect(latest).toContainText(text);const reading=await latest.locator(':scope > p').innerText();expect(reading).toMatch(/^Current reading: .+:/);return reading.replace(/^Current reading: /,'').split('; ');};
  return{click,party,compendium,row:(name:string)=>party().locator('section').filter({has:page.getByRole('heading',{name:new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')} ·`)})}),
    walk:async(name:string,label=`Walk to ${name}`)=>{await click('Walk');await click(label);await expect(page.locator('.nq-game-location')).toHaveText(name);},
    latest:async(expected:string[])=>{await click('Diagnostics');const result=await capture(expected);await click('Close diagnostics');return result;},
    measure:async(submit:boolean,expected:string[]=[])=>{await click('Diagnostics');await click('Take measurement');const result=await capture(expected);if(submit){await diag().locator('ol[aria-label="Recorded measurements"] > li').last().getByRole('button',{name:'Submit this reading',exact:true}).click();await expect(diag()).toContainText('Objective complete.');}await click('Close diagnostics');return result;},
  };
}
