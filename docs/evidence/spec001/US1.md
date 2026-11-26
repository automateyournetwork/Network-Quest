# US1 guest investigation — T030 evidence

Date: 2026-11-26. Worker: `/root/loop041_t030`, loop 41/200.
**Scoped result: all nine independent guest browser journeys PASS; four joined
state cases PASS.** Coverage: FR-001/003, NQ-01/04, AC01/04, with the GI09
keyboard subset of AC14. T035 owns the subsequent G1/US1 review; this record
does not pass an aggregate gate or certify a finished episode.

## Executed environment and entry

Used the verified Mac environment in [runtime.md](runtime.md): Darwin arm64,
macOS 26.6.2, Mac16,7. Commands used Node 26.13.1 from
`.runtime/node-v26.13.1-darwin-arm64/bin` and local PHP 8.4.28 at
`/opt/homebrew/opt/php@8.4/bin/php`. Playwright 1.65.1 used its installed Firefox
revision 1572; invoking that actual binary with `--version` returned
`Mozilla Firefox 159.0`. No runtime/browser installation was performed.

Every browser case created a fresh unsigned-in persistent profile, loaded the
real `src/main.ts` application through `localTls()` at the production-shaped
`/arcade/play/network-quest/` path and chose **New Adventure**. Local trust was
disposable NSS trust, with `ignoreHTTPSErrors: false`; no system trust or
production credentials were used. The viewport was 1280×900. This uses the real
authored registry and controller composition after T029 and T034 joined. It
does not mount a fixture scene, replace the main module, install a prepared save,
intercept the network to fake state, or call a game test hook. Its read-only DOM
inspection resolves native section/heading associations for the query workaround
described below.

All application `pageerror` events remained fatal. Every case checked for
external HTTP(S) requests and API writes; none occurred. GI08 additionally
checked the absence of a provider window, save write and durable-save claim.
Contexts and local TLS helpers closed through the tests' cleanup path.

## Independent browser results

The T022 fixture remains byte-for-byte unchanged. All nine prepared cases are
active; the environment-variable pending guard and `fixme` were removed.
No behavior, expected answer or case was deleted or weakened.

| Case | Observed result | Status |
| --- | --- | --- |
| GI01 | New Adventure opens The Arrival Lift as a guest; four verbs and I/N/C controls expose their shortcuts; no identity/key prompt, save write or provider request. | PASS |
| GI02 | Power is lit and link is unlit, separately recorded with R01 provenance and explicit scope caveats. Power alone and the two observations without inspection do not complete O01. An actual current inspection completes O01. | PASS |
| GI03 | R02 identifies two distinct known-good endpoint names and an ordered, nonempty physical path joining them. O02 remains incomplete until nonempty player writing is pinned separately from evidence. | PASS |
| GI04 | All five notebook sections remain available. Observations, pinned speculation and literal `<b>my note</b>` text survive R02→R01→R02; source rooms and the two completed objectives remain singular. | PASS |
| GI05 | Skipping Photon and Titan retains both source-tagged clue entries, their required power/scope meanings, and the ability to complete O01/O02. | PASS |
| GI06 | A real, nonempty introductory inventory with positive quantities is retained. Replaying both topics, with normal traversal and skips, preserves inventory quantities, clues and completed objectives without duplicates. | PASS |
| GI07 | A supported physical-path change preserves the prior observed result as stale, with no current entry. Reinspection adds a distinct current R01 reading while retaining the old stale result. | PASS |
| GI08 | Declining the sign-in invitation leaves guest play usable. Notes survive return travel, the label states session-only progress, and no save/provider/API-write behavior or saved claim occurs. | PASS |
| GI09 | W/L/T/U and focused Enter actions complete the same investigation. N opens the notebook; sequential `wl tuin c` typing remains literal text with focus retained, rather than firing shortcuts. | PASS |

The declared authored endpoints are Lift Sender A and Workshop Receiver B;
the path places selected training conduit and workshop patch lead between them.
The browser assertions preserve T022's independently prepared roles/order rules
instead of using application output to generate expected answers. The observed
power/link values still match reviewed `C-PWR-OBS` and `B-PWR-ONLY`; the endpoint,
path and hypothesis requirements still match `C-SCOPE`.

## Joined state results

`tests/state/introduction.test.ts` loads the actual public content, creates an
empty New Adventure and joins the real navigation, reducer/tutorial, bus,
dialogue, inventory, verbs and notebook controllers. No case preinstalls an
objective, clue, inventory item or measurement.

