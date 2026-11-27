// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import { isRecord } from '../domain/evaluate';
import { evaluateCopper } from '../domain/copper';
import type { CopperProfile } from '../domain/copper';
import { evaluateOptics } from '../domain/optics';
import type { OpticalProfile } from '../domain/optics';
import { evaluateRadio } from '../domain/radio';
import type { RadioProfile } from '../domain/radio';
import { evaluatePower } from '../domain/power';
import type { PowerProfile } from '../domain/power';
import { evaluateCapabilities } from '../domain/capabilities';
import type { CapabilitiesProfile } from '../domain/capabilities';
import type { ActionId, ObjectiveId, QualifiedId } from '../domain/types';
import type { GameState, Measurement } from './types';

const q = (id: string) => `spec001:${id}` as QualifiedId;
const rules: Readonly<Record<string, string>> = { O04: 'PHY04', O05: 'PHY06', O06: 'PHY06', O08: 'PHY07', O09: 'PHY08' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && new Set(a).size === a.length && a.every(id => b.includes(id));

/**
 * Historical learning only. Check the stored provenance and reported arithmetic
 * with the same reviewed profiles/evaluators. No current flags, speculative old
 * world, renderer verdict, repaired state or objective effects are constructed.
 * Some canonical summaries omit predicates; their accepted conclusion remains
 * within the existing validated-save trust boundary, not cryptographic proof.
 */
export function isHistoricalObjectiveMeasurement(registry: ContentRegistry, game: GameState, objectiveId: ObjectiveId, measurement: Measurement,
  status: 'correct' | 'incorrect' = 'correct'): boolean {
  const definition = registry.record(objectiveId), short = objectiveId.slice(8);
  if (definition?.kind !== 'objective' || !rules[short] || !game.notebook.measurements.includes(measurement)
    || !uuid.test(measurement.id) || !uuid.test(measurement.attemptId) || !Number.isSafeInteger(measurement.configurationRevision)
    || measurement.configurationRevision < 0 || measurement.configurationRevision > game.world.configurationRevision
    || measurement.ruleId !== q(rules[short]!) || measurement.roomId !== definition.evidence[0]?.roomId
    || !definition.alternatives.some(a => measurement.conclusionCode === `${short}:${a.id.slice(8)}:${status}`)
    || !sameSet(measurement.subjectIds, [...new Set([definition.id, ...definition.profileIds, ...definition.evidence.flatMap(e => e.subjectIds)])])) return false;
  const shape = (pairs: readonly (readonly [string, string])[]) => measurement.readings.length === pairs.length
    && measurement.readings.every((r, i) => r.name === pairs[i]?.[0] && r.unit === pairs[i]?.[1] && Number.isFinite(r.value));
  const n = (name: string) => measurement.readings.find(r => r.name === name)?.value;
  const bit = (name: string) => n(name) === 0 || n(name) === 1;
  const value = (quantity: unknown) => isRecord(quantity) && typeof quantity['value'] === 'number' ? quantity['value'] : undefined;
  const profile = <T>(id: string): T => {
    const record = registry.record(q(id));
    return (record?.kind === 'profile' && record.reviewedProfileId === record.id ? { id: record.id, parameters: record.parameters } : null) as T;
  };
  const command = <T>(input: T) => ({ actionId: 'historical-readout-check' as ActionId,
    expectedVersion: { attemptId: measurement.attemptId, configurationRevision: measurement.configurationRevision }, input });
  const observations = (rows: readonly unknown[], kind: string) => rows.find(row => isRecord(row) && row['kind'] === kind) as Record<string, unknown> | undefined;
  let accepted = false;
  if (short === 'O04') {
    if (!shape([['Compatible path', 'count'], ['Total channel length', 'm'], ['Inclusive maximum', 'm'], ['Open required conductors', 'count'], ['Historical open recorded', 'count'], ['Repeater role distinguished', 'count']])
      || !bit('Compatible path') || !bit('Historical open recorded') || !bit('Repeater role distinguished')
      || !Number.isInteger(n('Open required conductors')) || n('Open required conductors')! < 0) return false;
    const checked = evaluateCopper({ kind: 'copper-length', profile: profile<CopperProfile>('PROFILE-COPPER-100'),
      lengths: [{ value: n('Total channel length')!, unit: 'm' }] }, command({ kind: 'measure-length' }), measurement);
    const observed = observations(checked.observations, 'copper-length');
    if (!observed || n('Total channel length') !== value(observed['total']) || n('Inclusive maximum') !== value(observed['maximum'])) return false;
    accepted = checked.status === 'correct' && n('Compatible path') === 1 && n('Open required conductors') === 0 && n('Historical open recorded') === 1 && n('Repeater role distinguished') === 1;
  } else if (short === 'O05') {
    // The canonical O05 record stores the accepted aggregate, not the five
    // individual predicates. Runtime practice captures those separately while
    // the real canonical measurement executes; history never invents them.
    if (!shape([['Inspection complete', 'count'], ['Preparation complete', 'count']]) || !bit('Inspection complete') || !bit('Preparation complete')
      || n('Preparation complete')! > n('Inspection complete')!) return false;
    accepted = n('Inspection complete') === 1 && n('Preparation complete') === 1;
  } else if (short === 'O06') {
    if (!shape([['Receive power', 'dBm'], ['Sensitivity reserve', 'dB'], ['Sensitivity', 'dBm'], ['Maximum receive', 'dBm'], ['Required reserve', 'dB'], ['Inspection complete', 'count'], ['Transmit power', 'dBm'], ['Total passive loss', 'dB']]) || !bit('Inspection complete')) return false;
    const optical = profile<OpticalProfile>('PROFILE-OPTICAL');
    const checked = evaluateOptics({ kind: 'optical-passive', profile: optical, compatible: true,
      loss: { value: n('Total passive loss')!, unit: 'dB' }, authoredReceive: { value: n('Receive power')!, unit: 'dBm' } }, command({ kind: 'measure-optics' }), measurement);
    const observed = observations(checked.observations, 'optical-power');
    if (!observed || n('Transmit power') !== optical?.parameters.transmit.value
      || ![['Receive power', 'receive'], ['Sensitivity reserve', 'margin'], ['Sensitivity', 'sensitivity'], ['Maximum receive', 'maximumReceive'], ['Required reserve', 'requiredMargin']].every(([name, key]) => n(name!) === value(observed[key!]))) return false;
    accepted = checked.status === 'correct' && n('Inspection complete') === 1;
  } else if (short === 'O08') {
    if (!shape([['Viable path', 'count'], ['Compatible settings', 'count'], ['Received signal', 'dBm'], ['Received noise', 'dBm'], ['Signal-to-noise ratio', 'dB'], ['Required signal-to-noise ratio', 'dB']]) || !bit('Viable path') || !bit('Compatible settings')) return false;
    const checked = evaluateRadio({ kind: 'radio-link', profile: profile<RadioProfile>('PROFILE-RADIO'), viablePath: n('Viable path') === 1, settingsCompatible: n('Compatible settings') === 1,
      signal: { value: n('Received signal')!, unit: 'dBm' }, noise: { value: n('Received noise')!, unit: 'dBm' } }, command({ kind: 'measure-link' }), measurement);
    const observed = observations(checked.observations, 'radio-link');
    if (!observed || ![['Received signal', 'signal'], ['Received noise', 'noise'], ['Signal-to-noise ratio', 'snr'], ['Required signal-to-noise ratio', 'minimum']].every(([name, key]) => n(name!) === value(observed[key!]))) return false;
    accepted = checked.status === 'correct';
  } else if (short === 'O09') {
    const powerName = measurement.readings[2]?.name;
    if (!['Delivered headroom', 'Delivered excess'].includes(powerName ?? '')
      || !shape([['Delivered budget', 'W'], ['Total delivered demand', 'W'], [powerName!, 'W'], ['Selected common rate', 'Mbps'], ['Selected full duplex', 'count'], ['Common mode supported', 'count']])
      || !bit('Selected full duplex') || !bit('Common mode supported')) return false;
    const power = evaluatePower({ kind: 'delivered-power', profile: profile<PowerProfile>('PROFILE-POWER'), budgetBoundary: 'delivered-after-losses', demandBoundary: 'delivered-after-losses',
      totalDemand: { value: n('Total delivered demand')!, unit: 'W' } }, command({ kind: 'check-allocation' }), measurement);
    const observed = observations(power.observations, 'delivered-power');
    const capability = evaluateCapabilities({ kind: 'common-capabilities', profile: profile<CapabilitiesProfile>('PROFILE-CAPABILITIES'), bothNegotiate: true },
      command({ kind: 'select-capability', selected: { rate: { value: n('Selected common rate')!, unit: 'Mb/s' }, duplex: n('Selected full duplex') === 1 ? 'full' : 'half' } }), measurement);
    if (!observed || n('Delivered budget') !== value(observed['budget']) || n('Total delivered demand') !== value(observed['total'])
      || n(powerName!) !== value(observed[powerName === 'Delivered headroom' ? 'headroom' : 'excess'])
      || !['correct', 'incorrect'].includes(capability.status) || n('Common mode supported') !== (capability.status === 'correct' ? 1 : 0)) return false;
    accepted = power.status === 'correct' && capability.status === 'correct';
  }
  return accepted === (status === 'correct');
}
