// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import process from 'node:process';
import { realpathSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Connect, type Plugin } from 'vite';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)));

// Vite's default deny list is retained explicitly: adding a list replaces it.
const privateFiles = [
  '.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**',
  '**/{server,.local,.runtime,.cache,secrets,private-data,player-data,sessions,backups,logs}/**',
  '**/*.{php,sqlite,sqlite3,db,sql,log}', '**/*-wal', '**/*-shm', '**/*-journal',
  '**/auth.json', '**/config.local.*',
];

function beneath(file: string, directory: string): boolean {
  return file === directory || file.startsWith(`${directory}${path.sep}`);
}

function privatePath(local: string): boolean {
  return local.split('/').some((segment) => segment.startsWith('.') && segment !== '.vite')
    || local.split('/').some((segment) => /^(server|secrets|private-data|player-data|sessions|backups|logs)$/i.test(segment))
    || /(?:\.(?:php|sqlite3?|db|sql|log|crt|pem|key|p12|pfx|cer|der)(?:\.bak)?|-(?:wal|shm|journal))$/i.test(local)
    || /(?:^|\/)(?:auth\.json|config\.local\.[^/]*)$/i.test(local);
}

// Also protects public/ (Vite's fs.deny deliberately does not apply there),
// symlink targets, encoded paths and preview. No general /@fs serving is needed.
function frontendBoundary(preview = false): Connect.NextHandleFunction {
  const roots = (preview ? ['dist'] : ['src', 'public', 'node_modules'])
    .map((name) => path.join(root, name));
  return (req, res, next) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent((req.url ?? '').split('?')[0] ?? '');
    } catch {
      res.writeHead(400).end();
      return;
    }
    const local = pathname.startsWith(gameBase) ? pathname.slice(gameBase.length) : '';
    const forbidden = !pathname.startsWith(gameBase) || /[%?#\\\x00-\x1f]/.test(pathname)
      || privatePath(local)
      || local.startsWith('@fs/') || local.startsWith('api/');
    if (forbidden) {
      res.writeHead(404, { 'Cache-Control': 'no-store' }).end();
      return;
    }
    const candidates = preview
      ? [path.join(root, 'dist', local)]
      : [path.join(root, local), path.join(root, 'public', local)];
    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue;
      const resolved = realpathSync(candidate);
      const allowed = roots.some((directory) => beneath(resolved, directory))
        || (!preview && resolved === path.join(root, 'index.html'))
        || resolved === (preview ? path.join(root, 'dist') : root);
      if (!allowed || privatePath(path.relative(root, resolved))) {
        res.writeHead(404, { 'Cache-Control': 'no-store' }).end();
        return;
      }
    }
    next();
  };
}

function privateBoundary(): Plugin {
  return {
    name: 'network-quest-private-boundary',
    configureServer(server) { server.middlewares.use(frontendBoundary()); },
    configurePreviewServer(server) { server.middlewares.use(frontendBoundary(true)); },
  };
}

// Only public route paths are read. Do not load private .env files or expose a
// general environment prefix to the client.
const gameBase = process.env['VITE_GAME_BASE'] ?? '/arcade/play/network-quest/';
const apiBase = process.env['VITE_API_BASE'] ?? `${gameBase}api/v1`;

if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(gameBase)) {
  throw new Error('VITE_GAME_BASE must be a same-origin path ending in /, with plain path segments.');
}
if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(apiBase)) {
  throw new Error('VITE_API_BASE must be a same-origin path without a trailing /, with plain path segments.');
}

export default defineConfig({
  plugins: [privateBoundary()],
  base: gameBase,
  envDir: false,
  envPrefix: [],
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify(apiBase),
  },
  build: {
    outDir: 'dist',
    manifest: true,
    target: 'es2022',
    sourcemap: false,
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    strictPort: true,
    fs: { strict: true, allow: [root], deny: privateFiles },
  },
  preview: {
    host: '127.0.0.1',
    strictPort: true,
  },
});
