// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/content/registry';
import validateSchema from '../../src/content/schema.generated.js';
import type * as S from '../../src/content/schema-types.generated';

const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')) as T;
const world = await read<S.world>('content/spec001/world.json');
const sources = await read<unknown>('content/spec001/sources.json');
const profiles = await read<S.collection>('content/spec001/profiles.json');
const objectives = await read<S.collection>('content/spec001/objectives.json');
const introductionProfiles = await read<S.collection>('content/spec001/profiles-introduction.json');
const introductionObjectives = await read<S.collection>('content/spec001/objectives-introduction.json');
const currentDocuments = Object.fromEntries(await Promise.all([...new Set(world.documents.map(d => d.path))].map(async path => [path, await read<unknown>(path)])));
const q = (id: string) => `spec001:${id}`;

/** Authoring-only integration. The actual world and current runtime remain untouched. */
function projection() {
  const candidate = structuredClone(world);
  // Preserve this definition-level fixture's original introduction scope. Later
  // room copies of evidence must not mask the intended malformed-definition
  // diagnostic with an earlier duplicate-ID rejection.
  const introductionPaths = new Set(['content/spec001/rooms/R01.json', 'content/spec001/rooms/R02.json',
    'content/spec001/dialogue/introduction.json', 'content/spec001/dialogue/interactions.json', 'content/spec001/items-introduction.json']);
  candidate.documents = candidate.documents.filter(r => introductionPaths.has(r.path));
  const documents = Object.fromEntries([...introductionPaths].map(path => [path, structuredClone(currentDocuments[path])]));
  for (const [path, collection] of [['content/spec001/profiles.json', profiles], ['content/spec001/objectives.json', objectives]] as const) {
    documents[path] = structuredClone(collection);
    for (const record of collection.records) candidate.documents.push({ kind: record.kind, id: record.id, path } as S.world['documents'][number]);
  }
  return { world: candidate, sources, documents };
}
function authored<K extends S.authoredRecord['kind']>(collection: S.collection, id: string, kind: K): Extract<S.authoredRecord, { kind: K }> {
  const record = collection.records.find(r => r.id === q(id));
  if (record?.kind !== kind) throw new Error(`Missing ${kind} ${id}`);
  return record as Extract<S.authoredRecord, { kind: K }>;
}
function changed(collection: 'profiles' | 'objectives', change: (value: S.collection) => void) {
  const input = projection();
  change(input.documents[`content/spec001/${collection}.json`] as S.collection);
  return validateContent(input);
}

