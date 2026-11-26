# Native hosting header observations — 2026-11-26

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Coordinator verification supporting loop050/T041; no extra task loop or release.
This extends, rather than replaces, the successful SSH/web-PHP evidence in
host-probes.md and preserves historical failed shell attempts. It does not verify
provider login, live game routes, backup retention or an accepted deployment.

## Method and scope

Used the existing SSH agent and pinned host-key verification. Five independent,
unique token-guarded, expiring PHP observation files were uploaded and checksum
verified through SFTP. Their code read only synthetic request metadata and at most
32 decoded body bytes. They never loaded game configuration, OAuth credentials,
player storage or website source. TLS certificate verification remained enabled.
No existing site files, Apache rules, cron jobs, ownership or certificate paths
were changed. Private exact scripts/records/checksums remain ignored under
`.local/auth-header-preflight/`; no operator configuration is published here.

## HTTP/1.1 evidence

Actual web PHP is8.4.28 with `litespeed` SAPI. Unique fields reached PHP unchanged.
Duplicated Origin, X-CSRF-Token, Cookie, Content-Type, Idempotency-Key,
X-Save-Mode, X-Confirm-Adventure-Replacement, X-Deletion-Receipt,
X-Confirm-Account-Deletion and Content-Encoding reached getallheaders as one
comma-coalesced value. Duplicate Host and duplicate Content-Length were rejected
upstream with400 in the tested identical-value cases. PUT/PATCH If-Match and PUT
If-None-Match reached PHP; duplicate values were comma-coalesced.

An earlier GET If-Match baseline returned412 even though the probe executed;
explicitly setting200 did not override that observed GET precondition behavior.
The original failed attempt is retained. PUT/PATCH observations, the actual
conditional-write verbs, returned200 from the observation probe. These are SAPI
observations, not assertions that malformed requests passed a game handler.

A valid chunked PUT decoded `{}` to2 bytes but removed both Transfer-Encoding and
Content-Length before PHP. Identical or mixed-case duplicate Transfer-Encoding
fields returned400 upstream. Crucially, Content-Length:0 together with a chunked
2-byte body was accepted upstream and normalized identically to the valid chunked
case. Therefore PHP cannot reconstruct that original ambiguity. The native game
adapter requires explicit canonical Content-Length for every HTTP/1.1 mutation,
including0 for bodyless POST/DELETE; browser clients supply an empty-string body
and let the browser own framing. It does not claim to support native chunked
mutation requests. The separately verified local raw-header proxy can reject
ambiguity before normalization and supplies its own exact decoded body length.

## HTTP/2 evidence and limits

curl negotiatedHTTP/2 and PHP reportedHTTP/2.0. Unique Origin, CSRF, Cookie,
Content-Type, Idempotency-Key and X-Save-Mode reached PHP. Duplicated Origin, CSRF,
Content-Type and Idempotency-Key were comma-coalesced. Repeated Cookie fields
became a semicolon-separated Cookie value, so distinct cookie pairs are permitted
but duplicate Network Quest session-cookie names are rejected before bootstrap.
No first/last-cookie authority is permitted. Unused legitimate multivalue request
headers confer no identity, save or deletion authority.

The duplicate X-Save-Mode request and next baseline failed with curl exit56;
the first attempt did not capture a detailed curl reason. The remaining HTTP/2
save/deletion singleton observations are **unverified**, not extrapolated from
HTTP/1.1. Two subsequent SSH connections timed out before any parent stat or
upload, so those attempts created no remote files. Later HTTPS requests, including
/arcade/, returned an HTML200 page titled “One moment, please...”. This is a
challenge response, not live application success or evidence of probe absence.
Further automated probes stopped; no challenge bypass was attempted. Actual
remaining HTTP/2/framing and production endpoint behavior must be verified before
public accounts/release. HTTP/3 and other SAPIs have no evidence in this check.

## Cleanup and preserved records

All five uploaded files and their own unique directories were removed after
checking their exact digest. SFTP absence and unchanged parent UID/GID/mode were
verified in each successful connection. The first four immediate HTTPS checks
returned404. The fifth was removed through SFTP before the later connection/
challenge issue. A later independent SFTP recheck and meaningful HTTPS absence
check remain unverified; a challenge page must never be counted as404. No helper
is knowingly left behind, and no release was staged or activated.

Private record seals (contents remain private):

