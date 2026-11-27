// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** T092 audits authored expectations only. No party/activity/domain/UI code runs.
 * Runtime TODOs must later call actual handlers in separately prepared sessions.
 * A fixture equality assertion or an expected-return mock cannot execute them.
 */
type Value = Record<string, unknown>;
interface OracleCase {
  id: string; kind: string; subject: string; requirements: string[];
  sourceCaseIds: string[]; inputs: Value; expected: Value;
  independentReasoning: string; execution: { status: 'todo'; tasks: string[] };
}
interface BaseFixture {
  fixtureVersion: number; task: string; scope: string; inputConvention: string;
  frozenArtifacts: Record<string, string>; authorities: string[]; inputGaps: string[];
  limitations: string[]; cases: OracleCase[];
}
interface Vector {
  sourceCaseId: string; category: string; expected: Value; reason: string;
}
interface Recruit {
  characterId: string; name: string; roomIds: string[]; vectorGroup: string;
  ruleIds: string[]; sourceIds: string[]; abilityExpectation: string;
  conventionalToolExpectation: string; demonstratedInteraction: string;
  progressionExpectation: string; limitations: string[]; authoredBinding: string;
}
interface Activity {
  activityId: string; name: string; roomIds: string[]; prerequisiteObjectives: string[];
  reward: string; rewardRequiredForMainStory: boolean; ruleIds: string[];
  sourceCaseIds: string[]; teaching: string; limitations: string[];
  implementationTask: string;
}
interface PhysicalCase { id: string; inputs: Value; expected: Value }
interface Rule {
  id: string; sources: string[]; correctCases: string[]; incorrectCases: string[];
  boundaryCases: string[];
}
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const companions = JSON.parse(read('tests/fixtures/companions.json')) as BaseFixture & {
  recruits: Recruit[]; technicalVectors: Record<string, Vector[]>; partyContract: Value;
};
const activities = JSON.parse(read('tests/fixtures/optional-activities.json')) as BaseFixture & {
  activities: Activity[]; lifecycleContract: Value;
};
const physical = JSON.parse(read('tests/fixtures/physical-cases.json')) as {
  referenceCases: PhysicalCase[]; reviewCases: PhysicalCase[];
};
const sources = JSON.parse(read('content/spec001/sources.json')) as {
  rules: Rule[]; sources: { id: string; section: string; supportedClaim: string }[];
};
const world = JSON.parse(read('content/spec001/world.json')) as {
  characters: { id: string; name: string; recruitable: boolean; roomIds: string[] }[];
  optionalActivities: { id: string; roomIds: string[]; requiredForMainStory: boolean;
    timingDefault: string; skippable: boolean; prerequisite: Value }[];
};
const physicalById = new Map([...physical.referenceCases, ...physical.reviewCases].map(c => [c.id, c]));
const allCases = [...companions.cases, ...activities.cases];
const byId = new Map(allCases.map(c => [c.id, c]));
const recruitIds = ['CH03', 'CH04', 'CH05', 'CH06', 'CH07', 'CH16', 'CH19', 'CH20', 'CH22'].map(id => `spec001:${id}`);
const activityIds = ['SQ01', 'SQ02', 'SQ03', 'SQ04', 'MG01', 'MG02', 'MG03'].map(id => `spec001:${id}`);
function entry(id: string): OracleCase {
  const result = byId.get(id);
  if (!result) throw new Error(`Missing independent expectation ${id}`);
  return result;
}
function object(value: unknown): Value {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as Value;
}

