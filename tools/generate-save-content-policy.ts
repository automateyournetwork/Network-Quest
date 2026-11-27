// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = 'server/content/save-policy.generated.json';

/** Build-time only. Never opens a listener, loads project Vite config or reads .env files. */
export async function saveContentPolicyArtifact(): Promise<string> {
  const loader = await createServer({ root, configFile: false, envDir: false, appType: 'custom', logLevel: 'silent',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    if (loader.httpServer !== null) throw new Error('Policy loader unexpectedly created an HTTP server');
    const content = await loader.ssrLoadModule('/src/app/content.ts') as typeof import('../src/app/content');
    const bridge = await loader.ssrLoadModule('/src/app/save-policy.ts') as typeof import('../src/app/save-policy');
    const { registry, world } = content.loadIntroductionContent();
    const policy = bridge.introductionSavePolicy(registry, world);
    const paths = [...new Set(['content/spec001/world.json', 'content/spec001/sources.json',
      ...world.documents.map(document => document.path), 'content/schemas/content.schema.json',
      'src/app/content.ts', 'src/app/save-policy.ts', 'src/content/registry.ts', 'src/services/save-validator.ts',
      'src/state/notebook.ts', 'src/content/optional-activities.ts', 'src/state/optional-activities.ts', 'src/state/optional-power-audit.ts', 'src/state/conditions.ts', 'src/state/party.ts', 'src/state/objective-history.ts', 'src/domain/copper.ts', 'docs/evidence/spec001/rule-source-review.md',
      'src/state/objectives.ts', 'src/state/copper-scenario.ts', 'src/state/fiber-scenario.ts', 'src/state/radio-scenario.ts', 'src/state/equipment-scenarios.ts', 'src/state/repair-plan.ts', 'src/state/outcomes.ts',
      'src/domain/optics.ts', 'src/domain/radio.ts', 'src/domain/power.ts', 'src/domain/capabilities.ts', 'src/domain/packet-journey.ts',
      'tools/generate-save-content-policy.ts'])].sort();
    // All paths come from trusted validated project content; no filesystem/account selector.
    const inputs = Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')])));
    return JSON.stringify({ formatVersion: 1, scope: 'authored-spec001-twelve-room-gameplay',
      provenance: { generator: 'tools/generate-save-content-policy.ts', ruleIds: ['PHY03', 'PHY04', 'PHY05', 'PHY06', 'PHY07', 'PHY08', 'PHY09', 'PHY10', 'PHY11', 'STATE01', 'STATE03', 'STATE04'],
        sourceIds: ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13'],
        caseIds: ['T01', 'T02', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12', 'T13', 'T15', 'T16', 'B-COPPER-100', 'B-COPPER-OVER', 'B-OPT-MAX', 'B-OPT-OVER', 'B-OPT-RESERVE', 'B-RADIO-20', 'B-RADIO-BELOW', 'B-RADIO-PATH', 'C-E01', 'B-ENDPOINT'], inputs },
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
