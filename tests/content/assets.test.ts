// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// T060 independent oracle. All media bytes and testimony below are SYNTHETIC.
// These fixtures cannot establish actual Blender, OpenAI, listening or release acceptance.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

type Counts = {
  characterModels: number; props: number; interactiveProps: number; roomsWithImageSet: number;
  sceneLayers: number; portraits: number; illustrations: number; music: number;
  ambience: number; effects: number; voices: number;
};
type Entity = { id: string; kind: string; speakerId?: string; text?: string };
type Usage = { assetId: string; contentId: string; use: string; exportPath: string; interactiveOrEvidence: boolean };
/** Normalized, externally recorded observations; manifest fields are not their own evidence.
 * T061's repository adapter must load/hash evidence files and observed content separately.
 * A successful audit checks consistency of testimony, never performs a human audition.
 */
export type AssetEvidenceRecord = {
  type: 'review' | 'production' | 'rights' | 'usage' | 'retrieval';
  assetId: string; hashes: string[]; status: 'passed' | 'pending' | 'failed';
  actor: 'human' | 'agent' | 'tool'; reviewer: string; date: string; environment: string;
  check?: string; details: Record<string, unknown>;
};
export type AssetEvidenceSnapshot = {
  files: Readonly<Record<string, Uint8Array>>;
  records: Readonly<Record<string, AssetEvidenceRecord>>;
  content: { entities: Entity[]; uses: Usage[] };
};
export type AssetValidationResult = {
  valid: boolean;
  issues: { code: string; assetId?: string; path?: string }[];
  counts: Counts;
};
export type ValidateAssetManifest = (
  manifest: unknown, evidence: AssetEvidenceSnapshot, options: { mode: 'inventory' | 'release' },
) => AssetValidationResult;

// This deliberately permissive *fixture authoring* type lets corrupt inputs reach
// the validator. It is not a production asset type or a second implementation.
type RecordData = Record<string, any>;
type FixtureInput = {
  manifest: { schemaVersion: number; episodeId: string; assets: RecordData[] };
  evidence: { files: Record<string, string>; records: Record<string, AssetEvidenceRecord>; content: { entities: Entity[]; uses: Usage[] } };
};
type PathPart = string | number | { id: string };
type Patch = { op: 'set' | 'remove' | 'append' | 'copy'; path: PathPart[]; value?: unknown; from?: PathPart[] };
type FixtureCase = {
  id: string; title: string; requirement: string; baseline: string; mode: 'inventory' | 'release';
  patches: Patch[]; schemaValid: boolean;
  expected: { valid: boolean; issueCodes: string[]; counts?: Partial<Counts> };
};
const fixture = JSON.parse(readFileSync(new URL('../fixtures/asset-manifests.json', import.meta.url), 'utf8')) as {
  provenance: string; contractVersion: number; minimums: Counts; cases: FixtureCase[];
};
const schema = JSON.parse(readFileSync(new URL('../../specs/001-physical-layer-underworld/contracts/asset-manifest.schema.json', import.meta.url), 'utf8'));
// Existing schema's conditional branches constrain properties typed in the outer
// object. Ajv's optional strictTypes/strictRequired lints reject that legal Draft
// 2020-12 shape; disabling these lints removes no runtime schema assertion.
const ajv = new Ajv2020({ strict: true, strictTypes: false, strictRequired: false, allowUnionTypes: true, allErrors: true });
addFormats(ajv);
const validateStructure = ajv.compile(schema);
const q = (id: string) => `spec001:${id}`;
const hash = (bytes: string) => createHash('sha256').update(bytes).digest('hex');
const date = '2026-11-26';
const zeroCounts: Counts = { characterModels: 0, props: 0, interactiveProps: 0, roomsWithImageSet: 0, sceneLayers: 0, portraits: 0, illustrations: 0, music: 0, ambience: 0, effects: 0, voices: 0 };
const empty = (): FixtureInput => ({ manifest: { schemaVersion: 1, episodeId: 'spec001', assets: [] }, evidence: { files: {}, records: {}, content: { entities: [], uses: [] } } });
const mediaPath = (id: string, name: string) => `assets-src/test-synthetic/${id}/${name}`;
const proofPath = (id: string, check: string) => `docs/evidence/test-synthetic/${id}/${check}.json`;

