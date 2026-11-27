// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Actual new pure module on the accepted 9a93bf7 registry. No staged validator.
import { afterAll, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { loadIntroductionContent } from '../../../../../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../../../../../src/app/adventure';
import type { ContentRegistry } from '../../../../../../src/content/registry';
import type * as S from '../../../../../../src/content/schema-types.generated';
import type { ActionId, ConfigurationRevision, DomainAction, FactId, QualifiedId } from '../../../../../../src/domain/types';
import { copperEffectBindings, prepareCopperAction } from '../../../../../../src/state/copper-scenario';
import { fiberEffectBindings, prepareFiberAction } from '../../../../../../src/state/fiber-scenario';
import { equipmentInteractionBindings } from '../../../../../../src/state/equipment-scenarios';
import { createReducer, createReducerState, type ReducerState } from '../../../../../../src/state/reducer';
import type { GameState } from '../../../../../../src/state/types';
import { evaluateMaintenanceAnswer, maintenanceActivityIssues, maintenanceCards, maintenanceClueIssues, maintenanceHistoryUnlocked } from '../../../../../../src/state/optional-maintenance';
import type { MaintenanceActivity, MaintenanceAnswer, MaintenanceMode } from '../../../../../../src/state/optional-maintenance';
import { createActionBus, contextFromRuntime } from '../../../../../../src/ui/action-bus';
import { createVerbController } from '../../../../../../src/ui/verbs';
import candidate from '../SQ04.candidate.json' with { type: 'json' };
import oracle from '../../../../../../tests/fixtures/optional-activities.json' with { type: 'json' };

const { registry } = loadIntroductionContent();
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const activity = candidate.optionalActivity as MaintenanceActivity;
const all = activity.delivery.factIds;
const receipts: Record<string, unknown> = {};
const captured = (game: GameState, input: unknown): DomainAction<unknown> => ({ actionId: 't099-pure-selection' as ActionId, expectedVersion: game.world, input });
const selection = (ids: MaintenanceAnswer['selectedFactIds'] = all): MaintenanceAnswer => ({ selectedFactIds: ids });
function game(facts: readonly string[] = []): GameState {
  const original = startIntroduction(createIntroductionRuntime(), registry).game!;
  return { ...original, world: { ...original.world, roomId: q('R03'), position: { safePositionId: q('R03.entry') },
    completedObjectiveIds: [q('O01'), q('O02')], inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] },
    notebook: { ...original.notebook, factIds: facts as readonly FactId[], personalNotes: 'I think the fiber was repaired' } };
}
function evaluate(state = game(all), answer: unknown = selection(), mode: MaintenanceMode = 'delivery') {
  return evaluateMaintenanceAnswer(activity, registry, mode, captured(state, answer), state);
}
function changedRecord(id: string, update: (record: S.authoredRecord) => void): ContentRegistry {
  const original = registry.record(id); if (!original) throw new Error(`Missing fixture record ${id}`);
  const copy = structuredClone(original); update(copy);
  return { ...registry, record: key => key === id ? copy : registry.record(key) };
}
const fixed = (id: string) => {
  const found = oracle.cases.find(test => test.id === id); if (!found) throw new Error(id); return found;
};
afterAll(() => writeFileSync(new URL('./module-receipts.json', import.meta.url), JSON.stringify({
  scope: 'Actual optional-maintenance module, existing source acquisition bindings and reducer on accepted 9a93bf7. Safe locations/facts are explicitly prepared where stated. No SQ04 common-controller or browser execution.', receipts,
}, null, 2) + '\n'));

