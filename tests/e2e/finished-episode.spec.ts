// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import type { Page, Response, TestInfo } from '@playwright/test';
import { balcony, historicalBytes } from '../fixtures/migrations/spec001-cases';
import { closeFrame, openFrame } from './support/adventure-controls';
import { dialog, expect, notesBefore, test } from './support/outcome-journey';
import { installCookie } from './support/t056-journey';

const rooms = ["The Arrival Lift", "The Titan's Workshop", 'The Copper Warrens', 'The Echo Cavern',
  'The Photon Gardens', 'The Prism Vault', 'The Skywell', 'The Storm Observatory', 'The Shell Market',
  'The Clockworks', 'The Backhoe Rift', 'The Iron Threshold'];
const routes = [
  { branch: 'copper', pair: [3, 4], kind: 'permanent', ending: 'E01', title: 'The Steady Light', signedIn: false },
  { branch: 'fiber', pair: [5, 6], kind: 'temporary', ending: 'E02', title: 'The Borrowed Dawn', signedIn: true },
  { branch: 'radio', pair: [7, 8], kind: 'shutdown', ending: 'E03', title: 'The Honest Shutdown', signedIn: false },
] as const;
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
interface FileRecord { path: string; bytes: number; sha256: string }
interface Asset { assetId: string; sources: { file: FileRecord }[]; exports: { file: FileRecord }[] }
interface SourceIndex { revision: string; files: (FileRecord & { assetIds: string[] })[] }

