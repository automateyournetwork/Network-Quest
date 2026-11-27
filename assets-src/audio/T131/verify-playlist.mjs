// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, firefox } from '@playwright/test';

const directory = new URL('./', import.meta.url);
const { packetId, voices } = JSON.parse(await readFile(new URL('records/exports.json', directory), 'utf8'));
const expected = voices.map(voice => 'audio-' + voice.number);

async function verify(engine) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage();
    await page.goto(new URL('review.html', directory).href);
    const captionText = await page.locator('.caption').allTextContents();
    assert.deepEqual(captionText, voices.map(voice => voice.caption));
    // Real transport events in a silent headless sink. Speed up the fixture while preserving natural endings.
    await page.locator('audio').evaluateAll(players => {
      window.fixtureTransport = { play: [], playing: [], ended: [], overlap: [] };
      for (const player of players) {
        player.muted = true;
        player.playbackRate = 4;
        player.addEventListener('play', () => window.fixtureTransport.play.push(player.id));
        player.addEventListener('playing', () => {
          window.fixtureTransport.playing.push(player.id);
          if (players.some(other => other !== player && !other.paused)) {
            window.fixtureTransport.overlap.push(player.id);
          }
        });
        player.addEventListener('ended', () => window.fixtureTransport.ended.push(player.id));
      }
    });
    assert.ok(await page.locator('audio').evaluateAll(players => players.every(p => p.paused && p.currentTime === 0)));
    await page.getByRole('button', { name: 'Play all lines in order' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(total => window.fixtureTransport.ended.length >= total,
      voices.length, { timeout: 135_000 });
    const transport = await page.evaluate(() => window.fixtureTransport);
    assert.deepEqual(transport.play, expected);
    // HTML media may report playing again after loading resumes within one playback.
    const successivePlayingIds = transport.playing.filter((id, i, all) => i === 0 || id !== all[i-1]);
    assert.deepEqual(successivePlayingIds, expected);
    assert.deepEqual(transport.ended, expected);
    assert.deepEqual(transport.overlap, []);
    assert.ok(await page.locator('audio').evaluateAll(players => players.every(p => p.paused && p.currentTime === 0)));
    assert.deepEqual(await page.locator('.caption').allTextContents(), captionText);
    return { engine: engine.name(), version: browser.version(), rate: 4,
      muted: true, keyboardStart: true, initiallyPaused: true, transport, stoppedAtEnd: true,
      frozenTextBeforeAndAfter: true };
  } finally {
    await browser.close();
  }
}

const reports = await Promise.all([verify(chromium), verify(firefox)]);
await writeFile(new URL('records/playlist.json', directory), JSON.stringify({
  packetId, timeUtc: new Date().toISOString(),
  method: 'Local file review fixture. One keyboard gesture per engine followed by all twenty actual ended events at fourfold playback, without seeking, scripting events, or starting individual clips.',
  reports,
}, null, 2) + '\n');
console.log('Twenty natural playlist endings, in order, in both browsers.');
