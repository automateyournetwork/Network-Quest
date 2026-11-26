// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { expect, firefox, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { localTls } from './support/local-tls';
import type { ActionResult } from '../../src/ui/action-bus';
import type { PacketJourneyView } from '../../src/ui/packet-journey';

declare global { interface Window { packetFixture: {
  view(): PacketJourneyView; results: ActionResult[]; closed: string[]; canceled(): number;
  refresh(): void; invalidate(): void; replace(): void; stale(): void; scenario(fail: boolean, substitution: boolean): void;
  literal(): void; hidden(value: boolean): void; motion(value: boolean): void; disposePanel(): void; detachPanel(): void;
} } }
const read = async (path: string) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
const authored = await read('tests/fixtures/packet-journey.json'), source = await read('content/spec001/sources.json'), contextData = await read('content/spec001/packet-context.json');

test.describe('T033 isolated native packet controls with real copper/domain over trusted HTTPS', () => {
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
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(async ({ base, authored, source, contextData }) => {
      const { createActionBus } = await import(`${base}src/ui/action-bus.ts`) as typeof import('../../src/ui/action-bus');
      const { createPacketJourneyController, createPacketJourneyPanel } = await import(`${base}src/ui/packet-journey.ts`) as typeof import('../../src/ui/packet-journey');
      const { evaluateCopper } = await import(`${base}src/domain/copper.ts`) as typeof import('../../src/domain/copper');
      type Binding = import('../../src/ui/packet-journey').PacketJourneyBinding;
      const make = (fail: boolean, substitution: boolean): Binding => {
        const version = { configurationRevision: 7, attemptId: 'attempt-a' } as import('../../src/domain/types').WorldVersion;
        const physical = authored.physicalChallenges[fail ? 'failing-length' : 'passing-length'];
        const profile = source.profiles.find((p: {id: string}) => p.id === physical.profileId);
        const result = evaluateCopper({ kind: physical.kind, profile: { id: profile.id, parameters: profile.parameters }, lengths: physical.lengths },
          { actionId: crypto.randomUUID() as import('../../src/domain/types').ActionId, expectedVersion: version, input: { kind: 'measure-length' } }, version);
        return { identity: {}, context: { adventureId: 'packet-native' as import('../../src/domain/types').AdventureId, ...version },
          challenge: { packetProfile: authored.reviewedContext.profiles.find((p: {id: string}) => p.id === 'spec001:PROFILE-PACKET'),
            symbolProfile: authored.reviewedContext.profiles.find((p: {id: string}) => p.id === 'spec001:PROFILE-SYMBOLS'), bench: authored.assumptions.completeBench,
            impairment: substitution ? authored.assumptions.substitution : null },
          world: { ...version, physicalEvidence: { result, evaluatedVersion: version, stale: false } } };
      };
      let binding = make(false, false), canceled = 0;
      let reducedMotion: boolean | undefined;
      const bus = createActionBus({ getContext: () => binding.context }), closed: string[] = [];
      const controller = createPacketJourneyController({ bus, context: contextData, read: () => binding, onClose: reason => { closed.push(reason); } });
      const main = document.createElement('main'), heading = document.createElement('h1'), opener = document.createElement('button');
      heading.textContent = 'Packet controls verification'; opener.type = 'button'; opener.textContent = 'Inspect test message';
      main.append(heading, opener); document.body.replaceChildren(main);
      const panel = createPacketJourneyPanel(main, { dispatch: action => bus.dispatch(action), cancel: action => { const out = bus.cancel(action); if (out) canceled++; return out; } }, { reducedMotion: () => reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches });
      const refresh = () => { const p = controller.project(); panel.render(p.view, p.capture); };
      const results: ActionResult[] = []; bus.subscribe((_action, result) => { results.push(result); refresh(); });
      opener.addEventListener('click', () => { controller.open(); refresh(); }); refresh();
      window.packetFixture = { view: () => controller.project().view, results, closed, canceled: () => canceled, refresh,
        invalidate: () => { bus.invalidate(); refresh(); }, replace: () => { binding = { ...binding, identity: {} }; refresh(); },
        stale: () => { binding = { ...binding, world: { ...binding.world, physicalEvidence: { ...binding.world.physicalEvidence!, stale: true } } }; refresh(); },
        scenario: (fail, substitution) => { controller.invalidate(); bus.invalidate(); binding = make(fail, substitution); refresh(); },
        literal: () => { const p = controller.project(); panel.render({ ...p.view, context: { ...p.view.context, payload: '<img src=x onerror="throw new Error(1)"> literal payload text' } }, p.capture); },
        hidden: value => { Object.defineProperty(document, 'hidden', { configurable: true, value }); document.dispatchEvent(new Event('visibilitychange')); },
        motion: value => { reducedMotion = value; refresh(); }, disposePanel: () => panel.dispose(), detachPanel: () => panel.element.remove(),
      };
    }, { base: local.url, authored, source, contextData });
  });
  test.afterEach(async () => { await page?.close(); });
  const dialog = () => page.getByRole('dialog', { name: 'Packet journey', exact: true });
  const open = () => page.getByRole('button', { name: 'Inspect test message' }).click();
  const step = () => dialog().getByRole('button', { name: 'Step journey', exact: true });

  test('native keyboard, pointer and touch inspect literal NQ phases and replay without awards', async () => {
    await page.getByRole('button', { name: 'Inspect test message' }).press('Enter');
    await expect(dialog()).toContainText('0x4E 0x51: 01001110 01010001 (NQ)');
    await step().press('Space'); await expect(dialog().getByRole('heading')).toContainText('encode');
    await step().tap(); await expect(dialog().getByRole('heading')).toContainText('transmit');
    await step().click(); await expect(dialog()).toContainText('Recovered bits: 01001110 01010001');
    await step().press('Enter'); await expect(dialog()).toContainText('Known highlighted pattern matches');
    const result = await page.evaluate(() => window.packetFixture.view().result);
    expect(result?.acceptedEffects).toEqual([]); expect(result?.observations[0]).toMatchObject({ transmissionSucceeded: true, progressAward: 0 });
    await dialog().getByRole('button', { name: 'Replay journey' }).press('Enter'); await expect(dialog().getByRole('heading')).toContainText('payload');
    expect(await page.evaluate(() => window.packetFixture.view().paused)).toBe(true);
  });

  test('declared mismatch and failed path without a trace use actual physical results', async () => {
    for (const substitution of [true, false]) {
      await page.evaluate(value => window.packetFixture.scenario(true, value), substitution); await open();
      for (let i = 0; i < 4; i++) await step().click();
      await expect(dialog()).toContainText('Length only: 105 m');
      if (substitution) {
        await expect(dialog()).toContainText('Declared toy substitution applied at position 7: −1 → −3');
        await expect(dialog()).toContainText('Recovered bits: 01001110 01010000');
        await expect(dialog()).toContainText('Recovered highlighted bytes: 0x4E 0x50. Differing bits: 1. Zero-based mismatch positions: 15.');
      } else { await expect(dialog()).toContainText('No received trace is available'); await expect(dialog()).not.toContainText('Recovered highlighted bytes:'); }
      expect(await page.evaluate(() => window.packetFixture.view().result?.observations[0]?.transmissionSucceeded)).toBe(false);
    }
  });

  test('actual preview timeout is canceled on pause, redraw, replay and disposal; manual step stays available', async () => {
    await page.clock.install(); await open();
    await dialog().getByRole('button', { name: 'Play preview' }).click(); await page.clock.runFor(1500);
    await expect(dialog().getByRole('heading')).toContainText('encode');
    await dialog().getByRole('button', { name: 'Pause journey' }).click(); await page.clock.runFor(9000);
    await expect(dialog().getByRole('heading')).toContainText('encode'); await step().press('Enter');
    expect(await page.evaluate(() => window.packetFixture.view().paused)).toBe(true);
    await dialog().getByRole('button', { name: 'Replay journey' }).click();
    await dialog().getByRole('button', { name: 'Play preview' }).click(); await page.clock.runFor(1000);
    await page.evaluate(() => window.packetFixture.refresh()); await page.clock.runFor(1000); await expect(dialog().getByRole('heading')).toContainText('payload');
    await page.clock.runFor(500); await expect(dialog().getByRole('heading')).toContainText('encode');
    await dialog().getByRole('button', { name: 'Replay journey' }).click(); await page.clock.runFor(9000); await expect(dialog().getByRole('heading')).toContainText('payload');
    await dialog().getByRole('button', { name: 'Play preview' }).click(); await page.evaluate(() => window.packetFixture.disposePanel()); await page.clock.runFor(9000);
    expect(await page.evaluate(() => window.packetFixture.view().phase)).toBe('payload'); expect(await page.evaluate(() => window.packetFixture.canceled())).toBeGreaterThanOrEqual(4);
  });

  test('detached panels cannot deliver their captured preview step', async () => {
    await page.clock.install(); await open(); await dialog().getByRole('button', { name: 'Play preview' }).click();
    await page.evaluate(() => window.packetFixture.detachPanel()); await page.clock.runFor(9000);
    expect(await page.evaluate(() => window.packetFixture.view().phase)).toBe('payload');
    expect(await page.evaluate(() => window.packetFixture.canceled())).toBe(1);
  });

  test('hidden notification and native reduced-motion changes cancel preview and require explicit restart', async () => {
    await page.clock.install(); await open(); await dialog().getByRole('button', { name: 'Play preview' }).click();
    await page.evaluate(() => window.packetFixture.hidden(true)); await page.clock.runFor(9000);
    expect(await page.evaluate(() => window.packetFixture.view().paused)).toBe(true);
    await page.evaluate(() => { window.packetFixture.hidden(false); window.packetFixture.refresh(); }); await page.clock.runFor(9000);
    await expect(dialog().getByRole('heading')).toContainText('payload');
    await dialog().getByRole('button', { name: 'Play preview' }).click(); await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(dialog().getByRole('button', { name: 'Play preview' })).toBeDisabled(); await page.clock.runFor(9000);
    await expect(dialog().getByRole('heading')).toContainText('payload'); await step().press('Enter'); await expect(dialog().getByRole('heading')).toContainText('encode');
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await expect(dialog().getByRole('button', { name: 'Play preview' })).toBeEnabled(); await page.clock.runFor(9000);
    await expect(dialog().getByRole('heading')).toContainText('encode');
    await dialog().getByRole('button', { name: 'Play preview' }).click(); await page.evaluate(() => window.packetFixture.motion(true));
    await expect(dialog().getByRole('button', { name: 'Play preview' })).toBeDisabled(); await page.clock.runFor(9000);
    await expect(dialog().getByRole('heading')).toContainText('encode');
    await page.evaluate(() => window.packetFixture.motion(false)); await page.clock.runFor(9000);
    await expect(dialog().getByRole('button', { name: 'Play preview' })).toBeEnabled();
    await expect(dialog().getByRole('heading')).toContainText('encode');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await expect(dialog().getByRole('button', { name: 'Play preview' })).toBeEnabled();
    await page.clock.runFor(9000); await expect(dialog().getByRole('heading')).toContainText('encode');
    await dialog().getByRole('button', { name: 'Play preview' }).click(); await page.clock.runFor(1500);
    await expect(dialog().getByRole('heading')).toContainText('transmit');
  });

  test('literal text, 44px controls, focus retention, narrow layout and semantic tables remain usable', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await open();
    await step().focus(); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; window.packetFixture.refresh(); }); await expect(step()).toBeFocused();
    for (const button of await dialog().getByRole('button').all()) { const box = await button.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44); }
    await expect(dialog().getByRole('table', { name: 'Seven-realm context' })).toBeVisible(); await expect(dialog()).toContainText('Future content — context only');
    await page.evaluate(() => window.packetFixture.literal()); await expect(dialog()).toContainText('<img src=x'); await expect(dialog().locator('img')).toHaveCount(0);
    const result = await new AxeBuilder({ page }).include('[role="dialog"]').analyze(); expect(result.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await dialog().press('Escape'); await expect(dialog()).toBeHidden(); await expect(page.getByRole('button', { name: 'Inspect test message' })).toBeFocused();
  });

  test('stale evidence, old DOM epochs and same-version replacement cannot display cached success', async () => {
    await open(); for (let i = 0; i < 4; i++) await step().click(); await page.evaluate(() => window.packetFixture.stale());
    await expect(dialog()).toContainText('unavailable or stale'); await expect(dialog()).not.toContainText('Known highlighted pattern matches');
    await dialog().getByRole('button', { name: 'Replay journey' }).click(); expect(await page.evaluate(() => window.packetFixture.view().result?.status)).toBe('invalid-input');
    await page.evaluate(() => window.packetFixture.invalidate()); await dialog().getByRole('button', { name: 'Replay journey' }).click();
    expect(await page.evaluate(() => window.packetFixture.results.at(-1)?.reason)).toBe('invalidated');
    await page.evaluate(() => window.packetFixture.replace()); await expect(dialog()).toBeHidden();
  });
});
