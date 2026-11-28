// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadIntroductionContent } from '../../src/app/content';
import { introductionSavePolicy } from '../../src/app/save-policy';
import { conditionSatisfied } from '../../src/state/conditions';
import { createSpec001SaveReader } from '../../src/state/migrations/spec001';
import fixture from '../fixtures/migrations/spec001.json' with { type: 'json' };
import { arrival, balcony, historicalBytes } from '../fixtures/migrations/spec001-cases';

const { registry, world } = loadIntroductionContent();
const reader = createSpec001SaveReader(introductionSavePolicy(registry, world));

describe('SAVE11 / AC13 hypothetical prior content in the current Spec001 reader', () => {
  for (const [name, record] of [['signal ledge', balcony], ['instrument bench', arrival]] as const) {
    it(`relocates the ${name} and preserves the complete independent adventure`, () => {
      const raw = historicalBytes(record.prior);
      const result = reader.read(Buffer.from(raw));
      if (result.status !== 'ready') throw new Error(`Historical read returned ${result.status}`);
      expect(result.migrated).toBe(true);
      expect(Buffer.from(result.originalBytes).toString()).toBe(raw);
      expect(result.snapshot).toEqual(record.expected);
      for (const sentence of record.explanation) expect(result.explanations.join(' ')).toContain(sentence);
      expect(result.explanations.join(' ')).toMatch(/observations remain in the notebook.*new measurements/i);
      const reread = reader.read(Buffer.from(JSON.stringify(result.snapshot)));
      expect(reread).toMatchObject({ status: 'ready', migrated: false, explanations: [], snapshot: record.expected });
    });
  }

  it('leaves the newly visible Iron City gate closed for an apprentice who already finished O12', () => {
    const result = reader.read(Buffer.from(historicalBytes(balcony.prior)));
    if (result.status !== 'ready') throw new Error('Expected the Iron Threshold adventure');
    const { currentId, unplayedQuestId } = fixture.policy.futureDoor;
    const room = registry.record(result.snapshot.world.roomId);
    if (room?.kind !== 'room') throw new Error('Expected an authored room');
    expect(room.futureDoorIds).toContain(currentId);
    expect(room.exits.map(exit => exit.toRoomId)).toEqual(['spec001:R11']);
    const gate = room.hotspots.find(hotspot => hotspot.label === 'Iron City boundary gate');
    expect(gate).toMatchObject({ verbs: ['look'], evidenceIds: [], actionIds: [] });
    expect(conditionSatisfied({ kind: 'future-door-open', futureDoorId: currentId }, result.snapshot.world, registry)).toBe(false);
    expect(result.snapshot.world.completedObjectiveIds).toEqual(balcony.prior.world.completedObjectiveIds);
    expect(result.snapshot.world.completedQuestIds).not.toContain(unplayedQuestId);
    expect(result.snapshot.world.achievementIds).toEqual(balcony.prior.world.achievementIds);
  });

  it('returns an interrupted read without exposing a candidate and allows retry from the original bytes', () => {
    const raw = historicalBytes(arrival.prior);
    const interrupted = reader.read(Buffer.from(raw), AbortSignal.abort());
    expect(interrupted).toMatchObject({ status: 'interrupted', canReplace: false, canAutosave: false });
    expect(interrupted).not.toHaveProperty('snapshot');
    expect(Buffer.from(interrupted.originalBytes).toString()).toBe(raw);
    expect(reader.read(Buffer.from(interrupted.originalBytes))).toMatchObject({ status: 'ready', snapshot: arrival.expected });
  });

  it.each(fixture.unknownNewer)('protects every byte of $description', opaque => {
    const received = Buffer.from(opaque.rawUtf8);
    const result = reader.read(received);
    received.fill(0);
    expect(result).toMatchObject({ status: 'unsupported', reason: opaque.reason, updateNeeded: true, canReplace: false, canAutosave: false });
    expect(result).not.toHaveProperty('snapshot');
    const original = Buffer.from(result.originalBytes);
    expect(original.byteLength).toBe(opaque.byteLength);
    expect(createHash('sha256').update(original).digest('hex')).toBe(opaque.sha256);
    expect(original.toString()).toBe(opaque.rawUtf8);
  });
});
