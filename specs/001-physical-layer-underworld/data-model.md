# Data Model: Spec001

**Authority:** [spec.md](spec.md), especially FR-003/010–016/025, SAVE01–13 and the two accepted clarifications. Field names below are the proposed implementation contract; no database or game state has been created.

## Identity and references

Use qualified content IDs such as `spec001:R01`, `spec001:CH03`, `spec001:O05`, `spec001:PR001`. Keep original short IDs in authoring tables and display; resolve them at build time. IDs are immutable within a released version. Renames/removals need explicit migration maps, never positional array indexing. Runtime instances have their own IDs and reference a semantic content identity; repeated instances never inflate asset counts.

| Entity | Fields and relationships | Invariants |
| --- | --- | --- |
| Episode | id, contentVersion, rooms, initialState, safeLocations, futureDoors | Spec001 alone is completable; future doors cannot gate current objectives |
| Room | id R01–R12, presentationMode, description, exits, walk regions, hotspot/character/prop references, safe positions, ambience | All important art/sound state has semantic text; every exit resolves |
| Objective / quest | id, prerequisites, evidence, alternatives, rule references, effects, hint ladder, completion explanation | O01/O02 then one media branch plus O09/O10 before O11/O12; optional SQ/MG never required |
| Character / recruit | CH id, dialogue, compendium role/limits, recruitment, progression, ability and conventional equivalent | 25 entries; nine recruits; at most two active allies; ability effects use ordinary domain state |
| Prop / item | PR or item id, semantic identity, instances, verbs, evidence, combination rules, consumption/recovery policy, asset id | 150 distinct modeled props; ≥50 interactive/evidence; unique essential items recoverable |
| Dialogue | node id, speaker, text, choices, conditions/effects, voice/caption references | Skip/replay cannot duplicate effects or conceal required evidence |
| Rule / profile | id, domain, typed units/parameters, assumptions, source/section, reviewed cases, accepted alternatives | Fixture results authored independently; invalid content is not learner failure |
| Observation | id, source room/subject/rule, content revision, known fact or measurement | Visible distinction among clues, measurements, hypotheses and player notes |
| Asset | stable semantic id, sources, exports, lineage, rights, usage, verification | Manifest schema plus cross-reference/quality checks; only accepted integrated identities count |

## Authoritative runtime state

`GameState` separates the durable candidate from transient UI and authentication:

- `world`: current room/safe position, world flags, completed objectives/quests, inventory, recruited/active allies and progression, compendium discoveries, dialogue effects already applied, selected route, current attempt ID and monotonically advancing configuration revision.
- `notebook`: discovered fact IDs, structured measurements with source and freshness, hypotheses, discovered map rooms and personal notes (4,096 Unicode characters total).
- `assistance`: per-objective hint IDs used, monotonically increasing level/usage history. Replaying a hint never makes a run appear unassisted.
- `outcomeHistory`: E01/E02/E03 events with stable event ID, attempt, route and caveat references. An E03 record can later enter a safe snapshot after Continue, but the shutdown world itself cannot be saved.
- `checkpoint`: in-memory copy of reversible preparation world for an encounter; never a second durable slot.
- `ui`: panels, focused object, selected verb/item, presentation settings and transient feedback. No progress is granted solely by changing UI.
- `persistence`: dirty generation, last acknowledged generation, known slot revision, exact pending request bytes/key/precondition, replacement authorization and state (unsaved/saving/saved/conflict/failed).
- `auth`: guest/authenticating/authenticated/logout-pending, provider label, CSRF and client generation. No provider token is exposed to the browser.

Every domain command has an action ID. The reducer validates its preconditions and applies an accepted effect exactly once. Item consumption, objective awards and dialogue effects have stable completion identifiers; no duplicate-action reward path. Presentation updates may lag, but never independently advance the world.

## Retry, E03 Continue and Restore Save

| Transition | Reversible world | Learning journal | Persistent save |
| --- | --- | --- | --- |
| Capture safe encounter preparation | Copy world/inventory/party/effect flags in memory | Keep current notebook and hint history | No implicit write; an eligible opt-in save is separate |
| Failure → Retry or E03 → Continue | Restore preparation copy, then allocate a fresh attempt ID and advance revision beyond all previous values | Retain newly learned clues, personal notes, hypotheses, map discoveries and hint-use history; keep measurements visibly stale | Unchanged until a later safe manual/opt-in save |
| Restore Save | Replace with validated/migrated stored world | Replace with the journal in that same stored snapshot | GET does not rewrite it; discard unsaved state only after warning |
| Confirmed logout | Clear world, checkpoint and UI; title screen | Clear notebook/assistance memory | Preserve slot; no implicit save |
| Canceled logout | Unchanged | Unchanged | Unchanged |

