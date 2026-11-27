# Review of the Retry assistance boundary

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Root inspected the original T092 `OPT-*-RETRY` inputs and expectations on
2026-11-27. They specify a prior incorrect answer, initial method-help history
`[1]`, and retention of that history after Retry. The accepted runtime also
records level-three assistance when incorrect full-answer feedback exposes a
solution. Executing that actual extra transition therefore produces `[1, 3]`
before Retry. Deleting the solution entry to imitate the older abstract fixture
would lose real learning history and is not acceptable.

For the actual wrong-answer journey, assert the independent original obligations
and explicitly record this adaptation: method help is retained, the displayed
solution is honestly recorded before Retry, and the **entire** assistance array
immediately before Retry equals the array afterward. Retry must neither erase
nor invent help. Also assert the actual incorrect result occurred before Retry.

Preserve the immutable fixture and its original expectation. Label this as a
reviewed semantic adaptation, not a literal equality pass for `[1]` and not an
excuse to omit other case requirements. Prepared boundary tests and native
journeys remain separately identified. No physical expected answer or product
behavior changes as a result of this review.

Root also reviewed `COMP-PARTY-REPLAY` and `COMP-PARTY-INTERRUPT`. Current abilities
perform canonical operations; they do not grant a new inventory reward. Exercise
the real ability-assisted measurement and separate explicit objective submission,
then map the generic once-only benefit to that objective's membership count
(zero to one), retaining unchanged inventory. Verify exact action replay and
new-action replay of the same completion separately. Legitimate new measurements
must remain possible. Disclose this mapping rather than fabricating a reward.

Current ability effects commit synchronously. Verify that captured controls or
commands cannot mutate a replacement adventure after navigation or Restore Save.
The original assumed precommit asynchronous animation is not implemented and
must not be invented for a test. Its presentation-specific proof remains with
T147/final media regression; record that boundary separately from the current
stale-command checks. Animation completion must never become authoritative.
