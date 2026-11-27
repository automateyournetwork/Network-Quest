// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Prepared-state integration, not native gameplay: unrelated objective/knowledge
// inputs come from partyFixture. Recruitment and advanced lessons are real.
// Each tool branch explicitly has NO recruits or active allies. No physical
// observation/verdict is injected. B-NEG-NONE supplies only its reviewed paired
// advertisements to the trusted scenario adapter in the isolated proposal.
import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { partyFixture, recruit, registry, world, bindings, scenario, navigation, q } from '../../../../../tests/state/party-fixture';
import type { Recruit } from '../../../../../tests/state/party-fixture';
import { conventionalAbilityOperation, partyCharacter } from '../../../../../src/state/party';
import { createReducer, createReducerState } from '../../../../../src/state/reducer';
import type { ReducerInput, ReducerState } from '../../../../../src/state/reducer';
import { evaluateObjective } from '../../../../../src/state/objectives';
import type { ObjectiveScenarioResolver } from '../../../../../src/state/objectives';
import type { ActionId, AbilityId, MeasurementId } from '../../../../../src/domain/types';
import type { GameState } from '../../../../../src/state/types';

const fixture = JSON.parse(readFileSync('tests/fixtures/companions.json','utf8'));
const physical = JSON.parse(readFileSync('tests/fixtures/physical-cases.json','utf8'));
const byId = new Map<string,any>([...physical.referenceCases,...physical.reviewCases].map((c:any)=>[c.id,c]));
const ids:Recruit[]=['CH03','CH04','CH05','CH06','CH07','CH16','CH19','CH20','CH22'];
const records:Record<string,unknown>={};
const stable=(game:GameState)=>{const {recruits:_recruits,activeAllyIds:_active,...rest}=game.world;return {...game,world:rest};};
type Plan={objective:string;action:string;room:string;before:string[];after:string[];measureByAlly:boolean};
function plan(character:Recruit,caseId:string):Plan{
  if(character==='CH03'||character==='CH16')return {objective:caseId==='C-COMPAT'?'O05':'O06',room:'R05',action:caseId==='C-COMPAT'?'ACTION-fiber-profile-matched':'ACTION-fiber-profile-wrong-wavelength',before:[],after:['ACTION-fiber-inspect-before','ACTION-fiber-clean','ACTION-fiber-reinspect-clean'],measureByAlly:false};
  if(character==='CH04')return {objective:'O04',room:'R03',action:caseId==='C-CONTINUITY'?'ACTION-copper-replace-section':'ACTION-copper-restore-original',before:[],after:[],measureByAlly:false};
  if(character==='CH20')return {objective:'O04',room:'R04',action:'ACTION-copper-repeater-requires-continuity',before:[],after:[],measureByAlly:false};
  if(character==='CH05'||character==='CH06')return {objective:'O06',room:'R06',action:caseId==='T15'?'ACTION-O06-passive-path-B':'ACTION-O06-passive-path-A',before:[],after:[],measureByAlly:true};
  if(character==='CH07')return {objective:'O08',room:'R08',action:caseId==='B-RADIO-20'?'ACTION-O08-scenario-channel-B':'ACTION-O08-scenario-channel-A',before:[],after:[],measureByAlly:true};
  if(character==='CH19')return {objective:'O09',room:'R09',action:caseId==='B-POWER-30'?'ACTION-O09-compatible-kit-B':'ACTION-O09-compatible-kit-A',before:[],after:[],measureByAlly:true};
  return {objective:'O09',room:'R09',action:caseId==='C-NEG-WRONG'?'ACTION-equipment-mode-1000-full':'ACTION-equipment-mode-100-full',before:[],after:[],measureByAlly:false};
}
function prepare(character:Recruit,caseId:string){
  const f=partyFixture();recruit(f,character);f.beginPractice(character);f.demonstrateProgression(character);expect(f.advance(character).status).toBe('handled');expect(f.setActive([character]).status).toBe('handled');
  if(character==='CH03'||character==='CH16'){
    f.fiber();f.walk('R06');f.action('ACTION-fiber-path-A');f.walk('R05');f.action('ACTION-fiber-restore-original');
  }else if(character==='CH04'||character==='CH20'){
    f.walk('R03');f.action('ACTION-copper-restore-original');f.measure('O03');
    if(character==='CH20'&&caseId==='C-CONTINUITY')f.action('ACTION-copper-replace-section');
    f.walk('R04');f.action('ACTION-copper-repeater-requires-continuity');f.walk(plan(character,caseId).room);
  }else if(character==='CH05'||character==='CH06'){
    f.fiber();f.walk('R06');f.action(caseId==='T04'?'ACTION-fiber-path-A':caseId==='T05'?'ACTION-fiber-path-high-loss':'ACTION-fiber-path-B');
  }else if(character==='CH07'){
    f.walk('R07');f.action('ACTION-radio-align-existing');f.action('ACTION-radio-match-settings');f.walk('R08');f.action('ACTION-radio-mitigate-emitter');
    f.action(caseId==='B-RADIO-20'?'ACTION-radio-channel-B':'ACTION-radio-channel-A');if(caseId==='T09')f.action('ACTION-radio-raise-noise');
  }else{
    f.walk('R09');f.action(character==='CH19'&&caseId==='T10'?'ACTION-market-original-over-budget':character==='CH19'&&caseId==='B-POWER-30'?'ACTION-market-compatible-kit-B':'ACTION-market-compatible-kit-A');
    f.action('ACTION-equipment-mode-100-full');
  }
  return f;
}
function run(source:ReducerState,character:Recruit,caseId:string,ally:boolean){
  const p=plan(character,caseId), sourceGame=source.runtime.game!;
  let state=createReducerState({...source.runtime,game:{...structuredClone(sourceGame),world:{...structuredClone(sourceGame.world),
    completedObjectiveIds:sourceGame.world.completedObjectiveIds.filter(id=>id!==q(p.objective)),recruits:ally?structuredClone(sourceGame.world.recruits):[],activeAllyIds:ally?[q(character)]:[]}}});
  const resolve:ObjectiveScenarioResolver=(game,id)=>{
    const current=scenario(game,id);
    if(caseId==='B-NEG-NONE'&&current?.kind==='equipment')return {...current,capability:{...current.capability,endpointA:byId.get(caseId).inputs.A,endpointB:byId.get(caseId).inputs.B}};
    return current;
  };
  const reduce=createReducer({registry,bindings,objectiveScenario:resolve,canReachRoom:navigation.canReachRoom});
  let sequence=0;const game=()=>state.runtime.game!;
  const apply=(input:ReducerInput)=>{const result=reduce(state,{actionId:`t104-vector-${sequence++}` as ActionId,adventureId:game().adventureId,expectedVersion:game().world,input});expect(result.status,result.reason).not.toBe('rejected');state=result.state;return result;};
  const action=(id:string)=>{const input=conventionalAbilityOperation(registry,resolve,game(),q(id),'00000000-0000-4000-8000-000000000901' as MeasurementId);expect(input,id).not.toBeNull();return apply(input!);};
  const mid='00000000-0000-4000-8000-000000000902' as MeasurementId;
  expect(game().world.recruits.map(r=>r.characterId)).toEqual(ally?[q(character)]:[]);expect(game().world.activeAllyIds).toEqual(ally?[q(character)]:[]);
  const beforeOperation=structuredClone(game());
  const ability=partyCharacter(registry,q(character))!.abilities.find(a=>a.id===q(`ABILITY-${character}-explain`))!;
  expect(ability.conventionalEquivalentActionIds).toContain(q(p.action));
  if(ally)apply({kind:'party',operation:{kind:'ability',characterId:q(character),abilityId:ability.id as AbilityId,actionId:q(p.action),measurementId:mid}});
  else {const input=conventionalAbilityOperation(registry,resolve,game(),q(p.action),mid);expect(input).not.toBeNull();apply(input!);}
  for(const id of p.after)action(id);
  const destination=String(q(p.objective.replace('O','R')));
  if(String(game().world.roomId)!==destination){
    const walk=navigation.resolve(game().world,q(p.objective.replace('O','R')),'stable-exploration');expect(walk.ok).toBe(true);if(!walk.ok)throw new Error(walk.reason);
    apply({kind:'apply',evaluation:{status:'correct',reasonCode:'actual-navigation',observations:[],acceptedEffects:[]},destination:walk.destination});
  }
  const selected=resolve(game(),q(p.objective))!;expect(selected).not.toBeNull();
  const measuredId=p.measureByAlly?mid:'00000000-0000-4000-8000-000000000903' as MeasurementId;
  const diagnosticId='00000000-0000-4000-8000-000000000904' as MeasurementId;
  const physical=evaluateObjective(registry,resolve,game(),q(p.objective),{actionId:'inspect-real-vector' as ActionId,expectedVersion:game().world,input:{kind:'measure',alternativeId:selected.alternativeId,id:diagnosticId}});
  expect(physical.observations.length).toBeGreaterThan(0);
  if(!p.measureByAlly)apply({kind:'objective',operation:{kind:'measure',objectiveId:q(p.objective),alternativeId:selected.alternativeId,id:measuredId}});
  const measurement=game().notebook.measurements.find(m=>m.id===measuredId)!;expect(measurement).toBeDefined();expect(measurement.readings.length).toBeGreaterThan(0);
  const eligible=evaluateObjective(registry,resolve,game(),q(p.objective),{actionId:'submit-real-vector' as ActionId,expectedVersion:game().world,input:{kind:'submit',alternativeId:selected.alternativeId,measurementId:measuredId}});
  apply({kind:'objective',operation:{kind:'submit',objectiveId:q(p.objective),alternativeId:selected.alternativeId,measurementId:measuredId}});
  expect(game().world.inventory).toEqual(beforeOperation.world.inventory);
  return {game:game(),measurement,physical,eligible,selected,beforeOperation,objective:p.objective};
}
function independentlyExpected(caseId:string,result:ReturnType<typeof run>){
  const value=(name:string)=>result.measurement.readings.find(r=>r.name===name)?.value;
  const status=byId.get(caseId).expected.status;
  expect(result.physical.status).toBe(status);expect(result.eligible.status).toBe(status);expect(result.game.world.completedObjectiveIds.includes(q(result.objective))).toBe(status==='correct');
  if(caseId==='C-COMPAT'){expect(value('Inspection complete')).toBe(1);expect(value('Preparation complete')).toBe(1);}
  if(caseId==='T07'||caseId==='B-COMPAT'){
    expect(result.selected).toMatchObject({kind:'fiber-proof',path:{compatible:false,loss:{value:8,unit:'dB'}}});
    expect(result.physical.observations).toEqual(expect.arrayContaining([expect.objectContaining({usableLink:false,arithmeticCannotOverride:true})]));
    // Independently reviewed nominal T04 arithmetic is sufficient (-11 / 3),
    // yet the actual O06 compatibility result remains incorrect.
    expect(value('Transmit power')).toBe(-3);expect(value('Total passive loss')).toBe(8);
  }
  if(['C-CONTINUITY','T03','B-CONTINUITY'].includes(caseId)){
    expect(value('Open required conductors')).toBe(caseId==='C-CONTINUITY'?0:1);expect(value('Historical open recorded')).toBe(1);expect(value('Repeater role distinguished')).toBe(1);
    if(caseId==='B-CONTINUITY')expect(result.selected).toMatchObject({path:{requiredConductors:[true,true,false,true]}});
  }
  const optical:Record<string,[number,number]>={T04:[-11,3],T05:[-13,1],T15:[-12,2]};
  if(optical[caseId]){expect(value('Receive power')).toBe(optical[caseId]![0]);expect(value('Sensitivity reserve')).toBe(optical[caseId]![1]);expect(value('Required reserve')).toBe(2);}
  const radio:Record<string,number>={T08:25,T09:13,'B-RADIO-20':20};
  if(radio[caseId]!==undefined){expect(value('Signal-to-noise ratio')).toBe(radio[caseId]);expect(value('Required signal-to-noise ratio')).toBe(20);}
  if(caseId==='C-POWER'){expect(value('Total delivered demand')).toBe(23);expect(value('Delivered headroom')).toBe(7);}
  if(caseId==='T10'){expect(value('Total delivered demand')).toBe(33);expect(value('Delivered excess')).toBe(3);}
  if(caseId==='B-POWER-30'){expect(value('Total delivered demand')).toBe(30);expect(value('Delivered headroom')).toBe(0);}
  if(caseId==='T11')expect(result.physical.observations).toEqual(expect.arrayContaining([expect.objectContaining({common:[{rate:{value:100,unit:'Mbps'},duplex:'full'}],supportedByA:true,supportedByB:true})]));
  if(caseId==='C-NEG-WRONG')expect(result.physical.observations).toEqual(expect.arrayContaining([expect.objectContaining({selected:{rate:{value:1000,unit:'Mbps'},duplex:'full'},supportedByB:false})]));
  if(caseId==='B-NEG-NONE'){expect(result.physical.reasonCode).toBe('no-common-mode');expect(result.physical.observations).toEqual(expect.arrayContaining([expect.objectContaining({common:[]})]));}
}

