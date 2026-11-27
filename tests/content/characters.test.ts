// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/content/registry';
import { loadIntroductionContent } from '../../src/app/content';
import type * as S from '../../src/content/schema-types.generated';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const json = (path: string): any => JSON.parse(read(path));
const world = json('content/spec001/world.json');
const sources = json('content/spec001/sources.json');
const originalSchema = json('docs/evidence/spec001/characters/content-schema-before-T093.json');
const schema = json('content/schemas/content.schema.json');
const fixture = json('tests/fixtures/companions.json');
const manifest = json('assets-src/manifest.json');
const documents = Object.fromEntries([...new Set<string>(world.documents.map((d: any) => d.path))].map(path => [path, json(path)]));
const input = () => structuredClone({ world, sources, documents });
const chars = (data: ReturnType<typeof input>) => data.documents['content/spec001/characters.json'].records as any[];
const char = (data: ReturnType<typeof input>, short = 'CH03') => chars(data).find(c => c.id === `spec001:${short}`)!;
const reject = (data: ReturnType<typeof input>, code: string) => {
  const result = validateContent(data);
  expect(result.ok, JSON.stringify(result)).toBe(false);
  if (!result.ok) expect(result.issues.map(i => i.code)).toContain(code);
};
const recruitIds = ['CH03','CH04','CH05','CH06','CH07','CH16','CH19','CH20','CH22'].map(id => `spec001:${id}`);

describe('T093 canonical authored character roster', () => {
  it('loads exactly the specified 25 identities and nine recruit contracts into the actual registry', () => {
    const { registry, world: metadata } = loadIntroductionContent();
    expect(chars(input()).map(c => c.id)).toEqual(Array.from({length:25},(_,n)=>`spec001:CH${String(n+1).padStart(2,'0')}`));
    expect(chars(input()).filter(c => c.recruitable).map(c => c.id)).toEqual(recruitIds);
    for (const meta of metadata.characters) expect(registry.record(meta.id)?.kind).toBe('character');
    expect(metadata.constraints.maximumActiveAllies).toBe(2);
    expect(metadata.constraints.optionalRewardsRequiredForMainStory).toBe(false);
  });
  it.each(fixture.recruits as any[])('$characterId preserves independently authored demonstration, progression and source-backed rules', oracle => {
    const c = char(input(), oracle.characterId.slice(8));
    expect(c.recruitment.demonstratedInteraction).toBe(oracle.demonstratedInteraction);
    expect(c.abilities[0].description).toBe(oracle.abilityExpectation);
    expect(c.abilities[1].description).toBe(oracle.progressionExpectation);
    expect(c.progression.map((p:any)=>p.level)).toEqual([1,2]);
    for (const a of c.abilities) {
      expect(a.ruleIds).toEqual(oracle.ruleIds.map((id:string)=>`spec001:${id}`));
      expect(a.effects).toEqual([]);
      expect(a.conventionalEquivalentItemIds).toEqual([]);
      expect(a.conventionalEquivalentActionIds.length).toBeGreaterThan(0);
    }
    expect(c.recruitment.demonstration.evidencePolicy).toBe('accepted-demonstration-is-learning-only');
    expect(c.recruitment.roomIds).toEqual(oracle.roomIds);
    const claims = c.compendium.sourceClaims.map((s:any)=>s.sourceId);
    for (const id of oracle.sourceIds) expect(claims).toContain(`spec001:${id}`);
  });
  it('binds each portrait/model to its actual manifest identity without declaring production acceptance', () => {
    for (const c of chars(input())) {
      const short = c.id.slice(8);
      const portrait = manifest.assets.find((a:any)=>a.assetId===c.compendium.portraitAssetId);
      const model = manifest.assets.find((a:any)=>a.assetId===`spec001:ASSET-${short}`);
      expect(portrait).toMatchObject({kind:'portrait',semanticIdentity:`spec001:PORTRAIT-${short}`});
      expect(model).toMatchObject({kind:'character-model',semanticIdentity:c.id});
      expect(c.assetIds).toEqual([model.assetId,portrait.assetId]);
      expect(c.compendium).not.toHaveProperty('portraitProduced');
    }
  });
  it('keeps sixteen nonrecruits free of recruitment or ability progression', () => {
    for (const c of chars(input()).filter(c=>!c.recruitable)) {
      expect(c.recruitment).toBeUndefined();expect(c.abilities).toEqual([]);expect(c.progression).toEqual([]);
      expect(c.compendium.recruitmentSummary).toContain('Not recruitable');
    }
  });
  it('binds Hermit’s five-field demonstration to the actual optical evaluator, not the market power result', () => {
    const c=char(input(),'CH16');
    expect(c.recruitment.demonstration.objectiveIds).toEqual(['spec001:O05']);
    expect(c.recruitment.demonstration.profileIds).toEqual(['spec001:PROFILE-OPTICAL']);
    expect(c.recruitment.roomIds).toEqual(['spec001:R06','spec001:R09']);
    expect(c.recruitment.condition).toEqual({kind:'all',conditions:[{kind:'objective-complete',objectiveId:'spec001:O05'}]});
    expect(c.progression[1].demonstration.actionIds).toContain('spec001:ACTION-fiber-profile-wrong-polarity');
    const data=input();char(data,'CH16').recruitment.demonstration.objectiveIds=['spec001:O09'];reject(data,'character-demonstration');
  });
  it('requires all 25 even if both one record and its document reference are removed together', () => {
    const data=input();data.documents['content/spec001/characters.json'].records=chars(data).filter(c=>c.id!=='spec001:CH25');
    data.world.documents=data.world.documents.filter((r:any)=>r.id!=='spec001:CH25');reject(data,'character-roster');
  });
  it('rejects a borrowed portrait and a missing complete compendium contract', () => {
    let data=input();char(data).compendium.portraitAssetId='spec001:ASSET-PORTRAIT-CH04';reject(data,'character-portrait');
    data=input();delete char(data).compendium.recruitmentSummary;reject(data,'character-compendium');
  });
  it('rejects added recruitment/levels on a nonrecruit without changing the nine-recruit roster', () => {
    const data=input();char(data,'CH08').abilities=[structuredClone(char(data).abilities[0])];
    char(data,'CH08').abilities[0].id='spec001:ABILITY-CH08-illegal';reject(data,'character-nonrecruit');
  });
  it('rejects unknown and circular ally action equivalents', () => {
    let data=input();char(data).abilities[0].conventionalEquivalentActionIds=['spec001:ACTION-missing'];reject(data,'unknown-reference');
    data=input();const o=data.documents['content/spec001/objectives.json'].records.find((r:any)=>r.id==='spec001:O05');
    o.alternatives[0].method='ally-ability';o.alternatives[0].abilityIds=[char(data).abilities[0].id];
    char(data).abilities[0].conventionalEquivalentActionIds=[o.alternatives[0].id];reject(data,'equivalent');
  });
  it('rejects optional/future dependencies in invitation and a fabricated home room', () => {
    let data=input();char(data).recruitment.condition={kind:'quest-complete',questId:'spec001:SQ01'};reject(data,'character-dependency');
    data=input();char(data).recruitment.roomIds=['spec001:R03'];reject(data,'character-recruitment-room');
  });
  it('rejects missing proof, wrong canonical evidence and reused base ability as progression', () => {
    let data=input();delete char(data).recruitment.demonstration;reject(data,'character-demonstration');
    data=input();char(data).recruitment.demonstration.objectiveIds=['spec001:O01'];reject(data,'character-demonstration');
    data=input();char(data).progression[1].abilityIds=[...char(data).progression[0].abilityIds];reject(data,'character-progression');
  });
  it('rejects existing but unrelated evidence, rules and profiles as demonstration provenance', () => {
    let data=input();char(data).recruitment.demonstration.evidenceIds.push('spec001:FACT-O08-snr');reject(data,'character-demonstration');
    data=input();char(data).recruitment.demonstration.ruleIds=['spec001:PHY07'];reject(data,'character-demonstration');
    data=input();char(data).abilities[0].profileIds=['spec001:PROFILE-RADIO'];reject(data,'character-ability');
  });
  it('rejects unreviewed rule/profile refs, incomplete source coverage and altered reviewed claims', () => {
    let data=input();char(data).abilities[0].profileIds=['spec001:PROFILE-UNREVIEWED'];reject(data,'unknown-reference');
    data=input();char(data).compendium.sourceClaims=char(data).compendium.sourceClaims.filter((s:any)=>s.sourceId!=='spec001:S07');reject(data,'source-coverage');
    data=input();char(data).compendium.sourceClaims[0].supportedClaim='A lit link proves every service.';reject(data,'source-claim');
  });
  it('cannot put a new scored rule into a descriptive reference', () => {
    const data=input();char(data,'CH14').compendium.contextSources[0].ruleIds=['spec001:PHY03'];reject(data,'schema');
  });
});

