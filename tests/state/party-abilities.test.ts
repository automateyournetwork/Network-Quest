// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { partyFixture, q, registry, recruit, scenario } from './party-fixture';
import type { Recruit } from './party-fixture';
import { conventionalAbilityOperation, partyCharacter } from '../../src/state/party';
import type { ActionId, AbilityId, MeasurementId, QualifiedId } from '../../src/domain/types';
const ids: Recruit[]=['CH03','CH04','CH05','CH06','CH07','CH16','CH19','CH20','CH22'];
const roomFor=(id:string)=>id.startsWith('ACTION-O04')?'R04':id.startsWith('ACTION-O06')?'R06':id.startsWith('ACTION-O08')?'R08':id.startsWith('ACTION-O09')?'R09':id==='ACTION-read-PROFILE-OPTICAL'?'R06'
 :id.startsWith('ACTION-copper-')? /repeater|read-before/.test(id)?'R04':'R03':id.startsWith('ACTION-fiber-')? /path-|read-compatibility/.test(id)?'R06':'R05':id.startsWith('ACTION-radio-')? /channel-|noise|emitter|boundary/.test(id)?'R08':'R07':'R09';
describe('Every authored ally operation uses the same canonical operation and effects',()=>{
  it.each(ids)('%s: both earned abilities and every authored action match conventional reduction',character=>{
    const f=partyFixture();recruit(f,character);f.beginPractice(character);f.demonstrateProgression(character);expect(f.advance(character).status).toBe('handled');f.setActive([character]);
    const record=partyCharacter(registry,q(character))!;let exercised=0;
    for(const ability of record.abilities)for(const authored of ability.conventionalEquivalentActionIds??[]){
      f.demonstrateRecruitment(character);const id=authored.slice(8);f.walk(roomFor(id));
      if(/^ACTION-fiber-(profile-|inspect-before)/.test(id))f.action('ACTION-fiber-restore-original');
      if(id==='ACTION-O06-passive-path-B')f.action('ACTION-fiber-path-B');
      if(id==='ACTION-O08-scenario-channel-B')f.action('ACTION-radio-channel-B');
      if(id==='ACTION-O09-compatible-kit-B')f.action('ACTION-market-compatible-kit-B');
      const before=f.reducerState(),game=before.runtime.game!,measurementId=crypto.randomUUID() as MeasurementId;
      const normal=conventionalAbilityOperation(registry,scenario,game,authored as QualifiedId,measurementId);expect(normal,authored).not.toBeNull();
      const command={actionId:crypto.randomUUID() as ActionId,adventureId:game.adventureId,expectedVersion:game.world};
      const conventional=f.store.reduce(before,{...command,input:normal!});
      const ally=f.store.reduce(before,{...command,input:{kind:'party',operation:{kind:'ability',characterId:q(character),abilityId:ability.id as AbilityId,actionId:authored as QualifiedId,measurementId}}});
      expect(conventional.status,authored).not.toBe('rejected');expect(ally,authored).toEqual(conventional);exercised++;
    }
    expect(exercised).toBe(record.abilities.flatMap(a=>a.conventionalEquivalentActionIds??[]).length);
  });
  it('cannot manufacture a held inspection kit, a verdict, an unlock or a foreign action',()=>{
    const f=partyFixture();recruit(f,'CH03');f.setActive(['CH03']);f.walk('R05');f.action('ACTION-fiber-restore-original');
    const before=f.reducerState(),game=before.runtime.game!;f.replace({...before,runtime:{...before.runtime,game:{...game,world:{...game.world,inventory:[]}}}});
    const untouched=structuredClone(f.state());const base={kind:'use-ally-ability' as const,characterId:q<'character'>('CH03'),abilityId:q<'ability'>('ABILITY-CH03-optical-checklist'),actionId:q('ACTION-fiber-inspect-before')};
    expect(f.dispatch(base).status).not.toBe('handled');expect(f.dispatch({...base,abilityId:q('ABILITY-CH03-explain')}).status).not.toBe('handled');
    expect(f.dispatch({...base,actionId:q('ACTION-market-compatible-kit-A')}).status).not.toBe('handled');
    expect(f.dispatch({...base,verdict:'correct'} as never).status).toBe('rejected');expect(f.state()).toEqual(untouched);
  });
  it('keeps the advanced Hydra profile context read distinct and free of physical/progression effects',()=>{
    const f=partyFixture();recruit(f,'CH06');f.beginPractice('CH06');f.demonstrateProgression('CH06');f.advance('CH06');f.setActive(['CH06']);f.walk('R06');const before=structuredClone(f.state().game);
    const result=f.dispatch({kind:'use-ally-ability',characterId:q('CH06'),abilityId:q('ABILITY-CH06-explain'),actionId:q('ACTION-read-PROFILE-OPTICAL')});
    expect(result.status).toBe('handled');expect('message' in result&&result.message).toContain('Reading a profile is context only');expect(f.state().game).toEqual(before);
    expect(f.controller.project().view.rows[0]?.explanation).toMatch(/modes|lanes/i);
  });
});