describe('SQ04 single source table and real acquisition contracts', () => {
  it('accepts the reviewed candidate without modifying or registering it', () => {
    expect(maintenanceActivityIssues(activity, registry)).toEqual([]);
    expect(maintenanceClueIssues(activity.clues, registry)).toEqual([]);
    expect(registry.record(q('SQ04'))).toBeUndefined();
    expect(candidate.ruleIds).toEqual([]); expect(candidate.alternatives[0]!.ruleIds).toEqual([]);
    expect(candidate.sourceClaims.map(claim => claim.sourceId).sort()).toEqual([q('S04'), q('S10')]);
    expect(oracle.activities.find(entry => entry.activityId === q('SQ04'))?.ruleIds).toEqual([]);
  });
  it.each(['fact','room','kind','dialogue','action','missing','duplicate','sparse'])('rejects %s clue identity drift', corruption => {
    const changed = structuredClone(activity);
    const clues = changed.clues as unknown as Record<string, unknown>[];
    if (corruption === 'fact') clues[0]!['factId'] = all[1];
    if (corruption === 'room') clues[1]!['roomId'] = q('R03');
    if (corruption === 'kind') clues[2]!['evidenceKind'] = 'measurement';
    if (corruption === 'dialogue') clues[1]!['dialogueId'] = q('DIALOGUE-copper-bench');
    if (corruption === 'action') clues[1]!['sourceActionId'] = q('ACTION-fiber-clean');
    if (corruption === 'missing') clues.pop();
    if (corruption === 'duplicate') clues[1] = clues[0]!;
    if (corruption === 'sparse') delete clues[1];
    expect(maintenanceActivityIssues(changed, registry).length).toBeGreaterThan(0);
    const result = evaluateMaintenanceAnswer(changed, registry, 'delivery', captured(game(), null), game());
    expect(result.status).toBe('content-error'); expect(result.acceptedEffects).toEqual([]);
  });
  it.each(['subjects','room','freshness','kind','fact-removed'])('rejects %s drift in a registered source record', corruption => {
    const changed = changedRecord(q('R03'), record => {
      if (record.kind !== 'room') throw new Error('Expected room');
      const fact = record.evidence.find(entry => entry.id === all[0])!;
      if (corruption === 'subjects') fact.subjectIds = [q('PR045')];
      if (corruption === 'room') fact.roomId = q('R05');
      if (corruption === 'freshness') fact.requiresFreshMeasurement = true;
      if (corruption === 'kind') fact.kind = 'context';
      if (corruption === 'fact-removed') record.evidence = record.evidence.filter(entry => entry.id !== fact.id);
    });
    expect(maintenanceClueIssues(activity.clues, changed)).toContain('maintenance-authored-source');
  });
  it.each(['copper','fiber','equipment'])('delegates %s acquisition criteria to the existing module, rejecting changed action conditions', source => {
    const dialogueId = source === 'copper' ? 'DIALOGUE-copper-bench' : source === 'fiber' ? 'DIALOGUE-fiber-gardens' : 'DIALOGUE-market-equipment';
    const actionId = source === 'copper' ? all[0] : source === 'fiber' ? all[1] : all[2];
    const descriptor = activity.clues.find(clue => clue.factId === actionId)!;
    const changed = changedRecord(q(dialogueId), record => {
      if (record.kind !== 'dialogue') throw new Error('Expected dialogue');
      const choice = record.nodes.flatMap(node => node.choices).find(entry => entry.id === descriptor.sourceActionId)!;
      choice.condition = { kind: 'quest-complete', questId: q('SQ02') };
    });
    expect(maintenanceClueIssues(activity.clues, changed)).toContain('maintenance-authored-source');
  });
  it('rejects extra acquisition effects instead of treating any record-fact-looking action as valid', () => {
    const changed = changedRecord(q('DIALOGUE-fiber-gardens'), record => {
      if (record.kind !== 'dialogue') throw new Error('Expected dialogue');
      const choice = record.nodes.flatMap(node => node.choices).find(entry => entry.id === q('ACTION-fiber-inspect-before'))!;
      choice.effects.push({ kind: 'complete-objective', objectiveId: q('O05'), effectId: q('EFFECT-fake-inspection-success') });
    });
    expect(maintenanceClueIssues(activity.clues, changed)).toContain('maintenance-authored-source');
  });
  it('allows harmless source prose changes because identity criteria never parse the wording', () => {
    const changed = changedRecord(q('R03'), record => {
      if (record.kind !== 'room') throw new Error('Expected room'); record.evidence.find(entry => entry.id === all[0])!.text = 'Reviewed replacement wording, with the same fact identity and model.';
    });
    expect(maintenanceClueIssues(activity.clues, changed)).toEqual([]);
  });
  it.each(['practice-source','delivery-source','return-room','timer','speaker','effect','reward-fact','reward-room','missing-exit'])('rejects closed payload drift: %s', corruption => {
    const changed = structuredClone(activity) as unknown as Record<string, unknown>;
    if (corruption === 'practice-source') changed['practice'] = { ...activity.practice, factIds: [all[1]] };
    if (corruption === 'delivery-source') changed['delivery'] = { ...activity.delivery, factIds: [all[0],all[0],all[2]] };
    if (corruption === 'return-room') changed['entryContexts'] = [activity.entryContexts[0],activity.entryContexts[0],activity.entryContexts[2]];
    if (corruption === 'timer') changed['timingDefault'] = 'on';
    if (corruption === 'speaker') changed['speakerId'] = q('CH19');
    if (corruption === 'effect') changed['acceptedEffects'] = candidate.effects;
    if (corruption === 'reward-fact') changed['reward'] = { ...activity.reward, factId: all[0] };
    if (corruption === 'reward-room') changed['reward'] = { ...activity.reward, sourceRoomIds: ['spec001:R03','spec001:R03','spec001:R09'] };
    if (corruption === 'missing-exit') { const { exit: _exit, ...controls } = activity.controls; changed['controls'] = controls; }
    expect(maintenanceActivityIssues(changed, registry).length).toBeGreaterThan(0);
  });
});

