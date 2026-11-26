// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { createTitleController } from '../../src/ui/title';
import { createReducerState } from '../../src/state/reducer';
import type { RuntimeState, SaveSummary } from '../../src/state/types';
import { registry, q } from './inventory-fixture';

function fixture(runtime = createIntroductionRuntime()) {
  let state = createReducerState(runtime);
  const invalidated = vi.fn(), changed = vi.fn();
  const title = createTitleController({ getState: () => state, start: before => {
    if (state !== before) return false;
    const next = createReducerState(startIntroduction(before.runtime, registry));
    invalidated(); state = next; return true;
  }, changed });
  return { title, invalidated, changed, get state() { return state; }, set state(next) { state = next; } };
}
describe('T029 title lifecycle and honest persistence boundary', () => {
  it('starts immediately as guest with no account or durable save; Continue is honestly unavailable', () => {
    const f = fixture(); expect(f.title.project().continueAvailable).toBe(false);
    f.title.act('continue'); expect(f.state.runtime.game).toBeNull();
    f.title.act('new'); expect(f.state.runtime.game!.world.roomId).toBe(q('R01')); expect(f.invalidated).toHaveBeenCalledOnce();
    expect(f.state.runtime.persistence.autosaveEnabled).toBe(false); expect(f.state.runtime.persistence.status).toBe('unsaved');
  });
  it('warns before replacing memory; cancel preserves exact state; confirmed new run allocates fresh identities', () => {
    const f = fixture(); f.title.act('new'); const before = f.state;
    f.title.act('new'); expect(f.title.project().panel).toBe('confirm-new'); expect(f.state).toBe(before);
    f.title.act('cancel'); expect(f.state).toBe(before); expect(f.title.project().panel).toBe('none');
    f.title.act('new'); f.title.act('confirm-new'); expect(f.state.runtime.game!.adventureId).not.toBe(before.runtime.game!.adventureId);
    expect(f.state.runtime.game!.world.attemptId).not.toBe(before.runtime.game!.world.attemptId);
    expect(f.state.runtime.game!.notebook.personalNotes).toBe('');
  });
  it('does not authorize a stale confirmation after an intervening state replacement', () => {
    const f = fixture(); f.title.act('new'); f.title.act('new'); f.state = structuredClone(f.state); const before = f.state;
    f.title.act('confirm-new'); expect(f.state).toBe(before); expect(f.title.project().message).toContain('changed');
  });
  it('preserves authenticated identity and confirmed slot metadata while clearing replacement consent and suppressing autosave', () => {
    const empty = createIntroductionRuntime();
    // Controlled server-metadata double; no OAuth or save service is claimed.
    const slot = { revision: 7, etag: '"save-7"', savedAt: '2026-11-25T12:00:00Z', adventureId: 'older-adventure', episodeId: 'spec001', roomId: 'spec001:R02', outcome: null, saveSchemaVersion: 1, contentVersion: '1.0.0' } as unknown as SaveSummary;
    const auth = { status: 'authenticated', provider: 'github', displayName: '<b>Test identity</b>', clientGeneration: 1, csrfToken: 'test-token', expiresAt: '2026-11-26T12:00:00Z' } as RuntimeState['auth'];
    const f = fixture({ ...empty, auth, persistence: { ...empty.persistence, knownSlot: slot, autosaveEnabled: true } });
    f.title.act('new'); expect(f.state.runtime.game).toBeNull(); expect(f.title.project().slot).toEqual(slot);
    f.title.act('confirm-new'); expect(f.state.runtime.auth).toBe(auth); expect(f.state.runtime.persistence.knownSlot).toBe(slot);
    expect(f.state.runtime.persistence.replacementAuthorization).toBeNull(); expect(f.state.runtime.persistence.autosaveEnabled).toBe(false);
    expect(f.title.project().continueAvailable).toBe(false); // Restore service is not connected.
  });
  it('cannot discard an unresolved write or an ongoing authentication operation', () => {
    const empty = createIntroductionRuntime();
    for (const runtime of [ { ...empty, persistence: { ...empty.persistence, status: 'saving' as const } },
      { ...empty, auth: { status: 'authenticating' as const, provider: 'google' as const, purpose: 'login' as const, previous: empty.auth as Extract<RuntimeState['auth'], {status:'guest'}>, clientGeneration: empty.auth.clientGeneration } } ]) {
      const f = fixture(runtime); f.title.act('new'); expect(f.state.runtime).toBe(runtime); expect(f.invalidated).not.toHaveBeenCalled();
    }
  });
  it('dismisses the tutorial invitation without changing game/auth/slot; Save may offer it again without starting a provider', () => {
    const runtime = startIntroduction(createIntroductionRuntime(), registry), game = runtime.game!;
    const f = fixture({ ...runtime, game: { ...game, world: { ...game.world, completedObjectiveIds: [q('O01'), q('O02')] } } });
    const before = f.state; expect(f.title.project().panel).toBe('invitation');
    f.title.act('decline'); expect(f.state).toBe(before); expect(f.title.project().panel).toBe('none');
    f.title.act('save'); expect(f.title.project().panel).toBe('invitation'); expect(f.state).toBe(before);
    f.title.act('google'); expect(f.state).toBe(before); expect(f.title.project().message).toContain('unavailable');
  });
  it('defers the invitation until the notebook is closed and preserves it through settings', () => {
    const runtime = startIntroduction(createIntroductionRuntime(), registry), game = runtime.game!;
    const f = fixture({ ...runtime, game: { ...game, world: { ...game.world, completedObjectiveIds: [q('O01'), q('O02')] } }, ui: { ...runtime.ui!, panel: 'notebook' } });
    expect(f.title.project().panel).toBe('none'); f.state = { ...f.state, runtime: { ...f.state.runtime, ui: { ...f.state.runtime.ui!, panel: 'none' } } };
    expect(f.title.project().panel).toBe('invitation'); f.title.act('settings'); expect(f.title.project().panel).toBe('settings');
    f.title.act('cancel'); expect(f.title.project().panel).toBe('invitation');
  });
});
