// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * T083 fixture audit only: no encounter, recovery, reducer or save execution.
 * Literal expected states are independently authored from accepted contracts.
 * Every behavior remains TODO until real T084/T088/T089 adapters execute it.
 * Do not replace those TODOs with fixture equality, a local rollback function,
 * mocked expected-return values, or production-generated expected states.
 */
type Value = Record<string, unknown>;
interface TransitionCase {
  id: string;
  kind: string;
  outcomeCaseIds: string[];
  requirements: string[];
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
  authorities: string[];
  frozenArtifacts: Record<string, string>;
  inputGaps: string[];
  worlds: Record<string, Value>;
  journals: Record<string, Value>;
  contexts: Record<string, Value>;
  cases: TransitionCase[];
}
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const fixture = JSON.parse(read('../fixtures/retry-transitions.json')) as Fixture;
const outcomes = JSON.parse(read('../fixtures/outcomes.json')) as { cases: { id: string }[] };
const outcomeIds = new Set(outcomes.cases.map(c => c.id));
const byId = new Map(fixture.cases.map(c => [c.id, c]));
function object(value: unknown): Value {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected fixture object');
  return value as Value;
}
function objects(value: unknown): Value[] {
  if (!Array.isArray(value)) throw new Error('Expected fixture object array');
  return value.map(object);
}
function getCase(id: string): TransitionCase {
  const c = byId.get(id);
  if (!c) throw new Error(`Missing independent transition ${id}`);
  return c;
}
function world(name: string): Value { return object(fixture.worlds[name]); }
function journal(name: string): Value { return object(fixture.journals[name]); }
function notebook(name: string): Value { return object(journal(name)['notebook']); }
function context(name: string): Value { return object(fixture.contexts[name]); }

describe('T083 independent transition fixture integrity — no runtime execution', () => {
  it('preserves all original source and outcome oracles byte-for-byte', () => {
    expect(Object.keys(fixture.frozenArtifacts)).toEqual([
      'content/spec001/sources.json', 'tests/fixtures/physical-cases.json',
      'tests/fixtures/repair-routes.json', 'tests/fixtures/outcomes.json',
    ]);
    for (const [path, sha256] of Object.entries(fixture.frozenArtifacts)) {
      expect(sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(createHash('sha256').update(read(`../../${path}`)).digest('hex'), path).toBe(sha256);
    }
    expect(outcomeIds.size).toBe(81);
  });

  it('keeps clear preparation scope, authority, semantic labels and runtime gaps', () => {
    expect(fixture.fixtureVersion).toBe(1);
    expect(fixture.task).toBe('T083');
    expect(fixture.scope).toContain('no application execution');
    expect(fixture.inputConvention).toContain('not a production API');
    expect(fixture.inputConvention).toContain('separately dispatched ordinary safe autosave');
    expect(fixture.authorities).toContain('SPEC.md');
    expect(fixture.authorities).toContain('specs/001-physical-layer-underworld/data-model.md');
    for (const path of fixture.authorities) expect(read(`../../${path}`).length).toBeGreaterThan(0);
    expect(fixture.inputGaps).toHaveLength(4);
    expect(fixture.cases).toHaveLength(45);
    expect(byId.size).toBe(45);
  });

  it.each(fixture.cases)('$id has resolvable outcome references and unexecuted real-interface obligations', c => {
    expect(c.id).toMatch(/^(RETRY|RESTORE)-[A-Z0-9-]+$/);
    expect(c.outcomeCaseIds.length).toBeGreaterThan(0);
    for (const id of c.outcomeCaseIds) expect(outcomeIds.has(id), id).toBe(true);
    expect(c.requirements.length).toBeGreaterThan(0);
    for (const requirement of c.requirements) expect(requirement).toMatch(/^(FR-\d{3}|AC\d{2}|SAVE\d{2})$/);
    expect(c.independentReasoning.length).toBeGreaterThan(90);
    expect(Object.keys(c.inputs).length).toBeGreaterThan(1);
    expect(Object.keys(c.expected).length).toBeGreaterThan(1);
    expect(c.execution.status).toBe('todo');
    expect(c.execution.tasks.length).toBeGreaterThan(0);
    for (const task of c.execution.tasks) expect(task).toMatch(/^T08[4689]$/);
  });

  it('resolves every shared literal state reference without invoking a state adapter', () => {
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key.endsWith('WorldRef') || key === 'worldRef') expect(fixture.worlds[String(child)], key).toBeDefined();
        if (key.endsWith('JournalRef') || key === 'journalRef') expect(fixture.journals[String(child)], key).toBeDefined();
        if (key.endsWith('ContextRef') || key === 'contextRef') expect(fixture.contexts[String(child)], key).toBeDefined();
        visit(child);
      }
    };
    visit(fixture.contexts); visit(fixture.cases);
  });

  it.each(Object.entries(fixture.worlds))('%s carries every reversible world field with legal nonduplicated quantities and party', (_name, value) => {
    expect(Object.keys(value).sort()).toEqual(['roomId', 'position', 'flags', 'completedObjectiveIds', 'completedQuestIds',
      'achievementIds', 'dialogueEffectIds', 'inventory', 'recruits', 'activeAllyIds', 'compendiumIds', 'route', 'continueOutcome'].sort());
    const inventory = objects(value['inventory']), recruits = objects(value['recruits']);
    expect(new Set(inventory.map(i => i['itemId'])).size).toBe(inventory.length);
    for (const item of inventory) {
      expect(Number.isInteger(item['quantity'])).toBe(true);
      expect(Number(item['quantity'])).toBeGreaterThan(0);
      expect(Number(item['quantity'])).toBeLessThanOrEqual(99);
    }
    const party = value['activeAllyIds'] as string[];
    expect(party.length).toBeLessThanOrEqual(2);
    expect(new Set(party).size).toBe(party.length);
    for (const id of party) expect(recruits.some(r => r['characterId'] === id)).toBe(true);
  });
});

