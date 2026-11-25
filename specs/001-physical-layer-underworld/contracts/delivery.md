# Delivery, Media and Recovery Contract

This document selects implementation policies for Spec001; no host configuration, installation, media generation, backup or deployment has occurred.

## Media production and acceptance

| Deliverable | Minimum and counting rule |
| --- | --- |
| Rooms | 12 finished, meaningful rooms; R01 real-time 3D, R05 layered/real-time composition, R04 Blender sprites |
| Characters | CH01–CH25, 25 distinct modeled identities; Crosstalk Twins count once; editable .blend, usable export, animation, compendium portrait and actual encounter |
| Props | PR001–PR150, 120 room-specific plus 30 shared; ≥50 interactive/evidence; duplicate instances/recolors cannot increase count |
| Images | 36 usable layers (background plus two additional layers per room), 25 portraits, 24 meaningful inventory/diagnostic illustrations |
| Audio | 8 music cues, 12 ambience beds, 40 effects, 60 selected narrator/Titan/Photon/Hermit voice lines |

[asset-manifest.schema.json](asset-manifest.schema.json) defines structural records. Required semantic checks include unique IDs and semantic identities, resolvable usage, acyclic derivation, hashes matching actual bytes, retrievable sources and accepted rights. Every accepted export needs source, production, placement and appropriate review. Only integrated accepted semantic identities count. Invisible/unused placeholders and derivatives with inflated identities do not qualify.

Model records preserve actual .blend, collections/objects, units/orientation, pivots, collision proxies, rigs/clips, material/texture budgets and GLB validation. Reopen and render sources in Blender; compare actual browser output. Scripts supplement native sources. Sprites preserve frame rectangles/timing, action/direction, pivots and camera/render settings. Image plates preserve camera, anchors, occluders, masks, alpha and safe interaction regions.

Generation records distinguish actual OpenAI calls from manual crops/masks and Blender renders. Preserve original image outputs immediately, prompts/references, supplied settings and returned metadata. Unknown tool/model/seed fields say unknown/not-exposed; do not fabricate them. A derivative preserves its real parent invocation rather than inventing one.

Audio records preserve raw generation/recording/composition, external MIDI/synthesis source when used, native Audacity project (.aup4 for version 4), lossless master, export codec/rate/channels/duration, loop samples/crossfade, loudness/peak measurement, script/caption linkage and actual voice/model identity. Do not claim stems or MIDI when a generator supplied only a mixed track. Browser exports are prerecorded; production dependencies/models are not shipped by default.

G0 validates tools, component/model/output rights, memory/disk and actual local audition feasibility. G3 reviews one finished room before mass production. G5 audits all source/export/use/credit/count records, with actual visual review and headphone/ordinary-speaker listening. Automated structure checks cannot mark a human audition or owner review passed.

Original controlled code uses Apache-2.0; original controlled creative/documentation material uses CC BY 4.0. Third-party materials retain their actual licenses and notices. AI tool/model labels do not establish blanket output ownership. Public versioned archives/LFS may carry large sources if hashes, retrieval instructions, licensing and availability are proven from a clean public checkout. Private-only archives do not satisfy independent reuse.

## Independent release and website boundary

Proposed routes, configurable together at build/deploy:

| Surface | Default |
| --- | --- |
| Arcade detail entry | /arcade/network-quest/ |
| Static game | /arcade/play/network-quest/ |
| API | /arcade/play/network-quest/api/v1 |
| Google callback | /arcade/play/network-quest/api/v1/auth/google/callback |
| GitHub callback | /arcade/play/network-quest/api/v1/auth/github/callback |

No website source import is required to build. Deliver a versioned package with static client, PHP service/vendor dependencies, migration files, API/content/save compatibility manifest, source retrieval index, credits/licenses, SHA-256 checksums and scoped integration instructions. Site integration supplies only the detail entry, artifact placement and route configuration.

Hashed immutable asset URLs may have long cache lifetimes; shell/release manifest must revalidate, and every account/API response is no-store. Do not let service workers or public caches store identity/save responses. CSP and script origins must be reviewed with OAuth popup/tab behavior; allow no remote untrusted script execution. Host-only cookie path reduces routing exposure but does not isolate same-origin website scripts.

The deployable public path contains no .env, private configuration, DB/journal/WAL, sessions, backups, logs, OAuth secrets, player data or private website materials. Keep PHP secrets and writable data outside docroot; deny accidental HTTP exposure and test the denial. Game schema, paths and jobs are isolated from analytics and unrelated arcade entries.

## Operational defaults to validate at G0

These are engineering choices made during planning, not user clarification answers or measured service promises.

