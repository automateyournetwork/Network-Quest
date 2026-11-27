# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: first-repair-route.spec.ts >> T078 guest replacement route uses fresh real evidence through R12
- Location: tests/e2e/first-repair-route.spec.ts:27:3

# Error details

```
Error: expect(locator).toBeFocused() failed

Locator:  getByRole('button', { name: 'Diagnostics', exact: true })
Expected: focused
Received: inactive
Timeout:  5000ms

Call log:
  - Expect "toBeFocused" getByRole('button', { name: 'Diagnostics', exact: true }) with timeout 5000ms
  - waiting for getByRole('button', { name: 'Diagnostics', exact: true })
    14 × locator resolved to <button type="button">Diagnostics</button>
       - unexpected value "inactive"

```

```yaml
- button "Diagnostics"
```

# Test source

```ts
  183 |         await openFrame(page, 'Sound and reading'); await page.getByRole('slider', { name: 'Text size', exact: true }).fill('2'); await closeFrame(page);
  184 |         for (const width of [768, 390]) {
  185 |           await page.setViewportSize({ width, height: 900 });
  186 |           await page.screenshot({ path: info.outputPath(`T078-${width}-200percent-room.png`), fullPage: true });
  187 |           await route.contained();
  188 |           await route.click('Validate repair');
  189 |           await expect(validation).toHaveAttribute('aria-modal', 'true');
  190 |           await validation.getByRole('button', { name: 'Classify permanent restoration', exact: true }).scrollIntoViewIfNeeded();
  191 |           await expect(page.getByRole('button', { name: 'Close repair controls', exact: true })).toBeInViewport();
  192 |           expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  193 |           await page.screenshot({ path: info.outputPath(`T078-${width}-200percent-validation.png`), fullPage: true });
  194 |           await route.click('Close repair controls');
  195 |         }
  196 |         await page.setViewportSize({ width: 1280, height: 900 });
  197 |         await openFrame(page, 'Sound and reading'); await page.getByRole('slider', { name: 'Text size', exact: true }).fill('1'); await closeFrame(page);
  198 |       }
  199 |       await route.click('Notebook');
  200 |       await expect(page.getByRole('textbox', { name: 'Personal notes', exact: true })).toHaveValue(notes);
  201 |       await route.click('Close notebook');
  202 |       expect(writes).toEqual([]);
  203 | 
  204 |       if (variant.authenticated) {
  205 |         await route.click('Save'); await route.click('Save this adventure');
  206 |         await expect(page.getByText(/^Saved at /)).toBeVisible();
  207 |         const saved = await local.inspectSlot(); expect(saved).not.toBeNull();
  208 |         expect(saved!.snapshot.world.completedObjectiveIds).toEqual(expect.arrayContaining(Object.keys(objectiveLabels).map(id => `spec001:${id}`)));
  209 |         for (const id of ['O05', 'O06', 'O07', 'O08']) expect(saved!.snapshot.world.completedObjectiveIds).not.toContain(`spec001:${id}`);
  210 |         expect(saved!.snapshot.notebook.personalNotes).toBe(notes);
  211 |         expect(saved!.snapshot.assistance).toEqual(expect.arrayContaining([expect.objectContaining({ objectiveId: 'spec001:O03', level: 3 })]));
  212 |         expect(saved!.snapshot.notebook.measurements.some(m => m.stale)).toBe(true);
  213 |         await page.reload(); await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveAttribute('aria-disabled', 'false'); await route.click('Continue');
  214 |         await route.room('The Iron Threshold'); await route.objective('O12', true);
  215 |         expect(writes).toHaveLength(1); expect((await local.inspectSlot())!.raw).toBe(saved!.raw);
  216 |       } else expect(await local.inspectSlot()).toBeNull();
  217 |     } finally {
  218 |       try { await context?.close(); } finally { await local.stop(); }
  219 |       expect(errors).toEqual([]); expect(external).toEqual([]);
  220 |     }
  221 |   });
  222 | }
  223 | 
  224 | function controls(page: Page, input: Input) {
  225 |   const button = (name: string) => page.getByRole('button', { name, exact: true });
  226 |   const closeWithKeyboard = async () => {
  227 |     const close = page.locator('.nq-frame-window.nq-window-active .nq-window-close:visible');
  228 |     if (await close.count()) await close.press('Enter');
  229 |   };
  230 |   const revealWithKeyboard = async (name: string) => {
  231 |     const target = button(name), actionable = async () => await target.isVisible() && await target.evaluate(el => !el.closest('[inert]'));
  232 |     if (await actionable()) return target;
  233 |     const scene = await page.locator('.nq-frame-window[aria-label="Scene objects and exits"]').getByRole('button', { name, exact: true, includeHidden: true }).count() > 0;
  234 |     const game = ['New Adventure', 'Continue', 'Restore Save', 'Save', 'Settings', 'Credits'].includes(name);
  235 |     const toolbar = ['Walk', 'Look', 'Talk', 'Use', 'Inventory', 'Notebook', 'Compendium', 'Scene', 'Evidence', 'Diagnostics', 'Repair plan', 'Validate repair'].includes(name);
  236 |     if (scene || game || toolbar) {
  237 |       await closeWithKeyboard();
  238 |       if (await actionable()) return target;
  239 |       if (scene) await button('Scene').press('Enter');
  240 |       else if (game) {
  241 |         const panelGame = page.locator('.nq-window-active .nq-panel-game');
  242 |         await (await panelGame.count() ? panelGame : button('Game')).press('Enter');
  243 |       }
  244 |     }
  245 |     await expect(target).toBeVisible(); return target;
  246 |   };
  247 |   const click = async (name: string) => {
  248 |     // The application-owned panel opener is in the same compact frame toolbar.
  249 |     if (['Scene', 'Evidence', 'Diagnostics', 'Repair plan', 'Validate repair'].includes(name)) {
  250 |       if (input === 'keyboard') await closeWithKeyboard(); else await closeFrame(page);
  251 |     }
  252 |     const control = input === 'keyboard' ? await revealWithKeyboard(name) : await revealControl(page, name);
  253 |     if (input === 'keyboard') await control.press('Enter'); else await control.click();
  254 |   };
  255 |   const room = async (name: string) => {
  256 |     await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  257 |     await expect(page.locator('.nq-graybox')).toHaveAttribute('data-rendered', 'true');
  258 |     await expect(page.locator('.nq-graybox canvas')).toBeVisible();
  259 |     expect(await page.locator('button:visible').evaluateAll(buttons => buttons.every(button => button.closest('.nq-game') !== null))).toBe(true);
  260 |     expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  261 |   };
  262 |   const diagnostic = () => page.getByRole('dialog', { name: 'Diagnostics', exact: true });
  263 |   const readings = () => diagnostic().locator('ol[aria-label="Recorded measurements"] > li');
  264 |   const contained = async () => {
  265 |     expect(await page.locator('.nq-game').evaluate(frame => {
  266 |       const bounds = frame.getBoundingClientRect();
  267 |       return [...frame.querySelectorAll<HTMLElement>('.nq-game-toolbar button:not([hidden])')].every(control => {
  268 |         const box = control.getBoundingClientRect();
  269 |         return box.width === 0 || (box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom);
  270 |       });
  271 |     })).toBe(true);
  272 |     expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  273 |   };
  274 |   const windowBehavior = async (name: 'Diagnostics' | 'Validate repair') => {
  275 |     const panel = page.getByRole('dialog', { name, exact: true });
  276 |     await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
  277 |     expect(await page.locator('.nq-game-toolbar').evaluate(el => !!el.closest('[inert]'))).toBe(true);
  278 |     const game = panel.locator('.nq-panel-game'); await game.press('Enter');
  279 |     await expect(page.getByRole('dialog', { name: 'Game menu', exact: true })).toHaveAttribute('aria-modal', 'true');
  280 |     await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
  281 |     expect(await page.getByRole('dialog', { name, exact: true, includeHidden: true }).evaluate(el => !!el.closest('[inert]'))).toBe(true);
  282 |     await page.keyboard.press('Escape'); await expect(panel).toHaveAttribute('aria-modal', 'true'); await expect(game).toBeFocused();
> 283 |     await page.keyboard.press('Escape'); await expect(panel).toBeHidden(); await expect(button(name)).toBeFocused();
      |                                                                                                       ^ Error: expect(locator).toBeFocused() failed
  284 |     await click(name); await expect(panel).toHaveAttribute('aria-modal', 'true');
  285 |     await page.keyboard.press('Shift+Tab'); expect(await panel.evaluate(el => el.contains(document.activeElement))).toBe(true);
  286 |   };
  287 |   return { click, room, diagnostic, readings, contained, windowBehavior,
  288 |     verb: async (name: 'Walk' | 'Look' | 'Talk' | 'Use') => { await click(name); await expect(button(name)).toHaveAttribute('aria-pressed', 'true'); },
  289 |     walk: async (name: string, label = `Walk to ${name}`) => { await click('Walk'); await click(label); await room(name); },
  290 |     diagnostics: async () => { await click('Diagnostics'); await expect(diagnostic()).toBeVisible(); },
  291 |     closeDiagnostics: async () => { await click('Close diagnostics'); await expect(diagnostic()).toBeHidden(); },
  292 |     submitLatest: async () => { const target = readings().last().getByRole('button', { name: 'Submit this reading', exact: true }); if (input === 'keyboard') await target.press('Enter'); else await target.click(); },
  293 |     objective: async (id: keyof typeof objectiveLabels, complete: boolean) => {
  294 |       await click('Notebook');
  295 |       const row = page.getByRole('dialog', { name: 'Notebook', exact: true }).locator('ul[aria-label="Objectives"] > li').filter({ hasText: objectiveLabels[id] });
  296 |       await expect(row).toHaveCount(1); await expect(row).toContainText(complete ? 'Completed' : 'In progress'); await click('Close notebook');
  297 |     },
  298 |   };
  299 | }
  300 | 
```