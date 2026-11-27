// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, firefox, test as base, type Page, type Request } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { request } from 'node:https';
import { configuredSave } from './configured-save';
import { closeFrame, revealControl } from './adventure-controls';

export type Branch = 'copper' | 'fiber' | 'radio';
export type Duration = 'permanent' | 'temporary';
export const notesBefore = 'Preparation record: keep the original observations and verify endpoint service separately.';
export const notesAfter = 'After commitment: preserve this new observation through Retry, but not Restore Save.';
export const warningLabel = 'I understand that execution changes the route and makes earlier readings stale';
export const hazardLabel = 'I understand that crossing the unstable ledge can kill the apprentice';
export const dialog = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true });

/** Only native controls drive the production application. The private fixture
 * installs a local synthetic identity, never an adventure or an evaluator result. */
async function journey() {
  const local = await configuredSave();
  const context = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false,
    reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  const errors: string[] = [], external: string[] = [];
  const writes: { body: string; mode: string | undefined }[] = [];
  context.on('request', request => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== local.origin) external.push(request.url());
    if (url.pathname.endsWith('/save') && request.method() === 'PUT') writes.push({ body: request.postData() ?? '', mode: request.headers()['x-save-mode'] });
  });
  const page = await context.newPage(); page.setDefaultTimeout(10_000); page.on('pageerror', error => errors.push(error.message));
  // Playwright's Node-side route.fetch does not inherit this Firefox profile's
  // disposable NSS trust. Forward only this fixture's exact saved-slot read,
  // using its own CA and strict certificate verification, then hold the reply.
  const forwardRead = async (native: Request): Promise<{ status: number; body: string; headers: Record<string, string> }> => {
    if (native.method() !== 'GET' || native.url() !== `${local.origin}/arcade/play/network-quest/api/v1/save`)
      throw new Error('Expected the isolated fixture saved-slot GET');
    const ca = await readFile(`${local.directory}/ca.pem`), headers = await native.allHeaders();
    return new Promise((resolve, reject) => {
      const upstream = request(native.url(), { method: 'GET', headers, ca, rejectUnauthorized: true }, reply => {
        const chunks: Buffer[] = []; let received = 0;
        reply.on('data', (chunk: Buffer) => { received += chunk.length;
          if (received > 1_048_576) { upstream.destroy(new Error('Isolated saved-slot response exceeded its bound')); return; }
          chunks.push(Buffer.from(chunk));
        });
        reply.once('end', () => resolve({ status: reply.statusCode!, body: Buffer.concat(chunks).toString('utf8'),
          headers: Object.fromEntries(Object.entries(reply.headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) }));
        reply.once('error', reject);
      });
      upstream.setTimeout(5000, () => upstream.destroy(new Error('Isolated saved-slot read timed out')));
      upstream.once('error', reject); upstream.end();
    });
  };
  let keyboard = false;
  const click = async (name: string) => {
    if (['Scene', 'Evidence', 'Diagnostics', 'Repair plan', 'Validate repair'].includes(name)) await closeFrame(page);
    const control = await revealControl(page, name);
    if (keyboard) await control.press('Enter'); else await control.click();
  };
  const check = async (name: string) => {
    const input = page.getByRole('checkbox', { name, exact: true });
    if (keyboard) { await input.focus(); await input.press('Space'); } else await input.check();
  };
  const room = async (name: string) => {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.locator('.nq-graybox')).toHaveAttribute('data-rendered', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  };
  const walk = async (name: string, label = `Walk to ${name}`) => { await click('Walk'); await click(label); await room(name); };
  const readings = () => dialog(page, 'Diagnostics').locator('ol[aria-label="Recorded measurements"] > li');
  const measure = async (complete: boolean) => {
    await click('Diagnostics'); await click('Take measurement');
    const submit = readings().last().getByRole('button', { name: 'Submit this reading', exact: true });
    if (keyboard) await submit.press('Enter'); else await submit.click();
    if (complete) await expect(dialog(page, 'Diagnostics')).toContainText('Objective complete.');
    else await expect(dialog(page, 'Diagnostics')).not.toContainText('Objective complete.');
    await click('Close diagnostics');
  };
  const notes = async (text: string) => { await click('Notebook'); await page.getByRole('textbox', { name: 'Personal notes', exact: true }).fill(text); await click('Close notebook'); };
  const expectNotes = async (text: string) => { await click('Notebook'); await expect(page.getByRole('textbox', { name: 'Personal notes', exact: true })).toHaveValue(text); await click('Close notebook'); };
  const objective = async (label: string, completed: boolean) => {
    await click('Notebook'); const item = dialog(page, 'Notebook').locator('ul[aria-label="Objectives"] > li').filter({ hasText: label });
    await expect(item).toHaveCount(1); await expect(item).toContainText(completed ? 'Completed' : 'In progress'); await click('Close notebook');
  };
  const save = async (first = false) => {
    await click('Save'); if (first) await click('Save this adventure');
    await expect(page.getByText(/^Saved at /)).toBeVisible(); return (await local.inspectSlot())!;
  };
  const prepare = async (branch: Branch, authenticated = true, keys = false) => {
    keyboard = keys;
    if (authenticated) {
      const [name, value] = local.cookies[0]!.split('=');
      await context.addCookies([{ name: name!, value: value!, domain: '127.0.0.1', path: '/arcade/play/network-quest/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
    }
    await page.goto(local.url); if (authenticated) await expect(page.getByText('Synthetic T050 player (github)', { exact: true })).toBeVisible();
    await click('New Adventure'); if (authenticated) await click('Start new adventure'); await room('The Arrival Lift');
    await click('Look'); await click('Look at power indication'); await click('Look at link indication');
    await click('Talk'); await click('Talk to Photon the Firefly'); await click('Skip dialogue'); await click('Use'); await click('Inspect physical path');
    await walk("The Titan's Workshop"); await click('Talk'); await click('Talk to the Titan'); await click('Skip dialogue');
    await click('Look'); await click('Identify known-good endpoints'); await click('Identify physical path under test');
    await click('Notebook'); await page.getByRole('textbox', { name: 'Hypothesis', exact: true }).fill('Compare observations before and after intervention, then test endpoint service.');
    await click('Pin hypothesis'); await page.getByRole('textbox', { name: 'Personal notes', exact: true }).fill(notesBefore); await click('Close notebook');
    if (!authenticated) { await expect(dialog(page, 'Sign in to save')).toBeVisible(); await click('Continue as guest'); }
    if (branch === 'copper') {
      await walk('The Copper Warrens'); await click('Use'); await click('Read and keep the supplied compatibility card');
      await click('Read and keep the diagnosed-defect card; this is not a performed measurement'); await measure(false);
      await click('Use'); await click('Fit the supplied replacement section: 85 m + 10 m'); await measure(true);
      await walk('The Echo Cavern'); await click('Use'); await click('Read and keep the before-record instructions; retain an actual measured open result');
      await click('Read and keep the repeater role and limits'); await click('Conclude: a repeater needs the physical connection restored'); await measure(true);
      await walk('The Copper Warrens'); await walk("The Titan's Workshop");
    } else if (branch === 'fiber') {
      await walk('The Photon Gardens'); await click('Use'); await click('Read and keep all five supplied compatibility checks');
      await click('Select the supplied fully matching optic/fiber pair: all five fields match'); await click('Inspect the original connection at the dock before any intervention');
      await click('Have the dock fit the supplied compatible replacement to the inspected connection');
      await click('Reinspect the replaced connection to confirm the diagnosed defect was removed'); await measure(true);
      await walk('The Prism Vault'); await click('Use'); await click('Read and keep the current compatibility and inspection reminder');
      await click('Select passive path B: total loss 9 dB'); await measure(true); await walk('The Photon Gardens');
      await walk("The Titan's Workshop", 'Walk to The Titan’s Workshop');
    } else {
      await walk('The Skywell'); await click('Use'); await click('Keep the path survey in the notebook'); await click('Keep the endpoint settings card');
      await click('Select the alternate surveyed path'); await click('Match both endpoint band, channel and PHY settings'); await measure(true);
      await walk('The Storm Observatory'); await click('Use'); await click('Keep the survey and freshness instructions');
      await click('Isolate the local emitter and return to surveyed conditions'); await click('Select fictional scenario channel B at both endpoints'); await measure(true);
      await walk('The Skywell'); await walk("The Titan's Workshop");
    }
    await walk('The Shell Market'); await click('Use'); await click('Read and record all separate equipment checks');
    await click('Select 100/full'); await click('Choose complete kit B: 12 W + 11 W + 7 W'); await measure(true);
    await walk("The Titan's Workshop"); await walk('The Clockworks'); await click('Use');
    await click('Read and record the physical-role and upper-layer explanation'); await click('Use untimed step-by-step decoding');
    await click('Explain: sample physical signals representing bits; this does not discover addresses');
    for (const [position, pair] of ['00', '10', '11', '01'].entries()) { await click(`Inspect sample position ${position}`); await click(`Write ${pair} for sample position ${position}`); }
    await measure(true); await walk('The Backhoe Rift', 'Walk toward The Backhoe Rift');
    expect(writes).toEqual([]);
  };
  const choosePlan = async (branch: Branch, duration: Duration | 'shutdown') => {
    await click('Repair plan'); await click(duration === 'shutdown' ? 'Deliberate isolation — service unresolved'
      : { copper: 'Copper replacement — 95 m', fiber: 'Fiber path B — 9 dB loss', radio: 'Radio path B — 20 dB SNR' }[branch]);
    if (duration !== 'shutdown') await click(duration === 'permanent' ? 'Permanent installation' : 'Temporary installation');
    await click('Read and keep plan requirements');
    if (duration === 'temporary') await click('Record temporary dependency and follow-up');
    if (duration === 'shutdown') await click('Record unresolved fault and recovery plan');
    await click('Review current plan');
    await expect(page.getByRole('checkbox', { name: warningLabel, exact: true })).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Execute reviewed plan', exact: true })).toBeDisabled();
    await expect(dialog(page, 'Repair plan')).toContainText('no countdown or reflex challenge');
    await expect(dialog(page, 'Repair plan')).toContainText('without a recruited ally');
  };
  const execute = async () => { await check(warningLabel); await click('Execute reviewed plan'); await click('Close repair controls'); };
  const validate = async (duration: Duration | 'shutdown', learn = false) => {
    await walk('The Iron Threshold', 'Walk to the validation balcony');
    if (learn) {
      await notes(notesAfter); await click('Diagnostics'); await click('Show method hint'); await click('Show worked step'); await click('Show solution'); await click('Close diagnostics');
    }
    await click('Validate repair'); await click('Read classification criteria');
    if (duration === 'shutdown') await click('Record unresolved isolation');
    else {
      const classify = duration === 'permanent' ? 'Classify permanent restoration' : 'Classify temporary restoration';
      await click(classify); await expect(dialog(page, 'Validate repair')).toContainText('No restored service has been awarded.');
      await click('Measure repaired link');
      await expect(dialog(page, 'Validate repair').locator('ol[aria-label="Repair observations"] > li').last()).toContainText('Current observation');
      await click(classify); await expect(dialog(page, 'Validate repair')).toContainText('No restored service has been awarded.');
      await click('Run endpoint test');
      const observations = dialog(page, 'Validate repair').locator('ol[aria-label="Repair observations"] > li');
      await expect(observations.last()).toContainText('Endpoint service acknowledged: 1 count');
      await expect(observations.last()).toContainText('Current observation');
      await expect(observations.filter({ hasText: 'Current observation' })).toHaveCount(2);
      await click(classify);
    }
    await expect(dialog(page, { permanent: 'The Steady Light', temporary: 'The Borrowed Dawn', shutdown: 'The Honest Shutdown' }[duration])).toBeVisible();
  };
  return { local, context, page, errors, external, writes, click, check, room, walk, notes, expectNotes, objective, readings, measure, forwardRead,
    prepare, choosePlan, execute, validate, save,
    async autosave() { await click('Settings'); await click('Enable account autosave'); await expect(dialog(page, 'Settings')).toContainText('Last confirmed account setting: on.'); await click('Close settings'); },
    async hazard() { await click('Repair plan'); await expect(page.getByRole('checkbox', { name: hazardLabel, exact: true })).not.toBeChecked();
      await expect(page.getByRole('button', { name: 'Cross the marked unstable inspection ledge', exact: true })).toBeDisabled();
      await check(hazardLabel); await click('Cross the marked unstable inspection ledge'); await expect(dialog(page, 'A Shortcut Too Short')).toBeVisible(); },
  };
}
export type OutcomeJourney = Awaited<ReturnType<typeof journey>>;
export const test = base.extend<{ outcome: OutcomeJourney }>({ outcome: async ({}, use, info) => {
  const j = await journey();
  try { await use(j); }
  finally {
    if (info.status !== info.expectedStatus) await j.page.screenshot({ path: info.outputPath('T089-failure.png'), fullPage: true }).catch(() => {});
    try { await j.context.close(); } finally { await j.local.stop(); }
    expect(j.errors).toEqual([]); expect(j.external).toEqual([]);
  }
} });
export { expect };