| Control | Initial policy |
| --- | --- |
| Session expiry | 2-hour idle, 24-hour absolute; rotate on auth; every mutation rechecks authorization inside its transaction |
| OAuth transaction | One use, ten minutes, bounded parallel attempts; state/nonce/PKCE private and unlogged |
| Deletion reauthentication | Same existing account and delete purpose, completed within five minutes |
| Save body / notes | 262,144 UTF-8 bytes; 4,096 Unicode characters for personal notes |
| Write receipts | Successful save acknowledgement metadata only, seven days; semantic policy changes cannot invalidate retained replays |
| Deletion confirmation receipts | Hash and operation/ledger binding only, 24 hours; raw 256-bit token stays in client memory, never URLs/logs/browser persistence |
| Logs | Seven days; route name/status/duration/request ID/reason only; no query strings, tokens, notes, snapshots, provider subjects or raw IP |
| Rate limits | Initial save limit 60/minute/account; auth start 5/10 minutes/session and 30/10 minutes/source bucket; preferences 60/minute/account; deletion 3/hour/account; deletion-status polling 30/minute/receipt hash and 60/minute/source bucket, with bounded backoff |
| Rate bucket privacy | Short-lived keyed source-address hash for abuse controls only; no raw address in application logs; expire at end of relevant window |
| SQLite | foreign_keys ON, journal_mode DELETE, synchronous FULL, 250 ms busy timeout initially; short BEGIN IMMEDIATE transaction; report busy as retryable 503 |
| Application backups | Daily consistent encrypted backup, seven-day rolling retention, separate private recovery location and separately protected keys |
| Disaster recovery targets | Recovery point ≤24 hours; recovery time ≤24 hours; verify actual restore exercise, never present as an SLA |
| Planned release rollback | No acknowledged-save loss; drain writes, capture current consistent state and use compatible restore/forward repair |

Validate actual host PHP8.4 web/CLI, PDO SQLite/library patch and filesystem locking, OpenSSL/cURL/mbstring/JSON and sodium or an equivalent reviewed backup-encryption tool. Validate outbound TLS to both providers, private writable quotas, callback routing, cron/cleanup and recovery storage/key availability. No paid service is assumed.

Benchmark all 20 mixed sessions including contention/errors; do not exclude failed requests to claim p95. Reassess busy/rate policy from evidence while preserving concurrency guarantees. A rate limit returns 429/Retry-After and does not drop player memory. Failed backup jobs alert the operator and preserve the prior known-good copy; monitoring stores no player content.

Provider-managed backups may outlive seven days. Before public accounts, discover the actual longest retention, publish an accurate deletion explanation and set ledger retention accordingly. If the host cannot provide a bounded, truthful policy, privacy/recovery readiness remains unverified.

## Consistent backup, deletion and rollback

1. Use SQLite's backup API or VACUUM INTO a new private destination, validate integrity/schema, encrypt using a reviewed maintained tool, then atomically promote the backup and rotate old copies. Never copy just the active database file or promote interrupted output.
2. Keep a minimal durable deletion ledger (opaque account UUID, intent time and pending/completed state) outside every database rollback set, with independent protected recovery. It contains no provider identity, note or save. Retain markers through the longest backup lifetime plus restoration handling. Store deletion-receipt hashes/account bindings/expiry alongside it for 24 hours; their expiry must not remove the longer-lived deletion markers.
3. Serialize account deletion with game writes. After recent same-account authentication and confirmation, atomically persist the external ledger intent and authorized receipt hash/expiry while holding the relevant write barrier, before deleting live rows. Revoke all sessions/attempts and remove live rows transactionally; mark the external intent completed only after that commit. A crash after ledger intent must remain a deletion pending completion, never permission to reopen the account. Reconcile a crash after the database commit but before the completion marker. On startup and before account access honor/reconcile markers; ledger failure cannot yield false deletion success. The read-only receipt status reports that durable state without relying on a revoked session; unknown/expired receipts remain unconfirmed.
4. Restore to an isolated path, replay deletion markers, verify accounts/ownership/revisions/content/schema, and only then make the restored store accessible. Test a deletion made after the backup and a crash between intent and DB commit.
5. Stage release changes with compatibility matrix and backup. Drain saves before incompatible migration. Rollback may restore code only if it reads current data; otherwise use tested forward repair/coordinated migration. Never replace current saves with a stale predeploy DB merely to revert code.
6. Test unchanged analytics and other arcade routes with read-only checks, game provider callbacks, nested paths and save ownership. Publish only when the owner initiates release and all pre-publication G7 checks pass; close G7 after the remaining public smoke checks pass.

Confirmed account deletion removes live progress/sessions; pending or unconfirmed operations are labeled honestly. Status checking requires the exact configured Origin and the narrow receipt header, cannot select an account by ID, and never deletes or creates an account. Enforce the receipt length/canonical 32-byte encoding, hash lookup, rate limits and no-store responses; redact receipt headers from all logs. Deletion does not claim physical erasure from every journal/backup or logout of the provider itself. Operational backups are never player-selectable extra slots.

## Evidence and failure handling

Record exact code/content/schema/asset versions, environment, procedures, observed output and reviewer. Host capability, genuine provider tests, source reopening, listening, human learning and owner acceptance remain unverified until performed. G0 failure may select a documented same-host alternative; no automatic hosting move. Temporary missing media or API access yields honest recovery UI, never a false Saved or Passed status.
