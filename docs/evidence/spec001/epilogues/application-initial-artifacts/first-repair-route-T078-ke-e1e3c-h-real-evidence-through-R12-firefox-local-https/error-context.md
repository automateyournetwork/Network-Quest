# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: first-repair-route.spec.ts >> T078 keyboard alternate route with saved restoration uses fresh real evidence through R12
- Location: tests/e2e/first-repair-route.spec.ts:26:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('[aria-modal="true"]')
Expected: 1
Received: 3
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" locator('[aria-modal="true"]') with timeout 5000ms
  - waiting for locator('[aria-modal="true"]')
    14 × locator resolved to 3 elements
       - unexpected value "3"

```

# Test source

```ts
  194 |       if (!variant.authenticated) {
  195 |         await openFrame(page, 'Sound and reading'); await page.getByRole('slider', { name: 'Text size', exact: true }).fill('2'); await closeFrame(page);
  196 |         for (const width of [768, 390]) {
  197 |           await page.setViewportSize({ width, height: 900 });
  198 |           await page.screenshot({ path: info.outputPath(`T078-${width}-200percent-room.png`), fullPage: true });
  199 |           await route.contained();
  200 |           await route.click('Validate repair');
  201 |           await expect(validation).toHaveAttribute('aria-modal', 'true');
  202 |           await validation.getByRole('button', { name: 'Classify permanent restoration', exact: true }).scrollIntoViewIfNeeded();
  203 |           await expect(page.getByRole('button', { name: 'Close repair controls', exact: true })).toBeInViewport();
  204 |           await page.screenshot({ path: info.outputPath(`T078-${width}-200percent-validation.png`), fullPage: true });
  205 |           const closeBox = (await page.getByRole('button', { name: 'Close repair controls', exact: true }).boundingBox())!;
  206 |           const gameBox = (await validation.locator('.nq-panel-game').boundingBox())!;
  207 |           expect(closeBox.x + closeBox.width <= gameBox.x || gameBox.x + gameBox.width <= closeBox.x
  208 |             || closeBox.y + closeBox.height <= gameBox.y || gameBox.y + gameBox.height <= closeBox.y).toBe(true);
  209 |           // The full-page and active-dialog axe attempts crash this Firefox
  210 |           // renderer; first-route.md records that unresolved T152 audit. Keep
  211 |           // actual keyboard, focus, scroll and bounds assertions executable.
  212 |           await route.click('Close repair controls');
  213 |         }
  214 |         await page.setViewportSize({ width: 1280, height: 900 });
  215 |         await openFrame(page, 'Sound and reading'); await page.getByRole('slider', { name: 'Text size', exact: true }).fill('1'); await closeFrame(page);
  216 |       }
  217 |       await route.click('Notebook');
  218 |       await expect(page.getByRole('textbox', { name: 'Personal notes', exact: true })).toHaveValue(notes);
  219 |       await route.click('Close notebook');
  220 |       expect(writes).toEqual([]);
  221 | 
  222 |       if (variant.authenticated) {
  223 |         await route.click('Save'); await route.click('Save this adventure');
  224 |         await expect(page.getByText(/^Saved at /)).toBeVisible();
  225 |         const saved = await local.inspectSlot(); expect(saved).not.toBeNull();
  226 |         expect(saved!.snapshot.world.completedObjectiveIds).toEqual(expect.arrayContaining(Object.keys(objectiveLabels).map(id => `spec001:${id}`)));
  227 |         for (const id of ['O05', 'O06', 'O07', 'O08']) expect(saved!.snapshot.world.completedObjectiveIds).not.toContain(`spec001:${id}`);
  228 |         expect(saved!.snapshot.notebook.personalNotes).toBe(notes);
  229 |         expect(saved!.snapshot.assistance).toEqual(expect.arrayContaining([expect.objectContaining({ objectiveId: 'spec001:O03', level: 3 })]));
  230 |         expect(saved!.snapshot.notebook.measurements.some(m => m.stale)).toBe(true);
  231 |         await page.reload(); await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveAttribute('aria-disabled', 'false'); await route.click('Continue');
  232 |         await route.room('The Iron Threshold'); await route.objective('O12', true);
  233 |         expect(writes).toHaveLength(1); expect((await local.inspectSlot())!.raw).toBe(saved!.raw);
  234 |       } else expect(await local.inspectSlot()).toBeNull();
  235 |     } finally {
  236 |       try { await context?.close(); } finally { await local.stop(); }
  237 |       expect(errors).toEqual([]); expect(external).toEqual([]);
  238 |     }
  239 |   });
  240 | }
  241 | 
  242 | function controls(page: Page, input: Input) {
  243 |   const button = (name: string) => page.getByRole('button', { name, exact: true });
  244 |   const closeWithKeyboard = async () => {
  245 |     const close = page.locator('.nq-frame-window.nq-window-active .nq-window-close:visible');
  246 |     if (await close.count()) await close.press('Enter');
  247 |   };
  248 |   const revealWithKeyboard = async (name: string) => {
  249 |     const target = button(name), actionable = async () => await target.isVisible() && await target.evaluate(el => !el.closest('[inert]'));
  250 |     if (await actionable()) return target;
  251 |     const scene = await page.locator('.nq-frame-window[aria-label="Scene objects and exits"]').getByRole('button', { name, exact: true, includeHidden: true }).count() > 0;
  252 |     const game = ['New Adventure', 'Continue', 'Restore Save', 'Save', 'Settings', 'Credits'].includes(name);
  253 |     const toolbar = ['Walk', 'Look', 'Talk', 'Use', 'Inventory', 'Notebook', 'Compendium', 'Scene', 'Evidence', 'Diagnostics', 'Repair plan', 'Validate repair'].includes(name);
  254 |     if (scene || game || toolbar) {
  255 |       await closeWithKeyboard();
  256 |       if (await actionable()) return target;
  257 |       if (scene) await button('Scene').press('Enter');
  258 |       else if (game) {
  259 |         const panelGame = page.locator('.nq-window-active .nq-panel-game');
  260 |         await (await panelGame.count() ? panelGame : button('Game')).press('Enter');
  261 |       }
  262 |     }
  263 |     await expect(target).toBeVisible(); return target;
  264 |   };
  265 |   const click = async (name: string) => {
  266 |     // The application-owned panel opener is in the same compact frame toolbar.
  267 |     if (['Scene', 'Evidence', 'Diagnostics', 'Repair plan', 'Validate repair'].includes(name)) {
  268 |       if (input === 'keyboard') await closeWithKeyboard(); else await closeFrame(page);
  269 |     }
  270 |     const control = input === 'keyboard' ? await revealWithKeyboard(name) : await revealControl(page, name);
  271 |     if (input === 'keyboard') await control.press('Enter'); else await control.click();
  272 |   };
  273 |   const room = async (name: string) => {
  274 |     await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  275 |     await expect(page.locator('.nq-graybox')).toHaveAttribute('data-rendered', 'true');
  276 |     await expect(page.locator('.nq-graybox canvas')).toBeVisible();
  277 |     expect(await page.locator('button:visible').evaluateAll(buttons => buttons.every(button => button.closest('.nq-game') !== null))).toBe(true);
  278 |     expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  279 |   };
  280 |   const diagnostic = () => page.getByRole('dialog', { name: 'Diagnostics', exact: true });
  281 |   const readings = () => diagnostic().locator('ol[aria-label="Recorded measurements"] > li');
  282 |   const contained = async () => {
  283 |     expect(await page.locator('.nq-game').evaluate(frame => {
  284 |       const bounds = frame.getBoundingClientRect();
  285 |       return [...frame.querySelectorAll<HTMLElement>('.nq-game-toolbar button:not([hidden])')].every(control => {
  286 |         const box = control.getBoundingClientRect();
  287 |         return box.width === 0 || (box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom);
  288 |       });
  289 |     })).toBe(true);
  290 |     expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  291 |   };
  292 |   const windowBehavior = async (name: 'Diagnostics' | 'Validate repair') => {
  293 |     const panel = page.getByRole('dialog', { name, exact: true });
> 294 |     await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
      |                                                       ^ Error: expect(locator).toHaveCount(expected) failed
  295 |     expect(await page.locator('.nq-game-toolbar').evaluate(el => !!el.closest('[inert]'))).toBe(true);
  296 |     const game = panel.locator('.nq-panel-game'); await game.press('Enter');
  297 |     await expect(page.getByRole('dialog', { name: 'Game menu', exact: true })).toHaveAttribute('aria-modal', 'true');
  298 |     await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
  299 |     expect(await page.getByRole('dialog', { name, exact: true, includeHidden: true }).evaluate(el => !!el.closest('[inert]'))).toBe(true);
  300 |     await page.keyboard.press('Escape'); await expect(panel).toHaveAttribute('aria-modal', 'true'); await expect(game).toBeFocused();
  301 |     await page.keyboard.press('Escape'); await expect(panel).toBeHidden(); await expect(button(name)).toBeFocused();
  302 |     await click(name); await expect(panel).toHaveAttribute('aria-modal', 'true');
  303 |     await page.keyboard.press('Shift+Tab'); expect(await panel.evaluate(el => el.contains(document.activeElement))).toBe(true);
  304 |   };
  305 |   return { click, room, diagnostic, readings, contained, windowBehavior,
  306 |     verb: async (name: 'Walk' | 'Look' | 'Talk' | 'Use') => { await click(name); await expect(button(name)).toHaveAttribute('aria-pressed', 'true'); },
  307 |     walk: async (name: string, label = `Walk to ${name}`) => { await click('Walk'); await click(label); await room(name); },
  308 |     diagnostics: async () => { await click('Diagnostics'); await expect(diagnostic()).toBeVisible(); },
  309 |     closeDiagnostics: async () => { await click('Close diagnostics'); await expect(diagnostic()).toBeHidden(); },
  310 |     submitLatest: async () => { const target = readings().last().getByRole('button', { name: 'Submit this reading', exact: true }); if (input === 'keyboard') await target.press('Enter'); else await target.click(); },
  311 |     objective: async (id: keyof typeof objectiveLabels, complete: boolean) => {
  312 |       await click('Notebook');
  313 |       const row = page.getByRole('dialog', { name: 'Notebook', exact: true }).locator('ul[aria-label="Objectives"] > li').filter({ hasText: objectiveLabels[id] });
  314 |       await expect(row).toHaveCount(1); await expect(row).toContainText(complete ? 'Completed' : 'In progress'); await click('Close notebook');
  315 |     },
  316 |   };
  317 | }
  318 | 
```