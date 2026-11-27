// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Preparation only; composition into the shared application awaits coordinator GO.
import { contextFromRuntime } from '../../../../src/ui/action-bus';
import type { ActionBus, ActionCapture } from '../../../../src/ui/action-bus';
import type { GameplayStore, ActiveActionAdmission } from '../../../../src/ui/controller-store';
import { actionAvailable, uiPlan, unavailable } from '../../../../src/ui/controller-store';
import type { PanelPlanner } from '../../../../src/ui/verbs';
import type { GameState } from '../../../../src/state/types';
import type { NotebookEvidenceView } from '../../../../src/ui/notebook';
import { projectCompendium } from './candidate';
import type { CompendiumProjectionOptions } from './candidate';

export interface CompendiumControllerOptions extends Omit<CompendiumProjectionOptions, 'game' | 'evidence' | 'activity'> {
  readonly bus: ActionBus; readonly store: GameplayStore; readonly allowDuringEncounter?: ActiveActionAdmission;
  /** Existing authoritative notebook projection, never renderer-supplied rows. */
  readonly notebook: { project(): { readonly view: { readonly evidence: readonly NotebookEvidenceView[] } } };
}
export function createCompendiumController(options: CompendiumControllerOptions) {
  const { bus, store } = options;
  const metadata = structuredClone(options.metadata), portraits = structuredClone(options.portraits ?? []), sourceCatalog = structuredClone(options.sourceCatalog ?? []);
  let disposed = false, projection: { readonly game: GameState | null; readonly capture: ActionCapture } | null = null;
  const panels: PanelPlanner = (panel, action, before) => {
    if (disposed || panel !== 'compendium') return unavailable('panel-unavailable', 'This panel is not available here.');
    if (!actionAvailable(before, action.input, options.allowDuringEncounter)) return unavailable('unavailable-state', 'Use the compendium after the current activity finishes.');
    return uiPlan(store, before, { panel: 'compendium' }, 'Compendium opened.');
  };
  return { panels, project() {
    if (disposed) throw new Error('Compendium controller is disposed.');
    const state = store.getState(), game = state.runtime.game;
    if (!projection || projection.game !== game) projection = { game, capture: bus.captureScope(contextFromRuntime(state.runtime)) };
    return { capture: projection.capture, open: !!game && state.runtime.ui?.panel === 'compendium', view: projectCompendium({ ...options, metadata, portraits, sourceCatalog,
      game, evidence: options.notebook.project().view.evidence, activity: state.runtime.activity?.kind ?? 'unavailable' }) };
  }, invalidate() { projection = null; }, dispose() { disposed = true; projection = null; } };
}
