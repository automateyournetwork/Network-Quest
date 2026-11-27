# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: independent-repair-routes.spec.ts >> T081 independent radio route reaches validated R12 and restores its one PHP save
- Location: tests/e2e/independent-repair-routes.spec.ts:12:3

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Execute reviewed plan', exact: true })
    - locator resolved to <button disabled type="button">Execute reviewed plan</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    19 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

```

# Test source

```ts
  26  |       });
  27  |       const page = await context.newPage(); page.setDefaultTimeout(10_000); page.on('pageerror', error => errors.push(error.message));
  28  |       const ui = controls(page);
  29  |       await page.goto(local.url); await expect(page.getByText('Synthetic T050 player (github)', { exact: true })).toBeVisible();
  30  |       await ui.click('New Adventure'); await ui.click('Start new adventure'); await ui.room('The Arrival Lift');
  31  |       await ui.click('Look'); await ui.click('Look at power indication'); await ui.click('Look at link indication');
  32  |       await ui.click('Talk'); await ui.click('Talk to Photon the Firefly'); await ui.click('Skip dialogue');
  33  |       await ui.click('Use'); await ui.click('Inspect physical path'); await ui.objective('Read the silent link in R01', true);
  34  |       await ui.walk("The Titan's Workshop"); await ui.click('Talk'); await ui.click('Talk to the Titan'); await ui.click('Skip dialogue');
  35  |       await ui.click('Look'); await ui.click('Identify known-good endpoints'); await ui.click('Identify physical path under test');
  36  |       await ui.click('Notebook'); await page.getByRole('textbox', { name: 'Hypothesis', exact: true }).fill('Inspect the physical path and compare fresh measurements before declaring restoration.');
  37  |       await ui.click('Pin hypothesis'); await page.getByRole('textbox', { name: 'Personal notes', exact: true }).fill(`Independent ${branch} investigation: link indication alone is not service proof.`);
  38  |       await ui.click('Close notebook'); await ui.objective('Open the investigation in R02', true);
  39  | 
  40  |       if (branch === 'fiber') {
  41  |         await ui.walk('The Photon Gardens'); await ui.click('Use'); await ui.click('Read and keep all five supplied compatibility checks');
  42  |         await ui.measure(false); await ui.closeDiagnostics();
  43  |         await ui.click('Use'); await ui.click('Select the supplied fully matching optic/fiber pair: all five fields match');
  44  |         await ui.click('Inspect the original connection at the dock before any intervention');
  45  |         await ui.click('Have the dock fit the supplied compatible replacement to the inspected connection');
  46  |         await ui.measure(false); await expect(ui.readings().last()).toContainText('Preparation complete: 0 count'); await ui.closeDiagnostics();
  47  |         await ui.click('Use'); await ui.click('Reinspect the replaced connection to confirm the diagnosed defect was removed');
  48  |         await ui.measure(true); await expect(ui.readings().last()).toContainText('Inspection complete: 1 count'); await ui.closeDiagnostics();
  49  |         await ui.objective('Prepare fiber in R05', true);
  50  |         await ui.walk('The Prism Vault'); await ui.click('Use'); await ui.click('Read and keep the current compatibility and inspection reminder');
  51  |         await ui.click('Select passive path A: total loss 8 dB'); await ui.click('Diagnostics'); await ui.click('Take measurement');
  52  |         await expect(ui.readings().last()).toContainText('Receive power: -11 dBm'); await ui.closeDiagnostics();
  53  |         await ui.click('Use'); await ui.click('Select passive path B: total loss 9 dB'); await ui.click('Diagnostics');
  54  |         await expect(ui.readings().last()).toContainText('Stale reading'); await expect(ui.readings().last().getByRole('button', { name: 'Submit this reading', exact: true })).toBeDisabled();
  55  |         await ui.click('Take measurement'); await expect(ui.readings().last()).toContainText('Receive power: -12 dBm');
  56  |         await expect(ui.readings().last()).toContainText('Sensitivity reserve: 2 dB'); await expect(ui.readings().last()).toContainText('Total passive loss: 9 dB');
  57  |         await ui.submit(true); await page.screenshot({ path: info.outputPath('T081-fiber-boundary.png'), fullPage: true }); await ui.closeDiagnostics();
  58  |         await ui.objective('Prove fiber in R06', true); await ui.walk('The Photon Gardens');
  59  |       } else {
  60  |         await ui.walk('The Skywell'); await ui.click('Use'); await ui.click('Keep the path survey in the notebook'); await ui.click('Keep the endpoint settings card');
  61  |         await ui.measure(false); await ui.closeDiagnostics(); await ui.click('Use');
  62  |         await ui.click('Select the alternate surveyed path'); await ui.click('Match both endpoint band, channel and PHY settings');
  63  |         await ui.measure(true); await expect(ui.readings().last()).toContainText('Viable path: 1 count');
  64  |         await expect(ui.readings().last()).toContainText('Compatible settings: 1 count'); await expect(ui.readings().last()).not.toContainText('Signal-to-noise ratio');
  65  |         await ui.closeDiagnostics(); await ui.objective('Prepare radio in R07', true);
  66  |         await ui.walk('The Storm Observatory'); await ui.click('Use'); await ui.click('Keep the survey and freshness instructions');
  67  |         await ui.measure(false); await expect(ui.readings().last()).toContainText('Signal-to-noise ratio: 13 dB'); await ui.closeDiagnostics();
  68  |         await ui.click('Use'); await ui.click('Isolate the local emitter and return to surveyed conditions'); await ui.click('Diagnostics'); await ui.click('Take measurement');
  69  |         await expect(ui.readings().last()).toContainText('Signal-to-noise ratio: 25 dB'); await ui.closeDiagnostics();
  70  |         await ui.click('Use'); await ui.click('Select fictional scenario channel B at both endpoints'); await ui.click('Diagnostics');
  71  |         await expect(ui.readings().last()).toContainText('Stale reading'); await expect(ui.readings().last().getByRole('button', { name: 'Submit this reading', exact: true })).toBeDisabled();
  72  |         await ui.click('Take measurement'); await expect(ui.readings().last()).toContainText('Received noise: -85 dBm'); await expect(ui.readings().last()).toContainText('Signal-to-noise ratio: 20 dB');
  73  |         await ui.submit(true); await page.screenshot({ path: info.outputPath('T081-radio-boundary.png'), fullPage: true }); await ui.closeDiagnostics();
  74  |         await ui.objective('Prove radio in R08', true); await ui.walk('The Skywell');
  75  |       }
  76  |       await ui.walk("The Titan's Workshop"); await ui.walk('The Shell Market'); await ui.click('Use');
  77  |       await ui.click('Read and record all separate equipment checks'); await ui.click('Select 100/full'); await ui.click('Choose complete kit B: 12 W + 11 W + 7 W');
  78  |       await ui.measure(true); await expect(ui.readings().last()).toContainText('Total delivered demand: 30 W'); await ui.closeDiagnostics(); await ui.objective('Equip the repair in R09', true);
  79  |       await ui.walk("The Titan's Workshop"); await ui.walk('The Clockworks'); await ui.click('Use');
  80  |       await ui.click('Read and record the physical-role and upper-layer explanation'); await ui.click('Use untimed step-by-step decoding');
  81  |       await ui.click('Explain: sample physical signals representing bits; this does not discover addresses');
  82  |       for (const [position, pair] of ['00', '10', '11', '01'].entries()) {
  83  |         await ui.click(`Inspect sample position ${position}`); await ui.click(`Write ${pair} for sample position ${position}`);
  84  |       }
  85  |       await ui.measure(true); await expect(ui.readings().last()).toContainText('Represented bits: 8 bit'); await ui.closeDiagnostics(); await ui.objective('Calibrate in R10', true);
  86  |       await ui.walk('The Backhoe Rift', 'Walk toward The Backhoe Rift'); await ui.click('Repair plan');
  87  |       await ui.click(branch === 'fiber' ? 'Fiber path B — 9 dB loss' : 'Radio path B — 20 dB SNR');
  88  |       await ui.click(branch === 'fiber' ? 'Permanent installation' : 'Temporary installation'); await ui.click('Read and keep plan requirements'); await ui.click('Review current plan');
  89  |       await page.getByRole('checkbox', { name: 'I understand that execution changes the route and makes earlier readings stale', exact: true }).check();
  90  |       if (branch === 'radio') {
  91  |         await ui.click('Execute reviewed plan'); await expect(page.getByRole('dialog', { name: 'Repair plan', exact: true })).toContainText('recorded limitation and follow-up');
  92  |         await ui.click('Record temporary dependency and follow-up'); await ui.click('Review current plan');
  93  |       }
  94  |       await ui.click('Execute reviewed plan'); await ui.click('Close repair controls'); await ui.objective('Resolve the intervention in R11', true);
  95  |       await ui.walk('The Iron Threshold', 'Walk to the validation balcony'); await ui.objective('Validate at R12', false);
  96  |       await ui.click('Validate repair'); await ui.click('Read classification criteria');
  97  |       const validation = page.getByRole('dialog', { name: 'Validate repair', exact: true });
  98  |       const classify = branch === 'fiber' ? 'Classify permanent restoration' : 'Classify temporary restoration';
  99  |       await ui.click('Measure repaired link'); await ui.click(classify);
  100 |       await expect(validation).toContainText('This objective is in progress. No restored service has been awarded.');
  101 |       await ui.click('Run endpoint test'); await expect(validation.locator('ol[aria-label="Repair observations"] > li').last()).toContainText('Endpoint service acknowledged: 1 count');
  102 |       await ui.click(classify); await page.screenshot({ path: info.outputPath(`T081-${branch}-validation.png`), fullPage: true });
  103 |       await ui.click('Close repair controls'); await ui.objective('Validate at R12', true);
  104 |       expect(writes).toEqual([]); await ui.click('Save'); await ui.click('Save this adventure'); await expect(page.getByText(/^Saved at /)).toBeVisible();
  105 |       const saved = await local.inspectSlot(); expect(saved).not.toBeNull();
  106 |       expect(saved!.snapshot.world.completedObjectiveIds.slice().sort()).toEqual(['O01', 'O02', ...(branch === 'fiber' ? ['O05', 'O06'] : ['O07', 'O08']), 'O09', 'O10', 'O11', 'O12'].map(id => `spec001:${id}`).sort());
  107 |       expect(saved!.snapshot.world.recruits).toEqual([]); expect(saved!.snapshot.world.completedQuestIds).toEqual([]);
  108 |       expect(saved!.snapshot.world.route).toBe(branch); expect(saved!.snapshot.world.flags['spec001:FLAG-repair-classification' as FlagId]).toBe(branch === 'fiber' ? 'permanent' : 'temporary');
  109 |       expect(saved!.snapshot.notebook.mapRoomIds).not.toContain('spec001:R03'); expect(saved!.snapshot.notebook.mapRoomIds).not.toContain('spec001:R04');
  110 |       const proof = saved!.snapshot.notebook.measurements.filter(m => String(m.ruleId) === (branch === 'fiber' ? 'spec001:PHY06' : 'spec001:PHY07'));
  111 |       expect(proof.length).toBeGreaterThan(2); expect(proof.some(m => m.stale)).toBe(true);
  112 |       expect(proof.some(m => m.readings.some(r => r.name === (branch === 'fiber' ? 'Receive power' : 'Signal-to-noise ratio') && r.value === (branch === 'fiber' ? -12 : 20) && r.unit === (branch === 'fiber' ? 'dBm' : 'dB')))).toBe(true);
  113 |       expect(proof.some(m => m.readings.some(r => r.name === (branch === 'fiber' ? 'Sensitivity reserve' : 'Received noise') && r.value === (branch === 'fiber' ? 2 : -85)))).toBe(true);
  114 |       await page.reload(); await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveAttribute('aria-disabled', 'false'); await ui.click('Continue');
  115 |       await ui.room('The Iron Threshold'); await ui.objective('Validate at R12', true); expect(writes).toHaveLength(1); expect((await local.inspectSlot())!.raw).toBe(saved!.raw);
  116 |     } finally {
  117 |       try { await context?.close(); } finally { await local.stop(); }
  118 |       expect(errors).toEqual([]); expect(external).toEqual([]);
  119 |     }
  120 |   });
  121 | }
  122 | 
  123 | function controls(page: Page) {
  124 |   const click = async (name: string) => {
  125 |     if (['Scene', 'Evidence', 'Diagnostics', 'Repair plan', 'Validate repair'].includes(name)) await closeFrame(page);
> 126 |     await (await revealControl(page, name)).click();
      |                                             ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
  127 |   };
  128 |   const diagnostic = () => page.getByRole('dialog', { name: 'Diagnostics', exact: true });
  129 |   const readings = () => diagnostic().locator('ol[aria-label="Recorded measurements"] > li');
  130 |   const submit = async (complete: boolean) => {
  131 |     await readings().last().getByRole('button', { name: 'Submit this reading', exact: true }).click();
  132 |     if (complete) await expect(diagnostic()).toContainText('Objective complete.');
  133 |     else await expect(diagnostic()).not.toContainText('Objective complete.');
  134 |   };
  135 |   const room = async (name: string) => {
  136 |     await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  137 |     await expect(page.locator('.nq-graybox')).toHaveAttribute('data-rendered', 'true'); await expect(page.locator('.nq-graybox canvas')).toBeVisible();
  138 |     expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  139 |   };
  140 |   return { click, room, readings, submit,
  141 |     closeDiagnostics: () => click('Close diagnostics'),
  142 |     walk: async (name: string, label = `Walk to ${name}`) => { await click('Walk'); await click(label); await room(name); },
  143 |     measure: async (complete: boolean) => { await click('Diagnostics'); await click('Take measurement'); await submit(complete); },
  144 |     objective: async (label: string, complete: boolean) => {
  145 |       await click('Notebook'); const row = page.getByRole('dialog', { name: 'Notebook', exact: true }).locator('ul[aria-label="Objectives"] > li').filter({ hasText: label });
  146 |       await expect(row).toHaveCount(1); await expect(row).toContainText(complete ? 'Completed' : 'In progress'); await click('Close notebook');
  147 |     },
  148 |   };
  149 | }
  150 | 
```