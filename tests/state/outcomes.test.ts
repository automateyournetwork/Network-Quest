// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * T082 oracle preparation only. These tests audit independently authored data;
 * NONE executes an outcome, encounter, save or browser implementation.
 *
 * Every application case below stays TODO until an adapter calls the actual
 * T084–T089 interfaces. Never replace it with fixture equality, a local classifier,
 * mocked expected-return values or a production-generated expected answer.
 * Semantic fixture labels are not a proposed production API/content registry.
 */
type Value = Record<string, unknown>;
interface Case {
  id: string;
  kind: 'classification' | 'epilogue' | 'recovery' | 'failure-presentation' | 'save-boundary' | 'atomicity';
  requirements: string[];
  sourceCaseIds: string[];
  repairCaseIds: string[];
  inputs: Value;
  expected: Value;
  independentReasoning: string;
  execution: { status: 'todo'; tasks: string[] };
}
interface Fixture {
  fixtureVersion: number;
  task: string;
  scope: string;
  inputConvention: string;
  frozenArtifacts: Record<string, string>;
  authorities: string[];
  inputGaps: string[];
  cases: Case[];
}
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const fixture = JSON.parse(read('../fixtures/outcomes.json')) as Fixture;
const physical = JSON.parse(read('../fixtures/physical-cases.json')) as {
  referenceCases: { id: string }[]; reviewCases: { id: string }[];
};
const repair = JSON.parse(read('../fixtures/repair-routes.json')) as { cases: { id: string }[] };
const byId = new Map(fixture.cases.map(entry => [entry.id, entry]));
const physicalIds = new Set([...physical.referenceCases, ...physical.reviewCases].map(entry => entry.id));
const repairIds = new Set(repair.cases.map(entry => entry.id));
const outcomes = ['E01', 'E02', 'E03'] as const;
const selections = ['permanent', 'temporary', 'shutdown'] as const;
const routes = ['copper', 'fiber', 'radio'] as const;
function entry(id: string): Case {
  const result = byId.get(id);
  if (!result) throw new Error(`Missing independent outcome expectation ${id}`);
  return result;
}
function object(value: unknown): Value {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as Value;
}

