// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { constants } from 'node:fs';
import { lstat, open, realpath, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from '../src/content/registry.ts';
import { emptyCounts } from './asset-types.ts';
import type { AssetEvidenceSnapshot, AssetEntity, AssetIssue, AssetUse, AssetManifest, AssetValidationResult } from './asset-types.ts';
import { isAssetManifest, isEvidenceRecord, validateAssetManifest } from './validate-assets.ts';

const jsonLimit = 4_194_304, fileLimit = 268_435_456, totalLimit = 1_073_741_824;
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
  async read(path: string, limit = fileLimit): Promise<Uint8Array> {
    const existing = this.cache.get(path);
    if (existing) { if (existing.byteLength > limit) throw new AuditError('FILE_TOO_LARGE', path); return existing; }
    const target = await this.check(path);
    const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const status = await file.stat();
      if (!status.isFile()) throw new AuditError('FILE_TYPE_INVALID', path);
      if (status.size > limit) throw new AuditError('FILE_TOO_LARGE', path);
      if (this.total + status.size > totalLimit || this.cache.size >= 100_000) throw new AuditError('EVIDENCE_LIMIT', path);
      await this.check(path);
      const current = await lstat(target);
      if (current.ino !== status.ino || current.dev !== status.dev) throw new AuditError('FILE_CHANGED', path);
      // Read the admitted size, never an unbounded readFile after a racing grow.
      const bytes = Buffer.alloc(status.size + 1); let offset = 0;
      while (offset < bytes.length) { const read = await file.read(bytes, offset, bytes.length - offset, offset); if (read.bytesRead === 0) break; offset += read.bytesRead; }
      const after = await file.stat();
      if (offset !== status.size || after.size !== status.size || after.mtimeMs !== status.mtimeMs) throw new AuditError('FILE_CHANGED', path);
      this.total += offset;
      const result = bytes.subarray(0, offset); this.cache.set(path, result); return result;
    } finally { await file.close(); }
  }
  async json(path: string): Promise<unknown> {
    const bytes = await this.read(path, jsonLimit);
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
async function loadContent(reader: AssetFileReader): Promise<AssetEvidenceSnapshot['content']> {
  const world = await reader.json('content/spec001/world.json'), sources = await reader.json('content/spec001/sources.json');
  const initial = validateContent({ world, sources, documents: {}, allowUnloadedDocuments: true });
  if (!initial.ok) throw new AuditError('CONTENT_INVALID');
  const documents: Record<string, unknown> = Object.create(null);
  for (const path of initial.documentPaths) documents[path] = await reader.json(path);
  const checked = validateContent({ world, sources, documents });
  if (!checked.ok) throw new AuditError('CONTENT_INVALID');
  return extractAuthoredAssetContent(world, Object.values(documents));
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
  for (const a of manifest.assets) {
    for (const s of a.sources) { files.add(s.file.path); if (a.status === 'accepted' || a.verification.some(v => v.status === 'passed' && v.evidencePath === s.reopenEvidencePath)) proof(s.reopenEvidencePath); if (s.retrieval) files.add(s.retrieval.instructionsPath); }
    for (const e of a.exports) { files.add(e.file.path); if (a.status === 'accepted' || a.verification.some(v => v.status === 'passed' && v.evidencePath === e.integrationEvidencePath)) proof(e.integrationEvidencePath); }
    for (const p of a.production) { files.add(p.settingsPath); files.add(p.promptOrScriptPath); }
    for (const path of [...a.rights.noticePaths, ...a.rights.termsSnapshotPaths, ...a.rights.inputPermissionPaths]) files.add(path);
    for (const v of a.verification) if (a.status === 'accepted' || v.status === 'passed') proof(v.evidencePath);
    for (const u of a.usedBy) proof(u.evidencePath);
    if (a.image) { files.add(a.image.cameraRecordPath); files.add(a.image.registrationPath); }
    if (a.audio) { files.add(a.audio.nativeProjectPath); files.add(a.audio.masterPath); if (a.audio.voiceRecordPath) files.add(a.audio.voiceRecordPath); }
  }
  return { files, records };
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
    for (const path of await reader.evidencePaths()) paths.records.add(path);
    for (const path of paths.records) {
      try {
        const record = await reader.json(path); files[path] = await reader.read(path, jsonLimit);
        if (!isEvidenceRecord(record)) { failures.push({ code: 'EVIDENCE_INVALID', path }); continue; }
        records[path] = record;
        if (record.type === 'retrieval' && typeof record.details['archivePath'] === 'string') paths.files.add(record.details['archivePath']);
      } catch (error) { failures.push(issueFor(error, 'EVIDENCE_READ_FAILED', path)); }
    }
    for (const path of paths.files) {
      if (Object.hasOwn(files, path)) continue;
      try { files[path] = await reader.read(path); } catch (error) { failures.push(issueFor(error, 'FILE_READ_FAILED', path)); }
    }
    snapshot.content = await loadContent(reader);
    const validated = validateAssetManifest(manifest, { ...snapshot, files, records }, { mode });
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
