// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Independent behavior tests, NOT EXECUTED during preparation. The future adapter
// must drive the real party/reducer/controller and real authored demonstrations.
// No fake implementation or fixture-only party mutation may be plugged in.
import { describe, expect, it } from 'vitest';
import type { CharacterId } from '../../../../src/domain/types';
import type { RuntimeState } from '../../../../src/state/types';

const recruits = ['CH03', 'CH04', 'CH05', 'CH06', 'CH07', 'CH16', 'CH19', 'CH20', 'CH22'] as const;
type Recruit = typeof recruits[number];
type Result = { readonly status: 'handled' | 'unavailable' | 'rejected'; readonly reason?: string };
const q = (id: Recruit) => `spec001:${id}` as CharacterId;
export interface PartyRuntimeContractHarness {
  /** Authoritative store snapshots, never a synthesized view of test intentions. */
  state(): RuntimeState;
  /** Actual Look/Talk or the bounded party encounter interaction in authored home. */
  encounter(character: Recruit): Result;
  /** Drive the actual canonical preparation controls and measure, retaining history. */
  demonstrateRecruitment(character: Recruit): void;
  /** Real walk to a declared home room; measurements should become historical. */
  returnHome(character: Recruit): void;
  invite(character: Recruit): Result;
  beginPractice(character: Recruit): Result;
  /** Distinct real post-recruit bench interaction; no directly supplied verdict. */
  demonstrateProgression(character: Recruit): void;
  advance(character: Recruit): Result;
  setActive(characters: readonly Recruit[]): Result;
  /** Bind a callback to the existing authoritative projection before replacing it. */
  captureSetActive(characters: readonly Recruit[]): () => Result;
  /** Only these explicit adverse activity inputs may be supplied by unit harness. */
  supplyActivity(kind: 'active-encounter' | 'terminal-failure' | 'shutdown' | 'pending-effect'): void;
  /** Use real navigation to an authored safe preparation anchor. */
  returnToPreparation(): void;
  /** Validate/capture and restore actual save snapshot via the application boundary. */
  saveAndRestore(): void;
  /** Counts effects observed at the real external save service port. */
  saveWrites(): number;
}
export type PartyRuntimeContractFactory = () => PartyRuntimeContractHarness;

