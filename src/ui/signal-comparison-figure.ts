// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import './signal-comparison-figure.css';

/** Both power levels are from the supplied channel A example at the receiver.
 * This illustration reads and writes no game state. */
export function appendSignalComparison(doc: Document, container: HTMLElement): void {
  const chart = doc.createElement('div');
  chart.className = 'nq-signal-comparison';
  chart.setAttribute('role', 'group');
  chart.setAttribute('aria-label', 'Worked example of received signal and noise on scenario channel A');
  const scale = doc.createElement('p');
  scale.textContent = 'Worked example · Scale from −100 to −50 dBm';
  chart.append(scale);
  for (const [key, label] of [
    ['signal', 'Signal −65 dBm'],
    ['noise', 'Noise −90 dBm'],
    ['difference', 'Difference 25 dB'],
  ] as const) {
    const row = doc.createElement('div');
    const labelElement = doc.createElement('span');
    labelElement.textContent = label;
    const track = doc.createElement('span');
    track.className = 'nq-signal-track';
    track.setAttribute('aria-hidden', 'true');
    const mark = doc.createElement('i');
    mark.className = `nq-signal-mark-${key}`;
    track.append(mark);
    row.append(labelElement, track);
    chart.append(row);
  }
  container.append(chart);
}
