// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import validateSchema from '../content/schema.generated.js';
import type * as S from '../content/schema-types.generated';
import { evaluateCopper } from '../domain/copper';
import type { CopperChallenge, CopperProfile } from '../domain/copper';
import { evaluateOptics } from '../domain/optics';
import type { OpticalChallenge, OpticalProfile } from '../domain/optics';
import { evaluateRadio } from '../domain/radio';
import type { RadioChallenge, RadioProfile } from '../domain/radio';
import { evaluatePower } from '../domain/power';
import type { PowerChallenge, PowerProfile } from '../domain/power';
import { evaluateCapabilities } from '../domain/capabilities';
import type { AdvertisedCapability, CapabilitiesProfile } from '../domain/capabilities';
import { evaluateSymbolAnswer } from '../domain/packet-journey';
import type { ToySample, ToySymbolProfile } from '../domain/packet-journey';
import { contentError, invalidInput, isRecord } from '../domain/evaluate';
import type { AbilityId, ActionId, DomainAction, EffectId, EvaluationResult, FactId, HintId, MeasurementId, ObjectiveId, QualifiedId, Reading, RuleId, Unit } from '../domain/types';
import { conditionSatisfied, conditionSupported } from './conditions';
import type { EffectBinding, RejectionReason, StateEffect } from './reducer';
import type { GameState, HintLevel, Measurement } from './types';

type WithoutProfile<T> = Omit<T, 'kind' | 'profile'>;
type CopperPath = WithoutProfile<Extract<CopperChallenge, { kind: 'copper-path' }>>;
type CapabilitySelection = { readonly bothNegotiate: true; readonly selected: AdvertisedCapability };
interface Selected { readonly alternativeId: QualifiedId }
/**
 * Trusted room adapters read the actual current GameState, including the chosen
 * intervention/answer. No result, effect, measurement or arbitrary evaluator is
 * accepted here. Profiles always come from the validated content registry.
 */
export type ObjectiveScenario = Selected & (
  | { readonly kind: 'copper-preparation'; readonly path: CopperPath }
  | { readonly kind: 'copper-proof'; readonly path: CopperPath; readonly beforeMeasurementId: MeasurementId | null; readonly repeaterClaim: 'requires-continuity' | 'bridges-open' | null }
  | { readonly kind: 'fiber-preparation'; readonly preparation: WithoutProfile<Extract<OpticalChallenge, { kind: 'optical-preparation' }>> }
  | { readonly kind: 'fiber-proof'; readonly path: WithoutProfile<Extract<OpticalChallenge, { kind: 'optical-passive' }>>; readonly inspectionComplete: boolean }
  | { readonly kind: 'radio-preparation'; readonly path: WithoutProfile<Extract<RadioChallenge, { kind: 'radio-path' }>> }
  | { readonly kind: 'radio-proof'; readonly path: WithoutProfile<Extract<RadioChallenge, { kind: 'radio-link' }>> }
  | { readonly kind: 'equipment'; readonly allocation: WithoutProfile<PowerChallenge>; readonly capability: CapabilitySelection }
  | { readonly kind: 'calibration'; readonly samples: readonly ToySample[]; readonly decodedBits: string; readonly roleClaim: 'physical-sampling-not-address-discovery' | 'physical-repeater-resolves-IP-address'; readonly capability: CapabilitySelection }
);
export type ObjectiveScenarioResolver = (game: GameState, objectiveId: ObjectiveId) => ObjectiveScenario | null;
export type ObjectiveInput =
  | { readonly kind: 'measure'; readonly alternativeId: QualifiedId; readonly id: MeasurementId }
  | { readonly kind: 'submit'; readonly alternativeId: QualifiedId; readonly measurementId: MeasurementId }
  | { readonly kind: 'hint' };
