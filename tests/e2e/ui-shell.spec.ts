// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, firefox, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { localTls } from './support/local-tls';
import type { ActionBus, ActionContext, CapturedAction, SemanticAction } from '../../src/ui/action-bus';
import type { AppShell, AppShellView } from '../../src/ui/app-shell';
import type { QualifiedId } from '../../src/domain/types';

declare global {
  interface Window {
    shellFixture: {
      bus: ActionBus; shell: AppShell; view: AppShellView; actions: CapturedAction[];
      update(view: AppShellView): void; changeContext(): void; removeHandler(): void;
    };
  }
}

const view: AppShellView = {
  context: { adventureId: '00000000-0000-4000-8000-000000000001' as ActionContext['adventureId'],
    attemptId: '00000000-0000-4000-8000-000000000002' as ActionContext['attemptId'], configurationRevision: 1 as ActionContext['configurationRevision'] },
  title: 'Semantic interface test fixture',
  description: 'Synthetic controls for interface verification. No playable story, progress or saving is implemented here.',
  controls: [
    ...(['walk', 'look', 'talk', 'use'] as const).map(verb => ({ id: `verb-${verb}`, label: verb[0]!.toUpperCase() + verb.slice(1), action: { kind: 'select-verb', verb } as SemanticAction, pressed: verb === 'walk' })),
    ...(['inventory', 'notebook', 'compendium'] as const).map(panel => ({ id: `panel-${panel}`, label: panel[0]!.toUpperCase() + panel.slice(1), action: { kind: 'open-panel', panel } as SemanticAction })),
    { id: 'close', label: 'Close panel', action: { kind: 'close-panel' } },
  ],
  objects: [{ id: 'fixture-object', label: 'Fixture instrument', description: 'A textual instrument description remains available with no visual renderer.', actions: [
    { id: 'look-instrument', label: 'Look at fixture instrument', action: { kind: 'interact', verb: 'look', targetId: 'spec001:PR001' as QualifiedId, itemId: null } },
    { id: 'use-instrument', label: 'Use fixture instrument', action: { kind: 'interact', verb: 'use', targetId: 'spec001:PR001' as QualifiedId, itemId: null }, unavailableReason: 'Fixture instrument is disconnected.' },
  ] }],
  evidence: [{ id: 'fixture-evidence', label: 'Fixture reading', text: 'Earlier synthetic reading.', source: 'Interface test fixture, not a technical lesson.', freshness: 'stale' }],
  captions: [{ id: 'fixture-caption', speaker: 'Fixture voice', text: 'Every supplied spoken line remains readable.' }],
  presentationStatus: 'Visual presentation unavailable in this fixture. Scene descriptions and controls remain available.',
};

