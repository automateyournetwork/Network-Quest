// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateEndingsContent } from '../../src/content/endings';
import { projectAcceptedNarrative } from '../../src/ui/epilogue';
import type { ReducerState } from '../../src/state/reducer';
import type { OutcomeFeedback } from '../../src/state/outcomes';
import type { RiftHazardDescriptor } from '../../src/content/endings';
import { captureOutcomeContext, createOutcomeController } from '../../src/state/outcomes';
import { captureEncounterContext } from '../../src/state/encounter';
import { createRiftHazardController } from '../../src/state/rift-hazard';
import { fixture, registry, q, uuid } from '../state/outcome-fixture';
const raw = JSON.parse(readFileSync('content/spec001/endings.json', 'utf8'));
const checked = validateEndingsContent(raw); if (!checked.ok) throw Error(checked.issues.join());
const content = checked.value;
const state = (outcome = 'E01', kind = 'cutscene') => ({ runtime: { game: { contentVersion: '1.0.0',
  world: { route: 'copper', attemptId: 'attempt-1', completedObjectiveIds: ['spec001:O12'], completedQuestIds: [], recruits: [], activeAllyIds: [] },
  notebook: { factIds: [] }, outcomeHistory: [{ id: 'event-1', outcome, attemptId: 'attempt-1', route: 'copper', caveatIds: [] }] },
  activity: { kind } }, control: { pending: null } }) as unknown as ReducerState;
function sources(feedback: OutcomeFeedback | null = null, failure: RiftHazardDescriptor | null = null) {
  return { outcomes: { feedback: (_state: ReducerState) => feedback }, hazards: { failure: (_state: ReducerState) => failure } };
}
const accepted = (outcome: 'E01' | 'E02' | 'E03'): OutcomeFeedback => ({ status: 'correct', reasonCode: 'accepted', observations: [],
  outcome, restoredService: outcome !== 'E03', caveats: outcome === 'E01' ? [] : [{ id: 'spec001:FACT-reviewed' as never, text: 'Exact accepted caveat — unchanged.' }] });

describe('T087 receipt projection adapter (isolated ports; actual controller admission is T085/T086)', () => {
  it.each(['cutscene', 'shutdown', 'terminal-failure', 'safe-continue'])('never reconstructs an accepted receipt from %s and history alone', kind => {
    expect(projectAcceptedNarrative(content, state('E01', kind), sources())).toBeNull();
  });
  it.each(['E01', 'E02', 'E03'] as const)('projects %s only with its accepted same-event receipt and preserves caveat text', outcome => {
    const before = state(outcome, outcome === 'E03' ? 'shutdown' : 'cutscene'), snapshot = structuredClone(before);
    const result = projectAcceptedNarrative(content, before, sources(accepted(outcome)));
    expect(result?.view.kind).toBe('ending'); expect(result?.view.outcome).toBe(outcome);
    expect(result?.caveats).toEqual(outcome === 'E01' ? [] : ['Exact accepted caveat — unchanged.']);
    expect(before).toEqual(snapshot);
  });
  it('refuses mismatched outcome, incorrect feedback, wrong phase and missing game', () => {
    expect(projectAcceptedNarrative(content, state(), sources(accepted('E02')))).toBeNull();
    expect(projectAcceptedNarrative(content, state(), sources({ ...accepted('E01'), status: 'incorrect' }))).toBeNull();
    expect(projectAcceptedNarrative(content, state('E01', 'safe-continue'), sources(accepted('E01')))).toBeNull();
    const before = state(); expect(projectAcceptedNarrative(content, { ...before, runtime: { ...before.runtime, game: null } }, sources(accepted('E01')))).toBeNull();
  });
  it('keeps E03 distinct from a dramatic failure receipt', () => {
    expect(projectAcceptedNarrative(content, state('E03', 'shutdown'), sources(null, content.hazard))).toBeNull();
    const failure = projectAcceptedNarrative(content, state('E01', 'terminal-failure'), sources(null, content.hazard));
    expect(failure?.view.kind).toBe('failure'); expect(failure?.view.outcome).toBeNull();
    expect(failure?.caveats).toEqual([]);
  });
  it('refuses a wrong hazard id and an outcome receipt in terminal-failure', () => {
    const terminal = state('E01', 'terminal-failure');
    expect(projectAcceptedNarrative(content, terminal, sources(accepted('E01')))).toBeNull();
    expect(projectAcceptedNarrative(content, terminal, sources(null, { ...content.hazard, id: 'unknown-hazard' } as unknown as RiftHazardDescriptor))).toBeNull();
  });
});

