// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, type Locator, type Page } from '@playwright/test';

export type Activate = (control: Locator) => Promise<void>;
const pointer: Activate = control => control.click();

/** Real UI navigation for the contained screen; never inject state or bypass inert. */
export async function openFrame(page: Page, name: 'Scene' | 'Evidence' | 'Game' | 'Sound and reading', activate: Activate = pointer) {
  const panelGame = page.locator('.nq-window-active .nq-panel-game');
  const button = name === 'Game' && await panelGame.count() ? panelGame : page.getByRole('button', { name, exact: true });
  const current = page.locator('.nq-frame-window.nq-window-active');
  const wanted = { Scene: 'Scene objects and exits', Evidence: 'Evidence and captions', Game: 'Game menu', 'Sound and reading': 'Sound and reading' }[name];
  if (await current.count() && await current.getAttribute('aria-label') === wanted) return;
  if (await current.locator('.nq-window-close:visible').count()) await activate(current.locator('.nq-window-close'));
  await expect(button).toBeVisible(); await activate(button);
}
export async function closeFrame(page: Page, activate: Activate = pointer) {
  const close = page.locator('.nq-frame-window.nq-window-active .nq-window-close:visible');
  if (await close.count()) await activate(close);
}
/** Select the discoverable window before activating the original named control. */
export async function revealControl(page: Page, name: string, activate: Activate = pointer) {
  const target = page.getByRole('button', { name, exact: true });
  const actionable = async () => await target.isVisible() && await target.evaluate(el => !el.closest('[inert]'));
  if (await actionable()) return target;
  const game = ['New Adventure','Continue','Restore Save','Save','Settings','Credits'].includes(name);
  const sound = /^(Replay (Narrator|Photon|Title theme|Lift latch|Photon glimmer|Control click)|Skip (Narrator|Photon|Title theme|Lift latch|Photon glimmer|Control click)|Reload account presentation)/.test(name);
  const scene = await page.locator('.nq-frame-window[aria-label="Scene objects and exits"]').getByRole('button',{name,exact:true,includeHidden:true}).count() > 0;
  const activity = await page.locator('.nq-frame-panels [role=dialog]:not([hidden])').getByRole('button',{name,exact:true,includeHidden:true}).count() > 0;
  const toolbar = ['Walk','Look','Talk','Use','Inventory','Notebook','Compendium'].includes(name);
  // An account/dialogue control may be waiting on a real asynchronous transition.
  // Only known panel destinations navigate; never escape a pending modal to Scene.
  if (game || sound || scene || toolbar || activity) {
    await closeFrame(page, activate);
    if (await actionable()) return target;
    if (game) await openFrame(page,'Game',activate);
    else if (sound) await openFrame(page,'Sound and reading',activate);
    else if (scene) await openFrame(page,'Scene',activate);
  }
  await expect(target).toBeVisible(); return target;
}
export async function clickButton(page: Page, name: string) { await (await revealControl(page, name)).click(); }
export async function pressButton(page: Page, name: string, key = 'Enter') { await (await revealControl(page, name)).press(key); }

/** Playwright's locator.press() focuses its target directly. Walk the browser's
 * actual tab order so missing stops, inert controls and modal traps fail. */
export async function tabTo(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  const stops: string[] = [];
  const limit = await page.locator('button:visible, input:visible, select:visible, textarea:visible, summary:visible, [tabindex="0"]:visible').count() + 8;
  for (let step = 0; step < limit; step++) {
    if (await control.evaluate(el => el === document.activeElement)) return;
    stops.push(await page.evaluate(() => (document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || document.activeElement?.tagName || 'none').slice(0, 45)));
    await page.keyboard.press('Tab');
  }
  throw new Error(`Cannot Tab to ${control}. Observed focus sequence: ${stops.join(' → ')}`);
}
