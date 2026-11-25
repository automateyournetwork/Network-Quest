# Spec001 isolated hosting probes — T003 / loop 019

Date: 2026-11-25. Worker: `/root/loop019_t003_probes`. This supplements
[host.md](host.md) with executed evidence; the coordinator reconciles its summary.
Coverage: C2/C6/C12/C13/C14/C15, W01/G0 and the
[delivery contract](../../../specs/001-physical-layer-underworld/contracts/delivery.md).

## Result

**Actual web PHP, private SQLite access, two-process contention, rollback,
interrupted-process integrity, provider TLS egress and scheduled CLI execution
passed their bounded synthetic checks. All temporary remote resources were removed.**
The mutation/probe/cleanup interval was **21:34:11–21:35:12 UTC**. Subsequent
read-only account metadata checks added quota and backup-scope evidence.

**T003 remains partial; no gate or release is accepted.** Actual provider and
manual-copy retention, a complete recovery policy and production backup/restore
remain open. Account quota observations are a dated cPanel cache, not a refreshed
live query. CPU/process/I/O limits and representative game load remain unmeasured.
Public provider connectivity is not an OAuth callback, sign-in or token-exchange test.

## Scope and isolation

- Used the established private operator configuration as data, SSH-agent-only
  Paramiko authentication, pinned known-host verification and `RejectPolicy`.
  No credential, key file, provider secret or private website implementation was
  uploaded. Historical deployment scripts/manifests were inspected, never run.
- SFTP and PHP metadata showed `$HOME/public_html` is an owned normal directory,
  mode **0750**; `$HOME/www` resolves to it. `arcade` and `arcade/play` are normal
  directories, **0755**. A non-following recursive public-tree metadata scan
  covered **7,958 entries**, uncapped, with **zero symlinks**.
- Correctly account-scoped cPanel userdata subsequently confirmed the canonical
  domain's document root is that same `public_html`, with `www` and `mail` aliases.
  Its main record lists **zero addon, parked or subdomains**. An initial lookup
  using PHP CLI `get_current_user()` found no metadata because that value was
  empty; the corrected lookup used the privately configured account name. The
  initial absence was not accepted as an isolation result.
- Created an absent, dedicated `$HOME/network-quest-private` parent and unique
  child using exclusive path checks, **0700**, outside the observed document root.
  A separate unpredictable temporary directory under `/arcade/play/` contained
  only the PHP probe. No game/scaffold, arcade listing, rewrite rule, global
  `.htaccess`, certificate file or existing ownership/permission was changed.
- Before upload, inspected the exact three-file manifest: public PHP helper,
  private CLI fixture and private cron helper. Local PHP syntax checks passed;
  all uploaded bytes matched SHA-256 hashes and files were **0600**. New public
  directory mode was **0755** so the existing server could reach the helper.
- The web helper required a fresh high-entropy header token; only its SHA-256 hash
  appeared in PHP. A 20-minute absolute expiry made it inert after the probe
  window. Unauthenticated requests received **404** before any database operation.
  Responses used **no-store**, **noindex/nofollow/noarchive**, JSON and `nosniff`.
  No environment dump, `phpinfo`, credentials or raw exception details were served.
- Unauthenticated and authenticated responses were inspected for PHP source/hash
  exposure; none occurred. Private-root and arcade-sibling candidate URLs, plus
  the `www` alias request, returned **404** without SQLite bytes. Actual web
  `DOCUMENT_ROOT`, realpath comparison and the account metadata supplement those
  URL checks; URL guessing alone is not the isolation proof.

## Web and CLI runtime

| Observation | Executed result |
| --- | --- |
| Web PHP / SAPI | **8.4.28 / litespeed** |
| CLI PHP / SAPI | **8.4.28 / cli** |
| PDO-linked SQLite | **3.54.1**, separately queried through web and CLI PDO |
| Web extensions | PDO SQLite, SQLite3, OpenSSL, cURL, mbstring and JSON present; sodium absent |
| Web limits | memory **128M**; execution **30 s**; input **60 s**; POST **32M**; upload **30M**; timezone **UTC** |
| `open_basedir` | Not configured; filesystem permissions and route isolation remain necessary |
| Web private storage | Web PHP created/read the synthetic DB outside docroot; directory **0700**, DB **0600**, DB owner matched helper owner |
| Public helper request | Authenticated **200**; unauthenticated **404**; both no-store/noindex, no source exposure |

