// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Independent small audit/adapter cases. All temporary bytes/review testimony
// are explicitly synthetic; this suite creates no production media acceptance.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, symlink, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { assetAllocations } from '../../tools/asset-allocations.ts';
import { AssetFileReader, auditAssetRepository, extractAuthoredAssetContent, publicAssetPath } from '../../tools/asset-files.ts';
import { validateAssetManifest } from '../../tools/validate-assets.ts';
import { emptyCounts } from '../../tools/asset-types.ts';
import type { Asset, AssetEvidenceRecord, AssetEvidenceSnapshot, AssetManifest } from '../../tools/asset-types.ts';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const temporary: string[] = [];
afterEach(async () => { for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true }); });
async function sandbox() { const path = await mkdtemp(resolve(tmpdir(), 'nq-asset-audit-')); temporary.push(path); return path; }
async function put(root: string, path: string, data: string) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), data); }
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const emptyEvidence = (): AssetEvidenceSnapshot => ({ files: {}, records: {}, content: { entities: [], uses: [] } });
const planned = (id = 'one'): Asset => ({ assetId: `spec001:ASSET-${id}`, semanticIdentity: `spec001:${id}`, kind: 'illustration', status: 'planned', countsTowardQuota: false, interactiveOrEvidence: false, variantOf: null, derivedFrom: [], sources: [], exports: [], production: [], rights: { reviewStatus: 'pending', creators: [], licenseIds: [], noticePaths: [], sourceUrls: [], termsSnapshotPaths: [], inputPermissionPaths: [], aiDisclosure: '' }, usedBy: [], verification: [] });
const manifest = (...assets: Asset[]): AssetManifest => ({ schemaVersion: 1, episodeId: 'spec001', assets });

/** A small internally consistent image audit fixture with independent bytes and
 * testimony. Expected results below are specified directly, never computed. */
