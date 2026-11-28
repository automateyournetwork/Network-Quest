// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { Page, Route } from '@playwright/test';
import fixture from '../fixtures/migrations/spec001.json' with { type: 'json' };
import { arrival, balcony, historicalBytes } from '../fixtures/migrations/spec001-cases';
import { clickButton, closeFrame, openFrame } from './support/adventure-controls';
import { button, dialog, expect, installCookie, test, type Journey } from './support/t056-journey';

const endpoint = '**/api/v1/save';
const priorRevision = fixture.persistence.priorRevision;
const currentRevision = fixture.persistence.eligibleManualSave.storageRevision;
type RecordCase = typeof arrival | typeof balcony;

function responseFor(page: Page, method: 'GET' | 'PUT') {
  return page.waitForResponse(response => response.url().endsWith('/api/v1/save') && response.request().method() === method);
}

async function seed(j: Journey, record: RecordCase) {
  const prior = record.prior, raw = historicalBytes(prior);
  await j.local.seedMigrationSlot({ raw, revision: priorRevision, schemaVersion: prior.saveSchemaVersion,
    contentVersion: prior.contentVersion, adventureId: prior.adventureId, roomId: prior.world.roomId, outcome: prior.world.continueOutcome });
  await j.page.reload();
  await expect(button(j.page, 'Continue')).toHaveAttribute('aria-disabled', 'false');
  expect(await j.local.inspectSlot()).toMatchObject({ revision: priorRevision, raw });
  return raw;
}

async function expectGet(page: Page, action: 'Continue' | 'Restore Save' | 'Save', raw: string, revision = priorRevision) {
  const pending = responseFor(page, 'GET');
  await clickButton(page, action);
  const response = await pending;
  expect(response.status()).toBe(200);
  expect(await response.headerValue('etag')).toBe(`"save-${revision}"`);
  const body = await response.body();
  const { summary } = JSON.parse(body.toString());
  expect(summary.revision).toBe(revision);
  // Measure the original bytes in the envelope, including whitespace outside
  // the snapshot's braces. Parsing/re-encoding loses this and future numbers.
  const prefix = Buffer.from('{"summary":' + JSON.stringify(summary) + ',"snapshot":');
  expect(body.equals(Buffer.concat([prefix, Buffer.from(raw), Buffer.from('}')]))).toBe(true);
}

async function expectNotice(page: Page, record: RecordCase) {
  const notice = dialog(page, 'Your adventure has been updated');
  await expect(notice).toBeVisible();
  for (const sentence of record.explanation) await expect(notice).toContainText(sentence);
  await expect(notice).toContainText('Take new measurements');
  await expect(notice).toContainText('until your next safe save');
  await clickButton(page, 'Resume adventure');
}

async function enableAutosave(j: Journey) {
  await clickButton(j.page, 'Settings');
  await clickButton(j.page, 'Enable account autosave');
  await expect(dialog(j.page, 'Settings')).toContainText('Last confirmed account setting: on.');
  await clickButton(j.page, 'Close settings');
  expect((await j.local.inspectAccount()).preference?.autosave_enabled).toBe(1);
}

