// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import './party.css';
import { isMeasurementCurrent } from '../state/reducer';
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import type { AbilityId, CompendiumId, MeasurementId, QualifiedId } from '../domain/types';
import type { ObjectiveScenarioResolver } from '../state/objectives';
import { partyCharacter, preparePartyChange, recruitIds, partyObjective, historicalPartyMeasurement } from '../state/party';
import type { PartyOperation } from '../state/party';
import type { ReducerState } from '../state/reducer';
import type { ActionBus, ActionCapture, ActionDispatcher, CapturedAction } from './action-bus';
import { contextFromRuntime } from './action-bus';
import type { SemanticControl } from './app-shell';
import type { GameplayStore } from './controller-store';
import { playable, rejected, reductionPlan, uiPlan, unavailable } from './controller-store';
import type { PanelPlanner } from './verbs';

export interface PartyView {
  readonly activeNames: readonly string[];
  readonly rows: readonly { readonly id: string; readonly name: string; readonly status: string; readonly invitation: string;
    readonly lesson: string; readonly explanation: string; readonly controls: readonly SemanticControl[] }[];
}
interface Options { readonly registry: ContentRegistry; readonly world: Pick<S.world, 'characters' | 'documents'>; readonly store: GameplayStore; readonly bus: ActionBus; readonly resolveScenario: ObjectiveScenarioResolver }
export function createPartyController({ registry, world, store, bus, resolveScenario }: Options) {
  const name = (id: string) => world.characters.find(c => c.id === id)?.name ?? id;
  const operation = (action: CapturedAction): PartyOperation | null => {
    const input = action.input;
    switch (input.kind) {
      case 'invite-ally': return { kind: 'invite', characterId: input.characterId };
      case 'begin-ally-practice': return { kind: 'begin-practice', characterId: input.characterId };
      case 'review-ally-practice': return { kind: 'advance', characterId: input.characterId };
      case 'set-active-allies': return { kind: 'set-active', characterIds: input.characterIds };
      case 'use-ally-ability': return { kind: 'ability', characterId: input.characterId, abilityId: input.abilityId, actionId: input.actionId, measurementId: crypto.randomUUID() as MeasurementId };
      default: return null;
    }
  };
  const registrations = (['invite-ally', 'begin-ally-practice', 'review-ally-practice', 'set-active-allies', 'use-ally-ability'] as const).map(kind => bus.register(kind, action => {
    const before = store.getState(), input = operation(action);
    if (!input) return rejected('party-input', 'Choose an ally action.');
    if (!playable(before)) return unavailable('party-unavailable', 'Return to safe preparation before changing or using your party.');
    const result = preparePartyChange(registry, resolveScenario, before.runtime.game!, input, before.control.partyPractice);
    if (!result.ok) return unavailable(result.reason, 'This ally action is not ready. Check the invitation, lesson and current bench controls.');
    const character = 'characterId' in input ? partyCharacter(registry, input.characterId) : null;
    const explanation = input.kind === 'advance' ? character?.progression.find(p => p.level === 2)?.demonstration?.explanation : undefined;
    const contextProfile = input.kind === 'ability' && String(input.actionId) === 'spec001:ACTION-read-PROFILE-OPTICAL' ? registry.record('spec001:PROFILE-OPTICAL') : null;
    const profileContext = contextProfile?.kind === 'profile' ? [contextProfile.alternatives[0]?.explanation, contextProfile.model.scope,
      ...contextProfile.model.assumptions, ...contextProfile.model.limitations].join(' ') : null;
    const message = profileContext ?? (input.kind === 'invite' ? `${name(input.characterId)} joined your party.`
      : input.kind === 'begin-practice' ? 'Practice started. Use the actual bench controls, then return to review the lesson. Practice restarts after Retry or Restore.'
      : input.kind === 'advance' ? `Lesson reviewed. ${explanation ?? ''}`
      : input.kind === 'set-active' ? 'Active allies updated. Swapping allies costs nothing.' : 'Ally action applied through the ordinary bench checks. Inspect the current reading in the notebook.');
    return reductionPlan(store, action, before, { kind: 'party', operation: input }, message);
  }));
  let previous: ReducerState | null = null, capture: ActionCapture = bus.captureScope(null);
  const panels: PanelPlanner = (panel, _action, before) => panel === 'party' && playable(before)
    ? uiPlan(store, before, { panel: 'party' }, 'Party opened.') : unavailable('party-unavailable', 'The party is available during safe preparation.');
  const actionLabel = (id: string) => {
    for (const document of world.documents) {
      const reference = registry.record(document.id); if (!reference) continue;
      if (reference.kind === 'profile') { const alternative = reference.alternatives.find(a => a.id === id); if (alternative) return alternative.label; }
      if (reference.kind === 'dialogue') for (const node of reference.nodes) { const choice = node.choices.find(c => c.id === id); if (choice) return choice.text; }
    }
    return 'Measure the current bench configuration';
  };
  const advancedContext = (id: string, state: ReducerState): string => {
    const game = state.runtime.game!, objectiveId = partyObjective(id), definition = objectiveId && registry.record(objectiveId);
    if (!objectiveId || definition?.kind !== 'objective') return '';
    const resolved = resolveScenario(game, objectiveId);
    if ((id.endsWith('CH03') || id.endsWith('CH16')) && resolved?.kind === 'fiber-preparation' && game.world.roomId === definition.evidence[0]?.roomId) {
      const labels: Record<string, string> = { hostSupport: 'Host support', mediaMatch: 'Fiber/media', wavelengthDirectionMatch: 'Wavelength direction', rateMatch: 'Supported rate', connectorPolarityMatch: 'Connector/polarity' };
      const fields = Object.entries(resolved.preparation.checks).map(([field, passed]) => `${labels[field]}: ${passed ? 'matches' : 'mismatch'}`);
      return `Current supplied compatibility fields: ${fields.join('; ')}. These independent fields come before optical arithmetic. Inspect, intervene and recheck at the dock; this explanation does not certify a current repair.`;
    }
    const latest = [...game.notebook.measurements].reverse().find(m => historicalPartyMeasurement(registry, game, objectiveId, m)
      || historicalPartyMeasurement(registry, game, objectiveId, m, 'incorrect'));
    const reading = latest ? `Latest actual bench reading (${isMeasurementCurrent(latest, game.world) ? 'current configuration' : 'stale; comparison only'}): ${latest.readings.map(r => `${r.name}: ${r.value} ${r.unit}`).join('; ')}.` : 'Take a measurement at the lesson’s actual bench to compare its checked quantities.';
    const lesson: Record<string, string> = {
      CH04: 'Continuity and the complete channel length are separate requirements; restoring a conductor does not waive the length bound.',
      CH05: 'Read sensitivity, maximum receive and required reserve separately. Enough power alone is not proof that every receiver bound is met.',
      CH06: 'Multiple propagation modes do not create guaranteed independent payload lanes. This lesson uses the declared optical profile without inventing a multimode rate or reach bonus.',
      CH07: 'Compare signal and noise in the same measurement. A clear survey does not preserve a link after noise or configuration changes.',
      CH19: 'Add simultaneous delivered demand before comparing it with the delivered budget. A per-port capability does not waive that shared total.',
      CH20: 'A repeater regenerates a signal over a connected path. It cannot bridge the severed required conductor.',
      CH22: 'A selectable mode must belong to both advertised sets. Faster unilateral selection is not a common mode; an empty intersection cannot negotiate a link.',
    };
    return `${lesson[id.slice(8)] ?? ''} ${reading}`;
  };
  return { panels,
    project(): { readonly view: PartyView; readonly capture: ActionCapture; readonly open: boolean } {
      const state = store.getState(), game = state.runtime.game;
      if (previous !== state) { previous = state; capture = bus.captureScope(contextFromRuntime(state.runtime)); }
      const rows: PartyView['rows'][number][] = [];
      if (game) for (const id of recruitIds) {
        const character = partyCharacter(registry, id);
        if (!character || !game.world.compendiumIds.includes(character.compendium.id as CompendiumId)) continue;
        const recruit = game.world.recruits.find(r => r.characterId === id), active = game.world.activeAllyIds.some(a => a === id), controls: SemanticControl[] = [];
        const add = (key: string, label: string, action: SemanticControl['action'], op: PartyOperation) => {
          const result = preparePartyChange(registry, resolveScenario, game, op, state.control.partyPractice);
          controls.push({ id: `${id}:${key}`, label, action, ...(!playable(state) || !result.ok ? { unavailableReason: 'Check the lesson, location and current preparation.' } : {}) });
        };
        if (!recruit) add('invite', `Invite ${name(id)}`, { kind: 'invite-ally', characterId: id }, { kind: 'invite', characterId: id });
        else {
          const remaining = game.world.activeAllyIds.filter(a => a !== id);
          if (active) add('rest', `Rest ${name(id)}`, { kind: 'set-active-allies', characterIds: remaining }, { kind: 'set-active', characterIds: remaining });
          else if (remaining.length < 2) add('activate', `Activate ${name(id)}`, { kind: 'set-active-allies', characterIds: [...remaining, id] }, { kind: 'set-active', characterIds: [...remaining, id] });
          else for (const replace of remaining) { const ids = [...remaining.filter(a => a !== replace), id]; add(`replace:${replace}`, `Replace ${name(replace)} with ${name(id)}`, { kind: 'set-active-allies', characterIds: ids }, { kind: 'set-active', characterIds: ids }); }
          if (recruit.level === 1) {
            if (state.control.partyPractice?.characterId !== id) add('practice', `Begin practice with ${name(id)}`, { kind: 'begin-ally-practice', characterId: id }, { kind: 'begin-practice', characterId: id });
            else add('review', `Review lesson with ${name(id)}`, { kind: 'review-ally-practice', characterId: id }, { kind: 'advance', characterId: id });
          }
          if (active) for (const ability of character.abilities.filter(a => recruit.abilityIds.includes(a.id as AbilityId))) {
            for (const actionId of ability.conventionalEquivalentActionIds ?? []) {
              const op: PartyOperation = { kind: 'ability', characterId: id, abilityId: ability.id as AbilityId, actionId: actionId as QualifiedId, measurementId: '00000000-0000-4000-8000-000000000001' as MeasurementId };
              if (preparePartyChange(registry, resolveScenario, game, op, state.control.partyPractice).ok)
                add(`${ability.id}:${actionId}`, `${ability.name}: ${actionLabel(actionId)}`, { kind: 'use-ally-ability', characterId: id, abilityId: ability.id as AbilityId, actionId: actionId as QualifiedId }, op);
            }
          }
        }
        rows.push({ id, name: name(id), status: recruit ? `Level ${recruit.level} · ${active ? 'Active ally' : 'Resting'}` : 'Discovered · not recruited',
          invitation: character.compendium.recruitmentSummary ?? '', lesson: character.compendium.progressionSummary ?? '',
          explanation: recruit?.level === 2 ? advancedContext(id, state) : '', controls });
      }
      return { view: { activeNames: game?.world.activeAllyIds.map(name) ?? [], rows }, capture, open: playable(state) && state.runtime.ui?.panel === 'party' };
    },
    invalidate() { previous = null; }, dispose() { registrations.forEach(off => off()); previous = null; },
  };
}

