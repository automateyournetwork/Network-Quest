// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Actual production interfaces on explicitly prepared states. No native-play claim.
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { optionalFixture, rooms } from './optional-fixture';
import type { Activity } from './optional-fixture';
import { navigation, q } from '../../../../../tests/state/party-fixture';
import { isMeasurementCurrent } from '../../../../../src/state/reducer';
const ids:Activity[]=['SQ01','SQ02','SQ03','SQ04'];
const receipts:Record<string,unknown>={};
const active:ReturnType<typeof optionalFixture>[]=[];
const make=(id:Activity,evidence=true)=>{const f=optionalFixture(id,evidence);active.push(f);return f;};
const unchangedMembership=(f:ReturnType<typeof make>)=>{expect(f.game().world.recruits).toEqual([]);expect(f.game().world.activeAllyIds).toEqual([]);expect(f.game().world.completedQuestIds).toEqual([]);};
afterEach(()=>{active.splice(0).forEach(f=>f.dispose());vi.useRealTimers();});
afterAll(()=>{if(process.env['NQ_T104_GAP_OUTPUT'])writeFileSync(process.env['NQ_T104_GAP_OUTPUT']+'/optional-runtime-receipts.json',JSON.stringify({scope:'Real production interfaces; prepared starting rooms/O01-O02/kit, not native. Logical clock only, visibility still requires its separate browser check.',receipts},null,2)+'\n');});