describe('T083 rollback and repeated-cycle contract audit — fixture assertions only', () => {
  it('makes every reversible field differ before rollback, including earlier and attempt rewards', () => {
    const before = world('preparation'), attempted = world('attempt-end');
    for (const key of Object.keys(before).filter(key => key !== 'continueOutcome')) {
      expect(attempted[key], `${key} must expose a partial rollback`).not.toEqual(before[key]);
    }
    expect(before['inventory']).toEqual([
      { itemId: 'test-tool', quantity: 1 }, { itemId: 'repair-input', quantity: 2 }, { itemId: 'earlier-reward', quantity: 1 },
    ]);
    expect(attempted['inventory']).toEqual([
      { itemId: 'test-tool', quantity: 1 }, { itemId: 'earlier-reward', quantity: 1 },
      { itemId: 'repair-product', quantity: 1 }, { itemId: 'attempt-reward', quantity: 1 },
    ]);
    expect(before['dialogueEffectIds']).toEqual(['earlier-gift-receipt']);
    expect(attempted['dialogueEffectIds']).toEqual(['earlier-gift-receipt', 'attempt-gift-receipt']);
  });

  it.each(['RETRY-FAILURE-WHOLE-WORLD', 'RETRY-E03-WHOLE-WORLD'])('%s restores a coherent preparation body and keeps journal/history in memory', id => {
    const c = getCase(id);
    expect(c.expected).toMatchObject({ worldRef: 'preparation', journalRef: id === 'RETRY-E03-WHOLE-WORLD' ? 'shutdown-retained' : 'retained-stale', activity: 'safe-preparation',
      attemptId: 'attempt-b', configurationRevisionGreaterThan: 15, dirtyGeneration: 21, newSaveWrites: 0, newPersistentSlots: 0, confirmedSlotRevision: 12 });
    expect(object(context(String(c.inputs['contextRef']))['checkpoint'])['worldRef']).toBe('preparation');
  });

  it('retains changed notes, hypotheses, map discoveries, hints and outcome provenance, with no reward merge', () => {
    const current = journal('attempt-end'), retained = journal('retained-stale');
    for (const field of ['factIds', 'mapRoomIds', 'personalNotes', 'hypotheses']) {
      expect(notebook('retained-stale')[field]).toEqual(notebook('attempt-end')[field]);
      expect(notebook('preparation')[field]).not.toEqual(notebook('attempt-end')[field]);
    }
    expect(retained['assistance']).toEqual(current['assistance']);
    expect(objects(retained['assistance']).map(h => h['level'])).toEqual([1, 2, 3]);
    expect(retained['outcomeHistory']).toEqual(current['outcomeHistory']);
    expect(objects(retained['outcomeHistory']).map(e => e['id'])).toEqual(['prior-e02', 'prior-e03']);
    expect(getCase('RETRY-E03-WHOLE-WORLD').expected).toMatchObject({ retainOutcomeEventIds: ['prior-e02', 'shutdown-a'], shutdownWorldRetained: false });
    expect(getCase('RETRY-FACT-NOT-COMPLETION').expected).toEqual({ retainedFactIds: ['known-fact', 'connector-fault'],
      completedObjectiveIds: ['O01', 'O02', 'O03', 'O04', 'O09', 'O10'], uncompletedObjectiveIds: ['O11', 'O12'], automaticObjectiveAwards: 0 });
  });

  it('keeps current E03 history distinct from earlier E03 learning in a failed attempt', () => {
    expect(objects(journal('attempt-end')['outcomeHistory'])[1]).toMatchObject({ id: 'prior-e03', attemptId: 'attempt-earlier-shutdown' });
    expect(objects(journal('shutdown-end')['outcomeHistory'])[1]).toMatchObject({ id: 'shutdown-a', attemptId: 'attempt-a' });
    expect(journal('shutdown-retained')['outcomeHistory']).toEqual(journal('shutdown-end')['outcomeHistory']);
    expect(notebook('shutdown-retained')).toEqual(notebook('retained-stale'));
    expect(context('shutdown')['journalRef']).toBe('shutdown-end');
    expect(getCase('RETRY-E03-WHOLE-WORLD').expected['journalRef']).toBe('shutdown-retained');
  });

  it('three explicit cycles restore inputs and remove reward/receipt together, then debit before re-earning', () => {
    const c = getCase('RETRY-THREE-CYCLES-NO-FREE-ITEMS');
    expect(objects(c.inputs['steps'])).toHaveLength(6);
    const steps = objects(c.expected['steps']);
    expect(steps).toHaveLength(6);
    for (const index of [0, 3, 5]) expect(steps[index]).toMatchObject({ worldRef: 'preparation', repairInput: 2,
      repairProduct: 0, attemptReward: 0, attemptReceipt: false });
    for (const index of [1, 2, 4]) expect(steps[index]).toMatchObject({ repairInput: 0, repairProduct: 1, attemptReward: 1, attemptReceipt: true });
    expect(steps[2]).toMatchObject({ additionalAwards: 0, additionalConsumption: 0 });
    expect([steps[0]?.['attemptId'], steps[3]?.['attemptId'], steps[5]?.['attemptId']]).toEqual(['attempt-b', 'attempt-c', 'attempt-d']);
    expect(c.expected).toMatchObject({ journalRef: 'retained-stale', newSaveWrites: 0, duplicateFactIds: 0, duplicateHintUses: 0, duplicateOutcomeEventIds: 0 });
  });

  it('keeps the checkpoint detached and canceled recovery unchanged', () => {
    expect(getCase('RETRY-CHECKPOINT-DETACHED').expected).toEqual({ checkpointWorldRef: 'preparation',
      checkpointVersion: { attemptId: 'attempt-a', configurationRevision: 4 }, checkpointSharesMutableChildren: false, newSaveWrites: 0 });
    expect(getCase('RETRY-CHOICE-CANCEL').expected).toMatchObject({ allStateUnchanged: true, checkpointUnchanged: true, newSaveWrites: 0 });
  });
});

