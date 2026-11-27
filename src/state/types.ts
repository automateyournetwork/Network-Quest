// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type {
  AbilityId,
  AchievementId,
  AdventureId,
  AttemptId,
  CaveatId,
  CharacterId,
  CompendiumId,
  ContentVersion,
  ContinueOutcome,
  DialogueEffectId,
  FactId,
  FlagId,
  HintId,
  HypothesisId,
  InstanceId,
  ItemId,
  MeasurementId,
  ObjectiveId,
  Opaque,
  Outcome,
  OutcomeEventId,
  QualifiedId,
  QuestId,
  Reading,
  RoomId,
  Route,
  RuleId,
  SafePositionId,
  Verb,
  WorldVersion,
} from '../domain/types';

/**
 * Save v1's TypeScript projection, not a second validation schema. The authority
 * is specs/001-physical-layer-underworld/contracts/save.schema.json plus registry
 * and semantic validation. Numeric/collection/text bounds, UTF-8, unique IDs,
 * membership, safe positions, freshness and eligibility require runtime checks.
 */
export interface SafePosition {
  readonly safePositionId: SafePositionId;
}

export interface InventoryEntry {
  readonly itemId: ItemId;
  readonly quantity: number;
}

export interface RecruitProgress {
  readonly characterId: CharacterId;
  readonly level: number;
  readonly abilityIds: readonly AbilityId[];
  readonly progressFlags: readonly FlagId[];
}

export type ActiveAllies = readonly [] | readonly [CharacterId] | readonly [CharacterId, CharacterId];
export type FlagValue = boolean | number | string;

/** Reversible preparation, including inventory, rewards and completion flags. */
export interface WorldState extends WorldVersion {
  readonly roomId: RoomId;
  readonly position: SafePosition;
  readonly flags: Readonly<Record<FlagId, FlagValue>>;
  readonly completedObjectiveIds: readonly ObjectiveId[];
  readonly completedQuestIds: readonly QuestId[];
  readonly achievementIds: readonly AchievementId[];
  readonly dialogueEffectIds: readonly DialogueEffectId[];
  readonly inventory: readonly InventoryEntry[];
  readonly recruits: readonly RecruitProgress[];
  readonly activeAllyIds: ActiveAllies;
  readonly compendiumIds: readonly CompendiumId[];
  readonly route: Route | null;
  readonly continueOutcome: ContinueOutcome | null;
}

export interface Hypothesis {
  readonly id: HypothesisId;
  readonly text: string;
  readonly subjectIds: readonly QualifiedId[];
  readonly status: 'open' | 'supported' | 'rejected';
}

/** Usable only when both versions match the current world AND stale is false. */
export interface Measurement extends WorldVersion {
  readonly id: MeasurementId;
  readonly ruleId: RuleId;
  readonly subjectIds: readonly QualifiedId[];
  readonly roomId: RoomId;
  readonly stale: boolean;
  readonly readings: readonly Reading[];
  readonly conclusionCode: string;
}

export interface NotebookState {
  readonly factIds: readonly FactId[];
  readonly mapRoomIds: readonly RoomId[];
  readonly personalNotes: string;
  readonly hypotheses: readonly Hypothesis[];
  readonly measurements: readonly Measurement[];
}

export type HintLevel = 1 | 2 | 3;
export interface HintUse {
  readonly objectiveId: ObjectiveId;
  readonly hintId: HintId;
  readonly level: HintLevel;
  readonly attemptId: AttemptId;
}

export interface OutcomeEvent {
  readonly id: OutcomeEventId;
  readonly outcome: Outcome;
  readonly attemptId: AttemptId;
  readonly route: Route | null;
  readonly caveatIds: readonly CaveatId[];
}

/**
 * Retained on Retry/E03 Continue, including hints used in a failed attempt.
 * Restore Save replaces this journal with the journal in that same snapshot.
 * Outcome history explains past attempts; it never independently grants rewards.
 */
export interface LearningJournal {
  readonly notebook: NotebookState;
  readonly assistance: readonly HintUse[];
  readonly outcomeHistory: readonly OutcomeEvent[];
}

/** Durable candidate only: no account, server revision/time, checkpoint or UI. */
export interface GameState extends LearningJournal {
  readonly contentVersion: ContentVersion;
  readonly episodeId: 'spec001';
  readonly adventureId: AdventureId;
  readonly world: WorldState;
}

export type SafeState = 'stable-exploration' | 'safe-preparation' | 'safe-continue';

/**
 * The sole writable adventure payload. Construct explicitly from a validated
 * safe boundary; do not serialize RuntimeState or spread transient state here.
 * E03 may be in history after Continue, never the currently saved shutdown.
 */
export interface SaveSnapshotV1 extends GameState {
  readonly saveSchemaVersion: 1;
  readonly safeState: SafeState;
}

/**
 * In-memory only, not a second save slot. Retry copies only this world, allocates
 * a new attempt, and advances configurationRevision beyond every prior value;
 * retained measurements remain visibly stale and cannot regain validity.
 */
export interface PreparationCheckpoint {
  readonly adventureId: AdventureId;
  readonly world: WorldState;
}

/** Transient restrictions; a UI panel or an outcome alone never proves safety. */
export type ActivityState =
  | { readonly kind: SafeState }
  | {
      readonly kind:
        | 'dialogue-transaction'
        | 'pending-effect'
        | 'room-transition'
        | 'cutscene'
        | 'active-encounter'
        | 'terminal-failure'
        | 'shutdown';
    };

