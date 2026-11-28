// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import type { FileHandle } from 'node:fs/promises';
import { lstat, open, realpath, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from '../src/content/registry.ts';
import { emptyCounts, manifestRenditions } from './asset-types.ts';
import type { AssetEvidenceSnapshot, AssetFileDigest, AssetEntity, AssetIssue, AssetUse, ConditionalBinding, AssetManifest, AssetValidationResult } from './asset-types.ts';
import { isAssetManifest, isEvidenceRecord, validateAssetObservations } from './validate-assets.ts';

const jsonLimit = 4_194_304, fileLimit = 268_435_456, totalLimit = 1_073_741_824;
// The complete episode manifest includes per-asset review hashes for every finished rendition.
const canonicalManifestLimit = 8 * 1024 * 1024;
// Bound total media I/O independently from the original 1 GiB in-memory evidence ceiling.
const mediaReadLimit = 8 * totalLimit;
const mediaFile = /\.(?:aup4|blend|glb|png|webp|avif|jpe?g|wav|ogg|flac|mp3|zip|tar|gz)$/i;
const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
class AuditError extends Error {
  readonly code: string;
  readonly path: string | undefined;
  constructor(code: string, path?: string) { super(code); this.code = code; this.path = path; }
}
export function publicAssetPath(path: string): boolean {
  if (!path || path.length > 512 || !/^[A-Za-z0-9_./ -]+$/.test(path)) return false;
  const parts = path.split('/');
  if (parts.some(p => !p || p.startsWith('.') || /^(?:private|operator|credentials?|secrets?|sessions?|backups?|players?|test-synthetic|feasibility)(?:$|[-_.])/i.test(p) || /\.(?:sqlite\d?|db|pem|key|env|log|bak)(?:$|[.-])/i.test(p))) return false;
  return path === 'LICENSE-ASSETS'
    || /^(?:assets-src\/|public\/assets\/|docs\/evidence\/spec001\/|content\/spec001\/|LICENSES\/|LICENSE(?:\.[A-Za-z0-9-]+)?$|NOTICE(?:\.[A-Za-z0-9-]+)?$)/.test(path);
}

/** Rooted, nonexecuting reader. Preflight and descriptor checks precede reads;
 * symlinks (including internal ones), devices, FIFOs and oversized files fail.
 * No URL retrieval, archive extraction, secret lookup or media write occurs. */
export class AssetFileReader {
  private total = 0;
  private streamed = 0;
  private readonly cache = new Map<string, Uint8Array>();
  private readonly root: string;
  private constructor(root: string) { this.root = root; }
  static async create(root: string): Promise<AssetFileReader> { return new AssetFileReader(await realpath(root)); }
  private async check(path: string, directory = false): Promise<string> {
    if (!publicAssetPath(path)) throw new AuditError('PATH_DENIED', path);
    const target = resolve(this.root, path), rel = relative(this.root, target);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new AuditError('PATH_DENIED', path);
    let current = this.root;
    for (const [i, segment] of path.split('/').entries()) {
      current = resolve(current, segment);
      const status = await lstat(current);
      if (status.isSymbolicLink()) throw new AuditError('SYMLINK_DENIED', path);
      if ((i < path.split('/').length - 1 || directory) && !status.isDirectory()) throw new AuditError('FILE_TYPE_INVALID', path);
    }
    const canonical = await realpath(target);
    if (canonical !== target) throw new AuditError('SYMLINK_DENIED', path);
    return target;
  }
  private async withCheckedFile<T>(path: string, limit: number, consume: (file: FileHandle, size: number) => Promise<T>): Promise<T> {
    const target = await this.check(path);
    const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = await file.stat();
      if (!before.isFile()) throw new AuditError('FILE_TYPE_INVALID', path);
      if (before.size > limit) throw new AuditError('FILE_TOO_LARGE', path);
      await this.check(path);
      const current = await lstat(target);
      if (current.ino !== before.ino || current.dev !== before.dev) throw new AuditError('FILE_CHANGED', path);
      const result = await consume(file, before.size);
      const after = await file.stat();
      if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) throw new AuditError('FILE_CHANGED', path);
      return result;
    } finally { await file.close(); }
  }
  async read(path: string, limit = fileLimit): Promise<Uint8Array> {
    const existing = this.cache.get(path);
    if (existing) { if (existing.byteLength > limit) throw new AuditError('FILE_TOO_LARGE', path); return existing; }
    const bytes = await this.withCheckedFile(path, limit, async (file, size) => {
      if (this.total + size > totalLimit || this.cache.size >= 100_000) throw new AuditError('EVIDENCE_LIMIT', path);
      const data = Buffer.alloc(size);
      for (let offset = 0; offset < size;) {
        const { bytesRead } = await file.read(data, offset, size - offset, offset);
        if (!bytesRead) throw new AuditError('FILE_CHANGED', path);
        offset += bytesRead;
      }
      return data;
    });
    this.total += bytes.byteLength;
    this.cache.set(path, bytes);
    return bytes;
  }
  async measureMedia(path: string): Promise<AssetFileDigest> {
    return this.withCheckedFile(path, fileLimit, async (file, size) => {
      if (this.streamed + size > mediaReadLimit) throw new AuditError('EVIDENCE_LIMIT', path);
      this.streamed += size;
      const buffer = Buffer.allocUnsafe(Math.min(size, 256 * 1024));
      const hash = createHash('sha256');
      for (let offset = 0; offset < size;) {
        const { bytesRead } = await file.read(buffer, 0, Math.min(buffer.length, size - offset), offset);
        if (!bytesRead) throw new AuditError('FILE_CHANGED', path);
        hash.update(buffer.subarray(0, bytesRead));
        offset += bytesRead;
      }
      return { bytes: size, sha256: hash.digest('hex') };
    });
  }
  async json(path: string): Promise<unknown> {
    const bytes = await this.read(path, path === 'assets-src/manifest.json' ? canonicalManifestLimit : jsonLimit);
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new AuditError('JSON_INVALID', path); }
  }
  async evidencePaths(): Promise<string[]> {
    const base = 'docs/evidence/spec001/assets';
    try { await this.check(base, true); } catch (error) { if (isMissing(error)) return []; throw error; }
    const pending = [{ path: base, depth: 0 }], found: string[] = []; let entries = 0;
    while (pending.length) {
      const current = pending.pop()!;
      if (current.depth > 8) throw new AuditError('EVIDENCE_LIMIT', current.path);
      const directory = await this.check(current.path, true);
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (++entries > 50_000) throw new AuditError('EVIDENCE_LIMIT', base);
        const path = `${current.path}/${entry.name}`;
        if (!publicAssetPath(path)) throw new AuditError('PATH_DENIED', path);
        if (entry.isSymbolicLink()) throw new AuditError('SYMLINK_DENIED', path);
        if (entry.isDirectory()) pending.push({ path, depth: current.depth + 1 });
        else if (entry.name.endsWith('.json')) found.push(path);
      }
    }
    return found.sort();
  }
}
function isMissing(error: unknown): boolean { return isObject(error) && error['code'] === 'ENOENT'; }
function issueFor(error: unknown, fallback: string, path?: string): AssetIssue {
  return { code: error instanceof AuditError ? error.code : isMissing(error) ? 'FILE_MISSING' : fallback, ...(path ? { path } : error instanceof AuditError && error.path ? { path: error.path } : {}) };
}

