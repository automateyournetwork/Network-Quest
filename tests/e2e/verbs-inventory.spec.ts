// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, firefox, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { localTls } from './support/local-tls';
import { authoredInput, introBindings, setup } from '../ui/inventory-fixture';
import type { ActionBus, ActionCapture, CapturedAction, SemanticAction } from '../../src/ui/action-bus';
import type { AppShell } from '../../src/ui/app-shell';
import type { InventoryView, createInventoryPanel } from '../../src/ui/inventory';
import type { createVerbController, HotspotBinding } from '../../src/ui/verbs';
import type { ReducerState } from '../../src/state/reducer';

declare global {
  interface Window { inventoryFixture: {
    bus: ActionBus; shell: AppShell; panel: ReturnType<typeof createInventoryPanel>; controller: ReturnType<typeof createVerbController>;
    state(): ReducerState; render(): void; actions: CapturedAction[]; inventory(): InventoryView; capture(): ActionCapture;
  } }
}

test.describe('T025 native verb/inventory modules — isolated controller evidence', () => {
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
      const { createActionBus, contextFromRuntime } = await import(`${base}src/ui/action-bus.ts`) as typeof import('../../src/ui/action-bus');
      const { createAppShell } = await import(`${base}src/ui/app-shell.ts`) as typeof import('../../src/ui/app-shell');
      const { createVerbController } = await import(`${base}src/ui/verbs.ts`) as typeof import('../../src/ui/verbs');
      const { createInventoryController, createInventoryPanel, inventoryView } = await import(`${base}src/ui/inventory.ts`) as typeof import('../../src/ui/inventory');
      const loaded = validateContent(input); if (!loaded.ok || !loaded.registry) throw new Error('Actual intro content must validate.');
      const registry = loaded.registry;
      let state = initial;
      const store = { getState: () => state, reduce: createReducer({ registry, bindings: effectBindings }),
        compareAndSet: (before: ReducerState, after: ReducerState) => { if (state !== before) return false; state = after; return true; } };
      const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
      const bindings = [
        ...[['HOTSPOT-power', 'ACTION-observe-power', 'look'], ['HOTSPOT-link', 'ACTION-observe-link', 'look'], ['HOTSPOT-satchel', 'ACTION-take-kit', 'use'],
          ['HOTSPOT-path', 'ACTION-path-short', 'use'], ['HOTSPOT-path', 'ACTION-path-long', 'use']].map(([hotspot, action, verb]) => ({ roomId: 'spec001:R01',
          hotspotId: `spec001:${hotspot}`, actionId: `spec001:${action}`, sourceId: 'spec001:DIALOGUE-arrival-actions', verb, itemId: null, mode: 'effects' })),
        ...[null, 'spec001:ITEM-inspection-kit'].map(itemId => ({ roomId: 'spec001:R01', hotspotId: 'spec001:HOTSPOT-path', actionId: 'spec001:ACTION-inspect-path',
          sourceId: 'spec001:DIALOGUE-arrival-actions', verb: 'use', itemId, mode: 'port', plan: () => ({ status: 'unavailable', message: 'Measurement controller is not connected in this isolated test.' }) })),
      ] as HotspotBinding[];
      const controller = createVerbController({ bus, registry, store, bindings }); createInventoryController({ bus, registry, store });
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = `${base}src/ui/app-shell.css`; document.head.append(css);
      const main = document.createElement('main'); main.style.cssText = 'max-width:none;margin:0;padding:0'; document.body.replaceChildren(main);
      const shell = createAppShell(main, bus), panel = createInventoryPanel(shell.panelHost, bus), actions: CapturedAction[] = [];
      let capture = bus.captureScope(), last: ReducerState | null = null;
      const inventory = () => inventoryView(registry, state);
      const render = () => {
        if (last !== state) { capture = bus.captureScope(); last = state; }
        shell.render({ context: contextFromRuntime(state.runtime), title: 'Isolated verb and inventory verification', description: 'Actual authored introduction data; separate controller fixture, not a completed guest journey.',
          controls: controller.controls(), objects: controller.objects(), evidence: [], captions: [], presentationStatus: 'Text controls only.' }, capture);
        panel.render(inventory(), capture);
      };
      bus.subscribe((action) => { actions.push(action); render(); }); render();
      window.inventoryFixture = { bus, shell, panel, controller, state: () => state, render, actions, inventory, capture: () => capture };
    }, { base: local.url, input: authoredInput, initial: setup().store.getState(), effectBindings: introBindings });
  });
  test.afterEach(async () => { await page?.close(); });
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  async function acquire() { await button('Use').click(); await button('Apprentice satchel').click(); }

  test('visible shortcuts and native selection preserve focus, quantity and reusable item state', async () => {
    for (const [name, key] of Object.entries({ Walk: 'W', Look: 'L', Talk: 'T', Use: 'U', Inventory: 'I', Notebook: 'N', Compendium: 'C' })) {
      await expect(button(name)).toBeVisible(); await expect(button(name)).toHaveAttribute('aria-keyshortcuts', key);
    }
    await acquire(); await button('Inventory').focus(); await page.keyboard.press('i');
    const panel = page.getByRole('dialog', { name: 'Inventory', exact: true });
    await expect(panel).toBeVisible(); await expect(panel.getByRole('heading', { name: 'Inventory', exact: true })).toBeFocused();
    await expect(panel.getByRole('list', { name: 'Inventory items' }).getByRole('listitem')).toHaveCount(1);
    await expect(panel.getByText('Quantity: 1', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/T025-inventory-desktop.png', fullPage: true });
    await button('Select Reusable inspection kit').click(); await expect(button('Deselect Reusable inspection kit')).toBeFocused();
    await button('Deselect Reusable inspection kit').press('Enter'); await button('Select Reusable inspection kit').tap();
    await button('Deselect Reusable inspection kit').press('Space'); await button('Select Reusable inspection kit').click();
    await expect(button('Use')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape'); await expect(panel).toBeHidden(); await expect(button('Inventory')).toBeFocused();
    await button('Physical path').click(); await expect(page.getByRole('status')).toHaveText('Measurement controller is not connected in this isolated test.');
    const state = await page.evaluate(() => window.inventoryFixture.state());
    expect(state.runtime.game!.world.inventory).toEqual([{ itemId: 'spec001:ITEM-inspection-kit', quantity: 1 }]);
    expect(state.runtime.game!.notebook.measurements).toEqual([]); expect(state.runtime.game!.world.completedObjectiveIds).toEqual([]);
    const selectionActions = await page.evaluate(() => window.inventoryFixture.actions.filter(a => a.input.kind === 'select-item'));
    expect(selectionActions).toHaveLength(5); expect(new Set(selectionActions.map(a => a.actionId)).size).toBe(5);
  });
  test('pointer, keyboard, touch and renderer Look retain the same actual authored fact exactly once', async () => {
    await button('Look').click(); await button('Power indication').click(); await button('Power indication').press('Enter'); await button('Power indication').tap();
    await page.evaluate(() => { const f = window.inventoryFixture; f.bus.dispatch(f.capture()({ kind: 'interact', targetId: 'spec001:HOTSPOT-power', verb: 'look', itemId: null } as SemanticAction)); });
    const state = await page.evaluate(() => window.inventoryFixture.state());
    expect(state.runtime.game!.notebook.factIds).toEqual(['spec001:FACT-power']);
    await expect(page.getByRole('status')).toContainText('Power indication does not prove a data link.');
    await button('Talk').click(); await button('Power indication').click(); await expect(page.getByRole('status')).toContainText('not a switch');
    await button('Notebook').click(); await expect(page.getByRole('status')).toContainText('Notebook is unavailable');
  });
  test('multiple authored Use alternatives remain explicit; selector never fabricates inspection', async () => {
    await acquire(); await button('Physical path').click(); await expect(page.getByRole('status')).toContainText('Choose an action');
    await expect(button('Inspect physical path')).toBeVisible(); await expect(button('Change physical path')).toBeVisible();
    await button('Change physical path').press('Enter');
    const state = await page.evaluate(() => window.inventoryFixture.state());
    expect(state.runtime.game!.world.flags).toMatchObject({ 'spec001:FLAG-path-mode': 'direct', 'spec001:FLAG-path-inspected': false });
    expect(state.runtime.game!.notebook.measurements).toEqual([]);
  });
  test('typed notes, literal text, narrow layouts and stale projection scopes remain safe', async () => {
    await acquire(); await button('Inventory').click();
    await page.evaluate(() => {
      const f = window.inventoryFixture;
      const notes = document.createElement('textarea'); notes.setAttribute('aria-label', 'Fixture personal notes'); f.shell.panelHost.append(notes);
      const view = f.inventory(); f.panel.render({ ...view, items: view.items.map(row => ({ ...row, description: '<img src=x onerror=alert(1)> literal description' })) }, f.capture());
    });
    const notes = page.getByRole('textbox', { name: 'Fixture personal notes' }); await notes.pressSequentially('wl tuin c');
    await expect(notes).toHaveValue('wl tuin c'); await expect(notes).toBeFocused();
    await expect(page.getByRole('dialog', { name: 'Inventory' }).locator('img')).toHaveCount(0);
    await expect(page.getByText('<img src=x onerror=alert(1)> literal description')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { window.inventoryFixture.shell.element.style.fontSize = '200%'; });
    await expect(button('Select Reusable inspection kit')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    const audit = await new AxeBuilder({ page }).include('.nq-shell').analyze(); expect(audit.violations).toEqual([]);
    await page.screenshot({ path: 'test-results/T025-inventory-390px.png', fullPage: true });
    await page.evaluate(() => { const f = window.inventoryFixture; const old = f.inventory(), capture = f.capture(); f.bus.invalidate(); f.panel.render(old, capture); });
    await button('Select Reusable inspection kit').click(); await expect(page.getByRole('status')).toContainText('adventure has changed');
    expect(await page.evaluate(() => window.inventoryFixture.state().runtime.ui!.selectedItem)).toBeNull();
  });
});
