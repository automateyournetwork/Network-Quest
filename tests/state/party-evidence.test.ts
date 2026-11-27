// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { partyFixture, q, registry, recruit } from './party-fixture';
import type { Recruit } from './party-fixture';
import { historicalPartyMeasurement, partyObjective } from '../../src/state/party';
import type { Measurement } from '../../src/state/types';
const ids: Recruit[] = ['CH03','CH04','CH05','CH06','CH07','CH16','CH19','CH20','CH22'];
const corruptions: { name: string; change: (m: Measurement) => Measurement }[] = [
  { name: 'wrong rule', change: m => ({ ...m, ruleId: q<'rule'>('PHY01') }) },
  { name: 'wrong room', change: m => ({ ...m, roomId: q<'room'>('R01') }) },
  { name: 'missing composite subject', change: m => ({ ...m, subjectIds: m.subjectIds.slice(1) }) },
  { name: 'invented accepted conclusion', change: m => ({ ...m, conclusionCode: 'already-complete' }) },
  { name: 'wrong reading unit', change: m => ({ ...m, readings: m.readings.map((r, i) => i ? r : { ...r, unit: 'invented' as never }) }) },
  { name: 'corrupted checked reading', change: m => ({ ...m, readings: m.readings.map((r, i) => i ? r : { ...r, value: 999999 as never }) }) },
];
describe('Historical party evidence is scoped learning, never current repair proof', () => {
  for (const character of ids) it.each(corruptions)(`${character} refuses $name`, ({change}) => {
    const f=partyFixture(); f.encounter(character); f.demonstrateRecruitment(character); f.returnHome(character);
    const state=f.reducerState(),game=state.runtime.game!,objective=partyObjective(q(character))!;
    const original=[...game.notebook.measurements].reverse().find(m=>historicalPartyMeasurement(registry,game,objective,m))!;
    const mutated=change(original); f.replace({...state,runtime:{...state.runtime,game:{...game,notebook:{...game.notebook,measurements:game.notebook.measurements.map(m=>m===original?mutated:m)}}}});
    const before=structuredClone(f.state()); expect(f.invite(character).status).not.toBe('handled'); expect(f.state()).toEqual(before);
  });
  it.each(['CH03','CH16'] as const)('%s: missing inspection/cleaning is not the promised compatibility comparison', character=>{
    const f=partyFixture();recruit(f,character);f.beginPractice(character);f.walk('R05');f.action('ACTION-fiber-restore-original');f.action('ACTION-fiber-profile-matched');f.measure('O05');f.fiber();f.measure('O05');
    expect(f.advance(character).status).not.toBe('handled');expect(f.state().game!.world.recruits[0]!.level).toBe(1);
    f.demonstrateProgression(character);expect(f.advance(character).status).toBe('handled');
  });
  it('Echo requires the actual wrong/correct repeater-role comparison, not merely an open conductor',()=>{
    const f=partyFixture();recruit(f,'CH20');f.beginPractice('CH20');f.walk('R03');f.action('ACTION-copper-restore-original');f.measure('O03');f.measure('O04');f.walk('R03');f.action('ACTION-copper-replace-section');f.measure('O04');
    expect(f.advance('CH20').status).not.toBe('handled');f.demonstrateProgression('CH20');expect(f.advance('CH20').status).toBe('handled');
  });
  it('Photon does not progress by reusing completed-practice records after a new practice starts',()=>{
    const f=partyFixture();recruit(f,'CH03');f.beginPractice('CH03');f.demonstrateProgression('CH03');f.beginPractice('CH03');expect(f.advance('CH03').status).not.toBe('handled');
  });
  it('discovery is not inferred by walking into an authored home',()=>{
    const f=partyFixture();f.walk('R05');f.demonstrateRecruitment('CH03');expect(f.invite('CH03').status).not.toBe('handled');expect(f.state().game!.world.compendiumIds).toEqual([q('COMPENDIUM-CH01')]);
  });
});