test.describe('actual semantic shell modules in an isolated trusted browser', () => {
  test.describe.configure({ mode: 'default' });
  let local: Awaited<ReturnType<typeof localTls>>;
  let context: BrowserContext;
  let page: Page;
  test.beforeAll(async () => {
    local = await localTls();
    try { context = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false, hasTouch: true }); }
    catch (error) { await local.stop(); throw error; }
  });
  test.afterAll(async () => { try { await context?.close(); } finally { await local?.stop(); } });
  test.beforeEach(async () => {
    page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    expect([200, 304]).toContain((await page.goto(local.url))?.status());
    await page.evaluate(async ({ model, base }) => {
      const { createActionBus } = await import(`${base}src/ui/action-bus.ts`) as typeof import('../../src/ui/action-bus');
      const { createAppShell } = await import(`${base}src/ui/app-shell.ts`) as typeof import('../../src/ui/app-shell');
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = `${base}src/ui/app-shell.css`; document.head.append(css);
      // This mount is test-only; the built application retains its honest setup status.
      const main = document.createElement('main'); main.style.cssText = 'max-width:none;margin:0;padding:0';
      document.body.replaceChildren(main);
      let current = model.context;
      const bus = createActionBus({ getContext: () => current });
      const actions: CapturedAction[] = [];
      const handle = (action: CapturedAction) => { actions.push(action); return { status: 'handled' as const, message: 'Fixture action received.' }; };
      bus.register('select-verb', handle); bus.register('open-panel', handle); bus.register('close-panel', handle);
      const removeHandler = bus.register('interact', handle);
      const shell = createAppShell(main, bus); shell.render(model);
      window.shellFixture = { bus, shell, view: model, actions, removeHandler,
        update: next => { shell.render(next); window.shellFixture.view = next; },
        changeContext: () => { if (current) current = { ...current, configurationRevision: (current.configurationRevision + 1) as ActionContext['configurationRevision'] }; },
      };
    }, { model: view, base: local.url });
  });
  test.afterEach(async () => { await page?.close(); });

  test('pointer, native keyboard, touch, shortcut and renderer use identical typed intent', async () => {
    const look = page.getByRole('button', { name: 'Look', exact: true });
    await look.click();
    await look.press('Enter');
    await look.press('Space');
    await look.tap();
    await look.press('l');
    await page.evaluate(() => { const f = window.shellFixture; f.bus.dispatch(f.bus.capture({ kind: 'select-verb', verb: 'look' }, f.view.context)); });
    const actions = await page.evaluate(() => window.shellFixture.actions);
    expect(actions).toHaveLength(6);
    expect(actions.map(action => action.input)).toEqual(Array.from({ length: 6 }, () => ({ kind: 'select-verb', verb: 'look' })));
    expect(new Set(actions.map(action => action.actionId)).size).toBe(6);
    expect(actions.map(action => action.context)).toEqual(Array.from({ length: 6 }, () => view.context));
    expect(await page.getByRole('status').textContent()).toBe('Fixture action received.');
  });

  test('visible W/L/T/U/I/N/C/Escape controls and arrow navigation agree', async () => {
    await page.getByRole('button', { name: 'Walk', exact: true }).focus();
    for (const key of ['w', 'l', 't', 'u', 'i', 'n', 'c', 'Escape']) await page.keyboard.press(key);
    expect(await page.evaluate(() => window.shellFixture.actions.map(action => action.input))).toEqual(view.controls.map(control => control.action));
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: 'Look', exact: true })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('button', { name: 'Close panel' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('button', { name: 'Walk', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Look', exact: true })).toBeFocused();
    expect(await page.getByRole('button', { name: 'Notebook' }).getAttribute('aria-keyshortcuts')).toBe('N');
  });

  test('typing, composition, modifiers, repeat and focus outside the shell never dispatch shortcuts', async () => {
    await page.evaluate(() => {
      const { panelHost } = window.shellFixture.shell;
      const textarea = document.createElement('textarea'); textarea.setAttribute('aria-label', 'Test notes'); panelHost.append(textarea);
      const editable = document.createElement('div'); editable.contentEditable = 'true'; editable.setAttribute('aria-label', 'Editable test'); editable.setAttribute('role', 'textbox'); panelHost.append(editable);
      const outside = document.createElement('button'); outside.textContent = 'Outside'; document.body.append(outside);
    });
    await page.getByRole('textbox', { name: 'Test notes' }).fill('wl tuin c');
    await page.getByRole('textbox', { name: 'Test notes' }).press('n');
    await page.getByRole('textbox', { name: 'Editable test' }).press('i');
    const look = page.getByRole('button', { name: 'Look', exact: true });
    await look.focus();
    for (const key of ['Control+l', 'Meta+l', 'Alt+l', 'Shift+l']) await look.press(key);
    await look.dispatchEvent('compositionstart'); await look.press('n'); await look.dispatchEvent('compositionend');
    await look.dispatchEvent('keydown', { key: 'l', isComposing: true });
    await look.dispatchEvent('keydown', { key: 'l', repeat: true });
    await page.getByRole('button', { name: 'Outside' }).press('l');
    expect(await page.evaluate(() => window.shellFixture.actions)).toEqual([]);
    await look.press('l');
    expect(await page.evaluate(() => window.shellFixture.actions.length)).toBe(1);
  });

  test('disabled, unhandled and stale displayed controls provide honest feedback with no handled action', async () => {
    await page.getByRole('button', { name: 'Use fixture instrument' }).click({ force: true });
    await expect(page.getByRole('status')).toHaveText('Fixture instrument is disconnected.');
    expect(await page.evaluate(() => window.shellFixture.actions)).toEqual([]);
    await page.evaluate(() => window.shellFixture.removeHandler());
    await page.getByRole('button', { name: 'Look at fixture instrument' }).click();
    await expect(page.getByRole('status')).toHaveText('This action is not available yet.');
    await page.evaluate(() => window.shellFixture.changeContext());
    await page.getByRole('button', { name: 'Look', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('The scene has changed. Choose the action again.');
    expect(await page.evaluate(() => window.shellFixture.actions)).toEqual([]);
  });

  test('same-version runtime replacement invalidates old controls until a fresh view is rendered', async () => {
    await page.evaluate(() => window.shellFixture.bus.invalidate());
    await page.getByRole('button', { name: 'Look', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('The adventure has changed. Choose the action again.');
    expect(await page.evaluate(() => window.shellFixture.actions)).toEqual([]);
    await page.evaluate(() => { const f = window.shellFixture; f.update(f.view); });
    await page.getByRole('button', { name: 'Look', exact: true }).click();
    expect(await page.evaluate(() => window.shellFixture.actions.length)).toBe(1);
  });

  test('late media status updates retain the old projection scope after equal-version replacement', async () => {
    await page.evaluate(() => {
      const f = window.shellFixture;
      const capture = f.bus.captureScope(f.view.context);
      f.shell.render(f.view, capture);
      f.bus.invalidate();
      f.shell.render({ ...f.view, presentationStatus: 'Late fixture media ready status.' }, capture);
    });
    await page.getByRole('button', { name: 'Look', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('The adventure has changed. Choose the action again.');
    expect(await page.evaluate(() => window.shellFixture.actions)).toEqual([]);
  });

  test('updates retain focused controls and panel edits, then restore removed focus to the title', async () => {
    await page.evaluate(() => {
      const textarea = document.createElement('textarea'); textarea.setAttribute('aria-label', 'Test notes');
      window.shellFixture.shell.panelHost.append(textarea);
    });
    const notes = page.getByRole('textbox', { name: 'Test notes' });
    await notes.fill('Unsubmitted note');
    await page.evaluate(() => { const f = window.shellFixture; f.update({ ...f.view, description: 'Updated description' }); });
    await expect(notes).toBeFocused(); await expect(notes).toHaveValue('Unsubmitted note');
    await page.getByRole('button', { name: 'Look at fixture instrument' }).focus();
    await page.evaluate(() => { const f = window.shellFixture; f.update({ ...f.view, captions: [{ id: 'fixture-caption', text: 'Changed caption' }] }); });
    await expect(page.getByRole('button', { name: 'Look at fixture instrument' })).toBeFocused();
    await page.evaluate(() => { const f = window.shellFixture; f.update({ ...f.view, objects: [] }); });
    await expect(page.getByRole('heading', { name: view.title })).toBeFocused();
    await expect(notes).toHaveValue('Unsubmitted note');
  });

  test('renders untrusted text literally, retains captions/fallback, and announces only changed action feedback', async () => {
    await page.evaluate(() => {
      const f = window.shellFixture;
      f.update({ ...f.view, title: '<img src=x onerror=alert(1)>', description: '<script>bad()</script>',
        objects: [{ ...f.view.objects[0]!, description: '<b>literal evidence</b>' }],
        captions: [{ id: 'caption', text: '<svg onload=alert(1)>', speaker: '<i>Voice</i>' }] });
    });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('<img src=x onerror=alert(1)>');
    expect(await page.locator('.nq-shell img, .nq-shell script, .nq-shell svg, .nq-shell b, .nq-shell i').count()).toBe(0);
    await expect(page.getByText('<b>literal evidence</b>', { exact: true })).toBeVisible();
    await expect(page.getByText('<i>Voice</i>: <svg onload=alert(1)>', { exact: true })).toBeVisible();
    await expect(page.getByText(view.presentationStatus)).toBeVisible();
    await expect(page.getByRole('status')).toBeEmpty();
    const mutations = await page.evaluate(() => new Promise<number>(resolve => {
      const f = window.shellFixture; let count = 0;
      const observer = new MutationObserver(records => { count += records.length; });
      observer.observe(f.shell.element.querySelector('[role=status]')!, { childList: true, subtree: true, characterData: true });
      for (let i = 0; i < 3; i++) f.bus.dispatch(f.bus.capture({ kind: 'select-verb', verb: 'look' }));
      queueMicrotask(() => { observer.disconnect(); resolve(count); });
    }));
    expect(mutations).toBe(1);
  });

  test('rejects ambiguous view identities atomically and disposes only its owned DOM/listeners', async () => {
    const result = await page.evaluate(() => {
      const f = window.shellFixture;
      let rejected = false;
      try { f.update({ ...f.view, controls: [...f.view.controls, f.view.controls[0]!] }); } catch { rejected = true; }
      const title = f.shell.element.querySelector('h1')?.textContent;
      const button = f.shell.element.querySelector('button')!;
      const keep = document.createElement('p'); keep.id = 'outside-owned'; keep.textContent = 'Other module'; document.body.append(keep);
      f.shell.dispose(); f.shell.dispose(); button.click();
      f.bus.dispatch(f.bus.capture({ kind: 'select-verb', verb: 'look' }));
      return { rejected, title, actionCount: f.actions.length, connected: f.shell.element.isConnected, outside: keep.isConnected };
    });
    expect(result).toEqual({ rejected: true, title: view.title, actionCount: 1, connected: false, outside: true });
  });

  test('keeps actions visible at 390/768 pixels and doubled text with no axe violations', async () => {
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      for (const control of view.controls) await expect(page.getByRole('button', { name: control.label, exact: true })).toBeVisible();
      const buttons = await page.locator('.nq-shell button').evaluateAll(elements => elements.map(element => {
        const bounds = element.getBoundingClientRect(); return { width: bounds.width, height: bounds.height };
      }));
      expect(buttons.every(bounds => bounds.width >= 44 && bounds.height >= 44)).toBe(true);
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.setViewportSize({ width: 1280, height: 900 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole('button', { name: 'Walk', exact: true }).focus();
    const focus = await page.getByRole('button', { name: 'Walk', exact: true }).evaluate(element => {
      const style = getComputedStyle(element); return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(focus.style).toBe('solid'); expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: 'test-results/ui-shell-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({ path: 'test-results/ui-shell-390.png', fullPage: true });
  });
});