- Two order cases obtain the inspection kit through satchel first or Photon
  first, then use the other route. Both retain exactly one kit, complete actual
  O01/O02, replay both topics, travel repeatedly, and preserve notes, speculation,
  clue identities, objective receipts and inventory quantities. Immediate replay
  also leaves the dirty generation unchanged.
- A real 105 m inspection, shortening to 95 m, and return to 105 m retain three
  distinct measurements. Only the latest is current. A captured inspection from
  before the change is rejected without changing state. Values remain scoped to
  the authored fictional length profile; O01 completion never relabels an
  over-limit result as a successful repair.
- Inspection, travel and notebook opening cannot bypass an active clue
  conversation. Skipping resumes the actual investigation. Blank speculation
  cannot complete O02; nonempty player writing does, and stays separate from
  observed evidence.

All four cases pass. The focused run also reran the independent fixture integrity,
tutorial, dialogue and notebook suites: **53 PASS, 0 skipped** across five files.

## Commands and failure history

Final browser command:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" \
NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php \
node node_modules/@playwright/test/cli.js test tests/e2e/guest-introduction.spec.ts \
  --project=firefox-local-https --output=test-results/t030-final
```

Result: **9 PASS, 0 skipped**, 38.5 seconds. The configured static preview ran
alongside the separately trusted source application, as in prior local HTTPS
checks. This is not a packaged production-build browser acceptance test.

Focused state/fixture command:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" \
node node_modules/vitest/vitest.mjs run tests/content/guest-investigation.test.ts \
  tests/state/introduction.test.ts tests/state/tutorial.test.ts \
  tests/ui/dialogue.test.ts tests/ui/notebook.test.ts
```

Result: **53 PASS**, 3.63 seconds. `npm run check` passed strict TypeScript and
content validation: 12 room identities, 11 authored records and the three
independent metadata routes. Those counts do not imply playable later rooms.

Earlier executions remain part of the record:

| Attempt | Actual outcome and correction |
| --- | --- |
| First active browser run | 3 PASS / 6 FAIL. GI03–06/GI08–09 crashed the Firefox page at recursive endpoint-list `allTextContents()` lookup. No downstream completion result was inferred. |
| Native list locator alone, GI03 | Still failed at the same lookup because the ancestor region name query remained recursive. |
| Native section/heading association plus labeled UL/OL, GI03 | PASS. Section `aria-labelledby` references, H3 names, distinct heading IDs, native list labels, endpoint count, item text and order remain asserted. |
| Subsequent full browser run | 8 PASS / 1 FAIL. GI06 found the actual button is `Close Inventory`, while the prepared vocabulary used `Close inventory`. |
| Reviewed capitalization binding, GI06 | PASS. Only the test binding was mapped to the actual T025 label; fixture and behavior were preserved. Final all-nine run then passed. |
| Initial new state suite | 2 PASS / 2 FAIL due to its helper assuming every topic had two lines. Replaced that assumption with bounded traversal of actual Next/Finish controls; all four passed. |

The page crashes are consistent with the recursive native Firefox lookup issue
diagnosed as SIGSEGV in [T027](../../implementation/loops/036-T027.md); this task
directly observed `Page crashed` and does not independently assert its signal.
No browser error was filtered, no expected-failure marker remains, and no
application source was changed to satisfy these cases. Raw initial traces and
screenshots remain ignored under `test-results/t030-initial`, with subsequent
attempts in `t030-list-binding`, `t030-native-associations`, `t030-all` and
`t030-inventory-binding`.

## Scope and review handoff

The [T030 loop note](../../implementation/loops/041-T030.md) seals the checked
tests and actual content/controller inputs. T022's fixture hash remains
`869b5f631b0019217b4a605744c5d352db14a3e9b57db2b091926cc7992f5eb9` and its integrity
test hash remains `405bc2d881aecbd0a1d35d0450522e9c8f895bb84bd7070de8a5f27fcd9554f9`.

This establishes the automated guest R01/R02 AC01/AC04 increment and native
keyboard behavior on the recorded Firefox environment. T035 must still review
the combined diagnostic and packet slice and record gate status. Actual Safari,
the full browser/accessibility matrix, manual assistive/learning review,
finished art/audio and owner satisfaction remain separate evidence. OAuth and
durable saving remain unimplemented integrations; unavailable provider buttons
are not sign-in acceptance. G0 external blockers, G1–G7 and the full episode are
not passed here. No host/provider change, publication or deployment occurred.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
