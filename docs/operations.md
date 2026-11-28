# Spec001 backup and recovery operations

The PHP commands protect the dedicated Network Quest SQLite database and its independent deletion ledger. The local drill used disposable accounts. Host scheduling, private recovery storage, independently recoverable keys and the longest retention of provider and manual copies still need operator evidence before public accounts. [Measured local results](implementation/loops/180-T165.md)

## Provision private storage

Run the commands as the game operator with the release's PHP 8.4 CLI, PDO SQLite, libsodium and production Composer dependencies. Use a filesystem with working SQLite locks, flock, atomic hard links, file synchronization and directory synchronization. Provision each directory with mode 0700 and stable operator-controlled ancestors. Use canonical absolute paths without symlinks. A private regular file has mode 0600, a single link and the directory owner's UID. Test actual ACLs, web denial, quotas and recoverability on the intended host. Separate directory names on a single disk alone cannot establish independent failure domains.

Supply a private flat JSON configuration to both commands. It contains storage settings only. Supply all actual document roots in the JSON array environment variable `NQ_DOCUMENT_ROOTS_JSON`. The operational file, game credentials, keys, databases, journals, logs and recovery material belong outside web roots and public packages.

| JSON field | Value to provision |
| --- | --- |
| `databasePath` | Existing, migrated, dedicated game database. Use the same path as the web service. |
| `ledgerFile` | Current initialized deletion ledger used by the service. Preserve its stable sibling `.lock`. Keep the ledger, its lock and its `.write-drain` marker outside all game rollback sets. |
| `rollbackRoots` | Array of all game backup and rollback roots, including the directories containing the live game DB and the encrypted game archives. |
| `archiveDir` | Private recovery location for encrypted game copies, separate from live storage. |
| `ledgerArchiveDir` | Separately protected recovery location for the ledger, outside every game rollback set. |
| `keyFile`, `ledgerKeyFile` | Two independently generated raw 32-byte keys in separate regular files. Provision protected escrow outside game, ledger, archive, scratch and rollback locations. Archive creation checks both keys differ. Isolated decryption needs the key for that archive kind. |
| `restoreDir` | Private, unserved scratch and review area outside rollback roots with room for an uncompressed snapshot. Each restore target must be a new ordinary filename ending in `.sqlite` directly inside this directory. |
| `backupSeconds` | Reviewed longest lifetime across eligible copies, at least 604800 seconds. Include host, manual, snapshot, downloaded and replicated copies. |
| `restorationSeconds`, `retentionEvidence` | Positive restoration-handling window in seconds and a reference to reviewed retention evidence. These three retention inputs must match the live ledger policy. |
| `logDir` | Optional private directory for bounded request metadata. Set the same directory as `NQ_REQUEST_LOG_DIR` in the web runtime and supply it here for scheduled expiry. |

Keep the game, ledger, game archive, ledger archive, restore and log directories disjoint. Reserve filenames starting with `.nq-` there for these tools. Validate actual maximum retention against the hosting account and every other copy owner. The 30-day maximum in the synthetic tests is fixture input. Unknown coverage leaves host retention and the public deletion explanation open. Preserve the existing policy and markers during investigation.

Keep the [public account policy](../src/app/account-backup-policy.ts) set to `unverified` until the operator confirms coverage for every eligible copy and the deletion ledger. After review, set its status to `verified` and supply two complete player-facing statements. `backupExpiry` explains when the last recoverable copy can expire. `deletionMarkerRetention` explains how long deletion protection persists, including restoration handling and any longer-lived markers. Keep private evidence in the operations record. Rebuild the release and open **Settings → Account data and backup policy** over HTTPS to check both statements on the packaged candidate.

For initial provisioning, create each new key exclusively under umask 0077. PHP's `sodium_crypto_secretstream_xchacha20poly1305_keygen()` generates the raw bytes. Write them directly to the file. Keep recovery access to every still-eligible archive's original key. A key change requires a tested key recovery or re-encryption plan for those archives.

## Schedule and monitor the jobs

This cron example assumes the scheduler uses UTC. Substitute the configured PHP binary, private job configuration and release paths. Route nonzero job exits through the operator's private monitoring. A missed job also needs an independent timer alarm in case the scheduler itself stops.

~~~cron
NQ_DOCUMENT_ROOTS_JSON=["/absolute/site/docroot"]
NQ_OPS=/absolute/private/config/recovery.json
15 2 * * * /absolute/php84 /absolute/release/server/bin/backup.php "$NQ_OPS" game
25 * * * * /absolute/php84 /absolute/release/server/bin/backup.php "$NQ_OPS" ledger
0 * * * * /absolute/php84 /absolute/release/server/bin/backup.php "$NQ_OPS" cleanup
45 * * * * /absolute/php84 /absolute/release/server/bin/backup.php "$NQ_OPS" status
~~~

