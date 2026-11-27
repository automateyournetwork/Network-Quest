# Q02 account and save isolation review

The game could offer a different account’s saved adventure under the first account’s displayed name after another tab switched the shared login cookie. The PHP route selected the account owned by the cookie. The stale tab still associated that response with its own previously reviewed session. This affected reading and restoring a snapshot. Save writes already required a matching session-bound token.

The candidate uses the existing X-CSRF-Token header as an optional read precondition on GET /save. The game supplies its reviewed token for every save read. Existing clients that omit the precondition retain the documented cookie-based behavior. The PHP Sessions::require check compares the token with the cookie’s session. Sessions::within checks the same token hash, generation, account and validity again in the immediate transaction that reads the slot. The game presents Check Session after a forbidden read. Refreshing adopts the server’s session while leaving the local adventure available for a separate explicit decision.

## Local evidence

The isolated candidate used git archive of 8ddb998c5250a95420f4b12dd1f162aa25ec80d7. The patch SHA-256 is f0c2f9f0594b750be6dc01a287245602c83ed79fe260f5074c78bc9ba41d1e6a.

| Check | Result |
| --- | --- |
| Unmodified baseline, focused route, concurrent saves, session and deletion tests | 181 tests, 6,016 assertions passed |
| New PHP regression against baseline | Returned HTTP 200 for the switched session instead of 403 |
| New GameApi and SaveCoordinator regression against baseline | Returned a successful review under the stale session |
| Isolated candidate, API plus configured synthetic HTTPS contract | 217 tests, 7,761 assertions passed |
| GameApi and SaveCoordinator | 139 passed |
| Save dialog and session recovery | 25 passed |
| TypeScript | Passed |

Run with pinned Node 26.13.1 and PHP 8.4.28. The first isolated PHP suite run encountered four synthetic TLS harness setup errors because the archive did not include the pinned Node binary. The rerun explicitly supplied NQ_TEST_NODE_BIN. Both logs are retained.

```sh
npm run test:api -- --do-not-cache-result --filter 'AuthRoutesTest|SaveConcurrencyTest|AccountDeletionTest|DeletionStatusRoutesTest|SaveRoutesTest|SessionsTest|ApiContractTest'
npm run test:domain -- tests/services/game-api.test.ts tests/services/save-coordinator.test.ts
npm run test:domain -- tests/ui/save-dialogs.test.ts
npm run typecheck
```

## Adjacent boundaries

- GET /session bootstraps the current identity and exposes preferences. The preferences endpoint accepts PATCH with ordinary session and origin checks. Provider callbacks consume session-bound state before provider I/O and reauthorize the session inside the final identity transaction.
- The save repository keys receipts by server-derived account and request ID. Its final transaction rechecks authorization and the receipt before returning provisional validation errors. The concurrency tests exercise both winner orders, replay after a changed policy or later revision, and save versus logout or deletion.
- The deletion status route reads the operation-specific receipt. Its tests cover lost responses, unknown and expired receipts, revoked sessions, and checking a prior account’s receipt after a subsequent login. Logout and deletion authority remain distinct.
- The synthetic coordinator transport models a cookie switch between bootstrap and read. The separate PHP regression exercises two actual application-issued sessions and the slot reader. The local tests do not establish production OAuth, multi-tab native browser execution, deployment, backup retention or complete episode acceptance.

## Joined verification

After the coordinator applied the patch alongside the MG03, Q01 and T104 changes, all eight affected source, contract and test files matched the isolated candidate byte for byte. Their hashes are in [joined-source-sha256.txt](joined-source-sha256.txt). The joined workspace passed 45 route and session tests with 1,256 assertions and all 164 GameApi, coordinator and dialog tests. The latter include deferred responses after local view invalidation, the stale-session rejection and explicit session recovery. These checks use the actual client classes, PHP routes and synthetic transport.

The additional full isolated API run executed 909 tests and reported four errors in MeasurementHarnessTest. Its launcher resolves Node under the archive’s own .runtime path. Giving that archive the pinned runtime at its expected path and rerunning only MeasurementHarnessTest passed all seven cases with 359 assertions. The original failed run and the focused rerun are both retained. The coordinator owns broad joined-suite verification.
