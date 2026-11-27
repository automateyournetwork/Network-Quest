// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Exact loaded SQ01/SQ02 fields absent from normal historical-suite discovery.
import { afterEach, describe, expect, it } from 'vitest';
import { optionalFixture } from '../gaps-58ce1a0/optional-fixture';
import { evaluateOptionalAnswer } from '../../../../../src/state/optional-activities';
import { evaluateAuditAnswer } from '../../../../../src/state/optional-power-audit';
import { q, registry } from '../../../../../tests/state/party-fixture';
import type { ActionId } from '../../../../../src/domain/types';
const active:ReturnType<typeof optionalFixture>[]=[];
const make=(id:'SQ01'|'SQ02')=>{const f=optionalFixture(id,false);active.push(f);return f;};
afterEach(()=>active.splice(0).forEach(f=>f.dispose()));
const action=<T>(f:ReturnType<typeof make>,input:T)=>({actionId:crypto.randomUUID() as ActionId,expectedVersion:f.game().world,input});
describe('T104 current loaded SQ01/SQ02 exact technical fields',()=>{
 it.each([
  ['DECODE','delivery','00101101','correct',8,4,true],
  ['WRONG-ORDER','delivery','00011011','incorrect',8,4,false],
  ['ONE-SYMBOL','practice','11','correct',2,1,false],
 ] as const)('SQ01 %s executes real decoder and real quest completion separately',(_id,mode,bits,status,representedBits,symbols,completed)=>{
  const f=make('SQ01'),before=structuredClone(f.game().world);f.start();f.mode(mode);const result=evaluateOptionalAnswer(registry,f.definition,mode,action(f,{bits}),f.game());
  expect(result.evaluation.status).toBe(status);expect(result.evaluation.observations[0]).toMatchObject({expectedBits:mode==='practice'?'11':'00101101',trace:{representedBits,symbols}});
  expect(f.send({kind:'submit-optional',sessionId:f.session(),bits}).status).toBe('handled');expect(f.state().control.optionalActivity?.result).toBe(status);expect(f.view().completed).toBe(completed);expect(f.view().controls.retry).toBeTruthy();expect(f.game().world.completedObjectiveIds).toEqual(before.completedObjectiveIds);expect(f.game().world.completedQuestIds).toEqual(completed?[q('SQ01')]:[]);
 });
 it('SQ02 DIAGNOSE distinguishes physical incorrect33W/3W excess from a correct learner answer and real quest eligibility',()=>{
  const f=make('SQ02'),answer={assessment:'over-budget',difference:{value:3,unit:'W'}} as const,before=structuredClone(f.game().world);
  const result=evaluateOptionalAnswer(registry,f.definition,'delivery',action(f,answer),f.game());expect(result.evaluation).toMatchObject({status:'correct',observations:[{planStatus:'incorrect',learnerStatus:'correct',plan:{total:{value:33,unit:'W'},excess:{value:3,unit:'W'}},dataLinkProven:false,repaired:false}]});
  f.start();f.mode('delivery');expect(f.send({kind:'submit-optional-power',sessionId:f.session(),answer}).status).toBe('handled');expect(f.view().completed).toBe(true);expect(f.game().world.completedQuestIds).toEqual([q('SQ02')]);expect(f.game().world.completedObjectiveIds).toEqual(before.completedObjectiveIds);
 });
 it('SQ02 POWER-BOUNDARIES observes23/7 and30/0 without a data-link claim or optional completion from help',()=>{
  const f=make('SQ02'),a=f.definition.optionalActivity;if(a.kind!=='delivered-power-audit')throw new Error('Wrong power activity');
  const answer=(value:number)=>({assessment:'within-budget',difference:{value,unit:'W'}} as const);
  const practice=evaluateOptionalAnswer(registry,f.definition,'practice',action(f,answer(7)),f.game());expect(practice.evaluation).toMatchObject({status:'correct',acceptedEffects:[],observations:[{planStatus:'correct',plan:{total:{value:23,unit:'W'},headroom:{value:7,unit:'W'}},dataLinkProven:false}]});
  const{explanation:_explanation,...boundary}=a.boundaryExample;const exact=evaluateAuditAnswer(boundary,registry.record(a.profileId),action(f,answer(0)),f.game().world);expect(exact).toMatchObject({status:'correct',acceptedEffects:[],observations:[{planStatus:'correct',plan:{total:{value:30,unit:'W'},headroom:{value:0,unit:'W'}},dataLinkProven:false}]});
  f.start();f.mode('practice');expect(f.send({kind:'submit-optional-power',sessionId:f.session(),answer:answer(7)}).status).toBe('handled');expect(f.state().control.optionalActivity?.result).toBe('correct');expect(f.send({kind:'boundary-optional',sessionId:f.session()}).status).toBe('handled');expect(f.view().hintText).toContain('0 W headroom');expect(f.view().completed).toBe(false);expect(f.game().world.completedQuestIds).toEqual([]);
 });
});
