// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type { QualifiedId, RoomId } from '../domain/types';
import type { HotspotBinding } from '../ui/verbs';

/** Touching a demo latch or assembling a preselected tray never grants equipment or validation. */
export function marketExhibitBindings(registry: ContentRegistry): HotspotBinding[] {
  const sourceId = 'spec001:DIALOGUE-market-bench' as QualifiedId;
  const lesson = registry.record(sourceId);
  if (lesson?.kind !== 'dialogue' || lesson.nodes.length !== 1 || lesson.nodes[0]!.effects.length ||
      lesson.nodes[0]!.condition.kind !== 'always' || lesson.nodes[0]!.choices.length !== 3) {
    throw new Error('Invalid Market exhibit lesson');
  }
  return ([
    ['market-seat-sample', 'market-sfp', null],
    ['market-assemble-A', 'market-counter', 'compatible-kit-A'],
    ['market-assemble-B', 'market-counter', 'compatible-kit-B'],
  ] as const).map(([name, target, kit]) => {
    const actionId = ('spec001:ACTION-' + name) as QualifiedId;
    const choice = lesson.nodes[0]!.choices.find(c => c.id === actionId);
    if (!choice || choice.effects.length || choice.nextNodeId !== null ||
      (kit === null ? choice.condition.kind !== 'always' : choice.condition.kind !== 'flag-equals' ||
      choice.condition.flagId !== 'spec001:FLAG-market-kit' || choice.condition.value !== kit)) {
      throw new Error('Market demonstrations require their actual tray and zero state effects');
    }
    return { roomId: 'spec001:R09' as RoomId, hotspotId: ('spec001:HOTSPOT-' + target) as QualifiedId,
      sourceId, actionId, verb: 'use', itemId: null, mode: 'effects' };
  });
}
