// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type { EffectId, QualifiedId } from '../domain/types';
import { introductionDialogueEffectBindings } from '../state/dialogue';
import { introductionNotebookEffectBindings } from '../state/notebook';
import type { EffectBinding } from '../state/reducer';
import type { HotspotBinding } from '../ui/verbs';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
/** Explicit application bindings: no prefix inference or untrusted effect policy. */
export function introductionBindings(registry: ContentRegistry): { hotspots: readonly HotspotBinding[]; effects: readonly EffectBinding[] } {
  const entries = [
    ['R01', 'HOTSPOT-power', 'look', 'ACTION-observe-power', 'DIALOGUE-arrival-actions'],
    ['R01', 'HOTSPOT-link', 'look', 'ACTION-observe-link', 'DIALOGUE-arrival-actions'],
    ['R01', 'HOTSPOT-satchel', 'use', 'ACTION-take-kit', 'DIALOGUE-arrival-actions'],
    ['R01', 'HOTSPOT-path', 'use', 'ACTION-path-short', 'DIALOGUE-arrival-actions'],
    ['R01', 'HOTSPOT-path', 'use', 'ACTION-path-long', 'DIALOGUE-arrival-actions'],
    ['R01', 'HOTSPOT-capsule', 'look', 'ACTION-packet-context', 'DIALOGUE-arrival-actions'],
    ['R02', 'HOTSPOT-endpoints', 'look', 'ACTION-endpoints', 'DIALOGUE-workshop-actions'],
    ['R02', 'HOTSPOT-declared-path', 'look', 'ACTION-declare-path', 'DIALOGUE-workshop-actions'],
  ] as const;
  const hotspots: HotspotBinding[] = entries.map(([room, hotspot, verb, action, source]) => ({ roomId: q(room), hotspotId: q(hotspot), verb,
    actionId: q(action), sourceId: q(source), itemId: null, mode: 'effects' }));
  const effects: EffectBinding[] = [...introductionDialogueEffectBindings, ...introductionNotebookEffectBindings];
  for (const binding of hotspots) {
    const source = registry.record(binding.sourceId);
    const node = source?.kind === 'dialogue' ? source.nodes.find(n => n.id === source.entryNodeId) : undefined;
    const choice = node?.choices.find(c => c.id === binding.actionId);
    if (!choice) throw new TypeError('An introduction action is missing.');
    for (const effect of choice.effects) {
      // The satchel and Photon share the exact existing canonical once receipt.
      const shared = introductionDialogueEffectBindings.find(b => b.effectId === effect.effectId);
      effects.push(shared ?? { sourceId: binding.sourceId, effectId: effect.effectId as EffectId, mode: 'repeatable' });
    }
  }
  for (const id of ['O01', 'O02'] as const) {
    const objective = registry.record(q(id)); if (objective?.kind !== 'objective') throw new TypeError('An introduction objective is missing.');
    for (const effect of [...objective.effects, ...objective.alternatives.flatMap(a => a.effects)]) effects.push({ sourceId: q(id), effectId: effect.effectId as EffectId,
      mode: 'once', receipt: { kind: 'objective', id: q(id) } });
  }
  const deduplicated = new Map<EffectId, EffectBinding>();
  for (const binding of effects) {
    const prior = deduplicated.get(binding.effectId);
    if (prior && JSON.stringify(prior) !== JSON.stringify(binding)) throw new TypeError('Conflicting introduction effect policies.');
    deduplicated.set(binding.effectId, binding);
  }
  return { hotspots, effects: [...deduplicated.values()] };
}
