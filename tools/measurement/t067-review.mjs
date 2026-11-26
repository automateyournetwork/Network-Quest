// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { mkdir, writeFile } from 'node:fs/promises';
import { t067Server } from './t067-server.ts';
const output = `docs/evidence/spec001/presentation/t067/review-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(output, { recursive: true });
const server = await t067Server({ dist: 'dist', log: `${output}/server.ndjson` });
const record = { output, url: `${server.url}?t067=review`, scope: 'Unmodified frozen HTML/JS/media; guest-only loopback HTTP room review, no account/provider service', startedAt: new Date().toISOString() };
await writeFile(`${output}/session.json`, JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify(record));
await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
await server.stop();