function images() {
  const files: Record<string, Uint8Array> = {}, records: Record<string, AssetEvidenceRecord> = {};
  const input: AssetManifest = manifest(), evidence: AssetEvidenceSnapshot = { files, records, content: { entities: [{ id: 'spec001:R01', kind: 'room' }], uses: [] } };
  const file = (path: string, format: string, text = `SYNTHETIC adapter audit only: ${path}`) => { const bytes = new TextEncoder().encode(text); files[path] = bytes; return { path, format, sha256: hash(bytes), bytes: bytes.length }; };
  const record = (path: string, value: AssetEvidenceRecord) => { records[path] = value; files[path] = new TextEncoder().encode(JSON.stringify(value)); };
  for (const [id, role] of [['parent', 'background'], ['child', 'foreground']] as const) {
    const a = planned(id), native = file(`assets-src/images/${id}/native.png`, 'png'), raw = id === 'parent' ? file(`assets-src/images/${id}/raw.png`, 'png') : input.assets[0]!.sources[1]!.file;
    const out = file(`public/assets/images/${id}.webp`, 'webp'), prompt = file(`assets-src/images/${id}/prompt.txt`, 'txt'), settings = file(`assets-src/images/${id}/settings.json`, 'json', '{}');
    const notice = file(`assets-src/images/${id}/NOTICE.txt`, 'txt'), terms = file(`assets-src/images/${id}/terms.txt`, 'txt'), permission = file(`assets-src/images/${id}/permission.txt`, 'txt');
    const root = `docs/evidence/spec001/assets/${id}`, hashes = [native.sha256, raw.sha256, out.sha256];
    const proof = (name: string, type: AssetEvidenceRecord['type'], details: Record<string, unknown>, bound = hashes, check?: string) => {
      const path = `${root}/${name}.json`;
      record(path, { type, assetId: a.assetId, hashes: bound, status: 'passed', actor: type === 'production' ? 'tool' : 'agent', reviewer: 'SYNTHETIC audit observer', date: '2026-11-26', environment: 'SYNTHETIC test only', details, ...(check ? { check } : {}) });
      return path;
    };
    Object.assign(a, { kind: 'scene-layer', status: 'accepted', countsTowardQuota: true, derivedFrom: id === 'parent' ? [] : [input.assets[0]!.assetId], sources: [{ file: native, role: 'native', application: 'Image editor', version: '1', reopenEvidencePath: `${root}/source-reopen.json` }, { file: raw, role: 'raw-generation', application: 'OpenAI image generation', version: 'unknown/not-exposed' }], exports: [{ file: out, mimeType: 'image/webp', sourceHashes: [native.sha256, raw.sha256], tool: 'SYNTHETIC exporter', preset: 'audit-only', integrationEvidencePath: `${root}/browser-comparison.json` }], image: { width: 100, height: 100, colorSpace: 'sRGB', alpha: id === 'child', cameraRecordPath: file(`assets-src/images/${id}/camera.json`, 'json', '{}').path, registrationPath: file(`assets-src/images/${id}/registration.json`, 'json', '{}').path, layerRole: role } });
    const production = (method: string, outputs: string[], refs: string[]) => {
      const p = { method, tool: method === 'openai-generated' ? 'OpenAI image generation' : 'Image editor', version: '1', modelRevision: method === 'openai-generated' ? 'unknown/not-exposed' : 'not-applicable', eventId: `${id}-${method}`, settingsPath: settings.path, promptOrScriptPath: prompt.path, referenceHashes: refs, outputHashes: outputs, notes: 'SYNTHETIC production testimony only' };
      a.production.push(p); proof(method, 'production', { ...p, promptSha256: prompt.sha256, settingsSha256: settings.sha256 }, outputs);
    };
    if (id === 'parent') production('openai-generated', [raw.sha256], []);
    production('manual-edit', [native.sha256], [raw.sha256]);
    a.rights = { reviewStatus: 'accepted', creators: ['Synthetic creator'], licenseIds: ['CC-BY-4.0'], noticePaths: [notice.path], sourceUrls: [], termsSnapshotPaths: [terms.path], inputPermissionPaths: [permission.path], aiDisclosure: 'Synthetic audit; no actual generated image or copyright assertion' };
    proof('rights', 'rights', { licenseIds: ['CC-BY-4.0'], noticeHashes: [notice.sha256], termsHashes: [terms.sha256], permissionHashes: [permission.sha256], referenceHashes: id === 'parent' ? [] : [raw.sha256], permitsCommercialReuse: true, permitsRedistribution: true, permitsModification: true }, hashes, 'rights');
    for (const check of ['structure', 'source-reopen', 'visual', 'browser-comparison', 'rights', 'budget']) {
      const findings = 'SYNTHETIC observed layer alignment, readable silhouette and consistent source/export colors.';
      const path = check === 'rights' ? `${root}/rights.json` : proof(check, 'review', { findings, methods: [check === 'visual' ? 'image-inspection' : check === 'browser-comparison' ? 'browser-inspection' : check], tool: 'synthetic-observer', observedPaths: [native.path, raw.path, out.path] }, hashes, check);
      a.verification.push({ check, status: 'passed', reviewer: 'SYNTHETIC audit observer', date: '2026-11-26', environment: 'SYNTHETIC test only', hashes, findings, evidencePath: path });
    }
    const binding = { assetId: a.assetId, contentId: 'spec001:R01', use: role, exportPath: out.path, interactiveOrEvidence: false };
    evidence.content.uses.push(binding);
    a.usedBy.push({ contentId: binding.contentId, use: binding.use, evidencePath: proof('use', 'usage', { visible: true, meaningful: true, bindings: [binding] }, [out.sha256]) });
    input.assets.push(a);
  }
  return { input, evidence, files, records, record };
}

