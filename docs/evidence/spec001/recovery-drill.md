# Isolated recovery and compatible rollback

On November 28, 2026, T166 exercised the game backup and restore commands, deletion and save services, database migrations, current content reader, and a prior public PHP release. All nine cases passed with 498 assertions in 41.132 seconds on the final operational code. In a planned rollback both versions read the same acknowledged adventure, including its inventory and notebook. In a separate disaster exercise the recovered game returned the last captured revision. This is local evidence for SAVE11, SAVE12, FR-025 and the recovery portion of AC19. [Drill](../../../server/tests/RecoveryTest.php) · [Recovery contract](../../../specs/001-physical-layer-underworld/contracts/delivery.md) · [Content migration evidence](migrations.md)

## Observed results

| Case | Observed result |
| --- | --- |
| Completed deletion after backup | Two synthetic owners saved before capture. A confirmed deletion returned 204. Restoring the older game archive removed the deleted account, identity, preferences, save and write receipt before account access. The surviving owner's durable rows and exact payload matched. Old cookies, provider attempts and proof were gone. |
| Failed deletion COMMIT after durable intent | A separate SQLite reader held a shared lock after intent acceptance. The deletion COMMIT returned SQLite BUSY and the game rows stayed intact. The receipt reported pending. Restore excluded that owner using the independent marker. With the recovered copy selected as the sole active game, protected access reconciled the operation and the receipt then reported completed. |
| Interrupted after game COMMIT | The live rows had been removed when the injected interruption prevented external completion. The receipt stayed pending across status reads and candidate production. Recovery removed the older archive's copy of the owner and reconciled the pending operation when the selected game resumed protected access. |
| Expired confirmation | At 86,399 seconds the authorized receipt reported completed. At exactly 86,400 it returned 404 `deletion-unconfirmed`. Cleanup removed the confirmation binding. The longer-lived marker and spent-token hash survived, the deleted account remained absent after restore, and the surviving owner's seven-day write receipt remained readable. |
| Failed backup and unavailable primary | An exclusive SQLite lock caused the backup job to fail with its fixed, redacted error. The last known-good encrypted archive retained its exact checksum and remained usable. After a newer write and loss of the primary, disaster recovery returned revision 1 from that archive. A planned rollback could not use it as a substitute for verifying current state. |
| Concurrent saves and planned rollback | Two PHP workers with distinct sessions read revision 1 and paused after validation. An archive captured that revision. Releasing both workers produced one revision-2 acknowledgement and one 412 identifying current revision 2. Replay returned the winning receipt. Rollback refused the fresh copy before drain and refused the stale copy during drain. A new save during drain received 503. The fresh isolated copy preserved the winning bytes, both retained receipts and the owning identity and preferences. |
| Database and adventure migrations | A deliberately invalid third migration rolled back the real second migration and its checksum in the same transaction. Applying migrations 1 and 2 twice preserved the revision-7 historical slot. The operational restore returned its exact 0.9.1 bytes. The production content reader moved it to the expected R12 position and the complete result matched the independently authored adventure. Its single conditional save committed revision 8. |
| Failed save COMMIT | A second reader held the game database across the commit of the validated write. The real route returned 503, and the prior slot and receipt remained exact through disaster restore. Retrying the identical operation committed revision 2 once. Its subsequent replay returned that acknowledgement. |
| Compatible code rollback | The current code committed two meaningful R12 saves. A stale archive was refused during drain. A fresh isolated comparison matched the complete durable rows. The earlier public entry then opened the same live database inode, read the exact revision-2 snapshot, denied an anonymous read, returned the other account's empty-slot response and replayed the prior receipt. It committed revision 3, which the current application read back byte-for-byte. |

Each deletion case also inspected an independently encrypted ledger archive captured before deletion. It contained zero markers. Restoring the game against the current ledger preserved the newer marker and its pending/completed state. An unrelated receipt always returned unconfirmed. Production status reads and isolated restore both leave completion to an authoritative account-access reconciliation. The tests generated, used and removed their own keys, account fixtures, databases and archives in private temporary directories. [Deletion service](../../../server/src/AccountDeletion.php) · [Protected access](../../../server/src/RecoveryAccountAccess.php) · [Restore implementation](../../../server/src/Operations/Jobs.php)