export type ObjectiveOperation = ObjectiveInput & { readonly objectiveId: ObjectiveId };
export type ObjectiveEvaluation = EvaluationResult<unknown, StateEffect>;
type Failure = { readonly ok: false; readonly reason: RejectionReason };
export type ObjectivePreparation = Failure | {
  readonly ok: true; readonly evaluation: ObjectiveEvaluation;
  readonly finalize: (candidate: GameState) => { readonly ok: true; readonly game: GameState } | Failure;
};
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields: Record<ObjectiveInput['kind'], readonly string[]> = { measure: ['kind', 'alternativeId', 'id'], submit: ['kind', 'alternativeId', 'measurementId'], hint: ['kind'] };
const scenarioKinds: Record<string, readonly string[]> = {
  O03: ['copper-preparation', 'path'], O04: ['copper-proof', 'path', 'beforeMeasurementId', 'repeaterClaim'],
  O05: ['fiber-preparation', 'preparation'], O06: ['fiber-proof', 'path', 'inspectionComplete'],
  O07: ['radio-preparation', 'path'], O08: ['radio-proof', 'path'],
  O09: ['equipment', 'allocation', 'capability'], O10: ['calibration', 'samples', 'decodedBits', 'roleClaim', 'capability'],
};
const rules: Record<string, string> = { O03: 'PHY04', O04: 'PHY04', O05: 'PHY06', O06: 'PHY06', O07: 'PHY07', O08: 'PHY07', O09: 'PHY08', O10: 'PHY10' };
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const error = (field: string, message = 'The supplied exercise is incomplete or unsupported.'): ObjectiveEvaluation => contentError({ code: 'objective-content', field, message });
const decision = (status: 'correct' | 'incorrect', reasonCode: string, observations: readonly unknown[] = [], acceptedEffects: readonly StateEffect[] = []): ObjectiveEvaluation => ({ status, reasonCode, observations, acceptedEffects });
const sameVersion = (a: GameState['world'], b: DomainAction<unknown>['expectedVersion']) => a.configurationRevision === b.configurationRevision && a.attemptId === b.attemptId;
function current(measurement: Measurement, game: GameState): boolean { return !measurement.stale && sameVersion(game.world, measurement); }
function definition(registry: ContentRegistry, objectiveId: ObjectiveId): Readonly<S.objective> | null {
  const record = registry.record(objectiveId);
  if (!record || record.kind !== 'objective' || !validateSchema(record) || record.id !== objectiveId
    || !conditionSupported(record.prerequisite) || record.alternatives.some(a => !conditionSupported(a.condition))
    || record.sourceClaims.some(s => !registry.has('source', s.sourceId))
    || record.ruleIds.some(id => !registry.has('rule', id))
    || record.profileIds.some(id => registry.record(id)?.kind !== 'profile')) return null;
  return record;
}
function profile<T>(registry: ContentRegistry, id: string): T {
  const record = registry.record(q(id));
  // The evaluator still validates this projection's exact reviewed identity/values.
  return (record?.kind === 'profile' && record.reviewedProfileId === record.id
    ? { id: record.id, parameters: record.parameters } : null) as T;
}
function canUse(registry: ContentRegistry, game: GameState, alternative: S.alternative): boolean {
  if (!alternative.itemIds.every(id => game.world.inventory.some(i => i.itemId === id && i.quantity > 0))) return false;
  return alternative.abilityIds.every(id => game.world.activeAllyIds.some(characterId => {
    const recruit = game.world.recruits.find(r => r.characterId === characterId), character = registry.record(characterId);
    return recruit?.abilityIds.includes(id as AbilityId) && character?.kind === 'character' && character.abilities.some(a => a.id === id);
  }));
}
function inputValid(input: unknown): input is ObjectiveInput {
  if (!isRecord(input) || !Object.hasOwn(fields, String(input['kind']))) return false;
  const keys = fields[input['kind'] as ObjectiveInput['kind']];
  if (Object.keys(input).length !== keys.length || Object.keys(input).some(k => !keys.includes(k))) return false;
  return input['kind'] === 'hint' || (typeof input['alternativeId'] === 'string' && uuid.test(String(input['kind'] === 'measure' ? input['id'] : input['measurementId'])));
}
/** A historical baseline keeps its old version; its actual scoped record remains verifiable. */
export function isHistoricalCopperBaseline(registry: ContentRegistry, game: GameState, value: Measurement | undefined): boolean {
  if (!value || !Array.isArray(value.subjectIds) || !Array.isArray(value.readings) || typeof value.conclusionCode !== 'string'
    || value.ruleId !== q('PHY04') || !Number.isSafeInteger(value.configurationRevision) || value.configurationRevision < 0
    || value.configurationRevision > game.world.configurationRevision || !uuid.test(value.attemptId)) return false;
  const owners = ['O03', 'O04'].filter(id => value.subjectIds.includes(q(id)));
  if (owners.length !== 1) return false;
  const short = owners[0]!, record = definition(registry, q<'objective'>(short));
  if (!record || value.roomId !== record.evidence[0]?.roomId
    || !record.alternatives.some(a => value.conclusionCode === `${short}:${a.id.split(':')[1]}:incorrect`)) return false;
  const expectedSubjects = [...new Set([record.id, ...record.profileIds, ...record.evidence.flatMap(e => e.subjectIds)])];
  if (canonical([...value.subjectIds].sort()) !== canonical(expectedSubjects.sort())) return false;
  const expectedNames = ['Compatible path', 'Total channel length', 'Inclusive maximum', 'Open required conductors',
    ...(short === 'O04' ? ['Historical open recorded', 'Repeater role distinguished'] : [])];
  if (canonical(value.readings.map(r => r?.name)) !== canonical(expectedNames)) return false;
  return value.readings.every((r, i) => r && Number.isFinite(r.value) && r.value >= 0
    && r.unit === (i === 1 || i === 2 ? 'm' : 'count')
    && (i === 0 ? r.value === 1 : i === 2 ? r.value === 100 : i === 3 ? Number.isInteger(r.value) && r.value > 0 && r.value <= 256 : i > 3 ? r.value === 0 || r.value === 1 : true));
}
interface Physical { readonly evaluation: ObjectiveEvaluation; readonly readings: readonly Reading[]; readonly scenario: ObjectiveScenario }
/** Run every required predicate before selecting a failed learner decision. */
function physical(registry: ContentRegistry, game: GameState, scenario: ObjectiveScenario): Physical {
  const results: ObjectiveEvaluation[] = [], readings: Reading[] = [];
  const command = <T>(input: T): DomainAction<T> => ({ actionId: 'objective-physical' as ActionId, expectedVersion: game.world, input });
  const add = (name: string, value: number, unit: Unit = 'count') => { readings.push({ name, value, unit } as Reading); };
  const quantity = (name: string, value: unknown) => { if (isRecord(value) && typeof value['value'] === 'number' && typeof value['unit'] === 'string') add(name, value['value'], value['unit'] as Unit); };
  const run = (result: ObjectiveEvaluation) => {
    results.push(result);
    for (const raw of result.observations) if (isRecord(raw)) {
      switch (raw['kind']) {
        case 'copper-path':
          add('Compatible path', raw['compatible'] === true ? 1 : 0);
          quantity('Total channel length', raw['total']); quantity('Inclusive maximum', raw['maximum']);
          if (Array.isArray(raw['openConductorIndexes'])) add('Open required conductors', raw['openConductorIndexes'].length);
          break;
        case 'optical-preparation':
          add('Inspection complete', raw['inspectionComplete'] === true ? 1 : 0); add('Preparation complete', raw['preparationComplete'] === true ? 1 : 0); break;
        case 'optical-power':
          quantity('Receive power', raw['receive']); quantity('Sensitivity reserve', raw['margin']); quantity('Sensitivity', raw['sensitivity']);
          quantity('Maximum receive', raw['maximumReceive']); quantity('Required reserve', raw['requiredMargin']); break;
        case 'radio-path':
          add('Viable path', raw['viablePath'] === true ? 1 : 0); add('Compatible settings', raw['settingsCompatible'] === true ? 1 : 0); break;
        case 'radio-link':
          add('Viable path', raw['viablePath'] === true ? 1 : 0); add('Compatible settings', raw['settingsCompatible'] === true ? 1 : 0);
          quantity('Received signal', raw['signal']); quantity('Received noise', raw['noise']); quantity('Signal-to-noise ratio', raw['snr']); quantity('Required signal-to-noise ratio', raw['minimum']); break;
        case 'delivered-power':
          quantity('Delivered budget', raw['budget']); quantity('Total delivered demand', raw['total']); quantity('Delivered headroom', raw['headroom']); quantity('Delivered excess', raw['excess']); break;
        case 'common-capabilities':
          if (isRecord(raw['selected'])) { quantity('Selected common rate', raw['selected']['rate']); add('Selected full duplex', raw['selected']['duplex'] === 'full' ? 1 : 0); }
          add('Common mode supported', result.status === 'correct' ? 1 : 0); break;
        case 'symbol-answer':
          if (isRecord(raw['trace'])) { add('Represented bits', Number(raw['trace']['representedBits']), 'bit'); add('Symbols decoded', Number(raw['trace']['symbols']), 'symbol'); }
          add('Decoded pattern matches', result.status === 'correct' ? 1 : 0); break;
      }
    }
  };
  const capability = (value: CapabilitySelection) => {
    if (!isRecord(value) || Object.keys(value).some(k => !['bothNegotiate', 'selected'].includes(k))) { run(error('capability')); return; }
    run(evaluateCapabilities({ kind: 'common-capabilities', profile: profile<CapabilitiesProfile>(registry, 'PROFILE-CAPABILITIES'), bothNegotiate: value.bothNegotiate }, command({ kind: 'select-capability', selected: value.selected }), game.world));
  };
  switch (scenario.kind) {
    case 'copper-preparation': case 'copper-proof': {
      run(evaluateCopper({ ...scenario.path, kind: 'copper-path', profile: profile<CopperProfile>(registry, 'PROFILE-COPPER-100') }, command({ kind: 'test-path' }), game.world));
      if (scenario.kind === 'copper-proof') {
        const baseline = game.notebook.measurements.find(m => m.id === scenario.beforeMeasurementId);
        const baselineValid = isHistoricalCopperBaseline(registry, game, baseline);
        if ((scenario.beforeMeasurementId !== null && (typeof scenario.beforeMeasurementId !== 'string' || !uuid.test(scenario.beforeMeasurementId)))
          || (scenario.repeaterClaim !== null && !['requires-continuity', 'bridges-open'].includes(scenario.repeaterClaim))) run(error('copper-proof'));
        else if (scenario.repeaterClaim === null) run(invalidInput('repeater-role-choice-missing'));
        else if (!baselineValid) run(decision('incorrect', 'before-open-evidence-missing'));
        else if (scenario.repeaterClaim !== 'requires-continuity') run(decision('incorrect', 'repeater-cannot-bridge-open'));
        add('Historical open recorded', baselineValid ? 1 : 0); add('Repeater role distinguished', scenario.repeaterClaim === 'requires-continuity' ? 1 : 0);
      }
      break;
    }
    case 'fiber-preparation': run(evaluateOptics({ ...scenario.preparation, kind: 'optical-preparation', profile: profile<OpticalProfile>(registry, 'PROFILE-OPTICAL') }, command({ kind: 'verify-preparation' }), game.world)); break;
    case 'fiber-proof':
      run(evaluateOptics({ ...scenario.path, kind: 'optical-passive', profile: profile<OpticalProfile>(registry, 'PROFILE-OPTICAL') }, command({ kind: 'measure-optics' }), game.world));
      if (typeof scenario.inspectionComplete !== 'boolean') run(error('inspectionComplete'));
      else if (!scenario.inspectionComplete) run(decision('incorrect', 'inspect-before-validating'));
      add('Inspection complete', scenario.inspectionComplete ? 1 : 0);
      // Authoring declares these dimensions; never infer them from prose.
      quantity('Transmit power', profile<OpticalProfile>(registry, 'PROFILE-OPTICAL')?.parameters.transmit); quantity('Total passive loss', scenario.path?.loss);
      break;
    case 'radio-preparation': run(evaluateRadio({ ...scenario.path, kind: 'radio-path', profile: profile<RadioProfile>(registry, 'PROFILE-RADIO') }, command({ kind: 'check-path' }), game.world)); break;
    case 'radio-proof': run(evaluateRadio({ ...scenario.path, kind: 'radio-link', profile: profile<RadioProfile>(registry, 'PROFILE-RADIO') }, command({ kind: 'measure-link' }), game.world)); break;
    case 'equipment':
      run(evaluatePower({ ...scenario.allocation, kind: 'delivered-power', profile: profile<PowerProfile>(registry, 'PROFILE-POWER') } as PowerChallenge, command({ kind: 'check-allocation' }), game.world));
      for (const key of ['formFactorMatch', 'phyAndMediaMatch', 'hostSupport', 'portPowerCompatible', 'perPortConstraintsMet'] as const) {
        if (!isRecord(scenario.allocation) || typeof scenario.allocation[key] !== 'boolean') run(error(`allocation.${key}`));
      }
      capability(scenario.capability); break;
    case 'calibration':
      run(evaluateSymbolAnswer({ profile: profile<ToySymbolProfile>(registry, 'PROFILE-SYMBOLS'), samples: scenario.samples }, command({ bits: scenario.decodedBits }), game.world));
      capability(scenario.capability);
      if (!['physical-sampling-not-address-discovery', 'physical-repeater-resolves-IP-address'].includes(scenario.roleClaim)) run(error('roleClaim'));
      else if (scenario.roleClaim !== 'physical-sampling-not-address-discovery') run(decision('incorrect', 'outside-physical-role'));
      add('Physical role distinguished', scenario.roleClaim === 'physical-sampling-not-address-discovery' ? 1 : 0); break;
  }
  const evaluation = results.find(r => r.status === 'content-error') ?? results.find(r => r.status === 'invalid-input')
    ?? results.find(r => r.status === 'incorrect') ?? decision('correct', 'objective-physical-checks-pass');
  if (readings.length > 16 || readings.some(r => !Number.isFinite(r.value))) return { evaluation: error('readings'), readings: [], scenario };
  return { evaluation: { ...evaluation, observations: results.flatMap(r => r.observations) }, readings, scenario };
}
function canonicalMeasurement(record: S.objective, game: GameState, proof: Physical, id: MeasurementId): Measurement {
  const short = record.id.split(':')[1]!;
  return { id, ruleId: q(rules[short]!) as RuleId, roomId: record.evidence[0]!.roomId as Measurement['roomId'],
    subjectIds: [...new Set([record.id, ...record.profileIds, ...record.evidence.flatMap(e => e.subjectIds)])] as QualifiedId[],
    configurationRevision: game.world.configurationRevision, attemptId: game.world.attemptId, stale: false,
    readings: structuredClone(proof.readings), conclusionCode: `${short}:${proof.scenario.alternativeId.split(':')[1]}:${proof.evaluation.status}` };
}
function matchingMeasurement(actual: Measurement, expected: Measurement): boolean {
  return canonical({ ...actual, id: expected.id }) === canonical(expected);
}
function resolvePhysical(registry: ContentRegistry, resolver: ObjectiveScenarioResolver | undefined, game: GameState, record: S.objective): Physical | ObjectiveEvaluation {
  const short = record.id.split(':')[1]!, expected = scenarioKinds[short];
  if (!expected) return invalidInput('objective-lifecycle-unavailable');
  const scenario = resolver?.(game, record.id as ObjectiveId);
  if (scenario === null || scenario === undefined) return invalidInput('objective-scenario-unavailable');
  const keys = ['kind', 'alternativeId', ...expected.slice(1)];
  if (!isRecord(scenario) || scenario.kind !== expected[0] || Object.keys(scenario).length !== keys.length
    || Object.keys(scenario).some(k => !keys.includes(k)) || !record.alternatives.some(a => a.id === scenario.alternativeId)) return error('scenario');
  for (const field of ['path', 'preparation', 'allocation']) {
    const value = (scenario as unknown as Record<string, unknown>)[field];
    if (value !== undefined && (!isRecord(value) || Object.hasOwn(value, 'kind') || Object.hasOwn(value, 'profile'))) return error(`scenario.${field}`);
  }
  return physical(registry, game, scenario);
}
/** No presentation, persistence or caller-provided verdict participates in scoring. */
export function evaluateObjective(registry: ContentRegistry, resolver: ObjectiveScenarioResolver | undefined, game: GameState,
  objectiveId: ObjectiveId, action: DomainAction<ObjectiveInput>): ObjectiveEvaluation {
  const record = definition(registry, objectiveId);
  if (!record || record.contentVersion !== game.contentVersion) return error('objective');
  // Hint reading needs only its authored ladder, not an available room simulation.
  const hint = isRecord(action) && isRecord(action.input) && action.input['kind'] === 'hint';
  const resolved = hint ? null : resolvePhysical(registry, resolver, game, record);
  if (resolved && 'status' in resolved && resolved.status === 'content-error') return resolved;
  if (resolved && 'evaluation' in resolved && resolved.evaluation.status === 'content-error') return resolved.evaluation;
  if (!isRecord(action) || typeof action.actionId !== 'string' || !action.actionId.trim() || !isRecord(action.expectedVersion)
    || !Number.isSafeInteger(action.expectedVersion.configurationRevision) || action.expectedVersion.configurationRevision < 0
    || typeof action.expectedVersion.attemptId !== 'string') return invalidInput('malformed-action-envelope');
  if (!sameVersion(game.world, action.expectedVersion)) return invalidInput('stale-action');
  if (action.input === null || action.input === undefined) return invalidInput('required-action-missing');
  if (!inputValid(action.input)) return invalidInput('malformed-objective-input');
  if (action.input.kind === 'hint') return decision('correct', 'hint-available');
  if (!resolved || 'status' in resolved) return resolved ?? error('scenario');
  if (resolved.evaluation.status === 'invalid-input') return resolved.evaluation;
  const input = action.input;
  const alternative = record.alternatives.find(a => a.id === input.alternativeId);
  if (!alternative) return invalidInput('unknown-alternative');
  if (alternative.id !== resolved.scenario.alternativeId) return invalidInput('selection-does-not-match-current-world');
  if (!conditionSatisfied(record.prerequisite, game.world) || !conditionSatisfied(alternative.condition, game.world)) return decision('incorrect', 'prerequisite-unmet');
  if (!canUse(registry, game, alternative)) return decision('incorrect', 'required-tool-or-ability-missing');
  if (game.world.roomId !== record.evidence[0]?.roomId) return invalidInput('objective-room-unavailable');
  if (input.kind === 'measure') {
    if (game.notebook.measurements.some(m => m.id === input.id)) return invalidInput('measurement-id-reused');
    if (game.notebook.measurements.length >= 512) return invalidInput('measurement-capacity');
    return { ...resolved.evaluation, observations: [...resolved.evaluation.observations, { kind: 'objective-measurement', measurement: canonicalMeasurement(record, game, resolved, input.id) }] };
  }
  if (game.world.completedObjectiveIds.includes(objectiveId)) return decision('correct', 'objective-already-complete');
  const measurement = game.notebook.measurements.find(m => m.id === input.measurementId);
  if (!measurement) return decision('incorrect', 'measurement-missing');
  if (!current(measurement, game)) return decision('incorrect', 'stale-evidence', [{ kind: 'freshness', fresh: false, observationRemainsVisible: true, currentValidationAward: false }]);
  const expected = canonicalMeasurement(record, game, resolved, measurement.id);
  if (!matchingMeasurement(measurement, expected)) return decision('incorrect', 'measurement-provenance-mismatch');
  if (resolved.evaluation.status !== 'correct') return resolved.evaluation;
  if (alternative.evidenceIds.some(id => {
    const evidence = record.evidence.find(e => e.id === id);
    return !evidence || (!evidence.requiresFreshMeasurement && !game.notebook.factIds.includes(id as FactId));
  })) return decision('incorrect', 'required-observation-missing');
  return decision('correct', 'objective-evidence-accepted', [{ kind: 'objective', objectiveId, alternativeId: alternative.id,
    explanation: alternative.explanation, completionExplanation: record.completionExplanation, assistanceRecorded: game.assistance.some(h => h.objectiveId === objectiveId) }],
  [...record.effects, ...alternative.effects] as StateEffect[]);
}

