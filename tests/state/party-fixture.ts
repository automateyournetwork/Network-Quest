// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Supplied unrelated prerequisite completion, knowledge and a real held kit are
// explicit test setup. Encounters, actions, measurements, walks and party changes
// below use the production reducers/controllers; none synthesize a verdict.
import { expect } from 'vitest';
import { loadIntroductionContent, episodeNavigationEntries } from '../../src/app/content';
import { createIntroductionRuntime, startIntroduction, restoreIntroduction } from '../../src/app/adventure';
import { introductionBindings } from '../../src/app/introduction';
import { introductionSavePolicy } from '../../src/app/save-policy';
import type { ActionId, FactId, MeasurementId, QualifiedId } from '../../src/domain/types';
import { createCopperScenarioResolver, copperEffectBindings } from '../../src/state/copper-scenario';
import { createFiberScenarioResolver, fiberEffectBindings } from '../../src/state/fiber-scenario';
import { createRadioScenarioResolver, radioEffectBindings } from '../../src/state/radio-scenario';
import { createEquipmentScenarioResolver, equipmentInteractionBindings } from '../../src/state/equipment-scenarios';
import { objectiveEffectBindings } from '../../src/state/objectives';
import type { ObjectiveScenarioResolver } from '../../src/state/objectives';
import { createNavigation } from '../../src/state/navigation';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ReducerInput, ReducerState } from '../../src/state/reducer';
import type { ActivityState } from '../../src/state/types';
import { conventionalAbilityOperation, partyObjective } from '../../src/state/party';
import { captureSafeSnapshot } from '../../src/state/snapshot';
import { SaveValidator } from '../../src/services/save-validator';
import { createActionBus, contextFromRuntime } from '../../src/ui/action-bus';
import type { SemanticAction } from '../../src/ui/action-bus';
import { createPartyController } from '../../src/ui/party';

