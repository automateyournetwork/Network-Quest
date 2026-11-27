// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { Outcome, Route } from '../domain/types';
import type { GameState, OutcomeEvent } from '../state/types';

const titles = { E01: 'The Steady Light', E02: 'The Borrowed Dawn', E03: 'The Honest Shutdown' } as const;
const roster = {
  'spec001:CH03': 'Photon the Firefly', 'spec001:CH04': 'Copperhead Snake', 'spec001:CH05': 'Single-Mode Unicorn',
  'spec001:CH06': 'Multimode Hydra', 'spec001:CH07': 'Thunderbird', 'spec001:CH16': 'SFP Hermit Crab',
  'spec001:CH19': 'Electric Eel', 'spec001:CH20': 'Echo Bat', 'spec001:CH22': 'Chameleon',
} as const;
/** Closed reviewed story trigger, never a networking rule or inferred verdict. */
export const riftHazardContract = Object.freeze({
  id: 'spec001:HAZARD-rift-unstable-ledge', kind: 'fictional-story-danger', roomId: 'spec001:R11',
  safePositionId: 'spec001:R11.preparation', propIds: Object.freeze(['spec001:PR101', 'spec001:PR107']),
  availability: 'precommit-only', requiresExplicitConfirmation: true,
  choice: 'Cross the marked unstable inspection ledge',
  warning: 'DANGER: beyond the work-zone barrier, the unsupported inspection ledge can collapse into the excavation trench and kill the apprentice. Crossing is optional and never required for a repair. Stay on the safe platform to inspect the conduit. Your account save will remain unchanged.',
  acknowledgement: 'I understand that crossing the unstable ledge can kill the apprentice',
  safeAlternative: 'Stay on the safe inspection platform', terminalActivity: 'terminal-failure', preserveAccountSave: true,
} as const);
export type RiftHazardDescriptor = typeof riftHazardContract & {
  readonly title: string; readonly scene: readonly string[]; readonly cause: string;
};
interface Ending { readonly id: Outcome; readonly title: string; readonly summary: string; readonly scene: readonly string[]; readonly continuation: string }
export interface EndingsContent {
  readonly kind: 'endings'; readonly schemaVersion: 1; readonly episodeId: 'spec001'; readonly contentVersion: '1.0.0'; readonly license: 'CC-BY-4.0';
  readonly endings: readonly Ending[];
  readonly routes: Readonly<Record<Route | 'none', string>>;
  readonly noAllies: string;
  readonly recruits: readonly { readonly id: keyof typeof roster; readonly name: string; readonly recruited: string; readonly active: string }[];
  readonly sideQuests: readonly { readonly id: string; readonly text: string }[];
  readonly noSideQuests: string;
  readonly maintenance: { readonly recorded: string };
  readonly controls: Readonly<Record<'skip' | 'replay' | 'continue' | 'retry' | 'restore' | 'signIn', string>>;
  readonly recovery: Readonly<Record<'retry' | 'restore' | 'guest' | 'save', string>>;
  readonly hazard: RiftHazardDescriptor;
}
export interface EpilogueView {
  readonly kind: 'ending'; readonly eventId: string; readonly outcome: Outcome; readonly route: Route | null;
  readonly title: string; readonly summary: string; readonly scene: readonly string[]; readonly paragraphs: readonly string[];
  readonly continuation: string; readonly caveatIds: readonly string[];
}
export interface FailureView {
  readonly kind: 'failure'; readonly hazardId: string; readonly outcome: null; readonly title: string;
  readonly scene: readonly string[]; readonly cause: string; readonly recovery: string; readonly saveNotice: string;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}