describe('T069 authored physical profiles and objective obligations', () => {
  it('authors all seven reviewed profiles and twelve mandatory objectives under the existing schema', () => {
    expect(validateSchema(profiles), JSON.stringify(validateSchema.errors)).toBe(true);
    expect(validateSchema(objectives), JSON.stringify(validateSchema.errors)).toBe(true);
    expect(profiles.records.map(r => r.id).sort()).toEqual(['COPPER-100', 'OPTICAL', 'RADIO', 'POWER', 'CAPABILITIES', 'SYMBOLS', 'PACKET'].map(id => q(`PROFILE-${id}`)).sort());
    expect(objectives.records.map(r => r.id)).toEqual(Array.from({ length: 12 }, (_, i) => q(`O${String(i + 1).padStart(2, '0')}`)));
  });
  it('preserves the existing introduction records and validates the current runtime selection', () => {
    for (const record of introductionProfiles.records) expect(profiles.records.find(r => r.id === record.id)).toEqual(record);
    for (const record of introductionObjectives.records) expect(objectives.records.find(r => r.id === record.id)).toEqual(record);
    const result = validateContent({ world, sources, documents: currentDocuments });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  });
  it('joins complete collections through the real semantic registry with no new source/profile/graph assumptions', () => {
    const result = validateContent(projection());
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    if (!result.ok) return;
    expect(result.authoredRecordCount).toBeGreaterThanOrEqual(19);
    expect(result.routes).toEqual(['copper', 'fiber', 'radio']);
    for (const record of [...profiles.records, ...objectives.records]) expect(result.registry?.record(record.id)).toEqual(record);
  });
  it('keeps profile reading separate from scoring and retains dimensional fictional boundaries', () => {
    for (const record of profiles.records) {
      if (record.kind !== 'profile') throw new Error('Expected profile collection');
      for (const action of record.alternatives) expect(action.effects).toEqual([]);
    }
    expect(authored(profiles, 'PROFILE-OPTICAL', 'profile').parameters).toEqual({ transmit: {value:-3,unit:'dBm'}, sensitivity:{value:-14,unit:'dBm'}, maximumReceive:{value:-1,unit:'dBm'}, requiredMargin:{value:2,unit:'dB'}, inclusiveBounds:true });
    expect(authored(profiles, 'PROFILE-RADIO', 'profile').parameters).toEqual({requiredSNR:{value:20,unit:'dB'},inclusiveMinimum:true});
    expect(authored(profiles, 'PROFILE-POWER', 'profile').parameters).toEqual({deliveredBudget:{value:30,unit:'W'},inclusiveMaximum:true});
  });
  it('requires traceable evidence/rules and a nonpunitive full hint ladder for every later objective', () => {
    for (const record of objectives.records.slice(2)) {
      if (record.kind !== 'objective') throw new Error('Expected objective collection');
      const ids = new Set(record.evidence.map(e => e.id));
      expect(record.prerequisite).toEqual(world.objectives.find(o => o.id === record.id)?.prerequisite);
      expect(record.effects).toEqual(expect.arrayContaining([{kind:'complete-objective',effectId:record.id.replace(':O',':EFFECT-O'),objectiveId:record.id}]));
      expect(record.requiresReflexTiming).toBe(false);
      expect(Object.keys(record.hints)).toEqual(['method','workedStep','solution']);
      expect(new Set(Object.values(record.hints).map(h => h.text)).size).toBe(3);
      for (const hint of Object.values(record.hints)) expect(hint.text.length).toBeGreaterThan(40);
      for (const action of record.alternatives) {
        expect(action.evidenceIds.length).toBeGreaterThan(0);
        expect(action.evidenceIds.every(id => ids.has(id))).toBe(true);
        expect(action.ruleIds.length).toBeGreaterThan(0);
        if (action.method !== 'ally-ability') expect(action.abilityIds).toEqual([]);
        expect(action.effects.every(e => e.kind !== 'complete-objective' || e.objectiveId === record.id)).toBe(true);
      }
    }
  });
  it('provides both reviewed numerical alternatives rather than one privileged answer', () => {
    const expected: Record<string,string[]> = {
      O03:['section-replacement','alternate-passive-path'], O05:['inspected-connector-cleaning','inspected-connector-replacement'],
      O06:['passive-path-A','passive-path-B'], O07:['align-existing-path','choose-alternate-path'],
      O08:['scenario-channel-A','scenario-channel-B'], O09:['compatible-kit-A','compatible-kit-B'], O10:['step-and-decode','notebook-and-replay'],
    };
    const evidence: Record<string,string[]> = {O03:['compatibility','defect','path'],O05:['matching','inspection'],O06:['budget','compatibility'],O07:['path','settings'],O08:['snr','survey'],O09:['module','power','capability'],O10:['symbols','scope']};
    for (const [id, alternatives] of Object.entries(expected)) {
      const objective = authored(objectives,id,'objective');
      for (const required of alternatives) {
        const action=objective.alternatives.find(a=>a.id===q(`ACTION-${id}-${required}`));
        expect(action?.method).toBe(id==='O10'?'direct-action':'conventional-tool');
        expect(action?.abilityIds).toEqual([]);
        expect(action?.evidenceIds).toEqual(expect.arrayContaining(evidence[id]!.map(suffix=>q(`FACT-${id}-${suffix}`))));
      }
    }
  });
  it('preserves independent route commitment and all three distinct ending classifications', () => {
    const intervention=authored(objectives,'O11','objective');
    for (const [route, end] of [['copper','O04'],['fiber','O06'],['radio','O08']]) {
      const action=intervention.alternatives.find(a=>a.id===q(`ACTION-O11-${route}`))!;
      expect(action.condition).toEqual({kind:'all',conditions:[end,'O09','O10'].map(id=>({kind:'objective-complete',objectiveId:q(id!)}))});
      expect(action.effects).toEqual([{kind:'set-route',effectId:q(`EFFECT-O11-route-${route}`),route}]);
    }
    expect(intervention.alternatives.find(a=>a.id===q('ACTION-O11-shutdown'))?.effects).toEqual([]);
    const endings=authored(objectives,'O12','objective');
    expect(endings.alternatives.map(a=>a.id)).toEqual(expect.arrayContaining(['permanent','temporary','shutdown'].map(id=>q(`ACTION-O12-${id}`))));
    for (const id of ['permanent','temporary','shutdown']) expect(endings.alternatives.find(a=>a.id===q(`ACTION-O12-${id}`))?.effects).toEqual([]);
    expect(endings.alternatives.find(a=>a.id===q('ACTION-O12-shutdown'))?.evidenceIds).toEqual([q('FACT-O12-classification')]);
  });
  it('requires current dimensional measurement definitions for prepared/validated technical paths', () => {
    for (const id of ['O03','O04','O06','O08','O09','O10','O12']) {
      const measurements=authored(objectives,id,'objective').evidence.filter(e=>e.kind==='measurement');
      expect(measurements.length).toBeGreaterThan(0);
      for (const evidence of measurements) { expect(evidence.requiresFreshMeasurement).toBe(true); expect(evidence.readings?.length).toBeGreaterThan(0); }
    }
    const units=authored(objectives,'O09','objective').evidence.flatMap(e=>e.readings?.map(r=>r.unit)??[]);
    expect(units).toContain('W'); expect(units).toContain('Mbps'); expect(units).not.toContain('Mb/s');
  });
  it.each(['value','unit','inclusive'] as const)('rejects an unreviewed optical %s change', key => {
    const result=changed('profiles', value=>{
      const record=authored(value,'PROFILE-OPTICAL','profile');
      if(key==='inclusive') record.parameters['inclusiveBounds']=false;
      else record.parameters['requiredMargin']=key==='value'?{value:1,unit:'dB'}:{value:2,unit:'dBm'};
    });
    expect(result.ok).toBe(false); expect(result.issues.some(i=>i.code==='profile-review')).toBe(true);
  });
  it('rejects a source claim changed to a universal promise', () => {
    const result=changed('profiles', value=>{ authored(value,'PROFILE-RADIO','profile').sourceClaims[0]!.supportedClaim='20 dB guarantees throughput for every radio.'; });
    expect(result.ok).toBe(false); expect(result.issues.some(i=>i.code==='source-claim')).toBe(true);
  });
  it('rejects a missing final hint, nonfresh measurement or wrong measurement dimension', () => {
    const missing=structuredClone(objectives) as unknown as {records: {id:string;hints:{solution?:unknown}}[]};
    delete missing.records.find(r=>r.id===q('O06'))!.hints.solution;
    expect(validateSchema(missing)).toBe(false);
    for (const corrupt of ['freshness','unit']) {
      const result=changed('objectives', value=>{const e=authored(value,'O06','objective').evidence[0]!;if(corrupt==='freshness')e.requiresFreshMeasurement=false;else e.readings![0]!.unit='W';});
      expect(result.ok).toBe(false);expect(result.issues.some(i=>['measurement-definition','reading-unit'].includes(i.code))).toBe(true);
    }
  });
  it('rejects undeclared evidence and an effect that bypasses another mandatory objective', () => {
    const missing=changed('objectives', value=>{authored(value,'O08','objective').alternatives[0]!.evidenceIds=[q('FACT-absent')];});
    expect(missing.ok).toBe(false);expect(missing.issues.some(i=>i.code==='unknown-reference')).toBe(true);
    const bypass=changed('objectives',value=>{authored(value,'O03','objective').effects.push({kind:'complete-objective',effectId:q('EFFECT-bypass'),objectiveId:q('O12')});});
    expect(bypass.ok).toBe(false);expect(bypass.issues.some(i=>i.code==='objective-effect')).toBe(true);
  });
});
