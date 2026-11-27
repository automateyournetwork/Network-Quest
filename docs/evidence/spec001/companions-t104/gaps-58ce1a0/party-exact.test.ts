// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Explicit prepared-state tests. Actual encounters/demonstrations/operations run;
// unrelated initial prerequisites are supplied by the documented party fixture.
import { afterEach, describe, expect, it } from 'vitest';
import { partyFixture, recruit, registry, world, navigation, scenario, bindings, q } from '../../../../../tests/state/party-fixture';
import type { Recruit } from '../../../../../tests/state/party-fixture';
import { projectCompendium } from '../../../../../src/ui/compendium';
import { createReducer, createReducerState, isMeasurementCurrent } from '../../../../../src/state/reducer';
import type { ReducerInput } from '../../../../../src/state/reducer';
import { evaluateObjective } from '../../../../../src/state/objectives';
import type { ObjectiveScenarioResolver } from '../../../../../src/state/objectives';
import { conventionalAbilityOperation } from '../../../../../src/state/party';
import type { ContentRegistry } from '../../../../../src/content/registry';
import type { ActionId, ConfigurationRevision, MeasurementId } from '../../../../../src/domain/types';
const ids:Recruit[]=['CH03','CH04','CH05','CH06','CH07','CH16','CH19','CH20','CH22'];
const active:ReturnType<typeof partyFixture>[]=[];
const make=()=>{const f=partyFixture();active.push(f);return f;};
afterEach(()=>active.splice(0).forEach(f=>f.dispose()));
const projection=(f:ReturnType<typeof make>)=>projectCompendium({registry,metadata:world,game:f.state().game!,evidence:[],navigation,activity:'stable-exploration'});
describe.each(ids)('%s exact discovery/recruit/progression checkpoints',character=>{
  it('DISCOVERY shows only real encountered identity, teaching, limitations, source and realm before demonstration',()=>{
    const f=make();expect(projection(f).entries.some(row=>row.characterId===q(character))).toBe(false);f.encounter(character);const before=structuredClone(f.state().game!);
    const row=projection(f).entries.find(row=>row.characterId===q(character))!;expect(row).toBeDefined();expect(row.name.length).toBeGreaterThan(0);expect(row.role.length).toBeGreaterThan(0);expect(row.technology.length).toBeGreaterThan(0);expect(row.limitations.length).toBeGreaterThan(0);expect(row.sources.length).toBeGreaterThan(0);expect(row.realmNote.length).toBeGreaterThan(0);expect(row.status).toBe('Discovered; not recruited');expect(row.abilities.every(ability=>!ability.unlocked)).toBe(true);
    expect(f.state().game!.world.recruits).toEqual([]);expect(f.invite(character).status).not.toBe('handled');expect(f.state().game).toEqual(before);
  });
  it('RECRUIT requires real evidence and records one identity without automatic activation or duplicate award',()=>{
    const f=make();recruit(f,character);expect(f.state().game!.world.recruits.map(r=>r.characterId)).toEqual([q(character)]);expect(f.state().game!.world.recruits).toHaveLength(1);expect(f.state().game!.world.activeAllyIds).toEqual([]);
    const before=structuredClone(f.state().game);f.invite(character);expect(f.state().game).toEqual(before);expect(f.state().persistence.pendingRequest).toBeNull();
  });
  it('PROGRESS uses a new meaningful lesson, exposes useful context and grants cumulative abilities only once',()=>{
    const f=make();recruit(f,character);const original=structuredClone(f.state().game!);expect(f.advance(character).status).not.toBe('handled');expect(f.state().game).toEqual(original);
    expect(f.beginPractice(character).status).toBe('handled');f.demonstrateProgression(character);const prior=f.state().game!;expect(prior.notebook.measurements.length).toBeGreaterThan(original.notebook.measurements.length);expect(f.advance(character).status).toBe('handled');
    const current=f.state().game!.world.recruits[0]!;expect(current.level).toBe(2);expect(current.abilityIds).toEqual(expect.arrayContaining([...original.world.recruits[0]!.abilityIds]));expect(current.abilityIds.length).toBeGreaterThan(original.world.recruits[0]!.abilityIds.length);
    const row=f.controller.project().view.rows.find(row=>row.id===q(character))!;expect(row.explanation.length).toBeGreaterThan(50);
    const required:Record<Recruit,RegExp>={CH03:/Wavelength direction|Declared compatibility/,CH16:/Wavelength direction|Declared compatibility/,CH04:/Continuity.*channel length/,CH05:/sensitivity.*maximum receive.*reserve/,CH06:/modes.*lanes/,CH07:/signal and noise/,CH19:/simultaneous delivered demand/,CH20:/cannot bridge/,CH22:/both advertised sets.*empty intersection/};expect(row.explanation).toMatch(required[character]);
    const once=structuredClone(f.state().game);f.advance(character);expect(f.state().game).toEqual(once);expect(f.state().persistence.pendingRequest).toBeNull();
  });
});
describe('original party negative and once-only boundaries',()=>{
  it('TWO / THREE / FREE-SWAP uses the exact original identities, quantity and unchanged rejected state',()=>{
    const f=make();for(const id of ['CH03','CH04','CH19'] as const)recruit(f,id);f.returnToPreparation();expect(f.setActive(['CH03','CH04']).status).toBe('handled');expect(f.state().game!.world.activeAllyIds).toEqual([q('CH03'),q('CH04')]);
    const before=structuredClone(f.state());expect(f.setActive(['CH03','CH04','CH19']).status).not.toBe('handled');expect(f.state()).toEqual(before);
    expect(f.setActive(['CH04','CH19']).status).toBe('handled');expect(f.state().game!.world.activeAllyIds).toEqual([q('CH04'),q('CH19')]);expect(f.state().game!.world.inventory).toEqual(before.game!.world.inventory);expect(f.state().game!.world.inventory).toEqual([{itemId:q('ITEM-inspection-kit'),quantity:1}]);
    expect(f.state().persistence.pendingRequest).toBeNull();expect(f.state().persistence.lastAcknowledgement).toEqual(before.persistence.lastAcknowledgement);expect(f.state().persistence.autosaveEnabled).toBe(false);
  });
  it('MISSING-ALLY keeps ordinary tools accepted and actual return to preparation reachable without CH19',()=>{
    const f=make();f.returnToPreparation();expect(f.state().game!.world.recruits).toEqual([]);expect(f.state().activity?.kind).toBe('safe-preparation');expect(navigation.canReachRoom(f.state().game!.world,q('R09'))).toBe(true);
    f.walk('R09');f.action('ACTION-market-compatible-kit-A');f.action('ACTION-equipment-mode-100-full');const observation=f.measure('O09');expect(observation.readings.length).toBeGreaterThan(0);expect(observation.conclusionCode).toMatch(/:correct$/);f.returnToPreparation();expect(f.state().activity?.kind).toBe('safe-preparation');expect(f.state().game!.world.recruits).toEqual([]);
  });
  it('UNSAFE-SWAP retains the exact original pair and explains the safe-preparation return',()=>{
    const f=make();for(const id of ['CH03','CH04','CH19'] as const)recruit(f,id);f.returnToPreparation();f.setActive(['CH03','CH04']);f.supplyActivity('active-encounter');const before=structuredClone(f.state());const result=f.setActive(['CH04','CH19']);expect(result.status).not.toBe('handled');expect(result).toMatchObject({message:expect.stringContaining('Return to safe preparation')});expect(f.state()).toEqual(before);expect(f.state().game!.world.activeAllyIds).toEqual([q('CH03'),q('CH04')]);
  });
  it('STALE rejects real revision-8 evidence at revision 9 in the same attempt without objective award',()=>{
    const f=make();recruit(f,'CH19');f.beginPractice('CH19');f.demonstrateProgression('CH19');f.advance('CH19');f.setActive(['CH19']);f.walk('R09');f.action('ACTION-market-compatible-kit-A');f.action('ACTION-equipment-mode-100-full');
    // Explicit prepared revision origin; the tested observation is then generated
    // by the real objective. No retained observation is forged or relabeled.
    const old=f.state(),game=old.game!;f.replace(createReducerState({...old,game:{...game,world:{...game.world,configurationRevision:8 as ConfigurationRevision,completedObjectiveIds:game.world.completedObjectiveIds.filter(id=>id!==q('O09'))},notebook:{...game.notebook,measurements:[]}}}));
    const observed=f.measure('O09');expect(observed.configurationRevision).toBe(8);const attempt=f.state().game!.world.attemptId;f.action('ACTION-market-compatible-kit-B');const current=f.state().game!;expect(current.world.configurationRevision).toBe(9);expect(current.world.attemptId).toBe(attempt);expect(current.notebook.measurements[0]?.stale).toBe(true);expect(isMeasurementCurrent(current.notebook.measurements[0]!,current.world)).toBe(false);
    const selected=scenario(current,q('O09'))!;const evaluated=evaluateObjective(registry,scenario,current,q('O09'),{actionId:'stale-original-case' as ActionId,expectedVersion:current.world,input:{kind:'submit',alternativeId:selected.alternativeId,measurementId:observed.id}});expect(evaluated).toMatchObject({status:'incorrect',reasonCode:'stale-evidence',acceptedEffects:[]});expect(current.world.completedObjectiveIds).not.toContain(q('O09'));expect(f.controller.project().view.rows[0]?.explanation).toContain('stale; comparison only');
  });
  it('REPLAY adapts benefit to actual objective identity: ability operation and completion replays stay once-only, fresh measurements remain allowed',()=>{
    const f=make();recruit(f,'CH04');f.setActive(['CH04']);f.walk('R03');f.action('ACTION-copper-restore-original');f.measure('O03');f.action('ACTION-copper-replace-section');f.walk('R04');f.action('ACTION-copper-repeater-requires-continuity');
    const old=f.reducerState(),game=old.runtime.game!;f.replace(createReducerState({...old.runtime,game:{...game,world:{...game.world,completedObjectiveIds:game.world.completedObjectiveIds.filter(id=>id!==q('O04'))}}}));
    const inventory=structuredClone(f.state().game!.world.inventory);expect(f.state().game!.world.completedObjectiveIds.filter(id=>id===q('O04'))).toHaveLength(0);
    const run=(id:string,input:ReducerInput)=>{const before=f.reducerState(),current=f.state().game!;const out=f.store.reduce(before,{actionId:id as ActionId,adventureId:current.adventureId,expectedVersion:current.world,input});expect(out.status).not.toBe('rejected');f.replace(out.state);return out;};
    const measurementId='00000000-0000-4000-8000-000000000811' as MeasurementId;
    const operation:ReducerInput={kind:'party',operation:{kind:'ability',characterId:q('CH04'),abilityId:q('ABILITY-CH04-continuity-comparison'),actionId:q('ACTION-O04-conventional-continuity-tool'),measurementId}};
    expect(run('ability-once',operation).status).toBe('applied');const measured=structuredClone(f.state().game);expect(run('ability-once',operation).status).toBe('no-op');expect(f.state().game).toEqual(measured);expect(f.state().game!.world.completedObjectiveIds).not.toContain(q('O04'));
    const submit:ReducerInput={kind:'objective',operation:{kind:'submit',objectiveId:q('O04'),alternativeId:q('ACTION-O04-conventional-continuity-tool'),measurementId}};expect(run('completion-once',submit).status).toBe('applied');const completed=structuredClone(f.state().game!);expect(completed.world.completedObjectiveIds.filter(id=>id===q('O04'))).toHaveLength(1);
    expect(run('completion-once',submit).status).toBe('no-op');run('completion-new-id',submit);expect(f.state().game).toEqual(completed);expect(f.state().game!.world.inventory).toEqual(inventory);
    run('legitimate-fresh-measurement',{kind:'party',operation:{kind:'ability',characterId:q('CH04'),abilityId:q('ABILITY-CH04-continuity-comparison'),actionId:q('ACTION-O04-conventional-continuity-tool'),measurementId:'00000000-0000-4000-8000-000000000812' as MeasurementId}});expect(f.state().game!.notebook.measurements.length).toBe(completed.notebook.measurements.length+1);expect(f.state().game!.world.completedObjectiveIds.filter(id=>id===q('O04'))).toHaveLength(1);
  });
  it.each(['navigation','Restore'] as const)('INTERRUPT synchronous-design adaptation rejects retained ability callback after %s',boundary=>{
    const f=make();recruit(f,'CH03');f.setActive(['CH03']);f.walk('R05');f.action('ACTION-fiber-restore-original');const projection=f.controller.project(),control=projection.view.rows[0]!.controls.find(c=>c.action.kind==='use-ally-ability'&&c.action.actionId===q('ACTION-fiber-inspect-before'))!;expect(control).toBeDefined();const captured=projection.capture(control.action);
    if(boundary==='navigation')f.walk('R06');else f.saveAndRestore();const before=structuredClone(f.state());expect(f.bus.dispatch(captured).status).toBe('rejected');expect(f.state()).toEqual(before);
  });
  it.each(['unknown-profile','echo-topology'] as const)('CONTENT-ERROR executes actual ally and ordinary measurement entry points for %s without penalty/progress',kind=>{
    const f=make();recruit(f,'CH20');f.setActive(['CH20']);f.walk('R04');const source=f.state();
    const faulty:ContentRegistry={...registry,record(id){const record=registry.record(id);return kind==='unknown-profile'&&id==='spec001:PROFILE-COPPER-100'&&record?.kind==='profile'?{...record,reviewedProfileId:'spec001:UNKNOWN'}:record;}};
    const resolve:ObjectiveScenarioResolver=(game,id)=>{const selected=scenario(game,id);return kind==='echo-topology'&&selected?.kind==='copper-proof'?{...selected,path:{...selected.path,kind:'two-segments-with-regenerator'}} as unknown as ReturnType<ObjectiveScenarioResolver>:selected;};
    for(const ally of [true,false]){
      const original=source.game!;const state=createReducerState({...source,game:{...original,world:{...original.world,recruits:ally?original.world.recruits:[],activeAllyIds:ally?[q('CH20')]:[]}}});const game=state.runtime.game!,mid='00000000-0000-4000-8000-000000000821' as MeasurementId;
      const ordinary=conventionalAbilityOperation(faulty,resolve,game,q('ACTION-O04-conventional-continuity-tool'),mid)!;expect(ordinary).not.toBeNull();const reduce=createReducer({registry:faulty,bindings,objectiveScenario:resolve});
      const input:ReducerInput=ally?{kind:'party',operation:{kind:'ability',characterId:q('CH20'),abilityId:q('ABILITY-CH20-regeneration-limit'),actionId:q('ACTION-O04-conventional-continuity-tool'),measurementId:mid}}:ordinary;
      const result=reduce(state,{actionId:'fault-test' as ActionId,adventureId:game.adventureId,expectedVersion:game.world,input});expect(result).toMatchObject({status:'rejected',reason:'content-error'});expect(result.state).toBe(state);
      const evaluated=evaluateObjective(faulty,resolve,game,q('O04'),{actionId:'fault-evaluator' as ActionId,expectedVersion:game.world,input:{kind:'measure',alternativeId:q('ACTION-O04-conventional-continuity-tool'),id:mid}});expect(evaluated).toMatchObject({status:'content-error',acceptedEffects:[],observations:[{kind:'content-error',attemptPenalty:0,progressAward:0}]});
    }
  });
});
