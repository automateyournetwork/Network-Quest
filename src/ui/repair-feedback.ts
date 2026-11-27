// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
const messages: Record<string, string> = {
  'repair-choice-recorded': 'Your proposal or supporting record is recorded. It has not executed an intervention or taken a measurement.',
  'current-physical-checks-pass': 'The current physical checks pass within this fictional exercise. The separate endpoint test still determines service evidence.',
  'intervention-executed': 'The reviewed intervention was executed. Earlier readings are now stale. At the balcony, take fresh link measurements and run the separate endpoint test.',
  'restoration-validated': 'Fresh physical and endpoint evidence support the recorded restoration classification.',
  'unresolved-isolation-recorded': 'The defect remains deliberately isolated. Service is unresolved, and this shutdown cannot replace your recoverable save.',
  'repair-already-complete': 'This intervention or validation has already been recorded.',
  'final-proof-missing': 'Record a fresh link measurement and the separate endpoint test before classifying restored service.',
  'physical-validation-missing': 'Take a fresh physical link measurement at the balcony before classifying restored service.',
  'endpoint-validation-missing': 'Run the separate endpoint test at the balcony to check service before classifying restoration.',
  'stale-evidence': 'That record is stale. Keep it for comparison and repeat the current check.',
  'measurement-provenance-mismatch': 'That record does not match the current selected deployment. Repeat the current check.',
  'prerequisite-unmet': 'Complete the selected branch, equipment check and Clockworks preparation before reviewing this intervention.',
  'plan-record-missing': 'Read and keep the plan requirements before execution.',
  'warning-not-acknowledged': 'Read the warning and explicitly acknowledge it before executing the reviewed intervention.',
  'temporary-dependency-absent': 'The current installation has no temporary dependency to support that claim. Review which path you put into service.',
  'unresolved-defect-not-identified': 'The current record does not identify an unresolved defect. Inspect the fault before recording deliberate isolation.',
  'temporary-followup-missing': 'Temporary restoration needs a real temporary dependency and a recorded limitation and follow-up.',
  'temporary-is-not-permanent': 'A temporary dependency remains. Passing service checks cannot make it a permanent repair.',
  'defect-not-removed': 'The defect has not been removed. A passing alternate path alone cannot establish permanent repair.',
  'isolation-record-missing': 'Record the named unresolved defect and recovery plan before deliberately isolating it.',
  'shutdown-not-deliberate': 'An outage is not a deliberate shutdown. Use a reviewed isolation plan with its named fault and recovery record.',
  'service-deliberately-isolated': 'The path is deliberately isolated. Record unresolved service instead of claiming restoration.',
  'classification-context-missing': 'Read the classification criteria before recording the result.',
  'endpoint-service-unresolved': 'The separate endpoint service test failed. A healthy link or matching pattern cannot replace that evidence.',
  'endpoint-service-acknowledged': 'The supplied endpoint service test acknowledged the request. This is separate cross-layer evidence, not a result inferred from link-up.',
};
export function repairFeedback(reason: string, status: string) {
  return messages[reason] ?? (status === 'content-error' ? 'This exercise has a content error. No progress or penalty was applied.'
    : status === 'invalid-input' ? 'Select the plan and installation type, then use the current repair controls.'
      : status === 'incorrect' ? 'The current checks do not support this claim. Inspect the recorded observations and return to preparation if needed.' : 'Current observations recorded. No service success is inferred from arrival.');
}
