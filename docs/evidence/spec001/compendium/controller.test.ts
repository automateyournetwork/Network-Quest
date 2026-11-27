// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { loadIntroductionContent, episodeNavigationEntries } from '../../../../src/app/content';
import { createNavigation } from '../../../../src/state/navigation';
import { createNotebookController } from '../../../../src/ui/notebook';
import { createVerbController } from '../../../../src/ui/verbs';
import { q, setup } from '../../../../tests/ui/inventory-fixture';
import presentation from '../../../../content/spec001/notebook-first-route.json';
import sourceCatalog from '../../../../content/spec001/sources.json';
import { createCompendiumController } from './controller-candidate';

function fixture() {
  const f = setup(), content = loadIntroductionContent(), registry = content.registry, metadata = content.world;
  const notebook = createNotebookController({ ...f, registry, presentation });
  const navigation = createNavigation({ registry, world: metadata, entries: episodeNavigationEntries(registry, metadata) });
  const compendium = createCompendiumController({ ...f, registry, metadata, navigation, notebook, sourceCatalog: sourceCatalog.sources });
  const verbs = createVerbController({ ...f, registry, bindings: [], panels: compendium.panels });
  return { ...f, notebook, compendium, verbs };
}

describe('T095 candidate controller uses the existing action/store boundary', () => {
  it('opens through the actual panel intent with no discovery, reward or dirty generation change', () => {
    const f = fixture(), before = f.store.getState(), first = f.compendium.project();
    expect(f.bus.dispatch(first.capture({ kind: 'open-panel', panel: 'compendium' })).status).toBe('handled');
    const after = f.store.getState(), projected = f.compendium.project();
    expect(projected.open).toBe(true); expect(projected.capture).toBe(first.capture);
    expect(after.runtime.game).toBe(before.runtime.game); expect(after.runtime.persistence).toBe(before.runtime.persistence); expect(projected.view.entries).toEqual([]);
  });
  it('reads only actual recorded notebook rows, retains stale measurement versions and real source text', () => {
    const f = fixture(), before = f.store.getState(), game = before.runtime.game!;
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...game, world: { ...game.world, compendiumIds: [q<'compendium'>('COMPENDIUM-CH03')] },
      notebook: { ...game.notebook, factIds: [q<'fact'>('FACT-power')], personalNotes: 'I think that power proves data.' } } } });
    const view = f.compendium.project().view;
    expect(view.entries[0]?.name).toBe('Photon the Firefly'); expect(view.entries[0]?.sources[0]?.title).toBe(sourceCatalog.sources[0]!.title);
    expect(view.evidence.map(row => row.evidence)).toEqual(f.notebook.project().view.evidence);
    expect(view.evidence[0]?.evidence.text).toContain('Power indication does not prove'); expect(view.evidence[0]?.evidence.freshness).toBe('observation');
    expect(view.personalNotes).toBe('I think that power proves data.');
  });
  it('rejects opening in unsafe states and rejects retained panel planners after disposal', () => {
    const f = fixture(), before = f.store.getState();
    f.replace({ ...before, runtime: { ...before.runtime, activity: { kind: 'dialogue-transaction' } } });
    expect(f.bus.dispatch(f.bus.capture({ kind: 'open-panel', panel: 'compendium' })).status).toBe('unavailable');
    f.replace(before); f.compendium.dispose(); expect(f.bus.dispatch(f.bus.capture({ kind: 'open-panel', panel: 'compendium' })).status).toBe('unavailable');
    expect(f.store.getState()).toBe(before);
  });
  it('replaces projections on world restore and invalidates old capture through the existing bus epoch', () => {
    const f = fixture(), old = f.compendium.project(), before = f.store.getState();
    f.bus.invalidate(); f.compendium.invalidate();
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...before.runtime.game!, notebook: { ...before.runtime.game!.notebook, personalNotes: 'Restored text' } } } });
    const restored = f.compendium.project(); expect(restored.capture).not.toBe(old.capture); expect(restored.view.personalNotes).toBe('Restored text');
    expect(f.bus.dispatch(old.capture({ kind: 'open-panel', panel: 'compendium' })).reason).toBe('invalidated');
  });
});
