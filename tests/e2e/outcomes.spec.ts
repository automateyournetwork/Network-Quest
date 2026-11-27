// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { closeFrame, openFrame } from './support/adventure-controls';
import { test, expect, dialog, notesBefore, notesAfter, warningLabel, type OutcomeJourney } from './support/outcome-journey';
import outcomeOracle from '../fixtures/outcomes.json' with { type: 'json' };
import retryOracle from '../fixtures/retry-transitions.json' with { type: 'json' };
import type { WorldState } from '../../src/state/types';

// These independently authored semantic cases remain untouched. The explicit
// assertions below bind public UI/actual stored payloads, never evaluator output.
function contracts(...ids: string[]) {
  const cases = [...outcomeOracle.cases, ...retryOracle.cases];
  for (const id of ids) expect(cases.some(item => item.id === id)).toBe(true);
}
const worldWithoutVersion = (world: WorldState) => {
  const { attemptId: _attempt, configurationRevision: _revision, ...rest } = world; return rest;
};
async function saveBlocked(j: OutcomeJourney) {
  const before = j.writes.length;
  await j.click('Save'); await expect(j.page.getByText('Finish the current activity before saving.', { exact: true })).toBeVisible();
  expect(j.writes).toHaveLength(before); await closeFrame(j.page);
}
async function retry(j: OutcomeJourney, shutdown = false) {
  const title = shutdown ? 'Continue from Encounter Preparation?' : 'Retry from Encounter Preparation?';
  if (shutdown) await dialog(j.page, 'The Honest Shutdown').getByRole('button', { name: 'Continue', exact: true }).press('Enter');
  else await j.click('Retry from Encounter Preparation');
  const confirmation = dialog(j.page, title);
  await expect(confirmation).toContainText('Items and completion flags rewind together.');
  await expect(confirmation).toContainText('It sends no save request');
  await expect(confirmation).toContainText('without merging them');
  return confirmation;
}
async function returned(j: OutcomeJourney) {
  await j.room('The Backhoe Rift'); await j.click('Scene');
  await expect(j.page.locator('.nq-shell-status')).toHaveText('Returned to Encounter Preparation. Retained clues and notes are unsaved; earlier measurements are stale.');
  await closeFrame(j.page);
}

