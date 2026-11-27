// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import { isRecord } from '../domain/evaluate';
import { comparePacketPattern, decodeToySamples, encodePacketPayload, encodeToyBits } from '../domain/packet-journey';
import type { JourneyObservation, JourneyPhase, PacketJourneyInput, PacketProfile, PacketResult, ToySymbolProfile } from '../domain/packet-journey';
import type { DomainAction, QualifiedId, Reading, Route, WorldVersion } from '../domain/types';
import { inspectExecutedRepair, repairFlags, repairPlans } from './repair-plan';
import type { RepairPlanId, RepairScenarioResolver } from './repair-plan';
import type { GameState } from './types';

/** An opaque trusted source. Copying the label never grants inspection authority. */
export interface RepairPacketSource { readonly kind: 'executed-repair-packet-source' }
interface Source { readonly registry: ContentRegistry; readonly resolveScenario: RepairScenarioResolver; readonly game: GameState }
const sources = new WeakMap<RepairPacketSource, Source>();
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const phases: readonly JourneyPhase[] = ['payload', 'encode', 'transmit', 'decode', 'compare'];
const scope = { wholeFrameIsTwoBytes: false, universalPHYErrorDetection: false, ethernetFcsValidated: false,
  higherLayerServiceProven: false, wholeRouteProven: false, frameContext: 'highlighted bytes inside an opaque upper-interface frame',
  progressAward: 0, attemptPenalty: 0 } as const;
