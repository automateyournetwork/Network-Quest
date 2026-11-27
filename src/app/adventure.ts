// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type { AdventureId, AttemptId, ConfigurationRevision, ContentVersion, QualifiedId } from '../domain/types';
import type { RuntimeState, SaveSnapshotV1 } from '../state/types';
import { apprenticeDiscovery } from '../state/party';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
export function createIntroductionRuntime(): RuntimeState {
  return { game: null, checkpoint: null, activity: null, ui: null,
    auth: { status: 'guest', csrfToken: null, clientGeneration: 0 as RuntimeState['auth']['clientGeneration'] },
    persistence: { status: 'unsaved', dirtyGeneration: 0 as RuntimeState['persistence']['dirtyGeneration'], lastAcknowledgedGeneration: null,
      knownSlot: undefined, pendingRequest: null, replacementAuthorization: null, lastAcknowledgement: null, autosaveEnabled: false } };
}

/** Only the validated reader's ready snapshot reaches this lifecycle installer.
 * Restore is exact replacement, never the retry journal/attempt merge. */
export function restoreIntroduction(previous: RuntimeState, snapshot: SaveSnapshotV1): RuntimeState {
  const { saveSchemaVersion: _schema, safeState, ...game } = snapshot;
  return { ...previous, game, checkpoint: null, activity: { kind: safeState },
    ui: { panel: 'none', focusedObject: null, selectedVerb: 'walk', selectedItem: null, feedback: null,
      presentation: previous.ui?.presentation ?? { musicVolume: 1, effectsVolume: 1, voiceVolume: 1, captions: true, reducedMotion: 'system', textScale: 1 } },
    persistence: { ...createIntroductionRuntime().persistence } };
}

/** A new memory run is never a slot replacement, restoration or implicit save. */
export function startIntroduction(previous: RuntimeState, registry: ContentRegistry): RuntimeState {
  if (previous.persistence.pendingRequest || previous.persistence.status === 'saving' || !['guest', 'authenticated'].includes(previous.auth.status)) throw new Error('Resolve the current account operation before starting an adventure.');
  const room = registry.record(q('R01'));
  if (room?.kind !== 'room' || !room.safePositions.some(p => p.id === q('R01.entry')) || !registry.safePosition(q('R01.entry'))?.eligibleStates.includes('stable-exploration')) throw new Error('The introduction has no authored safe entry.');
  return { ...previous, checkpoint: null, activity: { kind: 'stable-exploration' },
    game: { episodeId: 'spec001', contentVersion: room.contentVersion as ContentVersion, adventureId: crypto.randomUUID() as AdventureId,
      world: { roomId: q('R01'), position: { safePositionId: q('R01.entry') }, attemptId: crypto.randomUUID() as AttemptId,
        configurationRevision: 0 as ConfigurationRevision, flags: {}, completedObjectiveIds: [], completedQuestIds: [], achievementIds: [], dialogueEffectIds: [], inventory: [], recruits: [], activeAllyIds: [], compendiumIds: apprenticeDiscovery(registry, room), route: null, continueOutcome: null },
      notebook: { factIds: [], mapRoomIds: [q('R01')], personalNotes: '', hypotheses: [], measurements: [] }, assistance: [], outcomeHistory: [] },
    ui: { panel: 'none', focusedObject: null, selectedVerb: 'walk', selectedItem: null, feedback: null,
      presentation: previous.ui?.presentation ?? { musicVolume: 1, effectsVolume: 1, voiceVolume: 1, captions: true, reducedMotion: 'system', textScale: 1 } },
    persistence: { ...previous.persistence, status: 'unsaved', dirtyGeneration: 0 as RuntimeState['persistence']['dirtyGeneration'], lastAcknowledgedGeneration: null,
      pendingRequest: null, replacementAuthorization: null, lastAcknowledgement: null, autosaveEnabled: false } };
}
