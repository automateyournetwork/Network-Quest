// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// T094 PROPOSAL ONLY. No production import or runtime effect implementation.
import type { AbilityId, CharacterId, MeasurementId, ObjectiveId, QualifiedId } from '../../../../src/domain/types';

/** IDs/intent only. No renderer-provided score, verdict, profile or effects. */
export type ProposedPartyIntent =
  | { readonly kind: 'invite-ally'; readonly characterId: CharacterId; readonly demonstrationId: string }
  | { readonly kind: 'review-ally'; readonly characterId: CharacterId }
  | { readonly kind: 'advance-ally'; readonly characterId: CharacterId; readonly demonstrationId: string }
  | { readonly kind: 'set-active-allies'; readonly characterIds: readonly CharacterId[] }
  | { readonly kind: 'use-ally-ability'; readonly characterId: CharacterId; readonly abilityId: AbilityId; readonly conventionalActionId: QualifiedId };

/**
 * Private controller result, NEVER renderer input or a persisted event ledger.
 * The factory must own opaque identity, exact store state and version checks.
 * An accepted objective is not itself proof: already-complete submit short-
 * circuits and can acknowledge an absent measurement. The bound measurement
 * must be checked independently against the canonical scenario/evaluator.
 */
export interface ProposedDemonstrationView {
  readonly id: string;
  readonly characterId: CharacterId;
  readonly purpose: 'recruitment' | 'progression';
  readonly objectiveId: ObjectiveId;
  readonly measurementId: MeasurementId;
  readonly comparisonMeasurementIds: readonly MeasurementId[];
  readonly evidenceStatus: 'current' | 'historical-learning-only';
  readonly explanation: string;
}

/** Present only actual current canonical controls; preserve optionality. */
export interface ProposedAbilityView {
  readonly characterId: CharacterId;
  readonly abilityId: AbilityId;
  readonly label: string;
  readonly limitation: string;
  readonly available: boolean;
  readonly reason: string | null;
  readonly equivalentActions: readonly {
    readonly actionId: QualifiedId;
    readonly label: string;
    readonly available: boolean;
  }[];
}
