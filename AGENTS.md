# Network-Quest Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-11-25

## Governing Contracts

Read `.specify/memory/constitution.md` first. `CONSTITUTION.md` preserves the original kickoff;
root `SPEC.md` and `PLAN.md` are the current Spec001 behavior and build contracts. Preserve
requirement IDs, source-backed teaching rules, media/source quantities, the one-save contract,
accessibility and evidence gates. A prototype or task count does not certify episode completion.
Document changes do not automatically initiate implementation, publication or another episode.

## Active Technologies

- TypeScript 7.0.2, Node.js 26.13.1/npm11.20.0, local PHP8.4.28; actual client lock/build verified in T008. Composer lock/platform and isolated production install verified T009; remote CLI PHP8.4.28/SQLite3.54.1 verified; web PHP/private storage/locking/TLS/cron synthetic checks verified; retention remains open. + Vite 8.3.8, Three.js/@types 0.187.0, Vitest 5.1.2, Playwright 1.65.1, axe-core/Playwright 4.14.1, Ajv 8 with ajv-formats (Draft 2020-12); PHP google/apiclient ^2.20, league/oauth2-client ^2.10, opis/json-schema ^2.6; development PHPUnit ^12.5. Client installation/build tested; PHP dependencies installed/validated. Dedicated auth/save/settings/deletion services have isolated local verification; actual provider and production acceptance remain pending. (001-physical-layer-underworld)

## Project Structure

```text
src/               # Client foundation
content/spec001/   # Authored episode data and explicit unfinished reservations
assets-src/        # Editable native/generated sources; full episode production pending
public/assets/     # Verified representative exports; no implied full media acceptance
server/            # PHP route boundary and test harness
tools/             # Content/build/test tooling
tests/             # Verification suites
```

## Commands

Available commands: `npm run typecheck`, `npm run check`, `npm run build`,
`npm run test:domain`, `npm run test:api`, `npm run test:e2e`, `npm run dev`,
`npm run dev:verify`, `npm run dev:client` and `npm run preview:client`.
Use pinned runtime paths from `docs/evidence/spec001/runtime.md`; PHP test/browser
commands need `NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php` on the verified Mac.
README documents explicit TLS inputs and the shared API's honest unavailable 503
responses. Vitest discovers `tests/**/*.test.ts`; new Playwright specs must be
assigned explicitly or discovery fails. The accepted copper/optics/radio/power/
capability suites execute 41 reviewed physical cases; 42 T014 entries still need
reconciliation/integration. See `physical-case-execution-review.md`; scoped
predicates do not accept composite routes. T030 owns acceptance of T022's nine
independent guest browser cases; consult HANDOFF/state for current results.
`npm run assets:verify` now audits inventory; `-- --mode release` also enforces
media minima and distribution. It checks evidence consistency, not human review.
`npm run package:release -- --ref <commit>` creates a checksummed game-only candidate
for isolated verification. See `release/INTEGRATION.md` for build and extraction.
Actual staging and publication follow the evidence gates in HANDOFF and state. No test command deploys.

## Code Style

Keep deterministic domain rules separate from presentation and persistence. Validate content
and snapshots against shared schemas plus semantic checks. Use semantic HTML controls,
prepared SQL, typed units and explicit state transitions.

## Recent Changes

- 001-physical-layer-underworld: Added TypeScript 7.0.2, Node.js 26.13.1/npm11.20.0, local PHP8.4.28; actual client lock/build verified in T008. Composer lock/platform and isolated production install verified T009; remote CLI PHP8.4.28/SQLite3.54.1 verified; web PHP/private storage/locking/TLS/cron synthetic checks verified; retention remains open. + Vite 8.3.8, Three.js/@types 0.187.0, Vitest 5.1.2, Playwright 1.65.1, axe-core/Playwright 4.14.1, Ajv 8 with ajv-formats (Draft 2020-12); PHP google/apiclient ^2.20, league/oauth2-client ^2.10, opis/json-schema ^2.6; development PHPUnit ^12.5. Client installation/build tested; PHP dependencies installed/validated. Dedicated auth/save/settings/deletion services have isolated local verification; actual provider and production acceptance remain pending.

<!-- MANUAL ADDITIONS START -->
- Implementation was initiated on 2026-11-25. Follow `docs/implementation/HANDOFF.md` and `state.json` for the one-task-per-fresh-agent loop run (200-loop cap); preserve each loop note and check only verified task completions.
- The first setup batch permits T008 -> T009/T010 -> T011 as local G0 evidence preparation while external feasibility remains open; independent local foundation follows verified tool/source/bootstrap checks. External feasibility blocks dependent integrations and aggregate gate acceptance, not unrelated local work. See the explicit exception in tasks.md.
- Active working artifacts: `specs/001-physical-layer-underworld/{spec,plan,research,data-model,quickstart,tasks}.md` and `contracts/`.
- Planning and the task breakdown are complete; follow the execution sequence in tasks.md because story grouping spans G1–G5. G0 remains BLOCKED by named external evidence; T008–T011 local bootstrap passes its checks. G1–G7 and real provider/host/media acceptance remain pending. Do not run nonexistent application commands or treat a design PASS as runtime acceptance.
- Preserve both accepted clarifications: canceled logout changes nothing; confirmed logout clears memory/title with no implicit save. Retry/E03 Continue rewind preparation/inventory while retaining clues, notes and hint-use history and making prior measurements stale.
- Save receipts must be resolved before current semantic policy or stale revisions; recheck inside the final transaction before returning any provisional validation error. A replayed acknowledgement can be older than the current server slot.
- Lost deletion responses require operation-specific receipt status. Guest session state never proves deletion; unknown/expired status remains unconfirmed. Status checking cannot delete, sign in or affect a later account.
- The implementation skill follows explicit task execution batches across story sections. G6 leaves G7-dependent checks pending until packaging, recovery, staging and owner-initiated publication make them executable.
- No next episode, installation, publication or provider registration is implied by planning artifacts. Follow the current user-authorized stage.
- Audacity 4 sources are .aup4, with no legacy scripting pipe. Preserve genuine Blender/OpenAI/audio sources and actual human review evidence.
- Owner authorization on 2026-11-25 includes scoped reviewed GitHub commits/pushes and deployment/arcade listing of the finished accepted release after required owner reviews. These are separate operations. Preserve dirty work and inspect staging; exclude private website/operator/credential/player/backup data. Optional Git auto-commit hooks remain disabled; coordinator owns publication.
<!-- MANUAL ADDITIONS END -->
