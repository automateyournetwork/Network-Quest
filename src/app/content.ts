// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { validateContent } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import type { QualifiedId } from '../domain/types';
import { pointInWalkRegion, type NavigationEntry } from '../state/navigation';
import world from '../../content/spec001/world.json' with { type: 'json' };
import sources from '../../content/spec001/sources.json' with { type: 'json' };
import arrival from '../../content/spec001/rooms/R01.json' with { type: 'json' };
import workshop from '../../content/spec001/rooms/R02.json' with { type: 'json' };
import dialogue from '../../content/spec001/dialogue/introduction.json' with { type: 'json' };
import interactions from '../../content/spec001/dialogue/interactions.json' with { type: 'json' };
import objectives from '../../content/spec001/objectives.json' with { type: 'json' };
import items from '../../content/spec001/items-introduction.json' with { type: 'json' };
import profiles from '../../content/spec001/profiles.json' with { type: 'json' };
import copper from '../../content/spec001/rooms/R03.json' with { type: 'json' };
import echo from '../../content/spec001/rooms/R04.json' with { type: 'json' };
import gardens from '../../content/spec001/rooms/R05.json' with { type: 'json' };
import vault from '../../content/spec001/rooms/R06.json' with { type: 'json' };
import skywell from '../../content/spec001/rooms/R07.json' with { type: 'json' };
import observatory from '../../content/spec001/rooms/R08.json' with { type: 'json' };
import market from '../../content/spec001/rooms/R09.json' with { type: 'json' };
import clockworks from '../../content/spec001/rooms/R10.json' with { type: 'json' };
import rift from '../../content/spec001/rooms/R11.json' with { type: 'json' };
import threshold from '../../content/spec001/rooms/R12.json' with { type: 'json' };
import copperActions from '../../content/spec001/dialogue/copper-actions.json' with { type: 'json' };
import fiberActions from '../../content/spec001/dialogue/fiber-actions.json' with { type: 'json' };
import radioActions from '../../content/spec001/dialogue/radio-actions.json' with { type: 'json' };
import equipmentActions from '../../content/spec001/dialogue/equipment-actions.json' with { type: 'json' };
import packetRepair from '../../content/spec001/dialogue/packet-r12.json' with { type: 'json' };
import repairActions from '../../content/spec001/dialogue/repair-plan-actions.json' with { type: 'json' };
import characters from '../../content/spec001/characters.json' with { type: 'json' };
import serialPost from '../../content/spec001/quests/SQ01.json' with { type: 'json' };
import powerAudit from '../../content/spec001/quests/SQ02.json' with { type: 'json' };
import maintenanceRecord from '../../content/spec001/quests/SQ04.json' with { type: 'json' };
import weatherDiary from '../../content/spec001/quests/SQ03.json' with { type: 'json' };

/** Explicit public authored documents; metadata reservations never become rooms. */
export function loadIntroductionContent() {
  // Exact canonical selection: a reservation is never promoted to a room, and
  // an unlisted or missing document fails instead of silently changing scope.
  const documents = {
    'content/spec001/rooms/R01.json': arrival, 'content/spec001/rooms/R02.json': workshop,
    'content/spec001/dialogue/introduction.json': dialogue, 'content/spec001/dialogue/interactions.json': interactions,
    'content/spec001/objectives.json': objectives, 'content/spec001/items-introduction.json': items,
    'content/spec001/profiles.json': profiles,
    'content/spec001/rooms/R03.json': copper, 'content/spec001/rooms/R04.json': echo,
    'content/spec001/rooms/R05.json': gardens, 'content/spec001/rooms/R06.json': vault,
    'content/spec001/rooms/R07.json': skywell, 'content/spec001/rooms/R08.json': observatory,
    'content/spec001/rooms/R09.json': market, 'content/spec001/rooms/R10.json': clockworks,
    'content/spec001/rooms/R11.json': rift, 'content/spec001/rooms/R12.json': threshold,
    'content/spec001/dialogue/copper-actions.json': copperActions,
    'content/spec001/dialogue/fiber-actions.json': fiberActions,
    'content/spec001/dialogue/radio-actions.json': radioActions,
    'content/spec001/dialogue/equipment-actions.json': equipmentActions,
    'content/spec001/dialogue/repair-plan-actions.json': repairActions,
    'content/spec001/dialogue/packet-r12.json': packetRepair,
    'content/spec001/characters.json': characters,
    'content/spec001/quests/SQ01.json': serialPost,
    'content/spec001/quests/SQ02.json': powerAudit,
    'content/spec001/quests/SQ03.json': weatherDiary,
    'content/spec001/quests/SQ04.json': maintenanceRecord,
  };
  const canonicalWorld = structuredClone(world) as S.world;
  const result = validateContent({ world: canonicalWorld, sources, documents });
  if (!result.ok || !result.registry) throw new Error('The authored episode could not be validated. No adventure was started.');
  return { registry: result.registry, world: canonicalWorld };
}

/** Explicit arrivals shared by the application and its execution tests. */
export function episodeNavigationEntries(registry: import('../content/registry').ContentRegistry, metadata: Readonly<S.world>): readonly NavigationEntry[] {
  const q = <T extends string>(id: string) => `spec001:${id}` as QualifiedId<T>;
  return ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12'].map(id => {
    const roomId = q<'room'>(id), safePositionId = q<'safe-position'>(id === 'R11' ? 'R11.preparation' : `${id}.entry`);
    const activity = id === 'R11' ? 'safe-preparation' : 'stable-exploration';
    const room = registry.record(roomId), allocation = metadata.rooms.find(r => r.id === roomId);
    const anchor = room?.kind === 'room' ? room.safePositions.find(p => p.id === safePositionId) : undefined;
    const region = room?.kind === 'room' && anchor ? room.walkRegions.find(r => r.id === anchor.walkRegionId) : undefined;
    if (!allocation?.safePositionIds.includes(safePositionId) || !anchor || !region || !pointInWalkRegion(anchor.point, region.vertices)
      || !registry.safePosition(safePositionId)?.eligibleStates.includes(activity)) throw new Error('An authored room has no safe arrival.');
    return { roomId, safePositionId, activity };
  });
}
