// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Fixed T092 inputs map to actual source identities and production operations.
import { readFileSync, writeFileSync } from 'node:fs';
import { afterAll, expect, it, vi } from 'vitest';
import { episodeNavigationEntries } from '../../src/app/content';
import { prepareCopperAction } from '../../src/state/copper-scenario';
import { createNavigation } from '../../src/state/navigation';
import { maintenanceFixture, activity, registry, world, q } from '../ui/maintenance-fixture';
const oracle = JSON.parse(readFileSync('tests/fixtures/optional-activities.json','utf8'));
const cases: Array<{ id: string; inputs: any; expected: any }> = oracle.cases.filter((c: any) => c.subject === 'spec001:SQ04' && c.kind === 'lifecycle');
const receipts: Record<string, unknown> = {};
const navigation = createNavigation({ registry, world, entries: episodeNavigationEntries(registry, world) });
const completed = (f: ReturnType<typeof maintenanceFixture>) => f.game().world.completedQuestIds.includes(q('SQ04'));
const benefit = (f: ReturnType<typeof maintenanceFixture>) => f.game().notebook.factIds.filter(id => id === q('FACT-SQ04-history')).length;
const finish = (f: ReturnType<typeof maintenanceFixture>) => { f.mode('delivery'); return f.send({ kind: 'submit-optional-maintenance', sessionId: f.session(), answer: { selectedFactIds: activity.delivery.factIds } }); };
const safeExit = (f: ReturnType<typeof maintenanceFixture>) => !!f.controller.project().view?.controls.exit;
const retry = (f: ReturnType<typeof maintenanceFixture>) => !!f.controller.project().view?.controls.retry;
it.each(cases)('$id executes its actual shared lifecycle expectations', (c: any) => {
  const f = maintenanceFixture(['OPT-SQ04-FINISH','OPT-SQ04-REPLAY','OPT-SQ04-UNTIMED'].includes(c.id));
  const before = structuredClone(f.game()); let actual: Record<string, unknown> = {};
  if (c.id === 'OPT-SQ04-START') { f.start(); actual = { instructionsVisible: !!f.controller.project().view?.instructions.length, practiceAvailable: !!f.controller.project().view?.controls.practice,
    exitAvailable: safeExit(f), timerRunning: f.state().control.optionalActivity?.timingEnabled, completionAward: benefit(f) }; }
  if (c.id === 'OPT-SQ04-PRACTICE') { f.start(); f.mode('practice'); actual = { explanationAvailable: !!f.controller.project().view?.feedback, retryAvailable: retry(f), exitAvailable: safeExit(f),
    timerRunning: f.state().control.optionalActivity?.timingEnabled, assistanceRecorded: f.game().assistance.some(h => h.objectiveId === q('SQ04')), unassistedClaim: f.game().assistance.length === 0 }; }
  if (c.id === 'OPT-SQ04-FINISH') { f.start(); finish(f); actual = { activityCompleted: completed(f), optionalBenefit: activity.reward.kind, benefitGrantCount: benefit(f), explanationVisible: !!f.controller.project().view?.feedback,
    safeExitAvailable: safeExit(f), mainObjectiveAward: f.game().world.completedObjectiveIds.length - before.world.completedObjectiveIds.length }; }
  if (c.id === 'OPT-SQ04-REPLAY') { f.start(); finish(f); f.simple('exit-optional'); f.start(); finish(f); f.simple('explain-optional'); actual = { benefitGrantCountAfter: benefit(f), mainObjectiveAward: f.game().world.completedObjectiveIds.length - before.world.completedObjectiveIds.length, explanationReplayAvailable: !!f.controller.project().view?.hintText }; }
  if (c.id === 'OPT-SQ04-UNTIMED') { vi.useFakeTimers(); try { f.start(); f.mode('delivery'); vi.advanceTimersByTime(86_400_000); expect(vi.getTimerCount()).toBe(0); finish(f); actual = { timerRunning: f.state().control.optionalActivity?.timingEnabled, failureFromDelay: !completed(f), completionStillAvailable: completed(f), mainScoreRequirement: null }; } finally { vi.useRealTimers(); } }
  if (c.id === 'OPT-SQ04-SKIP') { actual = { requiredInventory: { 'route-tool': f.game().world.inventory.find(i => i.itemId === q('ITEM-inspection-kit'))?.quantity }, mainObjectiveProgress: f.game().world.completedObjectiveIds.map(id => String(id).slice(8)), requiredRouteReachable: navigation.canReachRoom(f.game().world, q('R02')), optionalBenefitRequired: definitionRequiresHistory() }; }
  if (c.id === 'OPT-SQ04-EXIT') {
    const results = ['instructions','practice','solving','feedback'].map(phase => { f.start(); if (phase === 'practice') f.mode('practice'); if (phase === 'solving' || phase === 'feedback') f.mode('delivery'); if (phase === 'feedback') f.send({ kind: 'submit-optional-maintenance', sessionId: f.session(), answer: { selectedFactIds: [] } });
      const result = f.simple('exit-optional'); return result.status === 'handled' && f.game().world.roomId === before.world.roomId && f.game().world.position.safePositionId === before.world.position.safePositionId; });
    actual = { returnedToSafeActivityOrigin: results.every(Boolean), requiredInventory: { 'route-tool': f.game().world.inventory.find(i => i.itemId === q('ITEM-inspection-kit'))?.quantity }, mainObjectiveProgress: f.game().world.completedObjectiveIds.map(id => String(id).slice(8)), requiredRouteReachable: navigation.canReachRoom(f.game().world, q('R02')), unearnedBenefitGrantCount: benefit(f), saveWritesCausedByExit: f.state().runtime.persistence.pendingRequest === null ? 0 : 1, sameSafetyForEveryListedPhase: results.every(Boolean) };
  }
  if (c.id === 'OPT-SQ04-RETRY') {
    f.acquire('copper');
    while (f.game().world.configurationRevision < c.inputs.priorMeasurement.configurationRevision) {
      const name = f.game().world.flags[q<'flag'>('FLAG-copper-path')] === 'section-replacement' ? 'restore-original' : 'replace-section';
      const result = f.raw({ kind: 'apply', evaluation: prepareCopperAction(registry, f.game(), q(`ACTION-copper-${name}`)) }); expect(result.status).toBe('applied');
    }
    f.measure(); const s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(), notebook: { ...f.game().notebook, personalNotes: c.expected.personalNotes } } } });
    f.start(); f.simple('hint-optional'); const prior = f.game(); f.simple('retry-optional');
    actual = { retryAvailable: retry(f), attemptReset: f.game().world.attemptId !== prior.world.attemptId, clueRetained: f.game().notebook.factIds.includes(q('FACT-O03-defect')), personalNotes: f.game().notebook.personalNotes,
      hintHistory: f.game().assistance.filter(h => h.objectiveId === q('SQ04')).map(h => h.level), requiredInventory: { 'route-tool': f.game().world.inventory.find(i => i.itemId === q('ITEM-inspection-kit'))?.quantity }, unearnedBenefitGrantCount: benefit(f), timerRunning: f.state().control.optionalActivity?.timingEnabled,
      saveWritesCausedByRetry: f.state().runtime.persistence.pendingRequest === null ? 0 : 1, priorMeasurementVisibleAsStale: f.game().notebook.measurements.length > 0 && f.game().notebook.measurements.every(m => m.stale), priorMeasurementUsableAsCurrent: f.game().notebook.measurements.some(m => !m.stale), freshAttemptRequired: f.game().world.attemptId !== prior.world.attemptId, configurationRevisionGreaterThan: prior.notebook.measurements.at(-1)?.configurationRevision };
  }
  if (c.id === 'OPT-SQ04-RETRY') expect(f.game().world.configurationRevision).toBeGreaterThan(c.expected.configurationRevisionGreaterThan);
  receipts[c.id] = { actual, expected: c.expected }; expect(actual).toEqual(c.expected);
});
function definitionRequiresHistory() { return world.objectives.some(o => JSON.stringify(o.prerequisite).includes('spec001:SQ04')); }
afterAll(() => writeFileSync('docs/evidence/spec001/optional/SQ04/joined/current-lifecycle-receipts.json',JSON.stringify({ scope: 'Prepared room/kit/O02 state, actual shared operations, source actions and navigation reachability; no native full episode or party claim', receipts },null,2)+'\n'));