describe('actual pure predicate against immutable SQ04 expectations', () => {
  it('executes OPT-SQ04-COMBINE and preserves the three source rooms with no effects', () => {
    const expected = fixed('OPT-SQ04-COMBINE');
    const result = evaluate(); receipts[expected.id] = result;
    expect(result.status).toBe('correct'); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ activityCompletionEligible: true, sourceRoomsPreserved: ['spec001:R03','spec001:R05','spec001:R09'],
      currentRepairProven: false, endToEndServiceProven: false, chronologyProven: false, requiredObjectiveAward: 0 });
  });
  it('executes OPT-SQ04-NOTE-NOT-CLUE and leaves the note and hypothesis untouched', () => {
    const expected = fixed('OPT-SQ04-NOTE-NOT-CLUE'), original = game([all[0]!,all[2]!]);
    const withHypothesis: GameState = { ...original, notebook: { ...original.notebook, hypotheses: [{ id: '00000000-0000-4000-8000-000000000112' as GameState['notebook']['hypotheses'][number]['id'],
      text: 'I think the fiber was repaired', subjectIds: [q('R05')], status: 'supported' }] } };
    const before = structuredClone(withHypothesis), result = evaluate(withHypothesis); receipts[expected.id] = result;
    expect(result.status).toBe('incorrect'); expect(result.observations[0]).toMatchObject({ missingSourceRooms: ['spec001:R05'], activityCompletionEligible: false });
    expect(withHypothesis).toEqual(before);
  });
  it('executes OPT-SQ04-DUPLICATE-ROOM with a repeated copper card', () => {
    const expected = fixed('OPT-SQ04-DUPLICATE-ROOM'), result = evaluate(game([all[0]!,all[2]!]),selection([all[0]!,all[0]!,all[2]!]));
    receipts[expected.id] = result; expect(result.status).toBe('incorrect'); expect(result.observations[0]).toMatchObject({ missingSourceRooms: ['spec001:R05'], activityCompletionEligible: false });
  });
  it.each([0,1,2])('cannot combine an unrecorded clue %i even if its ID was selected', index => {
    const result = evaluate(game(all.filter((_,i) => i !== index)));
    expect(result.status).toBe('incorrect'); expect(result.observations[0]).toMatchObject({ missingSourceRooms: [activity.clues[index]!.roomId] });
  });
  it('keeps selection order irrelevant without losing canonical source attribution', () => {
    const result = evaluate(game(all),selection([...all].reverse())); expect(result.status).toBe('correct');
    expect(result.observations[0]).toMatchObject({ sourceRoomsPreserved: ['spec001:R03','spec001:R05','spec001:R09'] });
  });
  it('retained history stays usable after room/configuration changes without claiming present repair', () => {
    const original = game(all), changed: GameState = { ...original, world: { ...original.world, roomId: q('R09'), position: { safePositionId: q('R09.entry') },
      inventory: [], completedObjectiveIds: [], flags: { [q<'flag'>('FLAG-fiber-connection')]: 'original', [q<'flag'>('FLAG-copper-path')]: 'original-broken' }, configurationRevision: 500 as ConfigurationRevision } };
    const before = structuredClone(changed), result = evaluate(changed); receipts['historical-learning'] = result;
    expect(result.status).toBe('correct'); expect(result.observations[0]).toMatchObject({ evidenceUse: 'historical-notebook-learning', currentRepairProven: false }); expect(changed).toEqual(before);
  });
  it('visits, supported hypotheses and current inspection flags do not manufacture notebook members', () => {
    const original = game(), changed: GameState = { ...original, world: { ...original.world, flags: { [q<'flag'>('FLAG-fiber-connection')]: 'inspected' } },
      notebook: { ...original.notebook, mapRoomIds: [q('R03'),q('R05'),q('R09')] } };
    expect(evaluate(changed).status).toBe('incorrect');
  });
  it('practice can use the provided copper card without granting an actual clue', () => {
    const original = game(), before = structuredClone(original), result = evaluate(original,selection([all[0]!]),'practice'); receipts['practice-provided-card'] = result;
    expect(result.status).toBe('correct'); expect(result.observations[0]).toMatchObject({ activityCompletionEligible: false, evidenceUse: 'supplied-practice-only' });
    expect(result.acceptedEffects).toEqual([]); expect(original).toEqual(before); expect(original.notebook.factIds).toEqual([]);
  });
  it.each([null,{},'',{ selectedFactIds: [] },{ selectedFactIds: ['I think the fiber was repaired'] }, { selectedFactIds: [null] },
    { selectedFactIds: ['spec001:FACT-SQ04-history'] }, { ...selection(), verdict: 'correct' }, { ...selection(), mode: 'delivery' },
    { ...selection(), acceptedEffects: candidate.effects }, { ...selection(), configurationRevision: 500 }])('rejects malformed or caller-authority input %j', answer => {
    const result = evaluate(game(all),answer); expect(result.status).toBe('invalid-input'); expect(result.acceptedEffects).toEqual([]);
  });
  it('rejects a sparse answer instead of treating the missing element as a clue', () => {
    const ids = [...all]; delete ids[1]; expect(evaluate(game(all),selection(ids)).status).toBe('invalid-input');
  });
  it('preserves the captured world version and rejects an old callback', () => {
    const original = game(all), action = captured(original,selection()), changed = { ...original, world: { ...original.world, configurationRevision: 1 as ConfigurationRevision } };
    const result = evaluateMaintenanceAnswer(activity,registry,'delivery',action,changed); receipts['stale-capture'] = result;
    expect(result.status).toBe('invalid-input'); expect(result.reasonCode).toBe('stale-action'); expect(result.acceptedEffects).toEqual([]);
  });
});

