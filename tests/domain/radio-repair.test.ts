// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateRadio } from '../../src/domain/radio';
import type { RadioChallenge, RadioInput, RadioProfile } from '../../src/domain/radio';
import type { ActionId, AttemptId, ConfigurationRevision, EvaluationStatus, WorldVersion } from '../../src/domain/types';

interface Case { id: string; inputs: Record<string, unknown>; expected: { status: EvaluationStatus; observation: Record<string, unknown> } }
const fixture = JSON.parse(readFileSync(new URL('../fixtures/repair-routes.json', import.meta.url), 'utf8')) as { cases: Case[] };
const profiles = JSON.parse(readFileSync(new URL('../../content/spec001/profiles.json', import.meta.url), 'utf8')) as { records: RadioProfile[] };
const profile = profiles.records.find(entry => entry.id === 'spec001:PROFILE-RADIO')!;
const cases = new Map(fixture.cases.map(entry => [entry.id, entry]));
const world: WorldVersion = { configurationRevision: 8 as ConfigurationRevision, attemptId: 'attempt-a' as AttemptId };
const object = (value: unknown) => value as Record<string, unknown>;
function run(challenge: unknown, kind: RadioInput['kind']) {
  return evaluateRadio(challenge as RadioChallenge, { actionId: 'radio-repair' as ActionId, expectedVersion: { ...world }, input: { kind } }, world);
}

describe('T072 independent T068 radio path and channel scenario expectations', () => {
  it('RR-O07-ALTERNATIVES accepts each supplied viable path without inferring SNR', () => {
    const entry = cases.get('RR-O07-ALTERNATIVES')!;
    const candidates = entry.inputs['candidates'] as Record<string, unknown>[];
    const accepted: unknown[] = [];
    for (const candidate of candidates) {
      const result = run({ kind: 'radio-path', profile, viablePath: candidate['viablePath'], settingsCompatible: candidate['settingsCompatible'] }, 'check-path');
      expect(result.status).toBe(entry.expected.status);
      expect(result.observations[0]).toMatchObject({ snrProven: entry.expected.observation['snrProven'], pathPrepared: true,
        throughputProven: false, wholeRouteProven: false, version: world });
      expect(result.observations[0]).not.toHaveProperty('snr');
      expect(result.observations[0]).not.toHaveProperty('usableLink');
      expect(result.acceptedEffects).toEqual([]);
      if (result.status === 'correct') accepted.push(candidate['id']);
    }
    expect(accepted).toEqual(entry.expected.observation['accepted']);
  });

  it('RR-O08-ALTERNATIVES measures both supplied channel scenarios without ranking them', () => {
    const entry = cases.get('RR-O08-ALTERNATIVES')!;
    const candidates = entry.inputs['candidates'] as Record<string, unknown>[];
    const accepted: unknown[] = []; const readings: unknown[] = [];
    for (const candidate of candidates) {
      // Candidate labels identify supplied observations; they are no numeric channel/rate model.
      const result = run({ kind: 'radio-link', profile, signal: candidate['signal'], noise: candidate['noise'],
        viablePath: candidate['viablePath'], settingsCompatible: candidate['settingsCompatible'] }, 'measure-link');
      expect(result.status).toBe(entry.expected.status);
      expect(result.observations[0]).toMatchObject({ throughputProven: entry.expected.observation['throughputProven'], thresholdMet: true,
        usableLink: true, wholeRouteProven: false, version: world });
      expect(result.acceptedEffects).toEqual([]);
      if (result.status === 'correct') accepted.push(candidate['id']);
      readings.push(object(result.observations[0])['snr']);
    }
    expect({ accepted, snr: readings }).toEqual({ accepted: entry.expected.observation['accepted'], snr: entry.expected.observation['snr'] });
  });

  it.each(['RR-O07-BLOCKED-PATH', 'RR-O08-BELOW'])('%s executes the actual declared path/SNR predicate', id => {
    const entry = cases.get(id)!;
    const result = run({ kind: 'radio-link', profile, signal: entry.inputs['signal'], noise: entry.inputs['noise'],
      viablePath: entry.inputs['viablePath'], settingsCompatible: entry.inputs['settingsCompatible'] }, 'measure-link');
    expect(result.status).toBe(entry.expected.status);
    expect(result.observations[0]).toMatchObject(entry.expected.observation);
    expect(result.acceptedEffects).toEqual([]);
  });

  it('RR-O07-MISSING-PATH reports missing authored path fact with no penalty/progress', () => {
    const entry = cases.get('RR-O07-MISSING-PATH')!;
    const result = run({ kind: 'radio-link', profile, ...entry.inputs }, 'measure-link');
    expect(result.status).toBe(entry.expected.status);
    expect(result.observations[0]).toMatchObject({ attemptPenalty: entry.expected.observation['attemptPenalty'],
      progressAward: entry.expected.observation['progressAward'], issue: { code: entry.expected.observation['reason'], field: 'viablePath' } });
    expect(result.acceptedEffects).toEqual([]);
  });

  it.each([
    ['radio-settings', 'check-settings', { settingsCompatible: true }, 'correct'],
    ['radio-path', 'check-path', { viablePath: true, settingsCompatible: false }, 'incorrect'],
    ['radio-path', 'check-path', { viablePath: false, settingsCompatible: true }, 'incorrect'],
    ['radio-link', 'measure-link', { viablePath: true, settingsCompatible: false, signal: { value: -65, unit: 'dBm' }, noise: { value: -90, unit: 'dBm' } }, 'incorrect'],
  ] as const)('keeps %s separate and honors each explicit prerequisite', (kind, inputKind, values, expected) => {
    const result = run({ kind, profile, ...values }, inputKind);
    expect(result.status).toBe(expected);
    expect(result.observations[0]).toMatchObject({ snrProven: false, throughputProven: false, wholeRouteProven: false });
    expect(result.observations[0]).not.toHaveProperty('snr');
    expect(result.acceptedEffects).toEqual([]);
  });

  it.each(['viablePath', 'settingsCompatible'])('missing %s is author error, distinct from an explicit false result', field => {
    const challenge: Record<string, unknown> = { kind: 'radio-path', profile, viablePath: true, settingsCompatible: true };
    delete challenge[field];
    expect(run(challenge, 'check-path')).toMatchObject({ status: 'content-error', acceptedEffects: [] });
    challenge[field] = false;
    expect(run(challenge, 'check-path')).toMatchObject({ status: 'incorrect', acceptedEffects: [] });
  });

  it('mismatched actions and unsupported channel guesses cannot fabricate a measurement', () => {
    const challenge = { kind: 'radio-path', profile, viablePath: true, settingsCompatible: true };
    expect(run(challenge, 'measure-link')).toMatchObject({ status: 'invalid-input', reasonCode: 'action-does-not-match-predicate', acceptedEffects: [] });
    expect(run({ ...challenge, selectedChannel: 6 }, 'check-path')).toMatchObject({ status: 'content-error', acceptedEffects: [] });
  });
});
