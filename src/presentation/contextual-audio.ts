// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { outcomeAudioEvents } from './outcome-audio-events';
import { measuredMarketShortfall } from './equipment-audio-events';
import { opticalAudioEvents } from './optical-audio-events';
import { radioAudioEvents } from './radio-audio-events';
import type { RuntimeState } from '../state/types';
import type { SemanticAction, ActionResult } from '../ui/action-bus';
import type { ContentRegistry } from '../content/registry';
import type { AudioChannel } from './audio';

export interface ContextualCue {
  assetId: string; roomId: string; exportPath: string; channel: AudioChannel;
  label: string; text: string; loop: boolean; trigger: string; captionId: string;
}
const files = import.meta.glob<ContextualCue[]>('../../content/spec001/presentation/R??.audio.json', { eager: true, import: 'default' });
export function roomCues(roomId: string | null, registry?: ContentRegistry): readonly ContextualCue[] {
  if (!roomId || !/^spec001:R(?:0[1-9]|1[0-2])$/.test(roomId)) return [];
  const rows = files[`../../content/spec001/presentation/${roomId.slice(8)}.audio.json`] ?? [];
  const room = registry?.record(roomId);
  if (!registry) return [];
  if (room?.kind !== 'room') throw new Error('Unknown audio room');
  for (const row of rows) {
    const binding = room.mediaBindings?.find(b => b.assetId === row.assetId);
    const use = row.channel === 'voice' ? 'voice-line' : row.channel === 'music' ? 'music' : row.loop ? 'ambience' : 'effect';
    if (binding?.use !== use || binding.exportPath !== row.exportPath || binding.contentId !== (use === 'voice-line' ? row.captionId : room.id)) throw new Error('Audio cue differs from room registration');
    if (use === 'voice-line') {
      const dialogue = registry.record(row.captionId.replace('DIALOGUE-VOICE-', 'DIALOGUE-media-'));
      if (dialogue?.kind !== 'dialogue' || !dialogue.nodes.some(n => n.id === row.captionId && n.text === row.text)) throw new Error('Spoken text differs from registered caption');
    }
    if (row.roomId !== roomId || !/^spec001:ASSET-(MUSIC|AMBIENCE|EFFECT|VOICE)-[A-Za-z0-9-]+$/.test(row.assetId)
      || !/^public\/assets\/audio\/(music|ambience|effects|voices|auditions)\/[a-z0-9-]+\.mp3$/.test(row.exportPath)
      || !row.text.trim() || !row.label.trim() || !row.captionId || !['voice','music','effects'].includes(row.channel)) {
      throw new Error('Invalid room sound registration');
    }
  }
  return rows;
}
/** Translate committed state changes into optional presentation only. Restores, room changes
 * and retries are separate baselines. An old receipt or retained note is never a new success. */
export function committedSoundEvents(before: RuntimeState | undefined, after: RuntimeState) {
  const events = new Set(outcomeAudioEvents(before, after)), old = before?.game, game = after.game;
  if (!game || !old || game.adventureId !== old.adventureId || game.world.roomId !== old.world.roomId ||
    game.world.attemptId !== old.world.attemptId || before.auth.clientGeneration !== after.auth.clientGeneration) return events;
  if (measuredMarketShortfall(old, game)) events.add('measurement/O09-original-shortfall');
  for (const event of opticalAudioEvents(old, game)) events.add(event);
  for (const event of radioAudioEvents(old, game)) events.add(event);
  for (const id of game.notebook.factIds) if (!old.notebook.factIds.includes(id)) { events.add('fact/' + id); events.add('added/fact'); }
  if (game.notebook.hypotheses.some(h => !old.notebook.hypotheses.some(p => p.id === h.id))) events.add('added/hypothesis');
  if (game.notebook.hypotheses.some(h => h.status === 'rejected' && old.notebook.hypotheses.some(p => p.id === h.id && p.status !== h.status))) events.add('hypothesis-rejected');
  if (game.world.inventory.some(i => i.quantity > (old.world.inventory.find(p => p.itemId === i.itemId)?.quantity ?? 0))) events.add('added/item');
  if (game.assistance.length > old.assistance.length) events.add('added/hint');
  const indicators = ['spec001:FACT-power','spec001:FACT-link'];
  if (indicators.every(id => game.notebook.factIds.some(f => f === id)) && indicators.some(id => events.has('fact/' + id))) events.add('both-indicators');
  const ack = after.persistence.lastAcknowledgement, pending = before.persistence.pendingRequest;
  if (ack && pending && ack.requestId === pending.requestId && ack.requestId !== before.persistence.lastAcknowledgement?.requestId) events.add('acknowledged-save');
  for (const id of game.world.completedObjectiveIds) if (!old.world.completedObjectiveIds.includes(id)) events.add('objective/' + id);
  for (const id of game.world.completedQuestIds) if (!old.world.completedQuestIds.includes(id)) events.add('quest/' + id);
  return events;
}
export function actionSoundEvents(input: SemanticAction, result: ActionResult, state: RuntimeState) {
  const events = new Set<string>();
  if (result.status !== 'handled') {
    if (result.reason === 'interaction-unavailable' || result.reason === 'unsupported-verb') events.add('unsupported');
    if (result.reason === 'content-error') events.add('content-error');
    return events;
  }
  events.add('act/' + input.kind);
  if (input.kind === 'choose-hotspot-action') {
    events.add('choice/' + input.choiceId);
    if (/^spec001:ACTION-clock-sample-[0-3]$/.test(input.choiceId)) events.add('clock-step');
  }
  if (input.kind === 'use-ally-ability') events.add('ability/' + input.abilityId);
  if (input.kind === 'select-verb') events.add('verb/' + input.verb);
  if (input.kind === 'open-panel' && state.ui?.panel === input.panel) events.add('panel/' + input.panel);
  if (input.kind === 'interact' || input.kind === 'choose-hotspot-action') {
    events.add(input.verb + '/' + input.targetId);
    if (input.verb === 'walk' && !/^spec001:R(?:0[1-9]|1[0-2])$/.test(input.targetId)) events.add('walk');
  }
  if (input.kind === 'inspect-evidence' && state.game?.notebook.measurements.some(m => m.id === input.evidenceId && m.stale)) events.add('inspect-stale');
  return events;
}
