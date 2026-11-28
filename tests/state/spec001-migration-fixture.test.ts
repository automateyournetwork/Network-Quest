// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/migrations/spec001.json' with { type: 'json' };
import artifact from '../../server/content/save-policy.generated.json' with { type: 'json' };
import { loadIntroductionContent } from '../../src/app/content';
import { introductionSavePolicy } from '../../src/app/save-policy';
import { SaveValidator } from '../../src/services/save-validator';
import type { SaveContentPolicy, SaveMemberKind } from '../../src/services/save-validator';

const { world, registry } = loadIntroductionContent();
const current = introductionSavePolicy(registry, world);
const bytes = (value: unknown) => new TextEncoder().encode('\n  ' + JSON.stringify(value, null, 2) + '\r\n');

// The hypothetical historical catalog has the stated differences only. This
// test interprets policy metadata, never reads or transforms snapshot fields.
function historicalCatalog(): SaveContentPolicy {
  const old = structuredClone(current);
  old.contentVersion = fixture.policy.fromVersion;
  for (const rename of fixture.policy.renames) {
    for (const role of rename.memberKinds as SaveMemberKind[]) {
      expect(old.members[role]).toContain(rename.current);
      expect(old.members[role]).not.toContain(rename.prior);
      old.members[role] = old.members[role].map(id => id === rename.current ? rename.prior : id);
    }
  }
  const item = fixture.policy.renames.find(rename => rename.memberKinds.includes('item'))!;
  old.itemMaxQuantities[item.prior] = old.itemMaxQuantities[item.current]!;
  delete old.itemMaxQuantities[item.current];
  for (const position of fixture.policy.relocations) {
    const anchor = current.safePositions[position.safePositionId]!;
    expect(anchor).toEqual({ roomId: position.roomId, eligibleStates: position.eligibleStates });
    expect(current.safePositions[position.priorPositionId]).toBeUndefined();
    if (!position.targetExistsInPrior) delete old.safePositions[position.safePositionId];
    old.safePositions[position.priorPositionId] = { roomId: position.priorRoomId, eligibleStates: anchor.eligibleStates };
  }
  return old;
}

function withRevisit(
  base: typeof fixture.input, changes: typeof fixture.revisit.inputOverrides,
) {
  return { ...base, safeState: changes.safeState, world: { ...base.world, ...changes.world },
    notebook: { ...base.notebook, measurements: [...base.notebook.measurements, changes.appendMeasurement] } };
}