/** Canonical one-time batches; introduction and later outcome lifecycle stay owned by their adapters. */
export function objectiveEffectBindings(registry: ContentRegistry, ids: readonly ObjectiveId[] = Object.keys(scenarioKinds).map(id => q<'objective'>(id))): EffectBinding[] {
  return ids.flatMap(id => {
    const record = definition(registry, id); if (!record || !scenarioKinds[id.split(':')[1]!]) return [];
    return [...new Map([...record.effects, ...record.alternatives.flatMap(a => a.effects)].map(e => [e.effectId, e])).values()]
      .map(effect => ({ sourceId: id, effectId: effect.effectId as EffectId, mode: 'once' as const, receipt: { kind: 'objective' as const, id } }));
  });
}
export function objectiveHints(registry: ContentRegistry, game: GameState, objectiveId: ObjectiveId) {
  const record = definition(registry, objectiveId); if (!record) return null;
  const level = Math.max(0, ...game.assistance.filter(h => h.objectiveId === objectiveId).map(h => h.level));
  return { level, hints: (['method', 'workedStep', 'solution'] as const).slice(0, level).map(key => record.hints[key]), nextLevel: Math.min(3, level + 1) as HintLevel };
}
/** Finalize only after the reducer validates the complete canonical effect batch. */
export function prepareObjectiveChange(registry: ContentRegistry, resolver: ObjectiveScenarioResolver | undefined, game: GameState, operation: ObjectiveOperation): ObjectivePreparation {
  if (!isRecord(operation) || typeof operation.objectiveId !== 'string') return { ok: false, reason: 'invalid-input' };
  const { objectiveId, ...input } = operation;
  const evaluation = evaluateObjective(registry, resolver, game, objectiveId, { actionId: 'objective-operation' as ActionId, expectedVersion: game.world, input });
  if (evaluation.status === 'content-error' || evaluation.status === 'invalid-input') return { ok: false, reason: evaluation.status };
  return { ok: true, evaluation, finalize: candidate => {
    if (operation.kind === 'hint') {
      const hints = objectiveHints(registry, game, objectiveId), record = definition(registry, objectiveId);
      if (!hints || !record) return { ok: false, reason: 'content-error' };
      if (hints.level >= 3) return { ok: true, game: candidate };
      if (game.assistance.length >= 2048) return { ok: false, reason: 'invalid-state' };
      const hint = record.hints[(['method', 'workedStep', 'solution'] as const)[hints.nextLevel - 1]!];
      return { ok: true, game: { ...candidate, assistance: [...candidate.assistance, { objectiveId, hintId: hint.id as HintId, level: hints.nextLevel, attemptId: game.world.attemptId }] } };
    }
    if (operation.kind === 'measure') {
      const observed = evaluation.observations.find(o => isRecord(o) && o['kind'] === 'objective-measurement');
      if (!isRecord(observed)) return { ok: true, game: candidate }; // unmet prerequisites award/record nothing
      const measurement = observed['measurement'] as Measurement;
      if (!sameVersion(candidate.world, measurement) || candidate.notebook.measurements.some(m => m.id === measurement.id)) return { ok: false, reason: 'stale-version' };
      return { ok: true, game: { ...candidate, notebook: { ...candidate.notebook, measurements: [...candidate.notebook.measurements, structuredClone(measurement)] } } };
    }
    return { ok: true, game: candidate };
  } };
}
