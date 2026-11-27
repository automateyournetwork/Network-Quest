// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import { contentError, invalidInput, isRecord } from '../domain/evaluate';
import { evaluateCopper } from '../domain/copper';
import type { CopperChallenge, CopperProfile } from '../domain/copper';
import { evaluateOptics } from '../domain/optics';
import type { OpticalChallenge, OpticalProfile } from '../domain/optics';
import { evaluateRadio } from '../domain/radio';
import type { RadioChallenge, RadioProfile } from '../domain/radio';
import { evaluatePower } from '../domain/power';
import type { PowerChallenge, PowerProfile } from '../domain/power';
import { evaluateCapabilities } from '../domain/capabilities';
import type { CapabilitiesProfile } from '../domain/capabilities';
import { comparePacketPattern, evaluateSymbolAnswer } from '../domain/packet-journey';
import type { PacketProfile, ToySymbolProfile } from '../domain/packet-journey';
import type { ActionId, DialogueEffectId, DomainAction, EffectId, EvaluationResult, FactId, MeasurementId, ObjectiveId, QualifiedId, Reading, Route, RuleId } from '../domain/types';
import { conditionSatisfied } from './conditions';
import { resolveEquipmentPreparation } from './equipment-scenarios';
import type { ObjectiveScenario } from './objectives';
import type { EffectBinding, RejectionReason, StateEffect } from './reducer';
import type { ActivityState, GameState, Measurement, WorldState } from './types';

export type RepairPlanId = 'copper-section' | 'copper-alternate' | 'fiber-A' | 'fiber-B' | 'radio-A' | 'radio-B' | 'shutdown';
export type RepairClassification = 'permanent' | 'temporary' | 'shutdown';
export type RepairPlanOperation =
  | { readonly kind: 'choose'; readonly actionId: QualifiedId }
  | { readonly kind: 'review'; readonly id: MeasurementId }
  | { readonly kind: 'measure-link'; readonly id: MeasurementId }
  | { readonly kind: 'test-endpoint'; readonly id: MeasurementId }
  | { readonly kind: 'execute'; readonly reviewId: MeasurementId; readonly warningAcknowledged: boolean }
  | { readonly kind: 'classify'; readonly selection: RepairClassification; readonly linkId: MeasurementId | null; readonly endpointId: MeasurementId | null };
type Path = Omit<Extract<CopperChallenge, { kind: 'copper-path' }>, 'profile'>
  | Omit<Extract<OpticalChallenge, { kind: 'optical-passive' }>, 'profile'>
  | Omit<Extract<RadioChallenge, { kind: 'radio-link' }>, 'profile'>;
/** Raw scenario observations, supplied by the trusted game adapter, never the renderer. */
export interface RepairScenario {
  readonly path: Path | null;
  readonly equipment: Extract<ObjectiveScenario, { kind: 'equipment' }> | null;
  readonly calibration: Extract<ObjectiveScenario, { kind: 'calibration' }> | null;
  readonly endpointResponse: 'service-acknowledged' | 'service-unavailable';
  readonly receivedBits: string;
  readonly deployment: { readonly defectRemoved: boolean; readonly temporaryDependency: boolean;
    readonly unresolvedDefectIdentified: boolean; readonly deliberateIsolation: boolean };
}
export type RepairScenarioResolver = (game: GameState, plan: RepairPlanId) => RepairScenario | null;
export type RepairEvaluation = EvaluationResult<unknown, StateEffect>;
type Failure = { readonly ok: false; readonly reason: RejectionReason };
export type RepairPreparation = Failure | { readonly ok: true; readonly evaluation: RepairEvaluation;
  readonly finalize: (candidate: GameState) => { readonly ok: true; readonly game: GameState; readonly activity?: ActivityState } | Failure };
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const sourceId = q('DIALOGUE-repair-plan');
export const repairFlags = Object.freeze({ selected: q<'flag'>('FLAG-repair-selected'), duration: q<'flag'>('FLAG-repair-duration'),
  executed: q<'flag'>('FLAG-repair-executed'), classification: q<'flag'>('FLAG-repair-classification') });
