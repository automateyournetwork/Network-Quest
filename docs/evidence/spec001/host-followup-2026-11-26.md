# Existing-host follow-up — T003, loop 080

Observed 2026-11-26, starting at 23:38 UTC. **T003 remains partial; this does not pass
G0 or authorize deployment.** The owner requested continued overnight progress.
This bounded follow-up used read-only SSH/SFTP with the existing SSH agent and
pinned known-host verification. No remote files, permissions, databases, schedules,
provider settings or website releases were changed.

The [earlier runtime/storage checks](host-probes.md) remain valid historical
evidence. This follow-up addresses the remaining quota, package-limit and backup
questions; it does not repeat PHP/storage/cron probes or the unchanged failed UAPI
invocation. No backup or player-data contents were opened.

## New account-quota observation

The account's cPanel quota cache has refreshed since the November 25 observation.
Its recorded timestamp is **2026-11-26 23:05:22 UTC**, approximately 33.5 minutes
before this read. The installed `Quota.pm` contains the six expected named indexes,
and the cache reports version 2.5. Its captured source hash differs from the prior
stored hash; no byte-identical source claim or cause for that difference is inferred.

| Cached account value | Observed |
| --- | ---: |
| Disk used | 6,425,862,144 bytes |
| Disk limit | 107,374,182,400 bytes (100 GiB) |
| Disk remaining | 100,948,320,256 bytes |
| Inodes used | 130,947 |
| Inode limit | 250,000 |
| Inodes remaining | 119,053 |

Compared with the prior cache, usage increased by 6,696,960 bytes and 93 inodes.
This is a newer **account-cache observation**, not a forced live quota refresh or
filesystem-wide `df` result. Its accounting scope and timestamp remain explicit;
it cannot establish current deployment headroom after future changes.

## Process observations do not establish package limits

An actual SSH-launched PHP process exposed `/proc/self/limits`: CPU time, file
size, resident set and address space were reported unlimited; process count was
287,659 soft/hard; open files were 1,024 soft and 262,144 hard; stack was 8 MiB
soft; locked memory was 65,536 bytes soft/hard. These are that process's inherited
resource limits, **not** accepted cPanel account, web-PHP or concurrency allowances.

Its current cgroup metadata identifies CPU, memory, process and block-I/O
controllers. A single bounded read of the relevant own-group and ancestor control
files returned unreadable values for CPU quota/period, memory limits, process
maximum and I/O throttle settings. Unreadable does not mean unlimited or absent.
No effective CPU, memory, entry-process, process or I/O package limit is accepted.
Both remote PHP metadata commands exited zero with 45 stderr bytes, retained in
the private evidence rather than described as clean stderr.

## Backup scope and retention remain unresolved

- The latest existing website release record and its release-specific staging and
  activation scripts describe 30 changed static files. Its remote backup directory
  exists. Those scripts verify and preserve changed public-file originals; they
  contain no backup rotation or expiry policy and do not establish coverage of a
  future dedicated game database or private key/receipt store. No old script or
  manifest was executed.
- The account home still has 19 entries whose names contain backup or rollback:
  18 directories and one file. A broader release/staging-name filter finds 94
  candidates; these are not claimed to be 94 backups. Names, timestamps, modes and
  sizes are metadata only, not content, successful restore or retention evidence.
- The three previously identified account-level backup configuration/exclusion
  candidates remain absent. This does not establish that provider-managed backups
  are disabled, that they exclude private game storage, or that they have no expiry.
- A historical website record describes a downloaded application archive. Its
  recorded local archive path and containing backup directory are now absent in
  that checkout. The historical report must not be treated as proof of a currently
  available local restore copy. This check does not establish whether the archive
  was moved or copied elsewhere, and no broad search of unrelated user files ran.

The provider's actual inclusion/exclusion scope, retained recovery points and
longest expiry still need owner-console or provider-supplied evidence. Every
manual/downloaded/replicated copy's lifetime also needs a bounded policy and
inventory. File age alone cannot establish either maximum retention or deletion.

## Remaining capability and disposition

The smallest later operator action is to inspect this existing hosting account's
backup and resource/package settings and record: coverage of the proposed private
game directory, automatic backup retention/oldest available recovery point, any
downloaded or replicated copy policy, and the effective CPU, memory, entry-process,
process and I/O limits. No password, key, new account, purchase or SSH toggle is
needed. The already-pending owner evidence request is not repeated overnight.

Until then, T003 remains partial. Independent local gameplay/content work may
continue. Production privacy disclosures, backup/recovery readiness, hosting-load
acceptance and release gates must preserve these missing facts. The current
same-host SQLite choice is neither rejected nor newly certified by this metadata
follow-up.

Private operator observations and their checksums are retained under ignored,
owner-readable `.local/host-followup-20261126/`. A local collector initially failed
before SSH because its filename shadowed Python's standard-library `inspect`;
renaming that task-owned file resolved the import. The failed launch is retained;
no remote check or write occurred during it. Both successful connections closed.
The public report contains no connection values, account identifier, private
website implementation, archive content or production credentials.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