describe('projection and observed acquisition use the same identities', () => {
  it('practice card is supplied while delivery cards expose actual collected/missing membership', () => {
    const original = game([all[0]!,all[2]!]), before = structuredClone(original);
    const practice = maintenanceCards(activity,registry,game(),'practice')!;
    expect(practice).toHaveLength(1); expect(practice[0]).toMatchObject({ factId: all[0], recorded: false, use: 'supplied-practice-only' });
    const delivery = maintenanceCards(activity,registry,original,'delivery')!;
    expect(delivery.map(card => card.recorded)).toEqual([true,false,true]); expect(delivery.map(card => card.factId)).toEqual(all);
    expect(delivery[2]?.evidenceKind).toBe('context'); expect(delivery.every(card => card.use === 'historical-notebook-learning')).toBe(true); expect(original).toEqual(before);
  });
  it('rejects projection for malformed source content and copies display rows', () => {
    const changed = structuredClone(activity) as unknown as Record<string, unknown>; changed['kind'] = 'current-repair-proof';
    expect(maintenanceCards(changed as unknown as MaintenanceActivity,registry,game(),'delivery')).toBeNull();
    const cards = maintenanceCards(activity,registry,game(),'delivery')!;
    (cards[0] as { label: string }).label = 'Changed display only'; expect(activity.clues[0]!.label).not.toBe('Changed display only');
  });
  it('collects all three through real ordinary acquisition paths before evaluating the record', () => {
    const runtime = startIntroduction(createIntroductionRuntime(),registry);
    let state = createReducerState({ ...runtime, game: game() });
    const reduce = createReducer({ registry, bindings: [...copperEffectBindings(registry), ...fiberEffectBindings(registry), ...equipmentInteractionBindings(registry).effects] });
    const store = { getState: () => state, reduce, compareAndSet(before: ReducerState, next: ReducerState) { if (state !== before) return false; state = next; return true; } };
    for (const clue of activity.clues) {
      const original = state.runtime.game!;
      state = { ...state, runtime: { ...state.runtime, game: { ...original, world: { ...original.world, roomId: clue.roomId as GameState['world']['roomId'],
        position: { safePositionId: `${clue.roomId}.entry` as GameState['world']['position']['safePositionId'] } } } } };
      const current = state.runtime.game!;
      if (clue.roomId === 'spec001:R09') {
        const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) }), verbs = createVerbController({ registry, store, bus, bindings: equipmentInteractionBindings(registry).hotspots });
        try {
          const result = bus.dispatch(bus.capture({ kind: 'choose-hotspot-action', targetId: q('HOTSPOT-market-case'), choiceId: q('ACTION-market-read-power'), verb: 'use', itemId: null }));
          receipts[clue.sourceActionId] = result; expect(result.status).toBe('handled');
        } finally { verbs.dispose(); bus.dispose(); }
      } else {
        const result = clue.roomId === 'spec001:R03' ? prepareCopperAction(registry,current,clue.sourceActionId as QualifiedId) : prepareFiberAction(registry,current,clue.sourceActionId as QualifiedId);
        expect(result.status).toBe('correct'); const applied = reduce(state,{ actionId: clue.sourceActionId as ActionId, adventureId: current.adventureId, expectedVersion: current.world, input: { kind: 'apply', evaluation: result } });
        receipts[clue.sourceActionId] = result; expect(applied.status).toBe('applied'); state = applied.state;
      }
      expect(state.runtime.game!.notebook.factIds).toContain(clue.factId);
    }
    const collected = state.runtime.game!; expect(evaluate(collected).status).toBe('correct'); expect(collected.world.completedQuestIds).toEqual([]);
    expect(collected.world.completedObjectiveIds).toEqual([q('O01'),q('O02')]); expect(collected.notebook.measurements).toEqual([]); expect(maintenanceHistoryUnlocked(collected)).toBe(false);
  });
  it('real R05 acquisition still requires the recoverable kit and before-change state', () => {
    const original = game(), here: GameState = { ...original, world: { ...original.world, roomId: q('R05'), position: { safePositionId: q('R05.entry') } } };
    expect(prepareFiberAction(registry,{ ...here, world: { ...here.world, inventory: [] } },q('ACTION-fiber-inspect-before')).status).toBe('invalid-input');
    expect(prepareFiberAction(registry,{ ...here, world: { ...here.world, flags: { [q<'flag'>('FLAG-fiber-connection')]: 'cleaned' } } },q('ACTION-fiber-inspect-before')).status).toBe('invalid-input');
    expect(prepareFiberAction(registry,here,q('ACTION-fiber-inspect-before')).status).toBe('correct');
  });
  it.each([[false,false],[true,false],[false,true],[true,true]] as const)('history visibility requires quest=%s and fact=%s together', (quest,fact) => {
    const original = game(fact ? ['spec001:FACT-SQ04-history'] : []), changed = { ...original, world: { ...original.world, completedQuestIds: quest ? [q<'quest'>('SQ04')] : [] } };
    expect(maintenanceHistoryUnlocked(changed)).toBe(quest && fact);
  });
});
