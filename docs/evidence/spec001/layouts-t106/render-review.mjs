// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0.
// Static evidence-page rendering only. Does not start or control the game/Safari.
import { firefox } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = new URL('./', import.meta.url);
const browser = await firefox.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1500 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('review.html', root).href);
  const sectionCount = await page.locator('section[id]').count();
  await page.addStyleTag({ content: `body{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:12px}
    body> :not(section),section:not([id]){display:none}section{margin:0;padding:6px;border:1px solid #546772}
    section> :not(h2):not(.study){display:none}h2{font-size:18px;line-height:1.2;margin:5px 0 10px}` });
  await page.screenshot({ path: fileURLToPath(new URL('diagram-contact-sheet.png', root)), fullPage: true });
  const file = await readFile(new URL('review.html', root));
  const image = await readFile(new URL('diagram-contact-sheet.png', root));
  await writeFile(new URL('diagram-render.json', root), JSON.stringify({
    scope: 'Actual headless Firefox rendering of static layout diagrams only; no game/native-source/image-generation/owner acceptance',
    browser: 'Firefox ' + browser.version(), sectionCount, errors,
    htmlSha256: createHash('sha256').update(file).digest('hex'),
    imageSha256: createHash('sha256').update(image).digest('hex'),
    screenshot: 'docs/evidence/spec001/layouts-t106/diagram-contact-sheet.png',
    acceptedMediaAdded: 0,
  }, null, 2) + '\n');
  console.log(JSON.stringify({ sectionCount, errors, screenshot: 'diagram-contact-sheet.png', scope: 'Static candidate diagram rendering only' }));
} finally {
  await browser.close();
}
