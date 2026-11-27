// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Run against a local build with the pinned Playwright Firefox. All progress uses ordinary guest controls.
import { firefox, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { clickButton, closeFrame, openFrame, pressButton } from '../../tests/e2e/support/adventure-controls.ts';
const out = '.local/T136/browser';
await mkdir(out, { recursive: true });
const read = async (path) => JSON.parse(await readFile(path));
const rooms = new Map(
  await Promise.all(['R03', 'R04'].map(async (code) => [code, await read('content/spec001/rooms/' + code + '.json')])),
);
const plans = Object.fromEntries(
  await Promise.all(
    ['R03', 'R04'].map(async (code) => [code, await read('content/spec001/presentation/' + code + '.json')]),
  ),
);
const choices = (await read('content/spec001/dialogue/copper-actions.json')).records.flatMap((d) =>
  d.nodes.flatMap((n) => n.choices),
);
const allBindings = [...rooms.values()].flatMap((r) => r.mediaBindings);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  hasTouch: true,
  reducedMotion: 'no-preference',
});
page.setDefaultTimeout(20000);
const report = { browser: browser.version(), checks: [], responses: {}, scenes: [], cues: [], errors: [] };
const reads = new Map();
page.on('pageerror', (e) => report.errors.push(e.message));
page.on('response', (response) => {
  const path = 'public/' + new URL(response.url()).pathname.split('/arcade/play/network-quest/')[1];
  if (allBindings.some((b) => b.exportPath === path) && response.ok()) {
    const p = response
      .body()
      .then((buf) => ({ bytes: buf.length, sha256: hash(buf), status: response.status() }))
      .catch(() => null);
    reads.set(path, p);
  }
});
const click = (label) => clickButton(page, label);
const use = async (name) => {
  await click('Use');
  const c = choices.find((c) => c.id.endsWith('ACTION-copper-' + name));
  await click(c.text);
};
const walk = async (name) => {
  await click('Walk');
  await click('Walk to ' + name);
  await expect(page.locator('.nq-game-location')).toHaveText(name);
  await closeFrame(page);
};
const visual = (code) => page.locator('.nq-room[data-room-id="spec001:' + code + '"]');
const capture = async (code, phase) => {
  const node = visual(code);
  await expect(node).toHaveAttribute('data-rendered', 'true', { timeout: 20000 });
  for (const [width, height] of [
    [1280, 800],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(160);
    let maxAnchorErrorCssPixels;
    if (code === 'R04') {
      const stage = await node.locator('.nq-room-focal').boundingBox();
      const distances = await Promise.all(
        plans.R04.anchors.map(async (anchor) => {
          const pin = await node
            .locator('.nq-graybox-pin[data-graybox-object="' + anchor.objectId + '"]')
            .boundingBox();
          const x = stage.x + (stage.width * anchor.point[0]) / 1024;
          const y = stage.y + (stage.height * anchor.point[1]) / 576;
          return Math.hypot(pin.x + pin.width / 2 - x, pin.y + pin.height / 2 - y);
        }),
      );
      maxAnchorErrorCssPixels = Math.max(...distances);
      assert.ok(maxAnchorErrorCssPixels < 2, 'R04 native stage and semantic controls diverged.');
    }
    const dst = code + '-' + phase + '-' + width + '.png';
    await page.screenshot({ path: out + '/' + dst });
    report.scenes.push({
      room: code,
      phase,
      width,
      height,
      screenshot: dst,
      maxAnchorErrorCssPixels,
      metrics: await node.evaluate((el) => ({ ...el.dataset })),
    });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
};
const cue = async (code, short, heard = true) => {
  const sel = page.locator('.nq-media-cue[data-asset-id="spec001:ASSET-' + short + '"]');
  if (!heard) {
    await expect(sel).toHaveCount(0);
    return;
  }
  await expect(sel).toHaveCount(1);
  await openFrame(page, 'Sound and reading');
  await sel.getByRole('button', { name: /^Replay/ }).click();
  await expect(sel).toHaveAttribute('data-audio-status', /playing|ended/);
  report.cues.push({
    room: code,
    id: short,
    caption: await sel.locator('p').innerText(),
    path: await sel.getAttribute('data-export-path'),
    playback: await sel.getAttribute('data-audio-status'),
  });
  await sel.getByRole('button', { name: /^Skip/ }).click();
  await closeFrame(page);
};
const measure = async (submit) => {
  await closeFrame(page);
  await click('Diagnostics');
  await click('Take measurement');
  if (submit) {
    const d = page.getByRole('dialog', { name: 'Diagnostics', exact: true });
    await d.locator('ol li').last().getByRole('button', { name: 'Submit this reading' }).click();
    await expect(d).toContainText('Objective complete.');
  }
  await click('Close diagnostics');
};
const walkFloor = async (code, label) => {
  await click('Walk');
  await pressButton(page, label);
  await expect
    .poll(() => visual(code).getAttribute('data-player-foot'))
    .toBe(code === 'R03' ? '5.550,0.000,5.460' : '4.700,0.000,4.400');
  await closeFrame(page);
  await pressButton(page, code === 'R03' ? 'The Copper Warrens entry' : 'The Echo Cavern entry');
  await expect.poll(() => visual(code).getAttribute('data-player-foot')).toBe('5.000,0.000,3.000');
  await closeFrame(page);
  report.checks.push(code + ' reached the registered floor stop by keyboard.');
};
const activate = async (name) => {
  await click('Party');
  await click('Invite ' + name);
  await click('Activate ' + name);
  await click('Close party');
};
const pick = async (id, expected) => {
  const c = await visual('R04').locator('.nq-room-focal').boundingBox();
  const point = (await read('docs/evidence/spec001/final-rooms/T136/R04/staging.json')).ordinaryArrivalPickPixel[id];
  await page.touchscreen.tap(c.x + (c.width * point[0]) / 1024, c.y + (c.height * point[1]) / 576);
  await expect(visual('R04').locator('.nq-graybox-choices strong')).toHaveText(expected);
};
try {
  await page.goto(process.env.NQ_T136_URL ?? 'http://127.0.0.1:47137/arcade/play/network-quest/');
  await click('New Adventure');
  await click('Look');
  await click('Look at link indication');
  await click('Look at power indication');
  await click('Talk');
  await click('Talk to Photon the Firefly');
  await click('Skip dialogue');
  await click('Use');
  await click('Inspect physical path');
  await walk("The Titan's Workshop");
  await click('Talk');
  await click('Talk to the Titan');
  await click('Skip dialogue');
  await click('Look');
  await click('Identify known-good endpoints');
  await click('Identify physical path under test');
  await click('Notebook');
  await page
    .getByRole('textbox', { name: 'Hypothesis', exact: true })
    .fill('Compare the open section against the restored path.');
  await click('Pin hypothesis');
  await click('Close notebook');
  await click('Continue as guest');
  await walk('The Copper Warrens');
  await capture('R03', 'arrival');
  await cue('R03', 'VOICE-007', false);
  await cue('R03', 'EFFECT-015', false);
  await cue('R03', 'MUSIC-copper');
  await cue('R03', 'AMBIENCE-R03');
  await walkFloor('R03', 'Clear maintenance walkway');
  await cue('R03', 'EFFECT-010');
  await click('Look');
  await click('Copperhead');
  await click('The Crosstalk Twins');
  await use('isolate-demonstration');
  await cue('R03', 'EFFECT-015');
  await use('read-compatibility');
  await cue('R03', 'VOICE-007');
  await use('read-defect');
  await measure(false);
  await use('replace-section');
  await measure(true);
  await walk('The Echo Cavern');
  await capture('R04', 'arrival');
  const animated = visual('R04');
  await expect(animated).toHaveAttribute('data-animated-actors', '3');
  for (const key of ['ch01', 'ch13', 'ch20']) {
    const initial = await animated.getAttribute('data-frame-c-h' + key.slice(2));
    await expect.poll(() => animated.getAttribute('data-frame-c-h' + key.slice(2))).not.toBe(initial);
  }
  report.checks.push(
    'All three registered sprite rigs advanced idle frames independently on the native Firefox canvas.',
  );
  await cue('R04', 'AMBIENCE-R04');
  await cue('R04', 'VOICE-008', false);
  await cue('R04', 'EFFECT-030', false);
  await walkFloor('R04', 'Dry cavern ledge');
  await click('Look');
  await closeFrame(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['CH20', 'CH13', 'PR033', 'PR039', 'PR040']) {
    const s = plans.R04.subjects.find((s) => s.id === id);
    const h = rooms.get('R04').hotspots.find((h) => h.id === s.objectId);
    await pick(id, h.label);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  report.checks.push(
    'Narrow touch selected the bat, tortoise, telegraph, amplitude ladder and printer by opaque sprite pixels.',
  );
  await use('echo-relay-demonstration');
  await cue('R04', 'EFFECT-016');
  await use('read-before');
  await use('read-repeater');
  await cue('R04', 'VOICE-008');
  await use('repeater-requires-continuity');
  await measure(true);
  await activate('Echo Bat');
  await use('echo-bat-demonstration');
  await cue('R04', 'EFFECT-030');
  await closeFrame(page);
  await expect(visual('R04')).toHaveAttribute('data-party-cast', '');
  await walk('The Copper Warrens');
  await expect(visual('R03')).toHaveAttribute('data-party-cast', 'spec001:CH20');
  await activate('Copperhead Snake');
  await click('Party');
  const useTrace = page
    .getByRole('dialog', { name: 'Party', exact: true })
    .getByRole('button', { name: /^Continuity comparison of a copper path: Fit the supplied replacement/ });
  await useTrace.click();
  await click('Close party');
  await cue('R03', 'EFFECT-024');
  await expect(visual('R03')).toHaveAttribute('data-party-cast', 'spec001:CH20');
  await capture('R03', 'earned-party');
  await walk('The Echo Cavern');
  await expect(visual('R04')).toHaveAttribute('data-party-cast', 'spec001:CH04');
  await capture('R04', 'earned-party');
  await openFrame(page, 'Scene');
  await click('Low detail scene');
  await expect(visual('R04')).toHaveAttribute('data-detail', 'low');
  await click('Text scene');
  await expect(visual('R04')).toHaveCount(0);
  await click('Retry visual scene');
  await expect(visual('R04')).toHaveAttribute('data-rendered', 'true');
  await closeFrame(page);
  await click('Walk');
  await openFrame(page, 'Scene');
  await expect(page.getByRole('button', { name: 'Walk to The Backhoe Rift', exact: true })).toBeDisabled();
  await closeFrame(page);
  await walk('The Copper Warrens');
  await walk("The Titan's Workshop");
  const world = await read('content/spec001/world.json');
  const name = (id) => world.characters.find((ch) => ch.shortId === id).name;
  const allChoices = new Map();
  for (const file of ['fiber', 'radio', 'equipment'])
    for (const rec of (await read('content/spec001/dialogue/' + file + '-actions.json')).records)
      for (const n of rec.nodes) for (const choice of n.choices) allChoices.set(choice.id, choice.text);
  const act = async (id) => {
    await click('Use');
    await click(allChoices.get('spec001:ACTION-' + id));
  };
  const discover = async (code) => {
    await click('Look');
    for (const h of (await read('content/spec001/rooms/' + code + '.json')).hotspots.filter((h) =>
      h.subjectId.startsWith('spec001:CH'),
    ))
      await click(h.label);
  };
  const invite = async (ids) => {
    await closeFrame(page);
    await click('Party');
    for (const id of ids) await click('Invite ' + name(id));
    await click('Close party');
  };
  await walk('The Photon Gardens');
  await discover('R05');
  await act('fiber-read-matching');
  await act('fiber-restore-original');
  await act('fiber-profile-matched');
  await act('fiber-inspect-before');
  await act('fiber-clean');
  await act('fiber-reinspect-clean');
  await measure(true);
  await invite(['CH03']);
  await walk('The Prism Vault');
  await discover('R06');
  await invite(['CH16']);
  await act('fiber-read-compatibility');
  await act('fiber-path-A');
  await measure(true);
  await walk('The Photon Gardens');
  await invite(['CH05', 'CH06']);
  await click('Walk');
  await click('Walk to The Titan’s Workshop');
  await walk('The Skywell');
  await discover('R07');
  await act('radio-read-path');
  await act('radio-read-settings');
  await act('radio-alternate-path');
  await act('radio-match-settings');
  await measure(true);
  await walk('The Storm Observatory');
  await discover('R08');
  await act('radio-read-survey');
  await act('radio-mitigate-emitter');
  await act('radio-channel-A');
  await measure(true);
  await walk('The Skywell');
  await invite(['CH07']);
  await walk("The Titan's Workshop");
  await walk('The Shell Market');
  await discover('R09');
  await act('market-read-checklist');
  await act('equipment-mode-100-full');
  await act('market-compatible-kit-B');
  await measure(true);
  await invite(['CH19']);
  await walk("The Titan's Workshop");
  await walk('The Clockworks');
  await discover('R10');
  await invite(['CH22']);
  await click('Use');
  await click('Read and record the physical-role and upper-layer explanation');
  await click('Use untimed step-by-step decoding');
  await click('Explain: sample physical signals representing bits; this does not discover addresses');
  for (const [i, pair] of ['00', '10', '11', '01'].entries()) {
    await click('Inspect sample position ' + i);
    await click('Write ' + pair + ' for sample position ' + i);
  }
  await measure(true);
  await walk("The Titan's Workshop");
  await walk('The Copper Warrens');
  report.partyTour = [];
  const pairs = [['CH03', 'CH04'], ['CH05', 'CH06'], ['CH07', 'CH16'], ['CH19', 'CH20'], ['CH22']];
  let active = ['CH20', 'CH04'];
  for (const code of ['R03', 'R04']) {
    if (code === 'R04') await walk('The Echo Cavern');
    for (const pair of pairs) {
      await click('Party');
      for (const id of active) await click('Rest ' + name(id));
      for (const id of pair) await click('Activate ' + name(id));
      active = pair;
      await click('Close party');
      const node = visual(code),
        wanted = pair
          .filter((id) => !rooms.get(code).characterIds.includes('spec001:' + id))
          .map((id) => 'spec001:' + id)
          .sort();
      await expect
        .poll(async () => ((await node.getAttribute('data-party-cast')) ?? '').split(' ').filter(Boolean).sort())
        .toEqual(wanted);
      await page.waitForTimeout(180);
      const file = code + '-party-' + pair.join('-') + '.png';
      await node.screenshot({ path: out + '/' + file });
      report.partyTour.push({
        room: code,
        active: pair,
        drawnNonresidents: wanted,
        decodedPartyMeshBytes: Number(await node.getAttribute('data-party-model-bytes')),
        screenshot: file,
      });
    }
  }
  await click('Walk');
  await closeFrame(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const threshold = plans.R04.anchors.find((a) => a.objectId.endsWith(':spec001:R11')),
    box = await visual('R04').locator('.nq-room-focal').boundingBox();
  await page.touchscreen.tap(
    box.x + (threshold.point[0] * box.width) / 1024,
    box.y + (threshold.point[1] * box.height) / 576,
  );
  await expect(page.locator('.nq-game-location')).toHaveText('The Backhoe Rift');
  report.checks.push(
    'R04 Rift exit was disabled before O10 and reached by direct touch on its actual floor treads after O10.',
  );
  report.checks.push(
    'Both objectives completed on the ordinary tool route, then both recruited residents travelled as allies with no doubled local actor. Five contextual effects and two narrator lines have native skip/replay.',
  );
  for (const [path, p] of reads) {
    const r = await p;
    if (!r) continue;
    const src = await readFile(path);
    r.sourceSha256 = hash(src);
    assert.equal(r.sha256, r.sourceSha256, path);
    report.responses[path] = r;
  }
  assert.deepEqual(report.errors, []);
  await writeFile(out + '/browser.json', JSON.stringify(report, null, 2) + '\n');
} catch (e) {
  await writeFile(
    out + '/failure.json',
    JSON.stringify(
      {
        ...report,
        error: String(e),
        buttons: await page.getByRole('button').allTextContents(),
        status: await page.locator('.nq-shell-status').allTextContents(),
      },
      null,
      2,
    ),
  );
  await page.screenshot({ path: out + '/failure.png' });
  throw e;
} finally {
  await browser.close();
}
