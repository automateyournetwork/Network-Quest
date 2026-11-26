// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { distribution, browserOptions, summarizeResponses } from '../../tools/measure-browser.ts';
import { installMeasurementProbe } from '../../tools/measurement-browser-probe.ts';
import { runInNewContext } from 'node:vm';

describe('measurement evidence rules', () => {
  it('uses nearest-rank percentiles including slow failures and never fabricates empty evidence', () => {
    expect(distribution([])).toEqual({ count: 0, min: null, median: null, p95: null, max: null });
    expect(distribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 9000]).p95).toBe(9000);
    expect(() => distribution([NaN])).toThrow();
    expect(() => distribution([-1])).toThrow();
  });
  it('retains failed network rows, distinguishes encoded bodies and refuses unavailable compression claims', () => {
    const result = summarizeResponses([
      { status: 200, path: '/index.html', encodedBodySize: 10, decodedBodySize: 20, transferSize: 310 },
      { status: 503, path: '/api/v1/session', encodedBodySize: 30, decodedBodySize: 30, transferSize: 330 },
      { status: 0, path: '/missing.glb', encodedBodySize: 0, decodedBodySize: 0, transferSize: 0 },
    ]);
    expect(result.failed).toHaveLength(2);
    expect(result.encodedBodyBytes).toBe(40);
    expect(result.transferBytes).toBe(640);
  });
  it('does not accept remote URLs, storage paths, hidden shaping or empty samples', () => {
    for (const args of [['--url=https://example.com'], ['--samples=0'], ['--frame-ms=0'], ['--shaping=20mbps'], ['--output=/tmp/x']]) {
      expect(() => browserOptions(args)).toThrow();
    }
    expect(browserOptions([])).toEqual({ samples: 3, frameMs: 3000, cycles: 5 });
  });
  it('keeps delete calls distinct from context-loss releases and ignores duplicate deletion', () => {
    class Gl {
      canvas = new EventTarget();
      createBuffer() { return {}; }
      deleteBuffer(_handle: object) {}
      drawArrays() {}
    }
    const scope = { WebGLRenderingContext: Gl, document: new EventTarget(), requestAnimationFrame() {},
      __nqMeasurement: undefined as undefined | { snapshot(): { creates: Record<string, number>; deletes: Record<string, number>; live: Record<string, number>; releasedByContextLoss: Record<string, number>; draws: number } } };
    runInNewContext(`(${installMeasurementProbe.toString()})()`, scope);
    const gl = new Gl(), one = gl.createBuffer(); gl.createBuffer(); gl.deleteBuffer(one); gl.deleteBuffer(one); gl.drawArrays();
    const before = scope.__nqMeasurement!.snapshot();
    expect(before.creates['Buffer']).toBe(2); expect(before.deletes['Buffer']).toBe(1); expect(before.live['Buffer']).toBe(1); expect(before.draws).toBe(1);
    gl.canvas.dispatchEvent(new Event('webglcontextlost'));
    const after = scope.__nqMeasurement!.snapshot();
    expect(after.live['Buffer']).toBe(0); expect(after.releasedByContextLoss['Buffer']).toBe(1); expect(after.deletes['Buffer']).toBe(1);
  });
});