## Time and scope

The separately timed local disaster captured revision 1 at **13:42:09 UTC**. At **13:42:11 UTC**, following acknowledgement of revision 2, the synthetic primary went offline. The recovery point was **2 seconds** before the incident. The backup command reported **24 ms** and the restore command reported **198 ms**. From loss of the primary to a fresh authenticated GET returning the exact revision-1 bytes took **289.30 ms**, measured with a monotonic clock. The controlled incident included one write after capture. The planned rollback and code switch preserved every acknowledged write in their trials.

The local machine was an arm64 Mac16,7 running macOS 26.6.2 (25G83), Node 26.13.1, PHP 8.4.28, SQLite 3.54.1, libsodium 1.0.22 and PHPUnit 12.5.45. The two-account drill models a current, accessible external deletion ledger. Host backup cadence and retention, independent recovery storage and keys, real provider recovery, staging/production timings, unaffected arcade/analytics routes and release acceptance require their respective external evidence. The release operator must independently stop ingress and older workers for a code switch because the pinned earlier application predates the new drain. [Operational procedure](../../operations.md) · [Hosting evidence](host-probes.md)

## Version and reproduction

The prior release is public commit `ae8472469b5f7d98e939ccb5471b03893630993a`. The drill extracted its public entry, service, content, migrations, shared save schema and Composer lock into a new directory. Composer installed the 20 production packages with scripts, plugins and development dependencies disabled. The installed distribution references matched the lock for every package. The earlier PHP server listened only on loopback and handled requests through its genuine nested API entry using the local proxy-token transport. The current command fixtures also used the production application handler with synthetic SAPI fields. [Prior candidate](https://github.com/automateyournetwork/Network-Quest/tree/ae8472469b5f7d98e939ccb5471b03893630993a) · [Contributor runtime setup](../../../README.md#build-and-play-from-a-public-checkout)

| Verified input | SHA-256 |
| --- | --- |
| Earlier public PHP entry | `a9a2f18147b652d41f6c0fe99d9bc8b3c7f61f733aa70870473683c76ca81323` |
| Earlier application | `37e936a47f7bd6be47659a248a47071cedaa5beb5a44e44251e0af47cf47ba62` |
| Earlier Composer lock | `0fa6d980d1b29a859a425e0d863268e71d082b0694423d6213f7a4dfdf503007` |
| Current application | `d31eb9d4d66db27cd6a2bf37f599af4f3c754bdca1b11f7f4458ee1a189e0336` |
| Current recovery jobs | `88543940ac458fa8ce588349629c303e512397e43cd96ca4f78933c0ea105be3` |
| Current snapshot checks | `15627f070cfac0c6a48c66684792c9807d0156b768dfb70208a0904b094588e9` |

Install the contributor dependencies and use the pinned Node, PHP and Composer executables. For a shallow clone, fetch the historical application once from the public repository.

```sh
git fetch --depth=1 origin ae8472469b5f7d98e939ccb5471b03893630993a
NQ_PHP_BIN="$(command -v php)" NQ_TEST_NODE_BIN="$(command -v node)" \
  npm run test:api -- --do-not-cache-result server/tests/RecoveryTest.php
```

The test detects Composer 2.11.3 on PATH. A standalone official PHAR can be selected by absolute path with `NQ_TEST_COMPOSER_PHAR` and its recorded SHA-256 is checked. On the original development machine the pinned project PHAR is also available. Composer ordinarily uses its public package cache and can retrieve missing public distributions from the lock. Setting `COMPOSER_CACHE_DIR` explicitly selects a populated cache and disables network access for the prior-release install. The recorded run used the strict offline path. The first drill run stopped at fixture setup because the synthetic GitHub subject contained letters. Two distinct numeric fixture subjects satisfied the database contract, and the complete drills then ran. [PHP runner](../../../tools/test-api.mjs) · [Runtime checksums](runtime.md)

Copyright 2026 John Capobianco. Licensed under CC BY 4.0.
