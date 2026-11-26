# Network Quest implementation handoff

The owner initiated implementation on 2026-11-25 and authorized continuous work
through Spec001 acceptance, reviewed GitHub publication and accepted arcade
release. Use one task per fresh worker, durable notes and the existing 200-loop
cap. **Do not restart, reset the counter or discard dirty work.**

## Resume procedure

1. Read AGENTS.md, the constitution, SPEC.md/PLAN.md and the implementation skill.
   Prerequisite/checklist setup already passed (requirements16/16, remediation
   complete); repeat only when its inputs change.
2. Read [state.json](state.json), the current feature documents/task schedule and
   relevant recent loop notes. State is authoritative for counters and ownership.
   Use one fresh worker (`fork_turns: none`) per task iteration. Coordinator review
   is not another loop. Independent tasks may overlap only on verified inputs and
   disjoint files; explicit local scheduling exceptions are in tasks.md.
3. Keep genuine failures and partial attempts. Check a task only after verified
   completion. Source preparation and task counts never pass an aggregate gate.
4. Continue independent work while external capabilities remain unresolved. The
   blanket stop from loop014 was superseded by the owner's direction; see
   [execution-direction.md](execution-direction.md). Do not repeat unchanged
   external probes or ask for already-confirmed credentials/registration details.
5. Root owns tracking, staging, review, commits and pushes. Optional automatic Git
   hooks remain disabled. Workers do not change counters, publish or spawn workers.

## Current position — 2026-11-26

**52 loops started; 37 of170 tasks accepted. G0 BLOCKED; G1–G7 not passed.**
Current active ownership is in state.json:

- Loop046/T035 local correction reviewed: real Three.js R01/R02 graybox, shared
  captured actions, recovery and resource disposal. Six new browser cases PASS,
  previous guest9/packet5 PASS; full client943 PASS/68 TODO. Root reviewed code,
  all30 seals and actual lift/workshop/200%-text screenshots. G1-LOCAL-01 is closed
  locally; native hidden-tab evidence remains unverified, no finished media or
  aggregate T035/G1 acceptance. Historical loop043 finding is preserved.
- T038 accepted in loop044:28 focused tests/225 assertions; root reviewed all
  source/tests and20 seals. Actual HTTP/auth route composition remains T041.
- T039 accepted in loop047: Google real-SDK RSA verification and shared one-use
  transactions/bounded transport;57 focused tests/650 assertions PASS. Root read
  all six source/test files and matched27 seals. Synthetic HTTP/keys only;
  actual provider behavior and route composition remain pending. Delete reauth
  confirms a new same-account provider roundtrip, not fresh password entry.
- T042 accepted in loop045:188 focused JS checks and150 PHP tests/1199 assertions
  PASS,362 differential candidates match; root reviewed source and21 seals. Root
  joined full check PASS and pre-T039 PHP253 tests/1856 assertions PASS. Results
  stay provisional for T043; actual HTTP/client saving is not implemented yet.
- T043 accepted in loop048:47 focused tests/284assertions, six-interface-suite
  join243/1861 PASS. Root reviewed source/tests and23 seals. Root all12stablePHP
  suite join357/2790 PASS at migration1; newT040/T041 tests excluded. Exact-byte
  receipts/current-summary/conditional writes verified locally; actual HTTP,
  deletion-ledger barrier and full simultaneous races still join later.
- T040 accepted in loop049:50 GitHub synthetic cases/1628assertions, joined
  providers107/2278 PASS with actual GenericProvider/S256 and fixed empty scopes.
  Root reviewed source/tests and27 seals; current Database default migration2
  was still T041-review-pending, not accepted by that provider result.
- Loop050/T041: auth/session routes, private configuration and final account/session
  commit; joins actual T040 before final verification. No production credentials
  in tests and no external deletion-ledger acceptance before T045.
- Loop051/T045: durable external deletion intents/receipt hashes/account deletion
  and actual AccountAccess barrier; joins T041 purpose-proof forward migration.
- Loop052/T044: save/preferences HTTP handlers on accepted repository/validators,
  joining actual T045 barrier; shared Router/config remain T041-owned.
- Next local sequence: review GitHub and join actual auth/save/recovery services
  on verified interfaces. Do not waive required
  owner/gate reviews or infer real provider acceptance from synthetic tests.

