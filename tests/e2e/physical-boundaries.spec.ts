// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { expect, firefox, test } from '@playwright/test';
import type { CopperChallenge, CopperInput, CopperProfile } from '../../src/domain/copper';
import type { DomainAction, WorldVersion } from '../../src/domain/types';
import { localTls } from './support/local-tls';

interface ReviewedCase {
  id: string;
  inputs: Record<string, unknown>;
  expected: { status: string; observation: Record<string, unknown> };
}
const reviewed = JSON.parse(await readFile(new URL('../fixtures/physical-cases.json', import.meta.url), 'utf8')) as {
  profiles: CopperProfile[]; referenceCases: ReviewedCase[]; reviewCases: ReviewedCase[];
};
const cases = [...reviewed.referenceCases, ...reviewed.reviewCases];
const fixture = (id: string) => {
  const entry = cases.find(item => item.id === id);
  if (!entry) throw new Error(`Missing independently reviewed case ${id}`);
  return entry;
};
const profile = reviewed.profiles.find(item => item.id === 'spec001:PROFILE-COPPER-100');
if (!profile) throw new Error('Missing independently reviewed copper profile');
const lengthIds = ['T01', 'T02', 'B-COPPER-100', 'B-COPPER-OVER'];

/**
 * Test-only evaluator bench. This closes PLAN's browser-boundary evidence gap;
 * it is deliberately separate from the actual guest application journeys.
 * No game, save, notebook, objective, receipt or guest state is installed.
 * Expected answers stay in the test process, never in the browser bench.
 */
