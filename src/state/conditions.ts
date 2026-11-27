// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Registry-bound conditions retain explicit save-v1 minigame achievement semantics.
import type { ContentRegistry } from '../content/registry';
import type { condition } from '../content/schema-types.generated';
import type { AchievementId, FlagId, ObjectiveId, QuestId } from '../domain/types';
import type { WorldState } from './types';
export function minigameAchievement(registry: ContentRegistry | undefined, id: string): AchievementId | null {
  const record = registry?.record(id);
  if (record?.kind !== 'minigame' || record.id !== id || !('completionAchievementId' in record) || typeof record.completionAchievementId !== 'string'
    || !registry?.has('minigame', id) || !registry.has('achievement', record.completionAchievementId)
    || !/^spec001:ACHIEVEMENT-[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(record.completionAchievementId)) return null;
  return record.completionAchievementId as AchievementId;
}
export function conditionSupported(value: condition, registry?: ContentRegistry): boolean {
  if (value.kind === 'minigame-complete') return minigameAchievement(registry, value.minigameId) !== null;
  if (value.kind === 'all' || value.kind === 'any') return value.conditions.every(child => conditionSupported(child, registry));
  return value.kind !== 'not' || conditionSupported(value.condition, registry);
}
function evaluate(value: condition, world: WorldState, registry?: ContentRegistry): boolean {
  switch (value.kind) {
    case 'always': return true;
    case 'all': return value.conditions.every(child => evaluate(child, world, registry));
    case 'any': return value.conditions.some(child => evaluate(child, world, registry));
    case 'not': return !evaluate(value.condition, world, registry);
    case 'objective-complete': return world.completedObjectiveIds.includes(value.objectiveId as ObjectiveId);
    case 'quest-complete': return world.completedQuestIds.includes(value.questId as QuestId);
    case 'minigame-complete': { const id = minigameAchievement(registry, value.minigameId); return id !== null && world.achievementIds.includes(id); }
    case 'future-door-open': return false;
    case 'item-available': return (world.inventory.find(item => item.itemId === value.itemId)?.quantity ?? 0) >= value.quantity;
    case 'flag-equals': return Object.hasOwn(world.flags, value.flagId) && world.flags[value.flagId as FlagId] === value.value;
    case 'character-recruited': return world.recruits.some(recruit => recruit.characterId === value.characterId);
  }
}
export function conditionSatisfied(value: condition, world: WorldState, registry?: ContentRegistry): boolean {
  return conditionSupported(value, registry) && evaluate(value, world, registry);
}
