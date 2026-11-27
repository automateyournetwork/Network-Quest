// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, it } from 'vitest';
import { loadIntroductionContent } from '../../src/app/content';
import { optionalActivityDefinition } from '../../src/state/optional-activities';
it('loads the actual SQ04 notebook variant with no scored physical rule', () => {
  const { registry } = loadIntroductionContent();
  const quest = optionalActivityDefinition(registry, 'spec001:SQ04');
  expect(quest).not.toBeNull();
  expect(quest?.ruleIds).toEqual([]);
  expect(quest?.optionalActivity.kind).toBe('notebook-combination');
});

import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import { describe } from 'vitest';
import { validateContent } from '../../src/content/registry';
import { optionalRewardAllocationMatches } from '../../src/state/optional-activities';
const json = (path: string): any => JSON.parse(readFileSync(path, 'utf8'));
function input() { const world = json('content/spec001/world.json'); return { world, sources: json('content/spec001/sources.json'), documents: Object.fromEntries([...new Set<string>(world.documents.map((d: any) => d.path))].map(path => [path, json(path)])) }; }
describe('SQ04 bounded schema and canonical acquisition identity', () => {
  it.each(['extra-rule','wrong-identity','profile','partial-receipt','main-reward','wrong-action','duplicate-source','fresh-proof','wrong-subject','wrong-origin','wrong-return','timed','new-source','missing-exit','missing-practice','required','extra-alternative','extra-input'])('rejects %s corruption before a learner answer', kind => {
    const data = input(), quest = data.documents['content/spec001/quests/SQ04.json'], a = quest.optionalActivity;
    if (kind === 'extra-rule') quest.ruleIds = ['spec001:PHY04'];
    if (kind === 'wrong-identity') quest.id = 'spec001:SQ02';
    if (kind === 'profile') quest.profileIds = ['spec001:PROFILE-POWER'];
    if (kind === 'partial-receipt') quest.effects.pop();
    if (kind === 'main-reward') quest.effects[1] = { kind: 'complete-objective', effectId: 'spec001:EFFECT-SQ04-complete', objectiveId: 'spec001:O05' };
    if (kind === 'wrong-action') a.clues[1].sourceActionId = 'spec001:ACTION-fiber-clean';
    if (kind === 'duplicate-source') a.clues[1] = a.clues[0];
    if (kind === 'fresh-proof') data.documents['content/spec001/rooms/R05.json'].evidence.find((e: any) => e.id === 'spec001:FACT-O05-inspection').requiresFreshMeasurement = true;
    if (kind === 'wrong-subject') data.documents['content/spec001/rooms/R03.json'].evidence.find((e: any) => e.id === 'spec001:FACT-O03-defect').subjectIds = ['spec001:PR021'];
    if (kind === 'wrong-origin') a.entryContexts[0].roomId = 'spec001:R09';
    if (kind === 'wrong-return') a.returnPolicy = 'choose-room';
    if (kind === 'timed') a.timingDefault = 'on';
    if (kind === 'new-source') quest.sourceClaims.push(data.documents['content/spec001/quests/SQ03.json'].sourceClaims[0]);
    if (kind === 'missing-exit') delete a.controls.exit;
    if (kind === 'missing-practice') delete a.practice;
    if (kind === 'required') quest.prerequisite = { kind: 'objective-complete', objectiveId: 'spec001:O05' };
    if (kind === 'extra-alternative') quest.alternatives.push(quest.alternatives[0]);
    if (kind === 'extra-input') a.answerParser = 'freeform';
    expect(validateContent(data).ok).toBe(false);
  });
  it.each(['SQ01','SQ02','SQ03'])('keeps %s quest and alternative rule lists nonempty', id => {
    for (const target of ['quest','alternative']) { const data = input(), quest = data.documents[`content/spec001/quests/${id}.json`]; (target === 'quest' ? quest : quest.alternatives[0]).ruleIds = []; expect(validateContent(data).ok).toBe(false); }
  });
  it('preserves the genuine pre-T099 rejection, while current schema accepts its approved new variant', () => {
    const ajv = new Ajv({ strict: true, allErrors: true }); formats(ajv); const old = ajv.compile(json('docs/evidence/spec001/optional/SQ04/joined/content-schema-before-T099.json'));
    expect(old(json('content/spec001/quests/SQ04.json'))).toBe(false); expect(old(json('docs/evidence/spec001/optional/SQ04/SQ04.current-schema.json'))).toBe(false);
    for (const id of ['SQ01','SQ02','SQ03']) expect(old(json(`content/spec001/quests/${id}.json`))).toBe(true);
  });
  it('keeps the text reward independent of produced media and never gates main progress', () => {
    const { registry } = loadIntroductionContent(), quest = optionalActivityDefinition(registry, 'spec001:SQ04')!;
    expect(optionalRewardAllocationMatches(quest, json('assets-src/manifest.json'))).toBe(true); expect(quest.optionalActivity.reward).not.toHaveProperty('assetId');
    const data = input(); data.world.objectives.find((o: any) => o.id === 'spec001:O05').prerequisite = { kind: 'quest-complete', questId: 'spec001:SQ04' }; expect(validateContent(data).ok).toBe(false);
  });
});
