// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Independent additive T061 cases, authored before the correction. Every byte
// and review below is SYNTHETIC. No media, listening or owner acceptance occurs.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Asset, AssetEvidenceRecord, AssetEvidenceSnapshot, AssetManifest } from '../../tools/asset-types.ts';
import { validateAssetManifest } from '../../tools/validate-assets.ts';

const encode = (value: string) => new TextEncoder().encode(value);
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const proofRoot = 'docs/evidence/spec001/assets/synthetic-voice-binding';
const currentPath = `${proofRoot}/current.json`;
const historicalPath = `${proofRoot}/historical.json`;
const duplicatePath = `${proofRoot}/duplicate.json`;
const currentId = 'synthetic-generation-metadata-v2';

/** Mechanical inputs only: expectations are stated separately in each case. */
function fixture() {
  const files: Record<string, Uint8Array> = {}, records: Record<string, AssetEvidenceRecord> = {};
  const file = (path: string, format: string, text = `SYNTHETIC voice binding only: ${path}`) => {
    const bytes = encode(text); files[path] = bytes;
    return { path, format, sha256: hash(bytes), bytes: bytes.length };
  };
  const native = file('assets-src/audio/synthetic-binding/source.aup4', 'aup4');
  const raw = file('assets-src/audio/synthetic-binding/raw.wav', 'wav');
  const master = file('assets-src/audio/synthetic-binding/master.wav', 'wav');
  const out = file('public/assets/audio/synthetic-binding.ogg', 'ogg');
  const text = 'Synthetic line: observe the link indicator.';
  const script = file('assets-src/audio/synthetic-binding/script.txt', 'txt', text);
  const settings = file('assets-src/audio/synthetic-binding/settings.json', 'json', '{}');
  const notice = file('assets-src/audio/synthetic-binding/NOTICE.txt', 'txt');
  const terms = file('assets-src/audio/synthetic-binding/terms.txt', 'txt');
  const voicePath = 'assets-src/audio/synthetic-binding/voice.json';
  const captionId = 'spec001:DIALOGUE-SYNTHETIC-VOICE';
  const voice: Record<string, unknown> = {
    lineId: captionId, speakerId: 'narrator', text, voiceId: 'synthetic-voice',
    tool: 'Synthetic TTS', version: '1', modelRevision: 'synthetic-model-1',
    scriptPath: script.path, scriptSha256: script.sha256,
    // Actual generation identity may differ from a truthful metadata revision.
    eventId: 'synthetic-generation', pronunciationOverrides: [],
  };
  files[voicePath] = encode(JSON.stringify(voice));
  const production = {
    method: 'tts-generated', tool: 'Synthetic TTS', version: '1', modelRevision: 'synthetic-model-1', eventId: currentId,
    settingsPath: settings.path, promptOrScriptPath: script.path, referenceHashes: [], outputHashes: [raw.sha256],
    notes: 'SYNTHETIC metadata revision; no actual generation or media approval.',
  };
  const editing = { ...production, method: 'mixed', tool: 'Audacity', version: '4.0.0', modelRevision: 'not-applicable', eventId: 'synthetic-mix', referenceHashes: [raw.sha256], outputHashes: [native.sha256, master.sha256] };
  const allHashes = [native.sha256, raw.sha256, master.sha256, out.sha256];
  const asset: Asset = {
    assetId: 'spec001:ASSET-SYNTHETIC-VOICE', semanticIdentity: 'spec001:SYNTHETIC-VOICE', kind: 'voice', status: 'accepted', countsTowardQuota: true,
    interactiveOrEvidence: false, variantOf: null, derivedFrom: [],
    sources: [
      { file: native, role: 'native', application: 'Audacity', version: '4.0.0', reopenEvidencePath: `${proofRoot}/source-reopen.json` },
      { file: raw, role: 'raw-generation', application: 'Synthetic TTS', version: '1' },
      { file: master, role: 'master', application: 'Audacity', version: '4.0.0' },
    ],
    exports: [{ file: out, mimeType: 'audio/ogg', sourceHashes: [native.sha256, raw.sha256, master.sha256], tool: 'Synthetic exporter', preset: 'test-only', integrationEvidencePath: `${proofRoot}/browser-comparison.json` }],
    production: [production, editing],
    rights: { reviewStatus: 'accepted', creators: ['SYNTHETIC creator'], licenseIds: ['CC-BY-4.0'], noticePaths: [notice.path], sourceUrls: [], termsSnapshotPaths: [terms.path], inputPermissionPaths: [], aiDisclosure: 'SYNTHETIC test evidence only.' },
    usedBy: [{ contentId: captionId, use: 'voice-line', evidencePath: `${proofRoot}/usage.json` }], verification: [],
    audio: { nativeProjectPath: native.path, masterPath: master.path, codec: 'vorbis', sampleRate: 48000, channels: 1, durationSeconds: 2, loopStartSample: null, loopEndSample: null, loudnessLufs: -18, peakDbfs: -1, captionId, voiceRecordPath: voicePath },
  };
  const record = (path: string, value: AssetEvidenceRecord) => { records[path] = value; files[path] = encode(JSON.stringify(value)); };
  const proof = (path: string, type: AssetEvidenceRecord['type'], hashes: string[], details: Record<string, unknown>, check?: string) => record(path, {
    type, assetId: asset.assetId, hashes, status: 'passed', actor: type === 'production' ? 'tool' : 'human',
    reviewer: 'SYNTHETIC reviewer, no actual person', date: '2026-11-26', environment: 'SYNTHETIC isolated fixture', details, ...(check ? { check } : {}),
  });
  proof(currentPath, 'production', [raw.sha256], { ...production, settingsSha256: settings.sha256, promptSha256: script.sha256, voiceRecordPath: voicePath, voiceRecordSha256: hash(files[voicePath]!), originalGenerationEventId: 'synthetic-generation' });
  proof(`${proofRoot}/mix.json`, 'production', editing.outputHashes, { ...editing, settingsSha256: settings.sha256, promptSha256: script.sha256 });
  const findings = 'SYNTHETIC observed clear text and balanced sound on both playback sets; no actual listening.';
  proof(`${proofRoot}/rights.json`, 'rights', allHashes, { licenseIds: ['CC-BY-4.0'], noticeHashes: [notice.sha256], termsHashes: [terms.sha256], permissionHashes: [], referenceHashes: [], permitsCommercialReuse: true, permitsRedistribution: true, permitsModification: true }, 'rights');
  for (const check of ['structure', 'source-reopen', 'listening', 'browser-comparison', 'rights', 'budget']) {
    const path = `${proofRoot}/${check}.json`;
    if (check !== 'rights') proof(path, 'review', allHashes, { findings, methods: check === 'listening' ? ['headphones', 'ordinary-speakers'] : ['browser-inspection'], tool: 'Synthetic observer', observedPaths: [native.path, raw.path, master.path, out.path] }, check);
    asset.verification.push({ check, status: 'passed', reviewer: 'SYNTHETIC reviewer, no actual person', date: '2026-11-26', environment: 'SYNTHETIC isolated fixture', hashes: allHashes, evidencePath: path, findings });
  }
  const use = { assetId: asset.assetId, contentId: captionId, use: 'voice-line', exportPath: out.path, interactiveOrEvidence: false };
  proof(`${proofRoot}/usage.json`, 'usage', [out.sha256], { visible: true, meaningful: true, bindings: [use] });
  const manifest: AssetManifest = { schemaVersion: 1, episodeId: 'spec001', assets: [asset] };
  const evidence: AssetEvidenceSnapshot = { files, records, content: { entities: [{ id: captionId, kind: 'dialogue-line', speakerId: 'narrator', text }], uses: [use] } };
  const reorder = (paths: string[]) => {
    const entries = new Map(Object.entries(records));
    for (const path of Object.keys(records)) delete records[path];
    for (const path of [...paths, ...entries.keys()]) if (!Object.hasOwn(records, path)) records[path] = entries.get(path)!;
  };
  const refresh = () => record(currentPath, records[currentPath]!);
  const audit = () => validateAssetManifest(manifest, evidence, { mode: 'inventory' });
  return { manifest, asset, evidence, files, records, voice, voicePath, production, raw, script, record, reorder, refresh, audit };
}
type Fixture = ReturnType<typeof fixture>;
function accepted(f: Fixture) {
  const result = f.audit();
  expect(result.valid, JSON.stringify(result)).toBe(true); expect(result.issues).toEqual([]); expect(result.counts.voices).toBe(1);
}
function rejected(f: Fixture, code: string) {
  const result = f.audit();
  expect(result.valid, JSON.stringify(result)).toBe(false); expect(result.issues.map(i => i.code)).toContain(code); expect(result.counts.voices).toBe(0);
}
function history(f: Fixture) {
  const old = structuredClone(f.records[currentPath]!); old.details['eventId'] = 'synthetic-generation';
  f.record(historicalPath, old); return old;
}
const orders = [
  [historicalPath, currentPath, duplicatePath], [historicalPath, duplicatePath, currentPath],
  [currentPath, historicalPath, duplicatePath], [currentPath, duplicatePath, historicalPath],
  [duplicatePath, historicalPath, currentPath], [duplicatePath, currentPath, historicalPath],
];

