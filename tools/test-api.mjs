// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Runs the real service suite with no inherited production configuration.
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.versions.node !== '26.13.1') {
  console.error('Use pinned Node 26.13.1 (README.md).');
  process.exit(1);
}
const php = process.env.NQ_PHP_BIN ?? 'php';
const env = { PATH: process.env.PATH ?? '', LANG: 'C', LC_ALL: 'C' };
if (process.env.NQ_OPENSSL_BIN) env.NQ_OPENSSL_BIN = process.env.NQ_OPENSSL_BIN;
if (process.env.NQ_TEST_NODE_BIN) env.NQ_TEST_NODE_BIN = process.env.NQ_TEST_NODE_BIN;
const version = spawnSync(php, ['-r', 'echo PHP_VERSION;'], { env, encoding: 'utf8' });
if (version.status !== 0 || version.stdout !== '8.4.28') {
  console.error('NQ_PHP_BIN must select PHP 8.4.28 (README.md).');
  process.exit(1);
}
const child = spawn(php, ['-d', 'auto_prepend_file=', '-d', 'auto_append_file=',
  'server/vendor/bin/phpunit', '--configuration', 'server/phpunit.xml', ...process.argv.slice(2)], {
  cwd: fileURLToPath(new URL('..', import.meta.url)), env, stdio: 'inherit',
});
const stop = (signal) => child.kill(signal);
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
child.once('error', () => { console.error('Unable to launch pinned PHP test runner.'); process.exitCode = 1; });
child.once('exit', (status) => { process.exitCode = status ?? 1; });
