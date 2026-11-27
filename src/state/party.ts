// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import type { AbilityId, AdventureId, AttemptId, CharacterId, CompendiumId, MeasurementId, ObjectiveId, QualifiedId } from '../domain/types';
import { conditionSatisfied } from './conditions';
import { prepareCopperAction } from './copper-scenario';
import { prepareFiberAction } from './fiber-scenario';
import { prepareRadioAction } from './radio-scenario';
import { equipmentInteractionBindings } from './equipment-scenarios';
import type { ObjectiveScenarioResolver, ObjectiveOperation } from './objectives';
import { isHistoricalObjectiveMeasurement } from './objective-history';
import type { ReducerInput, StateEffect } from './reducer';
import type { ActiveAllies, GameState, Measurement } from './types';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
export const recruitIds = ['CH03', 'CH04', 'CH05', 'CH06', 'CH07', 'CH16', 'CH19', 'CH20', 'CH22'].map(id => q<'character'>(id));
const objectiveFor: Readonly<Record<string, string>> = { CH03: 'O05', CH04: 'O04', CH05: 'O06', CH06: 'O06', CH07: 'O08', CH16: 'O05', CH19: 'O09', CH20: 'O04', CH22: 'O09' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && new Set(a).size === a.length && a.every(id => b.includes(id));
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Runtime only. No practice token, baseline or extra receipt is saved. */
export interface PartyPractice {
  readonly characterId: CharacterId;
  readonly adventureId: AdventureId;
  readonly attemptId: AttemptId;
  readonly startRevision: number;
  readonly startingLevel: number;
  readonly baselineMeasurementIds: readonly MeasurementId[];
  readonly observations: readonly {
    readonly measurementId: MeasurementId;
    readonly failedCompatibilityFields: readonly string[] | null;
    readonly inspectionAndCleaningComplete: boolean;
    readonly repeaterClaim: 'requires-continuity' | 'bridges-open' | null;
  }[];
}
export type PartyOperation =
  | { readonly kind: 'encounter'; readonly hotspotId: QualifiedId; readonly verb: 'look' | 'talk' }
  | { readonly kind: 'invite'; readonly characterId: CharacterId }
  | { readonly kind: 'begin-practice'; readonly characterId: CharacterId }
  | { readonly kind: 'advance'; readonly characterId: CharacterId }
  | { readonly kind: 'set-active'; readonly characterIds: readonly CharacterId[] }
  | { readonly kind: 'ability'; readonly characterId: CharacterId; readonly abilityId: AbilityId; readonly actionId: QualifiedId; readonly measurementId: MeasurementId };
export type PartyPreparation =
  | { readonly ok: false; readonly reason: 'invalid-input' | 'content-error' | 'precondition' }
  | { readonly ok: true; readonly game: GameState; readonly practice: PartyPractice | null; readonly configurationChanged: boolean }
  | { readonly ok: true; readonly delegate: Extract<ReducerInput, { kind: 'apply' | 'objective' }> };

export function partyCharacter(registry: ContentRegistry, characterId: string): Readonly<S.character> | null {
  const record = registry.record(characterId);
  return record?.kind === 'character' ? record : null;
}
export function partyObjective(characterId: string): ObjectiveId | null {
  const id = objectiveFor[characterId.slice(8)]; return id ? q<'objective'>(id) : null;
}

/** Explicit playable-start encounter, never a room-entry character sweep. */
export function apprenticeDiscovery(registry: ContentRegistry, room: Readonly<S.room>): readonly CompendiumId[] {
  const character = partyCharacter(registry, q('CH01'));
  if (!character) return []; // Historical introduction-only test registries have no authored characters.
  if (room.id !== q('R01') || !room.characterIds.includes(character.id) || character.recruitable
    || !character.compendium.discovery?.roomIds.includes(room.id) || !registry.has('compendium', character.compendium.id)) throw new Error('The playable start encounter has no canonical Apprentice record.');
  return [character.compendium.id as CompendiumId];
}

/** Look/Talk must identify an actual current-room actor, not a label or room visit. */
export function encounterCharacter(registry: ContentRegistry, game: GameState, hotspotId: string, verb: string): Readonly<S.character> | null {
  const room = registry.record(game.world.roomId), hotspot = room?.kind === 'room' ? room.hotspots.find(h => h.id === hotspotId) : undefined;
  if (!hotspot || !['look', 'talk'].includes(verb) || !hotspot.verbs.includes(verb as 'look' | 'talk')) return null;
  const character = partyCharacter(registry, hotspot.subjectId);
  return character && room?.kind === 'room' && room.characterIds.includes(character.id)
    && character.compendium.discovery?.roomIds.includes(room.id) && registry.has('compendium', character.compendium.id) ? character : null;
}

const read = (measurement: Measurement, name: string) => measurement.readings.find(r => r.name === name)?.value;
/** Reuse the reviewed objective readout validation; stale history teaches only. */
export const historicalPartyMeasurement = isHistoricalObjectiveMeasurement;

/** Called only by the reducer after a new canonical objective measurement. */
export function capturePartyPractice(scenario: ObjectiveScenarioResolver | undefined, before: GameState, after: GameState,
  operation: ObjectiveOperation, practice: PartyPractice | null | undefined): PartyPractice | null {
  if (!practice || operation.kind !== 'measure' || partyObjective(practice.characterId) !== operation.objectiveId
    || practice.adventureId !== before.adventureId || practice.attemptId !== before.world.attemptId
    || before.world.recruits.find(r => r.characterId === practice.characterId)?.level !== practice.startingLevel
    || before.notebook.measurements.some(m => m.id === operation.id)) return practice ?? null;
  const measurement = after.notebook.measurements.find(m => m.id === operation.id);
  if (!measurement || measurement.attemptId !== practice.attemptId || measurement.configurationRevision < practice.startRevision) return practice;
  const resolved = scenario?.(before, operation.objectiveId);
  if (!resolved || resolved.alternativeId !== operation.alternativeId) return practice;
  const fiber = resolved.kind === 'fiber-preparation' ? resolved.preparation : null;
  return { ...practice, observations: [...practice.observations, {
    measurementId: measurement.id,
    failedCompatibilityFields: fiber ? Object.entries(fiber.checks).filter(([, passed]) => passed === false).map(([field]) => field) : null,
    inspectionAndCleaningComplete: !!fiber?.inspectedBeforeChange && fiber.connectionDefectRemoved,
    repeaterClaim: resolved.kind === 'copper-proof' ? resolved.repeaterClaim : null,
  }].slice(-512) };
}

export function recruitmentEvidence(registry: ContentRegistry, game: GameState, characterId: CharacterId): Measurement | null {
  const character = partyCharacter(registry, characterId), objectiveId = partyObjective(characterId);
  if (!character?.recruitable || !objectiveId || !character.recruitment?.demonstration?.objectiveIds.includes(objectiveId)) return null;
  return [...game.notebook.measurements].reverse().find(m => historicalPartyMeasurement(registry, game, objectiveId, m)) ?? null;
}

export function progressionReady(registry: ContentRegistry, game: GameState, practice: PartyPractice | null | undefined, characterId: CharacterId): boolean {
  const recruit = game.world.recruits.find(r => r.characterId === characterId), objectiveId = partyObjective(characterId);
  if (!practice || practice.characterId !== characterId || practice.adventureId !== game.adventureId || practice.attemptId !== game.world.attemptId
    || !recruit || recruit.level !== practice.startingLevel || recruit.level !== 1 || !objectiveId) return false;
  const added = game.notebook.measurements.filter(m => !practice.baselineMeasurementIds.includes(m.id) && m.attemptId === practice.attemptId && m.configurationRevision >= practice.startRevision);
  const correct = added.filter(m => historicalPartyMeasurement(registry, game, objectiveId, m));
  const incorrect = added.filter(m => historicalPartyMeasurement(registry, game, objectiveId, m, 'incorrect'));
  if (!correct.length) return false;
  switch (characterId.slice(8)) {
    case 'CH03': case 'CH16': return incorrect.some(m => {
      const detail = practice.observations.find(o => o.measurementId === m.id);
      return detail?.inspectionAndCleaningComplete && !!detail.failedCompatibilityFields?.length && correct.some(c => {
        const final = practice.observations.find(o => o.measurementId === c.id);
        return added.indexOf(c) > added.indexOf(m) && final?.inspectionAndCleaningComplete && final.failedCompatibilityFields?.length === 0;
      });
    });
    case 'CH04': return incorrect.some(m => (read(m, 'Open required conductors') ?? 0) > 0 && correct.some(c => added.indexOf(c) > added.indexOf(m)));
    case 'CH20': return incorrect.some(m => read(m, 'Repeater role distinguished') === 0
      && practice.observations.some(o => o.measurementId === m.id && o.repeaterClaim === 'bridges-open')
      && correct.some(c => added.indexOf(c) > added.indexOf(m) && read(c, 'Repeater role distinguished') === 1
        && practice.observations.some(o => o.measurementId === c.id && o.repeaterClaim === 'requires-continuity')));
    case 'CH05': return [...correct, ...incorrect].some(m => read(m, 'Total passive loss') !== read(correct[0]!, 'Total passive loss'));
    case 'CH06': return true; // Explicit sourced modes review alongside a new actual optical result.
    case 'CH07': return [...correct, ...incorrect].some(m => read(m, 'Received noise') !== read(correct[0]!, 'Received noise'));
    case 'CH19': return incorrect.some(m => (read(m, 'Delivered excess') ?? 0) > 0 && correct.some(c => added.indexOf(c) > added.indexOf(m)));
    case 'CH22': return incorrect.some(m => read(m, 'Common mode supported') === 0 && correct.some(c => added.indexOf(c) > added.indexOf(m)));
    default: return false;
  }
}

/** Closed conventional operation selection. Abilities never supply a verdict. */
export function conventionalAbilityOperation(registry: ContentRegistry, scenario: ObjectiveScenarioResolver | undefined, game: GameState,
  actionId: QualifiedId, measurementId: MeasurementId): Extract<ReducerInput, { kind: 'apply' | 'objective' }> | null {
  for (const short of ['O03', 'O04', 'O05', 'O06', 'O07', 'O08', 'O09', 'O10']) {
    const objective = registry.record(q(short));
    if (objective?.kind === 'objective' && objective.alternatives.some(a => a.id === actionId)) {
      if (scenario?.(game, q<'objective'>(short))?.alternativeId !== actionId || objective.evidence[0]?.roomId !== game.world.roomId) return null;
      return { kind: 'objective', operation: { kind: 'measure', objectiveId: q<'objective'>(short), alternativeId: actionId, id: measurementId } };
    }
  }
  // Authored optical profile reading is context only: the same empty effect
  // list, at its actual measurement bench, never a repair or learning award.
  if (actionId === q('ACTION-read-PROFILE-OPTICAL') && game.world.roomId === q('R06')) {
    const profile = registry.record(q('PROFILE-OPTICAL'));
    const alternative = profile?.kind === 'profile' ? profile.alternatives.find(a => a.id === actionId) : undefined;
    if (!alternative || alternative.effects.length || !conditionSatisfied(alternative.condition, game.world)) return null;
    return { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'authored-profile-context', observations: [], acceptedEffects: [] } };
  }
  const prepare = actionId.startsWith('spec001:ACTION-copper-') ? prepareCopperAction
    : actionId.startsWith('spec001:ACTION-fiber-') ? prepareFiberAction : actionId.startsWith('spec001:ACTION-radio-') ? prepareRadioAction : null;
  if (prepare) { const evaluation = prepare(registry, game, actionId); return evaluation.status === 'correct' ? { kind: 'apply', evaluation } : null; }
  const binding = equipmentInteractionBindings(registry).hotspots.find(b => b.actionId === actionId && b.roomId === game.world.roomId && b.itemId === null);
  const source = binding && registry.record(binding.sourceId), node = source?.kind === 'dialogue' ? source.nodes.find(n => n.id === source.entryNodeId) : null;
  const choice = node?.choices.find(c => c.id === actionId);
  return node && choice && conditionSatisfied(node.condition, game.world) && conditionSatisfied(choice.condition, game.world)
    ? { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'authored-equipment-action', observations: [], acceptedEffects: choice.effects as StateEffect[] } } : null;
}

