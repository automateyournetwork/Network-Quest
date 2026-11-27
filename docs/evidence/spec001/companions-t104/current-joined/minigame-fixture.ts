// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Current all-seven join: source hashes and execution receipts are recorded separately.
// Explicit prepared O01/O02, kit and room placement. All subsequent source facts,
// prerequisite objectives, configuration changes, readings and optional answers use
// actual production interfaces. This is not a native route claim.
import { expect } from 'vitest';
import { createIntroductionRuntime, startIntroduction } from '../../../../../src/app/adventure';
import { createReducer, createReducerState } from '../../../../../src/state/reducer';
import type { ReducerInput, ReducerState } from '../../../../../src/state/reducer';
import { conventionalAbilityOperation } from '../../../../../src/state/party';
import { optionalActivityDefinition, optionalEffectBindings } from '../../../../../src/state/optional-activities';
import { createOptionalActivitiesController } from '../../../../../src/ui/optional-activities';
import type { OptionalActivityIntent } from '../../../../../src/ui/optional-activities';
import { contextFromRuntime, createActionBus } from '../../../../../src/ui/action-bus';
import { bindings, navigation, q, registry, scenario } from '../../../../../tests/state/party-fixture';
import type { ActionId, MeasurementId } from '../../../../../src/domain/types';
export type Minigame = 'MG01' | 'MG02' | 'MG03';
export const rooms:Record<Minigame,string>={MG01:'R10',MG02:'R06',MG03:'R08'};
export function minigameFixture(id:Minigame,withEvidence=true,provePrerequisite=true){
 const definition=optionalActivityDefinition(registry,q(id))!;
 const initial=startIntroduction(createIntroductionRuntime(),registry),original=initial.game!;
 let state=createReducerState({...initial,game:{...original,world:{...original.world,completedObjectiveIds:[q('O01'),q('O02')],inventory:[{itemId:q('ITEM-inspection-kit'),quantity:1}],roomId:q('R03'),position:{safePositionId:q('R03.entry')}}}});
 const reduce=createReducer({registry,bindings:[...bindings,...optionalEffectBindings(definition)],objectiveScenario:scenario,canReachRoom:navigation.canReachRoom});
 const store={getState:()=>state,reduce,compareAndSet(before:ReducerState,next:ReducerState){if(state!==before)return false;state=next;return true;}};
 const game=()=>state.runtime.game!;
 const raw=(input:ReducerInput)=>{const result=reduce(state,{actionId:crypto.randomUUID() as ActionId,adventureId:game().adventureId,expectedVersion:game().world,input});expect(result.status,result.reason).not.toBe('rejected');state=result.state;return result;};
 const arrive=(room:string)=>{const old=game();state={...state,runtime:{...state.runtime,game:{...old,world:{...old.world,roomId:q(room),position:{safePositionId:q(`${room}.entry`)}}}}};};
 const action=(name:string)=>{const input=conventionalAbilityOperation(registry,scenario,game(),q(name),crypto.randomUUID() as MeasurementId);expect(input,name).not.toBeNull();return raw(input!);};
 const measure=(objective:string,submit=false)=>{const selected=scenario(game(),q(objective))!;expect(selected).not.toBeNull();const mid=crypto.randomUUID() as MeasurementId;raw({kind:'objective',operation:{kind:'measure',objectiveId:q(objective),alternativeId:selected.alternativeId,id:mid}});if(submit)raw({kind:'objective',operation:{kind:'submit',objectiveId:q(objective),alternativeId:selected.alternativeId,measurementId:mid}});return game().notebook.measurements.find(m=>m.id===mid)!;};
 raw({kind:'notebook',operation:{kind:'notes',text:'Keep this observation'}});
 if(provePrerequisite&&id==='MG02'){
  arrive('R05');for(const name of ['read-matching','profile-matched','inspect-before','clean','reinspect-clean'])action(`ACTION-fiber-${name}`);measure('O05',true);
  arrive('R06');action('ACTION-fiber-read-compatibility');action('ACTION-fiber-path-A');measure('O06',true);
 }
 if(provePrerequisite&&id==='MG03'){
  arrive('R07');for(const name of ['read-path','read-settings','align-existing','match-settings'])action(`ACTION-radio-${name}`);measure('O07',true);
  arrive('R08');action('ACTION-radio-read-survey');action('ACTION-radio-mitigate-emitter');measure('O08',true);
 }
 if(withEvidence){
  if(id==='MG01'){
   arrive('R03');action('ACTION-copper-read-defect');action('ACTION-copper-replace-section');
   for(let n=0;n<8&&game().world.configurationRevision<8;n++)action(game().world.flags[q<'flag'>('FLAG-copper-path')]==='section-replacement'?'ACTION-copper-restore-original':'ACTION-copper-replace-section');measure('O03');
  }else if(id==='MG02'){
   for(let n=0;n<8&&game().world.configurationRevision<8;n++)action(game().world.flags[q<'flag'>('FLAG-fiber-path')]==='passive-path-A'?'ACTION-fiber-path-B':'ACTION-fiber-path-A');measure('O06');
  }else{
   for(let n=0;n<8&&game().world.configurationRevision<8;n++)action(game().world.flags[q<'flag'>('FLAG-radio-channel')]==='B'?'ACTION-radio-channel-A':'ACTION-radio-channel-B');measure('O08');
  }
 }
 arrive(rooms[id]);
 const bus=createActionBus({getContext:()=>contextFromRuntime(state.runtime)});
 const controller=createOptionalActivitiesController({registry,store,bus,activityIds:[q(id)]});
 const send=(input:OptionalActivityIntent)=>bus.dispatch(controller.project().capture(input));
 const session=()=>state.control.optionalActivity!.sessionId;
 const view=()=>controller.project().view!;
 const start=()=>send({kind:'start-optional',activityId:q(id),hotspotId:q({MG01:'HOTSPOT-clockworks-loom',MG02:'HOTSPOT-fiber-r06-pr059',MG03:'HOTSPOT-radio-channels'}[id])});
 const mode=(mode:'practice'|'delivery')=>send({kind:'choose-optional-mode',sessionId:session(),mode});
 const simple=(kind:'exit-optional'|'retry-optional'|'hint-optional'|'explain-optional')=>send({kind,sessionId:session()});
 const prepareAnswer=()=>{
  if(id!=='MG03'||state.control.optionalActivity?.scout?.prediction)return;
  // Use an actual surveyed 25 dB baseline; other earlier readings are retained.
  const baseline=game().notebook.measurements.find(m=>m.subjectIds.includes(q('O08'))&&m.readings.some(r=>r.name==='Signal-to-noise ratio'&&r.value===25))!;expect(baseline).toBeTruthy();
  expect(send({kind:'scout-select',sessionId:session(),choice:'channel-A'}).status).toBe('handled');
  expect(send({kind:'scout-select',sessionId:session(),choice:'raise-noise'}).status).toBe('handled');
  expect(send({kind:'scout-predict',sessionId:session(),baselineMeasurementId:baseline.id,assessment:'below-threshold'}).status).toBe('handled');
  expect(send({kind:'scout-measure',sessionId:session()}).status).toBe('handled');
 };
 const answer=(correct:boolean)=>{
  if(id==='MG01')return send({kind:'submit-optional',sessionId:session(),bits:correct?'00101101':'00011011'});
  if(id==='MG02')return send({kind:'submit-optional-optics',sessionId:session(),answer:{receive:{value:-13,unit:'dBm'},margin:{value:1,unit:'dB'},reserve:correct?'shortfall':'met',overload:'not-overloaded'}});
  prepareAnswer();return send({kind:'scout-compare',sessionId:session(),laterMeasurementId:game().notebook.measurements.at(-1)!.id,comparison:correct?'decreased':'increased',currentAssessment:'below-threshold',predictionAssessment:'supported',evidenceClaim:'current-reading-only-no-cause'});
 };
 return{id,definition,store,state:()=>state,game,view,start,mode,simple,send,answer,prepareAnswer,session,arrive,action,measure,raw,controller,bus,dispose(){controller.dispose();bus.dispose();}};
}
