# Spec001 save migration evidence

On 2026-11-27, SAVE11 and AC13 passed locally for two hypothetical schema-1 saves from content 0.9.1. Ordinary Continue and Restore Save moved both apprentices to valid positions in the authored 1.0.0 world. A later eligible save preserved each complete expected adventure in the single PHP/SQLite slot. This covers FR-025 and NQ-12. The earlier catalog and both apprentices are synthetic. The Iron City remains a preview in Spec001. [Acceptance contract](../../../SPEC.md) · [Frozen independent fixture](../../../tests/fixtures/migrations/spec001.json) · [T143 integration](../../implementation/loops/161-T143.md)

## What the player retained

| Historical position | Player-visible result | Stored result after the first manual save |
| --- | --- | --- |
| Removed signal ledge, after an E02 ending | Continue explained the move to the Iron Threshold entrance and the need to take fresh measurements. Walk at the Iron City gate was rejected. Look described the future boundary. | The entire snapshot matched the independent answer, including the inspection kit, eight completed objectives, completed quest, achievement, two recruits and their ordered party, compendium, notebook, hint records and E03/E02 history. Configuration revision advanced from 55 to 56. The nine historical measurements stayed stale. |
| Removed instrument bench on a later Arrival Lift visit | Restore named the retired bench and the new entrance before asking whether to discard current progress. The restored notes retained the original line break, emoji and literal old identifiers. | The entire snapshot matched the second independent answer. Configuration revision advanced from 70 to 71. All ten measurement records survived. The formerly current 95 m reading retained its original revision, attempt and values and became stale. |

The apprentice could revisit the Copper Warrens and open the unplayed Lost Maintenance Record. Its instructions offered practice and the full activity. The saved rewards stayed intact. At the Iron Threshold the authored gate has a Look interaction, the future-door condition evaluates false, and the only available room exit leads back to R11. [State checks](../../../tests/state/migrations.test.ts) · [Player journeys](../../../tests/e2e/migrations.spec.ts)

## What happened to the account slot

| Operation | Observed result |
| --- | --- |
| Read either historical slot | A real HTTPS GET returned revision 7 and ETag `"save-7"`. The entire UTF-8 snapshot member in the response matched its SQLite bytes, including the leading LF, two spaces, interior formatting and trailing CRLF. Opening the notice, checking notes and looking at the gate issued zero PUTs. |
| Cancel a reviewed Restore | The player kept the local adventure and its unsaved notes. The historical bytes and revision stayed intact. A new Restore read and installed the saved adventure after explicit confirmation. |
| Interrupt a Restore response | PHP returned the complete stored value. The test cut the response inside the snapshot before delivering it to Firefox. The UI reported the failure, kept the current notes and exposed no candidate. A fresh complete read followed by manual Save committed the full expected Arrival Lift snapshot. |
| Confirm logout during a read | An authenticated historical GET completed on the server while its response was held. Confirmed logout returned the player to the title and cleared the editor. Releasing the old response did not install its candidate. A second synthetic account saw an empty slot. Signing back into the original synthetic account loaded the original bytes. No PUT occurred. |
| Save manually or automatically | Manual Save used `If-Match: "save-7"` and committed revision 8 once. Its returned timestamp matched the visible account receipt. On an opted-in account, Restore and notebook inspection issued zero PUTs. A later safe arrival at the Workshop issued one automatic PUT with the same precondition, retained the journal and committed revision 8. |
| Race two tabs and lose the winning response | Both tabs migrated revision 7. One native PUT committed 8 and its acknowledgement was dropped. The competing PUT received 412 with current revision 8 and could not change the winning bytes. After reviewing and loading the winner, the second tab saved revision 9. Retrying the first operation sent the original body, key, mode and ETag. The replay acknowledged 8, reported 9 as current and left the exact revision-9 bytes in the only row. |
| Read an opaque newer schema or content version | Both actual GETs preserved the original escapes, whitespace and large numbers. Restore and Save explained the need for a compatible update. The still-playing apprentice could edit notes and cross a safe room boundary with account autosave opted in. Neither case issued a PUT, offered replacement or changed any stored byte. |

The native browser cases used a disposable Firefox trust profile, an ephemeral loopback HTTPS origin, the configured PHP application, actual sessions and fresh SQLite storage. A private CLI fixture seeded the historical and newer raw rows. Only the specified transport failures and delays were introduced. Real provider sign-in, production storage and release recovery have their own acceptance evidence. [Isolated service fixture](../../../tests/e2e/support/configured-save.ts) · [Native assertions](../../../tests/e2e/migrations.spec.ts)

## Reproduction and scope

The run used Node 26.13.1, Vitest 5.1.2, Playwright 1.65.1 with bundled Firefox 159.0 (revision 1572), PHP 8.4.28 and SQLite 3.54.1. Seven affected Vitest suites passed 254 cases, including six new reader regressions, all 22 original T048 cases and all seven original T142 fixture checks. The seven Firefox journeys passed under the registered `firefox-local-https` project. TypeScript, 12-room / 142-record content validation and current write-policy generation passed. The two-tab race passed again after the shared fixture’s PHP control-pipe timeout changed. [Runner output](migrations/verification.txt) · [Runtime setup](runtime.md) · [Browser project](../../../playwright.config.ts)

These commands repeat the focused checks with the repository’s pinned Node and PHP paths.

```sh
npm run test:domain -- tests/state/migrations.test.ts tests/state/save-migrations.test.ts tests/state/spec001-migration-fixture.test.ts tests/services/game-api.test.ts tests/services/save-coordinator.test.ts tests/state/autosave.test.ts tests/ui/save-dialogs.test.ts
npm run test:e2e -- migrations.spec.ts --project=firefox-local-https
```

The recorded browser run used the registered project with the separate static preview omitted. Each test starts and stops its own trusted HTTPS application server. The raw input fingerprints below were independently recomputed from the frozen fixture.

| Raw payload | UTF-8 bytes | SHA-256 |
| --- | ---: | --- |
| Iron Threshold prior | 16,682 | `ebf5ea55e93ce71ed6acabfbe67bda36c76083cc19ad5f986e7e01b83ec59606` |
| Arrival Lift prior | 17,459 | `d5f18ea3fb0e757895bcb1dcad2176946a6bd36a49a41a64445a55772cccd106` |
| Opaque schema 2 | 134 | `314c6756d855f4c390a7a3bfe253acdec2cdd313560f3ec6e3e7edb986ab6266` |
| Opaque content 2.0.0 | 103 | `f1b159cda859ab5c6ca2171801e19b132fbd3805d6aceba25a826158b38a1eba` |
