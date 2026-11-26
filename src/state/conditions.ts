// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { condition } from '../content/schema-types.generated';
import type { FlagId, ObjectiveId, QuestId } from '../domain/types';
import type { WorldState } from './types';

/** Save v1 has no minigame completion field. Reject the entire expression. */
export function conditionSupported(value: condition): boolean {
  if (value.kind === 'minigame-complete') return false;
  if (value.kind === 'all' || value.kind === 'any') return value.conditions.every(conditionSupported);
  return value.kind !== 'not' || conditionSupported(value.condition);
}
function evaluate(value: condition, world: WorldState): boolean {
  switch (value.kind) {
    case 'always': return true;
    case 'all': return value.conditions.every(c => evaluate(c, world));
    case 'any': return value.conditions.some(c => evaluate(c, world));
    case 'not': return !evaluate(value.condition, world);
    case 'objective-complete': return world.completedObjectiveIds.includes(value.objectiveId as ObjectiveId);
    case 'quest-complete': return world.completedQuestIds.includes(value.questId as QuestId);
    case 'minigame-complete': case 'future-door-open': return false;
    case 'item-available': return (world.inventory.find(i => i.itemId === value.itemId)?.quantity ?? 0) >= value.quantity;
    case 'flag-equals': return Object.hasOwn(world.flags, value.flagId) && world.flags[value.flagId as FlagId] === value.value;
    case 'character-recruited': return world.recruits.some(r => r.characterId === value.characterId);
  }
}
/** Guard before evaluating, including negation and disjunction. No UI semantics. */
export function conditionSatisfied(value: condition, world: WorldState): boolean {
  return conditionSupported(value) && evaluate(value, world);
}
