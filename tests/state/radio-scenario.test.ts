// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/content/registry';
import type * as S from '../../src/content/schema-types.generated';
import { radioEffectBindings, createRadioScenarioResolver, prepareRadioAction } from '../../src/state/radio-scenario';
import { evaluateObjective, objectiveEffectBindings } from '../../src/state/objectives';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ReducerInput } from '../../src/state/reducer';
import type { ActionId, MeasurementId, QualifiedId } from '../../src/domain/types';
import { authoredInput, routeDocument, setup } from '../ui/inventory-fixture';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as MeasurementId;
const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')) as T;
const input = structuredClone(authoredInput);
const replaced = input.world.documents.filter(r => r.kind === 'profile' || r.kind === 'objective' || ['spec001:R07', 'spec001:R08'].includes(r.id) || r.path === 'content/spec001/dialogue/radio-actions.json');
input.world.documents = input.world.documents.filter(r => !replaced.includes(r));
for (const { path } of replaced) delete input.documents[path];
for (const path of ['content/spec001/profiles.json', 'content/spec001/objectives.json', 'content/spec001/dialogue/radio-actions.json', 'content/spec001/rooms/R07.json', 'content/spec001/rooms/R08.json']) {
  const value = await read<S.collection | S.room>(path);
  input.documents[path] = routeDocument(value);
  input.world.documents.push(...(value.kind === 'collection' ? value.records : [value]).map(r => ({ kind: r.kind, id: r.id, path })));
}
const validated = validateContent(input);
if (!validated.ok || !validated.registry) throw new Error(JSON.stringify(validated.issues));
const registry = validated.registry;
const resolver = createRadioScenarioResolver(registry);

function fixture() {
  const old = setup().store.getState();
  let state = createReducerState({ ...old.runtime, game: { ...old.runtime.game!, world: { ...old.runtime.game!.world,
    roomId: q<'room'>('R07'), position: { safePositionId: q<'safe-position'>('R07.entry') }, flags: {},
    completedObjectiveIds: ['O01', 'O02'].map(id => q<'objective'>(id)), inventory: [{ itemId: q<'item'>('ITEM-inspection-kit'), quantity: 1 }] },
    notebook: { ...old.runtime.game!.notebook, factIds: [], measurements: [] } } });
  const reduce = createReducer({ registry, bindings: [...radioEffectBindings(registry), ...objectiveEffectBindings(registry)], objectiveScenario: resolver });
  const game = () => state.runtime.game!;
  const send = (input: ReducerInput) => {
    const result = reduce(state, { actionId: crypto.randomUUID() as ActionId, adventureId: game().adventureId, expectedVersion: game().world, input });
    if (result.status !== 'rejected') state = result.state;
    return result;
  };
  const choose = (id: string) => send({ kind: 'apply', evaluation: prepareRadioAction(registry, game(), q(id)) });
  const move = (id: string) => send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'test-walk', observations: [], acceptedEffects: [] },
    destination: { roomId: q<'room'>(id), safePositionId: q<'safe-position'>(`${id}.entry`), activity: 'stable-exploration' } });
  const measure = (objective: string, id: number) => {
    const current = resolver(game(), q<'objective'>(objective)); if (!current) throw new Error('Missing scenario');
    return send({ kind: 'objective', operation: { kind: 'measure', objectiveId: q<'objective'>(objective), alternativeId: current.alternativeId, id: uuid(id) } });
  };
  const submit = (objective: string, id: number) => {
    const current = resolver(game(), q<'objective'>(objective)); if (!current) throw new Error('Missing scenario');
    const operation = { kind: 'submit' as const, objectiveId: q<'objective'>(objective), alternativeId: current.alternativeId, measurementId: uuid(id) };
    const verdict = evaluateObjective(registry, resolver, game(), operation.objectiveId, { actionId: 'inspect-verdict' as ActionId, expectedVersion: game().world,
      input: { kind: operation.kind, alternativeId: operation.alternativeId, measurementId: operation.measurementId } });
    send({ kind: 'objective', operation });
    return verdict;
  };
  return { game, state: () => state, replace: (next: typeof state) => { state = next; }, choose, send, move, measure, submit };
}
const readPreparation = (f: ReturnType<typeof fixture>) => { f.choose('ACTION-radio-read-path'); f.choose('ACTION-radio-read-settings'); };
function prepared(path = 'align-existing') { const f = fixture(); readPreparation(f); f.choose(`ACTION-radio-${path}`); f.choose('ACTION-radio-match-settings'); f.measure('O07', 1); expect(f.submit('O07', 1).status).toBe('correct'); f.move('R08'); f.choose('ACTION-radio-read-survey'); return f; }
const readings = (f: ReturnType<typeof fixture>, id: number) => f.game().notebook.measurements.find(m => m.id === uuid(id))!.readings;

