// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Independent expectations for the bounded notebook join, written before its implementation.
import { describe, expect, it } from 'vitest';
import { loadIntroductionContent } from '../../../../src/app/content';
import { createNotebookController } from '../../../../src/ui/notebook';
import { q, setup } from '../../../../tests/ui/inventory-fixture';
import type { Measurement } from '../../../../src/state/types';
import presentation from '../../../../content/spec001/notebook-first-route.json';

function fixture(options: { unvisited?: boolean; closed?: boolean; rejectCommit?: boolean } = {}) {
  const f = setup(), registry = loadIntroductionContent().registry, before = f.store.getState(), game = before.runtime.game!;
  const measurement: Measurement = { id: '00000000-0000-4000-8000-000000000095' as never, ruleId: q('PHY04') as never,
    subjectIds: [q('PROFILE-COPPER-100')], roomId: q<'room'>('R01'), stale: true, configurationRevision: 0 as never, attemptId: 'earlier-attempt' as never,
    readings: [{ name: 'Path length', value: 105 as import('../../../../src/domain/types').Metres, unit: 'm' }], conclusionCode: 'length-exceeded' };
  f.replace({ ...before, runtime: { ...before.runtime, ui: { ...before.runtime.ui!, panel: options.closed ? 'none' : 'compendium' }, game: { ...game,
    world: { ...game.world, roomId: q<'room'>('R02'), position: { safePositionId: q<'safe-position'>('R02.entry') } },
    notebook: { ...game.notebook, factIds: [q<'fact'>('FACT-power')], mapRoomIds: options.unvisited ? [q<'room'>('R02')] : [q<'room'>('R01'), q<'room'>('R02')],
      measurements: [measurement], personalNotes: 'A fresh measurement!', hypotheses: [{ id: 'note' as never, text: 'Looks fixed', subjectIds: [], status: 'supported' }] } } } });
  const notebook = createNotebookController({ ...f, registry, presentation, store: options.rejectCommit ? { ...f.store, compareAndSet: () => false } : f.store });
  return { ...f, notebook, measurement, send: (id: string) => f.bus.dispatch(f.bus.capture({ kind: 'inspect-evidence', evidenceId: id as never })) };
}

describe('T095 notebook-owned source selection', () => {
  it('opens the notebook and highlights the real visited source without walking or changing the game', () => {
    const f = fixture(), before = f.store.getState();
    expect(f.send(q('FACT-power')).status).toBe('handled');
    const after = f.store.getState(), view = f.notebook.project().view;
    expect(view.open).toBe(true); expect(view.highlightedRoomId).toBe(q('R01')); expect(view).toHaveProperty('highlightedEvidenceId', q('FACT-power'));
    expect(after.runtime.game).toBe(before.runtime.game); expect(after.runtime.persistence).toBe(before.runtime.persistence);
    expect(after.runtime.game!.world.roomId).toBe(q('R02'));
  });
  it('selects a stale reading as historical evidence without changing its text, versions or freshness', () => {
    const f = fixture(), before = f.store.getState(), original = f.notebook.project().view.evidence.find(row => row.id === f.measurement.id);
    expect(original?.freshness).toBe('stale'); expect(f.send(f.measurement.id).status).toBe('handled');
    expect(f.notebook.project().view.evidence.find(row => row.id === f.measurement.id)).toEqual(original);
    expect(f.store.getState().runtime.game).toBe(before.runtime.game);
  });
  it('rejects guessed, unobserved, unsupported and player-written evidence identities', () => {
    const f = fixture(), before = f.store.getState();
    for (const id of [q('FACT-link'), q('FACT-inspection'), 'note', 'A fresh measurement!', q('CH03')]) expect(f.send(id).status).toBe('rejected');
    expect(f.store.getState()).toBe(before); expect(f.notebook.project().view.highlightedRoomId).toBeNull();
  });
  it('requires an open reading panel and an actually visited source', () => {
    for (const options of [{ closed: true }, { unvisited: true }]) { const f = fixture(options), before = f.store.getState();
      expect(f.send(q('FACT-power')).status).toBe('rejected'); expect(f.store.getState()).toBe(before); }
  });
  it('failed atomic UI installation cannot leave a misleading transient highlight', () => {
    const f = fixture({ rejectCommit: true }), before = f.store.getState();
    expect(f.send(q('FACT-power')).status).toBe('rejected'); expect(f.store.getState()).toBe(before);
    expect(f.notebook.project().view.highlightedRoomId).toBeNull(); expect(f.notebook.project().view).toHaveProperty('highlightedEvidenceId', null);
  });
  it('clears source selection and rejects retained captures across restore/new adventure epochs', () => {
    const f = fixture(), capture = f.notebook.project().capture;
    expect(f.send(q('FACT-power')).status).toBe('handled'); f.notebook.invalidate(); f.bus.invalidate();
    expect(f.notebook.project().view).toHaveProperty('highlightedEvidenceId', null); expect(f.notebook.project().view.highlightedRoomId).toBeNull();
    expect(f.bus.dispatch(capture({ kind: 'inspect-evidence', evidenceId: q<'fact'>('FACT-power') })).reason).toBe('invalidated');
  });
});