Completed objectives, consumed items, party loadout and rewards from the failed attempt rewind with world preparation. Retained facts can remain readable without satisfying an objective whose required current validation was undone. Outcome/attempt history remains explanatory, not an inventory reward. A measurement is usable only if its referenced configuration and attempt match current state and it is not explicitly stale. Advance freshness generation on rollback; restoring an old numeric revision must never revive stale evidence.

A safe persisted snapshot has no open dialogue transaction, pending effect, room transition, failure, E03 shutdown or active encounter. E01/E02 may persist only with an authored safe Continue position. Restore reconstructs encounter preparation when next entered; no hidden persisted checkpoint is needed.

## Save v1 envelope and validation

[save.schema.json](contracts/save.schema.json), with a [minimal design example](contracts/examples/save-v1.json), defines the client payload: schema/content/episode versions, adventureId, safeState, world, notebook, assistance and outcomeHistory. The example safe-position ID is proposed and must be authored in the future content registry; structural validity is not a gameplay acceptance claim. API responses add server revision/time/summary. Account ownership and server metadata are not writable payload fields.

Raw UTF-8 body limit is 262,144 bytes. Notes are limited to 4,096 Unicode characters as well as the body limit; validate UTF-8 on both runtimes. All collections have bounds. Schema limits are operational ceilings, not permission to silently discard observations. Near-limit feedback must explain inability to save and preserve the last acknowledged slot; content authoring must prove a normal full episode stays within bounds.

Structural validation is necessary but insufficient: IDs must exist in the selected content registry, counts/quantities and party subset must be legal, flags must belong to the registry, measured units must match the rule, complete objectives must be consistent, safe positions must be allowlisted, and current measurements must match configuration/attempt. Save progress is not a verified professional certification.

## Private relational model

All tables are dedicated to the game. Use UTC server timestamps, prepared SQL, foreign keys, bounded values and indexes on lookup/expiry fields.

| Table | Key fields | Constraints and lifecycle |
| --- | --- | --- |
| accounts | id UUID, created_at, status | Opaque internal ID; active/deleting; never selected by request body |
| identities | account_id, provider, subject, optional display_name | UNIQUE(provider, subject), case-sensitive canonical subject; one independent provider identity per account in v1; no email/token |
| sessions | id_hash, account_id nullable, csrf_hash, created_at, last_activity, expires_at, auth_time, generation | Opaque random cookie; guest bootstrap allowed; enforce idle/absolute expiry independently of cleanup; rotate on auth |
| auth_transactions | state_hash, session_hash, provider, purpose, expected_account_id nullable, nonce_hash, private PKCE verifier, expires_at, consumed_at | One use, ten-minute limit; login vs delete-reauth purpose; invalidate on logout; bounded parallel attempts |
| preferences | account_id PK, revision, autosave_enabled, audio levels, captions, reduced_motion, text_scale | Autosave false initially; own conditional revision; never another adventure slot |
| saves | account_id PK, revision, saved_at, schema_version, content_version, adventure_id, payload_json, payload_hash, summary_json | Exactly one row/account; monotonically increasing revision; validate new operations after receipt lookup, atomic conditional update |
| write_receipts | account_id + request_id PK, fingerprint, committed_revision, committed_at, acknowledgement_json, expires_at | Seven-day successful acknowledgements; no second payload; account-scoped retry across reauthentication |
| schema_migrations | version PK, applied_at, checksum | DB migration sequence distinct from snapshot/content versions |
| operational counters | opaque bucket key, period, count, expires_at | Bounded auth/save rate controls; no personal-note or token logging |

Provider subject is Google's verified sub or GitHub's stable numeric id encoded as a decimal string. A changed display name never changes identity.

The deletion ledger is a separate durable private recovery artifact outside the game database backup/rollback set: opaque account UUID, intent time and pending/completed state. Write intent durably before deleting live rows; mark completed only after their removal and session revocation commit. Live deletion and recovery both honor this ledger; retention covers every real backup window.