/** Content admission uses the same registered world/documents as the client.
 * Existing graybox asset IDs alone never invent a runtime export path. Final
 * presentation integration must author exact asset/export/use bindings in the
 * registered content schema before this adapter can observe them. */
export async function loadAuthoredAssetContent(reader: AssetFileReader): Promise<AssetEvidenceSnapshot['content']> {
  const world = await reader.json('content/spec001/world.json'), sources = await reader.json('content/spec001/sources.json');
  const initial = validateContent({ world, sources, documents: {}, allowUnloadedDocuments: true });
  if (!initial.ok) throw new AuditError('CONTENT_INVALID');
  const documents: Record<string, unknown> = Object.create(null);
  for (const path of initial.documentPaths) documents[path] = await reader.json(path);
  const checked = validateContent({ world, sources, documents });
  if (!checked.ok) throw new AuditError('CONTENT_INVALID');
  const result = extractAuthoredAssetContent(world, Object.values(documents));
  const conditionalBindings: ConditionalBinding[] = [];
  for (const room of Object.values(documents)) {
    if (!isObject(room) || room['kind'] !== 'room' || typeof room['id'] !== 'string' || !Array.isArray(room['mediaBindings'])) continue;
    const roomId = room['id'], code = roomId.slice(8);
    let audio: unknown = [];
    try { audio = await reader.json(`content/spec001/presentation/${code}.audio.json`); }
    catch (error) { if (!isMissing(error)) throw error; }
    if (!Array.isArray(audio)) throw new AuditError('CONDITIONAL_AUDIO_INVALID', code);
    for (const b of room['mediaBindings'] as AssetUse[]) {
      let trigger: string | undefined;
      if (b.use === 'party-placement') trigger = 'active-party/' + b.assetId.replace(':ASSET-', ':');
      if (['effect','voice-line','music','ambience'].includes(b.use)) {
        const row = audio.find(row => isObject(row) && row['roomId'] === roomId && row['assetId'] === b.assetId && row['exportPath'] === b.exportPath);
        if (row && typeof row['trigger'] === 'string' && row['trigger'] !== 'arrival') trigger = row['trigger'];
      }
      if (trigger) conditionalBindings.push({roomId, assetId:b.assetId, contentId:b.contentId, use:b.use, exportPath:b.exportPath, trigger});
    }
  }
  return {...result, conditionalBindings};
}