describe.each(ids)('%s original three-vector ability/conventional integration',character=>{
  const recruitRecord=fixture.recruits.find((r:any)=>r.characterId===q(character));
  const vectors=fixture.technicalVectors[recruitRecord.vectorGroup] as Array<{sourceCaseId:string;category:string}>;
  it.each(vectors)('$sourceCaseId ($category) compares a real ally operation with an unrecruited conventional branch',vector=>{
    const f=prepare(character,vector.sourceCaseId);
    try{
      const base=f.reducerState();const ally=run(base,character,vector.sourceCaseId,true),tool=run(base,character,vector.sourceCaseId,false);
      independentlyExpected(vector.sourceCaseId,ally);independentlyExpected(vector.sourceCaseId,tool);
      expect(ally.measurement.readings).toEqual(tool.measurement.readings);expect(ally.physical).toEqual(tool.physical);expect(ally.eligible).toEqual(tool.eligible);
      expect(stable(ally.game)).toEqual(stable(tool.game));expect(tool.game.world.recruits).toEqual([]);expect(tool.game.world.activeAllyIds).toEqual([]);
      records[`${character}/${vector.sourceCaseId}`]={sourceCaseId:vector.sourceCaseId,category:vector.category,ordinaryRecruits:0,ordinaryActive:0,physicalStatus:ally.physical.status,readings:ally.measurement.readings,objectiveEligibility:ally.eligible.status,acceptedEffects:ally.eligible.acceptedEffects,objectiveAwarded:ally.game.world.completedObjectiveIds.includes(q(ally.objective)),wholeRouteProven:false};
    }finally{f.dispose();}
  });
});
afterAll(()=>{if(process.env['NQ_T104_GAP_OUTPUT'])writeFileSync(process.env['NQ_T104_GAP_OUTPUT']+'/companion-vector-receipts.json',JSON.stringify({scope:'Prepared-state actual reducer/action/objective integration; only B-NEG-NONE supplies reviewed paired advertisements through the isolated trusted adapter proposal. Not native or whole-route proof.',records},null,2)+'\n');});
// Keep the imported actual world visible to source audits: no alternate catalog.
expect(world.episodeId).toBe('spec001');