test.describe('T089 real outcome and recovery integration', () => {
  test.setTimeout(180_000);

  // The existing four T078/T081 journeys cover E01 copper/fiber and E02 radio.
  // These complementary cases complete the six route×restoration bindings.
  for (const variant of [
    { branch: 'copper', duration: 'temporary', ending: 'E02', title: 'The Borrowed Dawn' },
    { branch: 'fiber', duration: 'temporary', ending: 'E02', title: 'The Borrowed Dawn' },
    { branch: 'radio', duration: 'permanent', ending: 'E01', title: 'The Steady Light' },
  ] as const) test(`${variant.ending} ${variant.branch}: real proof, explicit Continue and opted-in ordinary autosave`, async ({ outcome: j }, info) => {
    contracts(`OUT-${variant.ending}-${variant.branch.toUpperCase()}`, `OUT-${variant.ending}-SAFE-CONTINUE`, 'OUT-SAVE-BLOCK-ACTIVE-ENCOUNTER');
    await j.prepare(variant.branch); await j.choosePlan(variant.branch, variant.duration);
    // Safe cancellation is an ordinary precommit escape, without a timer or ally.
    await j.click('Return to preparation'); await j.room('The Backhoe Rift');
    await j.objective('Resolve the intervention in R11', false);
    await j.click('Repair plan'); await expect(j.page.getByRole('checkbox', { name: warningLabel, exact: true })).not.toBeChecked();
    await j.click('Close repair controls'); const anchor = await j.save(true);
    expect(anchor.snapshot.world.recruits).toEqual([]); expect(anchor.snapshot.world.activeAllyIds).toEqual([]);
    await j.autosave(); await j.click('Repair plan'); await j.execute(); await saveBlocked(j);
    await j.validate(variant.duration); const ending = dialog(j.page, variant.title);
    await expect(ending).toContainText('separate endpoint service test'); await expect(ending).toContainText('well-used toolkit');
    if (variant.duration === 'temporary') {
      for (const label of ['Temporary dependency:', 'Limitation:', 'Follow-up:']) await expect(ending).toContainText(label);
      await expect(ending).toContainText('protected work corridor');
    }
    await saveBlocked(j); expect(j.writes).toHaveLength(1); expect(await j.local.inspectSlot()).toEqual(anchor);
    await ending.getByRole('button', { name: 'Skip scene', exact: true }).press('Enter');
    await ending.getByRole('button', { name: 'Replay scene', exact: true }).press('Enter');
    await j.page.screenshot({ path: info.outputPath(`${variant.ending}-${variant.branch}.png`), fullPage: true });
    await ending.getByRole('button', { name: 'Continue', exact: true }).press('Enter'); await expect(ending).toBeHidden();
    await expect.poll(async () => (await j.local.inspectSlot())?.revision).toBe(anchor.revision + 1);
    const saved = (await j.local.inspectSlot())!;
    expect(saved.snapshot.safeState).toBe('safe-continue'); expect(saved.snapshot.world.continueOutcome).toBe(variant.ending);
    expect(saved.snapshot.world.completedObjectiveIds).toContain('spec001:O12');
    expect(saved.snapshot.world.route).toBe(variant.branch); expect(saved.snapshot.outcomeHistory.at(-1)?.outcome).toBe(variant.ending);
    expect(j.writes).toHaveLength(2); expect(j.writes[1]!.mode).toBe('automatic'); expect((await j.local.inspectAccount()).saves).toBe(1);
    await j.page.reload(); await j.click('Continue'); await j.room('The Iron Threshold');
    await expect(j.page.locator('.nq-room-stage')).toHaveAttribute('data-mural-folio', variant.ending);
    await expect(j.page.locator('.nq-media-cue[data-asset-id="spec001:ASSET-MUSIC-epilogue"]')).toHaveCount(0);
    await j.objective('Validate at R12', true); expect(await j.local.inspectSlot()).toEqual(saved); expect(j.writes).toHaveLength(2);
  });

  for (const branch of ['copper', 'fiber', 'radio'] as const) test(`E03 ${branch}: deliberate isolation, cancel, whole preparation rewind and fresh proof`, async ({ outcome: j }, info) => {
    contracts(`OUT-E03-${branch.toUpperCase()}`, 'OUT-E03-CONTINUE', 'RETRY-E03-WHOLE-WORLD', 'RETRY-ALL-READINGS-STALE', 'RETRY-FACT-NOT-COMPLETION', 'RETRY-LATER-MANUAL-SAVE');
    await j.prepare(branch, true, branch === 'radio'); await j.choosePlan(branch, 'shutdown');
    await j.click('Close repair controls'); const anchor = await j.save(true); await j.autosave();
    expect(anchor.snapshot.world.inventory).toEqual([{ itemId: 'spec001:ITEM-inspection-kit', quantity: 1 }]);
    await j.click('Repair plan'); await j.execute(); await j.objective('Resolve the intervention in R11', true);
    await saveBlocked(j); await j.validate('shutdown', true);
    const ending = dialog(j.page, 'The Honest Shutdown');
    await expect(ending).toContainText('service is unresolved'); await expect(ending).toContainText('Isolation is not restoration');
    await expect(ending).toContainText('Named unresolved fault: the severed conduit remains disconnected.');
    await expect(ending).toContainText('Recovery plan: return to safe preparation, repair or replace the damaged path, then measure again and repeat the endpoint test.'); await saveBlocked(j);
    expect(j.writes).toHaveLength(1); expect(await j.local.inspectSlot()).toEqual(anchor);
    let confirmation = await retry(j, true);
    await confirmation.getByRole('button', { name: 'Cancel — keep this attempt', exact: true }).press('Enter');
    await expect(confirmation).toBeHidden(); await expect(ending).toBeVisible(); expect(await j.local.inspectSlot()).toEqual(anchor);
    confirmation = await retry(j, true);
    await j.page.screenshot({ path: info.outputPath(`E03-${branch}-confirmation.png`), fullPage: true });
    await confirmation.getByRole('button', { name: 'Confirm Continue to Encounter Preparation', exact: true }).press('Enter');
    await returned(j); await j.expectNotes(notesAfter); await j.objective('Resolve the intervention in R11', false); await j.objective('Validate at R12', false);
    // A completed native session GET provides an event-loop/network observation
    // point; no sleep or fabricated timer drives the negative write assertion.
    await j.page.evaluate(async () => { await fetch('./api/v1/session'); });
    expect(j.writes).toHaveLength(1); expect(await j.local.inspectSlot()).toEqual(anchor);
    const rewound = await j.save();
    expect(worldWithoutVersion(rewound.snapshot.world)).toEqual(worldWithoutVersion(anchor.snapshot.world));
    expect(rewound.snapshot.world.attemptId).not.toBe(anchor.snapshot.world.attemptId);
    expect(rewound.snapshot.world.configurationRevision).toBeGreaterThan(anchor.snapshot.world.configurationRevision);
    expect(rewound.snapshot.notebook.personalNotes).toBe(notesAfter);
    expect(rewound.snapshot.notebook.factIds).toEqual(expect.arrayContaining([...anchor.snapshot.notebook.factIds, 'spec001:FACT-O12-classification']));
    expect(rewound.snapshot.notebook.hypotheses).toEqual(anchor.snapshot.notebook.hypotheses);
    expect(rewound.snapshot.assistance.filter(hint => String(hint.objectiveId) === 'spec001:O12').map(hint => hint.level)).toEqual([1, 2, 3]);
    expect(rewound.snapshot.outcomeHistory.at(-1)?.outcome).toBe('E03');
    expect(rewound.snapshot.notebook.measurements.length).toBeGreaterThanOrEqual(anchor.snapshot.notebook.measurements.length);
    expect(rewound.snapshot.notebook.measurements.every(reading => reading.stale)).toBe(true);
    expect(rewound.snapshot.safeState).toBe('safe-preparation'); expect(rewound.snapshot).not.toHaveProperty('checkpoint');
    expect((await j.local.inspectAccount()).saves).toBe(1); expect(j.writes).toHaveLength(2);
    await j.choosePlan(branch, 'permanent');
    const observations = dialog(j.page, 'Repair plan').locator('ol[aria-label="Repair observations"] > li');
    await expect(observations.first()).toContainText('Stale observation'); await expect(observations.last()).toContainText('Current observation');
    await j.execute(); await j.validate('permanent'); await dialog(j.page, 'The Steady Light').getByRole('button', { name: 'Continue', exact: true }).press('Enter');
    await expect.poll(async () => (await j.local.inspectSlot())?.revision).toBe(rewound.revision + 1);
    const repaired = (await j.local.inspectSlot())!.snapshot;
    expect(repaired.outcomeHistory.map(event => event.outcome)).toEqual(['E03', 'E01']);
    expect(repaired.world.completedObjectiveIds.filter(id => String(id) === 'spec001:O11')).toHaveLength(1);
    expect(repaired.world.completedObjectiveIds.filter(id => String(id) === 'spec001:O12')).toHaveLength(1);
    const oldIds = new Set(rewound.snapshot.notebook.measurements.map(reading => reading.id));
    expect(repaired.notebook.measurements.filter(reading => oldIds.has(reading.id)).every(reading => reading.stale)).toBe(true);
    // Freshness was required in the native validation UI immediately before
    // classification. That accepted completion advances the world revision, so
    // its retained proof must not be resurrected as current after that change.
    const newReadings = repaired.notebook.measurements.filter(reading => !oldIds.has(reading.id));
    expect(newReadings.length).toBeGreaterThanOrEqual(2);
    expect(newReadings.every(reading => reading.attemptId === repaired.world.attemptId)).toBe(true);
    expect(newReadings.some(reading => reading.readings.some(value => value.name === 'Endpoint service acknowledged' && value.value === 1))).toBe(true);
  });

  test('warned fatal choice: Retry cancel, stale controls, Restore review cancel and exact whole-journal replacement', async ({ outcome: j }, info) => {
    contracts('OUT-FATAL-ACCOUNT', 'OUT-RESTORE-SAVE', 'OUT-RESTORE-CANCEL', 'RESTORE-REPLACES-WORLD-AND-JOURNAL', 'RESTORE-OLD-CALLBACK-SAME-VERSION');
    await j.prepare('copper'); const anchor = await j.save(true); await j.notes(notesAfter); await j.hazard();
    const failure = dialog(j.page, 'A Shortcut Too Short');
    await expect(failure).toContainText('fall killed the apprentice'); await expect(failure).toContainText('not the result of an incorrect diagnosis');
    await failure.getByRole('button', { name: 'Skip scene', exact: true }).press('Enter');
    await expect(failure).toContainText('unsupported inspection ledge'); await saveBlocked(j);
    let confirmation = await retry(j); await confirmation.press('Escape'); await expect(failure).toBeVisible();
    expect(await j.local.inspectSlot()).toEqual(anchor); expect(j.writes).toHaveLength(1);
    confirmation = await retry(j);
    const oldConfirm = await confirmation.getByRole('button', { name: 'Confirm Retry from Encounter Preparation', exact: true }).elementHandle();
    await confirmation.getByRole('button', { name: 'Cancel — keep this attempt', exact: true }).click();
    // A retained detached native control is adversarial UI input, never state injection.
    await oldConfirm!.evaluate(element => (element as HTMLElement).click()); await expect(failure).toBeVisible();
    confirmation = await retry(j);
    // Reattach that retired real control to the live confirmation as adversarial
    // DOM input. It must still have no authority over this later confirmation.
    await oldConfirm!.evaluate(element => {
      const host = document.querySelector('[role="dialog"][aria-label="Retry from Encounter Preparation?"]');
      if (!host) throw new Error('Expected the current native recovery confirmation');
      host.append(element); (element as HTMLElement).click(); element.remove();
    });
    await expect(confirmation).toBeVisible(); expect(j.writes).toHaveLength(1);
    await confirmation.getByRole('button', { name: 'Cancel — keep this attempt', exact: true }).press('Enter');
    await failure.getByRole('button', { name: 'Restore Save', exact: true }).click();
    const load = dialog(j.page, 'Load the server adventure?'); await expect(load).toContainText('unsaved notes');
    await load.getByRole('button', { name: 'Cancel', exact: true }).press('Enter'); await expect(failure).toBeVisible();
    expect(await j.local.inspectSlot()).toEqual(anchor); expect(j.writes).toHaveLength(1);
    await failure.getByRole('button', { name: 'Restore Save', exact: true }).click();
    await load.getByRole('button', { name: 'Discard current progress and load', exact: true }).press('Enter');
    await j.room('The Backhoe Rift'); await expect(j.page.locator('[data-mural-folio]')).toHaveCount(0);
    await expect(j.page.locator('.nq-media-cue[data-asset-id="spec001:ASSET-VOICE-013"]')).toHaveCount(0);
    await j.expectNotes(notesBefore); await oldConfirm!.evaluate(element => (element as HTMLElement).click());
    await j.room('The Backhoe Rift'); expect(await j.local.inspectSlot()).toEqual(anchor); expect(j.writes).toHaveLength(1);
    // Re-saving unchanged restored memory lets the actual service expose the
    // whole payload; no DOM state hook or journal merge claim substitutes for it.
    const saved = await j.save(); expect(saved.snapshot).toEqual(anchor.snapshot);
    await j.page.screenshot({ path: info.outputPath('fatal-restored-exact-save.png'), fullPage: true });
  });

  test('guest fatal Retry stays temporary; sign-in choice has no load/write and declined invitation stays declined', async ({ outcome: j }, info) => {
    contracts('OUT-FATAL-GUEST', 'RETRY-GUEST-IN-MEMORY', 'RESTORE-GUEST-REQUIRES-SIGNIN');
    await j.prepare('copper', false, true);
    await openFrame(j.page, 'Sound and reading'); await j.page.getByRole('slider', { name: 'Text size', exact: true }).fill('2'); await closeFrame(j.page);
    await j.page.setViewportSize({ width: 390, height: 844 }); await j.hazard(); const failure = dialog(j.page, 'A Shortcut Too Short');
    await expect(failure.getByRole('button', { name: 'Restore Save', exact: true })).toHaveCount(0);
    await failure.getByRole('button', { name: 'Sign in to Restore Save', exact: true }).press('Enter');
    await expect(dialog(j.page, 'Sign in to save')).toBeVisible();
    await expect(j.page.getByRole('button', { name: 'Google', exact: true })).toBeVisible(); await expect(j.page.getByRole('button', { name: 'GitHub', exact: true })).toBeVisible();
    await j.click('Cancel sign-in'); await expect(failure).toBeVisible(); expect(j.writes).toEqual([]); expect(await j.local.inspectSlot()).toBeNull();
    const confirmation = await retry(j);
    await expect(confirmation).toBeVisible(); await confirmation.getByRole('button', { name: 'Confirm Retry from Encounter Preparation', exact: true }).focus();
    await j.page.screenshot({ path: info.outputPath('guest-retry-390-200.png'), fullPage: true });
    expect(await j.page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await confirmation.getByRole('button', { name: 'Confirm Retry from Encounter Preparation', exact: true }).press('Enter');
    await returned(j); await j.expectNotes(notesBefore); await j.walk('The Clockworks');
    await expect(dialog(j.page, 'Sign in to save')).toBeHidden(); expect(j.writes).toEqual([]); expect(await j.local.inspectSlot()).toBeNull();
  });

  test('a committed earlier save acknowledgement cannot mark the new Retry generation saved', async ({ outcome: j }) => {
    contracts('RETRY-EARLIER-SAVE-ACK', 'RETRY-UNSAFE-AUTOSAVE-RACE', 'RETRY-LATER-OPTIN-AUTOSAVE');
    await j.prepare('copper'); const anchor = await j.save(true); await j.autosave(); await j.notes('Earlier pending safe capture');
    let release!: () => void, reached!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; }), intercepted = new Promise<void>(resolve => { reached = resolve; });
    let responseDone = false;
    await j.page.route('**/api/v1/save', async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      const response = await j.local.forwardNative(route.request()); expect(response.status).toBe(200); reached(); await held;
      await route.fulfill(response); responseDone = true;
    });
    try {
      await j.click('Save'); await intercepted; await closeFrame(j.page); await j.hazard();
      const confirmation = await retry(j); await confirmation.getByRole('button', { name: 'Confirm Retry from Encounter Preparation', exact: true }).click();
      await returned(j); await j.notes('New Retry generation remains unsaved');
      expect(j.writes).toHaveLength(2); release(); await expect.poll(() => responseDone).toBe(true);
      await openFrame(j.page, 'Game'); await expect(j.page.getByText('Unsaved changes', { exact: true })).toBeVisible(); await closeFrame(j.page);
      const earlier = (await j.local.inspectSlot())!; expect(earlier.revision).toBe(anchor.revision + 1);
      expect(earlier.snapshot.world.attemptId).toBe(anchor.snapshot.world.attemptId); expect(earlier.snapshot.notebook.personalNotes).toBe('Earlier pending safe capture');
      await j.page.unroute('**/api/v1/save'); const later = await j.save();
      expect(later.snapshot.world.attemptId).not.toBe(earlier.snapshot.world.attemptId);
      expect(later.snapshot.notebook.personalNotes).toBe('New Retry generation remains unsaved'); expect(j.writes).toHaveLength(3);
      await j.notes('Retained Retry learning at the next ordinary safe arrival'); await j.walk('The Clockworks');
      await expect.poll(async () => (await j.local.inspectSlot())?.revision).toBe(later.revision + 1);
      const arrived = (await j.local.inspectSlot())!;
      expect(arrived.snapshot.world.attemptId).toBe(later.snapshot.world.attemptId);
      expect(arrived.snapshot.notebook.personalNotes).toBe('Retained Retry learning at the next ordinary safe arrival');
      expect(arrived.snapshot).not.toHaveProperty('checkpoint'); expect(j.writes).toHaveLength(4); expect(j.writes[3]!.mode).toBe('automatic');
    } finally { release(); }
  });

  test('unknown save outcome survives Retry; receipt retry sends exact old bytes and preserves current learning', async ({ outcome: j }) => {
    contracts('RETRY-EARLIER-SAVE-ACK', 'RETRY-AUTOSAVE-OFF');
    await j.prepare('copper'); const anchor = await j.save(true); await j.notes('Committed response will be lost');
    let dropped = false;
    await j.page.route('**/api/v1/save', async route => {
      if (route.request().method() !== 'PUT' || dropped) return route.continue();
      dropped = true; expect((await j.local.forwardNative(route.request())).status).toBe(200); await route.abort('failed');
    });
    await j.click('Save'); await expect(dialog(j.page, 'Save outcome unconfirmed')).toBeVisible(); await j.click('Keep Playing Without Saving');
    const frozenBytes = j.writes[1]!.body; await closeFrame(j.page); await j.hazard(); const confirmation = await retry(j);
    await confirmation.getByRole('button', { name: 'Confirm Retry from Encounter Preparation', exact: true }).click(); await returned(j);
    await j.notes('Learning after unknown-outcome Retry'); await j.click('Save'); await expect(dialog(j.page, 'Save outcome unconfirmed')).toBeVisible();
    expect(j.writes).toHaveLength(2); await j.click('Retry pending save'); await expect(pageSavedOrUnsaved(j)).toBeVisible();
    expect(j.writes).toHaveLength(3); expect(j.writes[2]!.body).toBe(frozenBytes);
    const old = (await j.local.inspectSlot())!; expect(old.revision).toBe(anchor.revision + 1); expect(old.snapshot.notebook.personalNotes).toBe('Committed response will be lost');
    await closeFrame(j.page); await j.expectNotes('Learning after unknown-outcome Retry');
    const saved = await j.save(); expect(saved.revision).toBe(old.revision + 1); expect(saved.snapshot.notebook.personalNotes).toBe('Learning after unknown-outcome Retry');
    expect(saved.snapshot.world.attemptId).not.toBe(old.snapshot.world.attemptId);
  });

  test('Restore response arriving after Retry cannot reopen an old discard confirmation', async ({ outcome: j }) => {
    contracts('RESTORE-DEFERRED-RESPONSE', 'RESTORE-OLD-CALLBACK-SAME-VERSION');
    await j.prepare('copper'); const anchor = await j.save(true); await j.notes(notesAfter); await j.hazard();
    let release!: () => void, reached!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; }), intercepted = new Promise<void>(resolve => { reached = resolve; });
    let completed = false;
    await j.page.route('**/api/v1/save', async route => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await j.forwardRead(route.request()); expect(response.status).toBe(200);
      reached(); await held; await route.fulfill(response); completed = true;
    });
    try {
      await dialog(j.page, 'A Shortcut Too Short').getByRole('button', { name: 'Restore Save', exact: true }).click(); await intercepted;
      const confirmation = await retry(j); await confirmation.getByRole('button', { name: 'Confirm Retry from Encounter Preparation', exact: true }).click();
      await returned(j); release(); await expect.poll(() => completed).toBe(true);
      await expect(dialog(j.page, 'Load the server adventure?')).toBeHidden(); await j.expectNotes(notesAfter);
      expect(j.writes).toHaveLength(1); expect(await j.local.inspectSlot()).toEqual(anchor);
    } finally { release(); }
  });

  test('SAVE13 after Retry: cancelled logout keeps notes and checkpoint; confirmed logout clears without autosave', async ({ outcome: j }, info) => {
    contracts('RETRY-LOGOUT-CANCEL', 'RETRY-LOGOUT-CONFIRMED');
    await j.prepare('copper'); const anchor = await j.save(true); await j.autosave(); await j.notes(notesAfter); await j.hazard();
    const confirmation = await retry(j); await confirmation.getByRole('button', { name: 'Confirm Retry from Encounter Preparation', exact: true }).click();
    await returned(j); await j.click('Settings'); await j.click('Log out');
    await expect(dialog(j.page, 'Settings')).toContainText('Unsaved progress and notes'); await j.click('Cancel'); await j.click('Close settings');
    await j.expectNotes(notesAfter); expect(j.writes).toHaveLength(1); expect(await j.local.inspectSlot()).toEqual(anchor);
    // A second real hazard/Retry after cancel proves the retained checkpoint is
    // still usable; it does not spend or duplicate an authored item/reward.
    await j.hazard(); const second = await retry(j);
    await second.getByRole('button', { name: 'Confirm Retry from Encounter Preparation', exact: true }).click(); await returned(j);
    await j.click('Settings'); await j.click('Log out'); await j.click('Confirm logout');
    await expect(dialog(j.page, 'Settings')).toContainText('Logout confirmed'); await j.click('Close settings');
    await expect(j.page.getByRole('heading', { name: 'Network Quest', exact: true })).toBeVisible();
    await expect(j.page.getByRole('textbox', { name: 'Personal notes', includeHidden: true })).toHaveValue('');
    expect(await j.page.evaluate(text => document.body.textContent?.includes(text), notesAfter)).toBe(false);
    expect(j.writes).toHaveLength(1); expect(await j.local.inspectSlot()).toEqual(anchor);
    await j.page.screenshot({ path: info.outputPath('retry-logout-cleared.png'), fullPage: true });
  });
});

function pageSavedOrUnsaved(j: OutcomeJourney) { return j.page.getByText('Unsaved changes', { exact: true }); }
