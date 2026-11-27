// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, it } from 'vitest';
import { opticalAudioEvents } from '../../src/presentation/optical-audio-events';
import { fixture, scenario } from '../state/objectives-fixture';

it.each([
  { loss: 8, compatible: true, bounds: false },
  { loss: 9, compatible: true, bounds: false },
  { loss: 10, compatible: true, bounds: true },
  { loss: 8, compatible: false, bounds: false },
])('reports a fresh optical sample and observes its measured limits at $loss dB (compatible $compatible)', ({ loss, compatible, bounds }) => {
  const base = scenario('O06');
  if (base.kind !== 'fiber-proof') throw new Error('Missing O06 measurement fixture');
  const f = fixture('O06', { ...base, path: { compatible, loss: { unit: 'dB', value: loss } } });
  const before = f.store.getState().runtime.game!;
  expect(f.measure().status).toBe('applied');
  const after = f.store.getState().runtime.game!;
  expect(opticalAudioEvents(before, after)).toEqual(bounds ? ['measurement/O06', 'measurement/O06-outside-bounds'] : ['measurement/O06']);
  expect(opticalAudioEvents(after, after)).toEqual([]);
  const stale = after.notebook.measurements.map(m => ({ ...m, stale: true }));
  expect(opticalAudioEvents(before, { ...after, notebook: { ...after.notebook, measurements: stale } })).toEqual([]);
});
