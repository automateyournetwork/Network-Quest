// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { validateContent } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import world from '../../content/spec001/world.json' with { type: 'json' };
import sources from '../../content/spec001/sources.json' with { type: 'json' };
import arrival from '../../content/spec001/rooms/R01.json' with { type: 'json' };
import workshop from '../../content/spec001/rooms/R02.json' with { type: 'json' };
import dialogue from '../../content/spec001/dialogue/introduction.json' with { type: 'json' };
import interactions from '../../content/spec001/dialogue/interactions.json' with { type: 'json' };
import objectives from '../../content/spec001/objectives-introduction.json' with { type: 'json' };
import items from '../../content/spec001/items-introduction.json' with { type: 'json' };
import profiles from '../../content/spec001/profiles-introduction.json' with { type: 'json' };

/** Explicit public authored documents; metadata reservations never become rooms. */
export function loadIntroductionContent() {
  const result = validateContent({ world, sources, documents: {
    'content/spec001/rooms/R01.json': arrival, 'content/spec001/rooms/R02.json': workshop,
    'content/spec001/dialogue/introduction.json': dialogue, 'content/spec001/dialogue/interactions.json': interactions,
    'content/spec001/objectives-introduction.json': objectives, 'content/spec001/items-introduction.json': items,
    'content/spec001/profiles-introduction.json': profiles,
  } });
  if (!result.ok || !result.registry) throw new Error('The authored introduction could not be validated. No adventure was started.');
  return { registry: result.registry, world: structuredClone(world) as S.world };
}
