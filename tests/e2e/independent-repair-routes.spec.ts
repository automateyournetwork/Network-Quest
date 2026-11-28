// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, firefox, test, type BrowserContext, type Page } from '@playwright/test';
import { configuredSave } from './support/configured-save';
import { closeFrame, revealControl } from './support/adventure-controls';
import type { FlagId } from '../../src/domain/types';

/** T081 actual New Adventure journeys. Numerical expectations are the reviewed
 * supplied profiles: fiber9dB loss→−12dBm/2dB reserve; radio−65−(−85)=20dB.
 * The fixture cookie supplies isolated local identity only. No game state,
 * objective receipt, evaluator answer or measurement is injected. */
for (const branch of ['fiber', 'radio'] as const) {
  test(`T081 independent ${branch} route reaches validated R12 and restores its one PHP save`, async ({}, info) => {
    test.setTimeout(180_000);
    const local = await configuredSave();
    let context: BrowserContext | undefined;
    const errors: string[] = [], external: string[] = [], writes: string[] = [];
    try {
      context = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false,
        reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
      const [name, value] = local.cookies[0]!.split('=');
      await context.addCookies([{ name: name!, value: value!, domain: '127.0.0.1', path: '/arcade/play/network-quest/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
      context.on('request', request => {
        const url = new URL(request.url());
        if (/^https?:$/.test(url.protocol) && url.origin !== new URL(local.url).origin) external.push(request.url());
        if (url.pathname.endsWith('/save') && request.method() === 'PUT') writes.push(request.postData() ?? '');
      });
      const page = await context.newPage(); page.setDefaultTimeout(10_000); page.on('pageerror', error => errors.push(error.message));
      const ui = controls(page);
      await page.goto(local.url); await expect(page.getByText('Synthetic T050 player (github)', { exact: true })).toBeVisible();
      await ui.click('New Adventure'); await ui.click('Start new adventure'); await ui.room('The Arrival Lift');
      await ui.click('Look'); await ui.click('Look at power indication'); await ui.click('Look at link indication');
      await ui.click('Talk'); await ui.click('Talk to Photon the Firefly'); await ui.click('Skip dialogue');
      await ui.click('Use'); await ui.click('Inspect physical path'); await ui.objective('Read the silent link in R01', true);
      await ui.walk("The Titan's Workshop"); await ui.click('Talk'); await ui.click('Talk to the Titan'); await ui.click('Skip dialogue');
      await ui.click('Look'); await ui.click('Identify known-good endpoints'); await ui.click('Identify physical path under test');
      await ui.click('Notebook'); await page.getByRole('textbox', { name: 'Hypothesis', exact: true }).fill('Inspect the physical path and compare fresh measurements before declaring restoration.');
      await ui.click('Pin hypothesis'); await page.getByRole('textbox', { name: 'Personal notes', exact: true }).fill(`Independent ${branch} investigation: link indication alone is not service proof.`);
      await ui.click('Close notebook'); await ui.objective('Open the investigation in R02', true);

      if (branch === 'fiber') {
        await ui.walk('The Photon Gardens'); await ui.click('Use'); await ui.click('Read and keep all five supplied compatibility checks');
        await ui.measure(false); await ui.closeDiagnostics();
        await ui.click('Use'); await ui.click('Select the supplied fully matching optic/fiber pair: all five fields match');
        await ui.click('Inspect the original connection at the dock before any intervention');
        await ui.click('Have the dock fit the supplied compatible replacement to the inspected connection');
        await ui.measure(false); await expect(ui.readings().last()).toContainText('Preparation complete: 0 count'); await ui.closeDiagnostics();
        await ui.click('Use'); await ui.click('Reinspect the replaced connection to confirm the diagnosed defect was removed');
        await ui.measure(true); await expect(ui.readings().last()).toContainText('Inspection complete: 1 count'); await ui.closeDiagnostics();
        await ui.objective('Prepare fiber in R05', true);
        await ui.walk('The Prism Vault'); await ui.click('Use'); await ui.click('Read and keep the current compatibility and inspection reminder');
        await ui.click('Diagnostics');
        await expect(ui.diagnostic()).toContainText('Configuration under test: High-loss test path (10 dB total loss).');
        await expect(ui.diagnostic()).toContainText('Proposed solution: Validate passive optical path A.');
        await expect(ui.readings()).toHaveCount(0);
        await ui.click('Take measurement'); await ui.submit(false);
        await expect(ui.diagnostic()).toContainText('Goal: The fiber branch has a matching profile and fresh range/reserve results.');
        await expect(ui.diagnostic()).toContainText('The receive level has insufficient reserve');
        await expect(ui.readings().last()).toContainText('Receive power: -13 dBm');
        await expect(ui.readings().last()).toContainText('Sensitivity reserve: 1 dB');
        await ui.closeDiagnostics(); await ui.click('Use');
        await ui.click('Select passive path A: total loss 8 dB'); await ui.click('Diagnostics'); await ui.click('Take measurement');
        await expect(ui.diagnostic()).toContainText('Configuration under test: Passive path A (8 dB total loss).');
        await expect(ui.readings().first()).toContainText('Stale reading');
        await expect(ui.readings().first()).toContainText('Total passive loss: 10 dB');
        await expect(ui.readings().last()).toContainText('Receive power: -11 dBm'); await ui.closeDiagnostics();
        await ui.click('Use'); await ui.click('Select passive path B: total loss 9 dB'); await ui.click('Diagnostics');
        await expect(ui.diagnostic()).toContainText('Configuration under test: Passive path B (9 dB total loss).');
        await expect(ui.diagnostic()).toContainText('Proposed solution: Validate passive optical path B.');
        await expect(ui.readings().last()).toContainText('Stale reading'); await expect(ui.readings().last().getByRole('button', { name: 'Submit this reading', exact: true })).toBeDisabled();
        await ui.click('Take measurement'); await expect(ui.readings().last()).toContainText('Receive power: -12 dBm');
        await expect(ui.readings().last()).toContainText('Sensitivity reserve: 2 dB'); await expect(ui.readings().last()).toContainText('Total passive loss: 9 dB');
        await ui.submit(true);
        await expect(ui.diagnostic()).toContainText('Goal: The fiber branch has a matching profile and fresh range/reserve results.');
        await page.screenshot({ path: info.outputPath('T081-fiber-boundary.png'), fullPage: true }); await ui.closeDiagnostics();
        await ui.objective('Prove fiber in R06', true); await ui.walk('The Photon Gardens');
      } else {
        await ui.walk('The Skywell'); await ui.click('Use'); await ui.click('Keep the path survey in the notebook'); await ui.click('Keep the endpoint settings card');
        await ui.measure(false); await ui.closeDiagnostics(); await ui.click('Use');
        await ui.click('Select the alternate surveyed path'); await ui.click('Match both endpoint band, channel and PHY settings');
        await ui.measure(true); await expect(ui.readings().last()).toContainText('Viable path: 1 count');
        await expect(ui.readings().last()).toContainText('Compatible settings: 1 count'); await expect(ui.readings().last()).not.toContainText('Signal-to-noise ratio');
        await ui.closeDiagnostics(); await ui.objective('Prepare radio in R07', true);
        await ui.walk('The Storm Observatory'); await ui.click('Use'); await ui.click('Keep the survey and freshness instructions');
        await ui.measure(false); await expect(ui.readings().last()).toContainText('Signal-to-noise ratio: 13 dB'); await ui.closeDiagnostics();
        await ui.click('Use'); await ui.click('Isolate the local emitter and return to surveyed conditions'); await ui.click('Diagnostics'); await ui.click('Take measurement');
        await expect(ui.readings().last()).toContainText('Signal-to-noise ratio: 25 dB'); await ui.closeDiagnostics();
        await ui.click('Use'); await ui.click('Select fictional scenario channel B at both endpoints'); await ui.click('Diagnostics');
        await expect(ui.readings().last()).toContainText('Stale reading'); await expect(ui.readings().last().getByRole('button', { name: 'Submit this reading', exact: true })).toBeDisabled();
        await ui.click('Take measurement'); await expect(ui.readings().last()).toContainText('Received noise: -85 dBm'); await expect(ui.readings().last()).toContainText('Signal-to-noise ratio: 20 dB');
        await ui.submit(true); await page.screenshot({ path: info.outputPath('T081-radio-boundary.png'), fullPage: true }); await ui.closeDiagnostics();
        await ui.objective('Prove radio in R08', true); await ui.walk('The Skywell');
      }
      await ui.walk("The Titan's Workshop", branch === 'fiber' ? 'Walk to The Titan’s Workshop' : "Walk to The Titan's Workshop"); await ui.walk('The Shell Market'); await ui.click('Use');
      await ui.click('Read and record all separate equipment checks'); await ui.click('Select 100/full');
      if (branch === 'fiber') {
        const comparisons = [
          ['Inspect the original 12 W + 11 W + 10 W proposal', 'Original allocation (12 W + 11 W + 10 W)', 'The allocation exceeds the delivered power budget.'],
          ['Inspect the same-shaped, mismatched module at 23 W', 'Same-shaped module (12 W + 11 W)', 'The module fits the socket, but its PHY and media do not match.'],
          ['Inspect the 23 W allocation with a failed port check', 'Per-port test allocation (12 W + 11 W)', 'The supplied per-port check failed.'],
        ] as const;
        for (const [choice, card, reason] of comparisons) {
          await ui.click(choice); await ui.measure(false);
          await expect(ui.diagnostic()).toContainText(`Configuration under test: ${card}.`);
          await expect(ui.diagnostic()).toContainText('Proposed solution: Validate compatible kit A.');
          await expect(ui.diagnostic()).toContainText(reason);
          await ui.closeDiagnostics(); await ui.click('Use');
        }
      }
      await ui.click('Choose complete kit B: 12 W + 11 W + 7 W');
      await ui.measure(true); await expect(ui.readings().last()).toContainText('Total delivered demand: 30 W'); await ui.closeDiagnostics(); await ui.objective('Equip the repair in R09', true);
      await ui.walk("The Titan's Workshop"); await ui.walk('The Clockworks'); await ui.click('Use');
      await ui.click('Read and record the physical-role and upper-layer explanation'); await ui.click('Use untimed step-by-step decoding');
      await ui.click('Explain: sample physical signals representing bits; this does not discover addresses');
      for (const [position, pair] of ['00', '10', '11', '01'].entries()) {
        await ui.click(`Inspect sample position ${position}`); await ui.click(`Write ${pair} for sample position ${position}`);
      }
      await ui.measure(true); await expect(ui.readings().last()).toContainText('Represented bits: 8 bit'); await ui.closeDiagnostics(); await ui.objective('Calibrate in R10', true);
      await ui.walk('The Backhoe Rift', 'Walk toward The Backhoe Rift'); await ui.click('Repair plan');
      await ui.click(branch === 'fiber' ? 'Fiber path B — 9 dB loss' : 'Radio path B — 20 dB SNR');
      await ui.click(branch === 'fiber' ? 'Permanent installation' : 'Temporary installation'); await ui.click('Read and keep plan requirements'); await ui.click('Review current plan');
      await page.getByRole('checkbox', { name: 'I understand that execution changes the route and makes earlier readings stale', exact: true }).check();
      if (branch === 'radio') {
        await ui.click('Execute reviewed plan'); await expect(page.getByRole('dialog', { name: 'Repair plan', exact: true })).toContainText('recorded limitation and follow-up');
        await ui.click('Record temporary dependency and follow-up'); await ui.click('Review current plan');
        await page.getByRole('checkbox', { name: 'I understand that execution changes the route and makes earlier readings stale', exact: true }).check();
      }
      await ui.click('Execute reviewed plan'); await ui.click('Close repair controls'); await ui.objective('Resolve the intervention in R11', true);
      await ui.walk('The Iron Threshold', 'Walk to the validation balcony'); await ui.objective('Validate at R12', false);
      await ui.click('Validate repair'); await ui.click('Read classification criteria');
      const validation = page.getByRole('dialog', { name: 'Validate repair', exact: true });
      const classify = branch === 'fiber' ? 'Classify permanent restoration' : 'Classify temporary restoration';
      await ui.click('Measure repaired link'); await ui.click(classify);
      await expect(validation).toContainText('This objective is in progress. No restored service has been awarded.');
      await ui.click('Run endpoint test'); await expect(validation.locator('ol[aria-label="Repair observations"] > li').last()).toContainText('Endpoint service acknowledged: 1 count');
      await ui.click(classify); await page.screenshot({ path: info.outputPath(`T081-${branch}-validation.png`), fullPage: true });
      const epilogue = page.getByRole('dialog', { name: branch === 'fiber' ? 'The Steady Light' : 'The Borrowed Dawn', exact: true });
      await expect(epilogue).toBeVisible(); await expect(epilogue).toContainText(branch === 'fiber' ? 'Permanent restoration' : 'Temporary restoration');
      await expect(epilogue).toContainText('separate endpoint service test');
      if (branch === 'radio') {
        await expect(epilogue).toContainText('Temporary dependency:'); await expect(epilogue).toContainText('Limitation:'); await expect(epilogue).toContainText('Follow-up:');
      }
      await ui.click('Save'); await expect(page.getByText('Finish the current activity before saving.', { exact: true })).toBeVisible();
      expect(writes).toEqual([]); await closeFrame(page);
      await epilogue.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(epilogue).toBeHidden(); await ui.objective('Validate at R12', true);
      expect(writes).toEqual([]); await ui.click('Save'); await ui.click('Save this adventure'); await expect(page.getByText(/^Saved at /)).toBeVisible();
      const saved = await local.inspectSlot(); expect(saved).not.toBeNull();
      expect(saved!.snapshot.world.completedObjectiveIds.slice().sort()).toEqual(['O01', 'O02', ...(branch === 'fiber' ? ['O05', 'O06'] : ['O07', 'O08']), 'O09', 'O10', 'O11', 'O12'].map(id => `spec001:${id}`).sort());
      expect(saved!.snapshot.world.recruits).toEqual([]); expect(saved!.snapshot.world.completedQuestIds).toEqual([]);
      expect(saved!.snapshot.world.route).toBe(branch); expect(saved!.snapshot.world.flags['spec001:FLAG-repair-classification' as FlagId]).toBe(branch === 'fiber' ? 'permanent' : 'temporary');
      expect(saved!.snapshot.notebook.mapRoomIds).not.toContain('spec001:R03'); expect(saved!.snapshot.notebook.mapRoomIds).not.toContain('spec001:R04');
      const proof = saved!.snapshot.notebook.measurements.filter(m => String(m.ruleId) === (branch === 'fiber' ? 'spec001:PHY06' : 'spec001:PHY07'));
      expect(proof.length).toBeGreaterThan(2); expect(proof.some(m => m.stale)).toBe(true);
      expect(proof.some(m => m.readings.some(r => r.name === (branch === 'fiber' ? 'Receive power' : 'Signal-to-noise ratio') && r.value === (branch === 'fiber' ? -12 : 20) && r.unit === (branch === 'fiber' ? 'dBm' : 'dB')))).toBe(true);
      expect(proof.some(m => m.readings.some(r => r.name === (branch === 'fiber' ? 'Sensitivity reserve' : 'Received noise') && r.value === (branch === 'fiber' ? 2 : -85)))).toBe(true);
      await page.reload(); await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveAttribute('aria-disabled', 'false'); await ui.click('Continue');
      await ui.room('The Iron Threshold'); await ui.objective('Validate at R12', true); expect(writes).toHaveLength(1); expect((await local.inspectSlot())!.raw).toBe(saved!.raw);
    } finally {
      try { await context?.close(); } finally { await local.stop(); }
      expect(errors).toEqual([]); expect(external).toEqual([]);
    }
  });
}

function controls(page: Page) {
  const click = async (name: string) => {
    if (['Scene', 'Evidence', 'Diagnostics', 'Repair plan', 'Validate repair'].includes(name)) await closeFrame(page);
    await (await revealControl(page, name)).click();
  };
  const diagnostic = () => page.getByRole('dialog', { name: 'Diagnostics', exact: true });
  const readings = () => diagnostic().locator('ol[aria-label="Recorded measurements"] > li');
  const submit = async (complete: boolean) => {
    await readings().last().getByRole('button', { name: 'Submit this reading', exact: true }).click();
    if (complete) await expect(diagnostic()).toContainText('Objective complete.');
    else await expect(diagnostic()).not.toContainText('Objective complete.');
  };
  const room = async (name: string) => {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.locator('.nq-graybox')).toHaveAttribute('data-rendered', 'true'); await expect(page.locator('.nq-graybox canvas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  };
  return { click, room, diagnostic, readings, submit,
    closeDiagnostics: () => click('Close diagnostics'),
    walk: async (name: string, label = `Walk to ${name}`) => { await click('Walk'); await click(label); await room(name); },
    measure: async (complete: boolean) => { await click('Diagnostics'); await click('Take measurement'); await submit(complete); },
    objective: async (label: string, complete: boolean) => {
      await click('Notebook'); const row = page.getByRole('dialog', { name: 'Notebook', exact: true }).locator('ul[aria-label="Objectives"] > li').filter({ hasText: label });
      await expect(row).toHaveCount(1); await expect(row).toContainText(complete ? 'Completed' : 'In progress'); await click('Close notebook');
    },
  };
}