describe('T092 frozen oracle inputs — no application execution', () => {
  it('pins the pre-existing independent physical oracles and shared authority', () => {
    expect(companions.frozenArtifacts).toEqual(activities.frozenArtifacts);
    expect(companions.frozenArtifacts['content/spec001/sources.json']).toBe('a46ec103c9ec5e5103fd85543d2c9965b22e4204b98d40df2629303917527116');
    expect(companions.frozenArtifacts['tests/fixtures/physical-cases.json']).toBe('de255ec172b43d25fe6bcee84559f974f9ffb1f62d69d69bca16cab50a2697d1');
    expect(companions.frozenArtifacts['tests/fixtures/repair-routes.json']).toBe('ed3a083828188a34fd6f5f345cbd4c69fe8ebb140ea903dbafd9b3f464639877');
    expect(Object.keys(companions.frozenArtifacts)).toHaveLength(11);
    expect(physicalById.size).toBe(83);
  });
  it.each(Object.entries(companions.frozenArtifacts))('%s retains its sealed bytes', (path, hash) => {
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // T093 extends only character authoring. Preserve the exact T092 schema
    // used to author these independent expectations; never refresh its hash.
    // The dedicated characters suite validates the additive live schema and
    // production roster. All ten other frozen inputs still check current bytes.
    const authoringInput = path === 'content/schemas/content.schema.json'
      ? 'docs/evidence/spec001/characters/content-schema-before-T093.json' : path;
    expect(createHash('sha256').update(read(authoringInput)).digest('hex')).toBe(hash);
  });
  it.each([companions, activities])('keeps authoring checks separate from runtime claims', fixture => {
    expect(fixture.fixtureVersion).toBe(1);
    expect(fixture.task).toBe('T092');
    expect(fixture.scope).toContain('no application execution');
    expect(fixture.inputConvention).toContain('not a production API');
    expect(fixture.inputGaps).toHaveLength(4);
    expect(fixture.limitations.join(' ')).toContain('No new scored networking rule');
    for (const path of fixture.authorities) expect(read(path).length).toBeGreaterThan(0);
    for (const c of fixture.cases) {
      expect(c.id).toMatch(/^(COMP|OPT)-[A-Z0-9-]+$/);
      expect(c.requirements.length).toBeGreaterThan(0);
      for (const requirement of c.requirements) expect(requirement).toMatch(/^(FR-\d{3}|AC\d{2})$/);
      for (const ref of c.sourceCaseIds) expect(physicalById.has(ref), `${c.id}: ${ref}`).toBe(true);
      expect(Object.keys(c.inputs).length).toBeGreaterThan(0);
      expect(Object.keys(c.expected).length).toBeGreaterThan(0);
      expect(c.independentReasoning.length).toBeGreaterThan(60);
      expect(c.execution).toMatchObject({ status: 'todo' });
      expect(c.execution.tasks.length).toBeGreaterThan(0);
      for (const task of c.execution.tasks) expect(task).toMatch(/^T(09[3-9]|10[0-4])$/);
    }
  });
  it('has unique pending cases with no invented runtime acceptance', () => {
    expect(companions.cases).toHaveLength(53);
    expect(activities.cases).toHaveLength(87);
    expect(byId.size).toBe(140);
    expect(companions.cases.filter(c => c.kind === 'ability-equivalence')).toHaveLength(9);
    expect(activities.cases.filter(c => c.kind === 'lifecycle')).toHaveLength(56);
  });
  it('uses only rules with existing source/correct/incorrect/boundary review', () => {
    const ruleIds = new Set([...companions.recruits, ...activities.activities].flatMap(c => c.ruleIds));
    for (const id of ruleIds) {
      const rule = sources.rules.find(r => r.id === id);
      expect(rule, id).toBeDefined();
      if (!rule) throw new Error(`Unreviewed rule ${id}`);
      for (const cases of [rule.correctCases, rule.incorrectCases, rule.boundaryCases]) {
        expect(cases.length, id).toBeGreaterThan(0);
        for (const caseId of cases) expect(physicalById.has(caseId), caseId).toBe(true);
      }
      // Freshness is a game-state invariant, not a networking-standard claim.
      if (id.startsWith('PHY')) expect(rule.sources.length).toBeGreaterThan(0);
      for (const sourceId of rule.sources) {
        const source = sources.sources.find(s => s.id === sourceId);
        expect(source?.section.length).toBeGreaterThan(0);
        expect(source?.supportedClaim.length).toBeGreaterThan(0);
      }
    }
  });
  it.each(Object.entries(companions.technicalVectors))('%s retains the independently reviewed physical literals', (_group, vectors) => {
    expect(vectors.map(v => v.category)).toEqual(['correct', 'incorrect', 'boundary']);
    for (const vector of vectors) {
      expect(vector.expected).toEqual(physicalById.get(vector.sourceCaseId)?.expected);
      expect(vector.reason.length).toBeGreaterThan(60);
    }
  });
});