async function mediaWitness(page: Page) {
  const manifest: { assets: Asset[] } = JSON.parse(await readFile('assets-src/manifest.json', 'utf8'));
  const index: SourceIndex = JSON.parse(await readFile('assets-src/source-index.json', 'utf8'));
  const assets = new Map(manifest.assets.map(row => [row.assetId, row]));
  const indexed = new Map(index.files.map(row => [row.path, row]));
  const responses = new Map<string, Response>();
  const sources = new Map<string, string>();
  const observed: { assetId: string; path: string; sha256: string; sources: string[] }[] = [];
  page.on('response', response => {
    const path = new URL(response.url()).pathname;
    if (path.includes('/assets/') && response.ok()) responses.set('public' + path.slice(path.indexOf('/assets/')), response);
  });
  // The native audio backend holds detached elements. Retain only a weak reference
  // to the last real element played at each URL, without changing play or its result.
  await page.addInitScript(() => {
    const players = new Map<string, WeakRef<HTMLMediaElement>>();
    Object.defineProperty(window, 'episodeMediaPlayers', { value: players });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      players.set(new URL(this.src).pathname, new WeakRef(this));
      return play.call(this);
    };
  });
  async function verifyAsset(id: string) {
    const asset = assets.get('spec001:ASSET-' + id);
    expect(asset, id).toBeDefined();
    const file = asset!.exports[0]!.file;
    await expect.poll(() => responses.has(file.path), { message: `Expected native request for ${file.path}` }).toBe(true);
    const servedBytes = await responses.get(file.path)!.body();
    expect(servedBytes.length, file.path).toBe(file.bytes);
    expect(digest(servedBytes), file.path).toBe(file.sha256);
    expect(asset!.sources.length, id).toBeGreaterThan(0);
    for (const { file: source } of asset!.sources) {
      const row = indexed.get(source.path);
      expect(row, source.path).toMatchObject({ bytes: source.bytes, sha256: source.sha256 });
      expect(row!.assetIds).toContain(asset!.assetId);
      if (!sources.has(source.path)) {
        const bytes = await readFile(source.path);
        expect(bytes.length, source.path).toBe(source.bytes);
        sources.set(source.path, digest(bytes));
      }
      expect(sources.get(source.path), source.path).toBe(source.sha256);
    }
    observed.push({ assetId: id, path: file.path, sha256: file.sha256, sources: asset!.sources.map(s => s.file.path) });
    return file;
  }
  const visited: number[] = [];
  const played: { room: string; path: string; transcript: string; advancedSeconds: number; peak: number }[] = [];
  async function arrive(name: string) {
    const number = rooms.indexOf(name) + 1;
    expect(number, name).toBeGreaterThan(0);
    const room = 'R' + String(number).padStart(2, '0');
    const stage = page.locator(`.nq-room[data-room-id="spec001:${room}"]`);
    await expect(stage).toHaveAttribute('data-rendered', 'true');
    await expect(stage.locator('canvas.nq-room-focal')).toBeVisible();
    const seen = visited.includes(number);
    visited.push(number);
    if (seen) return;
    const resident = (await stage.getAttribute('data-asset-ids'))!.split(' ');
    const ids = ['ARCH-' + room, ...['background', 'midground', 'foreground'].map(plane => `LAYER-${room}-${plane}`)];
    if (number === 4) {
      await expect(stage).toHaveAttribute('data-mode', 'sprite');
      ids.push('SPRITE-R04-CH01', 'SPRITE-R04-CH13', 'SPRITE-R04-CH20', 'SPRITE-R04-props');
    }
    for (const id of ids) {
      expect(resident, `Rendered ${room}`).toContain('spec001:ASSET-' + id);
      await verifyAsset(id);
    }
    const ambience = 'AMBIENCE-' + room;
    const file = assets.get('spec001:ASSET-' + ambience)!.exports[0]!.file;
    await openFrame(page, 'Sound and reading');
    const cue = page.locator(`.nq-media-cue[data-asset-id="spec001:ASSET-${ambience}"]`);
    await expect(cue).toHaveAttribute('data-export-path', file.path);
    const transcript = await cue.locator('p').innerText();
    expect(transcript.trim().length).toBeGreaterThan(0);
    await cue.getByRole('button', { name: /^Replay / }).click();
    await expect(cue).toHaveAttribute('data-audio-status', 'playing');
    const path = '/arcade/play/network-quest/' + file.path.slice('public/'.length);
    const elapsed = () => page.evaluate(path => {
      const players = Reflect.get(window, 'episodeMediaPlayers') as Map<string, WeakRef<HTMLMediaElement>>;
      const audio = players.get(path)?.deref();
      return audio && !audio.muted && !audio.paused && audio.volume > 0 && audio.readyState >= 2 ? audio.currentTime : 0;
    }, path);
    const first = await elapsed();
    await expect.poll(elapsed).toBeGreaterThan(first + 0.1);
    const advancedSeconds = await elapsed() - first;
    // Sample the playing element's digital output in Firefox. The analyser has
    // no connection to the speakers, and the game continues its own playback.
    const peak = await page.evaluate(async path => {
      type Player = HTMLMediaElement & { mozCaptureStream(): MediaStream };
      const players = Reflect.get(window, 'episodeMediaPlayers') as Map<string, WeakRef<Player>>;
      const stream = players.get(path)!.deref()!.mozCaptureStream();
      const audio = new AudioContext();
      try {
        const analyser = audio.createAnalyser();
        audio.createMediaStreamSource(stream).connect(analyser);
        await audio.resume();
        const samples = new Float32Array(analyser.fftSize);
        for (let i = 0; i < 20; i++) {
          await new Promise(resolve => setTimeout(resolve, 50));
          analyser.getFloatTimeDomainData(samples);
          const peak = samples.reduce((highest, value) => Math.max(highest, Math.abs(value)), 0);
          if (peak > 0) return peak;
        }
        return 0;
      } finally { await audio.close(); }
    }, path);
    expect(peak, `${room} live audio signal`).toBeGreaterThan(0);
    await verifyAsset(ambience);
    await cue.getByRole('button', { name: /^Skip / }).click();
    await expect(cue).toHaveAttribute('data-audio-status', 'stopped');
    await expect(cue.locator('p')).toHaveText(transcript);
    await closeFrame(page);
    played.push({ room, path, transcript, advancedSeconds, peak });
  }
  async function report(info: TestInfo) {
    const path = info.outputPath('episode-continuity.json');
    await writeFile(path, JSON.stringify({
      browser: page.context().browser()?.version(), sourceRevision: index.revision, visited, played, observed,
    }, null, 2));
    await info.attach('episode-continuity', { contentType: 'application/json', path });
  }
  return { arrive, visited, report, sourceRevision: index.revision };
}

