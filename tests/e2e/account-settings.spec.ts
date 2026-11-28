// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { clickButton, closeFrame, openFrame, pressButton, tabTo } from './support/adventure-controls';
// Real app + actual PHP/SQLite/session/delete/status paths on trusted local TLS.
// Provider completion is seeded only by the private CLI fixture; real OAuth remains unverified.
import { expect, firefox, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { configuredSave } from './support/configured-save';

test.describe('T052 native account settings and isolated account service', () => {
  test.describe.configure({ mode: 'default' });
  let local: Awaited<ReturnType<typeof configuredSave>>, context: BrowserContext, page: Page;
  let errors: string[], mutations: { method: string; path: string; headers: Record<string, string> }[];
  async function installCookie(cookie: string) {
    const [name, value] = cookie.split('='); await context.addCookies([{ name: name!, value: value!, domain: '127.0.0.1', path: '/arcade/play/network-quest/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
  }
  test.beforeEach(async () => {
    local = await configuredSave(); errors = []; mutations = [];
    try { context = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false, reducedMotion: 'reduce', hasTouch: true }); }
    catch (error) { await local.stop(); throw error; }
    await installCookie(local.cookies[0]!);
    context.on('page', tab => tab.on('pageerror', error => errors.push(error.message)));
    context.on('request', request => { const path = new URL(request.url()).pathname;
      if (path.includes('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations.push({ method: request.method(), path, headers: Object.fromEntries(Object.entries(request.headers()).filter(([name]) => ['if-match', 'x-deletion-receipt', 'x-csrf-token'].includes(name))) });
    });
    // No provider credentials/network are used: the server's genuine auth-start
    // response opens a separate window which this fixture intercepts before access.
    await context.route('https://github.com/login/oauth/authorize**', route => route.fulfill({ status: 200, contentType: 'text/plain', body: 'Synthetic provider window; no real sign-in.' }));
    page = await context.newPage(); await page.goto(local.url);
    await expect(page.getByText('Synthetic T050 player (github)', { exact: true })).toBeVisible();
  });
  test.afterEach(async () => { try { await context?.close(); } finally { await local?.stop(); } expect(errors).toEqual([]); });
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const settings = () => page.getByRole('dialog', { name: 'Settings', exact: true });
  async function start() { await clickButton(page, 'New Adventure'); await clickButton(page, 'Start new adventure'); await expect(page.getByRole('heading', { name: 'The Arrival Lift', exact: true })).toBeVisible(); }
  async function notes(value: string) { await clickButton(page, 'Notebook'); await page.getByRole('textbox', { name: 'Personal notes', exact: true }).fill(value); await clickButton(page, 'Close notebook'); }
  async function firstSave() { await clickButton(page, 'Save'); await clickButton(page, 'Save this adventure'); await expect(page.getByText(/^Saved at \d{4}-\d{2}-\d{2}T/)).toBeVisible(); }
  async function beginDeletion() {
    await clickButton(page, 'Settings'); await clickButton(page, 'Delete account');
    const popup = context.waitForEvent('page'); await clickButton(page, 'Confirm choice and sign in again'); const providerPage = await popup;
    await expect(button('Check deletion sign-in result')).toBeVisible();
    await expect.poll(() => mutations.filter(m => m.path.endsWith('/auth/github/start')).length).toBe(1);
    await providerPage.waitForURL('https://github.com/login/oauth/authorize**'); await providerPage.bringToFront();
    const cookie = (await context.cookies(local.url)).find(item => item.name === '__Secure-nq_session')!;
    const rotated = await local.completeDeletionReauth(`${cookie.name}=${cookie.value}`); await installCookie(rotated.cookie);
    await page.bringToFront(); await expect(button('Delete account now')).toBeVisible();
    expect(mutations.filter(m => m.method === 'DELETE').length).toBe(0);
  }
  test('canceled logout preserves edited notes, session and save; confirmed logout clears title and all editor/scene DOM without a save', async () => {
    await start(); await notes('durable notes'); await firstSave(); await notes('unsaved private notebook text'); const stored = await local.inspect();
    await pressButton(page, 'Settings', 'Enter'); await expect(settings()).toContainText('Synthetic T050 player (GitHub)'); await clickButton(page, 'Log out');
    const before = mutations.length; await settings().getByRole('button', { name: 'Cancel', exact: true }).press('Enter'); expect(mutations).toHaveLength(before);
    await clickButton(page, 'Close settings'); await clickButton(page, 'Notebook'); await expect(page.getByRole('textbox', { name: 'Personal notes', exact: true })).toHaveValue('unsaved private notebook text');
    await clickButton(page, 'Settings'); await clickButton(page, 'Log out'); await pressButton(page, 'Confirm logout', 'Enter');
    await expect(settings()).toContainText('Logout confirmed'); await clickButton(page,'Close settings'); await expect(page.getByRole('heading', { name: 'Network Quest', exact: true })).toBeVisible();
    expect(await local.inspect()).toEqual(stored); expect(mutations.filter(m => m.method === 'PUT').length).toBe(1); expect(mutations.filter(m => m.path.endsWith('/logout')).length).toBe(1);
    await expect(page.getByRole('textbox', { name: 'Personal notes', includeHidden: true })).toHaveValue('');
    expect(await page.evaluate(() => document.body.textContent?.includes('unsaved private notebook text'))).toBe(false);
    await clickButton(page, 'New Adventure'); await clickButton(page, 'Notebook'); await expect(page.getByRole('textbox', { name: 'Personal notes', exact: true })).toHaveValue('');
    await page.screenshot({ path: '.local/T052-logout-cleared-notebook.png', fullPage: true });
  });
  test('actual conditional autosave choice changes only preference until manual adoption, then saves at a later room boundary', async () => {
    await start(); await clickButton(page, 'Settings'); await expect(settings()).toContainText('same account save slot');
    await pressButton(page, 'Enable account autosave', 'Enter'); await expect(settings()).toContainText('Last confirmed account setting: on.');
    expect((await local.inspectAccount()).preference?.autosave_enabled).toBe(1); expect(await local.inspect()).toBeNull();
    await clickButton(page, 'Close settings'); await clickButton(page, "Walk to The Titan's Workshop"); await expect(page.getByRole('heading', { name: "The Titan's Workshop", exact: true })).toBeVisible();
    expect(await local.inspect()).toBeNull(); expect(mutations.filter(m => m.method === 'PUT').length).toBe(0);
    await firstSave(); await clickButton(page, 'Walk to The Arrival Lift'); await expect.poll(async () => (await local.inspect())?.revision).toBe(2);
    const patch = mutations.find(m => m.method === 'PATCH')!; expect(patch.headers['if-match']).toBe('"prefs-1"');
    await clickButton(page, 'Settings'); await clickButton(page, 'Turn off account autosave'); await expect(settings()).toContainText('Last confirmed account setting: off.');
    await clickButton(page, 'Close settings'); await notes('unsaved after opt out'); await clickButton(page, "Walk to The Titan's Workshop");
    expect((await local.inspect())?.revision).toBe(2); expect(mutations.filter(m => m.method === 'PUT').length).toBe(2);
  });
  test('settings remain keyboard accessible at 390px/200% text and disclose unverified backup retention', async () => {
    await start(); await page.setViewportSize({ width: 390, height: 844 }); await page.addStyleTag({ content: ':root { font-size: 200%; }' });
    await pressButton(page, 'Settings', 'Enter'); await expect(settings().getByRole('heading', { name: 'Account settings', exact: true })).toBeFocused();
    await expect(settings()).toContainText('has not been verified'); await expect(settings()).not.toContainText('30 days');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: '.local/T052-settings-390px-200text.png', fullPage: true }); await page.keyboard.press('Escape'); await expect(button('Settings')).toBeFocused();
  });
  test('explicit deletion with private synthetic recent same-account proof removes actual live rows and sessions', async () => {
    await start(); await notes('deletion fixture notes'); await firstSave(); await beginDeletion();
    await pressButton(page, 'Delete account now', 'Enter'); await expect(settings()).toContainText('Account deletion confirmed');
    const counts = await local.inspectAccount(); expect(counts).toMatchObject({ accounts: 0, identities: 0, sessions: 0, preferences: 0, saves: 0 });
    await clickButton(page,'Close settings'); await expect(page.getByRole('heading', { name: 'Network Quest', exact: true })).toBeVisible();
    expect(mutations.filter(m => m.method === 'DELETE').length).toBe(1); expect(mutations.filter(m => m.path.endsWith('/deletion-status')).length).toBe(0);
    expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
    const receipt = mutations.find(m => m.method === 'DELETE')!.headers['x-deletion-receipt']!;
    expect(/^[A-Za-z0-9_-]{43}$/.test(receipt)).toBe(true); expect((await page.content()).includes(receipt)).toBe(false);
    await page.screenshot({ path: '.local/T052-deletion-confirmed.png', fullPage: true });
  });
  test('lost DELETE response confirms only through the actual read-only operation receipt and clears old in-memory adventure', async () => {
    await start(); await notes('lost-response private notes'); await firstSave(); await beginDeletion();
    await page.route('**/api/v1/account', async route => { expect(route.request().method()).toBe('DELETE'); expect(await local.commitAndLoseResponse(route.request())).toBe(204); await route.abort('failed'); });
    await clickButton(page, 'Delete account now'); await expect(settings()).toContainText('Deletion is unconfirmed');
    await expect(settings()).toContainText('Account deletion confirmed'); expect((await local.inspectAccount()).accounts).toBe(0);
    const deletions = mutations.filter(m => m.method === 'DELETE'), checks = mutations.filter(m => m.path.endsWith('/deletion-status'));
    expect(deletions.length).toBe(1); expect(checks.length).toBe(1); expect(checks[0]!.headers['x-deletion-receipt'] === deletions[0]!.headers['x-deletion-receipt']).toBe(true);
    expect(checks[0]!.headers['x-csrf-token']).toBeUndefined(); await clickButton(page,'Close settings'); await expect(page.getByRole('heading', { name: 'Network Quest', exact: true })).toBeVisible();
    expect(mutations.filter(m => m.path.endsWith('/auth/github/start')).length).toBe(1); await page.screenshot({ path: '.local/T052-deletion-receipt-confirmed.png', fullPage: true });
  });
  test('lost logout response preserves memory until explicit current-session confirmation', async () => {
    await start(); await notes('logout response lost'); await firstSave(); const slot = await local.inspect();
    await page.route('**/api/v1/logout', async route => { expect(await local.commitAndLoseResponse(route.request())).toBe(204); await route.abort('failed'); });
    await clickButton(page, 'Settings'); await clickButton(page, 'Log out'); await clickButton(page, 'Confirm logout'); await expect(settings()).toContainText('Logout is unconfirmed');
    await expect(page.getByRole('heading', { name: 'The Arrival Lift', exact: true })).toBeVisible(); await clickButton(page, 'Check logout status');
    await expect(settings()).toContainText('Logout confirmed'); await clickButton(page,'Close settings'); await expect(page.getByRole('heading', { name: 'Network Quest', exact: true })).toBeVisible();
    expect(await local.inspect()).toEqual(slot); expect(mutations.filter(m => m.path.endsWith('/logout')).length).toBe(1);
  });
  test('failed explicit logout check re-enables its native control after backoff without automatic GET', async () => {
    await start(); await page.route('**/api/v1/logout', route => route.abort('failed'));
    await clickButton(page, 'Settings'); await clickButton(page, 'Log out'); await clickButton(page, 'Confirm logout'); await expect(settings()).toContainText('Logout is unconfirmed');
    let checks = 0;
    await page.route('**/api/v1/session', route => { checks++; return route.fulfill({ status: 503, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'Retry-After': '2' },
      body: JSON.stringify({ code: 'unavailable', message: 'Synthetic retry fixture', requestId: '10000000-0000-4000-8000-000000000001' }) }); });
    await clickButton(page, 'Check logout status'); await expect(button('Check logout status')).toBeHidden();
    await expect(button('Check logout status')).toBeVisible(); expect(checks).toBe(1); await clickButton(page, 'Close settings'); await expect(page.getByRole('heading', { name: 'The Arrival Lift', exact: true })).toBeVisible(); expect(mutations.filter(m => m.path.endsWith('/logout')).length).toBe(1);
  });
  test('T148 title settings write only the chosen field at each reviewed revision and reload in the adventure', async () => {
    const patches: object[] = [];
    page.on('request', req => { if (req.method() === 'PATCH') patches.push(req.postDataJSON() as object); });
    const confirmed = () => expect(settings().locator('.nq-media-preferences-status')).toHaveText('Presentation preferences saved to your account.');
    await clickButton(page, 'Settings');
    const check = settings().getByRole('checkbox', { name: 'Show sound captions' });
    const motion = settings().getByRole('combobox', { name: 'Reduced motion' });
    await tabTo(page, check); await page.keyboard.press('Space'); await confirmed(); await expect(check).toBeFocused();
    await motion.selectOption('off'); await confirmed();
    for (const [label, value] of [['Music volume', '0.33'], ['Effects volume', '0.64'], ['Voice volume', '0.15'], ['Text size', '1.5']] as const) {
      await settings().getByRole('slider', { name: label }).fill(value); await confirmed();
    }
    expect(patches).toEqual([{ captions: false }, { reducedMotion: 'off' }, { musicVolume: 0.33 }, { effectsVolume: 0.64 }, { voiceVolume: 0.15 }, { textScale: 1.5 }]);
    expect(mutations.filter(req => req.method === 'PATCH').map(req => req.headers['if-match'])).toEqual(['"prefs-1"', '"prefs-2"', '"prefs-3"', '"prefs-4"', '"prefs-5"', '"prefs-6"']);
    expect((await local.inspectAccount()).preference).toMatchObject({ revision: 7, autosave_enabled: 0 });
    await page.reload(); await start(); await openFrame(page, 'Sound and reading');
    await expect(page.getByRole('checkbox', { name: 'Show sound captions' })).not.toBeChecked();
    await expect(page.getByRole('combobox', { name: 'Reduced motion' })).toHaveValue('off');
    for (const [label, value, spoken] of [['Music volume', '0.33', '33%'], ['Effects volume', '0.64', '64%'], ['Voice volume', '0.15', '15%'], ['Text size', '1.5', '150%']] as const) {
      const slider = page.getByRole('slider', { name: label });
      await expect(slider).toHaveValue(value); await expect(slider).toHaveAttribute('aria-valuetext', spoken);
    }
    await closeFrame(page); await expect(page.locator('.nq-room')).toHaveAttribute('data-reduced-motion', 'false');
    expect(await local.inspectSlot()).toBeNull(); expect(mutations.filter(req => req.method === 'PUT')).toHaveLength(0);
  });

  test('T148 an unconfirmed account edit needs a deliberate reload and keeps the acknowledged save and unsaved notes', async () => {
    await start(); await notes('Confirmed settings test notes'); await firstSave();
    const slot = await local.inspectSlot();
    await notes('Edit left in the notebook'); await clickButton(page, 'Settings');
    // PATCH reaches the real server. Fail just the subsequent confirmation read.
    await page.route('**/api/v1/session', route => route.abort('failed'), { times: 1 });
    const voice = settings().getByRole('slider', { name: 'Voice volume' });
    await voice.fill('0.45');
    await expect(settings()).toContainText('Reload account presentation preferences to confirm');
    await expect(voice).toBeDisabled();
    expect((await local.inspectAccount()).preference?.revision).toBe(2);
    await clickButton(page, 'Reload account presentation preferences');
    await expect(voice).toBeEnabled(); await expect(voice).toHaveValue('0.45'); await expect(settings()).toContainText('loaded for review');
    expect(mutations.filter(req => req.method === 'PATCH')).toHaveLength(1);
    expect(await local.inspectSlot()).toEqual(slot);
    await clickButton(page, 'Close settings'); await clickButton(page, 'Notebook');
    await expect(page.getByRole('textbox', { name: 'Personal notes' })).toHaveValue('Edit left in the notebook');
  });

  test('T148 starting a new adventure during a pending account edit retains the review requirement', async () => {
    await clickButton(page, 'Settings');
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const intercepted = page.waitForRequest(req => req.method() === 'PATCH' && req.url().endsWith('/preferences'));
    await page.route('**/api/v1/preferences', async route => { await held; await route.abort('failed'); });
    try {
      await settings().getByRole('slider', { name: 'Effects volume' }).fill('0.4');
      await intercepted;
      await expect(settings()).toContainText('Saving account presentation preferences');
      await clickButton(page, 'Close settings'); await start(); await openFrame(page, 'Sound and reading');
      await expect(page.locator('.nq-media-preferences-status')).toContainText('Account confirmation was interrupted');
      const effects = page.getByRole('slider', { name: 'Effects volume' });
      await expect(effects).toBeDisabled();
      await clickButton(page, 'Reload account presentation preferences');
      await expect(effects).toBeEnabled(); await expect(effects).toHaveValue('1');
      expect(mutations.filter(req => req.method === 'PATCH')).toHaveLength(1);
      expect(await local.inspectSlot()).toBeNull(); expect((await local.inspectAccount()).preference?.revision).toBe(1);
    } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
  });

  test('T148 guest controls change active native channels, muted captions, reading size and motion without storage or a gameplay write', async () => {
    await context.clearCookies();
    // Observe the detached native media elements. Playback, decoding and setters remain native.
    await page.addInitScript(() => {
      const observed = new Map<string, HTMLMediaElement>(), original = HTMLMediaElement.prototype.play;
      Object.assign(window, { observedRoomMedia: observed });
      HTMLMediaElement.prototype.play = function () {
        observed.set(new URL(this.src).pathname, this);
        return original.call(this);
      };
    });
    await page.reload(); await expect(page.getByRole('region', { name: 'Account save' }).getByText('Guest — progress is only in this session.', { exact: true })).toBeVisible();
    await clickButton(page, 'Settings');
    const textSize = settings().getByRole('slider', { name: 'Text size' });
    const heading = settings().getByRole('heading', { name: 'Account data and backup policy' });
    const base = await heading.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    await textSize.fill('2');
    expect(await heading.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(base * 2);
    await settings().getByRole('slider', { name: 'Effects volume' }).fill('0.3');
    await settings().getByRole('slider', { name: 'Voice volume' }).fill('0');
    await settings().getByRole('combobox', { name: 'Reduced motion' }).selectOption('off');
    await clickButton(page, 'Close settings'); await clickButton(page, 'New Adventure');
    const room = page.locator('.nq-room');
    await expect(room).toHaveAttribute('data-reduced-motion', 'false');
    await expect(room).toHaveAttribute('data-animated-actors', /^[1-9]\d*$/);
    await openFrame(page, 'Sound and reading');
    await clickButton(page, 'Replay Title theme');
    const levels = () => page.evaluate(() => {
      const media = (window as unknown as { observedRoomMedia: Map<string, HTMLMediaElement> }).observedRoomMedia;
      return [...media].map(([path, node]) => ({ path, playing: !node.paused, volume: node.volume }));
    });
    const musicLevel = async () => (await levels()).find(row => row.path.endsWith('/music/title.mp3') && row.playing)?.volume;
    await expect.poll(musicLevel).toBe(1);
    const music = page.getByRole('slider', { name: 'Music volume' }); await music.scrollIntoViewIfNeeded();
    const bounds = (await music.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width - 7, bounds.y + bounds.height / 2); await page.mouse.down();
    try {
      await page.mouse.move(bounds.x + bounds.width * .4, bounds.y + bounds.height / 2);
      await expect.poll(musicLevel).toBeCloseTo(.4, 1);
      expect(await musicLevel()).toBeCloseTo(Number(await music.inputValue()), 5);
      expect((await levels()).find(row => row.path.endsWith('/ambience/r01.mp3') && row.playing)?.volume).toBeCloseTo(.3);
      expect(mutations).toEqual([]);
    } finally { await page.mouse.up(); }
    await clickButton(page, 'Replay Narrator');
    const transcript = page.locator('.nq-media-cue[data-asset-id="spec001:ASSET-VOICE-001"]');
    await expect(transcript).toHaveAttribute('data-audio-status', 'muted');
    await closeFrame(page);
    const caption = page.locator('.nq-media-caption');
    await expect(caption).toContainText('Welcome to the Underworld.'); await expect(caption).toBeVisible();
    await expect(caption).toHaveCSS('font-size', '32px');
    await openFrame(page, 'Sound and reading'); await page.getByRole('checkbox', { name: 'Show sound captions' }).uncheck();
    const heldMusic = await musicLevel();
    await page.getByRole('slider', { name: 'Voice volume' }).fill('0.65');
    await clickButton(page, 'Replay Narrator');
    await expect.poll(async () => (await levels()).find(row => row.path.endsWith('/auditions/narrator-001.mp3') && row.playing)?.volume).toBeCloseTo(.65);
    expect(await musicLevel()).toBe(heldMusic);
    await page.getByRole('combobox', { name: 'Reduced motion' }).selectOption('system');
    await expect(transcript).toContainText('Welcome to the Underworld.'); await closeFrame(page);
    await expect(caption).toBeHidden(); await expect(room).toHaveAttribute('data-animated-actors', '0');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(room).toHaveAttribute('data-animated-actors', /^[1-9]\d*$/);
    expect(await local.inspectSlot()).toBeNull(); expect(mutations).toEqual([]);
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
    await page.reload(); await clickButton(page, 'Settings');
    for (const label of ['Text size', 'Music volume', 'Effects volume', 'Voice volume']) await expect(settings().getByRole('slider', { name: label })).toHaveValue('1');
    await expect(settings().getByRole('checkbox', { name: 'Show sound captions' })).toBeChecked();
    await expect(settings().getByRole('combobox', { name: 'Reduced motion' })).toHaveValue('system');
    expect(mutations).toEqual([]);
  });
});