export interface RepairJourneyObservation extends Omit<JourneyObservation, 'kind' | 'physicalObservation'> {
  readonly kind: 'repair-packet-journey'; readonly planId: RepairPlanId; readonly route: Route | null;
  readonly physicalReadings: readonly Reading[]; readonly physicalObservations: readonly unknown[];
  /** A separate supplied cross-layer response, never inferred from matching bits. */
  readonly endpointResponse: 'service-acknowledged' | 'service-unavailable' | null;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && Object.keys(value).every(k => keys.includes(k));
const version = (w: WorldVersion): WorldVersion => ({ configurationRevision: w.configurationRevision, attemptId: w.attemptId });
const validVersion = (v: unknown): v is WorldVersion => isRecord(v) && Number.isSafeInteger(v['configurationRevision'])
  && (v['configurationRevision'] as number) >= 0 && typeof v['attemptId'] === 'string' && v['attemptId'].trim().length > 0 && v['attemptId'].length <= 160;
const same = (a: WorldVersion, b: WorldVersion) => a.configurationRevision === b.configurationRevision && a.attemptId === b.attemptId;
const failure = (reason: string, status: 'content-error' | 'invalid-input' = 'content-error'): PacketResult<RepairJourneyObservation> => freeze({
  status, reasonCode: reason, acceptedEffects: [], observations: [{ kind: 'packet-error', reason, field: 'repair-packet',
    progressAward: 0, attemptPenalty: 0, transmissionSucceeded: false, recoveredBits: null, knownPatternMatches: null }],
});

/** The activity adapter supplies actual immutable state, never a result/verdict. */
export function createRepairPacketSource(options: Source): RepairPacketSource {
  const token = Object.freeze({ kind: 'executed-repair-packet-source' as const });
  // The resolver sees a detached frozen game. It cannot mutate live state and a
  // later caller mutation cannot rewrite the captured source version.
  sources.set(token, { registry: options.registry, resolveScenario: options.resolveScenario, game: freeze(structuredClone(options.game)) });
  return token;
}

/**
 * Inspect the real executed repair at every checkpoint. Existing physical,
 * preparation, symbol and packet rules own all arithmetic and correctness.
 * No measurement, outcome, reward, state mutation, service write or timer.
 */
export function inspectRepairPacketJourney(source: RepairPacketSource, action: DomainAction<PacketJourneyInput>, world: WorldVersion): PacketResult<RepairJourneyObservation> {
  const bound = sources.get(source); if (!bound) return failure('unknown-repair-source', 'invalid-input');
  const { registry, resolveScenario, game } = bound;
  const plan = repairPlans.find(p => p.id === game.world.flags[repairFlags.executed]);
  if (!plan || game.world.roomId !== q('R12') || !game.world.completedObjectiveIds.includes(q('O11'))
    || !game.notebook.factIds.includes(q('FACT-O11-execution')) || game.world.flags[repairFlags.selected] !== plan.id
    || (plan.route !== null && game.world.route !== plan.route)) return failure('executed-repair-required', 'invalid-input');
  try {
    const scenario = resolveScenario(game, plan.id);
    if (!scenario) return failure('repair-content-error');
    const inspected = inspectExecutedRepair(registry, game, scenario);
    if (inspected.evaluation.status === 'content-error') return failure('repair-content-error');
    const packet = registry.record('spec001:PROFILE-PACKET'), symbols = registry.record('spec001:PROFILE-SYMBOLS');
    if (packet?.kind !== 'profile' || symbols?.kind !== 'profile' || packet.reviewedProfileId !== packet.id || symbols.reviewedProfileId !== symbols.id
      || packet.contentVersion !== game.contentVersion || symbols.contentVersion !== game.contentVersion
      || !packet.ruleIds.includes('spec001:PHY11') || !symbols.ruleIds.includes('spec001:PHY10')) return failure('repair-profile-content');
    const packetProfile = { id: packet.id, parameters: packet.parameters } as PacketProfile;
    const symbolProfile = { id: symbols.id, parameters: symbols.parameters } as ToySymbolProfile;
    const encoding = encodePacketPayload(packetProfile, symbolProfile), encoded = encoding.observations[0];
    if (encoding.status !== 'correct' || encoded?.kind !== 'packet-encoding') return failure('repair-profile-content');
    // Validate the supplied trace even when current physics prevents reception;
    // malformed authored data is never relabeled as a learner mistake.
    const comparison = comparePacketPattern({ profile: packetProfile, expectedBits: packetProfile.parameters.highlightedBits, recoveredBits: scenario.receivedBits },
      { actionId: 'repair-packet-receiver-check' as DomainAction<PacketJourneyInput>['actionId'], expectedVersion: version(game.world), input: { claim: 'known-pattern-matches' } }, game.world);
    if (comparison.status === 'content-error') return failure('repair-receiver-content');
    if (comparison.status === 'invalid-input') return failure(comparison.reasonCode, 'invalid-input');
    const compared = comparison.observations[0];
    if (compared?.kind !== 'packet-comparison') return failure('repair-receiver-content');
    // Keep the original packet contract's authoring-error precedence. Source
    // validation above never applies effects or borrows a caller's verdict.
    if (!isRecord(action) || typeof action.actionId !== 'string' || !action.actionId.trim() || action.actionId.length > 160
      || !validVersion(action.expectedVersion) || !validVersion(world)) return failure('malformed-action-envelope', 'invalid-input');
    if (!same(action.expectedVersion, world)) return failure('stale-action', 'invalid-input');
    if (!same(game.world, world)) return failure('stale-repair-source', 'invalid-input');
    if (!isRecord(action.input) || !exact(action.input, ['kind', 'phase']) || action.input.kind !== 'inspect' || !phases.includes(action.input.phase)) return failure('malformed-journey-action', 'invalid-input');
    if (inspected.evaluation.status === 'invalid-input') return failure(inspected.evaluation.reasonCode, 'invalid-input');
    const isolated = plan.id === 'shutdown';
    const usable = !isolated && inspected.evaluation.status === 'correct';
    let recovered = null as ReturnType<typeof encodeToyBits>['observations'][number] | null;
    if (usable) {
      const received = encodeToyBits(symbolProfile, scenario.receivedBits); recovered = received.observations[0] ?? null;
      if (received.status !== 'correct' || recovered?.kind !== 'toy-trace') return failure('repair-receiver-content');
      // Decode the supplied toy samples through the accepted inverse, rather
      // than treating the already written bit string as decoder authority.
      const decoded = decodeToySamples(symbolProfile, recovered.samples);
      const trace = decoded.observations[0];
      if (decoded.status !== 'correct' || trace?.kind !== 'toy-trace' || trace.bits !== scenario.receivedBits) return failure('repair-receiver-content');
    }
    const phase = action.input.phase, checkpoint = phases.indexOf(phase);
    const physicalStatus = usable ? 'correct' : 'incorrect';
    const status = usable && compared.knownPatternMatches ? 'correct' : 'incorrect';
    const reasonCode = isolated ? 'service-deliberately-isolated' : !usable ? 'physical-path-failed'
      : compared.knownPatternMatches ? 'laboratory-transmission-valid' : 'known-pattern-differs';
    const observation: RepairJourneyObservation = {
      kind: 'repair-packet-journey', ...scope, phase, version: version(world), planId: plan.id, route: plan.route,
      physicalStatus, physicalReasonCode: isolated ? 'service-deliberately-isolated' : inspected.evaluation.reasonCode,
      physicalReadings: structuredClone(inspected.readings), physicalObservations: structuredClone(inspected.evaluation.observations),
      endpointResponse: isolated ? null : scenario.endpointResponse,
      payloadHex: [...packetProfile.parameters.payloadHex], encoded: checkpoint >= 1 ? encoded : null,
      recoveredSymbolValues: checkpoint >= 2 && recovered?.kind === 'toy-trace' ? recovered.symbolValues : null,
      recoveredBits: checkpoint >= 3 && recovered?.kind === 'toy-trace' ? recovered.bits : null,
      knownPatternMatches: checkpoint >= 4 && usable ? compared.knownPatternMatches : null,
      differingBits: checkpoint >= 4 && usable ? compared.differingBits : null,
      comparison: checkpoint >= 4 && usable ? compared : null,
      transmissionSucceeded: phase === 'compare' && usable && compared.knownPatternMatches,
      impairmentApplied: checkpoint >= 2 && usable && !compared.knownPatternMatches,
    };
    return freeze({ status, reasonCode, observations: [observation], acceptedEffects: [] });
  } catch { return failure('repair-content-error'); }
}
