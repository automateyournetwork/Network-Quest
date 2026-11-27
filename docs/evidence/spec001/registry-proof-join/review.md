# Conditional diagnostic controls and structural route proof

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Coordinator and loop097 prerequisite correction during T079/T081, 2026-11-26.
Fiber's real inspect/change/reinspect guards exposed a state-space problem: the
structural proof retained every flag read anywhere, including closed diagnostic
controls that cannot affect objective availability, inventory, walks or recovery.
The six connection states and their setter histories exhausted the unchanged
4096-state bound, even in unrelated route proofs. The original fiber failure is
preserved in its own task evidence.

The correction identifies only single-node terminal action collections without
character-owned dialogue sequencing. It starts with flag reads outside those
collections, then repeatedly retains conditions that enable a structural effect
or a write to an already relevant flag. This backward dependency closure preserves
indirect prerequisites. Only closed diagnostic flag dimensions and fact receipts
leave memoization. Execution, concrete item quantities, one-time effects, dialogue
position, recovery operations and exhaustive loss-state checking are unchanged.
The search neither raises its bound nor stops when it first discovers O12.

Root authored five independent regressions before the implementation correction:
closed conditional controls, a two-level flag prerequisite, overwritten history,
a flag guarding an unrecoverable consumption, and real dialogue continuation.
All five initially failed from graph bounds (60 unrelated cases excluded by the
focused command). With the correction, all five pass; the full registry suite
passes 65. Existing contradictory-history, item-recovery and real bound negatives
remain intact. The original RED output is retained verbatim.

A deliberately corrupt fiber choice introducing a conditional direct objective
award becomes structurally relevant and is conservatively rejected as unproved.
The worker corrected its negative test to expect that rejection, retaining a
separate unconditional award corruption that reaches and fails the closed adapter.
No actual fiber chronology guard, action choice, physical oracle or score changed.

Final coordinator content join: **145 PASS across seven suites, 5.63 seconds**
(registry, introduction, copper, equipment, fiber, radio and repair rooms). Full
project TypeScript passes after explicit test-result narrowing corrections;
those corrections change no behavioral expectation. The T081 actual-world graph
still awaits its ordered integration and is not counted in this 145-check result.

This accepts the narrow structural proof correction, not a full route, media or
release gate. It enables the reviewed fiber/radio authoring and ensuing world join.
