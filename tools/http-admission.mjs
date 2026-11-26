// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Local trusted HTTP adapter policy. Inspect raw fields BEFORE Node discards duplicates.
import { randomUUID } from 'node:crypto';

export function admitRawHeaders(rawHeaders) {
  if (!Array.isArray(rawHeaders) || rawHeaders.length % 2 || rawHeaders.length > 128) return 400;
  const names = new Set();
  const fields = new Map();
  let bytes = 0;
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const name = rawHeaders[i], value = rawHeaders[i + 1];
    if (typeof name !== 'string' || typeof value !== 'string' || name.length > 128 || Buffer.byteLength(value) > 8192
      || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || /[\x00-\x1f\x7f]/.test(value)) return 400;
    bytes += Buffer.byteLength(name) + Buffer.byteLength(value) + 4;
    const lower = name.toLowerCase();
    if (bytes > 16384 || names.has(lower)) return 400;
    names.add(lower); fields.set(lower, value);
  }
  const length = fields.get('content-length'), transfer = fields.get('transfer-encoding');
  if (!fields.has('host') || fields.has('content-encoding') || (length !== undefined && !/^(?:0|[1-9][0-9]*)$/.test(length))
    || (transfer !== undefined && (transfer !== 'chunked' || length !== undefined))) return 400;
  if (length !== undefined && (length.length > 6 || Number(length) > 262144)) return 413;
  return null;
}

export function rejectRequest(req, res, status) {
  // Parsed requests can fail before PHP. Preserve the API Problem contract here
  // without reflecting any URL, submitted header, cookie, token or body bytes.
  const requestId = randomUUID();
  const [code, message] = status === 413 ? ['body-too-large', 'The request exceeds the supported size.']
    : status === 403 ? ['forbidden', 'The request could not be authorized.']
    : ['invalid-request', 'The request is malformed.'];
  const body = JSON.stringify({ code, message, requestId });
  res.writeHead(status, { 'Cache-Control': 'no-store', 'Connection': 'close', 'Content-Length': String(Buffer.byteLength(body)),
    'Content-Type': 'application/json; charset=utf-8', 'X-Request-Id': requestId,
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
    'X-Robots-Tag': 'noindex, nofollow',
    'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" }).end(body);
  // Closing this request/socket bounds rejected bodies; no attacker bytes are logged.
  req.resume();
}

/** Buffer at most 262144 raw bytes BEFORE forwarding to a PHP SAPI. Node owns framing. */
export function readBoundedBody(req, res, ready) {
  const chunks = [];
  let length = 0, rejected = false;
  req.on('data', (chunk) => {
    if (rejected) return;
    length += chunk.length;
    if (length > 262144) { rejected = true; chunks.length = 0; rejectRequest(req, res, 413); return; }
    chunks.push(chunk);
  });
  req.on('end', () => { if (!rejected && !res.destroyed) ready(Buffer.concat(chunks, length)); });
  req.on('error', () => { chunks.length = 0; if (!res.headersSent) rejectRequest(req, res, 400); });
}

/** Safe metadata-only replies for parser/framing/timeout failures before request dispatch. */
export function installParserErrors(server) {
  server.on('clientError', (error, socket) => {
    const status = error.code === 'ERR_HTTP_REQUEST_TIMEOUT' ? 408 : error.code === 'HPE_HEADER_OVERFLOW' ? 431 : 400;
    if (!socket.writable || socket.destroyed) { socket.destroy(); return; }
    socket.end(`HTTP/1.1 ${status} Request Rejected\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: 0\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\n\r\n`);
  });
}
