// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type { world as WorldDocument } from '../content/schema-types.generated';
import { createSaveContentPolicy, type SavePolicyRules } from '../services/save-validator';
import { repairFlags } from '../state/repair-plan';

/**
 * Reviewed current authored rules, not the synthetic validator fixture. Kit quantity is
 * explicit in items-introduction.json (ITEM-inspection-kit, canonical EFFECT-kit once).
 * PHY04 readings/conclusions mirror notebook.ts/evaluateCopper and T006 S03/model cases
 * T01/T02/B-COPPER-100/B-COPPER-OVER. They check representation, not regrade history.
 * Route measurements use the exact canonical reading names and persisted units
 * emitted by accepted objective/repair adapters. Only loaded anchors are safe.
 */
const objectiveCodes = (objective: string, alternatives: readonly string[]) => alternatives.flatMap(alternative =>
  ['correct', 'incorrect'].map(status => `${objective}:ACTION-${objective}-${alternative}:${status}`));
const routePlans = ['copper-section', 'copper-alternate', 'fiber-A', 'fiber-B', 'radio-A', 'radio-B'] as const;
const repairCodes = (kind: string, plans: readonly string[]) => plans.flatMap(plan => ['permanent', 'temporary'].flatMap(duration =>
  ['correct', 'incorrect'].map(status => `repair:${kind}:${plan}:${duration}:${status}`)));
const repairReadings = {
  'Damaged installation removed': 'count', 'Temporary dependency remains': 'count', 'Unresolved defect identified': 'count', 'Deliberate isolation': 'count',
  'Total channel length': 'm', 'Inclusive maximum': 'm', 'Current route checks pass': 'count', 'Current equipment and calibration pass': 'count',
  'Receive power': 'dBm', 'Sensitivity reserve': 'dB', 'Received signal': 'dBm', 'Received noise': 'dBm', 'Signal-to-noise ratio': 'dB',
};
export const introductionSaveRules: SavePolicyRules = {
  itemMaxQuantities: { 'spec001:ITEM-inspection-kit': 1 },
  measurementRules: { 'spec001:PHY04': {
    readings: { 'Channel length': 'm', 'Inclusive maximum': 'm', Excess: 'm', Headroom: 'm',
      'Compatible path': 'count', 'Total channel length': 'm', 'Open required conductors': 'count', 'Historical open recorded': 'count', 'Repeater role distinguished': 'count' },
    conclusionCodes: ['length-exceeded', 'length-within-profile', ...objectiveCodes('O03', ['section-replacement', 'alternate-passive-path']), ...objectiveCodes('O04', ['conventional-continuity-tool'])],
  }, 'spec001:PHY06': {
    readings: { 'Inspection complete': 'count', 'Preparation complete': 'count', 'Receive power': 'dBm', 'Sensitivity reserve': 'dB',
      Sensitivity: 'dBm', 'Maximum receive': 'dBm', 'Required reserve': 'dB', 'Transmit power': 'dBm', 'Total passive loss': 'dB' },
    conclusionCodes: [...objectiveCodes('O05', ['inspected-connector-cleaning', 'inspected-connector-replacement']), ...objectiveCodes('O06', ['passive-path-A', 'passive-path-B'])],
  }, 'spec001:PHY07': {
    readings: { 'Viable path': 'count', 'Compatible settings': 'count', 'Received signal': 'dBm', 'Received noise': 'dBm',
      'Signal-to-noise ratio': 'dB', 'Required signal-to-noise ratio': 'dB' },
    conclusionCodes: [...objectiveCodes('O07', ['align-existing-path', 'choose-alternate-path']), ...objectiveCodes('O08', ['scenario-channel-A', 'scenario-channel-B'])],
  }, 'spec001:PHY08': {
    readings: { 'Delivered budget': 'W', 'Total delivered demand': 'W', 'Delivered headroom': 'W', 'Delivered excess': 'W',
      'Selected common rate': 'Mbps', 'Selected full duplex': 'count', 'Common mode supported': 'count' },
    conclusionCodes: objectiveCodes('O09', ['compatible-kit-A', 'compatible-kit-B']),
  }, 'spec001:PHY10': {
    readings: { 'Represented bits': 'bit', 'Symbols decoded': 'symbol', 'Decoded pattern matches': 'count', 'Selected common rate': 'Mbps',
      'Selected full duplex': 'count', 'Common mode supported': 'count', 'Physical role distinguished': 'count' },
    conclusionCodes: objectiveCodes('O10', ['step-and-decode', 'notebook-and-replay']),
  }, 'spec001:STATE04': {
    readings: { ...repairReadings, 'Deliberate isolation proposed': 'count', 'Endpoint service acknowledged': 'count' },
    conclusionCodes: [...repairCodes('review', [...routePlans, 'shutdown']), ...repairCodes('endpoint', routePlans)],
  }, 'spec001:PHY11': {
    readings: { ...repairReadings, 'Recovered highlighted bits': 'bit', 'Differing highlighted positions': 'count' },
    conclusionCodes: repairCodes('link', routePlans),
  } },
  unsafeFlags: { [repairFlags.executed]: ['shutdown'], [repairFlags.classification]: ['shutdown'] },
};

export function introductionSavePolicy(registry: ContentRegistry, world: Readonly<WorldDocument>) {
  return createSaveContentPolicy(registry, world, introductionSaveRules);
}