function file(input: FixtureInput, path: string, format: string) {
  // Deliberately not a plausible real GLB, .blend, image or audio binary.
  const bytes = format === 'json' ? JSON.stringify({ fixture: 'SYNTHETIC T060 ONLY', path }) : `SYNTHETIC T060 ONLY ${path}\n`;
  input.evidence.files[path] = bytes;
  return { path, sha256: hash(bytes), bytes: Buffer.byteLength(bytes), format };
}
function entity(input: FixtureInput, id: string, kind: string, extra: Partial<Entity> = {}) {
  if (!input.evidence.content.entities.some(entry => entry.id === id)) input.evidence.content.entities.push({ id, kind, ...extra });
}
function proof(input: FixtureInput, id: string, key: string, hashes: string[], type: AssetEvidenceRecord['type'], details: Record<string, unknown>, check?: string) {
  const path = proofPath(id, key);
  const record: AssetEvidenceRecord = {
    type, assetId: q(`ASSET-${id}`), hashes, status: 'passed', actor: type === 'production' ? 'tool' : 'human',
    reviewer: 'SYNTHETIC reviewer, no actual person or review', date,
    environment: 'SYNTHETIC isolated fixture; no production acceptance', details,
    ...(check ? { check } : {}),
  };
  input.evidence.records[path] = record;
  input.evidence.files[path] = JSON.stringify(record);
  return path;
}
function addUsage(input: FixtureInput, asset: RecordData, id: string, contentId: string, use: string) {
  const exportFile = asset['exports'][0].file;
  const binding: Usage = { assetId: asset['assetId'], contentId, use, exportPath: exportFile.path, interactiveOrEvidence: asset['interactiveOrEvidence'] };
  input.evidence.content.uses.push(binding);
  const evidencePath = proof(input, id, `usage-${asset['usedBy'].length}`, [exportFile.sha256], 'usage', { bindings: [binding], visible: true, meaningful: true });
  asset['usedBy'].push({ contentId, use, evidencePath });
}

