// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { AuthProvider, ClientGeneration, PresentationSettings, SaveAcknowledgement, SaveSummary } from '../state/types';

/** Volatile API projections. Never include these in an adventure snapshot. */
export interface PreferencesValues extends PresentationSettings { readonly autosaveEnabled: boolean }
export interface Preferences { readonly revision: number; readonly etag: string; readonly values: PreferencesValues }
export type Session = { readonly state: 'guest'; readonly csrfToken: string } | {
  readonly state: 'authenticated'; readonly csrfToken: string; readonly provider: AuthProvider;
  readonly displayName: string; readonly expiresAt: string; readonly preferences: Preferences; readonly saveSummary: SaveSummary | null;
};
export interface Problem { readonly code: string; readonly message: string; readonly requestId: string }
export interface Conflict extends Problem { readonly code: 'save-conflict'; readonly currentSummary: SaveSummary | null }
export interface AuthorizationStart { readonly authorizationUrl: string; readonly expiresAt: string }
export interface DeletionStatus { readonly state: 'pending' | 'completed'; readonly expiresAt: string }
/** Version dispatch/validation belongs to the reader, before interpreting snapshot. */
export interface SavedSnapshot { readonly summary: SaveSummary; readonly snapshot: Readonly<Record<string, unknown>> }
export type ApiFailure = {
  readonly ok: false;
  readonly kind: 'http' | 'network' | 'timeout' | 'invalid-response' | 'invalid-request' | 'session-required' | 'stale' | 'disposed';
  readonly status?: number; readonly problem?: Problem | Conflict; readonly retryAfterSeconds?: number;
};
export type ApiResult<T> = ApiFailure | {
  readonly ok: true; readonly data: T; readonly generation: ClientGeneration; readonly status: number;
  readonly etag?: string; readonly retryAfterSeconds?: number;
  /** Exact response JSON preserves unknown future save numbers/fields without reinterpretation. */
  readonly rawJson?: string;
  /** Exact snapshot JSON value for TextEncoder -> version-aware SaveReader; never stringify the parsed projection. */
  readonly snapshotJson?: string;
};
export interface SaveWriteInput {
  readonly bodyBytes: Uint8Array; readonly requestId: string; readonly mode: 'manual' | 'automatic';
  readonly precondition: { readonly header: 'If-Match' | 'If-None-Match'; readonly value: string };
  readonly confirmAdventureReplacement: boolean;
}
export interface PreparedSaveWrite extends Omit<SaveWriteInput, 'bodyBytes'> {
  readonly bodyBytes: readonly number[]; readonly clientGeneration: ClientGeneration;
}
type ObjectValue = Record<string, unknown>;
type Check = (value: unknown) => boolean;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const saveTag = /^"save-[1-9][0-9]*"$/;
const prefsTag = /^"prefs-[1-9][0-9]*"$/;
const MAX_RESPONSE_BYTES = 294912; // 262144-byte slot plus bounded summary/envelope.
const failure = (kind: ApiFailure['kind']): ApiFailure => ({ ok: false, kind });
const record = (v: unknown): v is ObjectValue => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number, min = 0): v is string => typeof v === 'string' && [...v].length >= min && [...v].length <= max;
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 1;
function fields(v: unknown, keys: readonly string[]): v is ObjectValue {
  return record(v) && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
}
function date(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 64 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(v) || !Number.isFinite(Date.parse(v))) return false;
  const year = Number(v.slice(0, 4)), month = Number(v.slice(5, 7)), day = Number(v.slice(8, 10));
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]! && Number(v.slice(11, 13)) < 24 && Number(v.slice(14, 16)) < 60 && Number(v.slice(17, 19)) < 60;
}
function summary(v: unknown): boolean {
  return fields(v, ['revision', 'etag', 'savedAt', 'adventureId', 'episodeId', 'roomId', 'outcome', 'saveSchemaVersion', 'contentVersion'])
    && positive(v['revision']) && v['etag'] === `"save-${v['revision']}"` && date(v['savedAt'])
    && typeof v['adventureId'] === 'string' && uuid.test(v['adventureId']) && text(v['episodeId'], 32) && text(v['roomId'], 64)
    && [null, 'E01', 'E02'].includes(v['outcome'] as null) && positive(v['saveSchemaVersion']) && text(v['contentVersion'], 32);
}
const preferenceChecks: Record<keyof PreferencesValues, Check> = {
  autosaveEnabled: v => typeof v === 'boolean', captions: v => typeof v === 'boolean',
  reducedMotion: v => ['system', 'on', 'off'].includes(v as string), textScale: v => typeof v === 'number' && v >= 1 && v <= 2,
  musicVolume: v => typeof v === 'number' && v >= 0 && v <= 1,
  effectsVolume: v => typeof v === 'number' && v >= 0 && v <= 1,
  voiceVolume: v => typeof v === 'number' && v >= 0 && v <= 1,
};
function preferencesPatch(v: unknown, complete = false): boolean {
  return record(v) && Object.keys(v).length > 0 && (!complete || Object.keys(v).length === 7)
    && Object.entries(v).every(([key, value]) => Object.hasOwn(preferenceChecks, key) && preferenceChecks[key as keyof PreferencesValues](value));
}
function preferences(v: unknown): boolean {
  return fields(v, ['revision', 'etag', 'values']) && positive(v['revision']) && v['etag'] === `"prefs-${v['revision']}"` && preferencesPatch(v['values'], true);
}
function session(v: unknown): boolean {
  if (!record(v) || !text(v['csrfToken'], 256, 32) || /[\x00-\x20\x7f-\uffff]/.test(v['csrfToken'])) return false;
  if (v['state'] === 'guest') return fields(v, ['state', 'csrfToken']);
  return fields(v, ['state', 'csrfToken', 'provider', 'displayName', 'expiresAt', 'preferences', 'saveSummary']) && v['state'] === 'authenticated'
    && ['google', 'github'].includes(v['provider'] as string) && text(v['displayName'], 128) && date(v['expiresAt']) && preferences(v['preferences'])
    && (v['saveSummary'] === null || summary(v['saveSummary']));
}
function problem(v: unknown, conflict: boolean): boolean {
  return fields(v, conflict ? ['code', 'message', 'requestId', 'currentSummary'] : ['code', 'message', 'requestId'])
    && text(v['code'], 96) && text(v['message'], 512) && typeof v['requestId'] === 'string' && uuid.test(v['requestId'])
    && (!conflict || (v['code'] === 'save-conflict' && (v['currentSummary'] === null || summary(v['currentSummary']))));
}
function acknowledgement(v: unknown): boolean {
  if (!fields(v, ['requestId', 'committedRevision', 'committedAt', 'replayed', 'currentSummary']) || typeof v['requestId'] !== 'string' || !uuid.test(v['requestId'])
    || !positive(v['committedRevision']) || !date(v['committedAt']) || typeof v['replayed'] !== 'boolean' || !summary(v['currentSummary'])) return false;
  const current = v['currentSummary'] as unknown as SaveSummary;
  return v['committedRevision'] <= current.revision && (v['replayed'] || v['committedRevision'] === current.revision);
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
/** Match server's canonical unpadded encoding: 32 bytes, zero trailing pad bits. */
function receipt(value: string): boolean { return /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(value); }
function scalarJSON(v: unknown, depth = 0): boolean {
  if (depth >= 32) return false;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v);
  if (v && typeof v === 'object') return Object.entries(v).every(([key, value]) => scalarJSON(key, depth + 1) && scalarJSON(value, depth + 1));
  return v === null || typeof v === 'boolean';
}
function boundedNesting(raw: string): boolean {
  let depth = 0, quoted = false, escaped = false;
  for (const char of raw) {
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; }
    else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') { if (++depth >= 32) return false; }
    else if (char === '}' || char === ']') depth--;
  }
  return true;
}
/**
 * After bounded JSON syntax parsing, retain exact top-level value slices. Decode
 * keys only, so escaped aliases cannot hide duplicate envelope/summary members.
 * No interpretation or normalization of snapshot values occurs here.
 */
