// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { startDev } from '../../../tools/dev.mjs';

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (address === null || typeof address === 'string') throw new Error('Cannot reserve loopback TLS port.');
  return address.port;
}

/** A disposable CA, SAN leaf and Firefox NSS profile; no OS/browser trust mutation. */
export async function localTls(options: { probeRouter?: string } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'network-quest-browser-'));
  let server: Awaited<ReturnType<typeof startDev>> | undefined;
  const stop = async () => {
    try { await server?.stop(); } finally {
      await rm(directory, { recursive: true, force: true });
    }
  };
  const run = (command: string, args: string[], capability: string) => {
    const result = spawnSync(command, args, {
      env: { PATH: process.env['PATH'] ?? '', LANG: 'C', LC_ALL: 'C' },
      stdio: 'ignore', timeout: 10_000,
    });
    if (result.status !== 0) throw new Error(`${capability} failed. See README test:e2e prerequisites; no TLS bypass is used.`);
  };
  try {
    await chmod(directory, 0o700);
    const profile = path.join(directory, 'trusted-profile');
    const untrustedProfile = path.join(directory, 'untrusted-profile');
    await mkdir(profile, { mode: 0o700 });
    await mkdir(untrustedProfile, { mode: 0o700 });
    const ca = path.join(directory, 'ca.pem');
    const caKey = path.join(directory, 'ca.key');
    const cert = path.join(directory, 'leaf.pem');
    const key = path.join(directory, 'leaf.key');
    const csr = path.join(directory, 'leaf.csr');
    const extension = path.join(directory, 'leaf.ext');
    const openssl = process.env['NQ_OPENSSL_BIN'] ?? 'openssl';
    const certutil = process.env['NQ_CERTUTIL_BIN'] ?? 'certutil';
    await writeFile(extension, 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n');
    run(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '1',
      '-subj', '/CN=Network Quest disposable browser CA', '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0',
      '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-keyout', caKey, '-out', ca], 'OpenSSL CA creation');
    run(openssl, ['req', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-subj', '/CN=127.0.0.1',
      '-keyout', key, '-out', csr], 'OpenSSL server request');
    run(openssl, ['x509', '-req', '-in', csr, '-CA', ca, '-CAkey', caKey, '-CAcreateserial',
      '-days', '1', '-sha256', '-extfile', extension, '-out', cert], 'OpenSSL SAN leaf signing');
    run(openssl, ['verify', '-CAfile', ca, cert], 'OpenSSL certificate chain validation');
    await chmod(caKey, 0o600);
    await chmod(key, 0o600);
    run(certutil, ['-N', '-d', `sql:${profile}`, '--empty-password'], 'NSS isolated profile creation');
    run(certutil, ['-A', '-d', `sql:${profile}`, '-n', 'Network Quest disposable browser CA',
      '-t', 'C,,', '-i', ca], 'NSS isolated CA trust');
    server = await startDev({ cert, key, port: await freePort(), php: process.env['NQ_PHP_BIN'] ?? 'php', ...options });
    return { ...server, directory, profile, untrustedProfile, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