/** Mechanical baseline construction, with no counting or validation logic. */
function accepted(input: FixtureInput, id: string, identity: string, kind: string, contentId: string, use: string, interactive = false) {
  const model = kind === 'character-model' || kind === 'prop-model';
  const audio = ['music', 'ambience', 'effect', 'voice'].includes(kind);
  const sourceFormat = model ? 'blend' : audio ? 'aup4' : 'png';
  const source = file(input, mediaPath(id, `source.${sourceFormat}`), sourceFormat);
  const sources = [{ file: source, role: 'native', application: model ? 'Blender' : audio ? 'Audacity' : 'Image editor', version: model ? '5.2.1' : audio ? '4.0.0' : 'fixture-1', reopenEvidencePath: proofPath(id, 'source-reopen') }];
  const raw = !model ? file(input, mediaPath(id, audio ? 'raw.wav' : 'raw.png'), audio ? 'wav' : 'png') : undefined;
  if (raw) sources.push({ file: raw, role: 'raw-generation', application: audio ? 'fixture audio generator' : 'OpenAI image generation', version: 'fixture-1', reopenEvidencePath: proofPath(id, 'source-reopen') });
  const master = audio ? file(input, mediaPath(id, 'master.wav'), 'wav') : undefined;
  if (master) sources.push({ file: master, role: 'master', application: 'Audacity', version: '4.0.0', reopenEvidencePath: proofPath(id, 'source-reopen') });
  const exportFile = file(input, `public/assets/test-synthetic/${id}.${model ? 'glb' : audio ? 'ogg' : 'webp'}`, model ? 'glb' : audio ? 'ogg' : 'webp');
  const prompt = file(input, mediaPath(id, 'prompt-or-script.txt'), 'txt');
  if (kind === 'voice') {
    const text = input.evidence.content.entities.find(entry => entry.id === contentId)!.text!;
    input.evidence.files[prompt.path] = text;
    prompt.sha256 = hash(text); prompt.bytes = Buffer.byteLength(text);
  }
  const settings = file(input, mediaPath(id, 'settings.json'), 'json');
  const notice = file(input, mediaPath(id, 'NOTICE.txt'), 'txt');
  const terms = file(input, mediaPath(id, 'terms.txt'), 'txt');
  const permission = file(input, mediaPath(id, 'input-permissions.txt'), 'txt');
  const hashes = sources.map(entry => entry.file.sha256);
  const allHashes = [...hashes, exportFile.sha256];
  const production = { method: model ? 'modeled' : audio ? (kind === 'voice' ? 'tts-generated' : 'music-generated') : 'openai-generated', tool: model ? 'Blender' : audio ? 'fixture audio generator' : 'OpenAI image generation', version: model ? '5.2.1' : 'fixture-1', modelRevision: model ? 'not-applicable' : audio ? 'synthetic-audio-model-v1' : 'unknown/not-exposed', eventId: `synthetic-${id}`, settingsPath: settings.path, promptOrScriptPath: prompt.path, referenceHashes: [], outputHashes: [raw?.sha256 ?? source.sha256], notes: 'SYNTHETIC event. No actual tool invocation is asserted.' };
  proof(input, id, 'production', production.outputHashes, 'production', { ...production, promptSha256: prompt.sha256, settingsSha256: settings.sha256 });
  const productionSteps: RecordData[] = [production];
  if (raw) {
    const editing = { ...production, method: audio ? 'mixed' : 'manual-edit', tool: audio ? 'Audacity' : 'Image editor', version: audio ? '4.0.0' : 'fixture-1', modelRevision: 'not-applicable', eventId: `synthetic-edit-${id}`, referenceHashes: [raw.sha256], outputHashes: [source.sha256, ...(master ? [master.sha256] : [])], notes: 'SYNTHETIC editing lineage preserves the original generation, native edit and master.' };
    productionSteps.push(editing);
    proof(input, id, 'editing', editing.outputHashes, 'production', { ...editing, promptSha256: prompt.sha256, settingsSha256: settings.sha256 });
  }
  const rights = { reviewStatus: 'accepted', creators: ['SYNTHETIC creator'], licenseIds: ['CC-BY-4.0'], noticePaths: [notice.path], sourceUrls: ['https://example.invalid/synthetic-source'], termsSnapshotPaths: [terms.path], inputPermissionPaths: [permission.path], aiDisclosure: model ? 'Original synthetic model fixture' : 'Synthetic AI provenance fixture, no output ownership claim' };
  proof(input, id, 'rights', allHashes, 'rights', { licenseIds: rights.licenseIds, noticeHashes: [notice.sha256], termsHashes: [terms.sha256], permissionHashes: [permission.sha256], permitsCommercialReuse: true, permitsRedistribution: true, permitsModification: true, referenceHashes: [] }, 'rights');
  const verification = ['structure', 'source-reopen', ...(audio ? ['listening'] : ['visual']), 'browser-comparison', 'rights', 'budget'].map(check => {
    const visual = check === 'visual' || check === 'browser-comparison';
    const findings = visual ? 'SYNTHETIC observed: readable silhouette, source/export material match, clear interaction area and aligned layer edges.' : check === 'listening' ? 'SYNTHETIC heard on both playback sets: clear speech/timbre, balanced level, no clipping, no loop-seam click; technical pronunciation intelligible where spoken.' : 'SYNTHETIC fixture testimony only';
    const details = { methods: check === 'listening' ? ['headphones', 'ordinary-speakers'] : visual ? [check === 'visual' ? 'image-inspection' : 'browser-inspection'] : [check], findings, ...(visual ? { tool: 'synthetic-visual-inspector', observedPaths: [...sources.map(entry => entry.file.path), exportFile.path] } : {}) };
    const evidencePath = check === 'rights' ? proofPath(id, 'rights') : proof(input, id, check, allHashes, 'review', details, check);
    return { check, status: 'passed', reviewer: 'SYNTHETIC reviewer, no actual person or review', date, hashes: allHashes, environment: 'SYNTHETIC isolated fixture; no production acceptance', evidencePath, findings };
  });
  const asset: RecordData = {
    assetId: q(`ASSET-${id}`), semanticIdentity: identity, kind, status: 'accepted', countsTowardQuota: true,
    interactiveOrEvidence: interactive, variantOf: null, derivedFrom: [], sources,
    exports: [{ file: exportFile, mimeType: model ? 'model/gltf-binary' : audio ? 'audio/ogg' : 'image/webp', sourceHashes: hashes, tool: 'fixture exporter', preset: 'fixture-only', integrationEvidencePath: proofPath(id, 'browser-comparison') }],
    production: productionSteps, rights, usedBy: [], verification,
  };
  if (model) asset['model'] = { blendSourcePath: source.path, objectIds: [`${id}-mesh`, 'shared-rig'], units: 'metres', axes: 'Y-up', pivot: 'base', collisionProxy: `${id}-collision`, animationClips: kind === 'character-model' ? ['idle', 'reaction', 'walk', 'ability'] : [], triangles: 120, textureBytes: 128 };
  if (!model && !audio) asset['image'] = { width: 1024, height: 1024, colorSpace: 'sRGB', alpha: use !== 'background', cameraRecordPath: file(input, mediaPath(id, 'camera.json'), 'json').path, layerRole: use, registrationPath: file(input, mediaPath(id, 'registration.json'), 'json').path };
  if (audio) asset['audio'] = { nativeProjectPath: source.path, masterPath: master!.path, codec: 'vorbis', sampleRate: 48000, channels: 2, durationSeconds: 4, loopStartSample: kind === 'voice' || kind === 'effect' ? null : 0, loopEndSample: kind === 'voice' || kind === 'effect' ? null : 192000, loudnessLufs: -18, peakDbfs: -1, captionId: kind === 'voice' ? contentId : null, ...(kind === 'voice' ? { voiceRecordPath: file(input, mediaPath(id, 'voice.json'), 'json').path } : {}) };
  if (kind === 'voice') {
    const line = input.evidence.content.entities.find(entry => entry.id === contentId)!;
    const voiceRecord = { fixture: 'SYNTHETIC T060 ONLY', lineId: contentId, speakerId: line.speakerId, text: line.text, voiceId: `synthetic-${line.speakerId}`, tool: production.tool, version: production.version, modelRevision: production.modelRevision, scriptPath: prompt.path, scriptSha256: prompt.sha256, pronunciationOverrides: [] };
    const voiceBytes = JSON.stringify(voiceRecord);
    input.evidence.files[asset['audio'].voiceRecordPath] = voiceBytes;
    const event = input.evidence.records[proofPath(id, 'production')]!;
    event.details['voiceRecordSha256'] = hash(voiceBytes);
    input.evidence.files[proofPath(id, 'production')] = JSON.stringify(event);
  }
  addUsage(input, asset, id, contentId, use);
  input.manifest.assets.push(asset);
  return asset;
}
function prop(input: FixtureInput, n = 1, interactive = true) {
  const id = `PR${String(n).padStart(3, '0')}`;
  entity(input, q(id), 'prop'); entity(input, q('R01'), 'room');
  return accepted(input, id, q(id), 'prop-model', q('R01'), 'prop-placement', interactive);
}
function imageAsset(input: FixtureInput, room = 1, role = 'background') {
  const roomId = `R${String(room).padStart(2, '0')}`;
  const id = `LAYER-${roomId}-${role}`;
  entity(input, q(roomId), 'room');
  return accepted(input, id, q(id), 'scene-layer', q(roomId), role);
}
function portrait(input: FixtureInput, n = 1) {
  const id = `CH${String(n).padStart(2, '0')}`;
  entity(input, q(id), 'character');
  return accepted(input, `PORTRAIT-${id}`, q(`PORTRAIT-${id}`), 'portrait', q(id), 'compendium-portrait');
}
function voice(input: FixtureInput, n = 1) {
  const suffix = String(n).padStart(3, '0');
  const speaker = ['narrator', q('CH02'), q('CH03'), q('CH16')][(n - 1) % 4]!;
  entity(input, speaker, speaker === 'narrator' ? 'narrator' : 'character');
  entity(input, q(`DIALOGUE-${suffix}`), 'dialogue-line', { speakerId: speaker, text: `Synthetic selected line ${suffix}: inspect the physical indication.` });
  return accepted(input, `VOICE-${suffix}`, q(`VOICE-${suffix}`), 'voice', q(`DIALOGUE-${suffix}`), 'voice-line');
}
const musicRooms = ['TITLE', 'R02', 'R03', 'R05', 'R07', 'R10', 'R11', 'R12'];
const musicNames = ['title', 'workshop', 'copper', 'fiber', 'radio', 'clockworks', 'rift', 'epilogue'];
function music(input: FixtureInput, n = 0) {
  const roomId = q(musicRooms[n]!); entity(input, roomId, n === 0 ? 'title' : 'room');
  return accepted(input, `MUSIC-${musicNames[n]}`, q(`MUSIC-${musicNames[n]}`), 'music', roomId, 'music');
}
function baseline(name: string): FixtureInput {
  const input = empty();
  if (name === 'empty') return input;
  if (name === 'planned') {
    const asset = prop(input);
    Object.assign(asset, { status: 'planned', countsTowardQuota: false, sources: [], exports: [], production: [], usedBy: [], verification: [], rights: { reviewStatus: 'pending', creators: [], licenseIds: [], noticePaths: [], sourceUrls: [], termsSnapshotPaths: [], inputPermissionPaths: [], aiDisclosure: '' } });
    delete asset['model']; input.evidence = empty().evidence; return input;
  }
  if (name === 'prop') { prop(input); return input; }
  if (name === 'public-source') {
    const asset = prop(input);
    const archive = file(input, mediaPath('PR001', 'sources.tar'), 'tar');
    const instructions = file(input, mediaPath('PR001', 'retrieval.txt'), 'txt');
    const retrieval = { url: 'https://example.invalid/releases/v1/sources.tar', archiveSha256: archive.sha256, memberPath: 'PR001/source.blend', release: 'v1', instructionsPath: instructions.path };
    asset['sources'][0].retrieval = retrieval;
    proof(input, 'PR001', 'retrieval', [archive.sha256, asset['sources'][0].file.sha256], 'retrieval', { ...retrieval, archivePath: archive.path, memberSha256: asset['sources'][0].file.sha256, instructionsSha256: instructions.sha256, publiclyAvailable: true, requiresAuthentication: false });
    // files[source.path] represents the checked member materialized by the
    // retrieval adapter in a clean isolated checkout, not a private URL lookup.
    return input;
  }
  if (name === 'character') {
    entity(input, q('CH01'), 'character'); entity(input, q('R01'), 'room');
    accepted(input, 'CH01', q('CH01'), 'character-model', q('R01'), 'character-placement'); portrait(input); return input;
  }
  if (name === 'image') { imageAsset(input); return input; }
  if (name === 'music') { music(input); return input; }
  if (name === 'voice') { voice(input); return input; }
  if (name === 'shared-use') {
    const asset = prop(input); entity(input, q('R02'), 'room'); addUsage(input, asset, 'PR001', q('R02'), 'prop-placement'); return input;
  }
  if (name === 'shared-blend') {
    const a = prop(input), b = prop(input, 2);
    // Separate named objects in one saved/reopened source, not two copies of one object.
    const oldHash = b['sources'][0].file.sha256, oldPath = b['sources'][0].file.path;
    const source = structuredClone(a['sources'][0].file);
    b['sources'][0].file = source; b['model'].blendSourcePath = source.path;
    replaceHash(input, b, oldHash, source.sha256);
    replaceObservedPath(input, b, oldPath, source.path); return input;
  }
  if (name === 'derived-layers') {
    const parent = imageAsset(input);
    for (const role of ['midground', 'foreground']) {
      const child = imageAsset(input, 1, role);
      const oldHash = child['sources'][1].file.sha256, oldPath = child['sources'][1].file.path;
      child['sources'][1].file = structuredClone(parent['sources'][1].file);
      replaceHash(input, child, oldHash, parent['sources'][1].file.sha256);
      replaceObservedPath(input, child, oldPath, parent['sources'][1].file.path);
      child['derivedFrom'] = [parent['assetId']];
      child['production'] = [{ ...child['production'][0], method: 'manual-edit', tool: 'Image editor', eventId: `synthetic-edit-${role}`, referenceHashes: [parent['sources'][1].file.sha256], outputHashes: [child['sources'][0].file.sha256], notes: 'Separate usable mask/layer from one actual parent call; no new OpenAI call.' }];
      const id = child['assetId'].slice('spec001:ASSET-'.length);
      delete input.evidence.records[proofPath(id, 'editing')]; delete input.evidence.files[proofPath(id, 'editing')];
      proof(input, id, 'production', child['production'][0].outputHashes, 'production', { ...child['production'][0], promptSha256: hash(input.evidence.files[child['production'][0].promptOrScriptPath]!), settingsSha256: hash(input.evidence.files[child['production'][0].settingsPath]!) });
      const rightsPath = proofPath(id, 'rights');
      input.evidence.records[rightsPath]!.details['referenceHashes'] = [parent['sources'][1].file.sha256];
      input.evidence.files[rightsPath] = JSON.stringify(input.evidence.records[rightsPath]);
    }
    return input;
  }
  if (name !== 'release') throw new Error(`Unknown fixture baseline: ${name}`);
  for (let n = 1; n <= 25; n++) {
    const id = `CH${String(n).padStart(2, '0')}`; entity(input, q(id), 'character'); entity(input, q('R01'), 'room');
    accepted(input, id, q(id), 'character-model', q('R01'), 'character-placement');
  }
  for (let n = 1; n <= 150; n++) prop(input, n, n <= 50);
  for (let n = 1; n <= 12; n++) for (const role of ['background', 'midground', 'foreground']) imageAsset(input, n, role);
  for (let n = 1; n <= 25; n++) portrait(input, n);
  for (let n = 1; n <= 24; n++) {
    const id = `ILLUSTRATION-${String(n).padStart(2, '0')}`, item = q(`ITEM-${String(n).padStart(2, '0')}`);
    entity(input, item, 'item'); accepted(input, id, q(id), 'illustration', item, 'inventory-illustration');
  }
  for (let n = 0; n < 8; n++) music(input, n);
  for (let n = 1; n <= 12; n++) {
    const room = `R${String(n).padStart(2, '0')}`; accepted(input, `AMBIENCE-${room}`, q(`AMBIENCE-${room}`), 'ambience', q(room), 'ambience');
  }
  for (let n = 1; n <= 40; n++) {
    const id = `EFFECT-${String(n).padStart(3, '0')}`, action = q(`ACTION-${id}`);
    entity(input, action, 'action'); accepted(input, id, q(id), 'effect', action, 'effect');
  }
  for (let n = 1; n <= 60; n++) voice(input, n);
  return input;
}
function replaceObservedPath(input: FixtureInput, asset: RecordData, oldPath: string, newPath: string) {
  // A mechanically shared source changes its observed path as well as hash.
  // Preserve the existing review/expected result; do not manufacture a new check.
  for (const [path, record] of Object.entries(input.evidence.records)) {
    if (record.assetId !== asset['assetId'] || !Array.isArray(record.details['observedPaths'])) continue;
    record.details['observedPaths'] = record.details['observedPaths'].map(value => value === oldPath ? newPath : value);
    input.evidence.files[path] = JSON.stringify(record);
  }
}
function replaceHash(input: FixtureInput, asset: RecordData, oldHash: string, newHash: string) {
  // Fixture copying helper, never computes validity/counts/expected answers.
  const replace = <T>(value: T): T => JSON.parse(JSON.stringify(value).replaceAll(oldHash, newHash));
  Object.assign(asset, replace(asset));
  for (const [path, record] of Object.entries(input.evidence.records)) if (record.assetId === asset['assetId']) {
    input.evidence.records[path] = replace(record); input.evidence.files[path] = JSON.stringify(input.evidence.records[path]);
  }
}
function at(root: unknown, path: PathPart[]): any {
  let value: any = root;
  for (const key of path) {
    if (typeof key === 'object') {
      if (!Array.isArray(value)) throw new Error('ID selector requires a fixture array');
      const matches = value.filter(entry => entry.id === key.id);
      if (matches.length !== 1) throw new Error(`Fixture selector must resolve exactly once: ${key.id}`);
      value = matches[0]; continue;
    }
    if (value == null || !Object.hasOwn(value, key)) throw new Error(`Fixture path does not exist: ${JSON.stringify(path)}`);
    value = value[key];
  }
  return value;
}
function build(test: FixtureCase): FixtureInput {
  const input = baseline(test.baseline);
  for (const patch of test.patches) {
    const parent = at(input, patch.path.slice(0, -1)), key = patch.path.at(-1)!;
    if (typeof key === 'object') throw new Error('Mutation must end with a property/index');
    if (patch.op === 'append') {
      const target = at(input, patch.path);
      if (!Array.isArray(target)) throw new Error('append requires an existing fixture array');
      target.push(structuredClone(patch.value));
    } else if (patch.op === 'copy') {
      if (!patch.from) throw new Error('copy requires a fixture source path');
      const target = at(input, patch.path);
      if (!Array.isArray(target)) throw new Error('copy requires an existing fixture array');
      target.push(structuredClone(at(input, patch.from)));
    } else {
      if (!Object.hasOwn(parent, key)) throw new Error(`Mutation target absent: ${JSON.stringify(patch.path)}`);
      if (patch.op === 'remove') { if (Array.isArray(parent)) parent.splice(Number(key), 1); else delete parent[key]; }
      else parent[key] = structuredClone(patch.value);
    }
    // A changed external testimony fixture has corresponding JSON bytes. A test
    // targeting files directly can independently corrupt or remove those bytes.
    if (patch.path[0] === 'evidence' && patch.path[1] === 'records') {
      const path = String(patch.path[2]);
      if (Object.hasOwn(input.evidence.records, path)) input.evidence.files[path] = JSON.stringify(input.evidence.records[path]);
    }
  }
  return input;
}
function snapshot(input: FixtureInput): AssetEvidenceSnapshot {
  return { ...structuredClone(input.evidence), files: Object.fromEntries(Object.entries(input.evidence.files).map(([path, bytes]) => [path, new TextEncoder().encode(bytes)])) };
}

