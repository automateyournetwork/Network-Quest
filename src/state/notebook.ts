// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import { evaluateCopper } from '../domain/copper';
import type { CopperChallenge, CopperProfile } from '../domain/copper';
import type { ActionId, EffectId, EvaluationResult, HypothesisId, MeasurementId, QualifiedId, RuleId } from '../domain/types';
import { conditionSatisfied } from './conditions';
import type { EffectBinding, RejectionReason, StateEffect } from './reducer';
import type { GameState, Measurement } from './types';

/** Closed trusted commands; neither caller-supplied measurements nor game patches. */
export type NotebookOperation =
  | { readonly kind: 'notes'; readonly text: string }
  | { readonly kind: 'pin-hypothesis'; readonly id: HypothesisId; readonly text: string }
  | { readonly kind: 'retire-hypothesis'; readonly id: HypothesisId }
  | { readonly kind: 'inspect-path'; readonly id: MeasurementId };
type Failure = { readonly ok: false; readonly reason: RejectionReason };
export type NotebookFinalization = { readonly ok: true; readonly game: GameState } | Failure;
export type NotebookPreparation = Failure | {
  readonly ok: true;
  readonly evaluation: EvaluationResult<unknown, StateEffect>;
  /** Trusted module closure, invoked after canonical effects but before commit. */
  readonly finalize: (candidate: GameState) => NotebookFinalization;
};
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (reason: RejectionReason): Failure => ({ ok: false, reason });
const fields: Record<NotebookOperation['kind'], readonly string[]> = {
  notes: ['kind', 'text'], 'pin-hypothesis': ['kind', 'id', 'text'], 'inspect-path': ['kind', 'id'], 'retire-hypothesis': ['kind', 'id'],
};

/** JSON save lengths count Unicode code points, never UTF-16 code units. */
export function validNotebookText(text: unknown, maximum: number, nonempty = false): text is string {
  if (typeof text !== 'string' || text.length > maximum * 2 || (nonempty && !text.trim())) return false;
  const characters = [...text];
  return characters.length <= maximum && characters.every(character => {
    const point = character.codePointAt(0)!; return point < 0xD800 || point > 0xDFFF;
  });
}

export const introductionNotebookEffectBindings: readonly EffectBinding[] = [
  { sourceId: q('DIALOGUE-arrival-actions'), effectId: q('EFFECT-inspect') as unknown as EffectId, mode: 'repeatable' },
  { sourceId: q('DIALOGUE-workshop-actions'), effectId: q('EFFECT-hypothesis-pinned') as unknown as EffectId,
    mode: 'once', receipt: { kind: 'flag', id: q<'flag'>('FLAG-hypothesis-pinned') } },
];

function authoredAction(registry: ContentRegistry, game: GameState, kind: 'inspection' | 'hypothesis'): Readonly<S.dialogueChoice> | null {
  const inspection = kind === 'inspection';
  const roomId = q(inspection ? 'R01' : 'R02'), source = registry.record(q(inspection ? 'DIALOGUE-arrival-actions' : 'DIALOGUE-workshop-actions'));
  const room = registry.record(roomId), hotspotId = q(inspection ? 'HOTSPOT-path' : 'HOTSPOT-hypothesis');
  const actionId = q(inspection ? 'ACTION-inspect-path' : 'ACTION-pin-hypothesis');
  const node = source?.kind === 'dialogue' ? source.nodes.find(n => n.id === source.entryNodeId) : undefined;
  const choice = node?.choices.find(c => c.id === actionId), hotspot = room?.kind === 'room' ? room.hotspots.find(h => h.id === hotspotId) : undefined;
  if (game.world.roomId !== roomId || !node || !choice || !hotspot?.verbs.includes('use') || !hotspot.actionIds.includes(actionId)
    || !conditionSatisfied(node.condition, game.world) || !conditionSatisfied(choice.condition, game.world)) return null;
  const effect = choice.effects[0];
  if (choice.effects.length !== 1 || effect?.kind !== 'set-flag' || effect.value !== true
    || effect.effectId !== q(inspection ? 'EFFECT-inspect' : 'EFFECT-hypothesis-pinned')
    || effect.flagId !== q(inspection ? 'FLAG-path-inspected' : 'FLAG-hypothesis-pinned')) return null;
  return choice;
}

/** Reviewed T023 selector mapping, never parsed from prose or inferred from a flag claiming inspection. */
export function introductionCopperChallenge(registry: ContentRegistry, game: GameState): CopperChallenge | null {
  const mode = game.world.flags[q<'flag'>('FLAG-path-mode')];
  if (mode !== undefined && mode !== 'service-loop' && mode !== 'direct') return null;
  const profile = registry.record(q('PROFILE-COPPER-100'));
  if (profile?.kind !== 'profile' || !profile.ruleIds.includes(q('PHY04')) || profile.reviewedProfileId !== profile.id) return null;
  return { kind: 'copper-length', profile: { id: profile.id as CopperProfile['id'], parameters: profile.parameters as unknown as CopperProfile['parameters'] },
    lengths: [{ value: mode === 'direct' ? 85 : 95, unit: 'm' }, { value: 10, unit: 'm' }] };
}