describe('T082 independent fixture integrity — no application execution', () => {
  it('keeps accepted sources and both original independent oracles byte-for-byte', () => {
    expect(fixture.frozenArtifacts).toEqual({
      'content/spec001/sources.json': 'a46ec103c9ec5e5103fd85543d2c9965b22e4204b98d40df2629303917527116',
      'tests/fixtures/physical-cases.json': 'de255ec172b43d25fe6bcee84559f974f9ffb1f62d69d69bca16cab50a2697d1',
      'tests/fixtures/repair-routes.json': 'ed3a083828188a34fd6f5f345cbd4c69fe8ebb140ea903dbafd9b3f464639877',
    });
    for (const [path, sha256] of Object.entries(fixture.frozenArtifacts)) {
      expect(createHash('sha256').update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex')).toBe(sha256);
    }
    expect(physicalIds.size).toBe(83);
    expect(repairIds.size).toBe(52);
  });

  it('declares scope, independent authority, unfinished bindings and unique cases', () => {
    expect(fixture.fixtureVersion).toBe(1);
    expect(fixture.task).toBe('T082');
    expect(fixture.scope).toContain('no application execution');
    expect(fixture.inputConvention).toContain('not a production API');
    expect(fixture.inputGaps).toHaveLength(5);
    expect(fixture.authorities).toContain('SPEC.md');
    expect(fixture.authorities).toContain('specs/001-physical-layer-underworld/data-model.md');
    for (const path of fixture.authorities) expect(read(`../../${path}`).length).toBeGreaterThan(0);
    expect(fixture.cases).toHaveLength(81);
    expect(byId.size).toBe(81);
    expect(fixture.cases.filter(c => c.kind === 'classification')).toHaveLength(54);
    expect(fixture.cases.filter(c => c.kind === 'recovery')).toHaveLength(7);
    expect(fixture.cases.filter(c => c.kind === 'save-boundary')).toHaveLength(12);
  });

  it.each(fixture.cases)('$id has contract references and explicitly unexecuted work', c => {
    expect(c.id).toMatch(/^OUT-[A-Z0-9-]+$/);
    expect(physicalIds.has(c.id)).toBe(false);
    expect(repairIds.has(c.id)).toBe(false);
    expect(c.requirements.length).toBeGreaterThan(0);
    for (const requirement of c.requirements) expect(requirement).toMatch(/^(FR-\d{3}|AC\d{2}|SAVE\d{2})$/);
    expect(c.sourceCaseIds.length).toBeGreaterThan(0);
    for (const id of c.sourceCaseIds) expect(physicalIds.has(id), id).toBe(true);
    expect(c.repairCaseIds.length).toBeGreaterThan(0);
    for (const id of c.repairCaseIds) expect(repairIds.has(id), id).toBe(true);
    expect(Object.keys(c.inputs).length).toBeGreaterThan(0);
    expect(Object.keys(c.expected).length).toBeGreaterThan(0);
    expect(c.independentReasoning.length).toBeGreaterThan(70);
    expect(c.execution.status).toBe('todo');
    expect(c.execution.tasks.length).toBeGreaterThan(0);
    for (const task of c.execution.tasks) expect(task).toMatch(/^T08[3-9]$/);
  });
});

describe('T082 classification truth-table review — fixture assertions only', () => {
  it.each(routes)('%s has independent permanent, temporary and shutdown expectations', route => {
    const branch = { copper: ['O03', 'O04'], fiber: ['O05', 'O06'], radio: ['O07', 'O08'] }[route];
    for (const [index, code] of outcomes.entries()) {
      const c = entry(`OUT-${code}-${route.toUpperCase()}`);
      expect(c.inputs).toMatchObject({ route, selection: selections[index], completedObjectives: ['O01', 'O02', ...branch, 'O09', 'O10', 'O11'],
        otherBranchesCompleted: false, optionalRewards: [], futureRealmAvailable: false, interventionCompleted: true });
      expect(c.expected).toMatchObject({ status: 'correct', outcome: code, awardedRestoredService: code !== 'E03', permanentRepair: code === 'E01' });
      if (code !== 'E03') {
        expect(c.inputs['allScopedPhysicalChecks']).toBe(true);
        for (const check of ['physical', 'endpoint']) expect(c.inputs[check]).toEqual({
          route, configurationRevision: 8, attemptId: 'attempt-b', explicitlyStale: false, result: 'pass',
        });
      }
    }
  });

  it('records each positive class with its own necessary limits', () => {
    const permanent = entry('OUT-E01-COPPER'), temporary = entry('OUT-E02-COPPER'), shutdown = entry('OUT-E03-COPPER');
    expect(permanent.inputs['defectRemoved']).toBe(true);
    expect(object(permanent.inputs['temporary'])['dependency']).toBeNull();
    expect(permanent.expected['requiredCaveats']).toEqual([]);
    expect(temporary.expected['requiredCaveats']).toEqual(['dependency', 'limitation', 'followup']);
    for (const key of ['dependency', 'limitation', 'followup']) expect(String(object(temporary.inputs['temporary'])[key]).length).toBeGreaterThan(10);
    expect(shutdown.inputs['endpoint']).toBeNull();
    expect(shutdown.inputs['allScopedPhysicalChecks']).toBe(false);
    expect(object(shutdown.inputs['isolation'])).toMatchObject({ deliberate: true });
    expect(shutdown.expected).toMatchObject({ awardedRestoredService: false, permanentRepair: false, requiredCaveats: ['unresolvedDefect', 'recoveryPlan'] });
  });

  it.each(outcomes)('%s assistance variants differ only in their retained hint history', code => {
    const baseline = entry(`OUT-${code}-COPPER`);
    for (const levels of [[1], [1, 2], [1, 2, 3]]) {
      const c = entry(`OUT-${code}-HINT-${levels.length}`);
      expect(c.inputs).toEqual({ ...baseline.inputs, hintLevelsUsed: levels });
      expect(c.expected).toMatchObject({ status: 'correct', outcome: code, assistanceChangesClassification: false, retainedHintLevels: levels });
    }
  });

  it.each([
    ['PERMANENT-DEFECT-REMAINS', 'defect-not-removed'],
    ['TEMP-AS-PERMANENT', 'temporary-is-not-permanent'],
    ['TEMP-NO-DEPENDENCY', 'temporary-dependency-not-named'],
    ['TEMP-NO-LIMITATION', 'temporary-limitation-missing'],
    ['TEMP-NO-FOLLOWUP', 'temporary-followup-missing'],
    ['SHUTDOWN-NO-FAULT', 'unresolved-defect-not-named'],
    ['SHUTDOWN-NOT-DELIBERATE', 'shutdown-not-deliberate'],
    ['SHUTDOWN-NO-RECOVERY', 'shutdown-recovery-plan-missing'],
    ['SHUTDOWN-AS-RESTORED', 'unresolved-isolation-is-not-restoration'],
    ['NO-INTERVENTION', 'intervention-not-complete'],
  ])('%s withholds an ending for its independently necessary premise', (suffix, reason) => {
    expect(entry(`OUT-${suffix}`).expected).toMatchObject({ status: 'incorrect', outcome: null, awardedRestoredService: false, progressAwards: 0, reason });
  });

  it('does not silently award E02 for an explicitly incorrect permanent claim', () => {
    expect(entry('OUT-TEMP-AS-PERMANENT').inputs).toEqual({ ...entry('OUT-E02-COPPER').inputs, selection: 'permanent' });
    expect(entry('OUT-TEMP-AS-PERMANENT').expected).toMatchObject({ outcome: null, eligibleOutcome: 'E02' });
    expect(entry('OUT-TEMP-AS-PERMANENT').expected).not.toHaveProperty('permanentRepair');
  });

  it.each(selections.slice(0, 2))('%s keeps failed and absent physical and endpoint proof separate', selection => {
    const prefix = `OUT-${selection.toUpperCase()}`;
    expect(entry(`${prefix}-PHYSICAL-FAIL`).inputs).toMatchObject({ allScopedPhysicalChecks: false, physical: { result: 'fail' }, endpoint: { result: 'pass' } });
    expect(entry(`${prefix}-PHYSICAL-MISSING`).inputs['physical']).toBeNull();
    expect(entry(`${prefix}-ENDPOINT-FAIL`).inputs).toMatchObject({ allScopedPhysicalChecks: true, physical: { result: 'pass' }, endpoint: { result: 'fail' } });
    expect(entry(`${prefix}-ENDPOINT-MISSING`).inputs['endpoint']).toBeNull();
    expect(entry(`${prefix}-ARRIVAL-LINK-ONLY`).inputs).toMatchObject({ atBalcony: true, linkUp: true, physical: null, endpoint: null });
    for (const suffix of ['PHYSICAL-FAIL', 'PHYSICAL-MISSING', 'ENDPOINT-FAIL', 'ENDPOINT-MISSING', 'ARRIVAL-LINK-ONLY']) {
      expect(entry(`${prefix}-${suffix}`).expected).toMatchObject({ status: 'incorrect', outcome: null, awardedRestoredService: false });
    }
  });

  it.each(['permanent', 'temporary'])('%s isolates every freshness dimension for each independent observation', selection => {
    const baseline = entry(selection === 'permanent' ? 'OUT-E01-COPPER' : 'OUT-E02-COPPER');
    for (const check of ['physical', 'endpoint']) {
      for (const [suffix, field, value] of [['REVISION', 'configurationRevision', 7], ['ATTEMPT', 'attemptId', 'attempt-a'], ['FLAG', 'explicitlyStale', true]] as const) {
        const c = entry(`OUT-${selection.toUpperCase()}-${check.toUpperCase()}-STALE-${suffix}`);
        expect(c.inputs).toEqual({ ...baseline.inputs, [check]: { ...object(baseline.inputs[check]), [field]: value } });
        expect(c.expected).toMatchObject({ status: 'incorrect', outcome: null, reason: 'stale-evidence', observationRemainsVisible: true });
      }
    }
  });

  it.each(['MISSING-UNIT', 'NEGATIVE-LOSS', 'UNKNOWN-PROFILE'])('%s author error precedes missing learner input', suffix => {
    const c = entry(`OUT-CONTENT-${suffix}`);
    expect(c.inputs['selection']).toBeNull();
    expect(c.inputs['authoringIssue']).not.toBeNull();
    expect(c.expected).toMatchObject({ status: 'content-error', outcome: null, progressAwards: 0, itemConsumption: 0, attemptPenalty: 0 });
  });

  it('reserves invalid-input for the absent action on valid content', () => {
    expect(entry('OUT-MISSING-ACTION').inputs).toMatchObject({ selection: null, authoringIssue: null });
    expect(entry('OUT-MISSING-ACTION').expected).toMatchObject({ status: 'invalid-input', progressAwards: 0, itemConsumption: 0, attemptPenalty: 0 });
  });

  it.each(outcomes)('%s personalizes without a required ally, optional reward or punitive hint downgrade', code => {
    const c = entry(`OUT-${code}-PERSONALIZED`);
    expect(c.inputs).toMatchObject({ otherBranchesCompleted: false, optionalRewards: [], hintLevelsUsed: [1, 2, 3] });
    expect(c.expected).toMatchObject({ outcome: code, noAssistanceShaming: true, preservePersonalization: c.inputs['personalization'] });
  });
});

describe('T082 failure/Continue/save contract review — fixture assertions only', () => {
  it.each(['OUT-FAILURE-RETRY', 'OUT-E03-CONTINUE'])('%s rewinds world but retains learning without saving', id => {
    const c = entry(id);
    expect(c.inputs['preparation']).toMatchObject({ configurationRevision: 4, attemptId: 'attempt-a' });
    expect(c.inputs['attemptEnd']).toMatchObject({ configurationRevision: 8, attemptId: 'attempt-a', inventory: ['tool'], party: ['helper-b'] });
    expect(c.expected).toMatchObject({ worldSource: 'preparation', inventory: ['tool', 'replacement'], party: ['helper-a'],
      completedObjectives: ['O11-preparation'], effectFlags: ['preparation-only'], retainedFacts: ['fault-observed'],
      personalNotes: 'Check the connector before reconnecting.', retainedHypotheses: ['damaged-path'], retainedMapDiscoveries: ['balcony'],
      retainedHintLevels: [1, 2, 3], measurementsVisibleAndStale: ['attempt-reading'], newAttemptIdRequired: true, revisionMustExceed: 8,
      implicitSaveWrites: 0, newPersistentSlots: 0, confirmedSlotUnchanged: true, temporarySessionRecovery: true });
  });

  it('preserves a specific failed-guess explanation and reversible precommit return', () => {
    expect(entry('OUT-FAILED-GUESS').expected).toMatchObject({ awardedRestoredService: false, returnToDiagnosisAvailable: true, implicitSaveWrites: 0 });
    expect(entry('OUT-FAILED-GUESS').expected['specificObservation']).toContain('required path remains open');
    expect(entry('OUT-PRECOMMIT-RETURN').expected).toEqual({ safePreparationReachable: true, inventory: ['tool', 'replacement'], partialRewards: 0, partialConsumption: 0, implicitSaveWrites: 0 });
  });

  it.each(['GUEST', 'ACCOUNT'])('%s failure names temporary retry and the distinct account restore capability', audience => {
    expect(entry(`OUT-FATAL-${audience}`).expected).toEqual({ shortSkippableScene: true, causeExplained: true,
      retryFromEncounterPreparation: true, retryLabelSaysTemporary: true, restoreSaveAvailable: audience === 'ACCOUNT',
      guestRestoreRequiresSignIn: audience === 'GUEST', implicitSaveWrites: 0, confirmedSlotUnchanged: true });
  });

  it('Restore Save replaces the saved world and journal while canceled restore changes neither', () => {
    expect(entry('OUT-RESTORE-SAVE').expected).toEqual({ warningBeforeDiscard: true, worldSource: 'confirmed-snapshot-world',
      journalSource: 'confirmed-snapshot-learning', mergeNewAttemptLearning: false, readDoesNotRewriteSlot: true, newPersistentSlots: 0 });
    expect(entry('OUT-RESTORE-CANCEL').expected).toEqual({ currentWorldUnchanged: true, currentJournalUnchanged: true, confirmedSlotUnchanged: true, implicitSaveWrites: 0 });
  });

  it.each(['E01', 'E02'])('%s safe Continue preserves success rather than rewinding it', code => {
    expect(entry(`OUT-${code}-CONTINUE`).expected).toEqual({ continueTarget: 'authored-safe-location', preserveSuccessfulWorld: true,
      preserveOutcomeHistory: true, sideRoutesAccessible: true, rewindPreparation: false, implicitSaveWrites: 0, newPersistentSlots: 0 });
    expect(entry(`OUT-${code}-SAFE-CONTINUE`).expected).toMatchObject({ snapshotEligible: true, implicitSaveWrites: 0, continueTarget: 'authored-safe-location' });
    expect(entry(`OUT-${code}-NO-SAFE-CONTINUE`).expected).toMatchObject({ snapshotEligible: false, implicitSaveWrites: 0, continueTarget: null });
  });

  it.each(['terminal-failure', 'shutdown', 'unresolved-transition', 'active-encounter', 'dialogue-transaction', 'cutscene', 'write-in-progress'])('%s cannot overwrite the recoverable slot', activity => {
    const c = entry(`OUT-SAVE-BLOCK-${activity.toUpperCase()}`);
    expect(c.inputs).toMatchObject({ activity, manualSaveRequested: true, autosaveEnabled: true, autosaveEventQueued: true, confirmedSlotRevision: 12 });
    expect(c.expected).toEqual({ snapshotEligible: false, newSaveWrites: 0, confirmedSlotRevision: 12, restrictionExplained: true });
  });

  it('permits E03 history only in a later safe world under ordinary same-slot rules', () => {
    expect(entry('OUT-E03-CONTINUE').expected).toMatchObject({ retainE03History: true, shutdownWorldRetained: false, implicitSaveWrites: 0 });
    expect(entry('OUT-E03-AFTER-CONTINUE-SAVE').expected).toEqual({ snapshotEligible: true, persistE03History: true,
      persistRetainedLearning: true, persistShutdownWorld: false, usesSameLogicalSlot: true, newPersistentSlots: 0 });
  });

  it('replayed or interrupted outcome acceptance cannot partly grant or consume', () => {
    expect(entry('OUT-EVENT-REPLAY').expected).toEqual({ additionalOutcomeEvents: 0, additionalProgressAwards: 0, additionalItemConsumption: 0, implicitSaveWrites: 0 });
    expect(entry('OUT-INTERRUPTED-ACCEPTANCE').expected).toEqual({ status: 'invalid-input', outcome: null, partialRewards: 0,
      partialConsumption: 0, partialOutcomeEvents: 0, attemptPenalty: 0, implicitSaveWrites: 0 });
  });
});

describe('T082 actual outcome/encounter/recovery behavior — pending implementation and dependency join', () => {
  for (const c of fixture.cases) {
    it.todo(`${c.id}: ${c.execution.tasks.join('/')} must exercise the real interface against this independent expectation`);
  }
});
