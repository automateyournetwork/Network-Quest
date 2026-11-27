# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: first-repair-route.spec.ts >> T078 guest replacement route uses fresh real evidence through R12
- Location: tests/e2e/first-repair-route.spec.ts:27:3

# Error details

```
Error: frame.evaluate: Page crashed
```

# Test source

```ts
  96  |       await route.closeDiagnostics();
  97  |       await route.verb('Use'); await route.click('Select the intact alternate path: 90 m + 10 m');
  98  |       await route.diagnostics();
  99  |       await expect(route.readings().filter({ hasText: 'Total channel length: 95 m' })).toContainText('Stale reading');
  100 |       await expect(route.readings().filter({ hasText: 'Total channel length: 95 m' }).getByRole('button', { name: 'Submit this reading', exact: true })).toBeDisabled();
  101 |       await route.closeDiagnostics();
  102 |       if (variant.length === 95) { await route.verb('Use'); await route.click('Fit the supplied replacement section: 85 m + 10 m'); }
  103 |       await route.diagnostics(); await route.click('Take measurement');
  104 |       await expect(route.readings().last()).toContainText(`Total channel length: ${variant.length} m`);
  105 |       await expect(route.readings().last()).toContainText('Open required conductors: 0 count');
  106 |       await route.submitLatest(); await expect(route.diagnostic()).toContainText('Objective complete.');
  107 |       await route.closeDiagnostics(); await route.objective('O03', true);
  108 | 
  109 |       await route.walk('The Echo Cavern'); await route.verb('Use');
  110 |       await route.click('Read and keep the before-record instructions; retain an actual measured open result');
  111 |       await route.click('Read and keep the repeater role and limits');
  112 |       await route.click('Propose: a powered repeater alone bridges the unchanged severed conductor');
  113 |       await route.diagnostics(); await route.click('Take measurement'); await route.submitLatest();
  114 |       await expect(route.diagnostic()).not.toContainText('Objective complete.');
  115 |       await route.closeDiagnostics(); await route.verb('Use');
  116 |       await route.click('Conclude: a repeater needs the physical connection restored');
  117 |       await route.diagnostics(); await route.click('Take measurement');
  118 |       await expect(route.readings().last()).toContainText('Historical open recorded: 1 count');
  119 |       await route.submitLatest(); await expect(route.diagnostic()).toContainText('Objective complete.');
  120 |       await route.closeDiagnostics(); await route.objective('O04', true);
  121 | 
  122 |       await route.walk('The Copper Warrens'); await route.walk("The Titan's Workshop"); await route.walk('The Shell Market');
  123 |       await route.verb('Use'); await route.click('Read and record all separate equipment checks');
  124 |       await route.click('Select 100/full'); await route.click('Inspect the original 12 W + 11 W + 10 W proposal');
  125 |       await route.diagnostics(); await route.click('Take measurement');
  126 |       await expect(route.readings().last()).toContainText('Total delivered demand: 33 W');
  127 |       await expect(route.readings().last()).toContainText('Delivered excess: 3 W');
  128 |       await route.submitLatest(); await expect(route.diagnostic()).not.toContainText('Objective complete.');
  129 |       await route.closeDiagnostics(); await route.verb('Use');
  130 |       await route.click(variant.length === 95 ? 'Choose complete kit A: 12 W + 11 W' : 'Choose complete kit B: 12 W + 11 W + 7 W');
  131 |       await route.diagnostics(); await route.click('Take measurement'); await route.submitLatest();
  132 |       await expect(route.diagnostic()).toContainText('Objective complete.'); await route.closeDiagnostics();
  133 |       await route.objective('O09', true);
  134 | 
  135 |       await route.walk("The Titan's Workshop"); await route.walk('The Clockworks'); await route.verb('Use');
  136 |       await route.click('Read and record the physical-role and upper-layer explanation');
  137 |       await route.click('Use untimed step-by-step decoding');
  138 |       await route.click('Explain: sample physical signals representing bits; this does not discover addresses');
  139 |       for (const [position, pair] of ['00', '10', '11', '01'].entries()) {
  140 |         await route.click(`Inspect sample position ${position}`); await route.click('Evidence');
  141 |         await expect(page.locator('.nq-shell-captions')).toContainText(`Sample position ${position}: ${[-3, 1, 3, -1][position]} toy-level represents ${pair}.`);
  142 |         await route.verb('Use'); await route.click(`Write ${pair} for sample position ${position}`);
  143 |       }
  144 |       await route.click('Replay from the first sample without changing my answer');
  145 |       await route.diagnostics(); await route.click('Take measurement');
  146 |       await expect(route.readings().last()).toContainText('Represented bits: 8 bit');
  147 |       await expect(route.readings().last()).toContainText('Symbols decoded: 4 symbol');
  148 |       await route.submitLatest(); await expect(route.diagnostic()).toContainText('Objective complete.');
  149 |       await route.closeDiagnostics(); await route.objective('O10', true);
  150 |       await route.walk('The Backhoe Rift', 'Walk toward The Backhoe Rift');
  151 | 
  152 |       // Explicit plan and duration precede the actual intervention. Arrival at
  153 |       // the next room is never a substitute for separately measured validation.
  154 |       await route.click('Repair plan');
  155 |       if (variant.authenticated) {
  156 |         await route.click('Fiber path A — 8 dB loss'); await route.click('Permanent installation'); await route.click('Review current plan');
  157 |         await expect(page.getByRole('dialog', { name: 'Repair plan', exact: true }).locator('ol[aria-label="Repair observations"] > li')).toHaveCount(0);
  158 |       }
  159 |       await route.click(variant.length === 95 ? 'Copper replacement — 95 m' : 'Copper alternate — 100 m');
  160 |       await route.click('Permanent installation');
  161 |       await route.click('Read and keep plan requirements');
  162 |       await route.click('Review current plan');
  163 |       const warning = page.getByRole('checkbox', { name: 'I understand that execution changes the route and makes earlier readings stale', exact: true });
  164 |       if (variant.input === 'keyboard') { await warning.focus(); await warning.press('Space'); } else await warning.check();
  165 |       await route.click('Execute reviewed plan');
  166 |       await route.click('Close repair controls');
  167 |       await route.objective('O11', true);
  168 |       await route.walk('The Iron Threshold', 'Walk to the validation balcony'); await route.objective('O12', false);
  169 |       await route.click('Validate repair'); await route.click('Read classification criteria');
  170 |       const validation = page.getByRole('dialog', { name: 'Validate repair', exact: true });
  171 |       await route.windowBehavior('Validate repair');
  172 |       await route.click('Classify permanent restoration');
  173 |       await expect(validation).toContainText('This objective is in progress. No restored service has been awarded.');
  174 |       await route.click('Measure repaired link');
  175 |       await expect(validation.locator('ol[aria-label="Repair observations"] > li').last()).toContainText('Recovered highlighted bits: 16 bit');
  176 |       await expect(validation.locator('ol[aria-label="Repair observations"] > li').last()).toContainText('Differing highlighted positions: 0 count');
  177 |       await route.click('Classify permanent restoration');
  178 |       await expect(validation).toContainText('This objective is in progress. No restored service has been awarded.');
  179 |       await route.click('Run endpoint test');
  180 |       await expect(validation.locator('ol[aria-label="Repair observations"] > li').last()).toContainText('Endpoint service acknowledged: 1 count');
  181 |       await route.click('Classify permanent restoration');
  182 |       await page.screenshot({ path: info.outputPath(`T078-${variant.length}m-validation.png`), fullPage: true });
  183 |       await route.click('Close repair controls'); await route.objective('O12', true);
  184 |       await page.screenshot({ path: info.outputPath(`T078-${variant.length}m-complete.png`), fullPage: true });
  185 |       if (!variant.authenticated) {
  186 |         await openFrame(page, 'Sound and reading'); await page.getByRole('slider', { name: 'Text size', exact: true }).fill('2'); await closeFrame(page);
  187 |         for (const width of [768, 390]) {
  188 |           await page.setViewportSize({ width, height: 900 });
  189 |           await page.screenshot({ path: info.outputPath(`T078-${width}-200percent-room.png`), fullPage: true });
  190 |           await route.contained();
  191 |           await route.click('Validate repair');
  192 |           await expect(validation).toHaveAttribute('aria-modal', 'true');
  193 |           await validation.getByRole('button', { name: 'Classify permanent restoration', exact: true }).scrollIntoViewIfNeeded();
  194 |           await expect(page.getByRole('button', { name: 'Close repair controls', exact: true })).toBeInViewport();
  195 |           await page.screenshot({ path: info.outputPath(`T078-${width}-200percent-validation.png`), fullPage: true });
> 196 |           expect((await new AxeBuilder({ page }).include('[aria-modal="true"]').analyze()).violations).toEqual([]);
      |                   ^ Error: frame.evaluate: Page crashed
  197 |           await route.click('Close repair controls');
  198 |         }
  199 |         await page.setViewportSize({ width: 1280, height: 900 });
  200 |         await openFrame(page, 'Sound and reading'); await page.getByRole('slider', { name: 'Text size', exact: true }).fill('1'); await closeFrame(page);
  201 |       }
  202 |       await route.click('Notebook');
  203 |       await expect(page.getByRole('textbox', { name: 'Personal notes', exact: true })).toHaveValue(notes);
  204 |       await route.click('Close notebook');
  205 |       expect(writes).toEqual([]);
  206 | 
  207 |       if (variant.authenticated) {
  208 |         await route.click('Save'); await route.click('Save this adventure');
  209 |         await expect(page.getByText(/^Saved at /)).toBeVisible();
  210 |         const saved = await local.inspectSlot(); expect(saved).not.toBeNull();
  211 |         expect(saved!.snapshot.world.completedObjectiveIds).toEqual(expect.arrayContaining(Object.keys(objectiveLabels).map(id => `spec001:${id}`)));
  212 |         for (const id of ['O05', 'O06', 'O07', 'O08']) expect(saved!.snapshot.world.completedObjectiveIds).not.toContain(`spec001:${id}`);
  213 |         expect(saved!.snapshot.notebook.personalNotes).toBe(notes);
  214 |         expect(saved!.snapshot.assistance).toEqual(expect.arrayContaining([expect.objectContaining({ objectiveId: 'spec001:O03', level: 3 })]));
  215 |         expect(saved!.snapshot.notebook.measurements.some(m => m.stale)).toBe(true);
  216 |         await page.reload(); await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveAttribute('aria-disabled', 'false'); await route.click('Continue');
  217 |         await route.room('The Iron Threshold'); await route.objective('O12', true);
  218 |         expect(writes).toHaveLength(1); expect((await local.inspectSlot())!.raw).toBe(saved!.raw);
  219 |       } else expect(await local.inspectSlot()).toBeNull();
  220 |     } finally {
  221 |       try { await context?.close(); } finally { await local.stop(); }
  222 |       expect(errors).toEqual([]); expect(external).toEqual([]);
  223 |     }
  224 |   });
  225 | }
  226 | 
  227 | function controls(page: Page, input: Input) {
  228 |   const button = (name: string) => page.getByRole('button', { name, exact: true });
  229 |   const closeWithKeyboard = async () => {
  230 |     const close = page.locator('.nq-frame-window.nq-window-active .nq-window-close:visible');
  231 |     if (await close.count()) await close.press('Enter');
  232 |   };
  233 |   const revealWithKeyboard = async (name: string) => {
  234 |     const target = button(name), actionable = async () => await target.isVisible() && await target.evaluate(el => !el.closest('[inert]'));
  235 |     if (await actionable()) return target;
  236 |     const scene = await page.locator('.nq-frame-window[aria-label="Scene objects and exits"]').getByRole('button', { name, exact: true, includeHidden: true }).count() > 0;
  237 |     const game = ['New Adventure', 'Continue', 'Restore Save', 'Save', 'Settings', 'Credits'].includes(name);
  238 |     const toolbar = ['Walk', 'Look', 'Talk', 'Use', 'Inventory', 'Notebook', 'Compendium', 'Scene', 'Evidence', 'Diagnostics', 'Repair plan', 'Validate repair'].includes(name);
  239 |     if (scene || game || toolbar) {
  240 |       await closeWithKeyboard();
  241 |       if (await actionable()) return target;
  242 |       if (scene) await button('Scene').press('Enter');
  243 |       else if (game) {
  244 |         const panelGame = page.locator('.nq-window-active .nq-panel-game');
  245 |         await (await panelGame.count() ? panelGame : button('Game')).press('Enter');
  246 |       }
  247 |     }
  248 |     await expect(target).toBeVisible(); return target;
  249 |   };
  250 |   const click = async (name: string) => {
  251 |     // The application-owned panel opener is in the same compact frame toolbar.
  252 |     if (['Scene', 'Evidence', 'Diagnostics', 'Repair plan', 'Validate repair'].includes(name)) {
  253 |       if (input === 'keyboard') await closeWithKeyboard(); else await closeFrame(page);
  254 |     }
  255 |     const control = input === 'keyboard' ? await revealWithKeyboard(name) : await revealControl(page, name);
  256 |     if (input === 'keyboard') await control.press('Enter'); else await control.click();
  257 |   };
  258 |   const room = async (name: string) => {
  259 |     await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  260 |     await expect(page.locator('.nq-graybox')).toHaveAttribute('data-rendered', 'true');
  261 |     await expect(page.locator('.nq-graybox canvas')).toBeVisible();
  262 |     expect(await page.locator('button:visible').evaluateAll(buttons => buttons.every(button => button.closest('.nq-game') !== null))).toBe(true);
  263 |     expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  264 |   };
  265 |   const diagnostic = () => page.getByRole('dialog', { name: 'Diagnostics', exact: true });
  266 |   const readings = () => diagnostic().locator('ol[aria-label="Recorded measurements"] > li');
  267 |   const contained = async () => {
  268 |     expect(await page.locator('.nq-game').evaluate(frame => {
  269 |       const bounds = frame.getBoundingClientRect();
  270 |       return [...frame.querySelectorAll<HTMLElement>('.nq-game-toolbar button:not([hidden])')].every(control => {
  271 |         const box = control.getBoundingClientRect();
  272 |         return box.width === 0 || (box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom);
  273 |       });
  274 |     })).toBe(true);
  275 |     expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  276 |   };
  277 |   const windowBehavior = async (name: 'Diagnostics' | 'Validate repair') => {
  278 |     const panel = page.getByRole('dialog', { name, exact: true });
  279 |     await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
  280 |     expect(await page.locator('.nq-game-toolbar').evaluate(el => !!el.closest('[inert]'))).toBe(true);
  281 |     const game = panel.locator('.nq-panel-game'); await game.press('Enter');
  282 |     await expect(page.getByRole('dialog', { name: 'Game menu', exact: true })).toHaveAttribute('aria-modal', 'true');
  283 |     await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
  284 |     expect(await page.getByRole('dialog', { name, exact: true, includeHidden: true }).evaluate(el => !!el.closest('[inert]'))).toBe(true);
  285 |     await page.keyboard.press('Escape'); await expect(panel).toHaveAttribute('aria-modal', 'true'); await expect(game).toBeFocused();
  286 |     await page.keyboard.press('Escape'); await expect(panel).toBeHidden(); await expect(button(name)).toBeFocused();
  287 |     await click(name); await expect(panel).toHaveAttribute('aria-modal', 'true');
  288 |     await page.keyboard.press('Shift+Tab'); expect(await panel.evaluate(el => el.contains(document.activeElement))).toBe(true);
  289 |   };
  290 |   return { click, room, diagnostic, readings, contained, windowBehavior,
  291 |     verb: async (name: 'Walk' | 'Look' | 'Talk' | 'Use') => { await click(name); await expect(button(name)).toHaveAttribute('aria-pressed', 'true'); },
  292 |     walk: async (name: string, label = `Walk to ${name}`) => { await click('Walk'); await click(label); await room(name); },
  293 |     diagnostics: async () => { await click('Diagnostics'); await expect(diagnostic()).toBeVisible(); },
  294 |     closeDiagnostics: async () => { await click('Close diagnostics'); await expect(diagnostic()).toBeHidden(); },
  295 |     submitLatest: async () => { const target = readings().last().getByRole('button', { name: 'Submit this reading', exact: true }); if (input === 'keyboard') await target.press('Enter'); else await target.click(); },
  296 |     objective: async (id: keyof typeof objectiveLabels, complete: boolean) => {
```