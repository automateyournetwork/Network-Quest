// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../specs/001-physical-layer-underworld/contracts/asset-manifest.schema.json' with { type: 'json' };
import { emptyCounts, minimums } from './asset-types.ts';
import type { Asset, AssetCounts, AssetEvidenceRecord, AssetEvidenceSnapshot, AssetManifest, AssetValidationResult } from './asset-types.ts';
export type { AssetEvidenceSnapshot, AssetValidationResult } from './asset-types.ts';

const ajv = new Ajv2020({ strict: true, strictTypes: false, strictRequired: false, allowUnionTypes: true });
addFormats(ajv);
// Only optional schema-authoring lints are disabled, as in the independent oracle.
const structure = ajv.compile(schema);
export const isAssetManifest = (input: unknown): input is AssetManifest => boundedData(input) && structure(input);
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const covers = (have: unknown, need: string[]) => strings(have) && need.every(x => have.includes(x));
const decodeJson = (bytes: Uint8Array | undefined): unknown => {
  if (!bytes || bytes.byteLength > 4_194_304) return undefined;
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return undefined; }
};
/** JSON-like input admission before recursive Ajv/graph work. Reject cycles, depth and bulk. */
function boundedData(value: unknown): boolean {
  const stack: { value: unknown; depth: number; exit?: boolean }[] = [{ value, depth: 0 }];
  const seen = new WeakSet<object>(); let nodes = 0; let text = 0;
  while (stack.length) {
    const next = stack.pop()!;
    if (next.exit) { seen.delete(next.value as object); continue; }
    if (++nodes > 2_000_000 || next.depth > 32) return false;
    if (typeof next.value === 'string') { text += next.value.length; if (text > 32_000_000) return false; }
    else if (next.value && typeof next.value === 'object') {
      if (seen.has(next.value) || (!Array.isArray(next.value) && Object.getPrototypeOf(next.value) !== Object.prototype && Object.getPrototypeOf(next.value) !== null)) return false;
      seen.add(next.value);
      stack.push({ value: next.value, depth: next.depth, exit: true });
      for (const d of Object.values(Object.getOwnPropertyDescriptors(next.value))) { if (!('value' in d)) return false; stack.push({ value: d.value, depth: next.depth + 1 }); }
    } else if (next.value !== null && !['boolean', 'number'].includes(typeof next.value)) return false;
  }
  return true;
}
export function isEvidenceRecord(record: unknown): record is AssetEvidenceRecord {
  if (!object(record) || !boundedData(record)) return false;
  return ['review', 'production', 'rights', 'usage', 'retrieval'].includes(String(record['type']))
    && ['passed', 'pending', 'failed'].includes(String(record['status'])) && ['human', 'agent', 'tool'].includes(String(record['actor']))
    && nonempty(record['assetId']) && strings(record['hashes']) && record['hashes'].length <= 256
    && record['hashes'].every(x => /^[a-f0-9]{64}$/.test(x))
    && nonempty(record['reviewer']) && nonempty(record['environment']) && typeof record['date'] === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(record['date']) && Number.isFinite(Date.parse(record['date']))
    && (record['check'] === undefined || typeof record['check'] === 'string') && object(record['details']);
}
function evidenceShape(e: AssetEvidenceSnapshot): boolean {
  if (!object(e) || !['files', 'records', 'content'].every(k => Object.hasOwn(e, k) && 'value' in Object.getOwnPropertyDescriptor(e, k)!)) return false;
  if (!object(e.files) || !object(e.records) || !object(e.content) || !boundedData(e.content) || !Array.isArray(e.content.entities) || !Array.isArray(e.content.uses)) return false;
  if (![e.files, e.records].every(map => Object.values(Object.getOwnPropertyDescriptors(map)).every(d => 'value' in d))) return false;
  let bytes = 0;
  if (Object.keys(e.files).length > 100_000 || Object.keys(e.records).length > 50_000 || e.content.entities.length > 100_000 || e.content.uses.length > 100_000) return false;
  for (const file of Object.values(e.files)) { if (!(file instanceof Uint8Array)) return false; bytes += file.byteLength; if (bytes > 1_073_741_824) return false; }
  return Object.values(e.records).every(isEvidenceRecord)
    && e.content.entities.every(x => object(x) && nonempty(x.id) && nonempty(x.kind) && (x.text === undefined || typeof x.text === 'string') && (x.speakerId === undefined || typeof x.speakerId === 'string'))
    && e.content.uses.every(x => object(x) && (['assetId', 'contentId', 'use', 'exportPath'] as const).every(k => nonempty(x[k])) && typeof x.interactiveOrEvidence === 'boolean');
}
const roomIds = Array.from({ length: 12 }, (_, i) => `spec001:R${String(i + 1).padStart(2, '0')}`);
const musicTargets = ['spec001:TITLE', 'spec001:R02', 'spec001:R03', 'spec001:R05', 'spec001:R07', 'spec001:R10', 'spec001:R11', 'spec001:R12'];
const speakers = ['narrator', 'spec001:CH02', 'spec001:CH03', 'spec001:CH16'];
const privatePath = (path: string) => path.split('/').some(x => /^\./.test(x) || /^(?:private|operator|credentials?|secrets?|sessions?|backups?|players?)$/i.test(x));
const generated = (method: string) => ['openai-generated', 'tts-generated', 'music-generated'].includes(method);
const audioKind = (kind: string) => ['music', 'ambience', 'effect', 'voice'].includes(kind);