test.describe('US8 finished episode', () => {
  test.setTimeout(240_000);
  for (const route of routes) test(`${route.branch} reaches ${route.ending} with its finished rooms and source-backed media`, async ({ outcome: j }, info) => {
    const witness = await mediaWitness(j.page);
    await j.prepare(route.branch, route.signedIn, {
      activate: control => control.click(), write: (field, value) => field.fill(value), arrived: witness.arrive,
    });
    await j.choosePlan(route.branch, route.kind);
    await j.execute();
    await j.validate(route.kind);
    const ending = dialog(j.page, route.title);
    await expect(ending).toContainText(route.kind === 'shutdown' ? 'service is unresolved' : 'separate endpoint service test');
    await expect(j.page.locator('.nq-room-stage')).toHaveAttribute('data-mural-folio', route.ending);
    const music = j.page.locator('.nq-media-cue[data-asset-id="spec001:ASSET-MUSIC-epilogue"]');
    await expect(music).toHaveAttribute('data-export-path', 'public/assets/audio/music/epilogue.mp3');
    const [first, second] = route.pair;
    expect(witness.visited).toEqual([1, 2, first, second, first, 2, 9, 2, 10, 11, 12]);
    await ending.getByRole('button', { name: 'Continue', exact: true }).click();
    if (route.kind === 'shutdown') {
      await j.click('Confirm Continue to Encounter Preparation');
      await j.room('The Backhoe Rift');
      await j.expectNotes(notesBefore);
      await j.objective('Validate at R12', false);
    } else {
      await j.room('The Iron Threshold');
      await j.objective('Validate at R12', true);
    }
    if (route.signedIn) {
      const saved = await j.save(true);
      expect(saved.snapshot.world).toMatchObject({ route: route.branch, roomId: 'spec001:R12', continueOutcome: route.ending });
      expect(saved.snapshot.outcomeHistory.at(-1)?.outcome).toBe(route.ending);
      await j.page.reload();
      await j.click('Continue');
      await j.room('The Iron Threshold');
      await j.expectNotes(notesBefore);
      await expect(j.page.locator('.nq-room-stage')).toHaveAttribute('data-mural-folio', route.ending);
      expect(await j.local.inspectSlot()).toEqual(saved);
      expect(j.writes).toHaveLength(1);
    }
    if (!route.signedIn) {
      expect(j.writes).toHaveLength(0);
      expect(await j.local.inspectSlot()).toBeNull();
    }
    await witness.report(info);
  });

  test('the old balcony save opens in the finished Threshold, retains earned history and updates one slot on Save', async ({ outcome: j }, info) => {
    const witness = await mediaWitness(j.page);
    const prior = balcony.prior, raw = historicalBytes(prior);
    await j.local.seedMigrationSlot({ raw, revision: 7, schemaVersion: prior.saveSchemaVersion, contentVersion: prior.contentVersion,
      adventureId: prior.adventureId, roomId: prior.world.roomId, outcome: prior.world.continueOutcome });
    await installCookie(j.context, j.local.cookies[0]!);
    await j.page.goto(j.local.url);
    await expect(j.page.getByRole('button', { name: 'Continue', exact: true })).toHaveAttribute('aria-disabled', 'false');
    await j.click('Continue');
    const notice = dialog(j.page, 'Your adventure has been updated');
    for (const sentence of balcony.explanation) await expect(notice).toContainText(sentence);
    await j.click('Resume adventure');
    await j.room('The Iron Threshold');
    await witness.arrive('The Iron Threshold');
    await j.expectNotes(balcony.expected.notebook.personalNotes);
    await expect(j.page.locator('.nq-room-stage')).toHaveAttribute('data-mural-folio', 'E02');
    await j.click('Look');
    await j.click('Iron City boundary gate');
    await openFrame(j.page, 'Evidence');
    await expect(dialog(j.page, 'Evidence and captions')).toContainText('The Iron City remains a future-content boundary');
    await closeFrame(j.page);
    expect(await j.local.inspectSlot()).toMatchObject({ revision: 7, raw });
    expect(j.writes).toHaveLength(0);
    const saved = await j.save();
    expect(saved.revision).toBe(8);
    expect(saved.snapshot).toEqual(balcony.expected);
    expect((await j.local.inspectAccount()).saves).toBe(1);
    await j.page.reload();
    await j.click('Continue');
    await j.room('The Iron Threshold');
    await expect(notice).toBeHidden();
    await expect(j.page.locator('.nq-room-stage')).toHaveAttribute('data-mural-folio', 'E02');
    await j.expectNotes(balcony.expected.notebook.personalNotes);
    await j.click('Credits');
    const registerLink = dialog(j.page, 'Credits').getByRole('link', { name: 'Media credits and editable sources' });
    const [register] = await Promise.all([j.context.waitForEvent('page'), registerLink.click()]);
    const pin = `https://github.com/automateyournetwork/Network-Quest/blob/${witness.sourceRevision}/`;
    for (const [id, source] of [['ARCH-R12', 'assets-src/rooms/R12.blend'], ['AMBIENCE-R12', 'assets-src/audio/T126/projects/r12.aup4']] as const) {
      const entry = register.locator('details').filter({ has: register.locator('summary').filter({ hasText: id + ' —' }) });
      await entry.locator('summary').click();
      await expect(entry.locator(`a[href="${pin + source}"]`)).toBeVisible();
    }
    await register.close();
    await j.click('Close credits');
    expect(j.writes).toHaveLength(1);
    expect(await j.local.inspectSlot()).toEqual(saved);
    await witness.report(info);
  });
});
