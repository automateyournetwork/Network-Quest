# SQ01 consumer contract: implemented join

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

This is the current join record. The earlier `../consumer-contract.md` remains a
sealed historical proposal and is not edited to imply these APIs existed then.

SQ01 is now registered and loaded with the exact full candidate. The shared
`optionalActivityDefinition(registry, id)` validates the registered source and
closed toy variant. `optionalEffectBindings(definition)` binds the journal fact
and quest completion to the same once-only quest receipt. Shared semantic checks
bind the exact source cases, positioned samples, profile, entry and reward.

The UI registers `start-optional`, `choose-optional-mode`, `submit-optional`,
`hint-optional`, `explain-optional`, `retry-optional` and `exit-optional`. Inputs
must come from the current controller projection's `capture`, then the standard
bus. The bus owns action context; the controller also binds game/session/auth
object identity so equal-world mode changes cannot revive old controls. The
reducer's `optional-activity` operation owns the entire atomic transition.

`evaluateOptionalAnswer` calls the existing toy decoder, selects mode-specific
feedback, and selects the exact canonical reward batch only for a correct full
delivery with no existing receipt. Practice correct/incorrect records level-two
assistance; a wrong full answer records solution exposure at level three. Empty
input records no reward. The reducer installs session, feedback, assistance and
completion together; a failed CAS installs none of them.

The transient session captures the actual entry and preparation. Exit drops only
that owned session, retaining current world and measurements. Retry uses
`rewindOptionalPreparation`, advances attempt/revision, preserves notebook/hints,
and makes measurements stale. Successful delivery updates the same-session
preparation baseline so a later retry cannot remove or duplicate its reward.
Encounter rollback still has its separate preparation contract.

`projectOptionalActivity` reveals the optional illustration text only when both
the SQ01 quest receipt and journal fact exist. A learning fact retained through
rollback is not enough. The exact planned asset remains
`spec001:ASSET-ILLUSTRATION-08`. The current projection presents its text description
and unavailable-art message; it does not fabricate an image URL or image review.

The actual current JS save policy accepts SQ01 progress and assistance after safe
exit. This follow-up checks `captureSafeSnapshot` and `restoreIntroduction` with
that policy. It does not test HTTP saving or claim production persistence. Shared
T100 JS/PHP policy evidence and browser evidence remain separately attributed.
