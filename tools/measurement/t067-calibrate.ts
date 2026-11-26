// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { mkdir, writeFile } from 'node:fs/promises';
import { t067Server, calibrateT067 } from './t067-server.ts';
if (process.versions.node !== '26.13.1') throw new Error('Pinned Node 26.13.1 required');
const output = `docs/evidence/spec001/presentation/t067/calibration-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(output, { recursive: true });
const server = await t067Server({ log: `${output}/server.ndjson`, calibrationOnly: true });
try {
  const result = await calibrateT067(server); await writeFile(`${output}/result.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ output, ...result })); process.exitCode = result.valid ? 0 : 1;
} finally { await server.stop(); }