function record(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x) && [Object.prototype, null].includes(Object.getPrototypeOf(x));
}
function exact(x: unknown, keys: readonly string[]): x is Record<string, unknown> {
  return record(x) && Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
}
const text = (x: unknown): x is string => typeof x === 'string' && !!x.trim() && x.length <= 2000;
const lines = (x: unknown): x is string[] => Array.isArray(x) && x.length > 0 && x.length <= 4 && x.every(text);
const prose = (x: unknown, keys: readonly string[]) => exact(x, keys) && keys.every(k => text(x[k]));
/** Separate authored document until the ordered application/content join. */
export function validateEndingsContent(input: unknown): { ok: true; value: EndingsContent } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  try {
    // JSON data only: bound first, reject cycles/accessors before reading fields.
    const pending: [unknown, number][] = [[input, 0]], seen = new Set<object>();
    let count = 0;
    while (pending.length) {
      const [value, depth] = pending.pop()!;
      if (++count > 500 || depth > 8) return { ok: false, issues: ['Document exceeds bounds.'] };
      if (value && typeof value === 'object') {
        if (seen.has(value) || (!Array.isArray(value) && !record(value))) return { ok: false, issues: ['Expected plain JSON data.'] };
        seen.add(value);
        for (const d of Object.values(Object.getOwnPropertyDescriptors(value))) {
          if (!('value' in d)) return { ok: false, issues: ['Accessors are not content.'] };
          pending.push([d.value, depth + 1]);
        }
      } else if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return { ok: false, issues: ['Expected JSON value.'] };
    }
    if (!exact(input, ['kind', 'schemaVersion', 'episodeId', 'contentVersion', 'license', 'endings', 'routes', 'noAllies', 'recruits', 'sideQuests', 'noSideQuests', 'maintenance', 'controls', 'recovery', 'hazard'])) return { ok: false, issues: ['Invalid endings document fields.'] };
    if (input['kind'] !== 'endings' || input['schemaVersion'] !== 1 || input['episodeId'] !== 'spec001' || input['contentVersion'] !== '1.0.0' || input['license'] !== 'CC-BY-4.0') issues.push('Invalid document identity/version/license.');
    const endings = input['endings'];
    if (!Array.isArray(endings) || endings.length !== 3 || !endings.every((e, i) => exact(e, ['id', 'title', 'summary', 'scene', 'continuation'])
      && e['id'] === ['E01', 'E02', 'E03'][i] && e['title'] === Object.values(titles)[i]
      && text(e['summary']) && lines(e['scene']) && text(e['continuation']))) issues.push('Invalid ending identities or prose.');
    if (!prose(input['routes'], ['copper', 'fiber', 'radio', 'none'])) issues.push('Invalid route coverage.');
    if (!text(input['noAllies']) || !text(input['noSideQuests'])) issues.push('Missing no-ally or no-quest prose.');
    const recruits = input['recruits'];
    if (!Array.isArray(recruits) || recruits.length !== 9 || !recruits.every((r, i) => exact(r, ['id', 'name', 'recruited', 'active'])
      && r['id'] === Object.keys(roster)[i] && r['name'] === Object.values(roster)[i] && text(r['recruited']) && text(r['active']))) issues.push('Invalid exact recruit roster.');
    const quests = input['sideQuests'];
    if (!Array.isArray(quests) || quests.length !== 4 || !quests.every((q, i) => exact(q, ['id', 'text'])
      && q['id'] === `spec001:SQ0${i + 1}` && text(q['text']))) issues.push('Invalid side-quest coverage.');
    if (!prose(input['maintenance'], ['recorded'])) issues.push('Invalid maintenance prose.');
    if (!prose(input['recovery'], ['retry', 'restore', 'guest', 'save'])) issues.push('Invalid recovery prose.');
    const controls = input['controls'];
    if (!prose(controls, ['skip', 'replay', 'continue', 'retry', 'restore', 'signIn']) || !record(controls)
      || controls['retry'] !== 'Retry from Encounter Preparation' || controls['restore'] !== 'Restore Save') issues.push('Invalid recovery controls.');
    const hazard = input['hazard'];
    if (!exact(hazard, [...Object.keys(riftHazardContract), 'title', 'scene', 'cause']) || !text(hazard['title']) || !lines(hazard['scene']) || !text(hazard['cause'])
      || !Object.entries(riftHazardContract).every(([k, v]) => JSON.stringify(hazard[k]) === JSON.stringify(v))) issues.push('Invalid reviewed hazard descriptor.');
    return issues.length ? { ok: false, issues } : { ok: true, value: freeze(structuredClone(input)) as unknown as EndingsContent };
  } catch { return { ok: false, issues: ['Malformed endings document.'] }; }
}

/**
 * Presentation of a trusted accepted history member, NEVER classification.
 * The integration owns outcome admission and caveat feedback. Current world
 * facts can personalize only the latest same-attempt event; an older event's
 * route cannot borrow newly earned party/quest facts. Replay reuses this view.
 * Typed future recruit cases are not evidence that recruitment is implemented.
 */
export function projectEpilogue(content: EndingsContent, game: GameState, accepted: OutcomeEvent): EpilogueView | null {
  if (String(game.contentVersion) !== content.contentVersion || game.outcomeHistory.at(-1) !== accepted
    || accepted.attemptId !== game.world.attemptId || accepted.route !== game.world.route
    || !game.world.completedObjectiveIds.includes('spec001:O12' as never)
    || (!accepted.route && accepted.outcome !== 'E03')) return null;
  const ending = content.endings.find(e => e.id === accepted.outcome); if (!ending) return null;
  if (game.world.recruits.some(r => !Object.hasOwn(roster, r.characterId))) return null;
  const paragraphs: string[] = [content.routes[accepted.route ?? 'none']];
  const recruits = content.recruits.filter(r => game.world.recruits.some(earned => String(earned.characterId) === r.id));
  paragraphs.push(...(recruits.length ? recruits.map(r => game.world.activeAllyIds.some(id => String(id) === r.id) ? r.active : r.recruited) : [content.noAllies]));
  const quests = content.sideQuests.filter(q => game.world.completedQuestIds.some(id => id === q.id));
  paragraphs.push(...(quests.length ? quests.map(q => q.text) : [content.noSideQuests]));
  if (game.notebook.factIds.some(id => String(id) === 'spec001:FACT-repair-maintenance')) paragraphs.push(content.maintenance.recorded);
  return freeze({ kind: 'ending', eventId: accepted.id, outcome: accepted.outcome, route: accepted.route,
    title: ending.title, summary: ending.summary, scene: [...ending.scene], paragraphs,
    continuation: ending.continuation, caveatIds: [...accepted.caveatIds] });
}
/** Called only after the trusted hazard transition. This function causes none. */
export function projectFailure(content: EndingsContent, hazardId: string): FailureView | null {
  if (hazardId !== content.hazard.id) return null;
  return freeze({ kind: 'failure', hazardId, outcome: null, title: content.hazard.title, scene: [...content.hazard.scene],
    cause: content.hazard.cause, recovery: content.recovery.retry, saveNotice: content.recovery.save });
}