export function extractAuthoredAssetContent(world: unknown, documents: unknown[]): AssetEvidenceSnapshot['content'] {
  const entities = new Map<string, AssetEntity>(), uses: AssetUse[] = [];
  const put = (entity: AssetEntity) => { const old = entities.get(entity.id); if (old && old.kind !== entity.kind) throw new AuditError('CONTENT_IDENTITY_DUPLICATE'); entities.set(entity.id, entity); };
  if (isObject(world)) for (const [key, kind] of [['rooms', 'room'], ['characters', 'character'], ['props', 'prop']] as const) {
    const rows = world[key]; if (Array.isArray(rows)) for (const row of rows) if (isObject(row) && typeof row['id'] === 'string') put({ id: row['id'], kind });
  }
  // Narrator/title are actual fixed surfaces, not accepted media allocations.
  put({ id: 'narrator', kind: 'narrator' }); put({ id: 'spec001:TITLE', kind: 'title' });
  const stack = documents.map(value => ({ value, depth: 0 })); let nodes = 0;
  while (stack.length) {
    const { value, depth } = stack.pop()!;
    if (++nodes > 200_000 || depth > 32) throw new AuditError('CONTENT_LIMIT');
    if (Array.isArray(value)) { for (const child of value) stack.push({ value: child, depth: depth + 1 }); continue; }
    if (!isObject(value)) continue;
    if (typeof value['id'] === 'string') {
      if (typeof value['speakerId'] === 'string' && typeof value['text'] === 'string') put({ id: value['id'], kind: 'dialogue-line', speakerId: value['speakerId'], text: value['text'] });
      else if (typeof value['kind'] === 'string' && ['room', 'character', 'prop', 'item', 'objective', 'action', 'evidence', 'diagnostic'].includes(value['kind'])) put({ id: value['id'], kind: value['kind'] });
      else if (value['id'].startsWith('spec001:FACT-') && typeof value['roomId'] === 'string' && typeof value['text'] === 'string' && Array.isArray(value['subjectIds'])) put({ id: value['id'], kind: 'evidence' });
      else if (value['id'].startsWith('spec001:ACTION-')) put({ id: value['id'], kind: 'action' });
    }
    // Only an exact binding in registered authored data supplies a use. Metadata
    // rosters, generic assetId references and manifest.usedBy are insufficient.
    if (['assetId', 'contentId', 'use', 'exportPath'].every(key => typeof value[key] === 'string') && typeof value['interactiveOrEvidence'] === 'boolean') {
      const binding = value as unknown as AssetUse;
      if (!binding.exportPath.startsWith('public/assets/') || !publicAssetPath(binding.exportPath)) throw new AuditError('PATH_DENIED', binding.exportPath);
      uses.push({ assetId: binding.assetId, contentId: binding.contentId, use: binding.use, exportPath: binding.exportPath, interactiveOrEvidence: binding.interactiveOrEvidence });
    }
    for (const child of Object.values(value)) if (typeof child === 'object' && child !== null) stack.push({ value: child, depth: depth + 1 });
  }
  return { entities: [...entities.values()], uses };
}