describe('additional asset semantic boundaries', () => {
  it('accepts AI-assisted composition and synthesis with preserved MIDI, native project and master, without inventing model generation', () => {
    const f = images(); f.input.assets.splice(1); f.evidence.content.uses.splice(1);
    let a = f.input.assets[0]!;
    const replacements: [string, string][] = [[a.sources[0]!.file.path, 'assets-src/audio/composition.aup4'], [a.sources[1]!.file.path, 'assets-src/audio/score.mid'], [a.exports[0]!.file.path, 'public/assets/audio/cue.ogg']];
    for (const [old, next] of replacements) {
      f.files[next] = f.files[old]!;
      const change = <T>(v: T): T => JSON.parse(JSON.stringify(v).replaceAll(old, next));
      a = change(a); f.input.assets[0] = a;
      f.evidence.content.uses = change(f.evidence.content.uses);
      for (const [path, record] of Object.entries(f.records)) if (record.assetId === a.assetId) f.record(path, change(record));
    }
    a.kind = 'music'; delete a.image;
    Object.assign(a.sources[0]!, { application: 'Audacity', version: '4.0.0' }); a.sources[0]!.file.format = 'aup4';
    Object.assign(a.sources[1]!, { role: 'script', application: 'MIDI editor' }); a.sources[1]!.file.format = 'mid';
    const masterPath = 'assets-src/audio/master.wav', master = new TextEncoder().encode('SYNTHETIC rendered synthesis master'); f.files[masterPath] = master;
    a.sources.push({ file: { path: masterPath, sha256: hash(master), bytes: master.length, format: 'wav' }, role: 'master', application: 'Audacity', version: '4.0.0' });
    a.exports[0]!.sourceHashes.push(hash(master)); a.exports[0]!.file.format = 'ogg'; a.exports[0]!.mimeType = 'audio/ogg';
    a.audio = { nativeProjectPath: a.sources[0]!.file.path, masterPath, codec: 'vorbis', sampleRate: 48000, channels: 2, durationSeconds: 10, loopStartSample: null, loopEndSample: null, loudnessLufs: -18, peakDbfs: -1, captionId: null };
    Object.assign(a.production[0]!, { method: 'composed', tool: 'AI-assisted MIDI composition', modelRevision: 'not-applicable' });
    Object.assign(a.production[1]!, { method: 'synthesized', tool: 'Local synthesizer', outputHashes: [a.sources[0]!.file.sha256, hash(master)] });
    a.usedBy[0]!.use = 'music'; f.evidence.content.uses[0]!.use = 'music';
    const allHashes = [...a.sources.map(s => s.file.sha256), a.exports[0]!.file.sha256];
    for (const v of a.verification) { v.hashes = allHashes; if (v.check === 'visual') v.check = 'listening'; }
    for (const [path, record] of Object.entries(f.records)) if (record.assetId === a.assetId) {
      if (record.type === 'production') {
        const step = a.production.find(p => p.eventId === record.details['eventId'])!; Object.assign(record.details, step); record.hashes = step.outputHashes;
      } else {
        record.hashes = allHashes;
        if (record.type === 'usage') record.details['bindings'] = f.evidence.content.uses;
        if (record.check === 'visual') { record.check = 'listening'; record.actor = 'human'; record.details['methods'] = ['headphones', 'ordinary-speakers']; }
        if (record.check === 'browser-comparison') record.details['observedPaths'] = [...a.sources.map(s => s.file.path), a.exports[0]!.file.path];
      }
      f.record(path, record);
    }
    const result = validateAssetManifest(f.input, f.evidence, { mode: 'inventory' });
    expect(result, JSON.stringify(result)).toEqual({ valid: true, issues: [], counts: { ...emptyCounts(), music: 1 } });
    expect(a.production.some(p => p.method === 'music-generated')).toBe(false);
    expect(a.sources.some(s => s.role === 'raw-generation')).toBe(false);
  });
  it('accepts genuine preserved parent-input linkage and rejects a borrowed OpenAI parent', () => {
    const f = images(); expect(validateAssetManifest(f.input, f.evidence, { mode: 'inventory' }).valid).toBe(true);
    const child = f.input.assets[1]!; child.production[0]!.referenceHashes = [];
    const path = 'docs/evidence/spec001/assets/child/manual-edit.json', r = f.records[path]!;
    r.details['referenceHashes'] = []; f.record(path, r);
    const result = validateAssetManifest(f.input, f.evidence, { mode: 'inventory' });
    expect(result.issues.map(i => i.code)).toContain('DERIVATION_INPUT_UNBOUND'); expect(result.counts.sceneLayers).toBe(1);
  });
  it('permits honest planned/produced derivatives with pending or failed nonquota review', () => {
    for (const status of ['planned', 'produced']) for (const review of ['pending', 'failed']) {
      const parent = planned('parent'), child = planned('child'); parent.status = status; child.status = status; child.derivedFrom = [parent.assetId];
      child.verification.push({ check: 'visual', status: review, reviewer: 'Not reviewed', date: '2026-11-26', hashes: [], environment: 'Pending production', evidencePath: 'docs/evidence/spec001/assets/pending.json', findings: 'No acceptance asserted' });
      expect(validateAssetManifest(manifest(parent, child), emptyEvidence(), { mode: 'inventory' })).toEqual({ valid: true, issues: [], counts: emptyCounts() });
    }
  });
  it('a pending derivative parent cannot support an accepted child', () => {
    const f = images(); f.input.assets[0]!.status = 'produced'; f.input.assets[0]!.countsTowardQuota = false;
    const result = validateAssetManifest(f.input, f.evidence, { mode: 'inventory' });
    expect(result.issues.map(i => i.code)).toContain('DERIVATION_NOT_ACCEPTED'); expect(result.counts.sceneLayers).toBe(0);
  });
  it('preserved native edit bytes still need their own production output lineage', () => {
    const f = images(); f.input.assets[0]!.production.splice(1);
    expect(validateAssetManifest(f.input, f.evidence, { mode: 'inventory' }).issues.map(i => i.code)).toContain('SOURCE_PRODUCTION_LINEAGE');
  });
  it('one observed interaction suffices when a shared asset also has a decorative placement', () => {
    const f = images(), a = f.input.assets[0]!; a.interactiveOrEvidence = true;
    f.evidence.content.entities.push({ id: 'spec001:R02', kind: 'room' });
    const binding = { ...f.evidence.content.uses[0]!, contentId: 'spec001:R02', interactiveOrEvidence: true };
    f.evidence.content.uses.push(binding);
    const original = f.records[a.usedBy[0]!.evidencePath]!, path = 'docs/evidence/spec001/assets/parent/second-use.json';
    f.record(path, { ...original, details: { visible: true, meaningful: true, bindings: [binding] } });
    a.usedBy.push({ contentId: binding.contentId, use: binding.use, evidencePath: path });
    expect(validateAssetManifest(f.input, f.evidence, { mode: 'inventory' }).valid).toBe(true);
  });
  it.each(['constructor', 'toString', '__proto__'])('does not resolve inherited bytes or testimony at %s', path => {
    const a = planned(); a.sources.push({ file: { path, sha256: 'a'.repeat(64), bytes: 1, format: 'png' }, role: 'native', application: 'Image editor', version: '1' });
    const result = validateAssetManifest(manifest(a), emptyEvidence(), { mode: 'inventory' });
    expect(result.valid).toBe(false); expect(result.issues.map(i => i.code)).toContain('FILE_MISSING');
  });
  it.each([null, {}, { files: {}, records: {}, content: {} }, { files: { bad: 'not bytes' }, records: {}, content: { entities: [], uses: [] } }, { files: {}, records: { bad: { type: 'unknown' } }, content: { entities: [], uses: [] } }])('fails malformed evidence with a structured issue', value => {
    expect(validateAssetManifest(manifest(), value as AssetEvidenceSnapshot, { mode: 'inventory' })).toEqual({ valid: false, issues: [{ code: 'EVIDENCE_INVALID' }], counts: emptyCounts() });
  });
  it('does not evaluate evidence accessors', () => {
    const poisoned = () => Object.defineProperty({}, 'files', { enumerable: true, get() { throw new Error('must never evaluate'); } });
    const entries = [poisoned(), { ...emptyEvidence(), files: poisoned() }, { ...emptyEvidence(), records: { bad: poisoned() } }];
    for (const entry of entries) expect(validateAssetManifest(manifest(), entry as AssetEvidenceSnapshot, { mode: 'inventory' }).issues[0]?.code).toBe('EVIDENCE_INVALID');
  });
  it('rejects cyclic, deep, oversized and accessor-bearing unknown manifests without evaluating getters', () => {
    const cyclic: Record<string, unknown> = {}; cyclic['self'] = cyclic;
    let value: unknown = {}; for (let n = 0; n < 50; n++) value = { nested: value };
    const accessor = Object.defineProperty({}, 'assets', { enumerable: true, get() { throw new Error('must never evaluate'); } });
    for (const input of [cyclic, value, accessor, manifest(...Array.from({ length: 5001 }, (_, i) => planned(String(i))))]) expect(validateAssetManifest(input, emptyEvidence(), { mode: 'inventory' }).issues[0]?.code).toBe('SCHEMA_INVALID');
  });
  it('agent visual review never becomes human listening or owner acceptance', () => {
    const f = images(), a = f.input.assets[0]!, source = a.verification[2]!, path = 'docs/evidence/spec001/assets/parent/owner.json';
    a.verification.push({ ...source, check: 'owner', evidencePath: path });
    f.record(path, { ...f.records[source.evidencePath]!, check: 'owner' });
    expect(validateAssetManifest(f.input, f.evidence, { mode: 'inventory' }).issues.map(i => i.code)).toContain('REVIEW_HUMAN_REQUIRED');
  });
});

