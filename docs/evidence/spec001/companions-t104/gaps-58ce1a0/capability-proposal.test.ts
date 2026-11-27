// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Trusted adapter proposal only: no source/profile/UI authority is broadened.
import { describe, expect, it } from 'vitest';
import { fixture, scenario, registry, q, uuid } from '../../../../../tests/state/objectives-fixture';
import { evaluateObjective } from '../../../../../src/state/objectives';
import type { ObjectiveScenario } from '../../../../../src/state/objectives';
import type { ActionId } from '../../../../../src/domain/types';
import { copySemanticAction } from '../../../../../src/ui/action-bus';
const mode=(value:number,duplex:'full'|'half'='full')=>({rate:{value,unit:'Mb/s' as const},duplex});
const result=(capability:unknown)=>{const base=scenario('O09');if(base.kind!=='equipment')throw new Error('Wrong objective');const f=fixture('O09',{...base,capability} as ObjectiveScenario);const game=f.store.getState().runtime.game!;
  return {f,evaluation:evaluateObjective(registry,f.resolver,game,q('O09'),{actionId:'capability-guard' as ActionId,expectedVersion:game.world,input:{kind:'measure',alternativeId:base.alternativeId,id:uuid()}})};};
describe('isolated trusted paired advertisements adapter proposal',()=>{
  it('keeps omitted sets identical to the complete canonical reviewed advertisements',()=>{
    const base={bothNegotiate:true,selected:mode(100)};
    const omitted=result(base),explicit=result({...base,endpointA:[mode(1000),mode(100)],endpointB:[mode(100),mode(10,'half')]});
    // Fixture adventure IDs differ but scoped evaluator values and version match.
    expect(omitted.evaluation).toEqual(explicit.evaluation);expect(omitted.evaluation.status).toBe('correct');
  });
  it('executes disjoint reviewed subsets through the real objective and cannot award readiness',()=>{
    const {f,evaluation}=result({bothNegotiate:true,selected:mode(100),endpointA:[mode(100)],endpointB:[mode(10,'half')]});
    expect(evaluation.status).toBe('incorrect');expect(evaluation.reasonCode).toBe('no-common-mode');expect(evaluation.acceptedEffects).toEqual([]);
    expect(f.measure().status).toBe('applied');expect(f.submit().status).not.toBe('rejected');expect(f.store.getState().runtime.game!.world.completedObjectiveIds).not.toContain(q('O09'));
    expect(f.store.getState().runtime.game!.notebook.measurements[0]?.readings.length).toBeGreaterThan(0);
  });
  it.each([
    {endpointA:[mode(100)]},{endpointB:[mode(10,'half')]},
    {endpointA:undefined,endpointB:undefined},{endpointA:[],endpointB:[mode(100)]},
    {endpointA:[mode(10,'half')],endpointB:[mode(100)]},
    {endpointA:[mode(100)],endpointB:[mode(1000)]},
    {endpointA:[mode(100),mode(100)],endpointB:[mode(100)]},
    {endpointA:new Array(1),endpointB:[mode(100)]},
    {endpointA:[mode(100)],endpointB:[mode(100)],rank:'fastest'},
  ])('rejects incomplete, empty, unreviewed or additional trusted data %#',sets=>{
    const {f,evaluation}=result({bothNegotiate:true,selected:mode(100),...sets});const before=f.store.getState();
    expect(evaluation.status).toBe('content-error');expect(evaluation.acceptedEffects).toEqual([]);expect(f.measure().status).toBe('rejected');expect(f.store.getState()).toBe(before);
  });
  it('does not accept endpoint sets as caller-supplied ability intent fields',()=>{
    expect(()=>copySemanticAction({kind:'use-ally-ability',characterId:q('CH22'),abilityId:q('ABILITY-CH22-explain'),actionId:q('ACTION-equipment-mode-100-full'),endpointA:[mode(100)],endpointB:[mode(10,'half')]} as never)).toThrow();
  });
});
