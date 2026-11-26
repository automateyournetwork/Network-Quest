// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import type { SavePolicyRules } from '../src/services/save-validator';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = 'server/content/save-policy.generated.json';

/**
 * Reviewed current authored rules, not the synthetic validator fixture. Kit quantity is
 * explicit in items-introduction.json (ITEM-inspection-kit, canonical EFFECT-kit once).
 * PHY04 readings/conclusions mirror notebook.ts/evaluateCopper and T006 S03/model cases
 * T01/T02/B-COPPER-100/B-COPPER-OVER. They check representation, not regrade history.
 * Current content has no authored shutdown/encounter marker; none is invented here.
 * Only actual authored anchors can grant a safe state. Metadata R03–R12 stays reserved.
 */
const rules: SavePolicyRules = {
  itemMaxQuantities: { 'spec001:ITEM-inspection-kit': 1 },
  measurementRules: { 'spec001:PHY04': {
    readings: { 'Channel length': 'm', 'Inclusive maximum': 'm', Excess: 'm', Headroom: 'm' },
    conclusionCodes: ['length-exceeded', 'length-within-profile'],
  } },
  unsafeFlags: {},
};

/** Build-time only. Never opens a listener, loads project Vite config or reads .env files. */
export async function saveContentPolicyArtifact(): Promise<string> {
  const loader = await createServer({ root, configFile: false, envDir: false, appType: 'custom', logLevel: 'silent',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    if (loader.httpServer !== null) throw new Error('Policy loader unexpectedly created an HTTP server');
    const content = await loader.ssrLoadModule('/src/app/content.ts') as typeof import('../src/app/content');
    const bridge = await loader.ssrLoadModule('/src/services/save-validator.ts') as typeof import('../src/services/save-validator');
    const { registry, world } = content.loadIntroductionContent();
    const policy = bridge.createSaveContentPolicy(registry, world, rules);
    const paths = [...new Set(['content/spec001/world.json', 'content/spec001/sources.json',
      ...world.documents.map(document => document.path), 'content/schemas/content.schema.json',
      'src/app/content.ts', 'src/content/registry.ts', 'src/services/save-validator.ts',
      'src/state/notebook.ts', 'src/domain/copper.ts', 'docs/evidence/spec001/rule-source-review.md',
      'tools/generate-save-content-policy.ts'])].sort();
    // All paths come from trusted validated project content; no filesystem/account selector.
    const inputs = Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')])));
    return JSON.stringify({ formatVersion: 1, scope: 'authored-introduction',
      provenance: { generator: 'tools/generate-save-content-policy.ts', ruleIds: ['PHY04'], sourceIds: ['S03'],
        caseIds: ['T01', 'T02', 'B-COPPER-100', 'B-COPPER-OVER'], inputs },
      policies: [policy] }, null, 2) + '\n';
  } finally { await loader.close(); }
}

async function main(): Promise<void> {
  if (process.argv.slice(2).some(argument => argument !== '--generate')) throw new Error('Use no arguments to check, or --generate to regenerate');
  const artifact = await saveContentPolicyArtifact();
  if (process.argv.includes('--generate')) {
    await mkdir(dirname(resolve(root, output)), { recursive: true });
    await writeFile(resolve(root, output), artifact);
  } else if (await readFile(resolve(root, output), 'utf8') !== artifact) throw new Error(`${output} is stale; run node tools/generate-save-content-policy.ts --generate`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : 'Save content policy generation failed'}\n`); process.exitCode = 1; });
}