function objectMembers(raw: string): Map<string, string> | null {
  const members = new Map<string, string>(); let i = 0;
  const whitespace = () => { while (i < raw.length && /[\x20\t\r\n]/.test(raw[i]!)) i++; };
  whitespace(); if (raw[i++] !== '{') return null; whitespace();
  if (raw[i] === '}') return members;
  while (i < raw.length) {
    whitespace(); const keyStart = i;
    if (raw[i++] !== '"') return null;
    let escaped = false;
    while (i < raw.length) {
      const char = raw[i++];
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') break;
    }
    const key: unknown = JSON.parse(raw.slice(keyStart, i));
    if (typeof key !== 'string' || members.has(key)) return null;
    whitespace(); if (raw[i++] !== ':') return null; whitespace(); const valueStart = i;
    let depth = 0, quoted = false; escaped = false;
    for (; i < raw.length; i++) {
      const char = raw[i];
      if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; }
      else if (char === '"') quoted = true;
      else if (char === '{' || char === '[') depth++;
      else if (char === '}' || char === ']') { if (depth === 0) break; depth--; }
      else if (char === ',' && depth === 0) break;
    }
    let valueEnd = i;
    while (valueEnd > valueStart && /[\x20\t\r\n]/.test(raw[valueEnd - 1]!)) valueEnd--;
    members.set(key, raw.slice(valueStart, valueEnd));
    if (raw[i] === '}') { i++; whitespace(); return i === raw.length ? members : null; }
    if (raw[i++] !== ',') return null;
  }
  return null;
}
/** The server is authoritative; the browser additionally refuses any unexpected redirect destination. */
export function allowedAuthorizationUrl(value: string, provider: AuthProvider): boolean {
  if (value.length > 8192 || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    const authority = provider === 'google' ? 'https://accounts.google.com/' : 'https://github.com/';
    return value.startsWith(authority) && !url.username && !url.password && !url.hash && url.protocol === 'https:' && !url.port
      && (provider === 'google' ? url.origin === 'https://accounts.google.com' && url.pathname === '/o/oauth2/v2/auth'
        : provider === 'github' && url.origin === 'https://github.com' && url.pathname === '/login/oauth/authorize');
  } catch { return false; }
}

