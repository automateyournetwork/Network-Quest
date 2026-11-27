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

## Current position — 2026-11-27

**126 loops started; 99/170 tasks accepted; no deployment.** The remote feature
branch reached `d7dc4a1f4458d9ff581eb987b12101e92ad2ff28` for the T106 layout
freeze. The preceding checkpoint `e6362f6b27ef3daa0166468d2e56733fa08c9aa6`
(accepted T105 and isolated T106 preparation) was
pushed/remoteverified:74reviewedpaths/3430847bytes, exactstage/blob/private/authored
whitespacePASS and22rawfindingspreserved. T104 is accepted for local gameplay. Both normal-config native
journeys passed3.1min;32canonical files/255published inputs/4test overlays matched.
Final all-seven packet49owned/254published/120assertion refs matched. Exact140
original inputs stay unchanged:129mapped/6timingN/A/4T105rows/1media-animationpartial.
Historical canonical files are archived exactly; current tests use unique ignored
reports and actual current source/build. See US7.md and companion root review.

All five Astra reviews are root-reviewed/promoted where applicable. Q05 current
476tests/11suites/check/buildPASS; generated policy semantics unchanged. Earlier
broadclient4246distinct accounted andfullPHP909/19167 remain scoped historical
checks, not reruns after every bounded UI/diagnostic delta.

Fresh123/T105 passed three independent copper/fiber/radio native routes on8b66902
plus test overlays: copper100mE01/fiber9dBE01/radio20dBE02, no recruits/active allies,
each8required objectives/8rooms (union12), one-slot exact reload. Original42physical/
52route reconciliation plus four no-recruit T092 rows is accepted:98mappedrows,
704fieldgroups/71references verified,4native/21scoped/73adapted,not98literalpasses.
734focused/30overlappingaffected/check/buildPASS; productionunchanged. Same122
completed the canonical layout freeze:13final files/16original artifacts matched;
root independently confirmed identical numerical/semantic room data, exactrosters
and380single-owner allocations. T106 is accepted; no produced or accepted media is inferred.

The coordinator and loops 124–126 stopped at 17:46 UTC when the previous
workspace exhausted its credits. On the owner's request a new coordinator
resumed all three assignments in the shared checkout. All three replacement
workers were observed running by 20:41 UTC. They retain the original loop IDs.

Loops 124/T107, 125/T108 and 126/T109 produce disjoint real Blender character batches:
CH02/04–09 (7), CH10–17 (8), CH18–25 (8; pairedCH24counts1). Read canonical
assets-src/rooms/scene-layouts.json and production-allocation.json plus the art
contract. Early Titan/copper/fiber and representative designs need root visual
review before scaling. Preserve existingCH01/03, allsource/rights/nativeproof;
global manifest consolidation remainsT132. Private commonbrief:
.local/character-worker-brief.md; broader mediahandoff:.local/media-coordinator-handoff.md.
Keep originalmodel/source/evidencefiles unchanged; production/export isnot quota
acceptance or actualin-gameintegration. Owner previews63366/54594 remain protected.

Coordinator viewed the Titan, Copperhead, Unicorn, Hermit Crab and Echo Bat
representatives and returned specific pose, contour and lighting feedback.
The retained Photon has a [versioned connector-inspection clip](../evidence/spec001/character-production/photon-inspection/review.md).
Native/exported poses match for all 29 meshes at five sampled times. The existing
game binding uses the T063 Photon until the finished-room join.


T096/T097 actual reward pictures, portraits/finishedmedia, providers, humanreviews
and release gates remain open. Continue the original playful, witty, lightly dark
Networking/OSI Sierra adventure within the approved286frame. Never claim scaffold
completion or turn scoped test counts into human/episode acceptance.

## History and evidence preservation

All previous handoff text is preserved byte for byte in
[HANDOFF-through-loop123.md](HANDOFF-through-loop123.md). Its historical statuses
are not current ownership. Read the relevant loop/evidence notes for an active
task; state.json and this current handoff control counters and assignments.
Archive SHA-256: `e204db2c78aae1110eb07dd98b6e1e42b3e64f025974e961deaf3fd08defa822`.

The MG03 original worker receipt overwrite is explicitly documented in
`docs/evidence/spec001/optional/MG03/root-checks/receipt-preservation-incident.md`.
That original report is unrecoverable. Later runs remain separately identified.
The current regression writer is opt-in; never run the historical writer against
its sealed output. T104 similarly archives old canonical test bytes exactly and
uses unique ignored run directories. Do not overwrite sealed evidence by default.

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
- Preserve all independent fixtures and original expected answers. Execution ledgers
  distinguish literal assertions, reviewed adaptations and unresolved evidence.
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
Actual commands are in package.json; implement planned commands before invoking
them. Locked dependencies and the approved media pipelines already exist.

Use owned ephemeral Firefox/TLS/PHP resources with disposable NSS trust and strict
certificate validation. Reserve normal Playwright preview4173 with root. Preserve
owner previews63366/process80711 and54594/process77659, and Safari window7338.
Every new browser spec must be explicitly assigned; retain the unassigned guard.
Keep normal test output in unique ignored `.local/test-results` directories, then
copy only reviewed sanitized evidence into docs. Freeze actual inputs for concurrent
work and disclose later source deltas; do not infer a commit from a private path.

Firefox159/revision1572's earlier R12 nested-accessibility reflection issue remains
for T152; later diagnostic1575 did not change the pinned supported version. Native
Safari, complete accessibility, human pacing and final performance remain separate.
Use scoped meaningful tests, then required joined checks. Do not repeatedly broaden
testing after a pass without a changed input, failure or unresolved concern.

Never stage raw T089 traces under `US6/t089/{02-native-initial,04-affected-rerun,
06-remaining-five,08-full-matrix}` or historical presentation server.ndjson logs.
Root stages exact reviewed paths and verifies blobs/private literals/headers/keys.
Preserve raw evidence whitespace; check authored source separately.

## External capabilities still pending

**Hosting:** loops016/019 supersede historical noshell attempts. Actual agent/key
SSH with pinned verification and web/CLI PHP8.4.28/PDO SQLite3.54.1 passed. Private
permissions, two-process locking/rollback/interruption, consistent snapshot,
outbound provider TLS and actual cron passed. All temporary helpers/data/cron
were removed; cleanup and original crontab/modes independently verified. See
host-probes.md. Dated disk/inode quota cache is recorded; actual longest provider/
manual-copy backup retention and fresh adjusted package limits remain open.
Historical header attempts in hosting-header-admission.md include5 uploaded
helpers removed with SFTPabsence/parent-metadata checks, a challenge page and2SSH
timeouts. The 2026-11-26 18:13–18:18UTC recheck supersedes that connectivity block:
normal arcade200, strict pinned SSH/SFTP, all7 old probes absent, and14 remaining
HTTP/2 singleton observations completed. Its sixth helper was removed and absence
verified. NativeH1 admission constraints and unverifiedHTTP/3 remain recorded;
the old failures are retained. Backup coverage/retention and package limits remain
the outstanding hosting inputs, not SSH activation.
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

**Media:** T005 accepted after T063/T065 supplied stronger genuine Blender/native
Audacity4 roundtrips and owner-approved Kokoro/ACE/effect auditions on both Mac
speakers and earbuds. Historical smoke files/attempts stay unchanged; no listening
to the older two smoke clips is claimed. No further unchanged audition question is
needed. Full room, library and release reviews remain pending.

## Publication and release

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
