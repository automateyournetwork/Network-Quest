// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

/**
 * Compile-time distinctions only. Content/save validation must establish these
 * brands; a type assertion is not validation. IDs and quantities remain JSON
 * strings/numbers, with no wrapper objects or extra serialized properties.
 */
declare const nominal: unique symbol;
export type Opaque<Value, Kind extends string> = Value & {
  readonly [nominal]: Kind;
};

/** Full syntax, length and registry membership are checked at the content boundary. */
export type QualifiedId<Kind extends string = string> = Opaque<
  `spec${number}:${string}`,
  `content:${Kind}`
>;
export type RoomId = QualifiedId<'room'>;
export type SafePositionId = QualifiedId<'safe-position'>;
export type ObjectiveId = QualifiedId<'objective'>;
export type QuestId = QualifiedId<'quest'>;
export type MinigameId = QualifiedId<'minigame'>;
export type CharacterId = QualifiedId<'character'>;
export type PropId = QualifiedId<'prop'>;
export type ItemId = QualifiedId<'item'>;
export type AbilityId = QualifiedId<'ability'>;
export type AchievementId = QualifiedId<'achievement'>;
export type CompendiumId = QualifiedId<'compendium'>;
export type DialogueNodeId = QualifiedId<'dialogue-node'>;
export type DialogueEffectId = QualifiedId<'dialogue-effect'>;
export type FlagId = QualifiedId<'flag'>;
export type FactId = QualifiedId<'fact'>;
export type HintId = QualifiedId<'hint'>;
export type CaveatId = QualifiedId<'caveat'>;
export type RuleId = QualifiedId<'rule'>;
export type ProfileId = QualifiedId<'profile'>;
export type SourceId = QualifiedId<'source'>;
export type AssetId = QualifiedId<'asset'>;

/** Runtime identity is separate from semantic content identity. */
export type InstanceId = Opaque<string, 'instance-id'>;
export type AdventureId = Opaque<string, 'adventure-uuid'>;
export type AttemptId = Opaque<string, 'attempt-uuid'>;
export type MeasurementId = Opaque<string, 'measurement-uuid'>;
export type HypothesisId = Opaque<string, 'hypothesis-uuid'>;
export type OutcomeEventId = Opaque<string, 'outcome-event-uuid'>;
export type ActionId = Opaque<string, 'action-id'>;
export type EffectId = Opaque<string, 'effect-id'>;
export type ContentVersion = Opaque<`${number}.${number}.${number}`, 'content-version'>;

/** Local freshness counter, never a server save revision or a wall-clock time. */
export type ConfigurationRevision = Opaque<number, 'configuration-revision'>;
export interface WorldVersion {
  readonly configurationRevision: ConfigurationRevision;
  readonly attemptId: AttemptId;
}

/** The exact ten unit labels accepted by save v1. */
export type Unit = 'dBm' | 'dB' | 'm' | 'W' | 'bit' | 'symbol' | 'Mbps' | 'Hz' | 's' | 'count';
export type Quantity<U extends Unit> = Opaque<number, `quantity:${U}`>;
export type DecibelMilliwatts = Quantity<'dBm'>;
export type Decibels = Quantity<'dB'>;
export type Metres = Quantity<'m'>;
export type Watts = Quantity<'W'>;
export type Bits = Quantity<'bit'>;
export type Symbols = Quantity<'symbol'>;
export type MegabitsPerSecond = Quantity<'Mbps'>;
export type Hertz = Quantity<'Hz'>;
export type Seconds = Quantity<'s'>;
export type Count = Quantity<'count'>;

/** A discriminated union keeps the value's brand paired with its wire unit. */
export type Reading = {
  [U in Unit]: {
    readonly name: string;
    readonly value: Quantity<U>;
    readonly unit: U;
  };
}[Unit];

export type Route = 'copper' | 'fiber' | 'radio';
export type Outcome = 'E01' | 'E02' | 'E03';
export type ContinueOutcome = Exclude<Outcome, 'E03'>;
export type Verb = 'walk' | 'look' | 'talk' | 'use';

/** Reducers recheck both versions before applying a result, including on replay. */
export interface DomainAction<Input> {
  readonly actionId: ActionId;
  readonly expectedVersion: WorldVersion;
  readonly input: Input;
}

/** Concrete effects are defined alongside the reducer, with stable identities. */
export interface IdentifiedEffect {
  readonly effectId: EffectId;
}

export type EvaluationStatus = 'correct' | 'incorrect' | 'invalid-input' | 'content-error';

interface EvaluationFeedback<Observation> {
  readonly reasonCode: string;
  readonly observations: readonly Observation[];
}

/**
 * Incorrect actions may have explained consequences. Invalid actions and broken
 * authored content cannot award progress, consume items or penalize the learner.
 */
export type EvaluationResult<Observation, Effect extends IdentifiedEffect> = {
  [Status in EvaluationStatus]: EvaluationFeedback<Observation> & {
    readonly status: Status;
    readonly acceptedEffects: Status extends 'correct' | 'incorrect' ? readonly Effect[] : readonly [];
  };
}[EvaluationStatus];

/**
 * Pure, synchronous rule boundary: no DOM, audio, auth, network or persistence.
 * Challenge/action validation and independent expected cases precede algorithms.
 * RelevantWorld is the smallest readonly state view needed by a specific rule.
 */
export interface Evaluator<
  Challenge,
  Input,
  RelevantWorld extends WorldVersion,
  Observation,
  Effect extends IdentifiedEffect,
> {
  (
    challenge: Challenge,
    action: DomainAction<Input>,
    relevantWorld: RelevantWorld,
  ): EvaluationResult<Observation, Effect>;
}
