// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { validateContent } from '../content/registry';
import type * as S from '../content/schema-types.generated';
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
import market from '../../content/spec001/rooms/R09.json' with { type: 'json' };
import clockworks from '../../content/spec001/rooms/R10.json' with { type: 'json' };
import rift from '../../content/spec001/rooms/R11.json' with { type: 'json' };
import threshold from '../../content/spec001/rooms/R12.json' with { type: 'json' };
import copperActions from '../../content/spec001/dialogue/copper-actions.json' with { type: 'json' };
import equipmentActions from '../../content/spec001/dialogue/equipment-actions.json' with { type: 'json' };
import repairActions from '../../content/spec001/dialogue/repair-plan-actions.json' with { type: 'json' };

/** Explicit public authored documents; metadata reservations never become rooms. */
export function loadIntroductionContent() {
  // Scoped first-route projection. The canonical twelve-room world stays intact;
  // only these actual authored records become playable or saveable here.
  const documents = {
    'content/spec001/rooms/R01.json': arrival, 'content/spec001/rooms/R02.json': workshop,
    'content/spec001/dialogue/introduction.json': dialogue, 'content/spec001/dialogue/interactions.json': interactions,
    'content/spec001/objectives.json': objectives, 'content/spec001/items-introduction.json': items,
    'content/spec001/profiles.json': profiles,
    'content/spec001/rooms/R03.json': copper, 'content/spec001/rooms/R04.json': echo,
    'content/spec001/rooms/R09.json': market, 'content/spec001/rooms/R10.json': clockworks,
    'content/spec001/rooms/R11.json': rift, 'content/spec001/rooms/R12.json': threshold,
    'content/spec001/dialogue/copper-actions.json': copperActions,
    'content/spec001/dialogue/equipment-actions.json': equipmentActions,
    'content/spec001/dialogue/repair-plan-actions.json': repairActions,
  };
  const scopedWorld = structuredClone(world) as S.world;
  scopedWorld.documents = Object.entries(documents).flatMap(([path, document]) => {
    const value = document as S.authoredRecord | S.collection;
    return (value.kind === 'collection' ? value.records : [value]).map(record => ({ kind: record.kind, id: record.id, path }));
  });
  const result = validateContent({ world: scopedWorld, sources, documents });
  if (!result.ok || !result.registry) throw new Error('The authored first route could not be validated. No adventure was started.');
  return { registry: result.registry, world: scopedWorld };
}