These are actual request-time observations, rather than inferred CLI settings.
Existing loop-016 OpenSSL AES-256-GCM primitive evidence remains applicable;
sodium absence does not certify or reject a future reviewed encryption service.

## SQLite operations and recovery boundary

All operations targeted only the new synthetic database. No analytics, player,
real application database or existing backup was opened.

1. The web process applied and queried **foreign_keys=1**, **journal_mode=delete**,
   **synchronous=2 (FULL)** and **busy_timeout=250 ms**. It created a parent/child
   schema, committed a baseline row, rolled back a changed value and rejected an
   orphan foreign-key insert. `integrity_check` returned **ok**.
2. Two independent SSH connections launched **separate CLI PHP processes and PDO
   connections** against that same fixture. The first held `BEGIN IMMEDIATE` and
   an uncommitted write for 1.6 seconds, announcing readiness in its own exclusive
   marker. The second attempted a competing write while that lock was held.
   It received SQLite **BUSY (5)** after **258.8 ms**, still reading the baseline.
   The holder rolled back; a new connection observed the baseline, integrity
   **ok**, zero foreign-key violations and no remaining journal at that point.
3. A later transaction successfully committed a new value, establishing that the
   busy result did not poison subsequent writes. Another independent process
   began an uncommitted update and killed itself with `SIGKILL`; its SSH channel
   closed without a normal exit status (**-1**). A new connection still read the
   last committed value, integrity **ok** and zero foreign-key violations. A
   journal file existed at that observation and was removed with the fixture.
   This tests interrupted-process transaction integrity, not machine power loss,
   every crash point, or an fsync/durable-storage guarantee.
4. `VACUUM INTO` produced a distinct private **0600** synthetic snapshot. A separate
   PDO connection read matching committed data and integrity **ok**. This proves
   a consistent snapshot primitive, not encrypted promotion, retention rotation,
   deletion-ledger replay, disaster recovery or a production restore exercise.

CLI command reports included nonempty shell-initialization stderr (45 bytes for
simple reports; 90 bytes for fixture invocations). These were retained privately
and not misreported as clean stderr; parsed results and exit/channel state above
are the evidence. No application error was hidden by claiming stderr was empty.

## Host-originated provider TLS

The **web PHP process** requested only public unauthenticated endpoints, with
cURL peer verification enabled, hostname verification **2**, HTTPS-only protocol,
redirect following disabled and bounded connect/request timeouts.

| Endpoint | HTTP | TLS verification result | cURL error | Additional evidence |
| --- | --- | --- | --- | --- |
| Google OIDC discovery | **200** | **0** | **0** | Returned issuer exactly `https://accounts.google.com` |
| GitHub API root | **200** | **0** | **0** | Public response obtained |
| GitHub OAuth authorize route, no client/credentials | **302** | **0** | **0** | Redirect not followed; no login or grant |

No OAuth production pair was read or deployed. Registered callbacks, state/nonce/
PKCE, code exchange, identity validation, least-privilege scopes and actual user
sign-in remain T004/later integration evidence.

## Cron

Read the current crontab privately and compared a second observation immediately
before installation. There were **zero job lines**. Preserved every original byte
and appended one uniquely tagged job invoking the existing CLI PHP path; output
and mail were suppressed. Its helper created one exclusive synthetic marker and
had the same absolute expiry as the web probe, so repeated ticks could not create
additional markers and expiry disabled execution effects.

The scheduler actually created the marker within the **80-second maximum** watch;
it was **0600**, owned by the same account. During cleanup, reread the current
crontab, removed **only the exact tagged entry**, checked a fresh pre-install
comparison, and verified the resulting unrelated bytes were unchanged and the tag
absent. No stale whole-table snapshot was restored. The original empty table was
preserved. The test demonstrates scheduler execution, not an installed backup job,
backup failure alerting, monitoring or a recovery SLA.