Accepted implementation now includes domain/state/content foundations, accessible
controls and presentation lifecycle adapters; actual guest title, R01/R02
investigation, O01/O02, dialogue skip/replay, inventory, five notebook sections,
fresh/stale readings and the initial packet activity. **Finished media count0.**
The real service entry still returns honest unavailable responses; database
primitives are implemented but provider login and durable saves are not joined.

Recent evidence:

| Work | Accepted result and handoff |
| --- | --- |
| T030 guest acceptance | Loop041: all9 actual guest browser journeys;4 joined state cases;53 focused checks/check PASS. Root matched36 seals. |
| T034 actual packet introduction | Loop040:28 adapter cases,286 dependencies and5 actual browser cases PASS; root inspected desktop/mobile and fixed keyboard-scrollable tables. |
| Joined guest/packet checkpoint | 819 client PASS/68 physical TODO before T030's4 new cases;110 PHP tests/1180 assertions before T037. Browser58/59 initially; actual200%-text textarea overflow fixed, all3 affected cases PASS. Final build PASS. See joined-guest-packet-checkpoint.md. |
| T037 private database | Loop042:17 focused tests/144 assertions;127 total PHP tests/1324 assertions PASS. Root reviewed code/tests and matched13 seals. Short atomic migrations, real overlapping connections and private rollback-journal storage; no auth/save service claim. |
| T038 sessions/security | Loop044:28 tests/225 assertions PASS; root joined with corrected database tests:46/378 PASS. See storage-uuid-parity.md for the uppercase external-UUID CHECK correction and unreleased checksum limitation. |

Older verified work and every failed/blocked attempt remain in `loops/`, task
checkboxes and [the preserved cumulative handoff](HANDOFF-history-through-loop045.md).
Do not reread all historical reports each loop; use the relevant interface notes.

## Interfaces and contracts to preserve

- Canonical authored effects and reducer receipts own progress. UI and renderers
  dispatch immutable intent through the shared captured action bus. Never recapture
  stale views against newer state. Store compareAndSet swaps state only; controller
  subscribers finish before the final application render observer.
- T027 inspection prepares canonical effects, evaluates the resulting actual
  candidate world/version, and commits that exact observation atomically. Never
  relabel a measurement from an older world as current. O01 means valid inspection,
  not successful repair. Packet viewing cannot repair/award progress.
- Invalidate packet/dialogue/notebook and bus captures on new run, restore or
  account changes. Dialogue and packet activities own matching unsafe locks.
  Captured old callbacks must not release a new activity/account's lock.
- Canceled logout changes nothing. Confirmed logout clears memory/title without
  implicit saving. Retry/E03 Continue rewinds preparation/inventory but retains
  clues, notes and hint history, advances attempt generation and stales readings.
- T036/loop031's independent151 service expectations,13 SAVE cases and11 overlap
  schedules remain behavioral-pending where no actual service exists. Preserve
  fixtures and their independent expected answers.
- Save authentication/bounds precede account-scoped receipt lookup. Resolve a
  retained receipt before current semantic policy/stale revisions; recheck both
  authorization and receipt inside the final transaction before returning any
  provisional error. A revision8 acknowledgement may coexist with current slot9.
- T037 APIs: explicit private canonical path/all document roots to Database::open;
  connection() is trusted internal PDO; immediate(callback) owns short transactions;
  migrate() is explicit, never automatic on GET/open. See loop042 for schema and
  service obligations, generated metadata-only acknowledgement_json and limits.
- Deletion receipts are operation-specific256-bit tokens. Read-only status requires
  exact Origin and the narrow receipt; guest session status never proves deletion.
  Unknown/expired remains unconfirmed; a late status cannot clear a later account.
  Recovery ledger/receipt hashes stay outside database rollback sets.

## Toolchain and verification

Use command-scoped PATH `.runtime/node-v26.13.1-darwin-arm64/bin`, PHP
`/opt/homebrew/opt/php@8.4/bin/php` and Composer `.runtime/composer-2.11.3.phar`.
Actual scripts are in package.json. Planned asset/package/deploy commands must be
implemented before use. No dependency installation is needed for current tasks.

