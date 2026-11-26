// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Independent T072 contract cases. ALL bytes and testimony here are SYNTHETIC;
// no fixture certifies actual Blender files, human review or production acceptance.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateAssetManifest } from '../../tools/validate-assets.ts';
import type { AssetEvidenceRecord, AssetEvidenceSnapshot } from '../../tools/asset-types.ts';

const assetId = 'spec001:ASSET-ARCH-R01';
const root = 'assets-src/test-synthetic/T072';
const proofRoot = 'docs/evidence/test-synthetic/T072';
const zeroCounts = { characterModels: 0, props: 0, interactiveProps: 0, roomsWithImageSet: 0, sceneLayers: 0, portraits: 0, illustrations: 0, music: 0, ambience: 0, effects: 0, voices: 0 };
const reviewer = 'SYNTHETIC reviewer; no actual person or review';
const environment = 'SYNTHETIC isolated fixture, never real asset acceptance';
const date = '2026-11-26';
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
type Fixture = {
  // Corrupt fixture inputs intentionally need not obey the production Asset type.
  manifest: { schemaVersion: number; episodeId: string; assets: Record<string, any>[] };
  evidence: { files: Record<string, Uint8Array>; records: Record<string, AssetEvidenceRecord>; content: AssetEvidenceSnapshot['content'] };
};
function baseline(): Fixture {
  const fixture: Fixture = { manifest: { schemaVersion: 1, episodeId: 'spec001', assets: [] }, evidence: { files: {}, records: {}, content: { entities: [{ id: 'spec001:R01', kind: 'room' }, { id: 'spec001:PR001', kind: 'prop' }, { id: 'spec001:ACTION-ENTER', kind: 'action' }], uses: [] } } };
  const file = (path: string, format: string) => {
    const bytes = new TextEncoder().encode(`SYNTHETIC T072 fixture bytes: ${path}\n`);
    fixture.evidence.files[path] = bytes;
    return { path, sha256: digest(bytes), bytes: bytes.byteLength, format };
  };
  const source = file(`${root}/R01.blend`, 'blend');
  const output = file('public/assets/test-synthetic/T072-architecture.glb', 'glb');
  const settings = file(`${root}/settings.json`, 'json');
  const script = file(`${root}/model.py`, 'py');
  const notice = file(`${root}/NOTICE.txt`, 'txt');
  const hashes = [source.sha256, output.sha256];
  const record = (name: string, type: AssetEvidenceRecord['type'], details: Record<string, unknown>, recordHashes = hashes, check?: string) => {
    const path = `${proofRoot}/${name}.json`;
    const value: AssetEvidenceRecord = { type, assetId, hashes: recordHashes, status: 'passed', actor: type === 'production' ? 'tool' : 'agent', reviewer, date, environment, ...(check ? { check } : {}), details };
    fixture.evidence.records[path] = value;
    fixture.evidence.files[path] = new TextEncoder().encode(JSON.stringify(value));
    return path;
  };
  const production = { method: 'modeled', tool: 'Blender', version: '5.2.1', modelRevision: 'not-applicable', eventId: 'synthetic-t072-model', settingsPath: settings.path, promptOrScriptPath: script.path, referenceHashes: [], outputHashes: [source.sha256], notes: 'SYNTHETIC modeled event only; no real application invocation' };
  record('production', 'production', { ...production, promptSha256: script.sha256, settingsSha256: settings.sha256 }, [source.sha256]);
  record('rights', 'rights', { licenseIds: ['CC-BY-4.0'], noticeHashes: [notice.sha256], termsHashes: [], permissionHashes: [], referenceHashes: [], permitsCommercialReuse: true, permitsRedistribution: true, permitsModification: true }, hashes, 'rights');
  const verification = ['structure', 'source-reopen', 'visual', 'browser-comparison', 'rights', 'budget'].map(check => {
    const findings = `SYNTHETIC ${check} observation only; no real media accepted`;
    const path = `${proofRoot}/${check}.json`;
    if (check !== 'rights') record(check, 'review', { methods: [check === 'visual' ? 'image-inspection' : check === 'browser-comparison' ? 'browser-inspection' : check], findings, tool: 'SYNTHETIC inspector', observedPaths: [source.path, output.path] }, hashes, check);
    return { check, status: 'passed', reviewer, date, hashes, environment, evidencePath: path, findings };
  });
  const binding = { assetId, contentId: 'spec001:R01', use: 'room-architecture', exportPath: output.path, interactiveOrEvidence: false };
  fixture.evidence.content.uses.push(binding);
  const usage = record('usage', 'usage', { bindings: [binding], visible: true, meaningful: true }, [output.sha256]);
  fixture.manifest.assets.push({
    assetId, semanticIdentity: 'spec001:R01', kind: 'room-model', status: 'accepted', countsTowardQuota: false, interactiveOrEvidence: false, variantOf: null, derivedFrom: [],
    sources: [{ file: source, role: 'native', application: 'Blender', version: '5.2.1', reopenEvidencePath: `${proofRoot}/source-reopen.json` }],
    exports: [{ file: output, mimeType: 'model/gltf-binary', sourceHashes: [source.sha256], tool: 'SYNTHETIC Blender exporter', preset: 'SYNTHETIC fixture only', integrationEvidencePath: `${proofRoot}/browser-comparison.json` }],
    production: [production], rights: { reviewStatus: 'accepted', creators: ['SYNTHETIC creator'], licenseIds: ['CC-BY-4.0'], noticePaths: [notice.path], sourceUrls: [], termsSnapshotPaths: [], inputPermissionPaths: [], aiDisclosure: 'SYNTHETIC fixture; no actual rights claim' },
    usedBy: [{ contentId: 'spec001:R01', use: 'room-architecture', evidencePath: usage }], verification,
    model: { blendSourcePath: source.path, objectIds: ['ARCH-wall', 'ARCH-floor'], units: 'metres', axes: 'Y-up', pivot: 'room-origin', collisionProxy: 'ARCH-collision', animationClips: [], triangles: 120, textureBytes: 0 },
  });
  return fixture;
}
function mutateRecord(fixture: Fixture, name: string, mutate: (record: AssetEvidenceRecord) => void) {
  const path = `${proofRoot}/${name}.json`;
  mutate(fixture.evidence.records[path]!);
  fixture.evidence.files[path] = new TextEncoder().encode(JSON.stringify(fixture.evidence.records[path]));
}
const negativeCases: { name: string; code: string; mutate: (fixture: Fixture, asset: Record<string, any>) => void }[] = [
  { name: 'accepted room needs model metadata', code: 'SCHEMA_INVALID', mutate: (_, a) => { delete a['model']; } },
  { name: 'room cannot declare a quota contribution', code: 'ROOM_MODEL_QUOTA', mutate: (_, a) => { a['countsTowardQuota'] = true; } },
  { name: 'prop identity cannot stand in for a room', code: 'SCHEMA_INVALID', mutate: (_, a) => { a['semanticIdentity'] = 'spec001:PR001'; } },
  { name: 'room-qualified identity must actually resolve to room kind', code: 'IDENTITY_KIND_MISMATCH', mutate: f => { f.evidence.content.entities[0]!.kind = 'prop'; } },
  { name: 'room identity must resolve', code: 'IDENTITY_UNRESOLVED', mutate: (_, a) => { a['semanticIdentity'] = 'spec001:R99'; } },
  { name: 'native Blender source required', code: 'BLENDER_SOURCE_REQUIRED', mutate: (_, a) => { a['sources'][0].role = 'script'; } },
  { name: 'another application is not Blender source', code: 'BLENDER_SOURCE_REQUIRED', mutate: (_, a) => { a['sources'][0].application = 'SYNTHETIC other editor'; } },
  { name: 'model must link its native source', code: 'NATIVE_SOURCE_LINK', mutate: (_, a) => { a['model'].blendSourcePath = `${root}/different.blend`; } },
  { name: 'room object identities required', code: 'MODEL_OBJECTS_MISSING', mutate: (_, a) => { a['model'].objectIds = []; } },
  { name: 'effect use cannot stand in for architecture', code: 'USE_KIND_MISMATCH', mutate: (_, a) => { a['usedBy'][0].use = 'effect'; } },
  { name: 'architecture cannot target an action', code: 'USE_KIND_MISMATCH', mutate: (_, a) => { a['usedBy'][0].contentId = 'spec001:ACTION-ENTER'; } },
  { name: 'accepted room needs an actual binding', code: 'RUNTIME_USE_MISSING', mutate: f => { f.evidence.content.uses = []; } },
  { name: 'native source bytes must match', code: 'FILE_HASH_MISMATCH', mutate: f => { f.evidence.files[`${root}/R01.blend`] = new TextEncoder().encode('SYNTHETIC corrupted source'); } },
  { name: 'export must derive from recorded source', code: 'EXPORT_SOURCE_HASH', mutate: (_, a) => { a['exports'][0].sourceHashes = ['0'.repeat(64)]; } },
  { name: 'missing reopening proof fails', code: 'REVIEW_EVIDENCE_MISSING', mutate: f => { delete f.evidence.files[`${proofRoot}/source-reopen.json`]; } },
  { name: 'failed source reopening fails', code: 'REVIEW_NOT_PASSED', mutate: f => mutateRecord(f, 'source-reopen', r => { r.status = 'failed'; }) },
  { name: 'review must cover current file hashes', code: 'REVIEW_HASH_MISMATCH', mutate: f => mutateRecord(f, 'visual', r => { r.hashes = []; }) },
  { name: 'review record must match its independent JSON bytes', code: 'EVIDENCE_BYTES_MISMATCH', mutate: f => { f.evidence.records[`${proofRoot}/visual.json`]!.details['findings'] = 'SYNTHETIC unbound edit'; } },
  { name: 'visual review must identify observed paths', code: 'REVIEW_OBSERVATION_REQUIRED', mutate: f => mutateRecord(f, 'visual', r => { r.details['observedPaths'] = []; }) },
  { name: 'rights must permit commercial reuse', code: 'RIGHTS_INCOMPATIBLE', mutate: f => mutateRecord(f, 'rights', r => { r.details['permitsCommercialReuse'] = false; }) },
  { name: 'missing rights proof fails', code: 'RIGHTS_EVIDENCE_MISSING', mutate: f => { delete f.evidence.records[`${proofRoot}/rights.json`]; } },
  { name: 'accepted room needs all model reviews', code: 'REVIEW_REQUIRED', mutate: (_, a) => { a['verification'] = a['verification'].filter((v: { check: string }) => v.check !== 'browser-comparison'); } },
];

