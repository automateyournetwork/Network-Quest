// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { firefox, expect } from '@playwright/test';
import { build, preview } from 'vite';
import { clickButton, closeFrame, openFrame } from '../../../tests/e2e/support/adventure-controls.ts';

const output = 'docs/evidence/spec001/image-production/T122';
const outDir = await mkdtemp(resolve('.local/test-results/T122-reading-'));
const base = '/arcade/play/network-quest/';
await build({logLevel:'silent',build:{outDir}});
const server = await preview({configFile:false,logLevel:'silent',base,build:{outDir},preview:{host:'127.0.0.1',port:0}});
const browser = await firefox.launch();
try {
  const page = await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port+base);
  for (const label of ['New Adventure','Look','Look at link indication','Look at power indication']) await clickButton(page,label);
  await openFrame(page,'Sound and reading');
  await page.getByRole('slider',{name:'Text size',exact:true}).fill('2');
  await closeFrame(page);
  await clickButton(page,'Notebook');
  const panel=page.getByRole('dialog',{name:'Notebook',exact:true});
  const details=panel.locator('details[data-illustration="spec001:ASSET-ILLUSTRATION-01"]');
  await details.locator('summary').press('Enter');
  const image=details.locator('img');
  await image.evaluate(el=>el.decode());
  await image.scrollIntoViewIfNeeded();
  const geometry=await details.evaluate(el=>{
    const panel=el.closest('[role=dialog]'), image=el.querySelector('img'), rect=image.getBoundingClientRect();
    return {font:getComputedStyle(panel).fontSize,panelWidth:panel.clientWidth,panelScrollWidth:panel.scrollWidth,
      imageLeft:rect.left,imageRight:rect.right,displayWidth:rect.width,viewport:innerWidth,alt:image.alt,caption:el.querySelector('figcaption').textContent};
  });
  assert.equal(geometry.font,'32px');
  assert.ok(geometry.panelScrollWidth<=geometry.panelWidth+1 && geometry.imageLeft>=0 && geometry.imageRight<=geometry.viewport && geometry.displayWidth>200);
  await page.screenshot({path:output+'/01-narrow-200.png'});
  await details.locator('figcaption').scrollIntoViewIfNeeded();
  await expect(details.locator('figcaption')).toBeInViewport();
  await writeFile(output+'/narrow-200.json',JSON.stringify({browser:'Firefox '+browser.version(),observedAt:new Date().toISOString(),source:'Actual guest notebook, both observed indicators, normal Sound and reading control at 200%.',geometry},null,2)+'\n');
} finally {await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
