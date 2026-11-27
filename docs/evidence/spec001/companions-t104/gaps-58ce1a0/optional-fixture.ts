// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Explicit prepared-state harness, NOT native gameplay. Only initial O01/O02,
// kit, safe-room placement and revision origin are supplied. Physical changes,
// source clues, observations, notes, answers, help and recovery use real APIs.
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

export type Activity = 'SQ01' | 'SQ02' | 'SQ03' | 'SQ04';
export const rooms: Record<Activity,string> = { SQ01:'R04', SQ02:'R09', SQ03:'R08', SQ04:'R03' };
export function optionalFixture(id: Activity, withEvidence = true) {
  const definition = optionalActivityDefinition(registry,q(id))!;
  const initial = startIntroduction(createIntroductionRuntime(),registry), original=initial.game!;
  let state = createReducerState({...initial,game:{...original,world:{...original.world,
    completedObjectiveIds:[q('O01'),q('O02')],inventory:[{itemId:q('ITEM-inspection-kit'),quantity:1}],
    roomId:q('R03'),position:{safePositionId:q('R03.entry')} }}});
  const reduce = createReducer({registry,bindings:[...bindings,...optionalEffectBindings(definition)],objectiveScenario:scenario,canReachRoom:navigation.canReachRoom});
  const store={getState:()=>state,reduce,compareAndSet(before:ReducerState,next:ReducerState){if(state!==before)return false;state=next;return true;}};
  const game=()=>state.runtime.game!;
  const raw=(input:ReducerInput)=>{const result=reduce(state,{actionId:crypto.randomUUID() as ActionId,adventureId:game().adventureId,expectedVersion:game().world,input});expect(result.status,result.reason).not.toBe('rejected');state=result.state;return result;};
  // Room placement is explicitly prepared test context, never a native walk claim.
  const arrive=(room:string)=>{const old=game();state={...state,runtime:{...state.runtime,game:{...old,world:{...old.world,roomId:q(room),position:{safePositionId:q(`${room}.entry`)}}}}};};
  const action=(name:string)=>{const input=conventionalAbilityOperation(registry,scenario,game(),q(name),crypto.randomUUID() as MeasurementId);expect(input,name).not.toBeNull();return raw(input!);};
  const measure=(objective:string)=>{const selected=scenario(game(),q(objective))!;expect(selected).not.toBeNull();const mid=crypto.randomUUID() as MeasurementId;
    raw({kind:'objective',operation:{kind:'measure',objectiveId:q(objective),alternativeId:selected.alternativeId,id:mid}});return game().notebook.measurements.find(m=>m.id===mid)!;};
  raw({kind:'notebook',operation:{kind:'notes',text:'Keep this observation'}});
  if(withEvidence){
    action('ACTION-copper-read-defect');
    if(id==='SQ03'){
      arrive('R07');for(const name of ['read-path','read-settings','align-existing','match-settings'])action(`ACTION-radio-${name}`);
      const baseline=measure('O07'), selected=scenario(game(),q('O07'))!;
      raw({kind:'objective',operation:{kind:'submit',objectiveId:q('O07'),alternativeId:selected.alternativeId,measurementId:baseline.id}});
      arrive('R08');action('ACTION-radio-read-survey');action('ACTION-radio-mitigate-emitter');measure('O08');action('ACTION-radio-raise-noise');
      while(game().world.configurationRevision<8)action(game().world.flags[q<'flag'>('FLAG-radio-channel')]==='B'?'ACTION-radio-channel-A':'ACTION-radio-channel-B');
      measure('O08');
    }else{
      if(id==='SQ04'){
        arrive('R05');action('ACTION-fiber-inspect-before');arrive('R09');action('ACTION-market-read-power');arrive('R03');
      }
      action('ACTION-copper-replace-section');
      while(game().world.configurationRevision<8)action(game().world.flags[q<'flag'>('FLAG-copper-path')]==='section-replacement'?'ACTION-copper-restore-original':'ACTION-copper-replace-section');
      measure('O03');
    }
  }
  arrive(rooms[id]);
  const bus=createActionBus({getContext:()=>contextFromRuntime(state.runtime)});
  const controller=createOptionalActivitiesController({registry,store,bus,activityIds:[q(id)]});
  const send=(input:OptionalActivityIntent)=>bus.dispatch(controller.project().capture(input));
  const session=()=>state.control.optionalActivity!.sessionId;
  const view=()=>controller.project().view!;
  const start=()=>{const hotspot=definition.optionalActivity.kind==='notebook-combination'
    ? definition.optionalActivity.entryContexts.find(entry=>entry.roomId===String(game().world.roomId))!.hotspotId
    : q({SQ01:'HOTSPOT-echo-serial-post',SQ02:'HOTSPOT-market-eel',SQ03:'HOTSPOT-radio-vane',SQ04:'unused'}[id]);
    return send({kind:'start-optional',activityId:q(id),hotspotId:hotspot as ReturnType<typeof q>});};
  const mode=(mode:'practice'|'delivery')=>send({kind:'choose-optional-mode',sessionId:session(),mode});
  const simple=(kind:'exit-optional'|'retry-optional'|'hint-optional'|'explain-optional')=>send({kind,sessionId:session()});
  const answer=(correct:boolean)=>{
    if(id==='SQ01')return send({kind:'submit-optional',sessionId:session(),bits:correct?'00101101':'00011011'});
    if(id==='SQ02')return send({kind:'submit-optional-power',sessionId:session(),answer:{assessment:correct?'over-budget':'within-budget',difference:{value:3,unit:'W'}}});
    if(id==='SQ03'){
      const samples=game().notebook.measurements.filter(m=>m.subjectIds.includes(q('O08')));
      return send({kind:'submit-optional-diary',sessionId:session(),answer:{earlierMeasurementId:samples[0]!.id,laterMeasurementId:samples.at(-1)!.id,comparison:correct?'decreased':'increased',currentAssessment:'below-threshold',evidenceClaim:'current-reading-only-no-cause'}});
    }
    if(definition.optionalActivity.kind!=='notebook-combination')throw new Error('Wrong SQ04 variant');
    return send({kind:'submit-optional-maintenance',sessionId:session(),answer:{selectedFactIds:correct?definition.optionalActivity.delivery.factIds:[definition.optionalActivity.delivery.factIds[0]!]}});
  };
  return {id,definition,store,state:()=>state,game,view,start,mode,simple,send,answer,session,arrive,action,measure,raw,
    dispose(){controller.dispose();bus.dispose();},controller,bus};
}