/** Pure consistency audit. It consumes observations; it does not perform listening,
 * Blender reopening, visual inspection or owner acceptance. roomsWithImageSet is
 * an image-distribution count and never claims twelve finished playable rooms. */
export function validateAssetManifest(manifest: unknown, evidence: AssetEvidenceSnapshot, options: { mode: 'inventory' | 'release' }): AssetValidationResult {
  const result: AssetValidationResult = { valid: false, issues: [], counts: emptyCounts() };
  const issueKeys = new Set<string>(); let issueLimit = false;
  const add = (code: string, assetId?: string, path?: string) => {
    const key = JSON.stringify([code, assetId, path]);
    if (issueKeys.has(key)) return;
    if (result.issues.length >= 10_000) { issueLimit = true; return; }
    issueKeys.add(key); result.issues.push({ code, ...(assetId ? { assetId } : {}), ...(path ? { path } : {}) });
  };
  if (!options || !['inventory', 'release'].includes(options.mode)) { add('MODE_INVALID'); return result; }
  if (!isAssetManifest(manifest)) { add('SCHEMA_INVALID'); return result; }
  if (!evidenceShape(evidence)) { add('EVIDENCE_INVALID'); return result; }
  const assets = manifest.assets, byId = new Map(assets.map(a => [a.assetId, a]));
  const entities = new Map(evidence.content.entities.map(e => [e.id, e]));
  if (entities.size !== evidence.content.entities.length) { add('CONTENT_IDENTITY_DUPLICATE'); return result; }
  const fileAt = (path: string) => Object.hasOwn(evidence.files, path) ? evidence.files[path] : undefined;
  const recordAt = (path: string) => Object.hasOwn(evidence.records, path) ? evidence.records[path] : undefined;
  const bytesHash = new Map<string, string>();
  const hashAt = (path: string) => { const bytes = fileAt(path); if (!bytes) return undefined; if (!bytesHash.has(path)) bytesHash.set(path, digest(bytes)); return bytesHash.get(path); };
  const records = Object.entries(evidence.records);
  const recordsByAsset = new Map<string, typeof records>();
  for (const [path, record] of records) {
    const group = recordsByAsset.get(record.assetId) ?? []; group.push([path, record]); recordsByAsset.set(record.assetId, group);
    if (fileAt(path) && !isDeepStrictEqual(decodeJson(fileAt(path)), record)) add('EVIDENCE_BYTES_MISMATCH', record.assetId, path);
  }
  const get = (path: string | undefined, a: Asset, code: string): AssetEvidenceRecord | undefined => {
    if (!path || !fileAt(path) || !recordAt(path)) { add(code, a.assetId, path); return undefined; }
    const record = recordAt(path)!;
    if (!isDeepStrictEqual(decodeJson(fileAt(path)), record)) return undefined;
    return record;
  };
  const duplicate = (key: (a: Asset) => string | undefined, code: string) => {
    const seen = new Map<string, Asset>();
    for (const a of assets) { const k = key(a); if (k === undefined) continue; const previous = seen.get(k); if (previous) { add(code, previous.assetId); add(code, a.assetId); } else seen.set(k, a); }
  };
  duplicate(a => a.assetId, 'DUPLICATE_ASSET_ID');
  duplicate(a => a.semanticIdentity, 'DUPLICATE_SEMANTIC_IDENTITY');
  duplicate(a => a.model?.objectIds.length ? `${a.model.blendSourcePath}:${[...a.model.objectIds].sort().join('|')}` : undefined, 'DUPLICATE_MODEL_OBJECTS');
  let graphSteps = 0;
  for (const a of assets) {
    const assetRecords = recordsByAsset.get(a.assetId) ?? [];
    for (const parent of a.derivedFrom) if (!byId.has(parent)) add('DERIVATION_UNRESOLVED', a.assetId);
    if (a.variantOf !== null && !byId.has(a.variantOf)) add('VARIANT_UNRESOLVED', a.assetId);
    if (a.variantOf !== null && a.countsTowardQuota) add('VARIANT_QUOTA', a.assetId);
    // Iterative ancestry avoids stack overflow and includes variant relationships.
    const pending = [...a.derivedFrom, ...(a.variantOf ? [a.variantOf] : [])], visited = new Set<string>();
    while (pending.length) { if (++graphSteps > 2_000_000) { add('GRAPH_LIMIT'); return result; } const id = pending.pop()!; if (id === a.assetId) { add('DERIVATION_CYCLE', a.assetId); break; } if (visited.has(id)) continue; visited.add(id); const parent = byId.get(id); if (parent) pending.push(...parent.derivedFrom, ...(parent.variantOf ? [parent.variantOf] : [])); }
    const accepted = a.status === 'accepted', model = a.kind === 'character-model' || a.kind === 'prop-model', audio = audioKind(a.kind);
    const hashes = [...a.sources.map(s => s.file.sha256), ...a.exports.map(e => e.file.sha256)];
    const sourceHashes = a.sources.map(s => s.file.sha256);
    for (const entry of [...a.sources, ...a.exports]) {
      const f = entry.file;
      if (privatePath(f.path)) add('SOURCE_NOT_PUBLIC', a.assetId, f.path);
      if (f.path.includes('/feasibility/')) add('FEASIBILITY_NOT_PRODUCTION', a.assetId, f.path);
      const bytes = fileAt(f.path);
      if (!bytes) add('FILE_MISSING', a.assetId, f.path);
      else { if (hashAt(f.path) !== f.sha256) add('FILE_HASH_MISMATCH', a.assetId, f.path); if (bytes.byteLength !== f.bytes) add('FILE_SIZE_MISMATCH', a.assetId, f.path); }
    }
    if (accepted && model) {
      const identity = entities.get(a.semanticIdentity), expected = a.kind === 'character-model' ? 'character' : 'prop';
      if (!identity) add('IDENTITY_UNRESOLVED', a.assetId);
      else if (identity.kind !== expected) add('IDENTITY_KIND_MISMATCH', a.assetId);
      const native = a.sources.find(s => s.role === 'native' && s.file.format === 'blend' && s.application === 'Blender' && s.file.path.endsWith('.blend'));
      if (!native) add('BLENDER_SOURCE_REQUIRED', a.assetId);
      if (!a.sources.some(s => s.role === 'native' && s.file.path === a.model!.blendSourcePath)) add('NATIVE_SOURCE_LINK', a.assetId);
      if (!a.model!.objectIds.length) add('MODEL_OBJECTS_MISSING', a.assetId);
      if (a.kind === 'character-model' && !covers(a.model!.animationClips, ['idle', 'reaction', ...(a.semanticIdentity === 'spec001:CH01' ? ['walk'] : [])])) add('ANIMATION_REQUIRED', a.assetId);
    }
    for (const source of a.sources) {
      if (source.reopenEvidencePath && (accepted || fileAt(source.reopenEvidencePath))) {
        const r = get(source.reopenEvidencePath, a, 'REVIEW_EVIDENCE_MISSING');
        if (r && (r.type !== 'review' || r.check !== 'source-reopen' || r.assetId !== a.assetId || (accepted && (r.status !== 'passed' || !r.hashes.includes(source.file.sha256))))) add('REVIEW_NOT_PASSED', a.assetId, source.reopenEvidencePath);
      } else if (accepted && source.role === 'native') add('REVIEW_EVIDENCE_MISSING', a.assetId);
      const retrieval = source.retrieval;
      if (retrieval) {
        const found = assetRecords.find(([, r]) => r.type === 'retrieval');
        const r = get(found?.[0], a, 'RETRIEVAL_UNVERIFIED');
        if (!fileAt(retrieval.instructionsPath)) add('RETRIEVAL_INSTRUCTIONS_MISSING', a.assetId);
        if (r) {
          const d = r.details;
          if (r.status !== 'passed' || d['url'] !== retrieval.url || d['release'] !== retrieval.release) add('RETRIEVAL_UNVERIFIED', a.assetId);
          if (d['requiresAuthentication'] !== false || d['publiclyAvailable'] !== true || !/^https:\/\//.test(retrieval.url)) add('SOURCE_NOT_PUBLIC', a.assetId);
          if (typeof d['archivePath'] !== 'string' || hashAt(d['archivePath']) !== retrieval.archiveSha256 || d['archiveSha256'] !== retrieval.archiveSha256 || !r.hashes.includes(retrieval.archiveSha256)) add('RETRIEVAL_HASH_MISMATCH', a.assetId);
          if (d['memberPath'] !== retrieval.memberPath || d['memberSha256'] !== source.file.sha256 || hashAt(source.file.path) !== source.file.sha256 || !r.hashes.includes(source.file.sha256)) add('RETRIEVAL_MEMBER_MISMATCH', a.assetId);
          if (d['instructionsPath'] !== retrieval.instructionsPath || hashAt(retrieval.instructionsPath) !== d['instructionsSha256']) add('RETRIEVAL_INSTRUCTIONS_MISSING', a.assetId);
        }
      }
    }
    for (const e of a.exports) if (!e.sourceHashes.length || !covers(sourceHashes, e.sourceHashes)) add('EXPORT_SOURCE_HASH', a.assetId, e.file.path);
    const references = [...new Set(a.production.flatMap(p => p.referenceHashes))];
    if (accepted || a.production.length) for (const parentId of a.derivedFrom) {
      const parent = byId.get(parentId);
      if (parent && ![...parent.sources, ...parent.exports].some(s => references.includes(s.file.sha256) && hashAt(s.file.path) === s.file.sha256)) add('DERIVATION_INPUT_UNBOUND', a.assetId);
    }
    const preservedReferences = [...a.sources, ...a.derivedFrom.flatMap(id => { const parent = byId.get(id); return parent ? [...parent.sources, ...parent.exports] : []; })];
    for (const reference of references) if (!preservedReferences.some(s => s.file.sha256 === reference && hashAt(s.file.path) === reference)) add('PRODUCTION_REFERENCE_HASH', a.assetId);
    for (const p of a.production) {
      if (!p.outputHashes.length || !covers(sourceHashes, p.outputHashes)) add('PRODUCTION_OUTPUT_HASH', a.assetId);
      if (p.method === 'openai-generated' && !/openai/i.test(p.tool)) add('PRODUCTION_METHOD_MISMATCH', a.assetId);
      if (generated(p.method) && !a.sources.some(s => s.role === 'raw-generation' && p.outputHashes.includes(s.file.sha256))) add('RAW_GENERATION_REQUIRED', a.assetId);
      if (!fileAt(p.settingsPath) || !fileAt(p.promptOrScriptPath)) add('PRODUCTION_INPUT_MISSING', a.assetId);
      const found = assetRecords.find(([, r]) => r.type === 'production' && r.details['eventId'] === p.eventId);
      const r = get(found?.[0], a, 'PRODUCTION_EVIDENCE_MISSING');
      if (r) {
        const d = r.details;
        if (r.status !== 'passed' || !covers(r.hashes, p.outputHashes)) add('PRODUCTION_EVIDENCE_MISSING', a.assetId);
        if (d['method'] !== p.method || d['tool'] !== p.tool) add('PRODUCTION_METHOD_MISMATCH', a.assetId);
        for (const k of ['version', 'modelRevision', 'eventId', 'settingsPath', 'promptOrScriptPath', 'referenceHashes', 'outputHashes'] as const) if (!isDeepStrictEqual(d[k], p[k])) add('PRODUCTION_EVIDENCE_MISMATCH', a.assetId);
        if (hashAt(p.settingsPath) !== d['settingsSha256'] || hashAt(p.promptOrScriptPath) !== d['promptSha256']) add('PRODUCTION_INPUT_MISSING', a.assetId);
      }
    }
    if (accepted) for (const source of a.sources.filter(s => ['native', 'master'].includes(s.role))) {
      if (!a.production.some(p => p.outputHashes.includes(source.file.sha256))) add('SOURCE_PRODUCTION_LINEAGE', a.assetId, source.file.path);
    }
    // Non-generator production is legitimate: preserve composition/MIDI/synthesis
    // source as appropriate; only methods actually claiming generation require raw output.
    if (accepted && ['scene-layer', 'portrait', 'illustration'].includes(a.kind)) {
      const ancestry = [a], visited = new Set<string>(); let hasOpenAI = false;
      while (ancestry.length) { if (++graphSteps > 2_000_000) { add('GRAPH_LIMIT'); return result; } const node = ancestry.pop()!; if (visited.has(node.assetId)) continue; visited.add(node.assetId); if (node.production.some(p => p.method === 'openai-generated')) hasOpenAI = true; for (const id of node.derivedFrom) { const parent = byId.get(id); if (parent) ancestry.push(parent); } }
      if (!hasOpenAI) add('OPENAI_LINEAGE_REQUIRED', a.assetId);
    }
    if (accepted || a.rights.reviewStatus === 'accepted') {
      const rights = a.rights;
      if (!rights.creators.length || !rights.licenseIds.length || !rights.noticePaths.length || [...rights.noticePaths, ...rights.termsSnapshotPaths, ...rights.inputPermissionPaths].some(p => !fileAt(p)) || (a.production.some(p => generated(p.method)) && (!rights.termsSnapshotPaths.length || !nonempty(rights.aiDisclosure)))) add('RIGHTS_INCOMPLETE', a.assetId);
      const found = assetRecords.find(([, r]) => r.type === 'rights');
      const r = get(found?.[0], a, 'RIGHTS_EVIDENCE_MISSING');
      if (r) {
        const d = r.details;
        if (r.status !== 'passed') add('RIGHTS_REVIEW_NOT_PASSED', a.assetId);
        if (d['permitsCommercialReuse'] !== true || d['permitsRedistribution'] !== true || d['permitsModification'] !== true || rights.licenseIds.some(x => /(?:^|-)N[CD](?:-|$)|noncommercial|no.derivatives|all.rights.reserved/i.test(x))) add('RIGHTS_INCOMPATIBLE', a.assetId);
        if (!covers(r.hashes, hashes) || !isDeepStrictEqual(d['licenseIds'], rights.licenseIds)) add('RIGHTS_HASH_MISMATCH', a.assetId);
        for (const [paths, field] of [[rights.noticePaths, 'noticeHashes'], [rights.termsSnapshotPaths, 'termsHashes'], [rights.inputPermissionPaths, 'permissionHashes']] as const) if (!covers(d[field], paths.map(p => hashAt(p) ?? 'missing'))) add('RIGHTS_HASH_MISMATCH', a.assetId);
        // References produced by this same asset's own editing chain are covered
        // by its output rights; external references require explicit permission.
        const ownOutputs = new Set(a.production.flatMap(p => p.outputHashes));
        const external = references.filter(h => !ownOutputs.has(h));
        if (external.length && (!rights.inputPermissionPaths.length || !covers(d['referenceHashes'], external))) add('REFERENCE_RIGHTS_MISSING', a.assetId);
      } else if (references.length && !rights.inputPermissionPaths.length) add('REFERENCE_RIGHTS_MISSING', a.assetId);
    }
    const required = accepted ? ['structure', 'source-reopen', audio ? 'listening' : 'visual', 'browser-comparison', 'rights', 'budget'] : [];
    for (const check of required) if (!a.verification.some(v => v.check === check)) add('REVIEW_REQUIRED', a.assetId);
    for (const v of a.verification) {
      // Honest nonquota work may record a pending/failed review; it cannot claim
      // passage, count, or borrow evidence of another asset.
      if (!accepted && v.status !== 'passed') continue;
      const r = get(v.evidencePath, a, v.check === 'rights' ? 'RIGHTS_EVIDENCE_MISSING' : 'REVIEW_EVIDENCE_MISSING');
      if (!r) continue;
      if (r.assetId !== a.assetId || r.check !== v.check || r.type !== (v.check === 'rights' ? 'rights' : 'review')) add('REVIEW_ASSET_MISMATCH', a.assetId);
      if (v.status !== 'passed' || r.status !== 'passed') add('REVIEW_NOT_PASSED', a.assetId);
      if (!covers(r.hashes, hashes) || !covers(v.hashes, hashes)) add('REVIEW_HASH_MISMATCH', a.assetId);
      if (r.reviewer !== v.reviewer || r.date !== v.date || r.environment !== v.environment) add('REVIEW_IDENTITY_MISMATCH', a.assetId);
      if (['listening', 'owner'].includes(v.check) && r.actor !== 'human') add('REVIEW_HUMAN_REQUIRED', a.assetId);
      if (v.check === 'listening' && !covers(r.details['methods'], ['headphones', 'ordinary-speakers'])) add('LISTENING_METHODS_REQUIRED', a.assetId);
      if (v.check === 'visual' || v.check === 'browser-comparison') {
        if (!['human', 'agent'].includes(r.actor) || !covers(r.details['methods'], [v.check === 'visual' ? 'image-inspection' : 'browser-inspection']) || !nonempty(r.details['findings']) || !nonempty(r.details['tool']) || !covers(r.details['observedPaths'], [...a.sources.map(s => s.file.path), ...a.exports.map(e => e.file.path)])) add('REVIEW_OBSERVATION_REQUIRED', a.assetId);
      }
    }
    for (const e of a.exports) if (accepted && !a.verification.some(v => v.check === 'browser-comparison' && v.evidencePath === e.integrationEvidencePath)) add('REVIEW_REQUIRED', a.assetId, e.integrationEvidencePath);
    for (const use of a.usedBy) {
      const target = entities.get(use.contentId);
      if (!target) add('USE_TARGET_UNRESOLVED', a.assetId);
      const allowed: Record<string, [string[], string[]]> = {
        'character-model': [['character-placement'], ['room']], 'prop-model': [['prop-placement'], ['room']],
        'scene-layer': [['background', 'midground', 'foreground', 'atmosphere'], ['room']],
        'portrait': [['compendium-portrait'], ['character']], 'illustration': [['inventory-illustration', 'diagnostic-illustration'], ['item', 'evidence', 'diagnostic', 'objective']],
        'sprite-sheet': [['sprite-animation'], ['room', 'character']], music: [['music'], ['room', 'title']], ambience: [['ambience'], ['room']], effect: [['effect'], ['action']], voice: [['voice-line'], ['dialogue-line']],
      };
      const [verbs, kinds] = allowed[a.kind]!;
      if (!verbs.includes(use.use) || (target && !kinds.includes(target.kind)) || (a.kind === 'scene-layer' && use.use !== a.image?.layerRole)) add('USE_KIND_MISMATCH', a.assetId);
      const bindings = evidence.content.uses.filter(u => u.assetId === a.assetId && u.contentId === use.contentId && u.use === use.use);
      if (!bindings.length) add('RUNTIME_USE_MISSING', a.assetId);
      if (bindings.some(b => !a.exports.some(e => e.file.path === b.exportPath))) add('RUNTIME_EXPORT_MISMATCH', a.assetId);
      const r = get(use.evidencePath, a, 'USE_EVIDENCE_MISMATCH');
      if (r) {
        const proofBindings = r.details['bindings'];
        if (r.assetId !== a.assetId || r.type !== 'usage' || r.status !== 'passed' || !Array.isArray(proofBindings) || !bindings.every(b => proofBindings.some(p => isDeepStrictEqual(p, b))) || !covers(r.hashes, bindings.flatMap(b => a.exports.filter(e => e.file.path === b.exportPath).map(e => e.file.sha256)))) add('USE_EVIDENCE_MISMATCH', a.assetId);
        if (r.details['visible'] !== true || r.details['meaningful'] !== true) add('USE_NOT_MEANINGFUL', a.assetId);
      }
    }
    if ((accepted || a.usedBy.length) && a.interactiveOrEvidence && !evidence.content.uses.some(b => b.assetId === a.assetId && b.interactiveOrEvidence && a.usedBy.some(u => u.contentId === b.contentId && u.use === b.use))) add('INTERACTION_UNVERIFIED', a.assetId);
    if (accepted && a.image) for (const path of [a.image.cameraRecordPath, a.image.registrationPath]) if (!object(decodeJson(fileAt(path)))) add('IMAGE_REGISTRATION_MISSING', a.assetId, path);
    if (accepted && audio) {
      const au = a.audio!;
      if (!a.sources.some(s => s.role === 'native' && s.application === 'Audacity' && /^4(?:\.|$)/.test(s.version) && s.file.format === 'aup4' && s.file.path.endsWith('.aup4') && s.file.path === au.nativeProjectPath)) add('AUDACITY4_SOURCE_REQUIRED', a.assetId);
      if (!a.sources.some(s => s.role === 'master' && ['wav', 'aiff', 'flac'].includes(s.file.format) && s.file.path === au.masterPath)) add('AUDIO_MASTER_REQUIRED', a.assetId);
      if ((au.loopStartSample === null) !== (au.loopEndSample === null) || (au.loopStartSample !== null && au.loopEndSample !== null && (au.loopStartSample < 0 || au.loopStartSample >= au.loopEndSample || au.loopEndSample > au.durationSeconds * au.sampleRate))) add('AUDIO_LOOP_RANGE', a.assetId);
      if (a.kind === 'voice') {
        const line = entities.get(au.captionId ?? ''), voice = decodeJson(fileAt(au.voiceRecordPath ?? ''));
        if (!object(voice)) add('VOICE_RECORD_MISSING', a.assetId);
        if (!line || line.kind !== 'dialogue-line' || !nonempty(line.text) || !a.usedBy.some(u => u.contentId === au.captionId)) add('VOICE_TEXT_LINK', a.assetId);
        if (line && !speakers.includes(line.speakerId ?? '')) add('VOICE_SPEAKER_UNSUPPORTED', a.assetId);
        if (object(voice)) {
          if (voice['lineId'] !== au.captionId || voice['speakerId'] !== line?.speakerId || voice['text'] !== line?.text || !nonempty(voice['voiceId']) || !nonempty(voice['tool']) || !nonempty(voice['modelRevision'])) add('VOICE_TEXT_LINK', a.assetId);
          const path = typeof voice['scriptPath'] === 'string' ? voice['scriptPath'] : '';
          if (!fileAt(path) || new TextDecoder().decode(fileAt(path)) !== line?.text || hashAt(path) !== voice['scriptSha256']) add('VOICE_TEXT_LINK', a.assetId);
          const event = assetRecords.find(([, r]) => r.type === 'production' && r.details['method'] === 'tts-generated')?.[1];
          if (!event || hashAt(au.voiceRecordPath ?? '') !== event.details['voiceRecordSha256'] || ['tool', 'version', 'modelRevision'].some(k => voice[k] !== event.details[k])) add('VOICE_RECORD_MISSING', a.assetId);
        }
      }
    }
  }
  // Files reused by distinct source objects are valid; duplicate finished outputs
  // under different quota identities are not. Shared placements remain one asset.
  const exports = new Map<string, Asset>();
  for (const a of assets.filter(a => a.countsTowardQuota)) for (const e of a.exports) {
    const old = exports.get(e.file.sha256);
    if (old && old.assetId !== a.assetId) {
      const code = a.kind === 'scene-layer' && old.kind === 'scene-layer' ? 'DUPLICATE_LAYER_EXPORT' : a.image && old.image ? 'DUPLICATE_IMAGE_EXPORT' : 'DUPLICATE_EXPORT';
      add(code, old.assetId); add(code, a.assetId);
    } else exports.set(e.file.sha256, a);
  }
  const invalid = new Set(result.issues.flatMap(i => i.assetId ? [i.assetId] : []));
  let changed = true;
  while (changed) { changed = false; for (const a of assets) if (a.status === 'accepted' && !invalid.has(a.assetId) && a.derivedFrom.some(id => invalid.has(id) || byId.get(id)?.status !== 'accepted')) { invalid.add(a.assetId); add('DERIVATION_NOT_ACCEPTED', a.assetId); changed = true; } }
  const counted = assets.filter(a => a.status === 'accepted' && a.countsTowardQuota && !invalid.has(a.assetId));
  const keys: Partial<Record<Asset['kind'], keyof AssetCounts>> = { 'character-model': 'characterModels', 'prop-model': 'props', 'scene-layer': 'sceneLayers', portrait: 'portraits', illustration: 'illustrations', music: 'music', ambience: 'ambience', effect: 'effects', voice: 'voices' };
  for (const a of counted) { const key = keys[a.kind]; if (key) result.counts[key]++; if (a.kind === 'prop-model' && a.interactiveOrEvidence) result.counts.interactiveProps++; }
  const completeRooms = roomIds.filter(id => {
    const layers = counted.filter(a => a.kind === 'scene-layer' && a.usedBy.some(u => u.contentId === id));
    return layers.some(a => a.image?.layerRole === 'background') && layers.filter(a => ['foreground', 'midground', 'atmosphere'].includes(a.image?.layerRole ?? '')).length >= 2;
  });
  result.counts.roomsWithImageSet = completeRooms.length;
  if (options.mode === 'release') {
    for (const key of Object.keys(minimums) as (keyof AssetCounts)[]) if (result.counts[key] < minimums[key]) add('QUOTA_MINIMUM', undefined, key);
    for (const [prefix, length, width, kind] of [['CH', 25, 2, 'character-model'], ['PR', 150, 3, 'prop-model']] as const) for (let i = 1; i <= length; i++) if (!counted.some(a => a.kind === kind && a.semanticIdentity === `spec001:${prefix}${String(i).padStart(width, '0')}`)) add('REQUIRED_IDENTITY_MISSING', undefined, `spec001:${prefix}${String(i).padStart(width, '0')}`);
    if (completeRooms.length !== 12) add('ROOM_IMAGE_SET_INCOMPLETE');
    const targets = (kind: string) => new Set(counted.filter(a => a.kind === kind).flatMap(a => a.usedBy.map(u => u.contentId)));
    if (!musicTargets.every(id => targets('music').has(id))) add('MUSIC_COVERAGE');
    if (!roomIds.every(id => targets('ambience').has(id))) add('AMBIENCE_COVERAGE');
    if (!speakers.every(speaker => counted.some(a => a.kind === 'voice' && entities.get(a.audio?.captionId ?? '')?.speakerId === speaker))) add('VOICE_SPEAKER_COVERAGE');
    for (let n = 1; n <= 25; n++) if (!counted.some(a => a.kind === 'portrait' && a.usedBy.some(u => u.contentId === `spec001:CH${String(n).padStart(2, '0')}`))) add('PORTRAIT_COVERAGE');
  }
  if (issueLimit) { result.issues.push({ code: 'ISSUE_LIMIT' }); result.counts = emptyCounts(); }
  result.valid = result.issues.length === 0;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // Finish evaluating the pure module before the adapter imports its exports.
  void import('./asset-files.ts').then(async ({ runAssetCli }) => { process.exitCode = await runAssetCli(process.argv.slice(2)); }).catch(() => {
    process.stdout.write(`${JSON.stringify({ valid: false, issues: [{ code: 'CLI_FAILED' }], counts: emptyCounts() })}\n`);
    process.exitCode = 1;
  });
}
