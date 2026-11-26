// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { expect, firefox, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type * as S from '../../src/content/schema-types.generated';
import type { ActionId, RoomId, SafePositionId } from '../../src/domain/types';
import type { EffectBinding, ReducerState } from '../../src/state/reducer';
import type { RuntimeState, SaveSnapshotV1 } from '../../src/state/types';
import type { ActionResult } from '../../src/ui/action-bus';
import type { HotspotBinding } from '../../src/ui/verbs';
import { localTls } from './support/local-tls';

declare global { interface Window { notebookFixture: {
  state(): ReducerState; results: ActionResult[]; refresh(): void; invalidate(): void;
  travel(roomId: 'R01' | 'R02'): void; restore(): void;
} } }
const read = async (path: string) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')) as unknown;
const world = await read('content/spec001/world.json') as S.world;
const input = { world, sources: await read('content/spec001/sources.json'), documents: Object.fromEntries(await Promise.all([...new Set(world.documents.map(d => d.path))].map(async path => [path, await read(path)]))) };
const snapshot = await read('specs/001-physical-layer-underworld/contracts/examples/save-v1.json') as SaveSnapshotV1;

test.describe('T027 actual notebook modules with authored content over trusted HTTPS', () => {
  test.describe.configure({ mode: 'default' });
  let local: Awaited<ReturnType<typeof localTls>>, context: BrowserContext, page: Page, notesId: string, hypothesisId: string;
  let regionHeadings: Record<string, string>;
  test.beforeAll(async () => {
    local = await localTls();
    try { context = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false, hasTouch: true }); }
    catch (error) { await local.stop(); throw error; }
  });
  test.afterAll(async () => { try { await context?.close(); } finally { await local?.stop(); } });
  test.beforeEach(async () => {
    page = await context.newPage();
    // This fixture tests the real modules below; T030 owns the real bootstrap.
    // Keep concurrent/new application startup out of this isolated module host.
    await page.route('**/src/main.ts', route => route.fulfill({ contentType: 'application/javascript', body: 'export {};' }));
    expect([200, 304]).toContain((await page.goto(local.url))?.status());
    await page.evaluate(async ({ base, input, snapshot }) => {
      await import(`${base}src/ui/app-shell.css`);
      const { validateContent } = await import(`${base}src/content/registry.ts`) as typeof import('../../src/content/registry');
      const { createReducer, createReducerState } = await import(`${base}src/state/reducer.ts`) as typeof import('../../src/state/reducer');
      const { introductionNotebookEffectBindings } = await import(`${base}src/state/notebook.ts`) as typeof import('../../src/state/notebook');
      const { createActionBus, contextFromRuntime } = await import(`${base}src/ui/action-bus.ts`) as typeof import('../../src/ui/action-bus');
      const { createVerbController } = await import(`${base}src/ui/verbs.ts`) as typeof import('../../src/ui/verbs');
      const { createAppShell } = await import(`${base}src/ui/app-shell.ts`) as typeof import('../../src/ui/app-shell');
      const { createNotebookController, createNotebookPanel } = await import(`${base}src/ui/notebook.ts`) as typeof import('../../src/ui/notebook');
      const loaded = validateContent(input); if (!loaded.ok || !loaded.registry) throw new Error('Actual content must validate');
      const registry = loaded.registry;
      const { saveSchemaVersion: _version, safeState: _safe, ...game } = snapshot;
      const runtime: RuntimeState = { game: { ...game, world: { ...game.world, inventory: [{ itemId: 'spec001:ITEM-inspection-kit' as import('../../src/domain/types').ItemId, quantity: 1 }], flags: {}, completedObjectiveIds: [] } },
        checkpoint: null, activity: { kind: 'stable-exploration' },
        ui: { panel: 'none', focusedObject: null, selectedVerb: 'look', selectedItem: null, feedback: null, presentation: { musicVolume: 0, effectsVolume: 0, voiceVolume: 0, captions: true, reducedMotion: 'on', textScale: 1 } },
        auth: { status: 'guest', clientGeneration: 0 as RuntimeState['auth']['clientGeneration'], csrfToken: null },
        persistence: { status: 'unsaved', dirtyGeneration: 0 as RuntimeState['persistence']['dirtyGeneration'], lastAcknowledgedGeneration: null, knownSlot: undefined, pendingRequest: null, replacementAuthorization: null, lastAcknowledgement: null, autosaveEnabled: false } };
      const bindings: HotspotBinding[] = [
        ['R01', 'HOTSPOT-power', 'look', 'ACTION-observe-power', 'DIALOGUE-arrival-actions'],
        ['R01', 'HOTSPOT-link', 'look', 'ACTION-observe-link', 'DIALOGUE-arrival-actions'],
        ['R01', 'HOTSPOT-path', 'use', 'ACTION-path-short', 'DIALOGUE-arrival-actions'],
        ['R01', 'HOTSPOT-path', 'use', 'ACTION-path-long', 'DIALOGUE-arrival-actions'],
        ['R02', 'HOTSPOT-endpoints', 'look', 'ACTION-endpoints', 'DIALOGUE-workshop-actions'],
        ['R02', 'HOTSPOT-declared-path', 'look', 'ACTION-declare-path', 'DIALOGUE-workshop-actions'],
      ].map(([room, hotspot, verb, action, source]) => ({ roomId: `spec001:${room}`, hotspotId: `spec001:${hotspot}`, verb,
        actionId: `spec001:${action}`, sourceId: `spec001:${source}`, itemId: null, mode: 'effects' })) as HotspotBinding[];
      const effectBindings: EffectBinding[] = bindings.flatMap(binding => {
        const source = registry.record(binding.sourceId) as S.dialogue;
        return source.nodes[0]!.choices.find(c => c.id === binding.actionId)!.effects.map(effect => ({ sourceId: binding.sourceId,
          effectId: effect.effectId as import('../../src/domain/types').EffectId, mode: 'repeatable' }));
      });
      let state = createReducerState(runtime);
      const store = { getState: () => state, reduce: createReducer({ registry, bindings: [...effectBindings, ...introductionNotebookEffectBindings] }), compareAndSet: (before: ReducerState, next: ReducerState) => { if (state !== before) return false; state = next; return true; } };
      const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
      const notebook = createNotebookController({ registry, store, bus });
      const verbs = createVerbController({ registry, store, bus, bindings: [...bindings, ...notebook.hotspotBindings], panels: notebook.panels });
      document.body.replaceChildren(); const main = document.createElement('main'); document.body.append(main);
      const shell = createAppShell(main, bus), panel = createNotebookPanel(shell.panelHost, bus);
      let shownGame = state.runtime.game, capture = bus.captureScope(contextFromRuntime(state.runtime));
      const refresh = () => {
        if (shownGame !== state.runtime.game) { shownGame = state.runtime.game; capture = bus.captureScope(contextFromRuntime(state.runtime)); }
        shell.render({ context: contextFromRuntime(state.runtime), title: String(state.runtime.game!.world.roomId) === 'spec001:R01' ? 'The Arrival Lift' : "The Titan's Workshop",
          description: 'Notebook verification', controls: verbs.controls(), objects: verbs.objects(), evidence: [], captions: [], presentationStatus: '' }, capture);
        const projection = notebook.project(); panel.render(projection.view, projection.capture);
      };
      const results: ActionResult[] = []; bus.subscribe((_action, result) => { results.push(result); refresh(); });
      const travel = (roomId: 'R01' | 'R02') => {
        const before = state, game = state.runtime.game!;
        const result = store.reduce(before, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: game.world,
          input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'fixture-safe-arrival', observations: [], acceptedEffects: [] },
            destination: { roomId: `spec001:${roomId}` as RoomId, safePositionId: `spec001:${roomId}.entry` as SafePositionId, activity: 'stable-exploration' } } });
        if (result.status !== 'applied' && result.status !== 'no-op') throw new Error('Fixture arrival must use a valid canonical transition');
        store.compareAndSet(before, result.state); refresh();
      };
      window.notebookFixture = { state: () => state, results, refresh, travel, invalidate: () => bus.invalidate(),
        restore: () => { bus.invalidate(); notebook.invalidate(); state = createReducerState(structuredClone(runtime)); refresh(); },
      }; refresh();
    }, { base: local.url, input, snapshot });
    const associations = await page.evaluate(() => [...document.querySelectorAll<HTMLLabelElement>('[role="dialog"][aria-label="Notebook"] label')].map(label => ({
      name: label.textContent, id: label.control?.id, tag: label.control?.tagName,
    })));
    expect(associations.map(({ name, tag }) => ({ name, tag }))).toEqual([{ name: 'Hypothesis', tag: 'TEXTAREA' }, { name: 'Personal notes', tag: 'TEXTAREA' }]);
    hypothesisId = associations[0]!.id!; notesId = associations[1]!.id!;
    expect(hypothesisId).toMatch(/^notebook-[0-9a-f-]+-hypotheses-input$/); expect(notesId).toMatch(/^notebook-[0-9a-f-]+-personal-notes-input$/);
    const sections = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-label="Notebook"] > section')].map(section => {
      const headingId = section.getAttribute('aria-labelledby')!, heading = document.getElementById(headingId)!;
      return { tag: section.tagName, headingTag: heading.tagName, name: heading.textContent!, headingId };
    }));
    expect(sections.map(({ tag, headingTag, name }) => ({ tag, headingTag, name }))).toEqual(['Objectives', 'Evidence', 'Hypotheses', 'Maps', 'Personal Notes'].map(name => ({ tag: 'SECTION', headingTag: 'H3', name })));
    expect(new Set(sections.map(section => section.headingId)).size).toBe(5);
    regionHeadings = Object.fromEntries(sections.map(section => [section.name, section.headingId]));
  });
  test.afterEach(async () => { await page?.close(); });
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const notebook = () => page.getByRole('dialog', { name: 'Notebook', exact: true });
  const region = (name: string) => page.locator(`section[aria-labelledby="${regionHeadings[name]}"]`);
  // Firefox 1572 SIGSEGVs in Playwright's recursive role/label/name lookup here.
  // These IDs come from the exact observed native label.control associations.
  const notes = () => page.locator(`#${notesId}`);

  test('five semantic sections, native keyboard notes and Unicode limits preserve focus and literal text', async () => {
    await button('Notebook').press('Enter');
    for (const name of ['Objectives', 'Evidence', 'Hypotheses', 'Maps', 'Personal Notes']) await expect(region(name)).toBeVisible();
    const field = notes(), originalVerb = await page.evaluate(() => window.notebookFixture.state().runtime.ui!.selectedVerb);
    await field.focus(); await field.pressSequentially('wltuinc <b>player writing</b>');
    expect(await page.evaluate(() => window.notebookFixture.state().runtime.ui!.selectedVerb)).toBe(originalVerb);
    await expect(region('Personal Notes').locator('b')).toHaveCount(0);
    await page.evaluate(() => window.notebookFixture.refresh()); await expect(field).toBeFocused();
    const limit = '🧵'.repeat(4096); await field.fill(limit); await expect(field).toHaveValue(limit);
    expect(await page.evaluate(() => window.notebookFixture.state().runtime.game!.notebook.personalNotes)).toBe(limit);
    await field.fill(limit + 'x'); await expect(field).toHaveValue(limit + 'x'); await expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(await page.evaluate(() => window.notebookFixture.state().runtime.game!.notebook.personalNotes)).toBe(limit);
    await page.evaluate(() => window.notebookFixture.refresh()); await expect(field).toHaveValue(limit + 'x'); await expect(field).toBeFocused();
    await field.fill('<img src=x onerror="throw 1"> notes'); await field.press('Escape'); await expect(notebook()).toBeHidden(); await expect(button('Notebook')).toBeFocused();
    await button('Notebook').click(); await expect(field).toHaveValue('<img src=x onerror="throw 1"> notes'); await expect(notebook().locator('img')).toHaveCount(0);
  });

  test('actual copper inspection shows source, preserves stale result, and adds a fresh result after a path change', async () => {
    await button('Look at power indication').click(); await button('Look at link indication').click();
    await button('Use').click(); await button('Inspect physical path').press('Enter'); await button('Notebook').click();
    const evidence = region('Evidence'); await expect(evidence).toContainText('Freshness: current'); await expect(evidence).toContainText('Source: The Arrival Lift');
    await expect(evidence).toContainText('Power indication does not prove a data link'); await expect(evidence).toContainText('Channel length: 105 m');
    const before = await evidence.getByText(/^Observed result:/).innerText(); await button('Close notebook').click();
    await button('Change physical path').tap(); await button('Notebook').click(); await expect(evidence).toContainText('Freshness: stale');
    await expect(evidence.getByText(/^Observed result:/)).toHaveText(before); await button('Close notebook').click();
    await button('Inspect physical path').click(); await button('Notebook').click();
    await expect(evidence.getByRole('heading', { name: 'Physical inspection', exact: true })).toHaveCount(2);
    await expect(evidence).toContainText('Channel length: 95 m'); await expect(evidence).toContainText('Freshness: current'); await expect(evidence).toContainText('length only');
  });

  test('known endpoint and ordered path lists, hypothesis distinction, visited maps and notes survive room travel', async () => {
    await page.evaluate(() => window.notebookFixture.travel('R02'));
    await button('Identify known-good endpoints').click(); await button('Identify physical path under test').click(); await button('Notebook').click();
    expect(await region('Evidence').getByRole('list', { name: 'Known-good endpoints', exact: true }).getByRole('listitem').allTextContents()).toEqual(['Lift Sender A — known good', 'Workshop Receiver B — known good']);
    expect(await region('Evidence').getByRole('list', { name: 'Physical path under test', exact: true }).getByRole('listitem').allTextContents()).toEqual(['Lift Sender A', 'selected training conduit', 'workshop patch lead', 'Workshop Receiver B']);
    const text = '<b>Perhaps the conduit?</b> 🧵 I can inspect it.';
    const hypothesis = page.locator(`#${hypothesisId}`);
    expect(await hypothesis.evaluate(field => ({ tag: field.tagName, labels: [...(field as HTMLTextAreaElement).labels].map(label => label.textContent) }))).toEqual({ tag: 'TEXTAREA', labels: ['Hypothesis'] });
    await hypothesis.focus(); await expect(hypothesis).toBeFocused(); await hypothesis.fill(text); await button('Pin hypothesis').press('Space');
    await expect(region('Hypotheses')).toContainText(text); await expect(region('Hypotheses')).toContainText('Player hypothesis'); await expect(region('Evidence')).not.toContainText(text);
    await notes().fill('Retained <script>text</script>'); await button('Pin objective: Read the silent link in R01').click();
    await button('Highlight The Arrival Lift').click(); expect(await page.evaluate(() => window.notebookFixture.state().runtime.game!.world.roomId)).toBe('spec001:R02');
    await button('Close notebook').click(); await page.evaluate(() => window.notebookFixture.travel('R01')); await button('Notebook').click();
    await expect(notes()).toHaveValue('Retained <script>text</script>'); await expect(region('Hypotheses')).toContainText(text); await expect(region('Objectives')).toContainText('Pinned');
    await expect(region('Maps').getByRole('listitem')).toHaveCount(2); await expect(notebook().locator('script,b')).toHaveCount(0);
  });

  test('composition retains input until commit and equal-version invalidation rejects the original DOM after status redraw', async () => {
    await button('Notebook').click(); await notes().focus();
    await notes().evaluate(node => { const field = node as HTMLTextAreaElement; field.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); field.value = '日本語🧵'; field.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true })); });
    expect(await page.evaluate(() => window.notebookFixture.state().runtime.game!.notebook.personalNotes)).toBe('');
    await notes().evaluate(node => node.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
    expect(await page.evaluate(() => window.notebookFixture.state().runtime.game!.notebook.personalNotes)).toBe('日本語🧵'); await expect(notes()).toBeFocused();
    const before = await page.evaluate(() => { const fixture = window.notebookFixture; const before = fixture.state(); fixture.invalidate(); fixture.refresh(); return before; });
    await notes().fill('late old DOM'); expect(await page.evaluate(() => window.notebookFixture.results.at(-1)?.reason)).toBe('invalidated');
    expect(await page.evaluate(() => window.notebookFixture.state())).toEqual(before);
    await page.evaluate(() => window.notebookFixture.restore()); await button('Notebook').click(); await expect(notes()).toHaveValue('');
  });

  test('native labels and five notebook regions remain accessible at narrow width', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await button('Notebook').click();
    const result = await new AxeBuilder({ page }).include('[role="dialog"][aria-label="Notebook"]').analyze(); expect(result.violations).toEqual([]);
    expect(await notes().evaluate(field => ({ tag: field.tagName, labels: [...(field as HTMLTextAreaElement).labels].map(label => label.textContent) }))).toEqual({ tag: 'TEXTAREA', labels: ['Personal notes'] });
    await notes().focus(); await notes().fill('Readable 🧵 notes'); await expect(notes()).toBeFocused();
    await page.screenshot({ path: 'test-results/t027-notebook-mobile.png', fullPage: true });
  });
});