describe('declared voice production binding — independent synthetic oracle', () => {
  it('accepts one declared, source-bound metadata revision without equating it to a new generation', () => accepted(fixture()));
  it.each(orders.map((paths, n) => ({ paths, n })))('ignores distinct unreferenced stale records in permutation $n', ({ paths }) => {
    const f = fixture(), old = history(f);
    Object.assign(old.details, { tool: 'Historical tool', version: 'old', modelRevision: 'old-model', voiceRecordSha256: 'a'.repeat(64), voiceRecordPath: 'assets-src/audio/historical.json' });
    old.status = 'failed'; f.record(historicalPath, old);
    const other = structuredClone(old); other.details['eventId'] = 'unreferenced-other'; other.status = 'pending'; f.record(duplicatePath, other);
    f.reorder(paths); accepted(f);
  });
  it.each(['voiceRecordSha256', 'tool', 'version', 'modelRevision'])('unreferenced matching testimony cannot rescue declared %s disagreement', key => {
    const f = fixture(); history(f);
    if (key === 'voiceRecordSha256') f.records[currentPath]!.details[key] = 'b'.repeat(64);
    else { Object.assign(f.production, { [key]: 'declared-other' }); f.records[currentPath]!.details[key] = 'declared-other'; }
    f.refresh(); f.reorder([historicalPath, currentPath]); rejected(f, 'VOICE_RECORD_MISSING');
  });
  it('unreferenced testimony cannot replace an absent declared TTS event', () => {
    const f = fixture(); f.asset.production.shift();
    // Remove the independent external-reference permission failure so this
    // case isolates the missing declared generation rather than rights checks.
    f.asset.production[0]!.referenceHashes = [];
    f.records[`${proofRoot}/mix.json`]!.details['referenceHashes'] = [];
    f.record(`${proofRoot}/mix.json`, f.records[`${proofRoot}/mix.json`]!);
    rejected(f, 'VOICE_RECORD_MISSING');
  });
  it('a declared non-TTS event cannot borrow unreferenced TTS metadata', () => {
    const f = fixture(); history(f); f.production.method = 'recorded'; f.records[currentPath]!.details['method'] = 'recorded'; f.refresh();
    f.reorder([historicalPath, currentPath]); rejected(f, 'VOICE_RECORD_MISSING');
  });
  it('declared production script must be the bound voice script, not merely another existing input', () => {
    const f = fixture(), path = 'assets-src/audio/synthetic-binding/other-script.txt';
    f.files[path] = encode('An unrelated synthetic line.'); f.production.promptOrScriptPath = path;
    Object.assign(f.records[currentPath]!.details, { promptOrScriptPath: path, promptSha256: hash(f.files[path]!) }); f.refresh();
    rejected(f, 'VOICE_TEXT_LINK');
  });
  it('a supplied production voice path cannot contradict the hash-bound manifest path', () => {
    const f = fixture(); f.records[currentPath]!.details['voiceRecordPath'] = 'assets-src/audio/other-voice.json'; f.refresh(); rejected(f, 'VOICE_RECORD_MISSING');
  });
  it('retains the existing hash-only voice evidence contract when no extra path is supplied', () => {
    const f = fixture(); delete f.records[currentPath]!.details['voiceRecordPath']; f.refresh(); accepted(f);
  });
  it.each(['forward', 'reverse'])('accepts multiple consistent declared TTS events in %s order', order => {
    const f = fixture(), second = { ...structuredClone(f.production), eventId: 'synthetic-second-declared' };
    f.asset.production.push(second); const proof = structuredClone(f.records[currentPath]!); proof.details['eventId'] = second.eventId; f.record(duplicatePath, proof);
    if (order === 'reverse') { f.asset.production.reverse(); f.reorder([duplicatePath, currentPath]); } accepted(f);
  });
  it.each(['forward', 'reverse'])('every declared TTS event needs matching voice metadata in %s order', order => {
    const f = fixture(), second = { ...structuredClone(f.production), eventId: 'synthetic-second-declared' };
    f.asset.production.push(second); const proof = structuredClone(f.records[currentPath]!);
    Object.assign(proof.details, { eventId: second.eventId, voiceRecordSha256: 'c'.repeat(64) }); f.record(duplicatePath, proof);
    if (order === 'reverse') { f.asset.production.reverse(); f.reorder([duplicatePath, currentPath]); } rejected(f, 'VOICE_RECORD_MISSING');
  });
  it.each(['forward', 'reverse'])('identical duplicate testimony and declarations are deterministic in %s order', order => {
    const f = fixture(); f.record(duplicatePath, structuredClone(f.records[currentPath]!)); f.asset.production.push(structuredClone(f.production));
    if (order === 'reverse') { f.asset.production.reverse(); f.reorder([duplicatePath, currentPath]); } accepted(f);
  });
  for (const key of ['voiceRecordSha256', 'tool', 'modelRevision', 'status', 'hashes']) it.each(['forward', 'reverse'])(`contradictory duplicate event ${key} fails closed in %s order`, order => {
    const f = fixture(), duplicate = structuredClone(f.records[currentPath]!);
    if (key === 'status') duplicate.status = 'failed';
    else if (key === 'hashes') duplicate.hashes = ['d'.repeat(64)];
    else duplicate.details[key] = key === 'voiceRecordSha256' ? 'd'.repeat(64) : 'contradiction';
    f.record(duplicatePath, duplicate); if (order === 'reverse') f.reorder([duplicatePath, currentPath]);
    rejected(f, 'PRODUCTION_EVIDENCE_AMBIGUOUS');
  });
  it.each(['forward', 'reverse'])('contradictory duplicate declared identity fails closed in %s order', order => {
    const f = fixture(); f.asset.production.push({ ...structuredClone(f.production), modelRevision: 'contradictory-model' });
    if (order === 'reverse') f.asset.production.reverse(); rejected(f, 'PRODUCTION_EVIDENCE_AMBIGUOUS');
  });
  it.each(['missing-bytes', 'changed-bytes', 'wrong-asset', 'wrong-event', 'failed-status', 'missing-output-hash'])('retains declared event evidence admission: %s', corruption => {
    const f = fixture();
    if (corruption === 'missing-bytes') delete f.files[currentPath];
    else if (corruption === 'changed-bytes') f.files[currentPath] = encode('{}');
    else {
      const r = f.records[currentPath]!;
      if (corruption === 'wrong-asset') r.assetId = 'spec001:ASSET-OTHER';
      if (corruption === 'wrong-event') r.details['eventId'] = 'other-event';
      if (corruption === 'failed-status') r.status = 'failed';
      if (corruption === 'missing-output-hash') r.hashes = [];
      f.refresh();
    }
    rejected(f, corruption === 'changed-bytes' ? 'EVIDENCE_BYTES_MISMATCH' : 'PRODUCTION_EVIDENCE_MISSING');
  });
  it('retains source binding when a declared TTS output is absent from the asset sources', () => {
    const f = fixture(); f.production.outputHashes = ['e'.repeat(64)];
    f.records[currentPath]!.details['outputHashes'] = ['e'.repeat(64)]; f.records[currentPath]!.hashes = ['e'.repeat(64)]; f.refresh();
    rejected(f, 'PRODUCTION_OUTPUT_HASH');
  });
  it('retains raw byte hash verification independently of production testimony', () => {
    const f = fixture(); f.files[f.raw.path] = encode('SYNTHETIC altered raw bytes'); rejected(f, 'FILE_HASH_MISMATCH');
  });
  it.each(['text', 'speakerId', 'lineId', 'scriptSha256'])('retains exact caption and script binding for %s', key => {
    const f = fixture(); f.voice[key] = key === 'scriptSha256' ? 'f'.repeat(64) : 'different';
    f.files[f.voicePath] = encode(JSON.stringify(f.voice)); f.records[currentPath]!.details['voiceRecordSha256'] = hash(f.files[f.voicePath]!); f.refresh();
    rejected(f, 'VOICE_TEXT_LINK');
  });
  it('does not mutate either manifest or observed evidence', () => {
    const f = fixture(), manifest = structuredClone(f.manifest), evidence = structuredClone(f.evidence); accepted(f);
    expect(f.manifest).toEqual(manifest); expect(f.evidence).toEqual(evidence);
  });
});