describe('T072 independent nonquota room-model contract (SYNTHETIC)', () => {
  it('accepts a fully evidenced room model with no clips and zero impact on every quota', () => {
    const fixture = baseline(), before = structuredClone(fixture);
    expect(fixture.manifest.assets[0]!['model'].animationClips).toEqual([]);
    expect(validateAssetManifest(fixture.manifest, fixture.evidence, { mode: 'inventory' })).toEqual({ valid: true, issues: [], counts: zeroCounts });
    expect(fixture).toEqual(before);
  });
  it('binds each synthetic external record to independent JSON bytes', () => {
    const fixture = baseline();
    for (const [path, value] of Object.entries(fixture.evidence.records)) expect(JSON.parse(new TextDecoder().decode(fixture.evidence.files[path]))).toEqual(value);
    for (const bytes of Object.values(fixture.evidence.files)) expect(new TextDecoder().decode(bytes)).toContain('SYNTHETIC');
  });
  for (const test of negativeCases) it(test.name, () => {
    const fixture = baseline(); test.mutate(fixture, fixture.manifest.assets[0]!);
    const result = validateAssetManifest(fixture.manifest, fixture.evidence, { mode: 'inventory' });
    expect(result.valid).toBe(false);
    expect(result.issues.map(issue => issue.code), JSON.stringify(result)).toContain(test.code);
    expect(result.counts).toEqual(zeroCounts);
  });
  it('does not satisfy release character/prop/layer minima or distribution', () => {
    const fixture = baseline(), result = validateAssetManifest(fixture.manifest, fixture.evidence, { mode: 'release' });
    expect(result.valid).toBe(false); expect(result.counts).toEqual(zeroCounts);
    expect(result.issues.filter(issue => issue.code === 'QUOTA_MINIMUM').map(issue => issue.path)).toEqual(['characterModels', 'props', 'interactiveProps', 'roomsWithImageSet', 'sceneLayers', 'portraits', 'illustrations', 'music', 'ambience', 'effects', 'voices']);
    expect(result.issues).toContainEqual({ code: 'ROOM_IMAGE_SET_INCOMPLETE' });
    expect(result.issues).toContainEqual({ code: 'REQUIRED_IDENTITY_MISSING', path: 'spec001:PR001' });
    expect(result.issues).toContainEqual({ code: 'REQUIRED_IDENTITY_MISSING', path: 'spec001:CH01' });
  });
});