async function expectReceipt(page: Page, committedAt: string) {
  expect(committedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  const indicator = page.locator('.nq-save-indicator, .nq-frame-window[aria-label="Game menu"] > p[aria-live="polite"]');
  await expect(indicator.and(page.getByText(`Saved at ${committedAt}`, { exact: true }))).toBeVisible();
}

async function holdNext(page: Page, method: 'PUT' | 'GET') {
  let intercepted!: (route: Route) => void;
  const request = new Promise<Route>(resolve => { intercepted = resolve; });
  await page.route(endpoint, route => {
    if (route.request().method() !== method) return route.continue();
    intercepted(route);
  });
  return { request };
}

test.describe('SAVE11 / AC13 hypothetical migration on the actual single-slot service', () => {
  test.describe.configure({ timeout: 60_000 });

  test('Continue retains the old slot through boundary-gate inspection and commits exactly one eligible manual save', async ({ journey: j }) => {
    const raw = await seed(j, balcony);
    await expectGet(j.page, 'Continue', raw);
    await expectNotice(j.page, balcony);
    await j.expectNotes(balcony.expected.notebook.personalNotes);
    await clickButton(j.page, 'Walk');
    await clickButton(j.page, 'Iron City boundary gate');
    await expect(j.page.locator('.nq-shell-status')).toContainText('This object cannot perform an unlisted intervention');
    await clickButton(j.page, 'Look');
    await clickButton(j.page, 'Iron City boundary gate');
    await openFrame(j.page, 'Evidence');
    await expect(dialog(j.page, 'Evidence and captions')).toContainText('The Iron City remains a future-content boundary');
    await expect(j.page.getByRole('heading', { name: 'The Iron Threshold', exact: true, includeHidden: true })).toHaveCount(1);
    expect(await j.local.inspectSlot()).toMatchObject({ revision: priorRevision, raw });
    expect(j.writes()).toHaveLength(0);

    const pending = responseFor(j.page, 'PUT');
    await clickButton(j.page, 'Save');
    const response = await pending, receipt = await response.json();
    expect(response.status()).toBe(200);
    expect(receipt).toMatchObject({ replayed: false, committedRevision: currentRevision, currentSummary: {
      roomId: 'spec001:R12', contentVersion: '1.0.0', revision: currentRevision, etag: '"save-8"' } });
    await expectReceipt(j.page, receipt.committedAt);
    const [write] = j.writes();
    expect(j.writes()).toHaveLength(1);
    expect(write?.headers).toMatchObject({ 'if-match': fixture.persistence.priorETag, 'x-save-mode': 'manual', 'idempotency-key': receipt.requestId });
    expect(await j.local.inspectSlot()).toEqual({ raw: write?.body, snapshot: balcony.expected, revision: currentRevision });
    expect((await j.local.inspectAccount()).saves).toBe(1);

    await j.page.reload();
    await expectGet(j.page, 'Continue', write!.body!, currentRevision);
    await j.expectNotes(balcony.expected.notebook.personalNotes);
    await expect(dialog(j.page, 'Your adventure has been updated')).toBeHidden();
    expect(j.writes()).toHaveLength(1);
  });

  test('Restore cancellation keeps live notes, a retry installs the bench migration, and the next safe room triggers autosave', async ({ journey: j }) => {
    const raw = await seed(j, arrival);
    await j.start();
    await j.notes('These unsaved notes belong to the local adventure.');
    await enableAutosave(j);
    await expectGet(j.page, 'Restore Save', raw);
    await expect(dialog(j.page, 'Load the server adventure?')).toContainText(arrival.explanation[0]!);
    await clickButton(j.page, 'Cancel');
    await j.expectNotes('These unsaved notes belong to the local adventure.');
    expect(await j.local.inspectSlot()).toMatchObject({ revision: priorRevision, raw });
    await expectGet(j.page, 'Restore Save', raw);
    await clickButton(j.page, 'Discard current progress and load');
    await expectNotice(j.page, arrival);
    await j.expectNotes(arrival.expected.notebook.personalNotes);
    expect(j.writes()).toHaveLength(0);
    expect(await j.local.inspectSlot()).toMatchObject({ revision: priorRevision, raw });
    const pending = responseFor(j.page, 'PUT');
    await clickButton(j.page, 'Walk');
    await clickButton(j.page, "Walk to The Titan's Workshop");
    const response = await pending, receipt = await response.json();
    expect(response.status()).toBe(200);
    expect(receipt).toMatchObject({ replayed: false, committedRevision: currentRevision, currentSummary: { roomId: 'spec001:R02' } });
    await expectReceipt(j.page, receipt.committedAt);
    const [write] = j.writes();
    expect(j.writes()).toHaveLength(1);
    expect(write?.headers).toMatchObject({ 'if-match': fixture.persistence.priorETag, 'x-save-mode': 'automatic' });
    const stored = await j.local.inspectSlot();
    expect(stored).toMatchObject({ revision: currentRevision, raw: write?.body, snapshot: { world: { roomId: 'spec001:R02' },
      notebook: { personalNotes: arrival.expected.notebook.personalNotes, measurements: arrival.expected.notebook.measurements },
      assistance: arrival.expected.assistance, outcomeHistory: arrival.expected.outcomeHistory } });
  });

  test('a successful historical GET held across confirmed logout cannot install its candidate in a later generation', async ({ journey: j }) => {
    const raw = await seed(j, arrival);
    const pending = await holdNext(j.page, 'GET');
    await clickButton(j.page, 'Continue');
    const intercepted = await pending.request;
    const reply = await j.local.forwardNative(intercepted.request());
    expect(reply.status).toBe(200);
    expect(reply.body).toContain('"snapshot":' + raw + '}');
    await clickButton(j.page, 'Settings');
    await clickButton(j.page, 'Log out');
    await clickButton(j.page, 'Confirm logout');
    await expect(dialog(j.page, 'Settings')).toContainText('Logout confirmed');
    await clickButton(j.page, 'Close settings');
    await intercepted.fulfill(reply);
    await j.page.unroute(endpoint);
    await expect(j.page.getByRole('heading', { name: 'Network Quest', exact: true })).toBeVisible();
    await expect(dialog(j.page, 'Your adventure has been updated')).toBeHidden();
    await expect(j.page.getByRole('textbox', { name: 'Personal notes', includeHidden: true })).toHaveValue('');

    await installCookie(j.context, (await j.local.syntheticSession('google')).cookie);
    await j.page.reload();
    await expect(j.page.getByText('Synthetic T056 Google player (google)', { exact: true })).toBeVisible();
    await clickButton(j.page, 'Continue');
    await expect(j.page.getByText('This account has no saved adventure. Choose New Adventure to begin.', { exact: true })).toBeVisible();
    expect(await j.local.inspectSlot('google')).toBeNull();
    expect(await j.local.inspectSlot('github')).toMatchObject({ revision: priorRevision, raw });
    await installCookie(j.context, (await j.local.syntheticSession('github')).cookie);
    await j.page.reload();
    await expectGet(j.page, 'Continue', raw);
    await expectNotice(j.page, arrival);
    await j.expectNotes(arrival.expected.notebook.personalNotes);
    expect(j.writes()).toHaveLength(0);
  });

  test('an incomplete Restore response keeps the live adventure and the next complete read can save the entire Arrival Lift fixture', async ({ journey: j }) => {
    const raw = await seed(j, arrival);
    await j.start();
    await j.notes('Unsaved notes before an interrupted read.');
    const pending = await holdNext(j.page, 'GET');
    await clickButton(j.page, 'Restore Save');
    const intercepted = await pending.request;
    const reply = await j.local.forwardNative(intercepted.request());
    expect(reply.status).toBe(200);
    expect(reply.body).toContain('"snapshot":' + raw + '}');
    // The actual server completed GET. Deliver a body cut inside the snapshot.
    await intercepted.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: fixture.persistence.priorETag },
      body: Buffer.from(reply.body).subarray(0, -32) });
    await expect(j.page.getByText(/The save could not be confirmed/).first()).toBeVisible();
    await expect(dialog(j.page, 'Load the server adventure?')).toBeHidden();
    await expect(dialog(j.page, 'Your adventure has been updated')).toBeHidden();
    await j.expectNotes('Unsaved notes before an interrupted read.');
    expect(await j.local.inspectSlot()).toMatchObject({ revision: priorRevision, raw });
    expect(j.writes()).toHaveLength(0);

    await j.page.unroute(endpoint);
    await expectGet(j.page, 'Restore Save', raw);
    await clickButton(j.page, 'Discard current progress and load');
    await expectNotice(j.page, arrival);
    await j.expectNotes(arrival.expected.notebook.personalNotes);
    const pendingSave = responseFor(j.page, 'PUT');
    await clickButton(j.page, 'Save');
    const response = await pendingSave;
    expect(response.status()).toBe(200);
    await expectReceipt(j.page, (await response.json()).committedAt);
    const committed = { revision: currentRevision, raw: response.request().postData(), snapshot: arrival.expected };
    expect(await j.local.inspectSlot()).toEqual(committed);
    await clickButton(j.page, 'Walk');
    await clickButton(j.page, "Walk to The Titan's Workshop");
    await clickButton(j.page, 'Walk to The Copper Warrens');
    await closeFrame(j.page);
    await clickButton(j.page, 'Open Maintenance record');
    const optional = dialog(j.page, 'Optional activity');
    await expect(optional).toContainText('Lost Maintenance Record');
    await expect(optional).toContainText('Choose the supplied practice card or combine your collected records when ready.');
    await expect(optional.getByRole('button', { name: 'Combine my collected records' })).toBeVisible();
    await expect(optional).not.toContainText('Completion recorded in your journal.');
    expect(await j.local.inspectSlot()).toEqual(committed);
    expect(j.writes()).toHaveLength(1);
  });

  test('two migrated tabs enforce stale If-Match and retry a lost revision-8 receipt against revision 9', async ({ journey: j }) => {
    const raw = await seed(j, balcony), first = j.page;
    await expectGet(first, 'Continue', raw);
    await expectNotice(first, balcony);
    const second = await j.context.newPage();
    await second.goto(j.local.url);
    await expectGet(second, 'Continue', raw);
    await expectNotice(second, balcony);
    await j.notes('The competing tab has different notes.', second);
    const pendingSecond = await holdNext(second, 'PUT');
    await clickButton(second, 'Save');
    const stale = await pendingSecond.request;

    const pendingFirst = await holdNext(first, 'PUT');
    await clickButton(first, 'Save');
    const lost = await pendingFirst.request;
    const committed = await j.local.forwardNative(lost.request());
    const originalReceipt = JSON.parse(committed.body);
    expect(committed.status).toBe(200);
    expect(originalReceipt).toMatchObject({ committedRevision: 8, replayed: false, currentSummary: { revision: 8 } });
    await lost.abort('failed');
    await expect(dialog(first, 'Save outcome unconfirmed')).toBeVisible();
    const winner = await j.local.inspectSlot();
    expect(winner).toEqual({ raw: lost.request().postData(), snapshot: balcony.expected, revision: 8 });
    expect(stale.request().headers()['if-match']).toBe(fixture.persistence.priorETag);
    const conflictResponse = responseFor(second, 'PUT');
    await stale.continue();
    const conflict = await conflictResponse;
    expect(conflict.status()).toBe(fixture.persistence.concurrentWinner.responseStatus);
    expect(await conflict.json()).toMatchObject({ code: 'save-conflict', currentSummary: { revision: 8, etag: '"save-8"' } });
    await expect(dialog(second, 'The server save changed')).toBeVisible();
    expect(await j.local.inspectSlot()).toEqual(winner);
    expect(j.writes()).toHaveLength(2);
    await second.unroute(endpoint);
    await clickButton(second, 'Keep Playing Without Saving');
    await j.expectNotes('The competing tab has different notes.', second);
    await clickButton(second, 'Restore Save');
    await clickButton(second, 'Discard current progress and load');
    await j.expectNotes(balcony.expected.notebook.personalNotes, second);
    await j.notes('Later confirmed revision nine.', second);
    const laterResponse = responseFor(second, 'PUT');
    await clickButton(second, 'Save');
    const later = await laterResponse;
    expect(later.status()).toBe(200);
    await expectReceipt(second, (await later.json()).committedAt);
    const newest = await j.local.inspectSlot();
    expect(newest).toMatchObject({ revision: 9, raw: later.request().postData(), snapshot: { notebook: { personalNotes: 'Later confirmed revision nine.' } } });

    await first.unroute(endpoint);
    const replayResponse = responseFor(first, 'PUT');
    await clickButton(first, 'Retry pending save');
    const replay = await replayResponse, receipt = await replay.json();
    expect(replay.status()).toBe(200);
    expect(replay.request().postDataBuffer()).toEqual(lost.request().postDataBuffer());
    for (const header of ['if-match', 'idempotency-key', 'x-save-mode']) {
      expect(replay.request().headers()[header]).toBe(lost.request().headers()[header]);
    }
    expect(receipt).toMatchObject({ replayed: true, requestId: originalReceipt.requestId, committedAt: originalReceipt.committedAt,
      committedRevision: 8, currentSummary: { revision: 9, etag: '"save-9"' } });
    await expect(dialog(first, 'The server save changed')).toBeVisible();
    expect(await j.local.inspectSlot()).toEqual(newest);
    expect(j.writes()).toHaveLength(4);
    expect((await j.local.inspectAccount()).saves).toBe(1);
  });

  for (const opaque of fixture.unknownNewer) {
    test(`${opaque.description} preserves its UTF-8 bytes and prevents replacement and automatic saving in the same adventure`, async ({ journey: j }) => {
      const raw = await seed(j, arrival);
      await expectGet(j.page, 'Continue', raw);
      await expectNotice(j.page, arrival);
      await enableAutosave(j);
      // Simulate storage written by a hypothetical later version. This client
      // is already playing this same adventure and has explicit autosave consent.
      const newer = { revision: 8, raw: opaque.rawUtf8 };
      await j.local.seedMigrationSlot({ ...newer, schemaVersion: opaque.reason === 'schema-version' ? 2 : 1,
        contentVersion: '2.0.0', adventureId: arrival.expected.adventureId, roomId: arrival.expected.world.roomId, outcome: null });
      await expectGet(j.page, 'Restore Save', opaque.rawUtf8, newer.revision);
      const preserved = dialog(j.page, 'Save preserved');
      await expect(preserved).toContainText('needs a compatible game update');
      await expect(button(j.page, 'Discard current progress and load')).toBeHidden();
      await clickButton(j.page, 'Keep Playing Without Saving');
      await j.notes('A local edit must survive the unsupported account slot.');
      await j.page.clock.install();
      await clickButton(j.page, 'Walk');
      await clickButton(j.page, "Walk to The Titan's Workshop");
      await expect(j.page.getByRole('heading', { name: "The Titan's Workshop", exact: true })).toBeVisible();
      // Advance the actual browser clock past the autosave debounce with no
      // later candidate to write. PHP and the request recorder stay live.
      await j.page.clock.runFor(1_000);
      await expectGet(j.page, 'Save', opaque.rawUtf8, newer.revision);
      await expect(preserved).toBeVisible();
      await expect(button(j.page, 'Replace With This Adventure')).toBeHidden();
      await expect(button(j.page, 'Confirm replacement')).toBeHidden();
      await clickButton(j.page, 'Keep Playing Without Saving');
      await j.expectNotes('A local edit must survive the unsupported account slot.');
      expect(j.writes()).toHaveLength(0);
      expect(await j.local.inspectSlot()).toMatchObject(newer);
      expect((await j.local.inspectAccount()).saves).toBe(1);
    });
  }
});