Playwright1.65.1/Firefox159 works with disposable NSS trust and
`ignoreHTTPSErrors:false`. Root serializes native browser runs using preview4173;
ask root to reserve it. CUA failed with `CUA_REPL_ENABLED_SURFACES is required`;
do not retry that unavailable surface. Preserve installed browser versions.
Recursive Firefox role/name queries for nested notebook regions/lists crashed;
asserted native label.control and section aria-labelledby associations retain the
same semantic expectations. Do not filter pageerrors or weaken requirements.

`dev-content-boundary.md` records actual authoredJSON and same-origin development
WebSocket fixes,12 transport groups PASS and strict private-path/Host/Origin/token
denials. Production preview remains dist-only. Whole-episode performance, actual
Safari and manual assistive/beginner review remain later evidence.

Coordinate full PHP/JS suites while another worker's new tests are intentionally
RED. Run meaningful scoped tests first; root joins final checks when sources are
stable. Do not repeatedly broaden testing after a pass without a new concern.

## External capabilities still pending

**Hosting:** loops016/019 supersede historical noshell attempts. Actual agent/key
SSH with pinned verification and web/CLI PHP8.4.28/PDO SQLite3.54.1 passed. Private
permissions, two-process locking/rollback/interruption, consistent snapshot,
outbound provider TLS and actual cron passed. All temporary helpers/data/cron
were removed; cleanup and original crontab/modes independently verified. See
host-probes.md. Dated disk/inode quota cache is recorded; actual longest provider/
manual-copy backup retention and fresh adjusted package limits remain open.
The existing pending owner question asks only the Backups plan/oldest displayed
date under GoDaddy My Products → Web Hosting → Manage → Backups. No credentials,
SSH activation, restoration or purchase is needed. Do not resend that question.

**Providers:** dedicated production Google/GitHub registrations, exact callbacks
and private pair readiness are confirmed. Callback paths are the game api/v1
`auth/google/callback` and `auth/github/callback` under the production target below.
No real login/token exchange has passed. Existing pending question covers only
Google Web/External/basic-identity Data Access and GitHub wildcard/device-flow/
token-expiry controls. Separate development/test registrations are due before real
provider testing, not this credential-free local implementation. Do not confuse
GitHub CLI authentication with OAuth app administration.

**Media:** T005 genuine Blender5.2.1 and actual Kokoro/ACE-Step/Audacity3.7.9 fallback
technical smoke checks pass, with41 source hashes; no production asset accepted.
The existing listening question asks for headphone/ordinary-speaker accept/reject
feedback on `assets-src/feasibility/audio/narrator-web.mp3` and `ace-web.mp3`.
Do not fabricate listening. Production Audacity4 .aup4/native review remains later.

## Publication and release

Latest pushed and independently remote-verified commit:
`11129bdaae56cffa398fd92736518537d14e37a0` (T035 local playable graybox,
T039 Google/shared auth and T043 single-slot writes). All23 staged paths were
explicitly inspected/hash-matched and private scans passed. Root stable PHP
357tests/2790assertions PASS at migration1. Previous service checkpoint:
`4df0c0884afb9f5d44791ad965573004d7e1a3cd`; guest/packet checkpoint:
`a252a092b442465c2e94562bb6ec5a454c7a7e6b`. Current route/recovery/migration2
work remains uncommitted until reviewed. **No release deployed.**

Owner authorization covers scoped reviewed pushes to automateyournetwork/Network-Quest
and finished accepted release deployment at
https://automateyournetwork.com/arcade/play/network-quest/ with its arcade listing.
Git push and host activation are separate operations. Never call a scaffold or
text-only increment the completed episode. Preserve required owner reviews.

Read ignored `.local/operator-records/README.md` for existing private website and
operator resource pointers. Production OAuth is external private data: parse it,
never source/print it or load it into local tests/browser bundles. Use existing
SSH agent/key and strict pinned host verification. Inspect historical release
scripts before adapting; never execute an old manifest. Future deployment needs
scoped checksums, affected-file/consistent-DB backups, private game DB/secrets,
staging/migrations, tested rollback and actual live providers/save/isolation/game/
assets/navigation checks. Preserve other games, analytics, ownership, certificates
and unrelated Apache/content. Remove probes and record private rollback location.
No external messages or later episodes are authorized by this work.