| Attempt | Uploaded | Record SHA-256 |
| --- | --- | --- |
| 0a9ff426a52d7c2fdf0cb833 | no; connection timeout | `71625447defff7cf8a0b64e5d95a8eb168e71b0edefcaa83abd304fc0e769e0a` |
| 0ea8bc4d550c54db776e4b17 | yes; removed | `9af02549693435b4c05534393c49676e39b34739385b6a1c58a99b7f6e9559b1` |
| 37a68b88e51df50947260680 | yes; removed | `6d974de49853af127462ff7da101df63073d3de24af0020c90565ab53f0d07ef` |
| 4953bef74b53b22b94ebda38 | yes; removed | `9fdca9049e2a1b6302ad5a7acbcebea001c6ec35a25867cc0ba101a95f2112fe` |
| 777e4126e318bb778f7a78d7 | yes; removed | `c85ea2642838694dd2bd8f36f81b270e6dec45ff3c4f4dfdd3a693beff5bb6b6` |
| 9a187d1a6ed5ac138650d497 | yes; removed | `6eaf0caf52d6b402844df569785424f21dc25cdc35c01ca722f42ccabac22fbf` |
| ff83250581de17a6cc59bfbc | no; connection timeout | `74beb23beca95edeaada009bb6ffe23512379cc8ed20d21d66bdb80175f0242f` |

## Resumed verification — 18:13–18:18 UTC

The earlier failures above remain historical evidence. After a cooldown, a normal
certificate-verified `/arcade/` request returned the actual arcade page with no
challenge. Existing-agent SSH with strict pinned host verification executed
`id -un` successfully and matched the configured identity; SFTP also worked.
The shell emitted 45 bytes on stderr, retained privately without treating stderr
as a failed exit or publishing its contents. Independent fresh SFTP checks found
all seven previously planned probe files and directories absent; their HTTPS
URLs each returned404. This resolves the earlier independent-cleanup uncertainty.

After inspecting the historical script, a sixth uploaded probe used a new random
identifier, guard and ten-minute expiry. It retained the same narrow observation
scope, checksum verification and strict TLS, and spaced requests one second apart.
Its unauthorized guard returned404. All fourteen remaining HTTP/2 observations
returned200 with curl negotiatingHTTP/2 and PHP reportingHTTP/2.0:

| Header | Method | Single field | Mixed-case duplicate |
| --- | --- | --- | --- |
| X-Save-Mode | PUT | unchanged | comma-coalesced |
| X-Confirm-Adventure-Replacement | PUT | unchanged | comma-coalesced |
| If-Match | PUT | unchanged | comma-coalesced |
| If-None-Match | PUT | unchanged | comma-coalesced |
| X-Deletion-Receipt | POST | unchanged | comma-coalesced |
| X-Confirm-Account-Deletion | DELETE | unchanged | comma-coalesced |
| Content-Encoding | PUT | unchanged | comma-coalesced |

The probe was removed after digest verification. Its directory was removed;
parent ownership/mode remained unchanged, SFTP confirmed absence and HTTPS
returned404. No existing website files or configuration changed. This completes
the previously missing singleton observations, not production endpoint, OAuth,
backup-retention, HTTP/3 or deployment acceptance.

Additional private record seals:

| Record | SHA-256 |
| --- | --- |
| Normal arcade baseline | `820f7437f1edd90561ee7cb52b21e11b07f9c1a4fd66bf2f36ab3f703bc700db` |
| SSH recheck | `437b8443808e4c2198172d5e5295e3fb5b4b15ac4c8d4fb2ffe30c6f548803f7` |
| Independent cleanup | `569209a1bae652c739c2fe23d02a0fb48a6f0db4f7bb089208ac4e57165d0e57` |
| Sixth probe result | `a4a6c5cb9e5f9e257b6bb9f3a9a79e0e8e946af2f99e5992638d32a7cf2857c5` |

## Fresh own-account quota observation — 18:38 UTC

Read-only SFTP inspection found the account quota cache updated at17:52:33UTC
on2026-11-26:6,419,795,968 of107,374,182,400 bytes used, with130,857 of250,000
inodes used. The six numeric fields were mapped using the previously inspected
installed Quota.pm constants. No quota refresh or remote write was performed.
The optional MySQL/PostgreSQL/mailman adjustment caches were absent; absence is
not evidence of zero usage. This is newer dated cache evidence, not a verified
adjusted billing quota or package CPU/I/O limit. Backup coverage/longest retention
and those package details remain open. Private record SHA-256:
`d009074f978641941965ee5f5a4a62ba7e54e6ba942968cd2e7774cb0707bec0`.