describe('T083 freshness/generation/atomicity audit — fixture assertions only', () => {
  it('retains all original readout IDs, values, attempts and revisions while explicitly marking every one stale', () => {
    const before = objects(notebook('attempt-end')['measurements']), after = objects(notebook('retained-stale')['measurements']);
    expect(before.map(m => m['stale'])).toEqual([true, false, true, true]);
    expect(after.map(m => m['stale'])).toEqual([true, true, true, true]);
    expect(after.map(({ stale: _stale, ...measurement }) => measurement)).toEqual(before.map(({ stale: _stale, ...measurement }) => measurement));
    expect(after.map(m => m['configurationRevision'])).toEqual([4, 8, 3, 12]);
    expect(getCase('RETRY-ALL-READINGS-STALE').expected['usableMeasurementIds']).toEqual([]);
  });

  it('independently isolates current, checkpoint, readout and issued revision floors', () => {
    expect(context('failed')).toMatchObject({ version: { configurationRevision: 8 }, checkpoint: { version: { configurationRevision: 4 } }, highestPriorRevision: 15 });
    expect(getCase('RETRY-HISTORICAL-REVISION-FLOOR').inputs['revisionBounds']).toEqual({ preparation: 4, current: 8, largestMeasurement: 12, previouslyIssued: 40 });
    expect(getCase('RETRY-HISTORICAL-REVISION-FLOOR').expected['configurationRevisionGreaterThan']).toBe(40);
    expect(getCase('RETRY-MEASUREMENT-REVISION-FLOOR').inputs['revisionBounds']).toEqual({ preparation: 4, current: 8, largestMeasurement: 70, previouslyIssued: 15 });
    expect(getCase('RETRY-MEASUREMENT-REVISION-FLOOR').expected['configurationRevisionGreaterThan']).toBe(70);
  });

  it('isolates wrong attempt from stale flag and requires a newly acquired measurement', () => {
    expect(getCase('RETRY-SAME-REVISION-WRONG-ATTEMPT').inputs['measurement']).toEqual({ configurationRevision: 16, attemptId: 'attempt-a', stale: false, result: 'pass' });
    expect(getCase('RETRY-EXPLICIT-STALE-MATCHING-VERSION').inputs['measurement']).toEqual({ configurationRevision: 16, attemptId: 'attempt-b', stale: true, result: 'pass' });
    for (const id of ['RETRY-SAME-REVISION-WRONG-ATTEMPT', 'RETRY-EXPLICIT-STALE-MATCHING-VERSION']) {
      expect(getCase(id).expected).toEqual({ usable: false, visible: true, objectiveAwards: 0, outcomeAwards: 0 });
    }
    expect(getCase('RETRY-FRESH-MEASUREMENT').expected).toMatchObject({ usableNewMeasurement: true, outcomeAwards: 0 });
  });

  it.each(['RETRY-OLD-ACTION-RECEIPT', 'RETRY-OLD-COMMAND-NEW-ID', 'RETRY-DELAYED-MEASUREMENT'])('%s rejects stale captured work without journal mutation', id => {
    expect(getCase(id).expected).toMatchObject({ status: 'rejected', journalRef: 'retained-stale' });
  });

  it.each(['RETRY-REUSED-CURRENT-ATTEMPT', 'RETRY-REUSED-HISTORICAL-ATTEMPT', 'RETRY-NO-CHECKPOINT',
    'RETRY-REUSED-HINT-ATTEMPT', 'RETRY-REUSED-OUTCOME-ATTEMPT',
    'RETRY-CROSS-ADVENTURE-CHECKPOINT', 'RETRY-UNSAFE-CHECKPOINT', 'RETRY-PENDING-TRANSITION',
    'RETRY-REVISION-EXHAUSTED', 'RETRY-DIRTY-GENERATION-EXHAUSTED'])('%s cannot partially mutate or save on rejection', id => {
    expect(getCase(id).expected).toMatchObject({ status: 'rejected', allStateUnchanged: true, newSaveWrites: 0 });
  });

  it('isolates attempt provenance found only in measurements, hints or outcomes', () => {
    expect(getCase('RETRY-REUSED-HISTORICAL-ATTEMPT').inputs['historicalAttemptReferences']).toEqual(['stale-measurement']);
    expect(getCase('RETRY-REUSED-HINT-ATTEMPT').inputs['historicalAttemptReferences']).toEqual(['hint-use']);
    expect(getCase('RETRY-REUSED-OUTCOME-ATTEMPT').inputs['historicalAttemptReferences']).toEqual(['outcome-event']);
  });

  it('uses documented revision and exact dirty-generation bounds, without rejecting the last legal revision', () => {
    const schema = JSON.parse(read('../../specs/001-physical-layer-underworld/contracts/save.schema.json')) as Value;
    const properties = object(object(object(schema['properties'])['world'])['properties']);
    expect(object(properties['configurationRevision'])['maximum']).toBe(2147483647);
    expect(getCase('RETRY-REVISION-EXHAUSTED').inputs['highestPriorRevision']).toBe(2147483647);
    expect(getCase('RETRY-DIRTY-GENERATION-EXHAUSTED').inputs['dirtyGeneration']).toBe(9007199254740991);
    expect(getCase('RETRY-LAST-LEGAL-REVISION').expected).toMatchObject({ configurationRevision: 2147483647, attemptId: 'attempt-b', newSaveWrites: 0 });
    expect(getCase('RETRY-REVISION-EXHAUSTED').expected['attemptIdReserved']).toBe(false);
    expect(getCase('RETRY-DIRTY-GENERATION-EXHAUSTED').expected['attemptIdReserved']).toBe(false);
  });

  it('requires complete precommit preservation and exposes only whole world/journal pairs', () => {
    expect(getCase('RETRY-INTERRUPTED-BEFORE-COMMIT').expected).toEqual({ allStateUnchanged: true, visiblePartialCandidate: false,
      checkpointUnchanged: true, newSaveWrites: 0, confirmedSlotRevision: 12 });
    expect(getCase('RETRY-ATOMIC-OBSERVER').expected).toEqual({ allowedWorldJournalPairs: [['attempt-end', 'attempt-end'], ['preparation', 'retained-stale']],
      forbiddenPairs: [['preparation', 'attempt-end'], ['attempt-end', 'retained-stale']], finalActivity: 'safe-preparation', newSaveWrites: 0 });
  });
});

