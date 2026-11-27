# Staged preservation check failure

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

At 2026-11-27 09:09 UTC, the first staged-schema run reported 35 passing
checks and one failing preservation check. The test removed every definition
starting with `optional`, unintentionally removing the pre-existing
`optionalEntry` metadata schema while reconstructing the baseline. The diff
showed that entire definition absent. The implementation had retained it.

The test now removes only definition keys absent from the original schema.
The strict compiler also identified index-signature property access in this
test; it now uses the declared bracket form. This correction preserves the
original baseline instead of weakening the intended schema equality assertion.
