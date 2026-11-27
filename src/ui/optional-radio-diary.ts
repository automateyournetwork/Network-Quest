// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import { radioDiaryEvidence } from '../state/optional-radio-diary';
import type { RadioDiaryActivity, RadioDiarySubmission } from '../state/optional-radio-diary';
import type { GameState } from '../state/types';

export interface RadioDiaryView {
  readonly available: boolean;
  readonly missingEvidence: string;
  readonly records: readonly { readonly id: string; readonly label: string; readonly text: string }[];
  readonly earlierIds: readonly string[];
  readonly laterId: string | null;
  readonly controls: RadioDiaryActivity['answerControls'];
  readonly practice: string;
  readonly depth: { readonly title: string; readonly paragraphs: readonly string[] } | null;
}
/** All displayed numeric/provenance data comes from checked actual records. */
export function projectRadioDiary(registry: ContentRegistry, game: GameState, activity: RadioDiaryActivity, earned: boolean): RadioDiaryView {
  const evidence = radioDiaryEvidence(registry, game);
  return { available: evidence.available, missingEvidence: activity.feedback.missingEvidence,
    records: evidence.records.map((row, index) => ({ id: row.record.id,
      label: `Reading ${index + 1}: ${row.observation.snr.value} dB · ${row.current ? 'current' : 'historical'}`,
      text: `Reading ${index + 1} · Storm Observatory · ${row.record.attemptId === game.world.attemptId ? 'this attempt' : 'an earlier attempt'}. Signal ${row.observation.signal.value} dBm; noise ${row.observation.noise.value} dBm; SNR ${row.observation.snr.value} dB; inclusive minimum ${row.observation.minimum.value} dB. ${row.current ? 'Current observation and configuration' : 'Historical observation; not current proof'}. ${row.record.configurationRevision !== game.world.configurationRevision || row.record.attemptId !== game.world.attemptId ? 'Recorded under an earlier configuration. ' : ''}${row.observation.thresholdMet ? 'Meets the supplied minimum.' : 'Below the supplied minimum.'}`,
    })), earlierIds: evidence.earlier.map(row => row.record.id), laterId: evidence.latest?.record.id ?? null,
    controls: activity.answerControls, practice: activity.practice.explanation,
    depth: earned ? { title: activity.reward.title, paragraphs: activity.reward.paragraphs } : null };
}

/** Kept separate from common bits/power controls; only a closed answer leaves it. */
export function renderRadioDiaryForm(doc: Document, view: RadioDiaryView, previous: ReadonlyMap<string, HTMLElement>,
  controls: Map<string, HTMLElement>, submitLabel: string, signal: AbortSignal, send: (answer: RadioDiarySubmission) => void): HTMLElement {
  const form = doc.createElement('form'); form.className = 'nq-diary-form';
  function select(key: keyof RadioDiarySubmission, labelText: string, options: readonly (readonly [string, string])[]) {
    const row = doc.createElement('div'), label = doc.createElement('label'), select = doc.createElement('select');
    select.id = `nq-diary-${key}`; label.htmlFor = select.id; label.textContent = labelText;
    for (const [value, text] of [['', 'Choose…'], ...options]) { const option = doc.createElement('option'); option.value = value!; option.textContent = text!; select.append(option); }
    select.value = (previous.get(key) as HTMLSelectElement | undefined)?.value ?? '';
    controls.set(key, select); row.append(label, select); form.append(row); return select;
  }
  const earlier = select('earlierMeasurementId', view.controls.earlierLabel, view.records.filter(row => view.earlierIds.includes(row.id)).map(row => [row.id, row.label]));
  const later = select('laterMeasurementId', view.controls.laterLabel, view.records.filter(row => row.id === view.laterId).map(row => [row.id, row.label]));
  const comparison = select('comparison', view.controls.comparisonLabel, [['increased', view.controls.increased], ['unchanged', view.controls.unchanged], ['decreased', view.controls.decreased]]);
  const assessment = select('currentAssessment', view.controls.assessmentLabel, [['meets-threshold', view.controls.meetsThreshold], ['below-threshold', view.controls.belowThreshold]]);
  // Radio labels wrap at enlarged text size, keeping the full inference claims readable.
  const claims = doc.createElement('fieldset'), legend = doc.createElement('legend'); legend.textContent = view.controls.claimLabel; claims.append(legend);
  const values = [['current-reading-only-no-cause', view.controls.currentOnly], ['earlier-proves-current', view.controls.historicalProof], ['weather-proven', view.controls.weatherCause], ['throughput-proven', view.controls.throughputProof]] as const;
  const inputs = values.map(([value, text]) => {
    const label = doc.createElement('label'), input = doc.createElement('input'); input.type = 'radio'; input.name = 'diary-claim'; input.value = value;
    input.checked = (previous.get(value) as HTMLInputElement | undefined)?.checked ?? false;
    controls.set(value, input); label.append(input, doc.createTextNode(text)); claims.append(label); return input;
  });
  form.append(claims);
  const submit = doc.createElement('button'); submit.type = 'submit'; submit.textContent = submitLabel; controls.set('submit', submit); form.append(submit);
  form.addEventListener('submit', event => { event.preventDefault(); send({ earlierMeasurementId: earlier.value || null, laterMeasurementId: later.value || null,
    comparison: (comparison.value || null) as RadioDiarySubmission['comparison'], currentAssessment: (assessment.value || null) as RadioDiarySubmission['currentAssessment'],
    evidenceClaim: (inputs.find(input => input.checked)?.value ?? null) as RadioDiarySubmission['evidenceClaim'] }); }, { signal });
  return form;
}
