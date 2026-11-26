// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type { world as WorldDocument } from '../content/schema-types.generated';
import { createSaveContentPolicy, type SavePolicyRules } from '../services/save-validator';

/**
 * Reviewed current authored rules, not the synthetic validator fixture. Kit quantity is
 * explicit in items-introduction.json (ITEM-inspection-kit, canonical EFFECT-kit once).
 * PHY04 readings/conclusions mirror notebook.ts/evaluateCopper and T006 S03/model cases
 * T01/T02/B-COPPER-100/B-COPPER-OVER. They check representation, not regrade history.
 * Current content has no authored shutdown/encounter marker; none is invented here.
 * Only actual authored anchors can grant a safe state. Metadata R03–R12 stays reserved.
 */
export const introductionSaveRules: SavePolicyRules = {
  itemMaxQuantities: { 'spec001:ITEM-inspection-kit': 1 },
  measurementRules: { 'spec001:PHY04': {
    readings: { 'Channel length': 'm', 'Inclusive maximum': 'm', Excess: 'm', Headroom: 'm' },
    conclusionCodes: ['length-exceeded', 'length-within-profile'],
  } },
  unsafeFlags: {},
};

export function introductionSavePolicy(registry: ContentRegistry, world: Readonly<WorldDocument>) {
  return createSaveContentPolicy(registry, world, introductionSaveRules);
}
