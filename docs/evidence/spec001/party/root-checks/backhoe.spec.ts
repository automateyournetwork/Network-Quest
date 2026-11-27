// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { test, expect } from '../../../../../tests/e2e/support/outcome-journey';

test('the real Rift journey renders and discovers the new Backhoe actor safely', async ({ outcome: j }, info) => {
  await j.prepare('copper', false);
  await expect(j.page.locator('.nq-graybox')).toHaveAttribute('data-rendered', 'true');
  await j.click('Look');
  await j.click('Backhoe of Doom');
  await j.click('Compendium');
  await expect(j.page.getByRole('dialog', { name: 'Compendium', exact: true })).toContainText('Backhoe of Doom');
  await j.click('Close compendium');
  await expect(j.page.getByRole('dialog', { name: 'A Shortcut Too Short', exact: true })).toBeHidden();
  expect(j.writes).toEqual([]);
  await j.page.screenshot({ path: info.outputPath('backhoe-actual.png') });
});
