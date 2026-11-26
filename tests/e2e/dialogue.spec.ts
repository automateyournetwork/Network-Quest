// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { expect, firefox, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { localTls } from './support/local-tls';
import type * as S from '../../src/content/schema-types.generated';
import type { ActionResult } from '../../src/ui/action-bus';
import type { ReducerState } from '../../src/state/reducer';
import type { RuntimeState, SaveSnapshotV1 } from '../../src/state/types';

declare global { interface Window { dialogueFixture: {
  state(): ReducerState; results: ActionResult[]; refresh(): void; invalidate(): void; workshop(): void; literal(): void;
} } }
const read = async (path: string) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')) as unknown;
const world = await read('content/spec001/world.json') as S.world;
const input = { world, sources: await read('content/spec001/sources.json'), documents: Object.fromEntries(await Promise.all([...new Set(world.documents.map(d => d.path))].map(async path => [path, await read(path)]))) };
const snapshot = await read('specs/001-physical-layer-underworld/contracts/examples/save-v1.json') as SaveSnapshotV1;

test.describe('T026 actual dialogue modules with authored content over trusted HTTPS', () => {
  test.describe.configure({ mode: 'default' });
  let local: Awaited<ReturnType<typeof localTls>>, context: BrowserContext, page: Page;
  test.beforeAll(async () => {
    local = await localTls();
    try { context = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false, hasTouch: true }); }
    catch (error) { await local.stop(); throw error; }
  });
  test.afterAll(async () => { try { await context?.close(); } finally { await local?.stop(); } });
  test.beforeEach(async () => {
    page = await context.newPage(); expect([200, 304]).toContain((await page.goto(local.url))?.status());
    await page.evaluate(async ({ base, input, snapshot }) => {
      const { validateContent } = await import(`${base}src/content/registry.ts`) as typeof import('../../src/content/registry');
      const { createReducer, createReducerState } = await import(`${base}src/state/reducer.ts`) as typeof import('../../src/state/reducer');
      const { introductionDialogueEffectBindings } = await import(`${base}src/state/dialogue.ts`) as typeof import('../../src/state/dialogue');
      const { createActionBus, contextFromRuntime } = await import(`${base}src/ui/action-bus.ts`) as typeof import('../../src/ui/action-bus');
      const { createVerbController } = await import(`${base}src/ui/verbs.ts`) as typeof import('../../src/ui/verbs');
      const { createDialogueController, createDialoguePanel, introductionDialogueBindings } = await import(`${base}src/ui/dialogue.ts`) as typeof import('../../src/ui/dialogue');
      const loaded = validateContent(input); if (!loaded.ok || !loaded.registry) throw new Error('Actual content must validate');
      const registry = loaded.registry;
      const { saveSchemaVersion: _version, safeState: _safe, ...game } = snapshot;
      const runtime: RuntimeState = { game: { ...game, world: { ...game.world, inventory: [], flags: {}, completedObjectiveIds: [] } }, checkpoint: null, activity: { kind: 'stable-exploration' },
        ui: { panel: 'none', focusedObject: null, selectedVerb: 'talk', selectedItem: null, feedback: null, presentation: { musicVolume: 0, effectsVolume: 0, voiceVolume: 0, captions: true, reducedMotion: 'on', textScale: 1 } },
        auth: { status: 'guest', clientGeneration: 0 as RuntimeState['auth']['clientGeneration'], csrfToken: null },
        persistence: { status: 'unsaved', dirtyGeneration: 0 as RuntimeState['persistence']['dirtyGeneration'], lastAcknowledgedGeneration: null, knownSlot: undefined, pendingRequest: null, replacementAuthorization: null, lastAcknowledgement: null, autosaveEnabled: false } };
      let state = createReducerState(runtime);
      const store = { getState: () => state, reduce: createReducer({ registry, bindings: introductionDialogueEffectBindings }), compareAndSet: (before: ReducerState, next: ReducerState) => { if (state !== before) return false; state = next; return true; } };
      const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
      const dialogue = createDialogueController({ registry, store, bus, bindings: introductionDialogueBindings, effectBindings: introductionDialogueEffectBindings });
      createVerbController({ registry, store, bus, bindings: dialogue.hotspotBindings });
      const main = document.createElement('main'), title = document.createElement('h1'); title.textContent = 'Dialogue verification';
      const opener = document.createElement('button'); opener.type = 'button'; opener.textContent = 'Talk to Photon the Firefly';
      const status = document.createElement('p'); status.setAttribute('role', 'status'); main.append(title, opener, status); document.body.replaceChildren(main);
      const panel = createDialoguePanel(main, bus);
      const refresh = () => { const p = dialogue.project(); panel.render(p.view, p.capture); };
      const results: ActionResult[] = [];
      bus.subscribe((_action, result) => { results.push(result); status.textContent = result.message ?? ''; refresh(); });
      opener.addEventListener('click', () => bus.dispatch(bus.capture({ kind: 'interact', targetId: (String(state.runtime.game!.world.roomId) === 'spec001:R01' ? 'spec001:HOTSPOT-photon' : 'spec001:HOTSPOT-titan') as import('../../src/domain/types').QualifiedId, verb: 'talk', itemId: null })));
      refresh();
      window.dialogueFixture = { state: () => state, results, refresh,
        invalidate: () => bus.invalidate(),
        workshop: () => { bus.invalidate(); dialogue.invalidate(); state = createReducerState({ ...state.runtime, game: { ...state.runtime.game!, world: { ...state.runtime.game!.world, roomId: 'spec001:R02' as import('../../src/domain/types').RoomId, position: { safePositionId: 'spec001:R02.entry' as import('../../src/domain/types').SafePositionId } } } }); opener.textContent = 'Talk to the Titan'; refresh(); },
        literal: () => { const p = dialogue.project(); panel.render({ ...p.view, text: '<img src=x onerror="throw new Error(1)"> literal line' }, p.capture); },
      };
    }, { base: local.url, input, snapshot });
  });
  test.afterEach(async () => { await page?.close(); });

  test('native keyboard, pointer and touch skip/replay retain Photon and Titan clues with one kit', async () => {
    await page.getByRole('button', { name: 'Talk to Photon the Firefly' }).press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Dialogue', exact: true }); await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Small lamp, large opinions');
    expect(await page.evaluate(() => window.dialogueFixture.state().runtime.activity?.kind)).toBe('dialogue-transaction');
    expect(await page.evaluate(() => window.dialogueFixture.state().control.pending?.request.evaluation.acceptedEffects)).toEqual([]);
    await dialog.getByRole('button', { name: 'Skip dialogue' }).press('Space'); await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => window.dialogueFixture.state().runtime.activity?.kind)).toBe('stable-exploration');
    const before = await page.evaluate(() => window.dialogueFixture.state().runtime.game);
    expect(before!.world.inventory).toEqual([{ itemId: 'spec001:ITEM-inspection-kit', quantity: 1 }]);
    await page.getByRole('button', { name: 'Replay dialogue' }).tap();
    await dialog.getByRole('button', { name: 'Next dialogue line' }).click(); await expect(dialog).toContainText('power lamp is lit');
    await dialog.getByRole('button', { name: 'Finish dialogue' }).press('Enter'); await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => window.dialogueFixture.state().runtime.game)).toEqual(before);
    await page.evaluate(() => window.dialogueFixture.workshop());
    await page.getByRole('button', { name: 'Talk to the Titan' }).click(); await dialog.getByRole('button', { name: 'Skip dialogue' }).click();
    await page.getByRole('button', { name: 'Replay dialogue' }).click(); await dialog.getByRole('button', { name: 'Skip dialogue' }).press('Enter');
    const after = await page.evaluate(() => window.dialogueFixture.state().runtime.game!);
    expect(after.notebook.factIds).toEqual(['spec001:FACT-photon-clue', 'spec001:FACT-titan-clue']);
    expect(after.world.inventory).toEqual(before!.world.inventory); expect(after.world.completedObjectiveIds).toEqual([]);
  });

  test('preserves focused controls across redraw and restores useful focus after finish or Escape', async () => {
    const opener = page.getByRole('button', { name: 'Talk to Photon the Firefly' }); await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Dialogue', exact: true }), next = dialog.getByRole('button', { name: 'Next dialogue line' });
    await next.focus(); await page.evaluate(() => window.dialogueFixture.refresh()); await expect(next).toBeFocused();
    await next.press('Enter'); await expect(dialog.getByRole('heading')).toBeFocused();
    await dialog.getByRole('button', { name: 'Finish dialogue' }).press('Enter'); await expect(opener).toBeFocused();
    const replay = page.getByRole('button', { name: 'Replay dialogue' }); await replay.click();
    await dialog.press('Escape'); await expect(dialog).toBeHidden(); await expect(opener).toBeFocused();
  });

  test('literal essential text and native labels remain accessible at narrow width without audio', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Talk to Photon the Firefly' }).click();
    await page.evaluate(() => window.dialogueFixture.literal());
    const dialog = page.getByRole('dialog', { name: 'Dialogue', exact: true }); await expect(dialog).toContainText('<img src=x'); await expect(dialog.locator('img')).toHaveCount(0);
    const result = await new AxeBuilder({ page }).include('[role="dialog"]').analyze(); expect(result.violations).toEqual([]);
    await dialog.getByRole('button', { name: 'Skip dialogue' }).click(); expect(await page.evaluate(() => window.dialogueFixture.state().runtime.game!.world.inventory[0]?.quantity)).toBe(1);
  });

  test('old DOM and late redraw preserve the original epoch after equal-version invalidation', async () => {
    await page.getByRole('button', { name: 'Talk to Photon the Firefly' }).click();
    const before = await page.evaluate(() => { const f = window.dialogueFixture; const before = f.state(); f.invalidate(); f.refresh(); return before; });
    await page.getByRole('button', { name: 'Skip dialogue' }).click();
    expect(await page.evaluate(() => window.dialogueFixture.results.at(-1)?.reason)).toBe('invalidated');
    expect(await page.evaluate(() => window.dialogueFixture.state())).toEqual(before);
  });
});