## Account quotas and management API limit

The cPanel UAPI executable is a working `apitool` wrapper, but it fails trying to
execute missing **`/usr/local/cpanel/cpanel`**. The specific read-only invocation
returned exit **2**, no stdout, and the missing-backend diagnostic. This resolves
the earlier ambiguous “No such file” symptom; it does not show that quota or
backup features are absent from the hosting subscription. `quota`, `lveinfo` and
`cloudlinux-limits` were unavailable in this account's executable path.

A readable **own-account cPanel quota cache**, dated **21:16:54 UTC**, version
**2.5**, contained the following. The installed `Cpanel::Quota.pm` constants and
cache-reading code verified the tuple order and bytes/inode units; no package
code or private account identifiers were copied into public source.

| Cached account metric | Used | Limit | Remaining |
| --- | ---: | ---: | ---: |
| Disk bytes | 6,419,165,184 | 107,374,182,400 (**100 GiB**) | 100,955,017,216 |
| Inodes | 130,854 | 250,000 | 119,146 |

These are **cached account observations**, distinct from loop-016 filesystem-wide
`df` totals. They were not refreshed through a functioning quota API. The installed
module can add configured SQL/mail accounting after reading the cache; those
adjustments and current live headroom were not queried. CPU/process/I/O limits
and package entitlements remain unknown. cPanel documents both OS-based quota
calculation and possible delayed usage displays:
[quota calculation](https://support.cpanel.net/hc/en-us/articles/360056050934-How-are-quotas-for-cPanel-calculated),
[Disk Usage](https://docs.cpanel.net/cpanel/files/disk-usage/).

## Backup scope and unresolved retention

Inspected existing deployment practice and release-script structure without
executing scripts or reading backup/database contents. The website process backs
up changed **public-root files** under its release records before activation. Its
manifest does **not** include the proposed game-private parent. That existing
changed-file mechanism therefore does not establish game DB, deletion-ledger or
key coverage; a separate designed game backup/recovery boundary remains required.

Own-home metadata identified **19 retained backup/rollback candidates** (18
directories, one file), without opening them. This is a scoped metadata observation,
not an inventory of every provider, local, downloaded or replicated copy. The
existing practice documentation records full-account and downloaded historical
backups and requires keeping older rollback material; no finite expiry for all
copies is established. No account-local `cpbackup-exclude.conf` or the checked
cPanel backup-config paths existed. Their absence does not prove provider backup
inclusion, exclusion, entitlement or retention.

Still needed before privacy/recovery readiness: actual provider backup coverage
and expiry; longest manual/downloaded/replicated-copy retention; independently
protected ledger/key recovery; reviewed encrypted consistent snapshot promotion,
rotation/failure handling and isolated restore with deletion suppression. No old
backup was deleted, changed or restored. The planned seven-day application policy
cannot be presented as the longest actual retention.

## Cleanup and retained evidence

Verified removal of the one tagged cron entry, the public helper and its directory,
all seven private synthetic files then present, the unique private directory and
the newly created private parent. The former helper URL returned **404** after
removal. A final independent SSH/SFTP reread confirmed those paths absent, the
crontab byte-for-byte equal to its original state, and public-root/arcade/play
modes unchanged at 0750/0755/0755. No temporary `.htaccess` was necessary. The DB, journal, snapshot, CLI
helper, cron helper and markers were removed through explicit fixture allowlists;
no recursive deletion or broad chmod/chown was used.

Exact manifests/hashes, probe source, private account metadata, results, cron
before-state and cleanup records remain under ignored owner-only
`.local/host-preflight/`. Public evidence contains only sanitized observations.
No public Git commit/push, game deployment, provider registration, support message,
purchase or permanent scheduled job occurred. Full-game concurrency/load, service
backup/restore and G7 rollout/recovery retain their later evidence gates.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