/** No storage, arbitrary URL/header API, automatic retry, redirect, sign-in or destructive action. */
export class GameApi {
  readonly origin: string;
  private readonly base: string;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private epoch = 0;
  private sessionRead = 0;
  private current: Session | null = null;
  private disposed = false;
  private readonly requests = new Set<AbortController>();
  private readonly prepared = new WeakMap<PreparedSaveWrite, string>();

  constructor(options: { origin: string; apiBase: string; fetch?: typeof globalThis.fetch; timeoutMs?: number }) {
    const origin = new URL(options.origin);
    if (origin.origin !== options.origin || origin.protocol !== 'https:' || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(options.apiBase)) throw new TypeError('Expected an exact HTTPS origin and plain same-origin API path');
    this.origin = origin.origin; this.base = origin.origin + options.apiBase; this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 15000;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 30000) throw new TypeError('Invalid API timeout');
  }
  get session(): Session | null { return this.current; }
  capture(): ClientGeneration { return this.epoch as ClientGeneration; }
  isCurrent(generation: ClientGeneration): boolean { return !this.disposed && generation === this.epoch; }
  /** Caller invokes on new account intent, restore/new run or changed account view. Does not erase gameplay. */
  invalidate(): ClientGeneration {
    this.epoch++; this.sessionRead++;
    for (const request of this.requests) request.abort();
    return this.capture();
  }
  dispose(): void { this.invalidate(); this.disposed = true; this.current = null; }

  async getSession(): Promise<ApiResult<Session>> {
    const serial = ++this.sessionRead;
    const result = await this.request<Session>('/session', 'GET', [200], session, [503]);
    if (serial !== this.sessionRead) return failure('stale');
    if (!result.ok) return result;
    const previous = this.current, next = result.data;
    // No stable account key is exposed by this contract. Labels never prove sameness.
    if (!previous || previous.state !== next.state || previous.csrfToken !== next.csrfToken
      || (previous.state === 'authenticated' && next.state === 'authenticated' && (previous.provider !== next.provider || previous.displayName !== next.displayName))) this.invalidate();
    this.current = next;
    return { ...result, generation: this.capture() };
  }
  startAuth(provider: AuthProvider, purpose: 'login' | 'delete-reauth'): Promise<ApiResult<AuthorizationStart>> {
    if (!['google', 'github'].includes(provider) || !['login', 'delete-reauth'].includes(purpose)) return Promise.resolve(failure('invalid-request'));
    return this.mutate(`/auth/${provider}/start`, 'POST', [200], v => fields(v, ['authorizationUrl', 'expiresAt']) && typeof v['authorizationUrl'] === 'string'
      && allowedAuthorizationUrl(v['authorizationUrl'], provider) && date(v['expiresAt']), [400, 401, 403, 429, 503], {}, JSON.stringify({ purpose }), purpose === 'delete-reauth');
  }
  getSave(): Promise<ApiResult<SavedSnapshot>> {
    if (this.current?.state !== 'authenticated') return Promise.resolve(failure('session-required'));
    return this.request('/save', 'GET', [200], v => fields(v, ['summary', 'snapshot']) && summary(v['summary']) && record(v['snapshot']), [401, 404, 503], {}, undefined, true);
  }
  prepareSaveWrite(input: SaveWriteInput): { readonly ok: true; readonly request: PreparedSaveWrite } | ApiFailure {
    if (this.disposed) return failure('disposed');
    if (this.current?.state !== 'authenticated') return failure('session-required');
    if (!uuid.test(input.requestId) || !['manual', 'automatic'].includes(input.mode) || typeof input.confirmAdventureReplacement !== 'boolean'
      || (input.confirmAdventureReplacement && input.mode !== 'manual') || !(input.bodyBytes instanceof Uint8Array) || input.bodyBytes.byteLength > 262144
      || !(input.precondition.header === 'If-Match' ? saveTag.test(input.precondition.value) : input.precondition.header === 'If-None-Match' && input.precondition.value === '*')) return failure('invalid-request');
    let raw: string;
    try { raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input.bodyBytes); } catch { return failure('invalid-request'); }
    const request = freeze({ bodyBytes: Array.from(input.bodyBytes), requestId: input.requestId, mode: input.mode,
      precondition: { header: input.precondition.header, value: input.precondition.value }, confirmAdventureReplacement: input.confirmAdventureReplacement, clientGeneration: this.capture() });
    this.prepared.set(request, raw);
    return { ok: true, request };
  }
  putSave(request: PreparedSaveWrite): Promise<ApiResult<SaveAcknowledgement>> {
    if (!this.isCurrent(request.clientGeneration)) return Promise.resolve(failure('stale'));
    const raw = this.prepared.get(request);
    if (raw === undefined) return Promise.resolve(failure('invalid-request'));
    const headers: Record<string, string> = { 'Idempotency-Key': request.requestId, 'X-Save-Mode': request.mode, [request.precondition.header]: request.precondition.value };
    if (request.confirmAdventureReplacement) headers['X-Confirm-Adventure-Replacement'] = 'true';
    return this.mutate('/save', 'PUT', [200, 201], v => acknowledgement(v) && (v as ObjectValue)['requestId'] === request.requestId,
      [400, 401, 403, 409, 412, 413, 422, 428, 429, 503], headers, raw, true, true);
  }
  patchPreferences(patch: Partial<PreferencesValues>, etag: string): Promise<ApiResult<Preferences>> {
    if (!preferencesPatch(patch) || !prefsTag.test(etag)) return Promise.resolve(failure('invalid-request'));
    return this.mutate('/preferences', 'PATCH', [200], preferences, [400, 401, 403, 412, 428, 429, 503], { 'If-Match': etag }, JSON.stringify(patch), true, true);
  }
  /** Call only after the UI's explicit confirmation. No save, retry or gameplay mutation. */
  async logout(): Promise<ApiResult<null>> {
    this.invalidate();
    const result = await this.mutate<null>('/logout', 'POST', [204], () => false, [401, 403, 503]);
    if (result.ok && !this.isCurrent(result.generation)) return failure('stale');
    if (result.ok) { this.current = null; this.invalidate(); return { ...result, generation: this.capture() }; }
    return result;
  }
  /** Caller owns fresh reauth/explicit consent. Token alone cannot authorize this mutation. */
  async deleteAccount(receiptToken: string): Promise<ApiResult<null>> {
    if (!receipt(receiptToken)) return failure('invalid-request');
    this.invalidate();
    const result = await this.mutate<null>('/account', 'DELETE', [204], () => false, [400, 401, 403, 409, 429, 503],
      { 'X-Deletion-Receipt': receiptToken, 'X-Confirm-Account-Deletion': 'delete-my-account' }, undefined, true);
    if (result.ok && !this.isCurrent(result.generation)) return failure('stale');
    if (result.ok) { this.current = null; this.invalidate(); return { ...result, generation: this.capture() }; }
    return result;
  }
  getDeletionStatus(receiptToken: string): Promise<ApiResult<DeletionStatus>> {
    if (!receipt(receiptToken)) return Promise.resolve(failure('invalid-request'));
    // Browser supplies Origin. Neither session-bound CSRF nor an account selector is used.
    return this.request('/account/deletion-status', 'POST', [200], v => fields(v, ['state', 'expiresAt']) && ['pending', 'completed'].includes(v['state'] as string) && date(v['expiresAt']),
      [400, 403, 404, 429, 503], { 'X-Deletion-Receipt': receiptToken });
  }
  private mutate<T>(route: string, method: string, statuses: number[], check: Check, errors: number[], headers: Record<string, string> = {}, body?: string, account = false, etag = false): Promise<ApiResult<T>> {
    if (!this.current || (account && this.current.state !== 'authenticated')) return Promise.resolve(failure('session-required'));
    return this.request(route, method, statuses, check, errors, { ...headers, 'X-CSRF-Token': this.current.csrfToken }, body, etag);
  }
  private async request<T>(route: string, method: string, statuses: number[], check: Check, errors: number[], headers: Record<string, string> = {}, body?: string, needsEtag = false): Promise<ApiResult<T>> {
    if (this.disposed) return failure('disposed');
    const generation = this.capture(), controller = new AbortController(); this.requests.add(controller);
    let timedOut = false, timer: ReturnType<typeof setTimeout> | undefined;
    const interrupted = new Promise<ApiFailure>(resolve => {
      controller.signal.addEventListener('abort', () => resolve(failure(timedOut ? 'timeout' : 'stale')), { once: true });
      timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeoutMs);
    });
    const run = async (): Promise<ApiResult<T>> => {
      try {
        const response = await this.fetcher(this.base + route, { method, headers: { Accept: 'application/json', ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          credentials: 'include', cache: 'no-store', mode: 'same-origin', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal,
          // An explicit zero-byte mutation permits browser-owned Content-Length:0 on HTTP/1.1.
          ...(method === 'GET' ? {} : { body: body ?? '' }) });
        if (!this.isCurrent(generation) || controller.signal.aborted) { void response.body?.cancel().catch(() => {}); return failure(timedOut ? 'timeout' : 'stale'); }
        const invalid = (): ApiFailure => { void response.body?.cancel().catch(() => {}); return failure('invalid-response'); };
        if (response.redirected || !/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('Cache-Control') ?? '') || (!statuses.includes(response.status) && !errors.includes(response.status))) return invalid();
        if (response.status === 204) {
          if (response.body !== null) return invalid();
          return { ok: true, data: null as T, generation, status: 204 };
        }
        if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get('Content-Type') ?? '')) return invalid();
        const raw = await this.readBody(response, controller.signal);
        if (!this.isCurrent(generation)) return failure('stale');
        if (raw === null || !boundedNesting(raw)) return failure('invalid-response');
        let data: unknown; try { data = JSON.parse(raw); } catch { return failure('invalid-response'); }
        const members = objectMembers(raw), saveRead = route === '/save' && method === 'GET' && response.status === 200;
        if (!members || !scalarJSON(saveRead && record(data) ? data['summary'] : data)) return failure('invalid-response');
        // Unknown snapshot versions remain opaque. The reader applies schema/semantic
        // rules to the exact slice only after selecting a supported version.
        if (saveRead && !objectMembers(members.get('summary') ?? '')) return failure('invalid-response');
        const retry = response.headers.get('Retry-After');
        const retryAfterSeconds = retry && /^[0-9]{1,9}$/.test(retry) && Number(retry) >= 1 ? Number(retry) : undefined;
        const retryMetadata = retryAfterSeconds === undefined ? {} : { retryAfterSeconds };
        if (errors.includes(response.status)) {
          if (!problem(data, route === '/save' && response.status === 412)) return failure('invalid-response');
          return { ok: false, kind: 'http', status: response.status, problem: freeze(data as Problem), ...retryMetadata };
        }
        if (!check(data)) return failure('invalid-response');
        const etag = response.headers.get('ETag');
        if (needsEtag) {
          const value = data as ObjectValue, current = route === '/preferences' ? value
            : (route === '/save' && method === 'GET' ? value['summary'] : value['currentSummary']) as ObjectValue;
          if (!etag || etag !== current['etag']) return failure('invalid-response');
        }
        return { ok: true, data: freeze(data as T), generation, status: response.status, ...retryMetadata,
          ...(needsEtag && etag ? { etag } : {}), ...(saveRead ? { rawJson: raw, snapshotJson: members.get('snapshot')! } : {}) };
      } catch { return failure(controller.signal.aborted ? (timedOut ? 'timeout' : 'stale') : 'network'); }
    };
    try {
      const result = await Promise.race([run(), interrupted]);
      return this.isCurrent(generation) ? result : failure('stale');
    } finally { clearTimeout(timer); this.requests.delete(controller); }
  }
  private async readBody(response: Response, signal: AbortSignal): Promise<string | null> {
    const length = response.headers.get('Content-Length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) { void response.body?.cancel().catch(() => {}); return null; }
    if (!response.body) return null;
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    const cancel = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      for (;;) {
        const chunk = await reader.read();
        if (signal.aborted) return null;
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > MAX_RESPONSE_BYTES) { cancel(); return null; }
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { return null; }
    } finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
  }
}