function manifestPaths(manifest: AssetManifest): { files: Set<string>; records: Set<string> } {
  const files = new Set<string>(), records = new Set<string>();
  const proof = (path: string | undefined) => { if (path) { files.add(path); records.add(path); } };
  for (const a of manifestRenditions(manifest)) {
    for (const s of a.sources) { files.add(s.file.path); if (a.status === 'accepted' || a.verification.some(v => v.status === 'passed' && v.evidencePath === s.reopenEvidencePath)) proof(s.reopenEvidencePath); if (s.retrieval) files.add(s.retrieval.instructionsPath); }
    for (const e of a.exports) { files.add(e.file.path); if (a.status === 'accepted' || a.verification.some(v => v.status === 'passed' && v.evidencePath === e.integrationEvidencePath)) proof(e.integrationEvidencePath); }
    for (const p of a.production) { files.add(p.settingsPath); files.add(p.promptOrScriptPath); }
    for (const path of [...a.rights.noticePaths, ...a.rights.termsSnapshotPaths, ...a.rights.inputPermissionPaths]) files.add(path);
    for (const v of a.verification) if (a.status === 'accepted' || v.status === 'passed') proof(v.evidencePath);
    for (const u of a.usedBy) {
      proof(u.evidencePath);
      if (u.spriteSubject) {
        const code = u.contentId.slice(8);
        files.add('content/spec001/presentation/'+code+'.json'); files.add('content/spec001/rooms/'+code+'.json');
        files.add(u.spriteSubject.drawsPath); files.add(u.spriteSubject.stageInspectionPath);
      }
    }
    if (a.image) { files.add(a.image.cameraRecordPath); files.add(a.image.registrationPath); }
    if (a.audio) { files.add(a.audio.nativeProjectPath); files.add(a.audio.masterPath); if (a.audio.voiceRecordPath) files.add(a.audio.voiceRecordPath); }
  }
  return { files, records };
}

/** Batch fragments can be partial. The canonical inventory must also cover
 * every exact registered export/use exposed by the game, in the reverse direction. */
export function missingRegisteredAssetUses(manifest: AssetManifest, uses: readonly AssetUse[], authored: readonly ConditionalBinding[] = [], mode: 'inventory' | 'release' = 'inventory'): AssetIssue[] {
  const represented = new Map<string, Set<string>>();
  for (const a of manifestRenditions(manifest)) {
    const locations = new Set(a.usedBy.map(u => JSON.stringify([u.contentId, u.use])));
    for (const { file } of a.exports) {
      represented.set(JSON.stringify([a.assetId, file.path]), locations);
    }
  }
  const key = (u: Pick<AssetUse, 'assetId' | 'contentId' | 'use' | 'exportPath'>) => JSON.stringify([u.assetId, u.contentId, u.use, u.exportPath]);
  const pending = new Set<string>(), issues: AssetIssue[] = [];
  for (const declaration of manifest.conditionalBindings ?? []) {
    const id = key(declaration);
    const registered = authored.some(row => row.roomId === declaration.roomId && row.trigger === declaration.trigger && key(row) === id);
    const locations = represented.get(JSON.stringify([declaration.assetId, declaration.exportPath]));
    if (!registered || !uses.some(u => key(u) === id) || !locations || !['party-placement','effect','voice-line','music','ambience'].includes(declaration.use) ||
      locations.has(JSON.stringify([declaration.contentId, declaration.use])) || pending.has(id)) {
      issues.push({ code:'CONDITIONAL_BINDING_MISMATCH', assetId:declaration.assetId, path:declaration.exportPath });
    } else {
      pending.add(id);
      if (mode === 'release') issues.push({ code:'CONDITIONAL_USE_UNOBSERVED', assetId:declaration.assetId, path:declaration.exportPath });
    }
  }
  const missing = uses.filter(u => !pending.has(key(u)) && !represented.get(JSON.stringify([u.assetId, u.exportPath]))?.has(JSON.stringify([u.contentId, u.use])))
    .map(u => ({ code: 'REGISTERED_USE_MISSING', assetId: u.assetId, path: u.exportPath }));
  return [...issues, ...missing];
}