/** Passive native controls, hosted by the existing adventure frame dialog. */
export function createPartyPanel(host: HTMLElement, bus: Pick<ActionDispatcher, 'dispatch'>) {
  const doc = host.ownerDocument, abort = new AbortController(), element = doc.createElement('section');
  element.className = 'nq-party'; element.setAttribute('role', 'dialog'); element.setAttribute('aria-label', 'Party'); element.hidden = true; element.style.overflowWrap = 'anywhere'; element.style.minWidth = '0';
  const heading = doc.createElement('h2'); heading.textContent = 'Party'; heading.tabIndex = -1;
  const summary = doc.createElement('p'), guidance = doc.createElement('p'), list = doc.createElement('div'), close = doc.createElement('button');
  guidance.textContent = 'Choose up to two active allies. Swaps are free in safe preparation. Demonstrations teach your allies; historical results never prove a current repair. All main paths remain available with conventional tools.';
  close.type = 'button'; close.textContent = 'Close party'; close.setAttribute('aria-keyshortcuts', 'Escape'); element.append(heading, summary, guidance, list, close); host.append(element);
  let current: { capture: ActionCapture; open: boolean } | null = null, returnFocus: HTMLElement | null = null, disposed = false;
  const actions = new WeakMap<HTMLButtonElement, { control: SemanticControl; capture: ActionCapture }>();
  let buttons = new Map<string, HTMLButtonElement>(), signature = '';
  const active = () => !disposed && current?.open && element.isConnected && !element.closest('[hidden], [inert]');
  element.addEventListener('click', event => {
    if (!active()) return; const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (target === close) bus.dispatch(current!.capture({ kind: 'close-panel' }));
    else if (target instanceof HTMLButtonElement) { const row = actions.get(target); if (row && buttons.get(row.control.id) === target && row.capture === current!.capture && !row.control.unavailableReason) bus.dispatch(row.capture(row.control.action)); }
  }, { signal: abort.signal });
  element.addEventListener('keydown', event => { if (!active() || event.key !== 'Escape' || event.repeat || event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault(); event.stopPropagation(); bus.dispatch(current!.capture({ kind: 'close-panel' })); }, { signal: abort.signal });
  return { element, render(view: PartyView, open: boolean, capture: ActionCapture) {
    if (disposed) throw new Error('Party panel is disposed.');
    const wasOpen = !element.hidden, focus = doc.activeElement, selected = focus instanceof HTMLButtonElement ? actions.get(focus)?.control.id : undefined;
    const capturedChanged = current?.capture !== capture; current = { capture, open };
    summary.textContent = `Active allies: ${view.activeNames.join(' and ') || 'none'} (${view.activeNames.length}/2).`;
    const nextSignature = JSON.stringify(view.rows);
    if (signature !== nextSignature || capturedChanged) {
      const nodes: HTMLElement[] = []; buttons = new Map();
      for (const row of view.rows) { const section = doc.createElement('section'), title = doc.createElement('h3'); title.textContent = `${row.name} · ${row.status}`; section.append(title);
        for (const text of [row.invitation, row.lesson, row.explanation].filter(Boolean)) { const p = doc.createElement('p'); p.textContent = text; section.append(p); }
        const controls = doc.createElement('div'); controls.style.display = 'flex'; controls.style.flexWrap = 'wrap'; controls.style.gap = '.5rem';
        for (const control of row.controls) { const button = doc.createElement('button'); button.type = 'button'; button.textContent = control.label; button.disabled = !!control.unavailableReason;
          button.style.whiteSpace = 'normal'; button.style.maxWidth = '100%'; if (control.unavailableReason) button.title = control.unavailableReason;
          actions.set(button, { control, capture }); buttons.set(control.id, button); controls.append(button); }
        section.append(controls); nodes.push(section);
      }
      if (!nodes.length) { const p = doc.createElement('p'); p.textContent = 'Look at or talk to potential allies to discover their invitation and lessons.'; nodes.push(p); }
      list.replaceChildren(...nodes); signature = nextSignature;
    }
    element.hidden = !open;
    if (open && !wasOpen) { returnFocus = focus instanceof HTMLElement ? focus : null; queueMicrotask(() => { if (active() && current?.capture === capture) heading.focus(); }); }
    else if (open && selected) buttons.get(selected)?.focus();
    else if (!open && wasOpen && returnFocus?.isConnected) queueMicrotask(() => { if (!current?.open) returnFocus?.focus(); });
  }, dispose() { disposed = true; abort.abort(); element.remove(); buttons.clear(); } };
}
