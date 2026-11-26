// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, firefox, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { ActionBus, ActionCapture, CapturedAction } from '../../src/ui/action-bus';
import type { AppShell, SceneObjectView } from '../../src/ui/app-shell';
import type { ReducerState } from '../../src/state/reducer';
import type { HotspotBinding } from '../../src/ui/verbs';
import type { QualifiedId } from '../../src/domain/types';
import { authoredInput, introBindings, setup } from '../ui/inventory-fixture';
import { localTls } from './support/local-tls';

declare global {
  interface Window { navigationFixture: {
    bus: ActionBus; shell: AppShell; state(): ReducerState; objects(): readonly SceneObjectView[];
    actions: CapturedAction[]; capture(): ActionCapture; render(): void;
  } }
}
test.describe('T028 native authored navigation — isolated controller evidence', () => {
  test.describe.configure({ mode: 'default' });
  let local: Awaited<ReturnType<typeof localTls>>, context: BrowserContext, page: Page;
  test.beforeAll(async () => {
    local = await localTls();
    try { context = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false, hasTouch: true }); }
    catch (error) { await local.stop(); throw error; }
  });
  test.afterAll(async () => { try { await context?.close(); } finally { await local?.stop(); } });
  test.beforeEach(async () => {
    page = await context.newPage(); await page.setViewportSize({ width: 1280, height: 900 });
    expect([200, 304]).toContain((await page.goto(local.url))?.status());
    await page.evaluate(async ({ base, input, initial, effectBindings }) => {
      const { validateContent } = await import(`${base}src/content/registry.ts`) as typeof import('../../src/content/registry');
      const { createReducer } = await import(`${base}src/state/reducer.ts`) as typeof import('../../src/state/reducer');
      const { createNavigation } = await import(`${base}src/state/navigation.ts`) as typeof import('../../src/state/navigation');
      const { createNavigationPlanner, createSceneObjectProjection } = await import(`${base}src/ui/scene-objects.ts`) as typeof import('../../src/ui/scene-objects');
      const { createActionBus, contextFromRuntime } = await import(`${base}src/ui/action-bus.ts`) as typeof import('../../src/ui/action-bus');
      const { createAppShell } = await import(`${base}src/ui/app-shell.ts`) as typeof import('../../src/ui/app-shell');
      const { createVerbController } = await import(`${base}src/ui/verbs.ts`) as typeof import('../../src/ui/verbs');
      const loaded = validateContent(input); if (!loaded.ok || !loaded.registry) throw new Error('Actual intro content must validate.');
      const registry = loaded.registry, navigation = createNavigation({ registry, world: input.world,
        entries: ['R01', 'R02'].map(room => ({ roomId: `spec001:${room}`, safePositionId: `spec001:${room}.entry`, activity: 'stable-exploration' })) as import('../../src/state/navigation').NavigationEntry[] });
      let state = initial;
      const store = { getState: () => state, reduce: createReducer({ registry, bindings: effectBindings, canReachRoom: navigation.canReachRoom }),
        compareAndSet: (before: ReducerState, after: ReducerState) => { if (state !== before) return false; state = after; return true; } };
      const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
      const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
      const bindings: HotspotBinding[] = [{ roomId: q('R01'), hotspotId: q('HOTSPOT-power'), actionId: q('ACTION-observe-power'),
        sourceId: q('DIALOGUE-arrival-actions'), verb: 'look', itemId: null, mode: 'effects' }];
      const controller = createVerbController({ bus, registry, store, bindings, walk: createNavigationPlanner({ navigation, store }), sceneObjects: createSceneObjectProjection({ registry, navigation }) });
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = `${base}src/ui/app-shell.css`; document.head.append(css);
      const main = document.createElement('main'); main.style.cssText = 'max-width:none;margin:0;padding:0'; document.body.replaceChildren(main);
      const shell = createAppShell(main, bus), actions: CapturedAction[] = [];
      let capture = bus.captureScope(), last: ReducerState | null = null;
      const render = () => {
        if (last !== state) { capture = bus.captureScope(); last = state; }
        const room = registry.record(state.runtime.game!.world.roomId); if (room?.kind !== 'room') throw new Error('Missing authored room');
        const name = input.world.rooms.find(r => r.id === room.id)!.name;
        shell.render({ context: contextFromRuntime(state.runtime), title: name, description: room.description, controls: controller.controls(), objects: controller.objects(),
          evidence: [], captions: [], presentationStatus: 'Text controls; isolated navigation verification.' }, capture);
      };
      bus.subscribe(action => { actions.push(action); render(); }); render();
      window.navigationFixture = { bus, shell, state: () => state, objects: controller.objects, actions, capture: () => capture, render };
    }, { base: local.url, input: authoredInput, initial: setup().store.getState(), effectBindings: introBindings });
  });
  test.afterEach(async () => { await page?.close(); });
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const toWorkshop = () => button("Walk to The Titan's Workshop");
  const toLift = () => button('Walk to The Arrival Lift');

  test('native pointer, keyboard and touch use atomic arrival and carry actual Look evidence between rooms', async () => {
    await button('Look').click(); await button('Power indication').click(); await page.keyboard.press('w');
    await toWorkshop().focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: "The Titan's Workshop", exact: true })).toBeVisible();
    let game = (await page.evaluate(() => window.navigationFixture.state())).runtime.game!;
    expect(game.world.roomId).toBe('spec001:R02'); expect(game.world.position.safePositionId).toBe('spec001:R02.entry');
    expect(game.notebook.mapRoomIds).toEqual(['spec001:R01', 'spec001:R02']); expect(game.notebook.factIds).toEqual(['spec001:FACT-power']);
    await toLift().tap(); await expect(page.getByRole('heading', { name: 'The Arrival Lift', exact: true })).toBeVisible();
    await toWorkshop().click(); game = (await page.evaluate(() => window.navigationFixture.state())).runtime.game!;
    expect(game.notebook.factIds).toEqual(['spec001:FACT-power']); expect(game.notebook.mapRoomIds).toEqual(['spec001:R01', 'spec001:R02']);
    const travel = await page.evaluate(() => window.navigationFixture.actions.filter(a => a.input.kind === 'interact' && a.input.verb === 'walk'));
    expect(travel).toHaveLength(3); expect(new Set(travel.map(a => a.actionId)).size).toBe(3);
    expect((await page.evaluate(() => window.navigationFixture.state())).runtime.persistence.status).toBe('unsaved');
  });
  test('scene list, visual intents and floor anchors share the same capture scope and cannot reuse restored or canceled input', async () => {
    await expect(button('Clear lift landing')).toBeVisible(); await expect(button('The Arrival Lift entry')).toBeVisible();
    const original = await page.evaluate(() => window.navigationFixture.state());
    await button('Clear lift landing').press('Enter'); await button('The Arrival Lift entry').tap();
    expect((await page.evaluate(() => window.navigationFixture.state())).runtime.game).toEqual(original.runtime.game);
    const result = await page.evaluate(() => {
      const f = window.navigationFixture, object = f.objects().find(o => o.id === 'exit:spec001:R01:spec001:R02')!, capture = f.capture();
      const canceled = capture(object.actions[0]!.action); f.bus.cancel(canceled);
      const canceledResult = f.bus.dispatch(canceled);
      const visual = capture(object.actions[0]!.action), arrival = f.bus.dispatch(visual), after = f.state();
      const replay = f.bus.dispatch(visual);
      const oldProjection = f.bus.dispatch(capture(object.actions[0]!.action));
      return { canceledResult, arrival, replay, oldProjection, unchanged: f.state() === after };
    });
    expect(result.canceledResult.reason).toBe('canceled'); expect(result.arrival.status).toBe('handled'); expect(result.replay.status).toBe('handled');
    expect(result.oldProjection.reason).toBe('stale-context'); expect(result.unchanged).toBe(true);
    await expect(page.getByRole('heading', { name: "The Titan's Workshop", exact: true })).toBeVisible();
    await page.evaluate(() => { const f = window.navigationFixture, capture = f.capture(), objects = f.objects(); f.bus.invalidate();
      f.shell.render({ context: f.bus.captureScope()({ kind: 'select-verb', verb: 'walk' }).context, title: "The Titan's Workshop", description: 'Preserved projection after invalidation.',
        controls: [], objects, evidence: [], captions: [], presentationStatus: 'Text controls.' }, capture); });
    await toLift().click(); await expect(page.getByRole('status')).toContainText('adventure has changed');
    expect((await page.evaluate(() => window.navigationFixture.state())).runtime.game!.world.roomId).toBe('spec001:R02');
  });
  test('all authored exits stay readable with locked reasons, 200% text, narrow viewport and reduced motion', async () => {
    await toWorkshop().click(); const before = await page.evaluate(() => window.navigationFixture.state());
    for (const room of ['The Copper Warrens', 'The Photon Gardens', 'The Skywell', 'The Shell Market', 'The Clockworks']) {
      const exit = button(`Walk to ${room}`); await expect(exit).toBeVisible(); await expect(exit).toHaveAttribute('aria-disabled', 'true');
      await exit.press('Enter'); await expect(page.getByRole('status')).toContainText('requirements');
    }
    expect(await page.evaluate(() => window.navigationFixture.state())).toEqual(before);
    await expect(toLift()).toHaveAttribute('aria-disabled', 'false'); await expect(button('Clear workshop aisle')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { window.navigationFixture.shell.element.style.fontSize = '200%'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    const audit = await new AxeBuilder({ page }).include('.nq-shell').analyze(); expect(audit.violations).toEqual([]);
    await page.screenshot({ path: 'test-results/T028-navigation-390px.png', fullPage: true });
  });
});