/** Call only after the production adapter exists. Test bodies are not TODO passes. */
export function runPartyRuntimeContract(create: PartyRuntimeContractFactory): void {
  const recruit = (f: PartyRuntimeContractHarness, character: Recruit) => {
    expect(f.encounter(character).status).toBe('handled');
    f.demonstrateRecruitment(character); f.returnHome(character);
    expect(f.invite(character).status).toBe('handled');
  };
  const progress = (f: PartyRuntimeContractHarness, character: Recruit) => {
    expect(f.beginPractice(character).status).toBe('handled');
    f.demonstrateProgression(character);
    expect(f.advance(character).status).toBe('handled');
  };
  describe('T094 independent real party runtime contract', () => {
    it.each(recruits)('%s: encounter alone awards neither recruitment nor a usable ability', character => {
      const f = create(); f.encounter(character);
      expect(f.state().game!.world.recruits).toEqual([]);
      expect(f.invite(character).status).not.toBe('handled');
      expect(f.state().game!.world.activeAllyIds).toEqual([]);
    });
    it.each(recruits)('%s: valid demonstrated invitation is singular and does not silently activate an ally', character => {
      const f = create(); recruit(f, character);
      const before = structuredClone(f.state().game!);
      const row = before.world.recruits.find(r => r.characterId === q(character));
      expect(row?.level).toBe(1); expect(row?.abilityIds.length).toBeGreaterThan(0);
      expect(before.world.activeAllyIds).toEqual([]);
      f.invite(character);
      expect(f.state().game).toEqual(before);
      expect(f.saveWrites()).toBe(0);
    });
    it.each(recruits)('%s: repeating recruitment evidence does not itself earn meaningful progression', character => {
      const f = create(); recruit(f, character);
      const before = structuredClone(f.state().game!);
      expect(f.advance(character).status).not.toBe('handled');
      expect(f.state().game).toEqual(before);
      expect(f.beginPractice(character).status).toBe('handled');
      expect(f.advance(character).status).not.toBe('handled');
      expect(f.state().game).toEqual(before);
    });
    it.each(recruits)('%s: explicit post-recruit demonstration unlocks a new useful ability exactly once', character => {
      const f = create(); recruit(f, character);
      const previous = structuredClone(f.state().game!.world.recruits.find(r => r.characterId === q(character))!);
      progress(f, character);
      const current = f.state().game!.world.recruits.find(r => r.characterId === q(character))!;
      expect(current.level).toBe(2);
      expect(current.abilityIds.length).toBeGreaterThan(previous.abilityIds.length);
      expect(previous.abilityIds.every(id => current.abilityIds.includes(id))).toBe(true);
      const once = structuredClone(f.state().game!);
      f.advance(character); expect(f.state().game).toEqual(once);
      expect(f.saveWrites()).toBe(0);
    });
    it('keeps zero active allies valid, accepts two unique recruits, and rejects a third without silent eviction', () => {
      const f = create();
      expect(f.setActive([]).status).toBe('handled');
      for (const character of ['CH03', 'CH04', 'CH19'] as const) recruit(f, character);
      f.returnToPreparation();
      expect(f.setActive(['CH03', 'CH04']).status).toBe('handled');
      const before = structuredClone(f.state());
      expect(f.setActive(['CH03', 'CH04', 'CH19']).status).not.toBe('handled');
      expect(f.state()).toEqual(before);
    });
    it('rejects duplicate and unrecruited active identities atomically', () => {
      const f = create(); recruit(f, 'CH03'); f.returnToPreparation();
      f.setActive(['CH03']); const before = structuredClone(f.state());
      expect(f.setActive(['CH03', 'CH03']).status).not.toBe('handled');
      expect(f.state()).toEqual(before);
      expect(f.setActive(['CH03', 'CH19']).status).not.toBe('handled');
      expect(f.state()).toEqual(before);
    });
    it('swaps freely in preparation, preserves inventory, advances configuration once and stales measurements without a save', () => {
      const f = create();
      for (const character of ['CH03', 'CH04', 'CH19'] as const) recruit(f, character);
      f.returnToPreparation(); f.setActive(['CH03', 'CH04']);
      const before = structuredClone(f.state()), writes = f.saveWrites();
      expect(f.setActive(['CH04', 'CH19']).status).toBe('handled');
      expect(f.state().game!.world.activeAllyIds).toEqual([q('CH04'), q('CH19')]);
      expect(f.state().game!.world.inventory).toEqual(before.game!.world.inventory);
      expect(f.state().game!.world.configurationRevision).toBe(before.game!.world.configurationRevision + 1);
      expect(f.state().game!.notebook.measurements.length).toBeGreaterThan(0);
      expect(f.state().game!.notebook.measurements.every(m => m.stale)).toBe(true);
      expect(f.saveWrites()).toBe(writes);
    });
    it.each(['active-encounter', 'terminal-failure', 'shutdown', 'pending-effect'] as const)('rejects swaps during %s without broadening the active encounter policy', kind => {
      const f = create(); recruit(f, 'CH03'); recruit(f, 'CH04');
      f.returnToPreparation(); f.setActive(['CH03']); f.supplyActivity(kind);
      const before = structuredClone(f.state());
      expect(f.setActive(['CH04']).status).not.toBe('handled');
      expect(f.state()).toEqual(before);
    });
    it('invalidates a captured party control after Restore even with the same adventure and configuration', () => {
      const f = create(); recruit(f, 'CH03'); f.returnToPreparation();
      const captured = f.captureSetActive(['CH03']); f.saveAndRestore();
      const before = structuredClone(f.state());
      expect(captured().status).not.toBe('handled'); expect(f.state()).toEqual(before);
    });
    it('persists completed levels and the active pair, while unfinished practice must restart after Restore', () => {
      const f = create(); recruit(f, 'CH03'); recruit(f, 'CH19'); progress(f, 'CH03');
      f.returnToPreparation(); f.setActive(['CH03', 'CH19']);
      f.beginPractice('CH19'); f.demonstrateProgression('CH19');
      const before = structuredClone(f.state().game!.world); f.saveAndRestore();
      expect(f.state().game!.world.recruits).toEqual(before.recruits);
      expect(f.state().game!.world.activeAllyIds).toEqual(before.activeAllyIds);
      expect(f.advance('CH19').status).not.toBe('handled');
      expect(f.state().game!.world.recruits).toEqual(before.recruits);
    });
  });
}