describe('T083 Restore and one-slot boundary audit — fixture assertions only', () => {
  it('replaces the entire unsaved journal and world from one saved snapshot after warning', () => {
    const c = getCase('RESTORE-REPLACES-WORLD-AND-JOURNAL');
    expect(c.inputs).toMatchObject({ storedContextRef: 'saved', confirmedDiscard: true, storedSnapshotValidated: true });
    expect(c.expected).toMatchObject({ worldRef: 'saved', journalRef: 'saved', version: { attemptId: 'saved-attempt', configurationRevision: 2 },
      adventureId: 'saved-adventure', checkpoint: null, warningBeforeDiscard: true, newSaveWrites: 0, newPersistentSlots: 0, confirmedSlotRevision: 12 });
    for (const kind of ['Facts', 'Notes', 'Hypotheses', 'Map', 'Hints', 'Outcomes']) expect(c.expected[`mergedUnsaved${kind}`]).toBe(false);
    for (const field of ['factIds', 'mapRoomIds', 'personalNotes', 'hypotheses', 'measurements']) {
      expect(notebook('saved')[field]).not.toEqual(notebook('retained-stale')[field]);
    }
    expect(journal('saved')['assistance']).toEqual([]);
    expect(journal('saved')['outcomeHistory']).toEqual([]);
  });

  it.each(['RESTORE-CANCEL-UNCHANGED', 'RESTORE-FETCH-FAILURE', 'RESTORE-INVALID-SNAPSHOT'])('%s leaves current state and confirmed slot intact', id => {
    expect(getCase(id).expected).toMatchObject({ allStateUnchanged: true, confirmedSlotRevision: 12, newSaveWrites: 0 });
  });

  it('defers replacement until a full response and rejects callbacks from a replaced runtime even at equal versions', () => {
    expect(getCase('RESTORE-DEFERRED-RESPONSE').expected).toMatchObject({ worldRef: 'preparation', journalRef: 'retained-stale', partialSavedWorldVisible: false, newSaveWrites: 0 });
    const c = getCase('RESTORE-OLD-CALLBACK-SAME-VERSION');
    expect(c.inputs['capturedAdventureId']).toBe(c.inputs['storedAdventureId']);
    expect(c.inputs['capturedVersion']).toEqual(c.inputs['storedVersion']);
    expect(c.inputs['capturedRuntimeIdentity']).not.toBe(c.inputs['currentRuntimeIdentity']);
    expect(c.expected).toEqual({ oldCallbackAccepted: false, additionalAwards: 0, newSaveWrites: 0, loadedSnapshotUnchanged: true });
    expect(getCase('RESTORE-REBUILD-PREPARATION-ON-ENTRY').expected).toMatchObject({ reusedPreRestoreCheckpoint: false, checkpointPersisted: false, newPersistentSlots: 0 });
  });

  it('gives guests memory retry but never an account Restore Save disguised as a checkpoint', () => {
    expect(getCase('RETRY-GUEST-IN-MEMORY').expected).toMatchObject({ requiresSignIn: false, newSaveWrites: 0, newPersistentSlots: 0 });
    expect(getCase('RESTORE-GUEST-REQUIRES-SIGNIN').expected).toMatchObject({ restoreAvailable: false, requiresSignIn: true,
      checkpointUsedAsAccountSave: false, allStateUnchanged: true, newSaveWrites: 0 });
  });

  it.each(['RETRY-LATER-MANUAL-SAVE', 'RETRY-LATER-OPTIN-AUTOSAVE'])('%s alone makes the retained journal durable in the same slot', id => {
    expect(getCase(id).inputs['contextRef']).toBe('e03-continued');
    expect(getCase(id).expected).toMatchObject({ savedWorldRef: 'preparation', savedJournalRef: 'shutdown-retained', newSaveWrites: 1,
      confirmedSlotRevision: 13, logicalSlotCount: 1, checkpointInPayload: false, shutdownWorldInPayload: false });
  });

  it('keeps autosave opt-out, unsafe queued work and conflicts distinct from an acknowledged safe save', () => {
    expect(getCase('RETRY-AUTOSAVE-OFF').expected).toMatchObject({ newSaveWrites: 0, confirmedSlotRevision: 12, retainedLearningDurable: false, showUnsaved: true });
    expect(getCase('RETRY-UNSAFE-AUTOSAVE-RACE').expected).toEqual({ terminalSnapshotWrites: 0, partialSnapshotWrites: 0, newSaveWrites: 0, confirmedSlotRevision: 12 });
    expect(getCase('RETRY-SAFE-SAVE-CONFLICT').expected).toMatchObject({ newSaveWrites: 0, serverCurrentRevision: 13,
      showConflict: true, retainedLearningDurable: false, automaticMerge: false });
  });

  it('does not confuse stale gameplay command receipts with still-valid durable save acknowledgements', () => {
    expect(getCase('RETRY-OLD-ACTION-RECEIPT').expected).toMatchObject({ status: 'rejected', reason: 'stale-version' });
    const c = getCase('RETRY-EARLIER-SAVE-ACK');
    expect(c.inputs).toMatchObject({ capturedDirtyGeneration: 19, currentDirtyGeneration: 21, committedRevision: 12, serverCurrentRevision: 13,
      receiptMatchesExactEarlierRequest: true });
    expect(c.expected).toMatchObject({ matchingReceiptAcknowledged: true, marksCurrentRetrySaved: false, currentDirtyGeneration: 21,
      mustReconcileCurrentSlot: true, newSaveWrites: 0, journalRef: 'retained-stale' });
  });

  it('preserves both accepted logout branches after retained learning changes', () => {
    expect(getCase('RETRY-LOGOUT-CANCEL').expected).toEqual({ allStateUnchanged: true, sessionUnchanged: true, checkpointUnchanged: true,
      newSaveWrites: 0, confirmedSlotRevision: 12 });
    expect(getCase('RETRY-LOGOUT-CONFIRMED').expected).toEqual({ game: null, checkpoint: null, notebook: null, screen: 'title',
      queuedAutosaveCanceled: true, newSaveWrites: 0, confirmedSlotRevision: 12, retainedLearningDurable: false });
  });
});

describe('T083 real encounter/recovery/save behavior — pending T084/T088/T089', () => {
  for (const c of fixture.cases) {
    it.todo(`${c.id}: ${c.execution.tasks.join('/')} must exercise the real interface against the independent transition`);
  }
});
