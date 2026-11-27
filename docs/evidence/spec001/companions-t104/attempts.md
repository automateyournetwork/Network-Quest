# Preserved T104 attempts

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

`native-initial` reached actual Echo Bat and Copperhead level 2, then failed when
the harness tried to select a matching optical profile after the connection was
already cleaned. The production controller correctly hides that unavailable
operation. The corrected optical comparison restores the original diagnostic
connection, selects its profile, then inspects, cleans and reinspects it.

That initial harness also read nonexistent nested `<li>` nodes when comparing
measurements. Its empty-array equality checks are **invalid equivalence evidence**,
regardless of the raw PASS messages. The preserved exact initial harness identifies
the mistake. Later comparisons require a nonempty `Current reading:` paragraph
and compare all rendered measured quantities, not an empty node selection.

`native-corrected` passed actual lessons and both-level equivalences for Echo Bat,
Copperhead, Photon, Hermit, Unicorn, Hydra and Thunderbird. It stopped during Eel
practice because the test expected `Delivered excess: 0 W` for a valid allocation.
The actual supplied profile correctly displays `Delivered headroom: 0 W` at its
30 W inclusive boundary. Only the test expectation changed. Its exact harness,
report, output, screenshot and error context are retained.

`native-final` was intentionally interrupted early, after the harness author read
the exact existing inventory close label and caught a case mismatch in a newly
added assertion. It is an interrupted preparation attempt, not a product failure
or complete execution. The sole owned Playwright runner received SIGINT; owner
previews and other workers were untouched. The subsequent `native-complete` run
uses `Close Inventory` and compares the actual inventory list.

No production source, independent numerical oracle or accepted fixture was changed
to accommodate these attempts. Later actual results must be read from their own
reports; this note does not certify a run that has not completed.