describe.each(ids)('%s exact original lifecycle inputs',id=>{
  it('START independently exposes instructions, practice, exit and no timer or completion',()=>{
    const f=make(id,false);unchangedMembership(f);const before=structuredClone(f.game());expect(f.start().status).toBe('handled');
    expect(f.view().phase).toBe('instructions');expect(f.view().instructions.length).toBeGreaterThan(0);expect(f.view().controls.practice).toBeTruthy();expect(f.view().controls.exit).toBeTruthy();
    expect(f.state().control.optionalActivity?.timingEnabled).toBe(false);expect(f.view().completed).toBe(false);expect(f.game()).toEqual(before);
    receipts[`OPT-${id}-START`]={independent:true,instructions:true,practice:true,exit:true,timer:false,completion:0};
  });
  it('PRACTICE records worked assistance with retry/exit and no full completion',()=>{
    const f=make(id,false);f.start();expect(f.mode('practice').status).toBe('handled');expect(f.view().phase).toBe('practice');
    expect(f.simple('explain-optional').status).toBe('handled');expect(f.view().hintText).toBeTruthy();
    expect(f.game().assistance.filter(h=>h.objectiveId===q(id)).map(h=>h.level)).toEqual([2]);
    expect(f.view().controls.retry).toBeTruthy();expect(f.view().controls.exit).toBeTruthy();expect(f.state().control.optionalActivity?.timingEnabled).toBe(false);unchangedMembership(f);
    receipts[`OPT-${id}-PRACTICE`]={assistanceLevels:[2],unassisted:false,completion:0,retry:true,exit:true};
  });
  it.each(['instructions','practice','solving','feedback'] as const)('EXIT proves actual unfinished %s before leaving',phase=>{
    const f=make(id);const original=structuredClone(f.game());expect(f.start().status).toBe('handled');
    if(phase==='practice')expect(f.mode('practice').status).toBe('handled');
    if(phase==='solving'||phase==='feedback')expect(f.mode('delivery').status).toBe('handled');
    if(phase==='feedback'){expect(f.answer(false).status).toBe('handled');expect(f.state().control.optionalActivity?.result).toBe('incorrect');}
    expect(f.view().phase).toBe(phase);expect(f.view().completed).toBe(false);const before=structuredClone(f.game());
    expect(f.simple('exit-optional').status).toBe('handled');expect(f.controller.project().view).toBeNull();expect(f.state().control.optionalActivity).toBeNull();expect(f.game()).toEqual(before);
    expect(f.game().world.roomId).toBe(q(rooms[id]));expect(f.game().world.position).toEqual(original.world.position);expect(f.state().runtime.activity?.kind).toBe('stable-exploration');
    expect(f.game().world.inventory).toEqual([{itemId:q('ITEM-inspection-kit'),quantity:1}]);expect(f.game().world.completedObjectiveIds).toEqual(original.world.completedObjectiveIds);
    expect(navigation.canReachRoom(f.game().world,q('R02'))).toBe(true);expect(f.state().runtime.persistence.pendingRequest).toBeNull();unchangedMembership(f);
    receipts[`OPT-${id}-EXIT-${phase}`]={actualPhaseAsserted:phase,wrongFeedback:phase==='feedback',sameGame:true,safeOrigin:true,noSave:true,routeReachable:true};
  });
  it('RETRY follows actual wrong feedback and preserves the entire honest assistance history',()=>{
    const f=make(id);unchangedMembership(f);const beforeStart=structuredClone(f.game());expect(beforeStart.notebook.measurements.length).toBeGreaterThan(0);
    expect(beforeStart.notebook.measurements.at(-1)?.configurationRevision).toBe(8);expect(beforeStart.notebook.measurements.at(-1)?.stale).toBe(false);
    expect(f.start().status).toBe('handled');expect(f.simple('hint-optional').status).toBe('handled');expect(f.game().assistance.map(h=>h.level)).toEqual([1]);
    expect(f.mode('delivery').status).toBe('handled');expect(f.answer(false).status).toBe('handled');expect(f.view().phase).toBe('feedback');expect(f.state().control.optionalActivity?.result).toBe('incorrect');
    const before=structuredClone(f.game());expect(before.assistance.map(h=>h.level)).toEqual([1,3]);expect(before.notebook.factIds.length).toBeGreaterThan(0);
    expect(f.simple('retry-optional').status).toBe('handled');const after=f.game();
    expect(after.assistance).toEqual(before.assistance);expect(after.notebook.factIds).toEqual(before.notebook.factIds);expect(after.notebook.personalNotes).toBe('Keep this observation');
    expect(after.world.inventory).toEqual(beforeStart.world.inventory);expect(after.world.flags).toEqual(beforeStart.world.flags);expect(after.world.completedObjectiveIds).toEqual(beforeStart.world.completedObjectiveIds);
    expect(after.world.attemptId).not.toBe(before.world.attemptId);expect(after.world.configurationRevision).toBeGreaterThan(8);expect(after.notebook.measurements).toEqual(before.notebook.measurements.map(m=>({...m,stale:true})));
    expect(after.notebook.measurements.every(m=>!isMeasurementCurrent(m,after.world))).toBe(true);expect(f.state().runtime.persistence.pendingRequest).toBeNull();expect(f.view()).toMatchObject({phase:'instructions',mode:null,completed:false});expect(f.view().controls.retry).toBeTruthy();unchangedMembership(f);
    receipts[`OPT-${id}-RETRY`]={adaptation:'Original [1] means retained prior hint; actual wrong feedback honestly adds solution3 before Retry. Entire pre/post array is compared exactly.',beforeHelp:before.assistance,afterHelp:after.assistance,wrongAnswer:true,actualMeasurementRevision:8,allRetainedReadingsStale:true,preparationPreserved:true,noSave:true};
  });
  it('SKIP never starts optional play and retains route, progress and the only kit',()=>{
    const f=make(id,false),before=structuredClone(f.game());f.controller.project();expect(f.state().control.optionalActivity).toBeNull();expect(f.game()).toEqual(before);
    expect(f.game().world.inventory).toEqual([{itemId:q('ITEM-inspection-kit'),quantity:1}]);expect(f.game().world.completedObjectiveIds).toEqual([q('O01'),q('O02')]);expect(navigation.canReachRoom(f.game().world,q('R02'))).toBe(true);unchangedMembership(f);
    receipts[`OPT-${id}-SKIP`]={activityStarted:false,requiredRouteReachable:true,optionalBenefitRequired:false,inventoryRetained:true};
  });
  it('FINISH and new-action REPLAY grant exactly one fact/quest with explanation and no main award',()=>{
    const f=make(id);const before=structuredClone(f.game());f.start();f.mode('delivery');expect(f.answer(true).status).toBe('handled');expect(f.view().completed).toBe(true);expect(f.view().feedback).toBeTruthy();expect(f.view().controls.exit).toBeTruthy();
    const fact=f.definition.optionalActivity.reward.factId;expect(f.game().world.completedQuestIds).toEqual([q(id)]);expect(f.game().notebook.factIds.filter(x=>x===fact)).toHaveLength(1);expect(f.game().world.completedObjectiveIds).toEqual(before.world.completedObjectiveIds);
    f.simple('exit-optional');f.start();f.mode('delivery');expect(f.answer(true).status).toBe('handled');expect(f.view().feedback).toBe(f.definition.optionalActivity.feedback.alreadyCompleted);expect(f.simple('explain-optional').status).toBe('handled');expect(f.view().hintText).toBeTruthy();
    expect(f.game().world.completedQuestIds).toEqual([q(id)]);expect(f.game().notebook.factIds.filter(x=>x===fact)).toHaveLength(1);expect(f.game().world.completedObjectiveIds).toEqual(before.world.completedObjectiveIds);expect(f.game().world.inventory).toEqual(before.world.inventory);
    receipts[`OPT-${id}-FINISH/REPLAY`]={questCount:1,factCount:1,newAction:true,explanationReplay:true,mainObjectiveDelta:0};
  });
  it('UNTIMED keeps real solving state and progress after 3600 seconds of controlled logical time',()=>{
    vi.useFakeTimers();const f=make(id);f.start();f.mode('delivery');const before=structuredClone(f.state());expect(f.view().phase).toBe('solving');expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(3_600_000);expect(vi.getTimerCount()).toBe(0);expect(f.state()).toEqual(before);expect(f.state().control.optionalActivity?.timingEnabled).toBe(false);expect(f.answer(true).status).toBe('handled');expect(f.view().completed).toBe(true);
    receipts[`OPT-${id}-UNTIMED-logical-only`]={logicalSeconds:3600,scheduledTimers:0,wholeStateRetained:true,completionAvailable:true,visibilityNotExercisedHere:true};
  });
});
