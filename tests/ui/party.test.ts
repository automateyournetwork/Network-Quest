// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { partyFixture, q, registry, bindings, recruit, validator } from '../state/party-fixture';
import { createVerbController } from '../../src/ui/verbs';
import { createDialogueController, introductionDialogueBindings } from '../../src/ui/dialogue';
import { equipmentInteractionBindings } from '../../src/state/equipment-scenarios';
import { copySemanticAction } from '../../src/ui/action-bus';
import type { CharacterId, ActionId, AttemptId } from '../../src/domain/types';
import { captureEncounterContext, prepareEncounterCheckpoint, commitEncounterChange, prepareEncounterRollback } from '../../src/state/encounter';
import { riftPreparationBoundary } from '../../src/state/rift-encounter';
import { captureSafeSnapshot } from '../../src/state/snapshot';

describe('Party UI joins exact authored encounters and atomic stores',()=>{
  it('discovers Photon from Look in one CAS, without automatically recruiting or changing physics',()=>{
    const f=partyFixture(),verbs=createVerbController({registry,store:f.store,bus:f.bus,bindings:[],panels:f.controller.panels});const before=f.state().game!,commits=f.commits();
    expect(f.dispatch({kind:'interact',verb:'look',targetId:q('HOTSPOT-photon'),itemId:null}).status).toBe('handled');
    expect(f.commits()).toBe(commits+1);expect(f.state().game!.world.compendiumIds).toContain(q('COMPENDIUM-CH03'));expect(f.state().game!.world.recruits).toEqual([]);
    expect(f.state().game!.world.configurationRevision).toBe(before.world.configurationRevision);expect(f.state().game!.notebook).toEqual(before.notebook);
    expect(f.dispatch({kind:'open-panel',panel:'party'}).status).toBe('handled');expect(f.controller.project().open).toBe(true);expect(f.controller.project().view.rows).toHaveLength(1);
    expect(f.controller.project().view.rows[0]!.controls[0]!.unavailableReason).toBeDefined();verbs.dispose();
  });
  it('joins existing Photon dialogue discovery and effects in a single CAS; a failed CAS installs neither',()=>{
    for(const blocked of [false,true]){const f=partyFixture(),before=f.reducerState(),store=blocked?{...f.store,compareAndSet:()=>false}:f.store;
      const dialogue=createDialogueController({registry,store,bus:f.bus,bindings:introductionDialogueBindings,effectBindings:bindings});
      const verbs=createVerbController({registry,store,bus:f.bus,bindings:dialogue.hotspotBindings});const result=f.dispatch({kind:'interact',verb:'talk',targetId:q('HOTSPOT-photon'),itemId:null});
      if(blocked){expect(result.status).toBe('rejected');expect(f.reducerState()).toBe(before);expect(dialogue.project().view.open).toBe(false);}
      else{expect(result.status).toBe('handled');expect(f.commits()).toBe(1);expect(f.state().game!.world.compendiumIds).toContain(q('COMPENDIUM-CH03'));expect(dialogue.project().view.open).toBe(true);}
      dialogue.dispose();verbs.dispose();}
  });
  it('joins market actor Talk and ordinary authored evidence effects with one CAS',()=>{
    const f=partyFixture();f.walk('R09');createVerbController({registry,store:f.store,bus:f.bus,bindings:equipmentInteractionBindings(registry).hotspots});const count=f.commits();
    expect(f.dispatch({kind:'interact',verb:'talk',targetId:q('HOTSPOT-market-eel'),itemId:null}).status).toBe('handled');expect(f.commits()).toBe(count+1);expect(f.state().game!.world.compendiumIds).toContain(q('COMPENDIUM-CH19'));
  });
  it('CH25 Look is an actual actor encounter with no hazard, repair or objective effect',()=>{
    const f=partyFixture();f.walk('R11');createVerbController({registry,store:f.store,bus:f.bus,bindings:[]});const before=structuredClone(f.state().game!);
    expect(f.dispatch({kind:'interact',verb:'look',targetId:q('HOTSPOT-r11-backhoe'),itemId:null}).status).toBe('handled');
    expect(f.state().game!.world).toEqual({...before.world,compendiumIds:[...before.world.compendiumIds,q('COMPENDIUM-CH25')]});expect(f.state().game!.notebook).toEqual(before.notebook);
  });
  it('copies and freezes active-ally arrays at capture and refuses effects or verdict fields',()=>{
    const ids:CharacterId[]=[q('CH03')],copy=copySemanticAction({kind:'set-active-allies',characterIds:ids});ids.push(q('CH04'));expect(copy).toEqual({kind:'set-active-allies',characterIds:[q('CH03')]});
    expect(Object.isFrozen(copy.kind==='set-active-allies'&&copy.characterIds)).toBe(true);
    expect(()=>copySemanticAction({kind:'invite-ally',characterId:q('CH03'),effects:[]} as never)).toThrow();
  });
  it('preserves captured party controls and refuses them after real navigation changes the version',()=>{
    const f=partyFixture();recruit(f,'CH03');const projection=f.controller.project(),control=projection.view.rows[0]!.controls.find(c=>c.label.startsWith('Activate'))!;
    const captured=projection.capture(control.action);f.walk('R06');const before=f.reducerState();expect(f.bus.dispatch(captured).status).toBe('rejected');expect(f.reducerState()).toBe(before);
  });
  it.each(['terminal-failure','shutdown'] as const)('%s rewinds an actual nonempty party checkpoint and discards unfinished practice',kind=>{
    const f=partyFixture();recruit(f,'CH03');recruit(f,'CH19');f.setActive(['CH03','CH19']);f.returnToPreparation();const before=f.reducerState();
    expect(before.runtime.activity?.kind).toBe('safe-preparation');const plan=prepareEncounterCheckpoint(before,captureEncounterContext(before)!,registry,riftPreparationBoundary);expect(plan.ok).toBe(true);if(!plan.ok)throw new Error(plan.reason);
    expect(commitEncounterChange(f.store,plan.change).ok).toBe(true);const checkpoint=structuredClone(f.state().checkpoint!.world);
    f.beginPractice('CH03');f.demonstrateProgression('CH03');f.advance('CH03');f.setActive(['CH19']);f.beginPractice('CH19');f.demonstrateProgression('CH19');
    const journal=structuredClone(f.state().game!.notebook);f.supplyActivity(kind);const ended=f.reducerState();
    const rollback=prepareEncounterRollback(ended,captureEncounterContext(ended)!,registry,{actionId:crypto.randomUUID() as ActionId,nextAttemptId:crypto.randomUUID() as AttemptId},riftPreparationBoundary);expect(rollback.ok).toBe(true);if(!rollback.ok)throw new Error(rollback.reason);
    const count=f.commits();expect(commitEncounterChange(f.store,rollback.change).ok).toBe(true);expect(f.commits()).toBe(count+1);expect(f.state().game!.world.recruits).toEqual(checkpoint.recruits);expect(f.state().game!.world.activeAllyIds).toEqual(checkpoint.activeAllyIds);
    expect(f.state().game!.notebook.measurements).toEqual(journal.measurements.map(m=>({...m,stale:true})));expect(f.reducerState().control.partyPractice).toBeNull();expect(captureSafeSnapshot(f.reducerState(),validator).ok).toBe(true);
  });
});