Alongside that ledger, keep short-lived `deletion_receipts` containing a SHA-256 hash of an operation-specific 256-bit random receipt, its account UUID/ledger reference, accepted time and expiry. Never store the raw receipt or provider identity. Retain receipts for 24 hours, independently of the longer deletion-marker retention. Receipt status derives from the durable ledger; it cannot mark deletion completed on its own. The receipt authorizes only `POST /account/deletion-status`, which returns pending/completed plus expiry without account or progress data. It survives session revocation and is not an account credential or another save slot. See delivery.md.

## Save transaction

1. Authenticate and check CSRF/origin, the fixed raw-byte bound, key/header syntax and conditional-header presence; compute the fingerprint of method/path/save mode/replacement-confirmation header/precondition/exact body bytes. These guards apply to replays too. Do not yet reject on current schema/content, safe state, autosave policy or slot revision.
2. Look up the account/key receipt under current authorization. A matching retained receipt returns its prior acknowledgement even if that content is no longer writable; different bytes under the same key return 409. Neither case writes progress.
3. If no receipt exists, perform bounded schema/content/registry/safe-state validation outside the write transaction, retaining either the validated candidate or its error. Do not return a semantic error yet: a concurrent identical request may have committed a receipt meanwhile.
4. Execute BEGIN IMMEDIATE with bounded busy timeout; recheck account/session validity and the receipt before using the validation result or comparing revision. A matching receipt wins over a cached validation error; a mismatched fingerprint returns 409. Only a still-new operation can return 422 for invalid or unsupported content.
5. For a valid new automatic request, verify current opt-in and an existing slot with the same adventureId; otherwise require manual adoption. Manual replacement of a different adventure requires X-Confirm-Adventure-Replacement:true. Evaluate If-None-Match:* or If-Match; failure is 412 with current summary. Atomically write the single snapshot, advance revision once and insert the receipt.
6. Commit before reporting Saved. Roll back on failure. Keep external calls and expensive validation outside the write lock, while preserving the final authorization/receipt/precondition checks.

A replay may acknowledge revision 8 while current slot is 9. Return both; pause autosave and reconcile current summary instead of presenting the old acknowledgement as the latest slot. Losing a response retains exact request bytes/key in memory; no hidden persistent browser draft. After receipt expiry, stale preconditions still protect newer progress.

Required regression: commit a save, lose its response, deploy a compatible reader whose new-write policy rejects the old content/schema, then retry the exact request. A retained matching receipt must return the original acknowledgement without running a new write; the same old body under a new request ID must still fail current validation. Also cover a receipt appearing between the initial lookup and final transaction. Never return another account's receipt or accept a revoked session.

## Deletion confirmation after a lost response

Before the confirmed DELETE, the client generates a 256-bit random receipt, retains it in memory and sends it as X-Deletion-Receipt. It stays out of URLs, logs, browser persistence and provider messages. Accept it only after same-account fresh authentication and CSRF/origin/confirmation checks. Bind its hash and expiry durably to the deletion intent; a reused receipt for a different account is rejected without a write.

After a lost response, the UI shows deletion unconfirmed and checks the read-only status operation with that receipt. A 204 DELETE response or `completed` status confirms live deletion. `pending` means recovery is still finishing. Unknown/expired receipt, missing receipt after tab closure, network failure and guest GET session status cannot confirm deletion. Checking status never triggers another DELETE or automatically signs in/creates an account. Retry a destructive request only with valid fresh same-account authorization and the original explicit choice; otherwise obtain a new explicit choice. Status responses update only their matching operation view and cannot clear a later account/session.

## Version evolution and recovery

Release manifest declares readable/writable save schemas and content compatibility. Supported older snapshots follow pure, independently tested migrations with explicit renamed-ID maps, removed-position safe relocations and explanations. Preserve inventory, notebook, recruits, achievements, hints and ending history. GET never mutates storage; migration is durably written only through an eligible conditional save.

Unsupported newer versions remain stored untouched and produce an update-needed state; disable replacement/autosave until a compatible client or explicit separately specified reset is available. No implicit reset is introduced. A future-door test uses a migration fixture, not implementation of the next realm.

Database migrations are coordinated with client/API/content release versions and backups. Recovery restores an isolated copy, replays deletion ledger, validates identities/revisions/schema before reopening. Deployment rollback preserves acknowledged saves and never silently restores an older progress file.
