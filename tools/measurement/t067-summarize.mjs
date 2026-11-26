// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const input = process.argv[2];
if (!input?.startsWith('docs/evidence/spec001/presentation/t067/') || !input.endsWith('/samples.json') || input.split('/').includes('..')) throw new Error('Expected owned T067 samples path');
const raw = await readFile(input), rows = JSON.parse(raw);
const distribution = values => { const s = [...values].sort((a, b) => a - b); return { count: s.length, median: s[Math.ceil(s.length * .5) - 1] ?? null, p95: s[Math.ceil(s.length * .95) - 1] ?? null, maximum: s.at(-1) ?? null }; };
const bytes = resources => resources.reduce((sum, r) => sum + (r.encodedBodySize ?? 0), 0);
const summaries = rows.map(row => {
  if (row.status !== 'completed') return { id: row.id, cache: row.cache, status: row.status, error: row.error ?? row.message };
  const frame = sample => ({ durationMs: sample.durationMs, actualRenderedFrames: sample.actualRenderDelta, actualFramesPerSecond: sample.actualRenderDelta / sample.durationMs * 1000,
    displayIntervalsMs: distribution(sample.measured.frameIntervals), intervalsWithGlSubmission: sample.measured.renderedIntervals, visibilityChanges: sample.measured.visibilityChanges,
    hidden: sample.measured.visibilityState !== 'visible', droppedSamples: sample.measured.droppedFrames });
  const webglBytes = row.initial.estimatedWebglTextureBytes;
  // DOM PNGs are compositor layers, not Three texture counters. One full mip chain
  // is a conservative planning allowance; driver copies/tiles remain unmeasured.
  const domBaseBytes = row.initial.domImageDecodedBytes, domMipAllowanceBytes = Math.ceil(domBaseBytes * 4 / 3);
  const textureEstimate = webglBytes === null ? null : webglBytes + domMipAllowanceBytes;
  const idle = frame(row.idle), exploration = frame(row.exploration), low = frame(row.low);
  const errors = [...(row.errors ?? []), ...(row.browserErrors ?? [])];
  const sceneFailures = row.resources.filter(r => r.status >= 400 && /\/assets\//.test(r.path));
  const HTTPFailures = row.resources.filter(r => r.status >= 400);
  return { id: row.id, cache: row.cache, status: row.status, userAgent: row.browserUserAgent, browserVersion: row.browserVersion ?? null,
    viewport: row.viewport, dpr: row.dpr, shellReadyMs: row.shellReadyMs, firstRoomReadyMs: row.firstRoomReadyMs,
    shellCompressedBytesIncludingProbe: bytes(row.shellResources), firstRoomCompressedBytesIncludingProbe: bytes(row.firstRoomResources),
    firstRoomTransferredBytes: row.firstRoomResources.reduce((sum, r) => sum + r.transferSize, 0),
    triangles: Number(row.initial.dataset.triangles), drawCalls: Number(row.initial.dataset.drawCalls), geometries: Number(row.initial.dataset.geometries), rendererTextures: Number(row.initial.dataset.textures),
    textureEstimate: { webglApiStorageBytes: webglBytes, domImageRgbaBaseBytes: domBaseBytes, domImageMipAllowanceBytes: domMipAllowanceBytes, estimatedCombinedBytes: textureEstimate, measuredGpuMemoryBytes: null },
    idle, exploration, low, imageDecodeMs: distribution(row.decodes.filter(d => d.success).map(d => d.durationMs)), errors, sceneFailures, HTTPFailures,
    numericBudgets: {
      shell5MiB: bytes(row.shellResources) <= 5 * 1048576, firstRoom15MiB: bytes(row.firstRoomResources) <= 15 * 1048576,
      ready12Seconds: row.firstRoomReadyMs <= 12000,
      rendered30FPS: [idle, exploration].every(f => f.actualFramesPerSecond >= 30 && !f.hidden && f.visibilityChanges === 0 && f.droppedSamples === 0),
      triangles500k: Number(row.initial.dataset.triangles) <= 500000,
      textures128MiB: textureEstimate !== null && textureEstimate <= 128 * 1048576,
      noPageOrSceneErrors: errors.length === 0 && sceneFailures.length === 0,
    },
    disposal: row.disposal.map(d => ({ cycle: d.cycle, room: d.room, gl: d.gl, webglTextureBytes: d.estimatedWebglTextureBytes, domImageBytes: d.domImageDecodedBytes })),
    text: row.text, lost: row.lost, recovered: row.recovered, reset: row.reset,
  };
});
const output = path.join(path.dirname(input), 'summary.json');
await writeFile(output, JSON.stringify({ source: input, sourceSha256: createHash('sha256').update(raw).digest('hex'),
  interpretation: 'Budget observations only. Retained HTTP failures, native inspection and owner review are separate. No whole-episode/G3 acceptance inferred.', summaries }, null, 2) + '\n');
console.log(JSON.stringify({ output, samples: summaries.length, completed: summaries.filter(r => r.status === 'completed').length,
  failedBudgets: summaries.flatMap(r => Object.entries(r.numericBudgets ?? {}).filter(([, value]) => !value).map(([budget]) => ({ id: r.id, cache: r.cache, budget }))) }));
