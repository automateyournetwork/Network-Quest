// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Native Chrome tab, motion-preference and disposal controls for the Echo Cavern.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { clickButton, closeFrame, revealControl } from '../../tests/e2e/support/adventure-controls.ts';
import { withNativeChromiumTabs } from '../../tests/e2e/support/native-chromium-tabs.ts';
import { allRooms } from './t154-route.mjs';

const output = process.argv[2];
if (!output || process.version !== 'v26.13.1') throw Error('Use pinned Node and a fresh output file.');
const observed = { samples: [], errors: [], writes: [] };
try {
  await withNativeChromiumTabs(async ({ browser, context, page, url }) => {
    observed.browser = browser.version();
    const other = await context.newPage();
    try {
      const scene = page.locator('.nq-sprite-room[data-rendered=true]');
      const snapshot = async label => {
        const data = await scene.evaluate(el => ({
          hidden: document.hidden, paused: el.dataset.paused, reduced: el.dataset.reducedMotion,
          draws: Number(el.dataset.renderCount), cell: el.dataset.frameCH01, foot: el.dataset.playerFoot,
        }));
        observed.samples.push({ label, ...data });
        return data;
      };
      const click = label => clickButton(page, label);
      page.on('pageerror', err => observed.errors.push(err.message));
      page.on('request', req => { if (req.method() !== 'GET') observed.writes.push(req.method()); });
      await page.addInitScript(() => {
        const original = CanvasRenderingContext2D.prototype.drawImage;
        window.apprenticeDraws = [];
        CanvasRenderingContext2D.prototype.drawImage = function(image, ...coords) {
          const result = original.call(this, image, ...coords);
          if (this.canvas.isConnected && image.dataset?.assetId === 'spec001:ASSET-SPRITE-R04-CH01' && coords.length === 8) {
            window.apprenticeDraws.push({ time: performance.now(), x: coords[4], y: coords[5], cell: coords.slice(0, 2) });
          }
          return result;
        };
      });
      await page.bringToFront();
      await page.goto(url);
      await click('New Adventure');
      const done = Symbol('echo');
      try {
        await allRooms(page, async index => {
          if (index === 4) { await scene.waitFor(); throw done; }
        });
      } catch (err) { if (err !== done) throw err; }
      await closeFrame(page);
      await click('Walk');
      observed.pixelWalks = [];
      for (const label of ['Dry cavern ledge', 'The Echo Cavern entry']) {
        const target = await revealControl(page, label);
        await target.evaluate(el => el.addEventListener('click', () => {
          window.apprenticeWalk = { start: performance.now(), previous: window.apprenticeDraws.at(-1) };
          window.apprenticeDraws = [];
        }, { capture: true, once: true }));
        await target.click();
        await closeFrame(page);
        await page.waitForTimeout(1000);
        const trace = await page.evaluate(() => ({ ...window.apprenticeWalk, draws: window.apprenticeDraws }));
        let last = trace.previous;
        const changes = [];
        for (const draw of trace.draws) {
          if (draw.x !== last.x || draw.y !== last.y) changes.push(draw);
          last = draw;
        }
        const elapsed = changes.at(-1).time - trace.start;
        const changedPixelsPerSecond = changes.length * 1000 / elapsed;
        observed.pixelWalks.push({ label, elapsed, changedPixelsPerSecond, ...trace });
        assert.ok(changedPixelsPerSecond >= 30);
      }
      const floor = await revealControl(page, 'Dry cavern ledge');
      await floor.click();
      await page.waitForFunction(() => document.querySelector('.nq-sprite-room')?.dataset.frameCH01.startsWith('walk@'));
      await other.bringToFront();
      await page.waitForFunction(() => document.hidden && document.querySelector('.nq-sprite-room')?.dataset.paused === 'true', undefined, { polling: 50 });
      const hidden = await snapshot('tab hidden during walk');
      await other.waitForTimeout(1000);
      assert.deepEqual(await snapshot('one second later in background'), hidden);
      await page.bringToFront();
      await page.waitForFunction(n => !document.hidden && Number(document.querySelector('.nq-sprite-room')?.dataset.renderCount) > n, hidden.draws);
      await snapshot('foreground resumed');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.querySelector('.nq-sprite-room')?.dataset.reducedMotion === 'true');
      await closeFrame(page);
      await click('Walk');
      await click('The Echo Cavern entry');
      const entry = await snapshot('reduced motion at entry');
      await click('Dry cavern ledge');
      const ledge = await snapshot('reduced motion at ledge');
      assert.notEqual(entry.foot, ledge.foot);
      assert.equal(entry.foot, '5.000,0.000,3.000');
      assert.equal(ledge.foot, '4.700,0.000,4.400');
      await page.waitForTimeout(900);
      assert.deepEqual(await snapshot('reduced motion settled'), ledge);
      const old = await scene.elementHandle();
      await click('Text scene');
      await scene.waitFor({ state: 'detached' });
      const detachedReads = () => old.evaluate(el => ({ connected: el.isConnected, draws: Number(el.dataset.renderCount), foot: el.dataset.playerFoot }));
      const detached = await detachedReads();
      await page.waitForTimeout(900);
      assert.equal(detached.connected, false);
      assert.deepEqual(await detachedReads(), detached);
      observed.detached = detached;
      await old.dispose();
      await click('Retry visual scene');
      await scene.waitFor();
      assert.equal((await snapshot('rebuilt')).reduced, 'true');
      assert.deepEqual(observed.errors, []);
      assert.deepEqual(observed.writes, []);
    } finally { await other.close(); }
  });
  observed.status = 'pass';
} catch (error) { observed.status = 'failed'; observed.problem = String(error); process.exitCode = 1; }
finally { await writeFile(output, JSON.stringify(observed, null, 2) + '\n', { flag: 'wx' }); }
