// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { test, expect, firefox } from '@playwright/test';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import fixture from '../fixtures/guest-investigation.json' with { type: 'json' };
import { localTls } from './support/local-tls';

/**
 * T022 tests first: every case drives the actual app from a fresh unsigned-in
 * profile. No fixture mounting, game-state injection, test-only app hooks or
 * evaluator-generated expected answers. Labels are the documented integration
 * vocabulary in the fixture; review their binding during T023–T029.
 *
 * T030 activates all nine independently prepared journeys against the joined
 * application. Fixture facts and behavioral assertions remain unchanged.
 */
const ui = fixture.ui;
// T030 reviewed binding: the actual T025 control capitalizes Inventory.
// Keep the independently prepared fixture and every required action unchanged.
const action = { ...ui.actions, closeInventory: 'Close Inventory' };
const arrival = fixture.world.rooms[0]!.name;
const workshop = fixture.world.rooms[1]!.name;
const o01 = fixture.world.objectives[0]!.name;
const o02 = fixture.world.objectives[1]!.name;
type Input = 'pointer' | 'keyboard';

test.describe('T030 real guest walkthrough — independent T022 expectations', () => {
  test.describe.configure({ mode: 'default' });
  let local: Awaited<ReturnType<typeof localTls>>;
  let context: BrowserContext;
  let page: Page;
  let externalRequests: string[];
  let saveWrites: string[];
  let apiWrites: string[];
  let pageErrors: string[];
  let sectionIds: Record<string, string>;

  test.beforeEach(async () => {
    // Each case gets an empty browser profile, including cookies/storage. This
    // uses disposable NSS trust; no system trust or ignoreHTTPS exception.
    local = await localTls();
    try { context = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false }); }
    catch (error) { await local.stop(); throw error; }
    page = await context.newPage();
    externalRequests = [];
    saveWrites = [];
    apiWrites = [];
    pageErrors = [];
    context.on('page', opened => opened.on('pageerror', error => pageErrors.push(error.message)));
    page.on('pageerror', error => pageErrors.push(error.message));
    context.on('request', request => {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.origin !== new URL(local.url).origin) externalRequests.push(request.url());
      if (url.pathname.endsWith('/api/v1/save') && ['PUT', 'POST', 'PATCH', 'DELETE'].includes(request.method())) saveWrites.push(request.method());
      if (url.pathname.includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) apiWrites.push(`${request.method()} ${url.pathname}`);
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    expect((await page.goto(local.url))?.status()).toBe(200);
  });
  test.afterEach(async () => {
    try { await context?.close(); } finally { await local?.stop(); }
    expect(pageErrors).toEqual([]);
    expect(apiWrites).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const notebook = () => page.getByRole('dialog', { name: 'Notebook', exact: true });
  // Resolve the native section/heading relation at startup. Recursive region
  // accessible-name lookup also crashes Firefox when reading nested lists.
  const section = (name: string) => page.locator(`section[aria-labelledby="${sectionIds[name]}"]`);
  const evidence = (name: string) => section('Evidence').getByRole('listitem').filter({ has: page.getByRole('heading', { name, exact: true }) });
  const objective = (name: string) => section('Objectives').getByRole('listitem').filter({ hasText: name });

  async function activate(control: Locator, input: Input = 'pointer') {
    await expect(control).toBeVisible();
    await expect(control).toBeEnabled();
    if (input === 'keyboard') { await control.focus(); await control.press('Enter'); }
    else await control.click();
  }
  async function verb(name: 'Walk' | 'Look' | 'Talk' | 'Use', input: Input = 'pointer') {
    if (input === 'keyboard') {
      await button(name).focus();
      await page.keyboard.press(ui.shortcuts[name].toLowerCase());
    } else await activate(button(name));
    await expect(button(name)).toHaveAttribute('aria-pressed', 'true');
  }
  async function start(input: Input = 'pointer') {
    await activate(button(action.newAdventure), input);
    await expect(page.getByRole('heading', { name: arrival, exact: true })).toBeVisible();
    const sections = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-label="Notebook"] > section')].map(element => {
      const id = element.getAttribute('aria-labelledby')!, heading = document.getElementById(id);
      return { tag: element.tagName, headingTag: heading?.tagName, name: heading?.textContent, id };
    }));
    expect(sections.map(({ tag, headingTag, name }) => ({ tag, headingTag, name }))).toEqual(ui.notebookSections.map(name => ({ tag: 'SECTION', headingTag: 'H3', name })));
    expect(sections.every(entry => !!entry.id)).toBe(true);
    expect(new Set(sections.map(entry => entry.id)).size).toBe(ui.notebookSections.length);
    sectionIds = Object.fromEntries(sections.map(entry => [entry.name!, entry.id]));
    for (const name of ui.verbs) await expect(button(name)).toBeVisible();
    await expect(page.getByRole('textbox', { name: /API key|password|email/i })).toHaveCount(0);
  }
  async function openNotebook(input: Input = 'pointer') {
    await activate(button('Notebook'), input);
    await expect(notebook()).toBeVisible();
  }
  async function closeNotebook(input: Input = 'pointer') {
    await activate(notebook().getByRole('button', { name: action.closeNotebook, exact: true }), input);
    await expect(notebook()).toBeHidden();
  }
  async function completeDialogue(skip: boolean, input: Input = 'pointer') {
    const dialogue = page.getByRole('dialog', { name: 'Dialogue', exact: true });
    await expect(dialogue).toBeVisible();
    if (skip) await activate(dialogue.getByRole('button', { name: action.skip, exact: true }), input);
    else {
      // Bounded actual presentation traversal; never assume a completed state
      // or silently stop when a required control is absent.
      let finished = false;
      for (let line = 0; line < 32; line += 1) {
        const finish = dialogue.getByRole('button', { name: action.finish, exact: true });
        if (await finish.isVisible()) { await activate(finish, input); finished = true; break; }
        await activate(dialogue.getByRole('button', { name: action.next, exact: true }), input);
      }
      expect(finished, 'Introductory dialogue must expose a finish action within 32 lines.').toBe(true);
    }
    await expect(dialogue).toBeHidden();
  }
  async function talk(target: string, skip = false, input: Input = 'pointer') {
    await verb('Talk', input); await activate(button(target), input); await completeDialogue(skip, input);
  }
  async function inspect(input: Input = 'pointer') {
    await verb('Use', input); await activate(button(action.inspect), input);
    await expect(page.getByRole('status')).toHaveText(ui.text.validInspection);
  }
  async function observeIndicators(input: Input = 'pointer') {
    await verb('Look', input);
    await activate(button(action.power), input);
    await activate(button(action.link), input);
  }
  async function assertIndicators() {
    await expect(evidence(ui.evidence.power)).toHaveCount(1);
    await expect(evidence(ui.evidence.link)).toHaveCount(1);
    await expect(evidence(ui.evidence.power)).toContainText(ui.text.powerCaveat);
    // Independently reviewed C-PWR-OBS supplies power on / link off.
    await expect(evidence(ui.evidence.power)).toContainText(ui.text.powerCondition);
    await expect(evidence(ui.evidence.link)).toContainText(ui.text.linkCondition);
    await expect(evidence(ui.evidence.link)).toContainText(ui.text.serviceNotProven);
    for (const name of [ui.evidence.power, ui.evidence.link]) {
      await expect(evidence(name)).toContainText(`Source: ${arrival}`);
      await expect(evidence(name)).toContainText(ui.text.observation);
    }
  }
  async function finishO01(skip = false, input: Input = 'pointer') {
    await observeIndicators(input); await talk(action.photon, skip, input); await inspect(input);
    await openNotebook(input); await assertIndicators();
    await expect(objective(o01)).toHaveCount(1);
    await expect(objective(o01)).toContainText(ui.text.completed);
    await closeNotebook(input);
  }
  async function walk(target: string, name: string, input: Input = 'pointer') {
    await verb('Walk', input); await activate(button(target), input);
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  async function briefing(skip = false, input: Input = 'pointer') {
    await walk(action.toWorkshop, workshop, input); await talk(action.titan, skip, input);
    await verb('Look', input);
    await activate(button(action.endpoints), input); await activate(button(action.path), input);
  }
  async function assertDeclaredPath() {
    // Firefox's recursive role/name list lookup crashes in this nested notebook
    // (initial T030 run; same native issue as T027). Native UL/OL retain their
    // implicit list semantics; select the exact authored accessible label and
    // direct LI children without changing any count, content or order assertion.
    const endpoints = section('Evidence').locator(`ul[aria-label="${ui.evidence.endpoints}"] > li`);
    await expect(endpoints).toHaveCount(2);
    const declared = await endpoints.allTextContents();
    for (const value of declared) expect(value).toMatch(/^\S.+ — known good$/);
    const names = declared.map(value => value.replace(/ — known good$/, ''));
    expect(new Set(names).size).toBe(2);
    const path = section('Evidence').locator(`ol[aria-label="${ui.evidence.path}"] > li`);
    const parts = await path.allTextContents();
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts[0]).toBe(names[0]); expect(parts.at(-1)).toBe(names[1]);
    expect(parts.every(value => value.trim().length > 0)).toBe(true);
    await expect(evidence(ui.evidence.path)).toContainText(`Source: ${workshop}`);
  }
  async function pinHypothesis(input: Input = 'pointer') {
    await section('Hypotheses').getByRole('textbox', { name: 'Hypothesis', exact: true }).fill(fixture.playerInput.hypothesis);
    await activate(section('Hypotheses').getByRole('button', { name: action.pin, exact: true }), input);
    await expect(section('Hypotheses')).toContainText(fixture.playerInput.hypothesis);
    await expect(section('Hypotheses')).toContainText(ui.text.pinned);
    await expect(section('Evidence')).not.toContainText(fixture.playerInput.hypothesis);
    await expect(objective(o02)).toHaveCount(1);
    await expect(objective(o02)).toContainText(ui.text.completed);
  }
  async function finishO02(skip = false, input: Input = 'pointer', declineInvitation = true) {
    await briefing(skip, input); await openNotebook(input); await assertDeclaredPath();
    await pinHypothesis(input); await closeNotebook(input);
    const invitation = page.getByRole('dialog', { name: 'Sign in to save', exact: true });
    await expect(invitation).toBeVisible();
    if (declineInvitation) {
      await activate(invitation.getByRole('button', { name: action.decline, exact: true }), input);
      await expect(invitation).toBeHidden();
    }
  }
  async function inventory() {
    await activate(button('Inventory'));
    const panel = page.getByRole('dialog', { name: 'Inventory', exact: true });
    await expect(panel).toBeVisible();
    const rows = panel.getByRole('list', { name: 'Inventory items', exact: true }).getByRole('listitem');
    for (const row of await rows.all()) await expect(row.getByText(/^Quantity: [1-9][0-9]*$/)).toBeVisible();
    const entries = await rows.allTextContents();
    await activate(panel.getByRole('button', { name: action.closeInventory, exact: true }));
    return entries;
  }
  async function progress() {
    await openNotebook();
    const result = {
      objectives: await section('Objectives').getByRole('listitem').allTextContents(),
      // Sources/conditions are compared, not freshness: movement may invalidate
      // measurements. Required evidence identity/count is checked separately.
      clues: await section('Evidence').getByRole('heading').allTextContents(),
    };
    await closeNotebook();
    return result;
  }

  test('GI01 Fresh New Adventure enters R01 as a guest', async () => {
    await start();
    for (const [name, key] of Object.entries(ui.shortcuts)) await expect(button(name)).toHaveAttribute('aria-keyshortcuts', key);
    await expect(page.getByText(ui.text.guestStatus, { exact: true })).toBeVisible();
    expect(externalRequests).toEqual([]); expect(saveWrites).toEqual([]);
  });

  test('GI02 O01 requires separate power/link observations and valid inspection', async () => {
    await start(); await verb('Look'); await activate(button(action.power));
    await openNotebook();
    await expect(evidence(ui.evidence.power)).toHaveCount(1);
    await expect(evidence(ui.evidence.link)).toHaveCount(0);
    await expect(objective(o01)).not.toContainText(ui.text.completed);
    await closeNotebook(); await activate(button(action.link)); await talk(action.photon);
    await openNotebook(); await assertIndicators();
    await expect(objective(o01)).not.toContainText(ui.text.completed); await closeNotebook();
    await inspect(); await openNotebook();
    await expect(evidence(ui.evidence.inspection)).toHaveCount(1);
    await expect(evidence(ui.evidence.inspection)).toContainText(ui.text.current);
    await expect(evidence(ui.evidence.inspection)).toContainText(`Source: ${arrival}`);
    await expect(objective(o01)).toContainText(ui.text.completed);
  });

  test('GI03 R02 O02 requires endpoints, declared path and a pinned hypothesis', async () => {
    await start(); await finishO01();
    await walk(action.toWorkshop, workshop); await talk(action.titan);
    await openNotebook(); await expect(objective(o02)).not.toContainText(ui.text.completed); await closeNotebook();
    await verb('Look'); await activate(button(action.endpoints)); await activate(button(action.path));
    await openNotebook(); await assertDeclaredPath(); await assertIndicators();
    await expect(objective(o02)).not.toContainText(ui.text.completed);
    await pinHypothesis();
  });

  test('GI04 Evidence, pinned hypothesis and plain-text notes travel both ways', async () => {
    await start(); await finishO01(); await finishO02(); await openNotebook();
    for (const name of ui.notebookSections) await expect(section(name)).toBeVisible();
    const notes = section('Personal Notes').getByRole('textbox', { name: 'Personal notes', exact: true });
    await notes.fill(fixture.playerInput.note); await closeNotebook();
    await walk(action.toArrival, arrival); await openNotebook(); await assertIndicators();
    await expect(notes).toHaveValue(fixture.playerInput.note);
    await expect(section('Hypotheses')).toContainText(fixture.playerInput.hypothesis);
    await expect(section('Hypotheses')).toContainText(ui.text.pinned);
    await expect(section('Personal Notes').locator('b')).toHaveCount(0);
    await closeNotebook(); await walk(action.toWorkshop, workshop); await openNotebook();
    await assertIndicators(); await expect(notes).toHaveValue(fixture.playerInput.note);
    await expect(objective(o01)).toHaveCount(1); await expect(objective(o02)).toHaveCount(1);
    await expect(objective(o01)).toContainText(ui.text.completed); await expect(objective(o02)).toContainText(ui.text.completed);
  });

  test('GI05 Skipping clue dialogue leaves evidence and objectives obtainable', async () => {
    await start(); await finishO01(true); await finishO02(true); await openNotebook();
    await assertIndicators(); await assertDeclaredPath();
    await expect(evidence(ui.evidence.photonClue)).toHaveCount(1);
    await expect(evidence(ui.evidence.photonClue)).toContainText(ui.text.powerCaveat);
    await expect(evidence(ui.evidence.photonClue)).toContainText(`Source: ${arrival}`);
    await expect(evidence(ui.evidence.titanClue)).toHaveCount(1);
    await expect(evidence(ui.evidence.titanClue)).toContainText(ui.text.scopeClue);
    await expect(evidence(ui.evidence.titanClue)).toContainText(`Source: ${workshop}`);
    await expect(objective(o01)).toContainText(ui.text.completed); await expect(objective(o02)).toContainText(ui.text.completed);
  });

  test('GI06 Replay preserves clues without duplicate items or objective rewards', async () => {
    await start(); await finishO01(); await finishO02();
    const before = await progress(); const beforeItems = await inventory();
    expect(beforeItems.length, 'Exercise the real introductory inventory; an empty inventory cannot prove reward retention.').toBeGreaterThan(0);
    expect(before.clues).toContain(ui.evidence.photonClue); expect(before.clues).toContain(ui.evidence.titanClue);
    // Baselines describe retention, never correctness. O01/O02 and their
    // independent required evidence were asserted before taking these snapshots.
    for (let repetition = 0; repetition < 2; repetition += 1) {
      await activate(button(action.replay)); await completeDialogue(repetition === 0);
      await walk(action.toArrival, arrival); await talk(action.photon);
      await activate(button(action.replay)); await completeDialogue(repetition === 0);
      await walk(action.toWorkshop, workshop); await talk(action.titan);
    }
    expect(await inventory()).toEqual(beforeItems);
    expect(await progress()).toEqual(before);
    await openNotebook(); await assertIndicators(); await assertDeclaredPath();
    await expect(objective(o01)).toHaveCount(1); await expect(objective(o02)).toHaveCount(1);
  });

  test('GI07 A real path change retains stale inspection until remeasurement', async () => {
    await start(); await finishO01(); await openNotebook();
    const readings = evidence(ui.evidence.inspection);
    await expect(readings).toHaveCount(1); await expect(readings).toContainText(ui.text.current);
    const original = await readings.getByText(/^Observed result:/).innerText();
    await closeNotebook(); await verb('Use'); await activate(button(action.changePath));
    await openNotebook(); await expect(readings).toHaveCount(1);
    await expect(readings).toContainText(ui.text.stale);
    await expect(readings.getByText(/^Observed result:/)).toHaveText(original);
    await expect(readings.filter({ hasText: ui.text.current })).toHaveCount(0);
    await closeNotebook(); await inspect(); await openNotebook();
    await expect(readings).toHaveCount(2);
    await expect(readings.filter({ hasText: ui.text.stale }).getByText(/^Observed result:/)).toHaveText(original);
    await expect(readings.filter({ hasText: ui.text.current })).toHaveCount(1);
    await expect(readings.filter({ hasText: ui.text.current })).toContainText(`Source: ${arrival}`);
  });

  test('GI08 Declining sign-in continues session play without durable saving', async () => {
    await start(); await finishO01(); await finishO02(false, 'pointer', false);
    const invitation = page.getByRole('dialog', { name: 'Sign in to save', exact: true });
    await expect(invitation).toBeVisible();
    await expect(invitation).toContainText(ui.text.signInExplanation);
    await activate(invitation.getByRole('button', { name: action.decline, exact: true }));
    await expect(invitation).toBeHidden();
    await expect(page.getByText(ui.text.guestStatus, { exact: true })).toBeVisible();
    await openNotebook();
    await section('Personal Notes').getByRole('textbox', { name: 'Personal notes', exact: true }).fill(fixture.playerInput.note);
    await closeNotebook(); await walk(action.toArrival, arrival); await walk(action.toWorkshop, workshop); await openNotebook();
    await expect(section('Personal Notes').getByRole('textbox', { name: 'Personal notes', exact: true })).toHaveValue(fixture.playerInput.note);
    await expect(objective(o02)).toContainText(ui.text.completed);
    await expect(page.getByText(/^(Saved|Saving|Saved at\b|Adventure saved|Progress saved)/i)).toHaveCount(0);
    expect(saveWrites).toEqual([]); expect(externalRequests).toEqual([]);
    expect(context.pages().filter(value => value.url() !== 'about:blank')).toEqual([page]);
  });

  test('GI09 Keyboard follows the same four-verb investigation', async () => {
    await start('keyboard'); await finishO01(false, 'keyboard'); await finishO02(false, 'keyboard');
    for (const [name, key] of Object.entries(ui.shortcuts)) await expect(button(name)).toHaveAttribute('aria-keyshortcuts', key);
    await button('Notebook').focus(); await page.keyboard.press('n'); await expect(notebook()).toBeVisible();
    const notes = section('Personal Notes').getByRole('textbox', { name: 'Personal notes', exact: true });
    await notes.pressSequentially('wl tuin c'); await expect(notes).toHaveValue('wl tuin c'); await expect(notes).toBeFocused();
    await expect(objective(o01)).toContainText(ui.text.completed); await expect(objective(o02)).toContainText(ui.text.completed);
    await closeNotebook('keyboard');
    expect(externalRequests).toEqual([]); expect(saveWrites).toEqual([]);
  });
});
