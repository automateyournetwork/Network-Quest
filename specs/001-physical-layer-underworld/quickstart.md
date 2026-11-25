# Quickstart: Spec001 implementation

**Status:** implementation initiated on 2026-11-25. Follow `docs/implementation/HANDOFF.md` for current progress. T008 verified `npm ci`, `npm run typecheck` and `npm run build` for the local bootstrap; see [client evidence](../../docs/evidence/spec001/client-bootstrap.md). T009 verified Composer install and T011 added `npm run dev`/`npm run dev:verify`; [README](../../README.md) documents real local HTTPS and the deliberately unavailable API. T020 now verifies `check`, `test:domain`, `test:api` and `test:e2e` against actual foundation suites; see loop024 evidence. Asset/release/deployment commands remain planned. No gameplay or provider readiness follows from foundation checks.

Read [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md) and [constitution](../../.specify/memory/constitution.md). The working branch is `001-physical-layer-underworld`. Execute the existing task batches with one task per fresh-agent loop and persistent verification notes.

## G0 preparation

1. Record actual Mac hardware, free disk and tools. Local metadata observed Node 25.3.0/npm11.7.0, Blender5.2.1 and Audacity4.0.0 at /Applications/Audacity 4.app; these observations do not prove supported production readiness.
2. Select Node26LTS, PHP8.4 supported patch, candidate dependency versions from the plan, a tested Blender5.2LTS patch and Audacity4.0.2 or an explicitly justified alternative. Install/lock only during implementation. Audacity4 uses .aup4 and lacks the old scripting pipe.
3. Verify the actual GoDaddy web/CLI runtime, extensions, outbound HTTPS, private paths, locking/quota, scheduled backups/cleanup and recovery storage. Record non-secret evidence. Never reuse analytics storage.
4. Register dedicated Google/GitHub applications with exact configured HTTPS callbacks in delivery.md. Keep secrets in private server environment/config outside docroot and Git. Client VITE_ variables contain public base/API paths only.
5. Use real local HTTPS or a private staging origin, preserving Secure cookies. A same-origin proxy must present game and API under production-shaped nested paths. Document the chosen local TLS/PHP launch procedure when implemented; do not disable TLS/session checks to make OAuth appear to work.
6. Author independent T01–T16 fixtures and precise source claims before evaluators. Validate correct/incorrect/boundary examples.
7. Launch/reopen/export representative Blender and Audacity sources, review actual model/component/output licenses, then audition local Kokoro and ACE-Step1.5. Record runtime/memory/listening results before bulk media; no production feasibility is established by this document.

## Command contract (implemented status above and in README)

These commands must be implemented, fail on real errors and never deploy implicitly:

| Command | Contract |
| --- | --- |
| npm ci | Install pinned client/tool dependencies from committed lockfile |
| composer install --working-dir=server | Install pinned PHP dependencies; package production without development dependencies |
| npm run dev | Implemented loopback HTTPS/Vite/PHP bootstrap with explicit TLS inputs; shared router is implemented; actual account/save operations remain unavailable. README documents startup and limitations. |
| npm run check | Type checking, schemas, content references and route/quest graph |
| npm run test:domain | Independent physical-rule and state cases, including T01–T16 and retry invariants |
| npm run test:api | Service/security/concurrency/migration checks against explicitly isolated test storage |
| npm run test:e2e | Browser journeys, semantic keyboard path, save/adoption/conflict and recovery |
| npm run assets:verify | Source/export/use/rights/count/hash checks; reports human reviews separately |
| npm run build | Standalone static client and manifest; no private website dependency |
| npm run package:release | Checksummed client/PHP/schema/credits/source index; excludes secrets, DBs and player data |

PHP test tooling uses PHPUnit12.5; shared Draft2020-12 fixtures must agree between Ajv2020 with ajv-formats and Opis. Production rejects test-auth configuration. Mock identities are confined to tests and cannot satisfy AC11.

## First executable slice

After verified local runtime/source/bootstrap prerequisites, expand the local bootstrap into an R01/R02 graybox; retain external G0 checks and do not certify aggregate G1 until required evidence passes with four verbs and semantic objects, notebook freshness, T01/T02/T14 plus boundary, and the known-payload packet view. Then implement the world registry and account/single-slot contract. Finish and measure a representative room before full media production. Follow W01–W09 and G0–G7 rather than advancing to another episode.

## Verification runs to preserve

- Guest start/canceled login leaves the same room/items/notes; both real providers save/close/restore isolated accounts.
- New account autosave sends no progress writes until opt-in; guest/new-run adoption has an explicit load/replace/cancel choice.
- Two independent sessions race the same revision; exactly one new write succeeds. Retry a lost successful response with the same bytes/key; no second revision. Also test replay after another device advances or a deployment rejects the old payload for new writes; the retained receipt must still acknowledge it. Test a concurrent receipt appearing during validation.
- Retry and E03 Continue restore preparation/inventory, preserve new clues/notes/hint history and stale prior readings. Restore Save loads its own snapshot.
- Cancel logout leaves everything unchanged; confirm clears memory/title and preserves the slot without saving. Exercise session revocation/save races and uncertain network responses.
- Supported migration preserves learning/recruits/achievements; unsupported newer data stays intact. Account deletion survives an isolated backup restore. Lose the DELETE response and verify pending/completed through its receipt after session revocation; guest status and unknown/expired receipt never prove deletion, and status checking cannot perform another deletion.
- Complete copper/fiber/radio, optional activities and all outcomes. Check real Safari, keyboard/text, 200% zoom, 390/768px actions, reduced motion, missing media/WebGL/audio/network and recorded performance.
- Reopen sources, compare exports, listen to audio, obtain beginner/technical/owner reviews and build from a clean public checkout.

Follow the task execution table across story sections. At G6 run the checks whose dependencies exist and leave G7 packaging/recovery/staging/publication checks pending; reconcile the complete AC01–21 matrix only after those operations. Keep AC01–21 and SAVE01–13 results tied to exact artifacts and conditions. Do not claim a human or provider check passed when only fixtures ran. Deployment and next-episode work remain later owner-initiated stages.
