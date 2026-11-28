// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { RUNTIME_MODULE_ID } from 'rolldown';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const packages = new Set();
const helpers = new Set();
const result = await build({ root, logLevel: 'silent', build: { write: false } });
const chunks = (Array.isArray(result) ? result : [result]).flatMap(output => output.output);
for (const chunk of chunks) {
  assert.doesNotMatch(chunk.fileName, /\.(?:woff2?|ttf|otf|eot)$/i, 'Review additional font before distribution');
  if (chunk.type === 'asset' && chunk.fileName.endsWith('.css')) {
    assert.doesNotMatch(chunk.source.toString(), /@font-face|@import\b/i, 'Review added font or external CSS');
  }
  if (chunk.type !== 'chunk') continue;
  for (const [id, module] of Object.entries(chunk.modules)) {
    if (!module.renderedLength) continue;
    const dep = id.match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)/);
    if (dep) packages.add(dep[1]);
    else if (id === RUNTIME_MODULE_ID || id.startsWith('\0')) helpers.add(id);
    else assert.ok(id.startsWith(root + 'src/') || id.startsWith(root + 'content/spec001/') || id === root + 'index.html',
      'Unexpected file included in browser JavaScript: ' + id);
  }
}
const notices = await readFile(new URL('../public/credits/notices.txt', import.meta.url), 'utf8');
const expectedPackages = [...notices.matchAll(/^([^\s]+) [^\s]+ · Browser dependency · /gm)].map(m => m[1]).sort();
assert.ok(expectedPackages.length > 0, 'Missing browser license register');
assert.deepEqual([...packages].sort(), expectedPackages, 'Bundle and credited browser packages differ');
assert.deepEqual([...helpers].sort(), [RUNTIME_MODULE_ID, '\0vite/modulepreload-polyfill.js', '\0vite/preload-helper.js'].sort(), 'Review emitted virtual helpers');
for (const name of ['vite', 'rolldown']) {
  assert.match(notices, new RegExp('^' + name + ' [^ ]+ · Emitted build helpers ·', 'm'));
}
console.log('Verified production browser modules: ' + [...packages].sort().join(', ') + '. Vite and Rolldown emit helpers. No font files or font-face rules.');