describe('T087 composed actual outcome/hazard receipts (application mount is separate)', () => {
  const prepare = (f: ReturnType<typeof fixture>) => {
    expect(f.send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'enter-authored-preparation', observations: [], acceptedEffects: [] },
      destination: { roomId: q<'room'>('R11'), safePositionId: q<'safe-position'>('R11.preparation'), activity: 'safe-preparation' } }).status).not.toBe('rejected');
  };
  const store = (f: ReturnType<typeof fixture>) => ({ getState: f.state, compareAndSet(before: ReducerState, next: ReducerState) {
    if (f.state() !== before) return false; f.replace(next); return true;
  } });
  it.each(['copper', 'fiber', 'radio'] as const)('formats real %s E01/E02/E03 receipts without adding progress', route => {
    for (const [selection, outcome] of [['permanent', 'E01'], ['temporary', 'E02'], ['shutdown', 'E03']] as const) {
      const f = fixture(route);
      f.prepare(selection === 'shutdown' ? 'shutdown' : `${route}-${route === 'copper' ? 'section' : 'A'}`, selection === 'temporary' ? 'temporary' : 'permanent');
      if (selection === 'temporary') f.choose('record-maintenance');
      if (selection === 'shutdown') f.choose('record-isolation');
      prepare(f); expect(f.execute().evaluation?.status).toBe('correct');
      if (selection === 'shutdown') { f.move('R12'); f.choose('read-classification'); } else f.prove();
      const outcomes = createOutcomeController({ registry, repairScenario: f.resolver }), hazards = createRiftHazardController({ registry, content });
      const p = outcomes.prepareClassification(f.state(), captureOutcomeContext(f.state())!, { actionId: 'epilogue-classify' as never, eventId: uuid(90) as never,
        operation: { kind: 'classify', selection, linkId: selection === 'shutdown' ? null : uuid(2), endpointId: selection === 'shutdown' ? null : uuid(3) } });
      expect(p.ok, JSON.stringify(p)).toBe(true); if (!p.ok) throw Error(p.reason);
      expect(outcomes.commit(store(f), p.change).ok).toBe(true);
      const before = f.state(), narrative = projectAcceptedNarrative(content, before, { outcomes, hazards });
      expect(narrative?.view.outcome).toBe(outcome); expect(narrative?.view.kind).toBe('ending');
      expect(narrative?.caveats).toEqual(outcomes.feedback(before)!.caveats.map(c => c.text)); expect(f.state()).toBe(before);
      expect(projectAcceptedNarrative(content, structuredClone(before), { outcomes, hazards })).toBeNull();
      const oldContext = captureOutcomeContext(before)!;
      f.replace({ ...before, runtime: { ...before.runtime, ui: { ...before.runtime.ui!, feedback: 'Harmless current UI refresh' } } });
      expect(projectAcceptedNarrative(content, f.state(), { outcomes, hazards })).toEqual(narrative);
      expect(outcomes.prepareDismissal(f.state(), oldContext)).toMatchObject({ ok: false, reason: 'stale-context' });
      const dismissal = outcomes.prepareDismissal(f.state(), captureOutcomeContext(f.state())!);
      if (outcome === 'E03') expect(dismissal.ok).toBe(false);
      else {
        expect(dismissal.ok).toBe(true); if (!dismissal.ok) throw Error(dismissal.reason);
        expect(outcomes.commit(store(f), dismissal.change).ok).toBe(true);
        expect(f.state().runtime.activity?.kind).toBe('safe-continue');
        expect(projectAcceptedNarrative(content, f.state(), { outcomes, hazards })).toBeNull();
      }
    }
  });
  it('formats only the real explicitly warned hazard receipt, never terminal phase alone', () => {
    const f = fixture(); prepare(f);
    const outcomes = createOutcomeController({ registry, repairScenario: f.resolver }), hazards = createRiftHazardController({ registry, content });
    const before = f.state();
    expect(projectAcceptedNarrative(content, { ...before, runtime: { ...before.runtime, activity: { kind: 'terminal-failure' } } }, { outcomes, hazards })).toBeNull();
    expect(hazards.prepare(before, captureEncounterContext(before)!, { hazardId: content.hazard.id, warningAcknowledged: false }).ok).toBe(false);
    const p = hazards.prepare(before, captureEncounterContext(before)!, { hazardId: content.hazard.id, warningAcknowledged: true });
    expect(p.ok).toBe(true); if (!p.ok) throw Error(p.reason);
    expect(hazards.commit(store(f), p.change).ok).toBe(true);
    const terminal = f.state(), view = projectAcceptedNarrative(content, terminal, { outcomes, hazards });
    expect(view?.view.kind).toBe('failure'); expect(view?.view.outcome).toBeNull();
    expect(terminal.runtime.game?.outcomeHistory).toEqual(before.runtime.game?.outcomeHistory);
    expect(terminal.runtime.persistence).toBe(before.runtime.persistence);
    expect(projectAcceptedNarrative(content, structuredClone(terminal), { outcomes, hazards })).toBeNull();
  });
});
