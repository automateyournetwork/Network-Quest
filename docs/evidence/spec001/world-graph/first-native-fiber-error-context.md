# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: independent-repair-routes.spec.ts >> T081 independent fiber route reaches validated R12 and restores its one PHP save
- Location: tests/e2e/independent-repair-routes.spec.ts:12:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Walk to The Titan\'s Workshop', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: 'Walk to The Titan\'s Workshop', exact: true }) with timeout 5000ms
  - waiting for getByRole('button', { name: 'Walk to The Titan\'s Workshop', exact: true })

```

```yaml
- main:
  - text: NETWORK QUEST The Photon Gardens
  - paragraph: Unsaved changes
  - button "Sound and reading"
  - button "Game"
  - region "The Photon Gardens":
    - heading "The Photon Gardens" [level=1]
    - status: Walk selected.
    - group "Adventure controls":
      - button "Walk" [pressed]
      - button "Look"
      - button "Talk"
      - button "Use"
      - button "Inventory"
      - button "Notebook"
      - button "Compendium"
    - button "Scene"
    - button "Evidence"
    - button "Diagnostics"
```

# Test source

```ts
  1  | // Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
  2  | import { expect, type Page } from '@playwright/test';
  3  | 
  4  | /** Real UI navigation for the contained screen; never inject state or bypass inert. */
  5  | export async function openFrame(page: Page, name: 'Scene' | 'Evidence' | 'Game' | 'Sound and reading') {
  6  |   const panelGame = page.locator('.nq-window-active .nq-panel-game');
  7  |   const button = name === 'Game' && await panelGame.count() ? panelGame : page.getByRole('button', { name, exact: true });
  8  |   const current = page.locator('.nq-frame-window.nq-window-active');
  9  |   const wanted = { Scene: 'Scene objects and exits', Evidence: 'Evidence and captions', Game: 'Game menu', 'Sound and reading': 'Sound and reading' }[name];
  10 |   if (await current.count() && await current.getAttribute('aria-label') === wanted) return;
  11 |   if (await current.locator('.nq-window-close:visible').count()) await current.locator('.nq-window-close').click();
  12 |   await expect(button).toBeVisible(); await button.click();
  13 | }
  14 | export async function closeFrame(page: Page) {
  15 |   const close = page.locator('.nq-frame-window.nq-window-active .nq-window-close:visible');
  16 |   if (await close.count()) await close.click();
  17 | }
  18 | /** Select the discoverable window before activating the original named control. */
  19 | export async function revealControl(page: Page, name: string) {
  20 |   const target = page.getByRole('button', { name, exact: true });
  21 |   const actionable = async () => await target.isVisible() && await target.evaluate(el => !el.closest('[inert]'));
  22 |   if (await actionable()) return target;
  23 |   const game = ['New Adventure','Continue','Restore Save','Save','Settings','Credits'].includes(name);
  24 |   const sound = /^(Replay (Narrator|Photon|Title theme|Lift latch|Photon glimmer|Control click)|Skip (Narrator|Photon|Title theme|Lift latch|Photon glimmer|Control click)|Reload account presentation)/.test(name);
  25 |   const scene = await page.locator('.nq-frame-window[aria-label="Scene objects and exits"]').getByRole('button',{name,exact:true,includeHidden:true}).count() > 0;
  26 |   const activity = await page.locator('.nq-frame-panels [role=dialog]:not([hidden])').getByRole('button',{name,exact:true,includeHidden:true}).count() > 0;
  27 |   const toolbar = ['Walk','Look','Talk','Use','Inventory','Notebook','Compendium'].includes(name);
  28 |   // An account/dialogue control may be waiting on a real asynchronous transition.
  29 |   // Only known panel destinations navigate; never escape a pending modal to Scene.
  30 |   if (game || sound || scene || toolbar || activity) {
  31 |     await closeFrame(page);
  32 |     if (await actionable()) return target;
  33 |     if (game) await openFrame(page,'Game');
  34 |     else if (sound) await openFrame(page,'Sound and reading');
  35 |     else if (scene) await openFrame(page,'Scene');
  36 |   }
> 37 |   await expect(target).toBeVisible(); return target;
     |                        ^ Error: expect(locator).toBeVisible() failed
  38 | }
  39 | export async function clickButton(page: Page, name: string) { await (await revealControl(page, name)).click(); }
  40 | export async function pressButton(page: Page, name: string, key = 'Enter') { await (await revealControl(page, name)).press(key); }
  41 | 
```