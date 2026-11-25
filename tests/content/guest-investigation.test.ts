// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/guest-investigation.json' with { type: 'json' };

// These checks protect the independent test plan, not application behavior.
// No application registry, reducer, UI, evaluator or result generator is used.
const root = new URL('../../', import.meta.url);
const browserSource = readFileSync(new URL('tests/e2e/guest-introduction.spec.ts', root), 'utf8');
const reviewed = JSON.parse(readFileSync(new URL('tests/fixtures/physical-cases.json', root), 'utf8')) as {
  reviewCases: { id: string; inputs: Record<string, unknown>; expected: { observation: Record<string, unknown> } }[];
};

describe('T022 independent guest expectation integrity (not guest gameplay acceptance)', () => {
  it('retains nine distinct source-backed cases and their concrete browser bodies', () => {
    expect(fixture.cases.map(entry => entry.id)).toEqual(['GI01', 'GI02', 'GI03', 'GI04', 'GI05', 'GI06', 'GI07', 'GI08', 'GI09']);
    const sourceIds = new Set(fixture.sources.map(entry => entry.id));
    expect(sourceIds.size).toBe(fixture.sources.length);
    for (const entry of fixture.cases) {
      expect(entry.sourceIds.length).toBeGreaterThan(0);
      expect(entry.sourceIds.every(id => sourceIds.has(id))).toBe(true);
      expect(new Set(entry.expect).size).toBe(entry.expect.length);
      expect(entry.requirements.some(id => id === 'AC01' || id === 'AC04')).toBe(true);
      expect(browserSource.split(`test('${entry.id} ${entry.title}', async () => {`)).toHaveLength(2);
    }
  });

  it.each(fixture.sources)('keeps literal authority anchor $id available in $path', entry => {
    expect(entry.path).not.toMatch(/(^\/|\.\.|https?:|\.env)/);
    expect(readFileSync(new URL(entry.path, root), 'utf8')).toContain(entry.anchor);
  });

  it('preserves SPEC room/objective identities and independent completion prerequisites', () => {
    expect(fixture.episode).toBe('spec001');
    expect(fixture.world.rooms).toEqual([
      { id: 'spec001:R01', name: 'The Arrival Lift' },
      { id: 'spec001:R02', name: "The Titan's Workshop" },
    ]);
    expect(fixture.world.objectives).toEqual([
      { id: 'spec001:O01', name: 'Read the silent link in R01', requires: ['separate-power-observation', 'separate-link-observation', 'valid-inspection'] },
      { id: 'spec001:O02', name: 'Open the investigation in R02', requires: ['O01', 'known-good-endpoints', 'declared-physical-path', 'pinned-hypothesis'] },
    ]);
    expect(fixture.world.characters).toEqual(['spec001:CH03', 'spec001:CH02']);
  });

  it('transcribes existing reviewed power and scope cases without inventing story facts', () => {
    const power = reviewed.reviewCases.find(entry => entry.id === fixture.reviewedPreparation.power.caseId)!;
    expect(power.inputs).toMatchObject({ powerLamp: 'on', linkLamp: 'off' });
    expect(power.expected.observation).toEqual({ powered: true, linkIndicated: false, serviceProven: false });
    expect(fixture.reviewedPreparation.power).toEqual({ caseId: 'C-PWR-OBS', powerLamp: 'on', linkLamp: 'off', powered: true, linkIndicated: false, serviceProven: false });
    const partial = reviewed.reviewCases.find(entry => entry.id === fixture.reviewedPreparation.partialPower.caseId)!;
    expect(partial.expected.observation).toMatchObject({ objectiveComplete: false });
    expect(fixture.reviewedPreparation.partialPower).toEqual({ caseId: 'B-PWR-ONLY', objectiveComplete: false });
    const scope = reviewed.reviewCases.find(entry => entry.id === fixture.reviewedPreparation.scope.caseId)!;
    expect(scope.inputs).toMatchObject({ endpoints: ['known-A', 'known-B'], physicalPath: 'declared-path', hypothesisPinned: true });
    expect(scope.expected.observation).toEqual({ investigationPrepared: true, hypothesisIsFact: false });
    expect(fixture.reviewedPreparation.scope).toEqual({ caseId: 'C-SCOPE', endpoints: ['known-A', 'known-B'], physicalPath: 'declared-path', hypothesisPinned: true, investigationPrepared: true, hypothesisIsFact: false });
    expect(fixture.ui.text.powerCondition).toBe('Power indication: lit.');
    expect(fixture.ui.text.linkCondition).toBe('Link indication: unlit.');
  });

  it('covers controls, notebook, retention, nonduplication, freshness and guest honesty', () => {
    expect(fixture.ui.verbs).toEqual(['Walk', 'Look', 'Talk', 'Use']);
    expect(fixture.ui.shortcuts).toEqual({ Walk: 'W', Look: 'L', Talk: 'T', Use: 'U', Inventory: 'I', Notebook: 'N', Compendium: 'C' });
    expect(fixture.ui.notebookSections).toEqual(['Objectives', 'Evidence', 'Hypotheses', 'Maps', 'Personal Notes']);
    const coverage = new Set(fixture.cases.flatMap(entry => entry.expect));
    for (const required of [
      'O01-incomplete-before-valid-inspection', 'O01-complete', 'known-good-endpoints',
      'declared-physical-path', 'O02-incomplete-before-pin', 'O02-complete',
      'hypothesis-distinct-from-observation', 'power-lit', 'link-unlit',
      'skip-Photon', 'skip-Titan', 'replay-Photon', 'replay-Titan',
      'same-inventory-quantities', 'same-completed-objectives', 'same-clue-counts',
      'notes-as-text', 'source-room-preserved', 'no-duplicate-evidence-on-return',
      'old-reading-retained', 'no-current-reading-before-remeasurement', 'new-current-reading-after-remeasurement',
      'guest-session-only-label', 'continued-room-travel', 'no-save-write', 'no-provider-navigation', 'no-key-prompt',
    ]) expect(coverage.has(required), required).toBe(true);
  });

  it('keeps authoring dependencies and story acceptance distinct from fixture checks', () => {
    expect(fixture.task).toBe('T022');
    expect(fixture.preparation.pendingUntil).toEqual(['T023', 'T024', 'T025', 'T026', 'T027', 'T028', 'T029']);
    expect(fixture.preparation.activationTask).toBe('T030');
    expect(fixture.preparation.scope).toContain('not playable-story');
    expect(fixture.preparation.method).toContain('never generated from application output');
    expect(fixture.preparation.changePolicy).toContain('Remove all browser fixme annotations at T030');
    expect(fixture.ui.policy).toContain('Proposed functional accessible labels');
    expect(fixture.playerInput.inputPolicy).toContain('not scored networking facts');
  });
});
