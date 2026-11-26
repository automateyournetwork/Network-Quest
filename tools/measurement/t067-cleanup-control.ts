// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { t067Server } from './t067-server.ts';
const output = `docs/evidence/spec001/presentation/t067/cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(output, { recursive: true });
const log = `${output}/server.ndjson`, server = await t067Server({ log, calibrationOnly: true });
const response = await fetch(`${server.origin}/__t067/calibration/8388608`);
const reading = response.arrayBuffer().then(value => ({ completed: true, bytes: value.byteLength }), error => ({ completed: false, error: String(error) }));
await new Promise(resolve => setTimeout(resolve, 20));
const began = performance.now(); await server.stop(); const cleanupMs = performance.now() - began, client = await reading;
const rows = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
const aborted = rows.find(row => row.type === 'response' && row.path.endsWith('8388608'));
const cleanup = rows.find(row => row.type === 'cleanup');
const result = { client, cleanupMs, responseRecorded: Boolean(aborted), aborted: aborted?.aborted, pendingRequests: cleanup?.pendingRequests,
  passed: !client.completed && aborted?.aborted === true && cleanup?.pendingRequests === 0 && cleanupMs < 1000 };
await writeFile(`${output}/result.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output, ...result })); process.exitCode = result.passed ? 0 : 1;