export interface PresentationSettings {
  readonly musicVolume: number;
  readonly effectsVolume: number;
  readonly voiceVolume: number;
  readonly captions: boolean;
  readonly reducedMotion: 'system' | 'on' | 'off';
  readonly textScale: number;
}

export interface UiState {
  readonly panel: 'none' | 'inventory' | 'notebook' | 'compendium' | 'party' | 'settings' | 'save';
  readonly focusedObject: InstanceId | QualifiedId | null;
  readonly selectedVerb: Verb;
  readonly selectedItem: ItemId | null;
  readonly presentation: PresentationSettings;
  readonly feedback: string | null;
}

/** Server metadata is received, never supplied inside a GameState/save body. */
export type SlotRevision = Opaque<number, 'server-slot-revision'>;
export type SaveEtag = Opaque<`"save-${number}"`, 'server-save-etag'>;
export type ServerTimestamp = Opaque<string, 'server-timestamp'>;
export type DirtyGeneration = Opaque<number, 'dirty-generation'>;
export type ClientGeneration = Opaque<number, 'client-auth-generation'>;
export type SaveRequestId = Opaque<string, 'save-request-uuid'>;
export type CsrfToken = Opaque<string, 'csrf-token'>;

/** Summary fields stay readable even if the stored snapshot version is newer. */
export interface SaveSummary {
  readonly revision: SlotRevision;
  readonly etag: SaveEtag;
  readonly savedAt: ServerTimestamp;
  readonly adventureId: AdventureId;
  readonly episodeId: string;
  readonly roomId: string;
  readonly outcome: ContinueOutcome | null;
  readonly saveSchemaVersion: number;
  readonly contentVersion: string;
}

export interface SaveAcknowledgement {
  readonly requestId: SaveRequestId;
  readonly committedRevision: SlotRevision;
  readonly committedAt: ServerTimestamp;
  readonly replayed: boolean;
  /** A replay's committed revision may be older than this current slot. */
  readonly currentSummary: SaveSummary;
}

export type SavePrecondition =
  | { readonly header: 'If-None-Match'; readonly value: '*' }
  | { readonly header: 'If-Match'; readonly value: SaveEtag };

/** Explicit consent binds a different adventure to the reviewed slot precondition. */
export interface ReplacementAuthorization {
  readonly adventureId: AdventureId;
  readonly reviewedEtag: SaveEtag;
  readonly clientGeneration: ClientGeneration;
}

export interface PendingSaveRequest {
  readonly requestId: SaveRequestId;
  /** Copy these exact UTF-8 bytes for retry; never rebuild from a changed world. */
  readonly bodyBytes: readonly number[];
  readonly precondition: SavePrecondition;
  readonly mode: 'manual' | 'automatic';
  readonly confirmAdventureReplacement: boolean;
  readonly capturedGeneration: DirtyGeneration;
  readonly clientGeneration: ClientGeneration;
}

/** Memory only; absence of a confirmed acknowledgement is never "Saved". */
export interface PersistenceState {
  readonly status: 'unsaved' | 'saving' | 'saved' | 'conflict' | 'failed';
  readonly dirtyGeneration: DirtyGeneration;
  readonly lastAcknowledgedGeneration: DirtyGeneration | null;
  /** undefined = not fetched, null = confirmed empty slot. */
  readonly knownSlot: SaveSummary | null | undefined;
  readonly pendingRequest: PendingSaveRequest | null;
  readonly replacementAuthorization: ReplacementAuthorization | null;
  readonly lastAcknowledgement: SaveAcknowledgement | null;
  /** Defaults false; service preference remains authoritative per new write. */
  readonly autosaveEnabled: boolean;
}

export type AuthProvider = 'google' | 'github';
interface AuthGeneration {
  readonly clientGeneration: ClientGeneration;
}

export interface GuestAuth extends AuthGeneration {
  readonly status: 'guest';
  /** null until the same-origin session bootstrap has succeeded. */
  readonly csrfToken: CsrfToken | null;
}

export interface AuthenticatedAuth extends AuthGeneration {
  readonly status: 'authenticated';
  readonly provider: AuthProvider;
  readonly displayName: string;
  readonly csrfToken: CsrfToken;
  readonly expiresAt: ServerTimestamp;
}

/** No browser provider tokens or client-owned account identity. */
export type AuthState =
  | GuestAuth
  | AuthenticatedAuth
  | (AuthGeneration & {
      readonly status: 'authenticating';
      readonly provider: AuthProvider;
      readonly purpose: 'login' | 'delete-reauth';
      readonly previous: GuestAuth | AuthenticatedAuth;
    })
  | (AuthGeneration & {
      readonly status: 'logout-pending';
      readonly previous: GuestAuth | AuthenticatedAuth;
    });

/**
 * In-memory application state, deliberately not assignable to SaveSnapshotV1.
 * Canceled logout preserves this state. Confirmed logout clears game, checkpoint
 * and UI to title without a save; failed network logout is not confirmation.
 */
export interface RuntimeState {
  readonly game: GameState | null;
  readonly checkpoint: PreparationCheckpoint | null;
  readonly activity: ActivityState | null;
  readonly ui: UiState | null;
  readonly persistence: PersistenceState;
  readonly auth: AuthState;
}
