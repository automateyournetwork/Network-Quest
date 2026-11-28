// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import fixture from './spec001.json' with { type: 'json' };

// Assemble the two literal T142 inputs and their separately authored answers.
// No production reader, validator or mapping participates in this assembly.
function revisit(base: typeof fixture.input, changes: typeof fixture.revisit.inputOverrides) {
  return {
    ...base,
    safeState: changes.safeState,
    world: { ...base.world, ...changes.world },
    notebook: { ...base.notebook, measurements: [...base.notebook.measurements, changes.appendMeasurement] },
  };
}

export const balcony = {
  prior: fixture.input, expected: fixture.expected, explanation: fixture.expectedPlayerExplanation.balcony,
};
export const arrival = {
  prior: revisit(fixture.input, fixture.revisit.inputOverrides),
  expected: revisit(fixture.expected, fixture.revisit.expectedOverrides),
  explanation: fixture.expectedPlayerExplanation.revisit,
};
export const historicalBytes = (value: unknown) => '\n  ' + JSON.stringify(value, null, 2) + '\r\n';