describe('T080 actual radio actions with T074 controller and reducer', () => {
  it('starts with explicit failed path/settings and no invented measurement', () => {
    const f = fixture();
    expect(f.game().notebook.measurements).toEqual([]);
    expect(resolver(f.game(), q('O07'))).toEqual({ kind: 'radio-preparation', alternativeId: q('ACTION-O07-align-existing-path'), path: { viablePath: false, settingsCompatible: false } });
    readPreparation(f); f.measure('O07', 1);
    expect(f.submit('O07', 1)).toMatchObject({ status: 'incorrect', reasonCode: 'incompatible-radio-settings', acceptedEffects: [] });
    expect(f.game().world.completedObjectiveIds).toEqual(['O01', 'O02'].map(q));
  });
  it.each(['align-existing', 'alternate-path'])('accepts %s without copper/fiber/ally progress and without inventing SNR', path => {
    const f = prepared(path);
    expect(readings(f, 1)).toEqual([{ name: 'Viable path', value: 1, unit: 'count' }, { name: 'Compatible settings', value: 1, unit: 'count' }]);
    expect(f.game().world.completedObjectiveIds).toEqual(['O01', 'O02', 'O07'].map(q));
    expect(f.game().world.recruits).toEqual([]); expect(f.game().world.activeAllyIds).toEqual([]);
    expect(f.game().world.inventory).toEqual([{ itemId: q('ITEM-inspection-kit'), quantity: 1 }]);
  });
  it('matching settings alone cannot repair the unaligned path', () => {
    const f = fixture(); readPreparation(f); f.choose('ACTION-radio-match-settings'); f.measure('O07', 1);
    expect(f.submit('O07', 1)).toMatchObject({ status: 'incorrect', reasonCode: 'path-prerequisite-fails', acceptedEffects: [] });
  });
  it.each([['align-existing', 'channel-A', -90, 25], ['align-existing', 'channel-B', -85, 20], ['alternate-path', 'channel-A', -90, 25], ['alternate-path', 'channel-B', -85, 20]] as const)('measures and accepts %s / %s at the reviewed %i dBm noise / %i dB SNR', (path, channel, noise, snr) => {
    const f = prepared(path); f.choose(`ACTION-radio-${channel}`); f.choose('ACTION-radio-mitigate-emitter');
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O08')); expect(f.game().notebook.measurements).toHaveLength(1);
    f.measure('O08', 2);
    expect(readings(f, 2)).toEqual([{ name: 'Viable path', value: 1, unit: 'count' }, { name: 'Compatible settings', value: 1, unit: 'count' },
      { name: 'Received signal', value: -65, unit: 'dBm' }, { name: 'Received noise', value: noise, unit: 'dBm' },
      { name: 'Signal-to-noise ratio', value: snr, unit: 'dB' }, { name: 'Required signal-to-noise ratio', value: 20, unit: 'dB' }]);
    const verdict = f.submit('O08', 2); expect(verdict.status).toBe('correct');
    const check = evaluateObjective(registry, resolver, f.game(), q('O08'), { actionId: 'scope-check' as ActionId, expectedVersion: f.game().world, input: { kind: 'measure', alternativeId: resolver(f.game(), q('O08'))!.alternativeId, id: uuid(99) } });
    expect(check.observations).toEqual(expect.arrayContaining([expect.objectContaining({ throughputProven: false, wholeRouteProven: false })]));
    expect(f.game().world.completedObjectiveIds).toEqual(['O01', 'O02', 'O07', 'O08'].map(q));
    const before = f.game(); f.submit('O08', 2); expect(f.game()).toBe(before);
  });
  it('keeps13 dB before evidence stale after mitigation until an actual fresh test', () => {
    const f = prepared(); f.measure('O08', 2);
    expect(readings(f, 2)).toContainEqual({ name: 'Signal-to-noise ratio', value: 13, unit: 'dB' });
    expect(f.submit('O08', 2).reasonCode).toBe('snr-below-profile');
    const prior = structuredClone(f.game().notebook.measurements[1]!);
    f.choose('ACTION-radio-mitigate-emitter'); const after = f.game();
    expect(f.game().notebook.measurements).toHaveLength(2); expect(f.submit('O08', 2).reasonCode).toBe('stale-evidence'); expect(f.game()).toBe(after);
    expect(f.game().notebook.measurements[1]).toEqual({ ...prior, stale: true });
    f.measure('O08', 3); expect(f.submit('O08', 3).status).toBe('correct');
    expect(f.game().notebook.measurements[2]).toMatchObject({ roomId: q('R08'), ruleId: q('PHY07'), configurationRevision: after.world.configurationRevision, attemptId: after.world.attemptId, stale: false });
  });
  it('changing channel does not silently remove the emitter or generate a reading', () => {
    const f = prepared(); f.measure('O08', 2); f.choose('ACTION-radio-channel-B');
    expect(f.game().notebook.measurements).toHaveLength(2); expect(f.submit('O08', 2).reasonCode).toBe('stale-evidence');
    f.measure('O08', 3); expect(readings(f, 3)).toContainEqual({ name: 'Signal-to-noise ratio', value: 13, unit: 'dB' }); expect(f.submit('O08', 3).status).toBe('incorrect');
  });
  it('reintroduced interference invalidates a former pass even when signal strength stays unchanged', () => {
    const f = prepared(); f.choose('ACTION-radio-mitigate-emitter'); f.measure('O08', 2); f.choose('ACTION-radio-raise-noise');
    expect(f.submit('O08', 2).reasonCode).toBe('stale-evidence'); f.measure('O08', 3);
    expect(readings(f, 2)).toContainEqual({ name: 'Received signal', value: -65, unit: 'dBm' }); expect(readings(f, 3)).toContainEqual({ name: 'Received signal', value: -65, unit: 'dBm' });
    expect(f.submit('O08', 3).reasonCode).toBe('snr-below-profile');
  });
  it('the explicit supplied boundary exercise fails19.99 dB without rounding to20 or reviving previous proof', () => {
    const f = prepared(); f.choose('ACTION-radio-channel-B'); f.choose('ACTION-radio-mitigate-emitter'); f.measure('O08', 2);
    f.choose('ACTION-radio-boundary-exercise'); expect(f.submit('O08', 2).reasonCode).toBe('stale-evidence'); f.measure('O08', 3);
    expect(readings(f, 3)).toContainEqual({ name: 'Signal-to-noise ratio', value: 19.99, unit: 'dB' }); expect(f.submit('O08', 3).reasonCode).toBe('snr-below-profile');
    f.choose('ACTION-radio-mitigate-emitter'); expect(f.submit('O08', 2).reasonCode).toBe('stale-evidence'); f.measure('O08', 4); expect(f.submit('O08', 4).status).toBe('correct');
  });
  it.each([['unalign-path', 'path-prerequisite-fails'], ['mismatch-settings', 'incompatible-radio-settings']] as const)('a nominal25 dB profile cannot override %s', (action, reason) => {
    const f = prepared(); f.choose('ACTION-radio-mitigate-emitter'); f.measure('O08', 2); f.move('R07'); f.choose(`ACTION-radio-${action}`); f.move('R08');
    expect(f.submit('O08', 2).reasonCode).toBe('stale-evidence'); f.measure('O08', 3); expect(f.submit('O08', 3).reasonCode).toBe(reason);
    expect(readings(f, 3).some(r => r.name === 'Signal-to-noise ratio')).toBe(false);
  });
  it('keeps earned completion historical while changed conditions produce failed fresh evidence', () => {
    const f = prepared(); f.choose('ACTION-radio-mitigate-emitter'); f.measure('O08', 2); expect(f.submit('O08', 2).status).toBe('correct');
    f.choose('ACTION-radio-raise-noise'); f.measure('O08', 3);
    expect(f.game().notebook.measurements.find(m => m.id === uuid(2))?.stale).toBe(true);
    expect(f.game().notebook.measurements.find(m => m.id === uuid(3))).toMatchObject({ stale: false, conclusionCode: 'O08:ACTION-O08-scenario-channel-A:incorrect' });
    expect(readings(f, 3)).toContainEqual({ name: 'Signal-to-noise ratio', value: 13, unit: 'dB' });
    const before = f.game(); const replay = f.submit('O08', 2);
    expect(replay).toMatchObject({ status: 'correct', reasonCode: 'objective-already-complete', acceptedEffects: [], observations: [] });
    expect(f.game()).toBe(before); // Historical receipt is not a current validation or a new reward.
  });
  it('switching between both viable paths still requires fresh proof and returning never refreshes old readings', () => {
    const f = prepared(); f.choose('ACTION-radio-mitigate-emitter'); f.measure('O08', 2); f.move('R07'); f.choose('ACTION-radio-alternate-path'); f.move('R08');
    expect(f.submit('O08', 2).reasonCode).toBe('stale-evidence'); f.measure('O08', 3);
    expect(readings(f, 3)).toContainEqual({ name: 'Signal-to-noise ratio', value: 25, unit: 'dB' });
    f.move('R07'); f.choose('ACTION-radio-align-existing'); f.move('R08'); expect(f.submit('O08', 2).reasonCode).toBe('stale-evidence');
    expect(f.submit('O08', 3).reasonCode).toBe('stale-evidence'); f.measure('O08', 4); expect(f.submit('O08', 4).status).toBe('correct');
  });
  it('context records no signal/noise measurement and cannot submit an unmeasured objective', () => {
    const f = prepared(); f.choose('ACTION-radio-mitigate-emitter'); const count = f.game().notebook.measurements.length;
    f.choose('ACTION-radio-read-survey'); expect(f.game().notebook.measurements).toHaveLength(count); expect(f.game().notebook.factIds).not.toContain(q('FACT-O08-snr'));
    expect(f.submit('O08', 2).reasonCode).toBe('measurement-missing');
  });
  it('enforces the correct room, briefing, ordinary tool and O07 proof prerequisite', () => {
    const f = fixture(), game = f.game();
    expect(prepareRadioAction(registry, game, q('ACTION-radio-mitigate-emitter')).status).toBe('invalid-input');
    for (const change of [{ ...game.world, inventory: [] }, { ...game.world, completedObjectiveIds: [] }]) expect(prepareRadioAction(registry, { ...game, world: change }, q('ACTION-radio-align-existing')).status).toBe('invalid-input');
    expect(prepareRadioAction(registry, game, q('ACTION-radio-unreviewed')).status).toBe('invalid-input');
    f.move('R08'); expect(f.measure('O08', 1).status).toBe('no-op'); expect(f.submit('O08', 1).reasonCode).toBe('prerequisite-unmet'); expect(f.game().notebook.measurements).toEqual([]);
  });
  it.each(['path', 'settings', 'channel', 'conditions'])('rejects unknown %s without a passing fallback', key => {
    const f = fixture(); for (const value of ['unreviewed', true, 25]) expect(resolver({ ...f.game(), world: { ...f.game().world, flags: { [q(`FLAG-radio-${key}`)]: value } } }, q('O08'))).toBeNull();
    expect(resolver(f.game(), q('O06'))).toBeNull();
  });
  it.each(['path', 'settings', 'channel', 'conditions'])('rejects explicit null %s rather than selecting an arrival default', key => {
    const f = prepared(); f.choose('ACTION-radio-mitigate-emitter');
    // Deliberate malformed-state boundary: normal flags reject null at validation.
    const flags = { ...f.game().world.flags, [q(`FLAG-radio-${key}`)]: null } as unknown as ReturnType<typeof f.game>['world']['flags'];
    const malformed = { ...f.game(), world: { ...f.game().world, flags } };
    expect(resolver(malformed, q('O07'))).toBeNull(); expect(resolver(malformed, q('O08'))).toBeNull();
  });
  it('replaying context/choices neither duplicates facts nor changes revision or refreshes evidence', () => {
    const f = prepared(); f.choose('ACTION-radio-mitigate-emitter'); f.measure('O08', 2); const before = f.game();
    f.choose('ACTION-radio-read-survey'); f.choose('ACTION-radio-mitigate-emitter'); expect(f.game()).toBe(before);
    expect(radioEffectBindings(registry).every(b => b.mode === 'repeatable')).toBe(true);
  });
  it('hints are nonpunitive and returned scenarios cannot mutate future samples or game state', () => {
    const f = prepared(), before = f.game(); const scenario = resolver(f.game(), q('O08'));
    if (scenario?.kind === 'radio-proof') (scenario.path.noise as { value: number }).value = 999;
    expect(f.game()).toBe(before); expect(resolver(f.game(), q('O08'))).toMatchObject({ path: { noise: { value: -78, unit: 'dBm' } } });
    for (let n = 0; n < 3; n++) f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q('O08') } });
    expect(f.game().world).toEqual(before.world); expect(f.game().assistance.map(h => h.level)).toEqual([1, 2, 3]);
    f.choose('ACTION-radio-mitigate-emitter'); f.measure('O08', 2); expect(f.submit('O08', 2).status).toBe('correct');
  });
  it.each(['room', 'profile', 'attempt', 'readings'] as const)('rejects a measurement with changed %s provenance', field => {
    const f = prepared(); f.choose('ACTION-radio-mitigate-emitter'); f.measure('O08', 2); const state = f.state(), game = f.game();
    const measurements = game.notebook.measurements.map(m => m.id !== uuid(2) ? m : { ...m,
      ...(field === 'room' ? { roomId: q<'room'>('R07') } : field === 'profile' ? { subjectIds: [q('O08'), q('PROFILE-OPTICAL')] } : field === 'attempt' ? { attemptId: crypto.randomUUID() as typeof m.attemptId } : { readings: m.readings.map(r => r.name === 'Received noise' && r.unit === 'dBm' ? { ...r, value: -100 as typeof r.value } : r) }) });
    f.replace({ ...state, runtime: { ...state.runtime, game: { ...game, notebook: { ...game.notebook, measurements } } } });
    expect(f.submit('O08', 2).status).toBe('incorrect'); expect(f.game().world.completedObjectiveIds).not.toContain(q('O08'));
  });
  it.each(['unreviewed-value', 'direct-completion', 'measurement-fact', 'unguarded-node'] as const)('does not bind schema-valid %s authoring', corruption => {
    const candidate = structuredClone(input), collection = candidate.documents['content/spec001/dialogue/radio-actions.json'] as S.collection;
    const menu = collection.records.find(r => r.id === q('DIALOGUE-radio-skywell')) as S.dialogue;
    const choice = menu.nodes[0]!.choices.find(c => c.id === q('ACTION-radio-align-existing'))!, effectId = q('EFFECT-radio-align-existing');
    if (corruption === 'unreviewed-value') choice.effects = [{ kind: 'set-flag', effectId, flagId: q('FLAG-radio-path'), value: 'unreviewed' }];
    if (corruption === 'direct-completion') choice.effects = [{ kind: 'complete-objective', effectId, objectiveId: q('O07') }];
    if (corruption === 'measurement-fact') choice.effects = [{ kind: 'record-fact', effectId, factId: q('FACT-O08-snr') }];
    if (corruption === 'unguarded-node') menu.nodes[0]!.condition = { kind: 'always' };
    const result = validateContent(candidate); expect(result.ok, JSON.stringify(result.issues)).toBe(true); if (!result.ok || !result.registry) throw new Error('Missing registry');
    expect(radioEffectBindings(result.registry)).toEqual([]); expect(createRadioScenarioResolver(result.registry)(fixture().game(), q('O07'))).toBeNull();
    expect(prepareRadioAction(result.registry, fixture().game(), choice.id as QualifiedId)).toMatchObject({ status: 'content-error', acceptedEffects: [] });
  });
});