describe('T060 fixture/schema validity only — no media acceptance', () => {
  it('freezes specification minima including 50 interactive props and per-room image sets', () => {
    expect(fixture.minimums).toEqual({ characterModels: 25, props: 150, interactiveProps: 50, roomsWithImageSet: 12, sceneLayers: 36, portraits: 25, illustrations: 24, music: 8, ambience: 12, effects: 40, voices: 60 });
    expect(fixture.provenance).toContain('SYNTHETIC'); expect(fixture.contractVersion).toBe(1);
    expect(new Set(fixture.cases.map(test => test.id)).size).toBe(fixture.cases.length);
  });
  for (const test of fixture.cases) it(`${test.id} schema ${test.schemaValid ? 'accepts shape' : 'rejects shape'}: ${test.title}`, () => {
    const input = build(test);
    expect(validateStructure(input.manifest), JSON.stringify(validateStructure.errors)).toBe(test.schemaValid);
    expect(test.requirement).toMatch(/C[0-9]|FR-|AC/);
    if (!test.expected.valid) expect(test.expected.issueCodes.length).toBeGreaterThan(0);
  });
  it('baseline bytes and external records are real isolated inputs, not manifest-derived acceptance flags', () => {
    const input = baseline('release');
    for (const asset of input.manifest.assets) for (const entry of [...asset['sources'], ...asset['exports']]) {
      const actual = input.evidence.files[entry.file.path]!;
      expect(actual).toContain('SYNTHETIC'); expect(hash(actual)).toBe(entry.file.sha256);
      expect(Buffer.byteLength(actual)).toBe(entry.file.bytes);
    }
    for (const [path, record] of Object.entries(input.evidence.records)) expect(JSON.parse(input.evidence.files[path]!)).toEqual(record);
    expect(Object.values(snapshot(input).files).every(bytes => bytes instanceof Uint8Array)).toBe(true);
  });
  it('legitimate derivative fixtures preserve one OpenAI event and three independent exports', () => {
    const input = baseline('derived-layers');
    expect(input.manifest.assets.flatMap(asset => asset['production']).filter(event => event.method === 'openai-generated')).toHaveLength(1);
    expect(new Set(input.manifest.assets.map(asset => asset['exports'][0].file.sha256)).size).toBe(3);
  });
  it('shared-source and derivative reviews observe the current source paths', () => {
    for (const name of ['shared-blend', 'derived-layers']) {
      const input = baseline(name);
      for (const asset of input.manifest.assets) {
        const paths = [...asset['sources'], ...asset['exports']].map(entry => entry.file.path);
        for (const record of Object.values(input.evidence.records)) {
          if (record.assetId === asset['assetId'] && ['visual', 'browser-comparison'].includes(record.check ?? '')) {
            expect(record.details['observedPaths']).toEqual(expect.arrayContaining(paths));
          }
        }
      }
    }
  });
});