`game` takes a consistent SQLite snapshot of the live database. `ledger` captures the independent store under its own barrier. Each checks the packaged schema and migration checksums, SQLite integrity and foreign keys. Game checks cover account ownership, preference/identity rows, receipt revisions, payload hashes and recognized saved-content structure. Future versions retain their opaque bytes. The checks preserve earlier acknowledgements across semantic policy changes. [SQLite snapshot semantics](https://sqlite.org/lang_vacuum.html)

Each job encrypts its snapshot using libsodium's XChaCha20-Poly1305 secretstream, reads back the ciphertext and matches its decrypted SHA-256 to the verified SQLite bytes. Archive kind, capture timestamp and random basename are authenticated with every frame. A final tag and exact end-of-file are mandatory. Keep the original basename when transporting a copy. The tool syncs and atomically publishes the complete file before rotating encrypted copies of the same kind aged seven days or more. Private locks serialize jobs that share scratch or archive directories. Failed capture/validation retains the previous known-good copy. The next job using that scratch location clears reserved partials while holding the same lock. Account for this scratch data and delayed expiry during an outage. [Libsodium secretstream](https://doc.libsodium.org/secret-key_cryptography/secretstream)

`cleanup` physically expires game save acknowledgements at seven days and external deletion-confirmation bindings at 24 hours using independent transactions. It also clears expired session, reauthentication, OAuth and rate-bucket metadata. Reads already enforce the time limits between sweeps. Marker rows, their completion state and spent confirmation hashes survive the sweep. Current code leaves markers in place even after their recorded minimum. Monitor `ledgerRoomRemaining` and review capacity before intake fills. Any future marker pruning requires proof of the longest eligible backup age plus restoration handling.

The request sink records a fixed route name, status, duration, server-issued request ID and bounded reason. UTC hourly log buckets expire when their start is seven days old. Configure upstream access/error logs separately, especially for OAuth callback queries and deletion-receipt headers. A request-log failure reports a fixed diagnostic and preserves a completed save response.

`status` authenticates the newest archive of each kind and checks each capture age is at most 24 hours. It reads drain state and aggregate remaining ledger capacity. Commands emit one JSON result with elapsed milliseconds on success, or a fixed redacted failure and a nonzero exit. Successful capture returns the archive basename. On failure, check the operation's private paths, permissions, keys, free space, schema and lock availability. Preserve prior copies and rerun after fixing the cause.

## Restore and planned rollback

~~~sh
/absolute/php84 /absolute/release/server/bin/restore.php "$NQ_OPS" disaster "$GAME_ARCHIVE" "$NEW_ISOLATED_DB"
/absolute/php84 /absolute/release/server/bin/restore.php "$NQ_OPS" ledger-inspect "$LEDGER_ARCHIVE" "$NEW_ISOLATED_LEDGER"
/absolute/php84 /absolute/release/server/bin/backup.php "$NQ_OPS" drain
/absolute/php84 /absolute/release/server/bin/backup.php "$NQ_OPS" game
/absolute/php84 /absolute/release/server/bin/restore.php "$NQ_OPS" rollback "$DRAINED_ARCHIVE" "$NEW_ROLLBACK_CANDIDATE"
~~~

1. For disaster recovery, keep game ingress offline. Choose an eligible game archive and establish the authoritative current external ledger. If the ledger itself was lost, inspect its independently recovered copy in isolation. An hourly ledger capture can omit a later authorized deletion. Prove that the recovery chain covers every subsequent intent before reopening accounts. A missing or unverifiable authoritative ledger keeps account access closed. `ledger-inspect` produces a private review file.
2. `disaster` checks integrity, replays both pending and completed markers from that authoritative ledger, invalidates restored sessions and dependent provider transactions, and drops expired write receipts. Under the shared ledger barrier it rechecks ownership, revisions, content and schema before promoting an isolated candidate. The live ledger keeps its real completion state during rehearsal. Recovery supports loss of the live game volume and refuses to overwrite any destination. The operator owns isolation and secure disposal of completed drill outputs.
3. For planned rollback, first block external ingress and quiesce every web worker, scheduler and writer that can bypass the new drain. `drain` serializes with participating account operations and persists across process restarts. Builds predating the drain can still write if exposed. Hold the independent ingress/process boundary throughout the switch, including older-code compatibility testing. Capture current state after the drain. `rollback` requires the drain and compares whole current account, identity, preference, save and unexpired write-receipt rows, applying the latest deletion markers. It rejects divergent progress even when revision numbers match.
4. Prefer running compatible code on the current DB. If compatibility fails, keep the site drained for tested forward repair or coordinated migration. Inspect actual surviving accounts and save revisions privately. Keep the external ledger current and outside any database swap. At authorized activation, quiesce old SQLite connections, install the compatible candidate at the private path and recheck ledger authority and backup coverage. `backup.php "$NQ_OPS" resume` releases the game drain. Verify the ordinary application recovery barrier and save/session behavior before restoring public ingress. A restored user signs in again.

Use the current release's compatibility manifest and the [delivery contract](../specs/001-physical-layer-underworld/contracts/delivery.md). Selection, cutover and public ingress remain explicit operator actions.

## Measured scope

The local exercise used PHP 8.4.28, SQLite 3.54.1 and libsodium 1.0.22 on the development Mac. One synthetic account received two successful save acknowledgements around one backup. A simulated volume loss recovered the first revision and its exact payload. The second acknowledgement followed the capture. Planned rollback rejected that stale copy and preserved the newer revision using a fresh drained capture.

The engineering objectives are a recovery point and recovery time of at most 24 hours. Measure actual capture age and full time to usable authenticated service on the intended storage, data size and host, including alerting, key access, deletion-ledger continuity, cutover and post-restore verification. Record hosting retention and operator handling before publishing the deletion policy. [Local timings and test results](implementation/loops/180-T165.md)