describe('T142 independent Spec001 compatibility fixture', () => {
  const prior = new SaveValidator([historicalCatalog()]);
  const writable = new SaveValidator([current]);

  it('uses the normal twelve-room game catalog and the server write-policy artifact', () => {
    expect(world.rooms).toHaveLength(12);
    expect(world.documents).toHaveLength(142);
    expect(artifact.policies).toEqual([current]);
    expect(current.contentVersion).toBe(fixture.policy.toVersion);
    expect(world.futureDoors.find(door => door.id === fixture.policy.futureDoor.currentId)).toMatchObject({
      roomId: fixture.policy.futureDoor.currentRoomId, targetEpisodeId: fixture.policy.futureDoor.targetEpisodeId,
      traversable: false, requiredForMainStory: false,
    });
    expect(registry.record(fixture.policy.futureDoor.unplayedQuestId)?.kind).toBe('quest');
  });

  it.each([
    ['completed balcony', fixture.input, fixture.expected],
    ['return to arrival bench', withRevisit(fixture.input, fixture.revisit.inputOverrides), withRevisit(fixture.expected, fixture.revisit.expectedOverrides)],
  ] as const)('validates both independently specified snapshots for %s and rejects cross-version writes', (_name, before, after) => {
    expect(prior.validateNewWrite(bytes(before))).toMatchObject({ ok: true, candidate: before });
    expect(writable.validateNewWrite(bytes(after))).toMatchObject({ ok: true, candidate: after });
    expect(writable.validateNewWrite(bytes(before))).toMatchObject({ ok: false, code: 'content-version' });
    expect(prior.validateNewWrite(bytes(after))).toMatchObject({ ok: false, code: 'content-version' });
    // Changing a version header alone leaves invalid source-side/destination-side names.
    expect(writable.validateNewWrite(bytes({ ...before, contentVersion: current.contentVersion }))).toMatchObject({ ok: false, code: 'reference' });
    expect(prior.validateNewWrite(bytes({ ...after, contentVersion: fixture.policy.fromVersion }))).toMatchObject({ ok: false, code: 'reference' });
  });

  it('retains the exact ordered history, notes and party throughout the independent expectations', () => {
    const { input, expected } = fixture;
    expect(expected.adventureId).toBe(input.adventureId);
    expect(expected.world).toMatchObject({
      attemptId: input.world.attemptId, flags: input.world.flags, completedObjectiveIds: input.world.completedObjectiveIds,
      completedQuestIds: input.world.completedQuestIds, achievementIds: input.world.achievementIds, recruits: input.world.recruits,
      activeAllyIds: input.world.activeAllyIds, compendiumIds: input.world.compendiumIds, route: 'copper', continueOutcome: 'E02',
    });
    expect(expected.world.activeAllyIds).toEqual(['spec001:CH19', 'spec001:CH04']);
    expect(expected.world.recruits.map(r => r.level)).toEqual([2, 1]);
    expect(expected.world.completedObjectiveIds).toContain('spec001:O12');
    expect(expected.world.completedQuestIds).toEqual(['spec001:SQ01']);
    expect(expected.world.achievementIds).toEqual(['spec001:ACHIEVEMENT-MG01-complete']);
    expect(expected.world.inventory).toEqual([{ itemId: 'spec001:ITEM-inspection-kit', quantity: 1 }]);
    expect(expected.world.dialogueEffectIds).toEqual(['spec001:EFFECT-repair-execute-copper-section', 'spec001:EFFECT-repair-classify-temporary']);
    expect(expected.notebook.personalNotes).toBe(input.notebook.personalNotes);
    expect(expected.notebook.personalNotes).toContain('spec001:ITEM-field-case');
    expect(expected.notebook.hypotheses).toEqual(input.notebook.hypotheses);
    expect(expected.assistance).toEqual(input.assistance);
    expect(expected.outcomeHistory).toEqual([input.outcomeHistory[0], { ...input.outcomeHistory[1], caveatIds: ['spec001:FACT-repair-maintenance'] }]);
    expect(expected.notebook.factIds).toEqual(input.notebook.factIds.map(id => id === 'spec001:FACT-bypass-followup' ? 'spec001:FACT-repair-maintenance' : id));
    expect(expected.notebook.mapRoomIds).toEqual(input.notebook.mapRoomIds.map(id => id === 'spec001:R12-balcony' ? 'spec001:R12' : id));
    expect(expected.notebook.measurements).toEqual(input.notebook.measurements.map(m => ({
      ...m, roomId: m.roomId === 'spec001:R12-balcony' ? 'spec001:R12' : m.roomId,
      subjectIds: m.subjectIds.map(id => id === 'spec001:R12-balcony' ? 'spec001:R12' : id),
    })));
    expect(expected.world.configurationRevision).toBe(56);
    expect(JSON.stringify(expected)).not.toContain(fixture.policy.futureDoor.currentId);
    expect(expected.world.completedQuestIds).not.toContain(fixture.policy.futureDoor.unplayedQuestId);
  });

  it('covers an already-stale ending and a distinct, actually current measurement on a later visit', () => {
    const fresh = fixture.revisit.inputOverrides, relocated = fixture.revisit.expectedOverrides;
    expect(fixture.input.notebook.measurements.every(m => m.stale)).toBe(true);
    expect(fresh.appendMeasurement).toMatchObject({ stale: false, attemptId: fixture.input.world.attemptId,
      roomId: fresh.world.roomId, configurationRevision: fresh.world.configurationRevision });
    expect(relocated.world.configurationRevision).toBe(71);
    expect(relocated.appendMeasurement).toEqual({ ...fresh.appendMeasurement, stale: true });
  });

  it.each(fixture.unknownNewer)('pins the exact UTF-8 length and digest of $description', opaque => {
    const raw = Buffer.from(opaque.rawUtf8, 'utf8');
    expect(raw.length).toBe(opaque.byteLength);
    expect(createHash('sha256').update(raw).digest('hex')).toBe(opaque.sha256);
    expect(JSON.stringify(JSON.parse(opaque.rawUtf8))).not.toBe(opaque.rawUtf8);
  });
});