describe('bounded rooted asset filesystem adapter', () => {
  it.each(['../private/source.blend', '/tmp/source.blend', 'assets-src/../private/file', 'assets-src/.env', 'assets-src/.local/source', 'assets-src/private/file', 'assets-src/operator-input/file', 'assets-src/test-synthetic/file', 'assets-src/feasibility/smoke.blend', 'public/assets/player.sqlite', 'assets-src/a\\b', 'assets-src//raw.wav', 'https://example.invalid/a', 'assets-src/%2e%2e/secret', 'server/data/secret'])('rejects forbidden path %s before reading', async path => {
    expect(publicAssetPath(path)).toBe(false); const reader = await AssetFileReader.create(await sandbox());
    await expect(reader.read(path)).rejects.toMatchObject({ code: 'PATH_DENIED' });
  });
  it('rejects file and directory symlink escapes and internal aliases', async () => {
    const root = await sandbox(), outside = await sandbox(); await put(outside, 'outside.txt', 'PRIVATE TEST SENTINEL'); await put(root, 'assets-src/good.txt', 'public bytes');
    await symlink(resolve(outside, 'outside.txt'), resolve(root, 'assets-src/link.txt'));
    await symlink(outside, resolve(root, 'assets-src/escape'));
    await symlink(resolve(root, 'assets-src/good.txt'), resolve(root, 'assets-src/internal.txt'));
    const reader = await AssetFileReader.create(root);
    for (const path of ['assets-src/link.txt', 'assets-src/escape/outside.txt', 'assets-src/internal.txt']) await expect(reader.read(path)).rejects.toMatchObject({ code: 'SYMLINK_DENIED' });
  });
  it('rejects oversize before allocation and treats malformed JSON as data', async () => {
    const root = await sandbox(); await put(root, 'assets-src/large.json', ''); await truncate(resolve(root, 'assets-src/large.json'), 4_194_305);
    await put(root, 'assets-src/broken.json', '{"broken":'); const reader = await AssetFileReader.create(root);
    await expect(reader.json('assets-src/large.json')).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
    await expect(reader.json('assets-src/broken.json')).rejects.toMatchObject({ code: 'JSON_INVALID' });
  });
  it('reads exact admitted bytes and cannot use a directory as a file', async () => {
    const root = await sandbox(); await put(root, 'assets-src/source.txt', 'public source'); const reader = await AssetFileReader.create(root);
    expect(new TextDecoder().decode(await reader.read('assets-src/source.txt'))).toBe('public source');
    await expect(reader.read('assets-src')).rejects.toMatchObject({ code: 'PATH_DENIED' });
    await mkdir(resolve(root, 'assets-src/directory'));
    await expect(reader.read('assets-src/directory')).rejects.toMatchObject({ code: 'FILE_TYPE_INVALID' });
  });
  it('requires exact authored export bindings and does not infer them from rosters or manifest-style usedBy', () => {
    const world = { rooms: [{ id: 'spec001:R01' }], props: [{ id: 'spec001:PR001' }] };
    const a = planned(); a.usedBy.push({ contentId: 'spec001:R01', use: 'prop-placement', evidencePath: 'docs/evidence/spec001/assets/use.json' });
    const graybox = { kind: 'room', id: 'spec001:R01', propInstances: [{ assetId: a.assetId, propId: 'spec001:PR001' }], usedBy: a.usedBy };
    expect(extractAuthoredAssetContent(world, [graybox]).uses).toEqual([]);
    const binding = { assetId: a.assetId, contentId: 'spec001:R01', use: 'prop-placement', exportPath: 'public/assets/models/one.glb', interactiveOrEvidence: true };
    expect(extractAuthoredAssetContent(world, [{ ...graybox, bindings: [binding] }]).uses).toEqual([binding]);
  });
  it('actual repository planned inventory passes while release fails with zero accepted counts', async () => {
    expect(await auditAssetRepository(project, 'inventory')).toEqual({ valid: true, issues: [], counts: emptyCounts() });
    const release = await auditAssetRepository(project, 'release'); expect(release.valid).toBe(false); expect(release.counts).toEqual(emptyCounts()); expect(release.issues.map(i => i.code)).toContain('QUOTA_MINIMUM');
  });
  it('CLI emits structured failure without printing arbitrary private bytes', async () => {
    const root = await sandbox(); await put(root, 'assets-src/manifest.json', JSON.stringify(manifest()));
    let output = '';
    try { execFileSync(process.execPath, ['tools/validate-assets.ts', '--root', root, '--manifest', '../private/source'], { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (error) { output = String((error as { stdout: string }).stdout); }
    expect(JSON.parse(output).issues[0].code).toBe('PATH_DENIED'); expect(output).not.toContain('PRIVATE TEST SENTINEL');
  });
  it('external evidence is parsed from actual JSON bytes, never a script or a second normalized sidecar', async () => {
    const root = await sandbox(); await cp(resolve(project, 'content/spec001'), resolve(root, 'content/spec001'), { recursive: true });
    await put(root, 'assets-src/manifest.json', JSON.stringify(manifest()));
    await put(root, 'docs/evidence/spec001/assets/bad.json', JSON.stringify({ type: 'not-a-review', script: 'process.exit(0)' }));
    const result = await auditAssetRepository(root, 'inventory'); expect(result.valid).toBe(false); expect(result.issues.map(i => i.code)).toContain('EVIDENCE_INVALID');
  });
  it('a retrieval record cannot read an arbitrary archive outside the approved roots', async () => {
    const root = await sandbox(); await cp(resolve(project, 'content/spec001'), resolve(root, 'content/spec001'), { recursive: true });
    await put(root, 'assets-src/manifest.json', JSON.stringify(manifest()));
    await put(root, 'docs/evidence/spec001/assets/retrieval.json', JSON.stringify({ type: 'retrieval', assetId: 'spec001:ASSET-one', hashes: [], status: 'passed', actor: 'tool', reviewer: 'Synthetic test', date: '2026-11-26', environment: 'Isolated test', details: { archivePath: '.local/private/secret' } }));
    const result = await auditAssetRepository(root, 'inventory'); expect(result.valid).toBe(false); expect(result.issues.map(i => i.code)).toContain('PATH_DENIED');
  });
});

describe('planned catalog source reconciliation', () => {
  it('preserves exact ordered SPEC character and prop names and all 380 planned identities', async () => {
    const spec = await readFile(resolve(project, 'SPEC.md'), 'utf8');
    const characters = [...spec.matchAll(/^\| (CH\d\d) \| (.*?) \|/gm)].map(m => [m[1], m[2]]);
    const props = [...spec.split('### Prop allocation: 150 distinct assets')[1]!.split('### Imagery')[0]!.matchAll(/^\| (?:R\d\d|Shared) \| \d+ \| (.*?) \|$/gm)].flatMap(m => m[1]!.split('; '));
    expect(assetAllocations.filter(a => a.kind === 'character-model').map(a => [a.semanticIdentity.slice(8), a.name])).toEqual(characters);
    expect(assetAllocations.filter(a => a.kind === 'prop-model').map(a => a.name)).toEqual(props);
    const plannedManifest = JSON.parse(await readFile(resolve(project, 'assets-src/manifest.json'), 'utf8')) as AssetManifest;
    expect(plannedManifest.assets).toHaveLength(380); expect(assetAllocations).toHaveLength(380);
    expect(new Set(assetAllocations.map(a => a.assetId)).size).toBe(380);
    expect(plannedManifest.assets.map(a => a.assetId)).toEqual(assetAllocations.map(a => a.assetId));
    for (const a of plannedManifest.assets) { expect(a.status).toBe('planned'); expect(a.countsTowardQuota).toBe(false); expect(a.sources).toEqual([]); expect(a.exports).toEqual([]); expect(a.usedBy).toEqual([]); expect(a.verification).toEqual([]); expect(a.rights.reviewStatus).toBe('pending'); }
  });
});
