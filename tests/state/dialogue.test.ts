// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { reduceDialogue, introductionDialogueEffectBindings } from '../../src/state/dialogue';
import type { DialogueOperation } from '../../src/state/dialogue';
import type { ActionId } from '../../src/domain/types';
import { q, setup } from '../ui/inventory-fixture';

const command = (f: ReturnType<typeof setup>, dialogue: string, operation: DialogueOperation) => reduceDialogue({ registry: f.registry,
  reduce: f.store.reduce, state: f.store.getState(), dialogueId: q(dialogue), operation, actionId: crypto.randomUUID() as ActionId,
  nextActionId: () => crypto.randomUUID() as ActionId });

describe('T026 authored dialogue transitions through the actual reducer', () => {
  it('skips real Photon lines while retaining his clue and exactly one kit', () => {
    const f = setup({ bindings: [...introductionDialogueEffectBindings] });
    const opened = command(f, 'DIALOGUE-photon-intro', { kind: 'open' });
    expect(opened.ok).toBe(true); if (!opened.ok) return;
    f.replace(opened.state);
    expect(opened.nodeId).toBe(q('DIALOGUE-photon-welcome'));
    const skipped = command(f, 'DIALOGUE-photon-intro', { kind: 'skip', nodeId: opened.nodeId! });
    expect(skipped.ok).toBe(true); if (!skipped.ok) return; f.replace(skipped.state);
    expect(skipped.nodeId).toBeNull();
    for (let n = 0; n < 3; n++) { const replay = command(f, 'DIALOGUE-photon-intro', { kind: 'open' }); expect(replay.ok).toBe(true); if (replay.ok) f.replace(replay.state); }
    expect(f.store.getState().runtime.game!.world.inventory).toEqual([{ itemId: q('ITEM-inspection-kit'), quantity: 1 }]);
    expect(f.store.getState().runtime.game!.notebook.factIds).toEqual([q('FACT-photon-clue')]);
    expect(f.store.getState().runtime.game!.world.dialogueEffectIds).toEqual([q('EFFECT-photon-clue')]);
    expect(f.store.getState().runtime.game!.world.completedObjectiveIds).toEqual([]);
  });
  it('keeps Titan scope clue and guest text available across normal completion and replay', () => {
    const f = setup({ bindings: [...introductionDialogueEffectBindings] });
    let out = command(f, 'DIALOGUE-titan-intro', { kind: 'open' }); if (!out.ok) throw new Error(out.reason); f.replace(out.state);
    for (const [node, choice] of [['DIALOGUE-titan-welcome', 'ACTION-titan-next'], ['DIALOGUE-titan-scope', 'ACTION-titan-routes'], ['DIALOGUE-titan-routes', 'ACTION-titan-finish']]) {
      out = command(f, 'DIALOGUE-titan-intro', { kind: 'choose', nodeId: q(node!), choiceId: q(choice!) });
      expect(out.ok).toBe(true); if (!out.ok) return; f.replace(out.state);
    }
    expect(out.nodeId).toBeNull();
    expect(f.store.getState().runtime.game!.notebook.factIds).toEqual([q('FACT-titan-clue')]);
    expect(f.store.getState().runtime.game!.world.inventory).toEqual([]);
    expect(f.store.getState().runtime.game!.world.completedObjectiveIds).toEqual([]);
  });
  it('retains entry authorization after its own effects change the entry condition', () => {
    const f = setup({ bindings: [...introductionDialogueEffectBindings], mutate: docs => {
      const intro = docs['content/spec001/dialogue/introduction.json'] as {records: import('../../src/content/schema-types.generated').dialogue[]};
      intro.records[0]!.nodes[0]!.condition = { kind: 'not', condition: { kind: 'flag-equals', flagId: q('FLAG-kit-issued'), value: true } };
    } });
    const opened = command(f, 'DIALOGUE-photon-intro', { kind: 'open' }); expect(opened.ok).toBe(true); if (!opened.ok) return;
    f.replace(opened.state);
    const skipped = command(f, 'DIALOGUE-photon-intro', { kind: 'skip', nodeId: opened.nodeId! });
    expect(skipped.ok).toBe(true);
  });
  it('rejects a self-invalidating entry with effect-bearing choices before opening or granting', () => {
    const bindings = [...introductionDialogueEffectBindings, { sourceId: q('DIALOGUE-photon-intro'), effectId: 'spec001:EFFECT-choice-marker' as import('../../src/domain/types').EffectId,
      mode: 'once' as const, receipt: { kind: 'flag' as const, id: q<'flag'>('FLAG-choice-marker') } }];
    const f = setup({ bindings, mutate: docs => {
      const intro = docs['content/spec001/dialogue/introduction.json'] as {records: import('../../src/content/schema-types.generated').dialogue[]};
      const node = intro.records[0]!.nodes[0]!;
      node.condition = { kind: 'not', condition: { kind: 'flag-equals', flagId: q('FLAG-kit-issued'), value: true } };
      node.choices[0]!.effects = [{ kind: 'set-flag', effectId: q('EFFECT-choice-marker'), flagId: q('FLAG-choice-marker'), value: true }];
    } });
    const before = f.store.getState();
    expect(command(f, 'DIALOGUE-photon-intro', { kind: 'open' })).toEqual({ ok: false, reason: 'dialogue-condition-invalidated' });
    expect(f.store.getState()).toBe(before); expect(before.runtime.game!.world.inventory).toEqual([]);
  });
  it('evaluates choice effects before the next node condition and commits required later clues on Skip', () => {
    const bindings = [...introductionDialogueEffectBindings, { sourceId: q('DIALOGUE-titan-intro'), effectId: 'spec001:EFFECT-dialogue-ready' as import('../../src/domain/types').EffectId,
      mode: 'once' as const, receipt: { kind: 'flag' as const, id: q<'flag'>('FLAG-dialogue-ready') } }];
    const f = setup({ bindings, mutate: docs => {
      const intro = docs['content/spec001/dialogue/introduction.json'] as {records: import('../../src/content/schema-types.generated').dialogue[]};
      const [first, second] = intro.records[1]!.nodes;
      second!.effects = first!.effects; first!.effects = [];
      first!.choices[0]!.effects = [{ kind: 'set-flag', effectId: q('EFFECT-dialogue-ready'), flagId: q('FLAG-dialogue-ready'), value: true }];
      second!.condition = { kind: 'flag-equals', flagId: q('FLAG-dialogue-ready'), value: true };
    } });
    const opened = command(f, 'DIALOGUE-titan-intro', { kind: 'open' }); expect(opened.ok).toBe(true); if (!opened.ok) return; f.replace(opened.state);
    expect(opened.state.runtime.game!.notebook.factIds).toEqual([]);
    const skipped = command(f, 'DIALOGUE-titan-intro', { kind: 'skip', nodeId: opened.nodeId! });
    expect(skipped.ok).toBe(true); if (!skipped.ok) return;
    expect(skipped.state.runtime.game!.notebook.factIds).toEqual([q('FACT-titan-clue')]);
    expect(skipped.state.runtime.game!.world.flags[q<'flag'>('FLAG-dialogue-ready')]).toBe(true);
  });
  it('does not choose an arbitrary branch while skipping', () => {
    const f = setup({ bindings: [...introductionDialogueEffectBindings], mutate: docs => {
      const intro = docs['content/spec001/dialogue/introduction.json'] as {records: import('../../src/content/schema-types.generated').dialogue[]};
      intro.records[0]!.nodes[0]!.choices.push({ id: q('ACTION-decline-photon'), text: 'Another response', condition: { kind: 'always' }, nextNodeId: null, effects: [] });
    } });
    const opened = command(f, 'DIALOGUE-photon-intro', { kind: 'open' }); if (!opened.ok) throw new Error(opened.reason); f.replace(opened.state);
    expect(command(f, 'DIALOGUE-photon-intro', { kind: 'skip', nodeId: opened.nodeId! })).toEqual({ ok: false, reason: 'dialogue-choice-required' });
    expect(f.store.getState().runtime.game!.world.inventory[0]?.quantity).toBe(1);
  });
  it('fails closed for cross-dialogue nodes, unoffered choices and missing canonical effect policies', () => {
    const f = setup({ bindings: [...introductionDialogueEffectBindings] }), before = f.store.getState();
    expect(command(f, 'DIALOGUE-photon-intro', { kind: 'choose', nodeId: q('DIALOGUE-titan-welcome'), choiceId: q('ACTION-titan-next') }).ok).toBe(false);
    expect(command(f, 'DIALOGUE-photon-intro', { kind: 'choose', nodeId: q('DIALOGUE-photon-welcome'), choiceId: q('ACTION-photon-finish') }).ok).toBe(false);
    const missing = setup({ bindings: [] }); expect(command(missing, 'DIALOGUE-photon-intro', { kind: 'open' }).ok).toBe(false);
    expect(f.store.getState()).toBe(before);
  });
  it('rejects condition changes and an invalid next node atomically', () => {
    const f = setup({ bindings: [...introductionDialogueEffectBindings], mutate: docs => {
      const intro = docs['content/spec001/dialogue/introduction.json'] as {records: import('../../src/content/schema-types.generated').dialogue[]};
      intro.records[0]!.nodes[1]!.condition = { kind: 'item-available', itemId: q('ITEM-inspection-kit'), quantity: 2 };
    } });
    const before = f.store.getState();
    const result = command(f, 'DIALOGUE-photon-intro', { kind: 'skip', nodeId: q('DIALOGUE-photon-welcome') });
    expect(result.ok).toBe(false); expect(f.store.getState()).toBe(before);
  });
});