export function preparePartyChange(registry: ContentRegistry, scenario: ObjectiveScenarioResolver | undefined, game: GameState,
  operation: PartyOperation, practice: PartyPractice | null | undefined): PartyPreparation {
  const fail = (reason: 'invalid-input' | 'content-error' | 'precondition'): PartyPreparation => ({ ok: false, reason });
  if (!object(operation)) return fail('invalid-input');
  const keys: Record<PartyOperation['kind'], readonly string[]> = { encounter: ['kind', 'hotspotId', 'verb'], invite: ['kind', 'characterId'],
    'begin-practice': ['kind', 'characterId'], advance: ['kind', 'characterId'], 'set-active': ['kind', 'characterIds'], ability: ['kind', 'characterId', 'abilityId', 'actionId', 'measurementId'] };
  if (!Object.hasOwn(keys, operation.kind) || !sameSet(Object.keys(operation), keys[operation.kind])) return fail('invalid-input');
  if (('characterId' in operation && typeof operation.characterId !== 'string')
    || (operation.kind === 'ability' && (typeof operation.abilityId !== 'string' || typeof operation.actionId !== 'string' || typeof operation.measurementId !== 'string'))) return fail('invalid-input');
  const success = (next = game, nextPractice = practice ?? null, configurationChanged = false): PartyPreparation => ({ ok: true, game: next, practice: nextPractice, configurationChanged });
  if (operation.kind === 'encounter') {
    const character = encounterCharacter(registry, game, operation.hotspotId, operation.verb);
    if (!character) return fail('precondition');
    const id = character.compendium.id as CompendiumId;
    return success(game.world.compendiumIds.includes(id) ? game : { ...game, world: { ...game.world, compendiumIds: [...game.world.compendiumIds, id] } });
  }
  if (operation.kind === 'set-active') {
    const ids = operation.characterIds;
    if (!Array.isArray(ids) || ids.length > 2 || new Set(ids).size !== ids.length || ids.some(id => !recruitIds.includes(id) || !game.world.recruits.some(r => r.characterId === id))) return fail('precondition');
    if (ids.length === game.world.activeAllyIds.length && ids.every((id, i) => id === game.world.activeAllyIds[i])) return success();
    const active: ActiveAllies = ids.length === 0 ? [] : ids.length === 1 ? [ids[0]!] : [ids[0]!, ids[1]!];
    return success({ ...game, world: { ...game.world, activeAllyIds: active } }, practice ?? null, true);
  }
  const character = partyCharacter(registry, operation.characterId);
  if (!character?.recruitable || !recruitIds.includes(operation.characterId) || !character.recruitment || !character.recruitment.demonstration) return fail('content-error');
  const recruit = game.world.recruits.find(r => r.characterId === operation.characterId);
  if (operation.kind === 'invite') {
    if (recruit) return success();
    if (!game.world.compendiumIds.includes(character.compendium.id as CompendiumId) || !character.recruitment.roomIds?.includes(game.world.roomId)
      || !conditionSatisfied(character.recruitment.condition, game.world) || !recruitmentEvidence(registry, game, operation.characterId)) return fail('precondition');
    const base = character.progression.find(p => p.level === 1);
    if (!base?.abilityIds.length || base.abilityIds.some(id => !character.abilities.some(a => a.id === id))) return fail('content-error');
    return success({ ...game, world: { ...game.world, recruits: [...game.world.recruits, { characterId: operation.characterId, level: 1, abilityIds: base.abilityIds as AbilityId[], progressFlags: [] }] } }, practice ?? null, true);
  }
  if (!recruit) return fail('precondition');
  if (operation.kind === 'begin-practice') {
    if (recruit.level >= 2) return success();
    return success(game, { characterId: operation.characterId, adventureId: game.adventureId, attemptId: game.world.attemptId, startRevision: game.world.configurationRevision,
      startingLevel: recruit.level, baselineMeasurementIds: game.notebook.measurements.map(m => m.id), observations: [] });
  }
  if (operation.kind === 'advance') {
    if (recruit.level >= 2) return success();
    if (!progressionReady(registry, game, practice, operation.characterId)) return fail('precondition');
    const level = character.progression.find(p => p.level === 2);
    if (!level?.demonstration || !conditionSatisfied(level.condition, game.world)) return fail('content-error');
    return success({ ...game, world: { ...game.world, recruits: game.world.recruits.map(r => r === recruit ? { ...r, level: 2,
      abilityIds: [...new Set([...r.abilityIds, ...level.abilityIds as AbilityId[]])] } : r) } }, null, true);
  }
  const ability = character.abilities.find(a => a.id === operation.abilityId);
  if (!game.world.activeAllyIds.some(id => id === operation.characterId) || !recruit.abilityIds.includes(operation.abilityId)) return fail('precondition');
  if (!ability || ability.effects.length || !ability.conventionalEquivalentActionIds?.includes(operation.actionId)
    || ability.profileIds?.some(id => registry.record(id)?.kind !== 'profile') || !uuid.test(operation.measurementId)) return fail('content-error');
  const delegate = conventionalAbilityOperation(registry, scenario, game, operation.actionId, operation.measurementId);
  return delegate ? { ok: true, delegate } : fail('precondition');
}