export async function auditAssetRepository(root: string, mode: 'inventory' | 'release', manifestPath = 'assets-src/manifest.json'): Promise<AssetValidationResult> {
  const failures: AssetIssue[] = [];
  const empty = () => ({ valid: false, issues: failures, counts: emptyCounts() });
  try {
    const reader = await AssetFileReader.create(root), manifest = await reader.json(manifestPath);
    if (!isAssetManifest(manifest)) { failures.push({ code: 'SCHEMA_INVALID', path: manifestPath }); return empty(); }
    const snapshot: AssetEvidenceSnapshot = { files: Object.create(null), records: Object.create(null), content: { entities: [], uses: [] } };
    const files: Record<string, Uint8Array> = Object.create(null), records: Record<string, AssetEvidenceSnapshot['records'][string]> = Object.create(null);
    const paths = manifestPaths(manifest);
    const media = new Map<string, AssetFileDigest>();
    const renditions = manifestRenditions(manifest);
    const parsedPaths = new Set(renditions.flatMap(a => [
      ...a.production.map(event => event.promptOrScriptPath),
      ...(a.image ? [a.image.cameraRecordPath, a.image.registrationPath] : []),
      ...(a.audio?.voiceRecordPath ? [a.audio.voiceRecordPath] : []),
    ]));
    for (const path of await reader.evidencePaths()) paths.records.add(path);
    for (const path of paths.records) {
      try {
        const record = await reader.json(path); files[path] = await reader.read(path, jsonLimit);
        if (!isEvidenceRecord(record)) { failures.push({ code: 'EVIDENCE_INVALID', path }); continue; }
        records[path] = record;
        if (record.type === 'retrieval' && typeof record.details['archivePath'] === 'string') paths.files.add(record.details['archivePath']);
      } catch (error) { failures.push(issueFor(error, 'EVIDENCE_READ_FAILED', path)); }
    }
    if (new Set([...paths.files, ...paths.records]).size > 100_000) throw new AuditError('EVIDENCE_LIMIT');
    for (const path of paths.files) {
      if (Object.hasOwn(files, path)) continue;
      try {
        if (mediaFile.test(path) && !parsedPaths.has(path)) media.set(path, await reader.measureMedia(path));
        else files[path] = await reader.read(path);
      } catch (error) { failures.push(issueFor(error, 'FILE_READ_FAILED', path)); }
    }
    snapshot.content = await loadAuthoredAssetContent(reader);
    if (manifestPath === 'assets-src/manifest.json') failures.push(...missingRegisteredAssetUses(manifest, snapshot.content.uses, snapshot.content.conditionalBindings, mode));
    const validated = validateAssetObservations(manifest, { ...snapshot, files, records }, { mode }, media);
    // An adapter failure cannot yield accepted counts, even if unreferenced
    // evidence was malformed or a content dependency could not be read safely.
    if (failures.length) return { valid: false, issues: [...failures, ...validated.issues], counts: emptyCounts() };
    return validated;
  } catch (error) { failures.push(issueFor(error, 'AUDIT_FAILED')); return empty(); }
}

export async function runAssetCli(args: string[]): Promise<number> {
  let root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), mode: 'inventory' | 'release' = 'inventory', manifest = 'assets-src/manifest.json';
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1];
    if (!key || !value || seen.has(key) || !['--root', '--mode', '--manifest'].includes(key)) { process.stdout.write(`${JSON.stringify({ valid: false, issues: [{ code: 'ARGUMENT_INVALID' }], counts: emptyCounts() })}\n`); return 2; }
    seen.add(key);
    if (key === '--root') root = resolve(value);
    if (key === '--manifest') manifest = value;
    if (key === '--mode') {
      if (value !== 'inventory' && value !== 'release') { process.stdout.write(`${JSON.stringify({ valid: false, issues: [{ code: 'MODE_INVALID' }], counts: emptyCounts() })}\n`); return 2; }
      mode = value;
    }
  }
  const result = await auditAssetRepository(root, mode, manifest);
  process.stdout.write(`${JSON.stringify({ mode, ...result, scope: 'Offline source/evidence consistency; no human audition, owner approval, finished-room or gate certification.' }, null, 2)}\n`);
  return result.valid ? 0 : 1;
}
