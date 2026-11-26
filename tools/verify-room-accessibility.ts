// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Process-isolated actual Firefox audit. See T066 evidence for the Playwright
// runner process's native SIGSEGV; no axe rule is disabled or filtered here.
import { firefox, devices, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { clickButton, openFrame, closeFrame } from '../tests/e2e/support/adventure-controls.ts';
import { localTls } from '../tests/e2e/support/local-tls.ts';

const output = resolve(process.argv[2] ?? '.local/t066-accessibility');
await mkdir(output, {recursive:true});
const local = await localTls();
let context: BrowserContext | undefined;
let cleaning: Promise<void> | null = null;
const cleanup = () => cleaning ??= (async () => { try { await context?.close(); } finally { await local.stop(); } })();
process.once('SIGTERM', () => { void cleanup().finally(() => process.exit(143)); });
try {
  context = await firefox.launchPersistentContext(local.profile, {...devices['Desktop Firefox'],headless:true,ignoreHTTPSErrors:false,reducedMotion:'reduce',hasTouch:true});
  const page = await context.newPage(), errors:string[] = [], apiMutations:string[] = [], externalRequests:string[] = [];
  context.on('request', request => { const url = new URL(request.url()); if (/^https?:$/.test(url.protocol) && url.origin !== new URL(local.url).origin) externalRequests.push(url.origin); if (url.pathname.includes('/api/') && !['GET','HEAD','OPTIONS'].includes(request.method())) apiMutations.push(`${request.method()} ${url.pathname}`); });
  page.on('pageerror',error=>errors.push(error.message));
  const button = (name:string)=>page.getByRole('button',{name,exact:true});
  await page.setViewportSize({width:1440,height:900}); await page.goto(local.url); await button('New Adventure').click();
  const scene=page.locator('.nq-room'); await scene.locator('[data-safe-position]').waitFor({state:'attached'}); await scene.waitFor();
  await page.setViewportSize({width:390,height:844}); await button('Look').tap();
  await scene.locator('[data-graybox-object="spec001:HOTSPOT-power"]').tap();
  assert.match(await page.locator('.nq-shell-evidence').innerText(),/Power indication/);
  assert.equal(await scene.locator('button,a,input,[tabindex]').count(),0);
  await page.screenshot({path:resolve(output,'t066-390px.png'),fullPage:true});
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await clickButton(page,'Link indication'); assert.match(await page.locator('.nq-shell-evidence').innerText(),/Link indication/);
  await page.screenshot({path:resolve(output,'t066-200percent.png'),fullPage:true});
  await scene.locator('.nq-room-stage').screenshot({path:resolve(output,'t066-200percent-stage.png')});
  await closeFrame(page);
  const renders=await scene.getAttribute('data-render-count'); await page.waitForTimeout(150); assert.equal(await scene.getAttribute('data-render-count'),renders);
  const result=await new AxeBuilder({page}).analyze();
  assert.deepEqual(result.violations,[]); assert.deepEqual(errors,[]);
  // Audit the expanded media controls as well, retaining all default rules.
  await openFrame(page,'Sound and reading');
  const media=await new AxeBuilder({page}).analyze(); assert.deepEqual(media.violations,[]);
  await closeFrame(page); await clickButton(page,'Notebook'); const notebook=await new AxeBuilder({page}).analyze(); assert.deepEqual(notebook.violations,[]); await clickButton(page,'Close notebook');
  await clickButton(page,'Inventory'); const inventory=await new AxeBuilder({page}).analyze(); assert.deepEqual(inventory.violations,[]); await clickButton(page,'Close Inventory');
  await clickButton(page,'Save'); const save=await new AxeBuilder({page}).analyze(); assert.deepEqual(save.violations,[]);
  assert.deepEqual(errors,[]); assert.deepEqual(apiMutations,[]); assert.deepEqual(externalRequests,[]);
  const report={date:new Date().toISOString(),browser:context.browser()?.version(),userAgent:await page.evaluate(()=>navigator.userAgent),viewport:page.viewportSize(),zoom:'200% root text',reducedMotion:'reduce',hasTouch:true,tls:'isolated trusted CA; ignoreHTTPSErrors false',scope:'Actual app, two observed evidence entries, same full default axe rules; process isolated from Playwright test-runner native crash',axeVersion:result.testEngine.version,passes:result.passes.map(p=>p.id),incomplete:result.incomplete.map(i=>({id:i.id,impact:i.impact,nodes:i.nodes.map(n=>n.target)})),violations:result.violations,expandedMediaPasses:media.passes.map(p=>p.id),expandedMediaIncomplete:media.incomplete.map(i=>({id:i.id,impact:i.impact,nodes:i.nodes.map(n=>n.target)})),expandedMediaViolations:media.violations,notebookViolations:notebook.violations,inventoryViolations:inventory.violations,saveViolations:save.violations,errors,apiMutations,externalRequests};
  await writeFile(resolve(output,'t066-accessibility.json'),JSON.stringify(report,null,2)+'\n');
  process.stdout.write(JSON.stringify({valid:true,passes:result.passes.length,expandedMediaPasses:media.passes.length,violations:0})+'\n');
} finally { await cleanup(); }