export const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
export const { registry, world } = loadIntroductionContent();
export const navigation = createNavigation({ registry, world, entries: episodeNavigationEntries(registry, world) });
const resolvers = [createCopperScenarioResolver(registry), createFiberScenarioResolver(registry), createRadioScenarioResolver(registry), createEquipmentScenarioResolver(registry)];
export const scenario: ObjectiveScenarioResolver = (game, id) => resolvers.map(resolve => resolve(game, id)).find(Boolean) ?? null;
export const bindings = [...introductionBindings(registry).effects, ...objectiveEffectBindings(registry), ...copperEffectBindings(registry), ...fiberEffectBindings(registry), ...radioEffectBindings(registry), ...equipmentInteractionBindings(registry).effects];
export const validator = new SaveValidator([introductionSavePolicy(registry, world)]);
const factIds = [...new Set(world.documents.flatMap(reference => { const record = registry.record(reference.id); return record && 'evidence' in record ? record.evidence.map(e => e.id as FactId) : []; }))];
export type Recruit = 'CH03' | 'CH04' | 'CH05' | 'CH06' | 'CH07' | 'CH16' | 'CH19' | 'CH20' | 'CH22';
const homes: Record<Recruit, string> = { CH03: 'R05', CH04: 'R03', CH05: 'R05', CH06: 'R05', CH07: 'R07', CH16: 'R06', CH19: 'R09', CH20: 'R04', CH22: 'R10' };
const benches: Record<string, string> = { O03: 'R03', O04: 'R04', O05: 'R05', O06: 'R06', O08: 'R08', O09: 'R09' };
export function partyFixture() {
  const initial = startIntroduction(createIntroductionRuntime(), registry), original = initial.game!;
  let state = createReducerState({ ...initial, game: { ...original, world: { ...original.world,
    completedObjectiveIds: Array.from({ length: 10 }, (_, i) => q<'objective'>(`O${String(i + 1).padStart(2, '0')}`)),
    inventory: [{ itemId: q<'item'>('ITEM-inspection-kit'), quantity: 1 }] }, notebook: { ...original.notebook, factIds } } });
  const reduce = createReducer({ registry, bindings, objectiveScenario: scenario, canReachRoom: navigation.canReachRoom });
  let commits = 0;
  const store = { getState: () => state, reduce, compareAndSet(before: ReducerState, next: ReducerState) { if (state !== before) return false; state = next; commits++; return true; } };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  const controller = createPartyController({ registry, world, store, bus, resolveScenario: scenario });
  const send = (input: ReducerInput) => { const out = reduce(state, { actionId: crypto.randomUUID() as ActionId, adventureId: state.runtime.game!.adventureId, expectedVersion: state.runtime.game!.world, input });
    expect(out.status, `reducer ${JSON.stringify(input)}: ${out.reason}`).not.toBe('rejected'); state = out.state; return out; };
  const dispatch = (input: SemanticAction) => { try { return bus.dispatch(bus.capture(input)); } catch { return { status: 'rejected' as const, reason: 'shape' }; } };
  const walk = (roomId: string) => {
    const target = q<'room'>(roomId); if (state.runtime.game!.world.roomId === target) return;
    const game = state.runtime.game!, queue = [{ world: game.world, path: [] as string[] }], visited = new Set<string>([game.world.roomId]); let path: string[] | null = null;
    for (let i = 0; i < queue.length && !path; i++) { const entry = queue[i]!, room = registry.record(entry.world.roomId); if (room?.kind !== 'room') continue;
      for (const exit of room.exits) { if (visited.has(exit.toRoomId)) continue; const out = navigation.resolve(entry.world, exit.toRoomId as QualifiedId<'room'>, 'stable-exploration'); if (!out.ok || out.kind !== 'arrival') continue;
        const steps = [...entry.path, exit.toRoomId]; if (exit.toRoomId === target) { path = steps; break; }
        visited.add(exit.toRoomId); queue.push({ world: { ...entry.world, roomId: out.destination.roomId, position: { safePositionId: out.destination.safePositionId } }, path: steps }); }
    }
    expect(path, `walk from ${game.world.roomId} to ${target}`).not.toBeNull();
    for (const step of path!) { const out = navigation.resolve(state.runtime.game!.world, step as QualifiedId<'room'>, state.runtime.activity!.kind as 'stable-exploration'); expect(out.ok).toBe(true); if (!out.ok) throw new Error(out.reason);
      send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'actual-navigation', observations: [], acceptedEffects: [] }, destination: out.destination }); }
  };
  const action = (id: string) => { const input = conventionalAbilityOperation(registry, scenario, state.runtime.game!, q(id), crypto.randomUUID() as MeasurementId);
    expect(input, `conventional action ${id} in ${state.runtime.game!.world.roomId}`).not.toBeNull(); send(input!); };
  const measure = (short: string) => { walk(benches[short]!); const objectiveId = q<'objective'>(short), selected = scenario(state.runtime.game!, objectiveId); expect(selected).not.toBeNull();
    const id = crypto.randomUUID() as MeasurementId; send({ kind: 'objective', operation: { kind: 'measure', objectiveId, alternativeId: selected!.alternativeId, id } });
    return state.runtime.game!.notebook.measurements.find(m => m.id === id)!; };
  const fiber = (profile = 'matched') => { walk('R05'); for (const id of ['restore-original', `profile-${profile}`, 'inspect-before', 'clean', 'reinspect-clean']) action(`ACTION-fiber-${id}`); };
  const demonstrateRecruitment = (character: Recruit) => {
    const objective = partyObjective(q(character))!.slice(8);
    if (objective === 'O04') { walk('R03'); action('ACTION-copper-restore-original'); measure('O03'); action('ACTION-copper-replace-section'); walk('R04'); action('ACTION-copper-repeater-requires-continuity'); }
    if (objective === 'O05' || objective === 'O06') { fiber(); if (objective === 'O06') { walk('R06'); action('ACTION-fiber-path-A'); } }
    if (objective === 'O08') { walk('R07'); action('ACTION-radio-align-existing'); action('ACTION-radio-match-settings'); walk('R08'); action('ACTION-radio-channel-A'); action('ACTION-radio-mitigate-emitter'); }
    if (objective === 'O09') { walk('R09'); action('ACTION-market-compatible-kit-A'); action('ACTION-equipment-mode-100-full'); }
    expect(measure(objective).conclusionCode).toMatch(/:correct$/);
  };
  const demonstrateProgression = (character: Recruit) => {
    const objective = partyObjective(q(character))!.slice(8);
    switch (character) {
      case 'CH03': case 'CH16': fiber('wrong-wavelength'); measure(objective); fiber(); break;
      case 'CH04': walk('R03'); action('ACTION-copper-restore-original'); measure('O03'); measure('O04'); walk('R03'); action('ACTION-copper-replace-section'); break;
      case 'CH20': walk('R04'); action('ACTION-copper-repeater-bridges-open'); measure(objective); action('ACTION-copper-repeater-requires-continuity'); break;
      case 'CH05': walk('R06'); action('ACTION-fiber-path-high-loss'); measure(objective); action('ACTION-fiber-path-A'); break;
      case 'CH06': walk('R06'); action('ACTION-fiber-path-A'); break;
      case 'CH07': walk('R08'); action('ACTION-radio-raise-noise'); measure(objective); action('ACTION-radio-mitigate-emitter'); break;
      case 'CH19': walk('R09'); action('ACTION-market-original-over-budget'); measure(objective); action('ACTION-market-compatible-kit-A'); break;
      case 'CH22': walk('R09'); action('ACTION-equipment-mode-1000-full'); measure(objective); action('ACTION-equipment-mode-100-full'); break;
    }
    expect(measure(objective).conclusionCode).toMatch(/:correct$/);
  };
  const encounter = (character: Recruit) => { walk(homes[character]); const room = registry.record(state.runtime.game!.world.roomId); if (room?.kind !== 'room') throw new Error('Room missing');
    const hotspot = room.hotspots.find(h => h.subjectId === q(character)); expect(hotspot).toBeDefined(); const out = send({ kind: 'party', operation: { kind: 'encounter', hotspotId: hotspot!.id as QualifiedId, verb: 'look' } });
    return { status: out.status === 'rejected' ? 'rejected' as const : 'handled' as const }; };
  return { state: () => state.runtime, reducerState: () => state, store, bus, controller, send, dispatch, walk, action, measure, fiber, encounter, demonstrateRecruitment, demonstrateProgression,
    replace(next: ReducerState) { state = next; }, commits: () => commits,
    returnHome(character: Recruit) { walk(homes[character]); },
    invite(character: Recruit) { return dispatch({ kind: 'invite-ally', characterId: q(character) }); },
    beginPractice(character: Recruit) { return dispatch({ kind: 'begin-ally-practice', characterId: q(character) }); },
    advance(character: Recruit) { return dispatch({ kind: 'review-ally-practice', characterId: q(character) }); },
    setActive(characters: readonly Recruit[]) { return dispatch({ kind: 'set-active-allies', characterIds: characters.map(c => q<'character'>(c)) }); },
    captureSetActive(characters: readonly Recruit[]) { const captured = bus.capture({ kind: 'set-active-allies', characterIds: characters.map(c => q<'character'>(c)) }); return () => bus.dispatch(captured); },
    supplyActivity(kind: 'active-encounter' | 'terminal-failure' | 'shutdown' | 'pending-effect') { state = { ...state, runtime: { ...state.runtime, activity: { kind } as ActivityState } }; },
    returnToPreparation() { walk('R11'); },
    saveAndRestore() { const out = captureSafeSnapshot(state, validator); expect(out.ok, JSON.stringify(out)).toBe(true); if (!out.ok) throw new Error(out.code);
      state = createReducerState(restoreIntroduction(state.runtime, out.capture.snapshot)); controller.invalidate(); bus.invalidate(); },
    saveWrites: () => 0, // No save service is composed: these actions have no write port.
    dispose() { controller.dispose(); bus.dispose(); },
  };
}
export function recruit(f: ReturnType<typeof partyFixture>, character: Recruit) { f.encounter(character); f.demonstrateRecruitment(character); f.returnHome(character); expect(f.invite(character).status).toBe('handled'); }