/** Validates the closed intent and returns only exact registered effects. */
export function prepareNotebookChange(registry: ContentRegistry, game: GameState, operation: NotebookOperation): NotebookPreparation {
  if (!operation || typeof operation !== 'object' || !Object.hasOwn(fields, operation.kind)
    || Object.keys(operation).length !== fields[operation.kind].length || Object.keys(operation).some(key => !fields[operation.kind].includes(key))) return fail('invalid-input');
  const prepared = (effects: readonly StateEffect[], finalize: (candidate: GameState) => NotebookFinalization): NotebookPreparation => ({
    ok: true, evaluation: { status: 'correct', reasonCode: 'notebook-intent', observations: [], acceptedEffects: effects }, finalize,
  });
  if (operation.kind === 'notes') {
    if (!validNotebookText(operation.text, 4096)) return fail('invalid-input');
    const text = operation.text;
    return prepared([], candidate => ({ ok: true, game: { ...candidate, notebook: { ...candidate.notebook, personalNotes: text } } }));
  }
  if (!uuid.test(operation.id)) return fail('invalid-input');
  if (operation.kind === 'retire-hypothesis') {
    const hypothesis = game.notebook.hypotheses.find(row => row.id === operation.id);
    if (game.world.roomId !== q('R02') || !game.notebook.measurements.length || !hypothesis || hypothesis.status !== 'open') return fail('precondition');
    return prepared([], candidate => ({ ok: true, game: { ...candidate, notebook: { ...candidate.notebook,
      hypotheses: candidate.notebook.hypotheses.map(row => row.id === operation.id ? { ...row, status: 'rejected' } : row) } } }));
  }
  if (operation.kind === 'pin-hypothesis') {
    if (!validNotebookText(operation.text, 512, true)) return fail('invalid-input');
    const prior = game.notebook.hypotheses.find(h => h.id === operation.id);
    if (prior) return prior.text === operation.text ? prepared([], candidate => ({ ok: true, game: candidate })) : fail('invalid-input');
    if (game.notebook.hypotheses.length >= 64) return fail('invalid-state');
    const choice = authoredAction(registry, game, 'hypothesis');
    if (!choice || !['FACT-endpoints', 'FACT-endpoint-a', 'FACT-endpoint-b', 'FACT-path'].every(id => game.notebook.factIds.includes(q<'fact'>(id)))) return fail('precondition');
    const hypothesis = { id: operation.id, text: operation.text, subjectIds: [q('R02'), q('PR012')], status: 'open' as const };
    return prepared(choice.effects as StateEffect[], candidate => ({ ok: true, game: { ...candidate,
      notebook: { ...candidate.notebook, hypotheses: [...candidate.notebook.hypotheses, hypothesis] } } }));
  }
  if (game.notebook.measurements.some(m => m.id === operation.id)) return fail('invalid-input');
  if (game.notebook.measurements.length >= 512) return fail('invalid-state');
  const choice = authoredAction(registry, game, 'inspection');
  if (!choice || !game.world.inventory.some(item => item.itemId === q('ITEM-inspection-kit') && item.quantity >= 1)) return fail('precondition');
  const challenge = introductionCopperChallenge(registry, game);
  if (!challenge) return fail('content-error');
  const measurementId = operation.id;
  return prepared(choice.effects as StateEffect[], candidate => {
    // Evaluate AFTER canonical marker application at the actual candidate version.
    // An invalid profile/result rejects the entire transaction, including that marker.
    const evaluation = evaluateCopper(challenge, { actionId: measurementId as unknown as ActionId,
      expectedVersion: candidate.world, input: { kind: 'measure-length' } }, candidate.world);
    if (evaluation.status === 'content-error' || evaluation.status === 'invalid-input') return fail(evaluation.status);
    const observation = evaluation.observations[0];
    if (evaluation.observations.length !== 1 || observation?.kind !== 'copper-length') return fail('content-error');
    const measurement: Measurement = {
      id: measurementId, roomId: candidate.world.roomId, ruleId: q('PHY04') as RuleId,
      subjectIds: [q('PR003'), q('PROFILE-COPPER-100')], ...observation.version, stale: false,
      readings: [{ name: 'Channel length', ...observation.total }, { name: 'Inclusive maximum', ...observation.maximum },
        'excess' in observation ? { name: 'Excess', ...observation.excess } : { name: 'Headroom', ...observation.headroom }],
      conclusionCode: evaluation.reasonCode,
    };
    return { ok: true, game: { ...candidate, notebook: { ...candidate.notebook, measurements: [...candidate.notebook.measurements, measurement] } } };
  });
}