describe('T092 companion authoring contract — fixture checks only', () => {
  it('preserves exactly nine recruits and sixteen other characters', () => {
    expect(companions.recruits.map(c => c.characterId)).toEqual(recruitIds);
    expect(companions.partyContract).toMatchObject({ maximumActive: 2, freeSwapAtSafePreparation: true,
      activeSubsetOfRecruited: true, conventionalToolsRequiredForAllMainRoutes: true, allCharactersCount: 25 });
    expect(world.characters.filter(c => c.recruitable).map(c => c.id)).toEqual(recruitIds);
    expect(world.characters.filter(c => !c.recruitable).map(c => c.id)).toEqual(companions.partyContract['nonRecruitIds']);
    expect(companions.partyContract['compendiumFields']).toEqual(['identity', 'technology', 'ability', 'limitation',
      'realmNote', 'recruitment', 'progression', 'evidenceSources', 'portrait']);
  });
  it.each(companions.recruits)('$characterId has demonstrated recruitment, meaningful progression and tool parity', recruit => {
    const id = recruit.characterId.slice('spec001:'.length);
    const allocation = world.characters.find(c => c.id === recruit.characterId);
    expect(allocation).toMatchObject({ name: recruit.name, roomIds: recruit.roomIds, recruitable: true });
    expect(recruit.abilityExpectation.length).toBeGreaterThan(10);
    expect(recruit.conventionalToolExpectation.length).toBeGreaterThan(10);
    expect(recruit.limitations.length).toBeGreaterThanOrEqual(2);
    expect(recruit.authoredBinding).toContain('pending T093');
    for (const ruleId of recruit.ruleIds) {
      const sourceIds = sources.rules.find(r => r.id === ruleId)?.sources ?? [];
      for (const sourceId of sourceIds) expect(recruit.sourceIds).toContain(sourceId);
    }
    expect(entry(`COMP-${id}-DISCOVERY`).expected).toMatchObject({ recruited: false, progressionAwarded: false });
    expect(entry(`COMP-${id}-RECRUIT`).inputs['demonstratedInteraction']).toBe(recruit.demonstratedInteraction);
    expect(entry(`COMP-${id}-RECRUIT`).expected).toMatchObject({ recruitedIds: [recruit.characterId], recruitCount: 1, duplicateRecruitAwards: 0 });
    expect(entry(`COMP-${id}-PROGRESS`).expected).toMatchObject({ requiredExplanation: recruit.progressionExpectation,
      meaningfulNewInspectionOrExplanation: true, samePhysicalRules: true, inventedCapability: false, duplicateUnlocks: 0 });
    const equivalent = entry(`COMP-${id}-EQUIVALENCE`);
    expect(equivalent.inputs['scenarioVectorGroup']).toBe(recruit.vectorGroup);
    expect(equivalent.inputs['toolRun']).toEqual({ recruited: [], active: [], tool: recruit.conventionalToolExpectation });
    expect(equivalent.expected).toMatchObject({ bothRunsMatchEveryVector: true, samePhysicalObservations: true,
      sameAcceptedPhysicalEffects: true, sameObjectiveEligibility: true, wholeRouteProvenByAbilityAlone: false });
  });
  it('protects party capacity, membership, free swaps and preparation reachability', () => {
    expect(entry('COMP-PARTY-ZERO').expected).toMatchObject({ partyValid: true });
    expect(entry('COMP-PARTY-TWO').expected).toEqual({ active: ['CH03', 'CH04'], accepted: true });
    expect(entry('COMP-PARTY-THREE').expected).toEqual({ active: ['CH03', 'CH04'], accepted: false, silentEviction: false });
    expect(entry('COMP-PARTY-UNRECRUITED').expected['accepted']).toBe(false);
    expect(entry('COMP-PARTY-DUPLICATE').expected).toMatchObject({ accepted: false, doubleAbility: false });
    expect(entry('COMP-PARTY-FREE-SWAP').expected).toEqual({ active: ['CH04', 'CH19'], cost: 0, requiredToolQuantity: 1, saveWritesCausedBySwap: 0 });
    expect(entry('COMP-PARTY-MISSING-ALLY').expected).toEqual({ returnToPreparationReachable: true, ordinaryToolAccepted: true, recruitmentRequired: false });
    expect(entry('COMP-PARTY-UNSAFE-SWAP').expected['accepted']).toBe(false);
  });
  it('keeps source limitations, stale observations and once-only effects', () => {
    expect(entry('COMP-PARTY-ECHO-UNREVIEWED-TOPOLOGY').expected).toEqual({ status: 'content-error', attemptPenalty: 0, progressAward: 0 });
    expect(entry('COMP-PARTY-STALE').expected).toEqual({ measurementUsable: false, visibleAsStale: true, objectiveAward: 0 });
    expect(entry('COMP-PARTY-REPLAY').expected).toEqual({ acceptedEffectsApplied: 1, rewardQuantityAfter: 1, duplicateObjectiveAwards: 0 });
    expect(entry('COMP-PARTY-INTERRUPT').expected).toEqual({ progressAward: 0, inventoryConsumed: 0, lateAnimationMayAward: false });
    for (const id of ['CH05', 'CH06']) expect(companions.recruits.find(c => c.characterId === `spec001:${id}`)?.limitations.join(' ')).toContain('payload lane');
  });
  it.each(['copper', 'fiber', 'radio'])('%s is independently finishable with ordinary tools and no optional rewards', route => {
    const c = entry(`COMP-NO-RECRUITS-${route.toUpperCase()}`);
    expect(c.inputs).toMatchObject({ recruited: [], active: [], optionalActivitiesCompleted: [], optionalRewards: [] });
    expect(c.expected).toEqual({ O11AndO12RemainReachable: true, equivalentToolsObtainable: true, unvisitedBranchRequired: false });
  });
});