describe('T093 bounded schema evolution preserves T092 provenance', () => {
  it('retains the exact original authoring schema and changes only the three reviewed definitions', () => {
    expect(createHash('sha256').update(read('docs/evidence/spec001/characters/content-schema-before-T093.json')).digest('hex')).toBe('712297ffb45b2d1fa9abf75ff042ca1c50a58610d077a61cc1dc13688afbb27b');
    expect(fixture.frozenArtifacts['content/schemas/content.schema.json']).toBe('712297ffb45b2d1fa9abf75ff042ca1c50a58610d077a61cc1dc13688afbb27b');
    const changed=Object.keys(schema.$defs).filter(k=>JSON.stringify(schema.$defs[k])!==JSON.stringify(originalSchema.$defs[k]));
    expect(changed).toEqual(['ability','character','characterDemonstration']);
    expect(schema.$defs.ability.anyOf).toBeUndefined();
    // The generated editor type must keep the complete ability object.
    const ability = char(input()).abilities[0] as S.ability;
    expect(ability.id).toMatch(/^spec001:ABILITY-/);
    expect(ability.conventionalEquivalentActionIds?.length).toBeGreaterThan(0);
  });
  it('accepts every old-shaped current document with both schemas', () => {
    const compile=(s:any)=>{const a=new Ajv({strict:true,allErrors:true});formats(a);return a.compile(s)};
    const old=compile(originalSchema),current=compile(schema);
    for(const [path,document] of Object.entries(documents)) {
      if(path==='content/spec001/characters.json')continue;
      expect(old(document),path).toBe(true);expect(current(document),path).toBe(true);
    }
  });
});