/** Isolation installs nothing. Canonical proof uses no duration, without inventing a world flag. */
export function repairMeasurementDuration(plan: RepairPlanId, world: WorldState): 'permanent' | 'temporary' | 'not-applicable' | null {
  if (!Object.hasOwn(world.flags, repairFlags.duration)) return plan === 'shutdown' ? 'not-applicable' : null;
  const duration = world.flags[repairFlags.duration];
  if (duration !== 'permanent' && duration !== 'temporary') return null;
  return plan === 'shutdown' ? 'not-applicable' : duration;
}
/** Read a committed classification, never infer success from position or a lamp. */
export function repairClassification(game: GameState): RepairClassification | null {
  if (!game.world.completedObjectiveIds.includes(q('O12'))) return null;
  const value = game.world.flags[repairFlags.classification];
  return value === 'permanent' || value === 'temporary' || value === 'shutdown' ? value : null;
}
export const repairPlans: readonly { readonly id: RepairPlanId; readonly route: Route | null; readonly label: string }[] = Object.freeze([
  { id: 'copper-section', route: 'copper', label: 'Copper replacement — 95 m' }, { id: 'copper-alternate', route: 'copper', label: 'Copper alternate — 100 m' },
  { id: 'fiber-A', route: 'fiber', label: 'Fiber path A — 8 dB loss' }, { id: 'fiber-B', route: 'fiber', label: 'Fiber path B — 9 dB loss' },
  { id: 'radio-A', route: 'radio', label: 'Radio path A — 25 dB SNR' }, { id: 'radio-B', route: 'radio', label: 'Radio path B — 20 dB SNR' },
  { id: 'shutdown', route: null, label: 'Deliberate isolation — service unresolved' },
]);
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : isRecord(value) ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}` : JSON.stringify(value);
const flag = (name: string, key: keyof typeof repairFlags, value: string): S.effect => ({ kind: 'set-flag', effectId: q(`EFFECT-repair-${name}`), flagId: repairFlags[key], value });
const fact = (name: string, id: string): S.effect => ({ kind: 'record-fact', effectId: q(`EFFECT-repair-${name}`), factId: q(id) });
const contracts = new Map<string, readonly S.effect[]>([
  ...repairPlans.map(p => [`plan-${p.id}`, [flag(`plan-${p.id}`, 'selected', p.id)]] as const),
  ...(['permanent', 'temporary'] as const).map(d => [`duration-${d}`, [flag(`duration-${d}`, 'duration', d)]] as const),
  ['read-plan', [fact('read-plan', 'FACT-O11-plan')]], ['record-maintenance', [fact('record-maintenance', 'FACT-repair-maintenance')]],
  ['record-isolation', [fact('record-isolation', 'FACT-repair-isolation')]], ['read-classification', [fact('read-classification', 'FACT-O12-classification')]],
  ...repairPlans.map(p => [`execute-${p.id}`, [flag(`execute-${p.id}`, 'executed', p.id), fact(`execute-record-${p.id}`, 'FACT-O11-execution')]] as const),
  ...(['permanent', 'temporary', 'shutdown'] as const).map(c => [`classify-${c}`, [flag(`classify-${c}`, 'classification', c)]] as const),
]);
const error = (field: string): RepairEvaluation => contentError({ code: 'repair-plan-content', field, message: 'This intervention does not match its reviewed exercise definition.' });
const decision = (status: 'correct' | 'incorrect', reasonCode: string, acceptedEffects: readonly StateEffect[] = [], observations: readonly unknown[] = []): RepairEvaluation => ({ status, reasonCode, acceptedEffects, observations });
const effects = (name: string) => structuredClone(contracts.get(name) ?? []) as StateEffect[];
function configured(registry: ContentRegistry): boolean {
  const source = registry.record(sourceId), o11 = registry.record(q('O11')), o12 = registry.record(q('O12'));
  if (source?.kind !== 'dialogue' || source.nodes.length !== 1 || o11?.kind !== 'objective' || o12?.kind !== 'objective') return false;
  const completed = (id: string): S.condition => ({ kind: 'objective-complete', objectiveId: q(id) });
  const common = [completed('O09'), completed('O10')];
  const branch = { kind: 'any', conditions: ['O04', 'O06', 'O08'].map(completed) } as const;
  const prerequisite = { kind: 'all', conditions: [branch, ...common] };
  if (canonical(o11.prerequisite) !== canonical(prerequisite) || canonical(o12.prerequisite) !== canonical(completed('O11'))) return false;
  const node = source.nodes[0]!;
  if (source.entryNodeId !== q('DIALOGUE-repair-plan-menu') || node.id !== source.entryNodeId || node.effects.length
    || canonical(node.condition) !== canonical({ kind: 'objective-complete', objectiveId: q('O02') })
    || canonical(node.choices.map(c => c.id).sort()) !== canonical([...contracts.keys()].map(n => q(`ACTION-repair-${n}`)).sort())) return false;
  for (const [name, expected] of contracts) {
    const choice = node.choices.find(c => c.id === q(`ACTION-repair-${name}`));
    if (!choice || choice.nextNodeId !== null || canonical(choice.condition) !== canonical({ kind: 'always' }) || canonical(choice.effects) !== canonical(expected)) return false;
    if (!name.startsWith('execute-') && !name.startsWith('classify-')) {
      const room = registry.record(q(name === 'read-classification' ? 'R12' : 'R11'));
      if (room?.kind !== 'room' || !room.hotspots.some(h => h.actionIds.includes(choice.id) && h.verbs.includes('use'))) return false;
    }
  }
  for (const [record, names] of [[o11, ['copper', 'fiber', 'radio', 'shutdown']], [o12, ['permanent', 'temporary', 'shutdown']]] as const) {
    const short = record.id.split(':')[1]!;
    if (canonical(record.effects) !== canonical([{ kind: 'complete-objective', effectId: q(`EFFECT-${short}`), objectiveId: record.id }])) return false;
    for (const name of names) {
      const alternative = record.alternatives.find(a => a.id === q(`ACTION-${short}-${name}`));
      if (!alternative || canonical(alternative.effects) !== canonical(short === 'O11' && name !== 'shutdown' ? [{ kind: 'set-route', effectId: q(`EFFECT-O11-route-${name}`), route: name }] : [])) return false;
      const condition = short === 'O12' ? completed('O11') : name === 'shutdown' ? prerequisite
        : { kind: 'all', conditions: [completed(({ copper: 'O04', fiber: 'O06', radio: 'O08' } as Record<string, string>)[name]!), ...common] };
      if (canonical(alternative.condition) !== canonical(condition)) return false;
    }
  }
  return true;
}
export function repairEffectBindings(registry: ContentRegistry): EffectBinding[] {
  if (!configured(registry)) return [];
  const bindings: EffectBinding[] = [];
  for (const short of ['O11', 'O12']) {
    const record = registry.record(q(short)) as S.objective;
    for (const effect of [...record.effects, ...record.alternatives.flatMap(a => a.effects)]) bindings.push({ sourceId: record.id as ObjectiveId,
      effectId: effect.effectId as EffectId, mode: 'once', receipt: { kind: 'objective', id: record.id as ObjectiveId } });
  }
  for (const [name, batch] of contracts) for (const effect of batch) bindings.push(name.startsWith('execute-') || name.startsWith('classify-')
    ? { sourceId, effectId: effect.effectId as EffectId, mode: 'once', receipt: { kind: 'dialogue-effect', id: batch[0]!.effectId as DialogueEffectId } }
    : { sourceId, effectId: effect.effectId as EffectId, mode: 'repeatable' });
  return bindings;
}
function profile<T>(registry: ContentRegistry, id: string): T {
  const r = registry.record(q(id)); return (r?.kind === 'profile' && r.id === r.reviewedProfileId ? { id: r.id, parameters: r.parameters } : null) as T;
}
/** Reviewed candidates from RR-O03/O06/O08; no fresh measurement is created here. */
export function createRepairScenarioResolver(registry: ContentRegistry): RepairScenarioResolver {
  const valid = configured(registry);
  return (game, plan) => {
    if (!valid || !repairPlans.some(p => p.id === plan)) return null;
    const equipment = resolveEquipmentPreparation(game, q('O09'));
    const calibration = resolveEquipmentPreparation(game, q('O10'));
    const path: Path | null = plan.startsWith('copper-') ? { kind: 'copper-path', compatible: true,
      lengths: [{ value: plan === 'copper-section' ? 85 : 90, unit: 'm' }, { value: 10, unit: 'm' }], requiredConductors: [true, true, true, true] }
      : plan.startsWith('fiber-') ? { kind: 'optical-passive', compatible: true, loss: { value: plan === 'fiber-A' ? 8 : 9, unit: 'dB' } }
        : plan.startsWith('radio-') ? { kind: 'radio-link', viablePath: true, settingsCompatible: true, signal: { value: -65, unit: 'dBm' }, noise: { value: plan === 'radio-A' ? -90 : -85, unit: 'dBm' } } : null;
    return { path, equipment: equipment?.kind === 'equipment' ? equipment : null, calibration: calibration?.kind === 'calibration' ? calibration : null,
      // Explicit supplied receiver and service observations for this fictional
      // lab. Neither value is computed from link-up, SNR or a pattern comparison.
      // A later environment adapter may supply failure without changing physics.
      endpointResponse: 'service-acknowledged', receivedBits: '0100111001010001',
      // These are declared installation consequences, measured/reviewed before
      // commitment and applied only with the executed plan. The selector alone
      // never establishes that execution occurred.
      deployment: { defectRemoved: plan !== 'shutdown' && game.world.flags[repairFlags.duration] === 'permanent',
        temporaryDependency: plan !== 'shutdown' && game.world.flags[repairFlags.duration] === 'temporary',
        unresolvedDefectIdentified: plan === 'shutdown', deliberateIsolation: plan === 'shutdown' } };
  };
}
interface Proof { readonly evaluation: RepairEvaluation; readonly readings: readonly Reading[] }
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => isRecord(value)
  && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
function physical(registry: ContentRegistry, game: GameState, plan: RepairPlanId, scenario: RepairScenario, pattern: boolean): Proof {
  const results: RepairEvaluation[] = [], readings: Reading[] = [];
  const command = <T>(input: T): DomainAction<T> => ({ actionId: 'repair-check' as ActionId, expectedVersion: game.world, input });
  const count = (name: string, value: number) => readings.push({ name, value, unit: 'count' } as Reading);
  if (!exact(scenario, ['path', 'equipment', 'calibration', 'endpointResponse', 'receivedBits', 'deployment'])
    || !['service-acknowledged', 'service-unavailable'].includes(scenario.endpointResponse) || typeof scenario.receivedBits !== 'string'
    || !exact(scenario.deployment, ['defectRemoved', 'temporaryDependency', 'unresolvedDefectIdentified', 'deliberateIsolation'])
    || Object.values(scenario.deployment).some(value => typeof value !== 'boolean')) return { evaluation: error('scenario'), readings: [] };
  const deploymentLabels = { defectRemoved: 'Damaged installation removed', temporaryDependency: 'Temporary dependency remains',
    unresolvedDefectIdentified: 'Unresolved defect identified', deliberateIsolation: 'Deliberate isolation' };
  for (const key of Object.keys(deploymentLabels) as (keyof typeof deploymentLabels)[]) count(deploymentLabels[key], scenario.deployment[key] ? 1 : 0);
  if (plan === 'shutdown') return { evaluation: decision('correct', 'isolation-proposal-reviewed'), readings };
  const path = scenario.path;
  if (!path || (plan.startsWith('copper-') ? path.kind !== 'copper-path' : plan.startsWith('fiber-') ? path.kind !== 'optical-passive' : path.kind !== 'radio-link')
    || !exact(path, path.kind === 'copper-path' ? ['kind', 'compatible', 'lengths', 'requiredConductors'] : path.kind === 'optical-passive'
      ? ['kind', 'compatible', 'loss'] : ['kind', 'viablePath', 'settingsCompatible', 'signal', 'noise'])) return { evaluation: error('path'), readings: [] };
  if (path.kind === 'copper-path') results.push(evaluateCopper({ ...path, profile: profile<CopperProfile>(registry, 'PROFILE-COPPER-100') }, command({ kind: 'test-path' }), game.world));
  else if (path.kind === 'optical-passive') results.push(evaluateOptics({ ...path, profile: profile<OpticalProfile>(registry, 'PROFILE-OPTICAL') }, command({ kind: 'measure-optics' }), game.world));
  else results.push(evaluateRadio({ ...path, profile: profile<RadioProfile>(registry, 'PROFILE-RADIO') }, command({ kind: 'measure-link' }), game.world));
  for (const raw of results[0]!.observations) if (isRecord(raw)) {
    const labels = { total: 'Total channel length', maximum: 'Inclusive maximum', receive: 'Receive power', margin: 'Sensitivity reserve', signal: 'Received signal', noise: 'Received noise', snr: 'Signal-to-noise ratio' };
    for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
      const value = raw[key]; if (isRecord(value) && typeof value['value'] === 'number' && typeof value['unit'] === 'string') readings.push({ name: labels[key], value: value['value'], unit: value['unit'] } as Reading);
    }
  }
  const equipment = scenario.equipment, calibration = scenario.calibration;
  if (equipment === null || calibration === null) return { evaluation: invalidInput('current-preparation-missing'), readings: [] };
  const compatibility = ['formFactorMatch', 'phyAndMediaMatch', 'hostSupport', 'portPowerCompatible', 'perPortConstraintsMet'] as const;
  const capabilityShape = (value: unknown) => exact(value, ['bothNegotiate', 'selected']) && value['bothNegotiate'] === true
    && exact(value['selected'], ['rate', 'duplex']);
  if (!exact(equipment, ['kind', 'alternativeId', 'allocation', 'capability']) || equipment.kind !== 'equipment'
    || !exact(equipment.allocation, ['demands', 'budgetBoundary', 'demandBoundary', ...compatibility])
    || compatibility.some(key => typeof equipment.allocation[key] !== 'boolean') || !capabilityShape(equipment.capability)
    || !exact(calibration, ['kind', 'alternativeId', 'samples', 'decodedBits', 'roleClaim', 'capability']) || calibration.kind !== 'calibration'
    || !capabilityShape(calibration.capability)) return { evaluation: error('preparation'), readings: [] };
  results.push(evaluatePower({ ...equipment.allocation, kind: 'delivered-power', profile: profile<PowerProfile>(registry, 'PROFILE-POWER') } as PowerChallenge, command({ kind: 'check-allocation' }), game.world));
  const common = (value: typeof equipment.capability) => evaluateCapabilities({ kind: 'common-capabilities', profile: profile<CapabilitiesProfile>(registry, 'PROFILE-CAPABILITIES'), bothNegotiate: value.bothNegotiate }, command({ kind: 'select-capability', selected: value.selected }), game.world);
  results.push(common(equipment.capability), common(calibration.capability));
  results.push(evaluateSymbolAnswer({ profile: profile<ToySymbolProfile>(registry, 'PROFILE-SYMBOLS'), samples: calibration.samples }, command({ bits: calibration.decodedBits }), game.world));
  if (!['physical-sampling-not-address-discovery', 'physical-repeater-resolves-IP-address'].includes(calibration.roleClaim)) results.push(error('calibration.roleClaim'));
  else if (calibration.roleClaim !== 'physical-sampling-not-address-discovery') results.push(decision('incorrect', 'outside-physical-role'));
  count('Current route checks pass', results[0]!.status === 'correct' ? 1 : 0);
  count('Current equipment and calibration pass', results.slice(1).every(r => r.status === 'correct') ? 1 : 0);
  // A supplied receiver trace is only observable through a currently usable
  // physical path. Failed physical/common preparation cannot fabricate recovery.
  if (pattern && !results.some(result => result.status !== 'correct')) {
    const comparison = comparePacketPattern({ profile: profile<PacketProfile>(registry, 'PROFILE-PACKET'), expectedBits: '0100111001010001', recoveredBits: scenario.receivedBits }, command({ claim: 'known-pattern-matches' }), game.world);
    results.push(comparison);
    readings.push({ name: 'Recovered highlighted bits', value: scenario.receivedBits.length, unit: 'bit' } as Reading);
    const observation = comparison.observations.find(o => o.kind === 'packet-comparison');
    if (observation?.kind === 'packet-comparison') count('Differing highlighted positions', observation.differingBits);
  }
  const evaluation = results.find(r => r.status === 'content-error') ?? results.find(r => r.status === 'invalid-input') ?? results.find(r => r.status === 'incorrect') ?? decision('correct', 'current-physical-checks-pass');
  return { evaluation: { ...evaluation, observations: results.flatMap(r => r.observations) }, readings };
}
/**
 * Authoring preflight for an already executed intervention, before validating a
 * learner's classification selection. Uses the same scoped physical checks;
 * incorrect/missing learner evidence is not an authoring error and grants no
 * result. The caller supplies its single trusted raw observation sample, never
 * a verdict. No measurement, action, effect or world change is recorded here.
 */
export function validateRepairClassificationContent(registry: ContentRegistry, game: GameState, scenario: RepairScenario | null): 'content-error' | null {
  try {
    if (!configured(registry)) return 'content-error';
    const o11 = registry.record(q('O11')), o12 = registry.record(q('O12'));
    if (o11?.contentVersion !== game.contentVersion || o12?.contentVersion !== game.contentVersion) return 'content-error';
    const plan = repairPlans.find(p => p.id === game.world.flags[repairFlags.executed]);
    if (!plan || !scenario) return 'content-error';
    return physical(registry, game, plan.id, scenario, true).evaluation.status === 'content-error' ? 'content-error' : null;
  } catch { return 'content-error'; }
}
const operationFields: Record<RepairPlanOperation['kind'], readonly string[]> = { choose: ['kind', 'actionId'], review: ['kind', 'id'],
  execute: ['kind', 'reviewId', 'warningAcknowledged'], 'measure-link': ['kind', 'id'], 'test-endpoint': ['kind', 'id'], classify: ['kind', 'selection', 'linkId', 'endpointId'] };
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function validRepairOperation(value: unknown): value is RepairPlanOperation {
  if (!isRecord(value) || !Object.hasOwn(operationFields, String(value['kind']))) return false;
  const fields = operationFields[value['kind'] as RepairPlanOperation['kind']];
  if (Object.keys(value).length !== fields.length || Object.keys(value).some(k => !fields.includes(k))) return false;
  switch (value['kind']) {
    case 'choose': return typeof value['actionId'] === 'string' && /^spec001:ACTION-repair-[A-Za-z0-9-]+$/.test(value['actionId']);
    case 'execute': return uuid(value['reviewId']) && typeof value['warningAcknowledged'] === 'boolean';
    case 'classify': return ['permanent', 'temporary', 'shutdown'].includes(String(value['selection'])) && (value['linkId'] === null || uuid(value['linkId'])) && (value['endpointId'] === null || uuid(value['endpointId']));
    default: return uuid(value['id']);
  }
}
export function repairMeasurementCurrent(measurement: Measurement, game: GameState): boolean {
  return !measurement.stale && measurement.configurationRevision === game.world.configurationRevision && measurement.attemptId === game.world.attemptId;
}
function record(game: GameState, plan: RepairPlanId, duration: string, kind: 'review' | 'link' | 'endpoint', proof: Proof, id: MeasurementId): Measurement {
  const room = kind === 'review' ? 'R11' : 'R12';
  const physicalProfile = plan.startsWith('copper-') ? 'PROFILE-COPPER-100' : plan.startsWith('fiber-') ? 'PROFILE-OPTICAL' : 'PROFILE-RADIO';
  return { id, ruleId: q(kind === 'link' ? 'PHY11' : 'STATE04') as RuleId, roomId: q(room),
    subjectIds: [q(kind === 'review' ? 'O11' : 'O12'), q(room), ...(kind !== 'endpoint' && plan !== 'shutdown'
      ? [physicalProfile, 'PROFILE-POWER', 'PROFILE-CAPABILITIES', 'PROFILE-SYMBOLS'].map(q) : []), ...(kind === 'link' ? [q('PROFILE-PACKET')] : [])],
    configurationRevision: game.world.configurationRevision, attemptId: game.world.attemptId, stale: false, readings: structuredClone(proof.readings),
    conclusionCode: `repair:${kind}:${plan}:${duration}:${proof.evaluation.status}` };
}
function canonicalProof(game: GameState, expected: Measurement, actualId: MeasurementId | null): string | null {
  const actual = game.notebook.measurements.find(m => m.id === actualId);
  if (!actual) return 'final-proof-missing';
  if (!repairMeasurementCurrent(actual, game)) return 'stale-evidence';
  return canonical(actual) === canonical({ ...expected, id: actualId }) ? null : 'measurement-provenance-mismatch';
}
function objectiveEffects(registry: ContentRegistry, short: 'O11' | 'O12', name: string): StateEffect[] {
  const objective = registry.record(q(short)) as S.objective, alternative = objective.alternatives.find(a => a.id === q(`ACTION-${short}-${name}`));
  return structuredClone([...objective.effects, ...(alternative?.effects ?? [])]) as StateEffect[];
}
/** The reducer applies canonical effects and finalizes one atomic result. No save or animation callback participates. */
export function prepareRepairPlanChange(registry: ContentRegistry, resolver: RepairScenarioResolver | undefined, game: GameState, operation: RepairPlanOperation): RepairPreparation {
  if (!configured(registry)) return { ok: false, reason: 'content-error' };
  if (!validRepairOperation(operation)) return { ok: false, reason: 'invalid-input' };
  const unchanged = (evaluation: RepairEvaluation, activity?: ActivityState): RepairPreparation => ({ ok: true, evaluation,
    finalize: candidate => ({ ok: true, game: candidate, ...(activity ? { activity } : {}) }) });
  const fail = (reason: string) => unchanged(decision('incorrect', reason));
  const has = (id: string) => game.notebook.factIds.includes(q(id) as FactId);
  const o11 = registry.record(q('O11')) as S.objective, o12 = registry.record(q('O12')) as S.objective;
  if (o11.contentVersion !== game.contentVersion || o12.contentVersion !== game.contentVersion) return { ok: false, reason: 'content-error' };
  if (operation.kind === 'choose') {
    const name = operation.actionId.replace('spec001:ACTION-repair-', '');
    if (!contracts.has(name) || name.startsWith('execute-') || name.startsWith('classify-')) return { ok: false, reason: 'invalid-input' };
    if (game.world.roomId !== q(name === 'read-classification' ? 'R12' : 'R11') || !game.world.completedObjectiveIds.includes(q('O02'))
      || (name !== 'read-classification' && game.world.completedObjectiveIds.includes(q('O11')))) return { ok: false, reason: 'precondition' };
    return unchanged(decision('correct', 'repair-choice-recorded', effects(name)));
  }
  const atRift = operation.kind === 'review' || operation.kind === 'execute';
  if (game.world.roomId !== q(atRift ? 'R11' : 'R12')) return { ok: false, reason: 'precondition' };
  if (game.world.completedObjectiveIds.includes(q(atRift ? 'O11' : 'O12'))) return unchanged(decision('correct', 'repair-already-complete'));
  const planValue = game.world.flags[atRift ? repairFlags.selected : repairFlags.executed];
  const plan = repairPlans.find(p => p.id === planValue), duration = plan ? repairMeasurementDuration(plan.id, game.world) : null;
  if (!plan || duration === null) return { ok: false, reason: 'invalid-input' };
  const objective = atRift ? o11 : o12, alternative = atRift ? o11.alternatives.find(a => a.id === q(`ACTION-O11-${plan.route ?? 'shutdown'}`)) : null;
  if (!conditionSatisfied(objective.prerequisite, game.world) || (alternative && !conditionSatisfied(alternative.condition, game.world))) return fail('prerequisite-unmet');
  if (!atRift && (!has('FACT-O11-execution') || (plan.route !== null && game.world.route !== plan.route))) return fail('intervention-record-missing');
  const scenario = resolver?.(game, plan.id);
  if (!scenario) return { ok: false, reason: 'content-error' };
  const checked = physical(registry, game, plan.id, scenario, !atRift);
  if (checked.evaluation.status === 'content-error' || checked.evaluation.status === 'invalid-input') return { ok: false, reason: checked.evaluation.status };
  const endpoint: Proof = { evaluation: decision(scenario.endpointResponse === 'service-acknowledged' ? 'correct' : 'incorrect', scenario.endpointResponse === 'service-acknowledged' ? 'endpoint-service-acknowledged' : 'endpoint-service-unresolved'),
    readings: [{ name: 'Endpoint service acknowledged', value: scenario.endpointResponse === 'service-acknowledged' ? 1 : 0, unit: 'count' } as Reading] };
  if (operation.kind === 'review' || operation.kind === 'measure-link' || operation.kind === 'test-endpoint') {
    if (!atRift && plan.id === 'shutdown') return fail('service-deliberately-isolated');
    if (game.notebook.measurements.length >= 512 || game.notebook.measurements.some(m => m.id === operation.id)) return { ok: false, reason: 'invalid-input' };
    const proof = operation.kind === 'test-endpoint' ? endpoint : checked;
    const measurement = record(game, plan.id, duration, operation.kind === 'review' ? 'review' : operation.kind === 'measure-link' ? 'link' : 'endpoint', proof, operation.id);
    return { ok: true, evaluation: { ...proof.evaluation, observations: [...proof.evaluation.observations, { kind: 'repair-measurement', measurement }] },
      finalize: candidate => !repairMeasurementCurrent(measurement, candidate) ? { ok: false, reason: 'stale-version' }
        : { ok: true, game: { ...candidate, notebook: { ...candidate.notebook, measurements: [...candidate.notebook.measurements, measurement] } } } };
  }
  if (operation.kind === 'execute') {
    const mismatch = canonicalProof(game, record(game, plan.id, duration, 'review', checked, operation.reviewId), operation.reviewId);
    if (mismatch) return fail(mismatch);
    if (!has('FACT-O11-plan')) return fail('plan-record-missing');
    if (!operation.warningAcknowledged) return fail('warning-not-acknowledged');
    if (checked.evaluation.status !== 'correct') return unchanged(checked.evaluation);
    if (plan.id === 'shutdown' && (!has('FACT-repair-isolation') || !scenario.deployment.unresolvedDefectIdentified || !scenario.deployment.deliberateIsolation)) return fail('isolation-record-missing');
    if (plan.id !== 'shutdown' && duration === 'temporary' && (!has('FACT-repair-maintenance') || !scenario.deployment.temporaryDependency)) return fail('temporary-followup-missing');
    return unchanged(decision('correct', 'intervention-executed', [...objectiveEffects(registry, 'O11', plan.route ?? 'shutdown'), ...effects(`execute-${plan.id}`)],
      [{ kind: 'intervention', plan: plan.id, temporaryDependency: duration === 'temporary', restoredService: false, finalValidationRequired: true }]));
  }
  if (!has('FACT-O12-classification')) return fail('classification-context-missing');
  if (operation.selection === 'shutdown') {
    if (plan.id !== 'shutdown' || !has('FACT-repair-isolation') || !scenario.deployment.unresolvedDefectIdentified || !scenario.deployment.deliberateIsolation) return fail('shutdown-not-deliberate');
    return unchanged(decision('correct', 'unresolved-isolation-recorded', [...objectiveEffects(registry, 'O12', 'shutdown'), ...effects('classify-shutdown')],
      [{ kind: 'service-classification', classification: 'E03', restoredService: false }]), { kind: 'shutdown' });
  }
  if (plan.id === 'shutdown') return fail('service-deliberately-isolated');
  if (operation.selection === 'permanent' && (duration === 'temporary' || scenario.deployment.temporaryDependency)) return fail('temporary-is-not-permanent');
  if (operation.selection === 'permanent' && !scenario.deployment.defectRemoved) return fail('defect-not-removed');
  if (operation.selection === 'temporary' && (duration !== 'temporary' || !scenario.deployment.temporaryDependency || !has('FACT-repair-maintenance'))) return fail('temporary-followup-missing');
  for (const [kind, proof, id] of [['link', checked, operation.linkId], ['endpoint', endpoint, operation.endpointId]] as const) {
    const mismatch = canonicalProof(game, record(game, plan.id, duration, kind, proof, id ?? '00000000-0000-4000-8000-000000000000' as MeasurementId), id);
    if (mismatch) return fail(mismatch);
  }
  if (checked.evaluation.status !== 'correct') return unchanged(checked.evaluation);
  if (endpoint.evaluation.status !== 'correct') return unchanged(endpoint.evaluation);
  return unchanged(decision('correct', 'restoration-validated', [...objectiveEffects(registry, 'O12', operation.selection), ...effects(`classify-${operation.selection}`)],
    [{ kind: 'service-classification', classification: operation.selection === 'permanent' ? 'E01' : 'E02', restoredService: true,
      permanentRepair: operation.selection === 'permanent', assistanceRecorded: game.assistance.length > 0, assistanceDowngradesEnding: false }]));
}

/**
 * Read-only inspection of an actually executed current route. This shares the
 * exact apprentice physical/common-preparation checks, without notebook proof,
 * endpoint inference, effect application or classification finalization.
 */
export function inspectExecutedRepair(registry: ContentRegistry, game: GameState, scenario: RepairScenario | null): Proof {
  try {
    if (!configured(registry)) return { evaluation: error('configuration'), readings: [] };
    const o11 = registry.record(q('O11')), o12 = registry.record(q('O12'));
    if (o11?.kind !== 'objective' || o12?.kind !== 'objective' || o11.contentVersion !== game.contentVersion
      || o12.contentVersion !== game.contentVersion || !scenario) return { evaluation: error('executed-scenario'), readings: [] };
    const plan = repairPlans.find(p => p.id === game.world.flags[repairFlags.executed]);
    if (!plan || game.world.roomId !== q('R12') || !game.world.completedObjectiveIds.includes(q('O11'))
      || !game.notebook.factIds.includes(q('FACT-O11-execution')) || game.world.flags[repairFlags.selected] !== plan.id
      || repairMeasurementDuration(plan.id, game.world) === null || (plan.route !== null && game.world.route !== plan.route)
      || !conditionSatisfied(o11.prerequisite, game.world)) return { evaluation: invalidInput('executed-repair-required'), readings: [] };
    const proof = physical(registry, game, plan.id, scenario, false);
    if (proof.evaluation.status === 'content-error' || proof.evaluation.status === 'invalid-input' || plan.id !== 'shutdown') return proof;
    // Reviewing deliberate isolation is a valid plan, but it never transmits a
    // packet. Retain its observed installation readings without inventing bits.
    return { ...proof, evaluation: decision('incorrect', 'service-deliberately-isolated', [], proof.evaluation.observations) };
  } catch { return { evaluation: error('executed-scenario'), readings: [] }; }
}
