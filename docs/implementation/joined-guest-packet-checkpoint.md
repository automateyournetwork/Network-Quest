# Joined guest and packet checkpoint

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Coordinator review, 2026-11-26. This joins accepted T025–T030 and T033–T034
against the actual application, content and previously accepted domain rules.
It records a source checkpoint; no gate, finished episode or deployment is claimed.

## Executed checks

Commands used pinned Node26.13.1 and, where required,
`NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php`. The native browser tests used
disposable Firefox159 profiles and trusted local HTTPS without a TLS bypass.

| Check | Actual result |
| --- | --- |
| `npm run check` | PASS: strict TypeScript; 12 room identities, 11 authored records, 3 metadata routes. |
| `npm run test:domain` before T030's four new state cases | 819 PASS; 68 unimplemented physical cases remain explicit TODOs. |
| T030 focused fixture/state/tutorial/dialogue/notebook run | 53 PASS, including all four new joined state cases. Root independently matched its 36 input/artifact seals. |
| `npm run test:api` before active T037 database changes | 110 tests / 1,180 assertions PASS. This covers the existing inert API and prepared expectations, not identity/save behavior. |
| `npm run test:e2e` | 58 PASS / 1 FAIL out of 59, including all nine actual guest journeys, five actual packet-introduction journeys and seven isolated packet-control cases. Failure and correction below. |
| Three affected browser cases after the sizing correction | 3 PASS, 11.9 seconds: enlarged-text inventory/notes, narrow notebook, narrow actual title/application. |
| Final `npm run build` after the correction | PASS: 48 modules; 770.38 kB JS / 115.66 kB gzip, 2.70 kB CSS / 1.00 kB gzip. Vite's existing >500 kB chunk advisory remains; performance/media gates are later work. |

The joined run also passed the updated static/TLS foundation assertions; their
previous pending status in `dev-content-boundary.md` is superseded by this result.
The separate transport verification passed all 12 groups as recorded there.

## Observed integration defect and correction

At 390px and 200% text size, the inventory fixture's plain textarea inherited
the actual application font but retained its native column width. Its width
made the document horizontally overflow. Root inspected the failure screenshot
and source; no assertion was relaxed. The shared `.nq-shell textarea` rule now
has `max-width: 100%`. The three affected native layout cases above all passed.
The original failure evidence was preserved locally under the ignored
`.local/joined-inventory-overflow/` directory.

The exact affected-case rerun was:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" \
NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php \
node node_modules/@playwright/test/cli.js test \
  tests/e2e/verbs-inventory.spec.ts tests/e2e/notebook.spec.ts \
  tests/e2e/title.spec.ts --project=firefox-local-https \
  --grep 'typed notes|narrow width|native title choices' --workers=1
```

All 59 cases have passing evidence across the joined run and targeted correction;
there was no subsequent claim of a new all-59 run. Final CSS SHA-256:
`dba13d088664f6fadb24cd19500dae85f6856c1c6b073d0d9be8b8b509155e39`.
Earlier loop hashes retain their historical meaning. This stylesheet follow-up
does not alter T030's 36 sealed files, which all matched during root acceptance.

## Remaining scope

The actual unsigned-in introduction supports R01/R02 investigation, four verbs,
dialogue, one inspection kit, five notebook sections, O01/O02, title/new-run
safeguards and the R01 packet activity. Current observations and stale readings
remain distinct. Packet viewing cannot repair the path or award progress.

T035 still owns the diagnostic review and G1 decision. G0's named external
evidence remains open. T037's independent private database implementation is
excluded from this client checkpoint. Real provider login, durable saves, later
rooms/routes/outcomes, finished art/audio, human reviews, release packaging and
live acceptance remain unfinished. No production credentials were loaded into
the application or test environment, and no server files were deployed.
