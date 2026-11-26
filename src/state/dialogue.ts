// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import type { ActionId, EffectId, QualifiedId } from '../domain/types';
import { conditionSatisfied } from './conditions';
import type { EffectBinding, ReducerCommand, ReducerState, Reduction, StateEffect } from './reducer';

/** Shared by Photon and the satchel. Never create a second acquisition receipt. */
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
export const introductionDialogueEffectBindings: readonly EffectBinding[] = [
  { sourceId: q('DIALOGUE-photon-intro'), effectId: 'spec001:EFFECT-photon-clue' as EffectId, mode: 'once', receipt: { kind: 'dialogue-effect', id: q<'dialogue-effect'>('EFFECT-photon-clue') } },
  { sourceId: q('DIALOGUE-photon-intro'), effectId: 'spec001:EFFECT-kit' as EffectId, mode: 'once', receipt: { kind: 'flag', id: q<'flag'>('FLAG-kit-issued') } },
  { sourceId: q('DIALOGUE-photon-intro'), effectId: 'spec001:EFFECT-kit-issued' as EffectId, mode: 'once', receipt: { kind: 'flag', id: q<'flag'>('FLAG-kit-issued') } },
  { sourceId: q('DIALOGUE-titan-intro'), effectId: 'spec001:EFFECT-titan-clue' as EffectId, mode: 'once', receipt: { kind: 'dialogue-effect', id: q<'dialogue-effect'>('EFFECT-titan-clue') } },
];

export type DialogueOperation = { readonly kind: 'open' }
  | { readonly kind: 'choose'; readonly nodeId: QualifiedId; readonly choiceId: QualifiedId }
  | { readonly kind: 'skip'; readonly nodeId: QualifiedId };
export type DialogueReduction = { readonly ok: true; readonly state: ReducerState; readonly nodeId: QualifiedId | null }
  | { readonly ok: false; readonly reason: string };
export interface DialogueTransition {
  readonly registry: ContentRegistry; readonly reduce: (state: ReducerState, command: ReducerCommand) => Reduction;
  readonly state: ReducerState; readonly dialogueId: QualifiedId; readonly operation: DialogueOperation;
  readonly actionId: ActionId; readonly nextActionId: () => ActionId;
}

/**
 * Pure candidate transaction: choice effects precede the next node's condition.
 * Callers install only a successful final state, once. No renderer, timers,
 * journal patches or fabricated completion effects enter this path.
 */
export function reduceDialogue(options: DialogueTransition): DialogueReduction {
  const { registry, reduce, operation } = options;
  const dialogue = registry.record(options.dialogueId);
  if (dialogue?.kind !== 'dialogue' || dialogue.skipPolicy !== 'retain-required-evidence' || dialogue.replayPolicy !== 'no-duplicate-effects') return { ok: false, reason: 'dialogue-content' };
  let state = options.state, first = true;
  if (!state.runtime.game) return { ok: false, reason: 'no-adventure' };
  const apply = (effects: S.effect[]): string | null => {
    const game = state.runtime.game!;
    const out = reduce(state, { actionId: first ? options.actionId : options.nextActionId(), adventureId: game.adventureId,
      expectedVersion: { configurationRevision: game.world.configurationRevision, attemptId: game.world.attemptId },
      input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'authored-dialogue', observations: [], acceptedEffects: effects as StateEffect[] } } });
    first = false;
    if (out.status === 'rejected') return out.reason ?? 'dialogue-effect';
    state = out.state; return null;
  };
  const node = (id: string) => dialogue.nodes.find(n => n.id === id);
  const eligible = (value: S.condition) => conditionSatisfied(value, state.runtime.game!.world);
  const enter = (current: S.dialogueNode | undefined): string | null => {
    if (!current) return 'dialogue-node';
    if (!eligible(current.condition)) return 'precondition';
    const failure = apply(current.effects);
    if (failure) return failure;
    // Canonical reducer policies preserve ancestor conditions on choice effects.
    // Until authoring has a separate entry-only guard, reject this unsupported
    // shape before installing the entry: never strand a visible conversation.
    if (!eligible(current.condition) && current.choices.some(c => c.effects.length)) return 'dialogue-condition-invalidated';
    return null;
  };
  if (operation.kind === 'open') {
    const current = node(dialogue.entryNodeId), failure = enter(current);
    return failure ? { ok: false, reason: failure } : { ok: true, state, nodeId: current!.id as QualifiedId };
  }
  let current = node(operation.nodeId);
  if (!current) return { ok: false, reason: 'dialogue-node' };
  // The trusted transient cursor proves entry authorization. Its own committed
  // effects may have changed the entry condition; do not strand that session.
  // The visible node was already entered. Replaying its effects is unnecessary;
  // receipts still protect later nodes reached by Skip or Replay.
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current.id)) return { ok: false, reason: 'dialogue-cycle' };
    seen.add(current.id);
    const choices = current.choices.filter(c => eligible(c.condition));
    const selected = operation.kind === 'choose' ? choices.find(c => c.id === operation.choiceId) : choices.length === 1 ? choices[0] : undefined;
    if (!selected) return { ok: false, reason: choices.length > 1 ? 'dialogue-choice-required' : 'dialogue-choice' };
    const failure = apply(selected.effects);
    if (failure) return { ok: false, reason: failure };
    if (selected.nextNodeId === null) return { ok: true, state, nodeId: null };
    current = node(selected.nextNodeId);
    const nextFailure = enter(current);
    if (nextFailure) return { ok: false, reason: nextFailure };
    if (operation.kind === 'choose') return { ok: true, state, nodeId: current!.id as QualifiedId };
  }
  return { ok: false, reason: 'dialogue-node' };
}
