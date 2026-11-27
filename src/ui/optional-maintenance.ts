// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { MaintenanceAnswer, MaintenanceCard } from '../state/optional-maintenance';
export interface MaintenanceView {
  readonly cards: readonly MaintenanceCard[];
  readonly legend: string;
  readonly missingText: string;
  readonly historicalText: string;
}
export function renderMaintenanceForm(doc: Document, view: MaintenanceView, previous: Map<string, HTMLElement>, controls: Map<string, HTMLElement>,
  submitText: string, signal: AbortSignal, send: (answer: MaintenanceAnswer) => void): HTMLFormElement {
  const form = doc.createElement('form'), group = doc.createElement('fieldset'), legend = doc.createElement('legend');
  form.className = 'nq-maintenance-form';
  legend.textContent = view.legend; group.append(legend); group.style.minWidth = '0';
  const selections: { input: HTMLInputElement; card: MaintenanceCard }[] = [];
  for (const card of view.cards) {
    const row = doc.createElement('div'), label = doc.createElement('label'), input = doc.createElement('input'), detail = doc.createElement('p');
    input.type = 'checkbox'; input.disabled = card.use !== 'supplied-practice-only' && !card.recorded;
    const key = `record-${card.factId}`; input.checked = !input.disabled && (previous.get(key) as HTMLInputElement | undefined)?.checked === true;
    label.append(input, doc.createTextNode(` ${card.label}`));
    detail.textContent = card.use === 'supplied-practice-only' ? `Supplied practice card. ${card.description}`
      : card.recorded ? `${view.historicalText} ${card.description}` : `${view.missingText} Look for: ${card.acquisitionLabel}`;
    controls.set(key, input); selections.push({ input, card }); row.append(label, detail); group.append(row);
  }
  const submit = doc.createElement('button'); submit.type = 'submit'; submit.textContent = submitText; controls.set('submit', submit); form.append(group, submit);
  form.addEventListener('submit', event => { event.preventDefault(); send({ selectedFactIds: selections.filter(row => row.input.checked && !row.input.disabled).map(row => row.card.factId) }); }, { signal });
  return form;
}