describe('T092 optional activity authoring contract — fixture checks only', () => {
  it('preserves all seven allocations and the independent untimed lifecycle', () => {
    expect(activities.activities.map(a => a.activityId)).toEqual(activityIds);
    expect(activities.lifecycleContract).toEqual({ separatePreparedSessionPerCase: true, noOtherOptionalCompletionRequired: true,
      defaultTiming: 'off', timedChallengeRequiresCompletedUntimedMode: true, timedChallengeRequiresExplicitOptIn: true,
      scoreRequiredForMainLesson: false, requiredItemsConsumedOnSkipOrExit: false, safeReturnAfterExit: true, implicitSaveOnRetryOrExit: false,
      timingCapabilityRequired: false, omittingTimedModeIsValid: true });
  });
  it.each(activities.activities)('$activityId independently starts, practices, finishes, retries, exits, skips and replays', activity => {
    const id = activity.activityId.slice('spec001:'.length);
    const allocation = world.optionalActivities.find(a => a.id === activity.activityId);
    expect(allocation).toMatchObject({ roomIds: activity.roomIds, requiredForMainStory: false, timingDefault: 'off', skippable: true });
    expect(activity.rewardRequiredForMainStory).toBe(false);
    expect(allocation?.prerequisite).toEqual(activity.prerequisiteObjectives.length
      ? { kind: 'objective-complete', objectiveId: activity.prerequisiteObjectives[0] } : { kind: 'always' });
    for (const stage of ['START', 'PRACTICE', 'FINISH', 'RETRY', 'EXIT', 'SKIP', 'REPLAY', 'UNTIMED']) {
      const c = entry(`OPT-${id}-${stage}`);
      expect(c.subject).toBe(activity.activityId);
      expect(c.inputs).toMatchObject({ otherOptionalActivitiesCompleted: [], recruited: [], timingEnabled: false, score: null,
        requiredInventory: { 'route-tool': 1 } });
    }
    expect(entry(`OPT-${id}-START`).expected).toMatchObject({ instructionsVisible: true, practiceAvailable: true, exitAvailable: true, timerRunning: false });
    expect(entry(`OPT-${id}-PRACTICE`).expected).toMatchObject({ explanationAvailable: true, assistanceRecorded: true, unassistedClaim: false });
    expect(entry(`OPT-${id}-FINISH`).expected).toMatchObject({ optionalBenefit: activity.reward, benefitGrantCount: 1, mainObjectiveAward: 0 });
    expect(entry(`OPT-${id}-RETRY`).expected).toMatchObject({ clueRetained: true, personalNotes: 'Keep this observation', hintHistory: [1],
      requiredInventory: { 'route-tool': 1 }, unearnedBenefitGrantCount: 0, saveWritesCausedByRetry: 0,
      priorMeasurementVisibleAsStale: true, priorMeasurementUsableAsCurrent: false, freshAttemptRequired: true,
      configurationRevisionGreaterThan: 8 });
    expect(entry(`OPT-${id}-EXIT`).inputs['exitFromUnfinishedPhases']).toEqual(['instructions', 'practice', 'solving', 'feedback']);
    expect(entry(`OPT-${id}-EXIT`).expected['sameSafetyForEveryListedPhase']).toBe(true);
    for (const stage of ['EXIT', 'SKIP']) expect(entry(`OPT-${id}-${stage}`).expected).toMatchObject({ requiredInventory: { 'route-tool': 1 }, requiredRouteReachable: true });
    expect(entry(`OPT-${id}-REPLAY`).expected['benefitGrantCountAfter']).toBe(1);
    expect(entry(`OPT-${id}-UNTIMED`).expected).toEqual({ timerRunning: false, failureFromDelay: false, completionStillAvailable: true, mainScoreRequirement: null });
  });
  it('records the concrete toy sequence and rejects reordered answers without a timing score', () => {
    for (const id of ['SQ01', 'MG01']) {
      expect(entry(`OPT-${id}-DECODE`).expected).toMatchObject({ bits: '00101101', representedBits: 8, symbolCount: 4, mainObjectiveAward: 0 });
      expect(entry(`OPT-${id}-WRONG-ORDER`).expected).toMatchObject({ status: 'incorrect', expectedBits: '00101101', retryAvailable: true, completionAward: 0 });
      expect(entry(`OPT-${id}-ONE-SYMBOL`).expected).toMatchObject({ status: 'correct', bits: '11', representedBits: 2, fullActivityCompletionInferred: false });
    }
    expect(entry('OPT-MG01-NO-O10-SCORE').expected).toEqual({ O10CompletionEligible: true, MG01CompletionRequired: false, scoreRequired: false });
  });
  it('distinguishes correctly diagnosing a failed power plan from an incorrect learner response', () => {
    const c = entry('OPT-SQ02-DIAGNOSE');
    expect(c.inputs['deliveredDemands']).toEqual([12, 11, 10]);
    expect(c.expected).toMatchObject({ planStatus: 'incorrect', learnerStatus: 'correct', total: { value: 12 + 11 + 10, unit: 'W' },
      excess: { value: 12 + 11 + 10 - 30, unit: 'W' }, dataLinkProven: false });
    expect(entry('OPT-SQ02-WRONG-DIAGNOSIS').expected).toMatchObject({ learnerStatus: 'incorrect', completionAward: 0, retryAvailable: true });
    expect(entry('OPT-SQ02-POWER-BOUNDARIES').expected['cases']).toEqual([
      { caseId: 'C-POWER', planStatus: 'correct', totalW: 23, headroomW: 7 },
      { caseId: 'B-POWER-30', planStatus: 'correct', totalW: 30, headroomW: 0 },
    ]);
  });
  it('preserves historical samples without reviving stale readings or inferring weather causation', () => {
    for (const id of ['SQ03', 'MG03']) {
      expect(entry(`OPT-${id}-COMPARE`).expected).toMatchObject({ learnerStatus: 'correct', historicalSnrDb: -65 - (-90),
        currentSnrDb: -65 - (-78), snrChangeDb: -12, oldSampleVisible: true, oldSampleUsableAsCurrent: false,
        currentLinkPass: false, weatherCausationProven: false });
      expect(entry(`OPT-${id}-BOUNDARY`).expected).toEqual({ snrDb: 20, scenarioThresholdMet: true, throughputGuaranteed: false });
      expect(entry(`OPT-${id}-STALE-PREDICTION`).expected).toMatchObject({ comparisonCompletionEligible: false,
        oldSampleUsableAsCurrent: false, requestFreshMeasurement: true });
    }
  });
  it('requires three distinct observed clue sources without converting notes into observations', () => {
    expect(entry('OPT-SQ04-COMBINE').expected).toEqual({ activityCompletionEligible: true, sourceRoomsPreserved: ['R03', 'R05', 'R09'], epilogueMaintenancePersonalization: true, requiredObjectiveAward: 0 });
    expect(entry('OPT-SQ04-NOTE-NOT-CLUE').expected).toMatchObject({ activityCompletionEligible: false, missingObservedSourceRoom: 'R05', noteRetainedAsNote: true, mainRouteStillReachable: true });
    expect(entry('OPT-SQ04-DUPLICATE-ROOM').expected).toMatchObject({ activityCompletionEligible: false, duplicateObservationFillsMissingRoom: false });
  });
  it('independently checks optical subtraction and the inclusive margin boundary', () => {
    const budgets = entry('OPT-MG02-BUDGETS').expected['cases'] as Value[];
    for (const [index, loss] of [8, 10, 9].entries()) {
      const row = budgets[index];
      expect(row?.['receiveDbm']).toBe(-3 - loss);
      expect(row?.['marginDb']).toBe(-3 - loss - (-14));
    }
    expect(budgets.map(row => row['status'])).toEqual(['correct', 'incorrect', 'correct']);
    expect(entry('OPT-MG02-INCOMPATIBLE').expected).toEqual({ status: 'incorrect', usableLink: false, completionFromArithmeticAlone: false });
  });
  it('does not reverse optional unlock prerequisites or require a score', () => {
    for (const [id, objective] of [['MG02', 'O06'], ['MG03', 'O08']]) {
      expect(entry(`OPT-${id}-LOCKED-BEFORE-OBJECTIVE`).expected).toEqual({ activityMayStart: false,
        requiredObjective: objective, mainObjectiveMayCompleteWithoutActivity: true, explainOptionalUnlock: true });
    }
    for (const id of ['MG01', 'MG02', 'MG03']) {
      for (const suffix of ['GUARD', 'OPT-IN']) {
        const c = entry(`OPT-${id}-TIMING-${suffix}`);
        expect(c.inputs['authoredTimingCapabilityOffered']).toBe(true);
        expect(c.inputs['conditionalScenario']).toContain('omitting that mode is valid');
      }
      expect(entry(`OPT-${id}-TIMING-GUARD`).expected).toEqual({ timingEnabled: false, untimedModeAvailable: true, mainScoreRequirement: null });
      expect(entry(`OPT-${id}-TIMING-OPT-IN`).expected).toEqual({ timedModeWasOptional: true, untimedModeStillAvailable: true, requiredInventoryUnchanged: true, mainProgressUnchanged: true });
    }
  });
  it('keeps malformed content and missing learner input distinct from wrong answers', () => {
    expect(entry('OPT-MALFORMED-SYMBOLS').expected).toEqual({ status: 'content-error', attemptPenalty: 0, completionAward: 0, exitAvailable: true });
    expect(entry('OPT-EMPTY-ANSWER').expected).toEqual({ status: 'invalid-input', attemptPenalty: 0, completionAward: 0, retryAvailable: true });
    // None of the prepared activity records silently adds another activity as a prerequisite.
    for (const activity of activities.activities) for (const id of activity.prerequisiteObjectives) expect(id).toMatch(/^spec001:O\d{2}$/);
    expect(object(entry('OPT-MG01-EXIT').expected['requiredInventory'])['route-tool']).toBe(1);
  });
});

describe('T092 runtime obligations — pending actual T093–T104 handlers and browser adapters', () => {
  for (const c of allCases) it.todo(`${c.id}: ${c.execution.tasks.join('/')} — ${c.kind}`);
});