// TODOs are intentional T060 evidence, not skipped assertions hidden by a green
// wrapper. When T061 exists, missing export/import failure is a real failing test.
const validatorUrl = new URL('../../tools/validate-assets.ts', import.meta.url);
const implementationExists = existsSync(validatorUrl);
const implementation: Record<string, unknown> | undefined = implementationExists ? await import(/* @vite-ignore */ validatorUrl.href) : undefined;
describe('T060 independent semantic oracle — pending T061 when module is absent', () => {
  if (!implementationExists) it.todo('T061 must supply tools/validate-assets.ts named validateAssetManifest export');
  else it('exports the agreed pure validator', () => expect(implementation?.['validateAssetManifest']).toBeTypeOf('function'));
  for (const test of fixture.cases) {
    const title = `${test.id} ${test.title} [${test.requirement}]`;
    if (!implementationExists) { it.todo(title); continue; }
    it(title, () => {
      const input = build(test), before = JSON.stringify(input), evidence = snapshot(input);
      expect(implementation?.['validateAssetManifest']).toBeTypeOf('function');
      const validate = implementation!['validateAssetManifest'] as ValidateAssetManifest;
      const result = validate(input.manifest, evidence, { mode: test.mode });
      expect(result.valid, JSON.stringify(result)).toBe(test.expected.valid);
      expect(result.counts).toEqual(expect.objectContaining(test.expected.counts ?? {}));
      expect(Object.keys(result.counts).sort()).toEqual(Object.keys(zeroCounts).sort());
      for (const value of Object.values(result.counts)) { expect(Number.isInteger(value)).toBe(true); expect(value).toBeGreaterThanOrEqual(0); }
      for (const code of test.expected.issueCodes) expect(result.issues.map(issue => issue.code), JSON.stringify(result)).toContain(code);
      if (test.expected.valid) expect(result.issues).toEqual([]);
      expect(JSON.stringify(input)).toBe(before);
      expect(snapshot(input)).toEqual(evidence);
    });
  }
});

describe('rights records for successive versions of an asset', () => {
  it('checks the declared review even when the previous audition has the same identity', () => {
    const input = empty();
    portrait(input);
    const asset = input.manifest.assets[0]!;
    const currentPath = proofPath('PORTRAIT-CH01', 'rights');
    const oldPath = proofPath('PORTRAIT-CH01', 'audition-rights');
    const previous = structuredClone(input.evidence.records[currentPath]!);
    previous.hashes = [hash('previous audition bytes')];
    input.evidence.records = { [oldPath]: previous, ...input.evidence.records };
    input.evidence.files[oldPath] = JSON.stringify(previous);
    const validate = implementation!['validateAssetManifest'] as ValidateAssetManifest;
    const audit = () => validate(input.manifest, snapshot(input), { mode: 'inventory' });
    expect(audit().issues).toEqual([]);

    // Matching evidence elsewhere cannot repair an explicit stale reference.
    asset['verification'].find((entry: { check: string }) => entry.check === 'rights').evidencePath = oldPath;
    expect(audit().issues.map(issue => issue.code)).toContain('RIGHTS_HASH_MISMATCH');
  });
});