test('T035 browser bench executes independent correct, incorrect, exact-limit and content-error cases', async () => {
  expect(profile.parameters).toEqual({ maximumChannelLength: { value: 100, unit: 'm' }, inclusiveMaximum: true });
  expect(fixture('B-COPPER-100').inputs['lengths']).toEqual([{ value: 90, unit: 'm' }, { value: 10, unit: 'm' }]);
  expect(fixture('B-COPPER-100').expected).toMatchObject({ status: 'correct', observation: {
    total: { value: 100, unit: 'm' }, headroom: { value: 0, unit: 'm' },
  } });
  expect(fixture('B-COPPER-OVER').expected).toMatchObject({ status: 'incorrect', observation: {
    total: { value: 100.01, unit: 'm' }, excess: { value: 0.01, unit: 'm' },
  } });
  expect(fixture('T14').inputs['variants']).toEqual(['missing-required-unit', 'negative-passive-loss', 'unknown-authored-profile']);

  const local = await localTls();
  const errors: string[] = [], writes: string[] = [], external: string[] = [];
  let context: Awaited<ReturnType<typeof firefox.launchPersistentContext>> | undefined;
  try {
    context = await firefox.launchPersistentContext(local.profile, {
      headless: true, ignoreHTTPSErrors: false, viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    context.on('request', request => {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.origin !== new URL(local.url).origin) external.push(url.origin);
      if (url.pathname.includes('/api/') && request.method() !== 'GET') writes.push(`${request.method()} ${url.pathname}`);
    });
    // Suppress the unrelated application entry only in this isolated test page.
    // Actual guest/packet tests load src/main.ts unchanged and remain separate.
    await page.route('**/src/main.ts', route => route.fulfill({ contentType: 'application/javascript', body: 'export {};' }));
    expect((await page.goto(local.url))?.status()).toBe(200);
    await page.evaluate(async ({ base, profile, inputs }) => {
      const { evaluateCopper } = await import(`${base}src/domain/copper.ts`) as typeof import('../../src/domain/copper');
      const { evaluateAuthoredQuantity } = await import(`${base}src/domain/evaluate.ts`) as typeof import('../../src/domain/evaluate');
      const world = { configurationRevision: 0, attemptId: 'T035-isolated-rule-bench' } as WorldVersion;
      const action = { actionId: 'T035-measure', expectedVersion: world, input: { kind: 'measure-length' } } as DomainAction<CopperInput>;
      const main = document.createElement('main'), title = document.createElement('h1'), explanation = document.createElement('p');
      title.textContent = 'T035 test-only physical rule bench';
      explanation.textContent = 'Independent evaluator verification. Fictional 100 m inclusive length profile; length only, not whole-route proof. No guest adventure or saved progress is present.';
      const output = document.createElement('pre'); output.setAttribute('aria-label', 'Actual evaluator result'); output.setAttribute('role', 'status');
      main.append(title, explanation);
      const length = (lengths: unknown, selectedProfile: unknown = profile) => evaluateCopper({ kind: 'copper-length', profile: selectedProfile, lengths } as CopperChallenge, action, world);
      const add = (id: string, run: () => unknown) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = `Evaluate ${id}`;
        button.addEventListener('click', () => { output.textContent = JSON.stringify(run(), null, 2); }); main.append(button);
      };
      for (const input of inputs) add(input.id, () => length(input.lengths));
      add('T14 missing unit', () => length([{ value: 85 }]));
      add('T14 negative passive loss', () => evaluateAuthoredQuantity({ value: -0.01, unit: 'dB' }, 'dB', 'passiveLoss'));
      add('T14 unknown profile', () => length([{ value: 85, unit: 'm' }], { ...profile, id: 'spec001:UNKNOWN' }));
      main.append(output); document.body.replaceChildren(main);
    }, { base: local.url, profile, inputs: lengthIds.map(id => ({ id, lengths: fixture(id).inputs['lengths'] })) });

    const result = page.getByRole('status', { name: 'Actual evaluator result', exact: true });
    await expect(page.getByRole('heading', { name: 'T035 test-only physical rule bench', exact: true })).toBeVisible();
    for (const id of lengthIds) {
      const entry = fixture(id);
      // Both native keyboard activation and pointer activation call real code.
      const control = page.getByRole('button', { name: `Evaluate ${id}`, exact: true });
      if (id === 'B-COPPER-100') await control.press('Enter'); else await control.click();
      const observed = JSON.parse(await result.innerText()) as { status: string; reasonCode: string; acceptedEffects: unknown[]; observations: Record<string, unknown>[] };
      expect(observed.status, id).toBe(entry.expected.status);
      expect(observed.acceptedEffects, id).toEqual([]);
      expect(observed.observations, id).toHaveLength(1);
      expect(observed.observations[0], id).toMatchObject({ kind: 'copper-length', scope: 'length only', wholeRouteProven: false,
        maximum: profile.parameters.maximumChannelLength, version: { configurationRevision: 0, attemptId: 'T035-isolated-rule-bench' } });
      for (const key of ['total', 'headroom', 'excess']) {
        if (key in entry.expected.observation) expect(observed.observations[0], `${id} ${key}`).toHaveProperty(key, entry.expected.observation[key]);
      }
      if ('reason' in entry.expected.observation) expect(observed.reasonCode, id).toBe(entry.expected.observation['reason']);
      if (id === 'B-COPPER-100') await page.screenshot({ path: 'test-results/T035-boundary-100m.png', fullPage: true });
    }
    for (const variant of ['missing unit', 'negative passive loss', 'unknown profile']) {
      await page.getByRole('button', { name: `Evaluate T14 ${variant}`, exact: true }).click();
      const observed = JSON.parse(await result.innerText()) as { status: string; reasonCode: string; acceptedEffects: unknown[]; observations: Record<string, unknown>[] };
      expect(observed.status, variant).toBe(fixture('T14').expected.status);
      expect(observed.reasonCode).toBe('malformed-authored-challenge');
      expect(observed.acceptedEffects).toEqual([]);
      expect(observed.observations).toHaveLength(1);
      expect(observed.observations[0]).toMatchObject(fixture('T14').expected.observation);
      expect(observed.observations[0]).toMatchObject({ kind: 'content-error', attemptPenalty: 0, progressAward: 0 });
    }
  } finally {
    try { await context?.close(); } finally { await local.stop(); }
    expect(errors, 'All page errors are fatal').toEqual([]);
    expect(writes, 'No API writes from a rule bench').toEqual([]);
    expect(external, 'No external requests from a rule bench').toEqual([]);
  }
});
