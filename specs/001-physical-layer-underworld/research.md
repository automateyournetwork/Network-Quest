# Research: Spec001 implementation decisions

**Date**: 2026-11-25. Inputs: [PLAN.md](../../PLAN.md), [spec.md](spec.md), [constitution](../../.specify/memory/constitution.md). Browser, identity/persistence and media research ran in parallel. Research selected designs; no packages were installed, providers registered, host accessed, assets generated or runtime gates passed.

## R01 — Build/runtime baseline

**Decision:** Node 26 LTS; candidate exact client versions TypeScript 7.0.2, Vite 8.3.8, Three.js/@types 0.187.0, Vitest 5.1.2, Playwright 1.65.1 and axe-core/Playwright 4.14.1. Freeze working exact locks at G0. PHP 8.4 on a current supported patch, verified separately for web and CLI.

**Rationale:** Published package/runtime constraints support this baseline. Read-only local inspection found Node 25.3.0/npm 11.7.0; Node 25 is not the planned supported toolchain. Vite 8 uses Rolldown/Oxc; type checking remains a separate command. PHP host version is not established by historical analytics documentation.

**Alternatives:** Node 24 LTS if measured tooling incompatibility warrants it; a supported available PHP minor with an explicit compatibility update. Do not retain EOL Node merely because installed. Sources: [Node releases](https://nodejs.org/en/about/previous-releases), [Node downloads](https://nodejs.org/en/download), [Vite metadata](https://registry.npmjs.org/vite/8.3.8), [TypeScript metadata](https://registry.npmjs.org/typescript/7.0.2), [Three metadata](https://registry.npmjs.org/three/0.187.0), [Three types](https://registry.npmjs.org/@types%2Fthree/0.187.0), [Vitest metadata](https://registry.npmjs.org/vitest/5.1.2), [Playwright metadata](https://registry.npmjs.org/@playwright%2Ftest/1.65.1), [axe integration metadata](https://registry.npmjs.org/@axe-core%2Fplaywright/4.14.1), [Vite features](https://vite.dev/guide/features), [PHP support](https://www.php.net/supported-versions.php).

## R02 — Rendering, access and resource lifetime

**Decision:** Semantic DOM controls and pure state first; Three.js WebGL2 for applicable scenes, layered images and sprites through shared adapters. WebGL failure keeps the text interaction view playable. Explicit nested base paths; GLB/glTF 2 with PNG/JPEG baseline. Introduce compressed textures/meshes only after measured improvement including decoder cost.

**Rationale:** Rendering must not own progress. Dispose room geometry, materials, textures, render targets, mixers, ImageBitmaps and audio buffers; reference-count shared resources. Texture residency is an estimate, not exact GPU memory. Vite syntax targets are separate from the actual supported-browser matrix.

**Alternatives:** WebGPU-first or WebGL1 legacy paths add unnecessary compatibility work. A canvas-only UI fails keyboard/text requirements. Sources: [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [disposal](https://threejs.org/manual/pages/how-to-dispose-of-objects.html), [cleanup](https://threejs.org/manual/pages/cleanup.html), [glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [Vite build](https://vite.dev/guide/build), [semantic accessibility practice](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/).

## R03 — Browser/audio verification

**Decision:** Playwright for Chromium/Firefox/WebKit and axe for automated checks; actual released Safari plus manual keyboard/assistive checks remain mandatory. Pin exact tested current/previous browser majors at release. Prerecorded MP3 browser audio baseline, WAV/FLAC masters; verify actual decode/loops and gesture activation, with quiet-mode recovery.

**Rationale:** WebKit automation is not proof of released Safari behavior; responsive layout is not real mobile performance evidence. Automated accessibility does not certify all user experiences.

**Alternatives:** Testing one browser or relying solely on automated scans cannot satisfy AC14/15. Sources: [Playwright browsers](https://playwright.dev/docs/browsers), [accessibility testing](https://playwright.dev/docs/accessibility-testing), [audio codecs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs), [autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [keyboard criterion](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html).

## R04 — Identity dependencies and minimum access

**Decision:** google/apiclient ^2.20 (researched 2.20.1) for Google OIDC; league/oauth2-client ^2.10 (2.10.0) GenericProvider for GitHub, explicit empty scopes and authenticated /user only. Google requests openid profile for optional display name, never email/offline/API scopes. Store provider + stable subject; never email-merge. Discard tokens after identity verification.

**Rationale:** Dependencies have compatible published PHP/HTTP-client constraints, still requiring actual Composer resolution. Default league/oauth2-github requests user:email and can query /user/emails; avoid that behavior.

**Alternatives:** Generic Google OAuth transport without ID-token verification is insufficient; broader GitHub access has no game requirement. Sources: [Google client release](https://github.com/googleapis/google-api-php-client/releases/tag/v2.20.1), [League release](https://github.com/thephpleague/oauth2-client/releases/tag/2.10.0), [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [GitHub user endpoint](https://docs.github.com/en/rest/users/users#get-the-authenticated-user), [GitHub provider source](https://raw.githubusercontent.com/thephpleague/oauth2-github/master/src/Provider/Github.php).

## R05 — Auth transaction and logout

**Decision:** Authorization code with S256 PKCE for both providers, single-use session-bound state, Google nonce, fixed registered HTTPS callbacks. Google verification must require typed iss/aud/sub/exp/iat/nonce, own single audience, valid issuer/signature/expiry and constant-time nonce equality; a library returning decoded claims is not enough.

**Rationale:** Current GitHub OAuth documentation supports S256. Inspected Google verifier checks audience conditionally on its presence and does not check our nonce. Application validation must fill those gaps. The game tab retains memory during a separate provider window/tab; postMessage is only an origin/source-checked wakeup to GET session.

**Alternatives:** Full-page redirect loses guest memory; browser tokens expand exposure. Logout revokes session and pending auth transactions, preventing an old callback from signing the player back in. Confirmed logout does not save; failed revocation is not reported as success. Sources: [GitHub flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [League PKCE](https://oauth2-client.thephpleague.com/usage/), [Google client](https://raw.githubusercontent.com/googleapis/google-api-php-client/v2.20.1/src/Client.php), [Google verifier](https://raw.githubusercontent.com/googleapis/google-api-php-client/v2.20.1/src/AccessToken/Verify.php), [PHP session security](https://www.php.net/manual/en/session.security.ini.php).

## R06 — Atomic one-slot persistence

**Decision:** Conditional PUT, If-None-Match:* for empty creation or strong If-Match for replacement, idempotency key scoped to account and exact request fingerprint. Inside BEGIN IMMEDIATE, recheck session, look up successful receipt **before** testing the slot revision, then conditionally write slot/revision/receipt atomically. Resolve retained receipts before current schema/content/safe-state validation too. If validation runs outside the write lock, hold its error until a final transaction rechecks a concurrently committed receipt.

**Rationale:** A committed request whose response is lost still carries the old precondition and may carry a payload no longer accepted for new writes after an upgrade. Receipt-first replay proves its original revision without another write. If another device has since advanced the slot, expose that current revision separately and reconcile before autosave. Receipts store acknowledgement metadata, not another progress snapshot.

**Alternatives:** Last-writer-wins loses progress; revision-before-receipt breaks retries. HTTP preconditions establish concurrency semantics; precise ordering is this project's design. Sources: [HTTP If-Match](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match), [SQLite transactions](https://www.sqlite.org/lang_transaction.html), [PDO transaction behavior](https://www.php.net/manual/en/pdo.begintransaction.php).

## R07 — SQLite, backup and deletion

**Decision:** Rollback journal DELETE, foreign_keys=ON, synchronous=FULL and bounded busy timeout. Benchmark 20 mixed sessions on the actual host. WAL requires proven local locking plus patched SQLite: upstream documents the WAL-reset bug fixed in 3.51.3 or specific backports 3.44.6/3.50.7. Use database-aware consistent backup, never blind live-file copying.

**Rationale:** The existing host is mandatory but current capability unknown. A deletion ledger outside the database rollback set must survive restores and suppress deleted accounts before reopening service. Backup policy and operational defaults are in delivery.md; actual host-wide retention must be disclosed separately.

**Alternatives:** Same-host MySQL/InnoDB if available and validated after SQLite failure; no silent hosting move. Sources: [SQLite WAL](https://www.sqlite.org/wal.html), [backup API](https://www.sqlite.org/backup.html), [VACUUM INTO](https://www.sqlite.org/lang_vacuum.html), [GoDaddy PHP selection](https://www.godaddy.com/help/view-or-change-the-php-version-for-my-web-hosting-cpanel-16090), [modules](https://www.godaddy.com/help/enable-custom-php-modules-12036), [cron](https://www.godaddy.com/en-ph/help/create-cron-jobs-16086).

## R08 — Shared data validation and tests

**Decision:** JSON Schema Draft 2020-12, Ajv 8 using its 2020 class and pinned ajv-formats with bounded UUID/date/URI inputs, PHP Opis ^2.6 (observed 2.6.2). Disable runtime remote schema retrieval. PHPUnit ^12.5 fits PHP 8.4. Share positive/negative conformance fixtures across runtimes, with semantic checks beyond schema.

**Rationale:** Server cannot trust TypeScript types or client UI. Reject unknown fields, unbounded arrays, malformed Unicode, unknown IDs, unsafe states and unsupported versions. Keep fixtures independent from production evaluators.

**Alternatives:** Handwritten duplicated shape validators risk drift; a schema alone cannot establish gameplay safety. Sources: [Ajv 2020-12](https://ajv.js.org/json-schema.html#draft-2020-12), [format plugin requirements](https://ajv.js.org/guide/formats.html), [Opis 2.6.2](https://github.com/opis/json-schema/releases), [Opis README](https://raw.githubusercontent.com/opis/json-schema/2.6.2/README.md), [PHPUnit requirements](https://docs.phpunit.de/en/12.5/installation.html).

## R09 — Teaching models and source limits

**Decision:** Retain exact source T01–T16 expectations, units and fictional thresholds. Author fixtures before evaluators. Every production profile needs a reviewed exact source section/datasheet and independent correct/incorrect/boundary cases before scoring players.

**Rationale:** The reference register establishes source families, not verified limits for every optical/copper/radio profile. The highlighted payload is 0x4E 0x51, not a complete two-byte Ethernet frame. Toy symbol and known-pattern comparison must remain labeled.

**Alternatives:** Invented universal limits or seven independent mandatory wire headers misteach the lesson. Sources: [X.200 listing](https://www.itu.int/rec/T-REC-X.200/en), [IEEE 802.3 source index](https://www.ieee802.org/3/), [RFC 1122 architecture](https://www.rfc-editor.org/rfc/rfc1122.html#section-1.1.3). Profile-specific source verification remains G0/G4 work.

## R10 — Blender and generated imagery

**Decision:** Real editable .blend plus GLB/render/sprite exports, matching cameras/units/pivots/collision/animation naming. Use actual OpenAI image generation and keep original outputs, prompts, references, known settings and derivatives. Never invent unavailable seeds/model/tool metadata.

**Rationale:** Read-only local metadata: macOS 26.6.2 arm64, Blender 5.2.1. Select a tested 5.2 LTS patch at G0; official listing advertised 5.2.5 dated November 24, but direct page access was limited, so recheck before adoption. Reopen/render/browser comparison proves source/export usability.

**Alternatives:** Modeling scripts without saved sources, CSS substitutes for generated output or image crops counted as new invocations fail provenance. Sources: [Blender LTS](https://www.blender.org/download/lts/), [Khronos Blender exporter](https://github.com/KhronosGroup/glTF-Blender-IO), [glTF specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html). Actual account/tool output terms are reviewed at G0; no blanket output-rights clearance is claimed.

## R11 — Audacity version correction

**Decision:** Installed /Applications/Audacity 4.app reports 4.0.0 build 262451605. Plan native .aup4 for Audacity 4, lossless masters and browser exports; test 4.0.2 before bulk work because release notes identify corruption/export fixes.

**Rationale:** Audacity 4 cannot save back to .aup3 and removed mod-script-pipe, Macro Manager and MIDI note tracks. Keep MIDI/synthesis sources in an explicitly selected external workflow and mix rendered audio in Audacity.

**Alternatives:** Isolated tested 3.x/.aup3 only if a necessary automation capability justifies it. Do not promise old scripting support on the installed major. Sources: [4.0.0 changes](https://www.audacityteam.org/changelog/4.0.0/), [4.0.2 changes](https://www.audacityteam.org/changelog/4.0.2/), [native project guide](https://www.audacityteam.org/manual/getting-started/save-your-project/), [exports](https://www.audacityteam.org/manual/getting-started/export-your-audio/).

## R12 — Local voice/music candidates

**Decision:** Kokoro-82M first voice audition; ACE-Step 1.5 first music audition, explicitly updating the root plan's original v1 candidate. 1.5 documents Apple Silicon MLX and MPS/CPU options with Python 3.11–3.12 and MIT code/model; original v1-3.5B remains an Apache-2.0 alternative. Keep exact model/voice/component hashes, input/output terms and actual runtime/listening evidence.

**Rationale:** Kokoro upstream package/model identify Apache-2.0; selected voice provenance and dependencies need separate inventory. Misaki is Apache-2.0; eSpeak-NG is GPLv3 tooling, not automatically distributed game code. GPU benchmark claims do not establish this Mac's speed/memory. No audition or model install occurred.

**Alternatives:** Another documented local voice, or v1 music after equivalent review; no silent paid cloud substitution or unverified cloned voice. Preserve original scripts, technical pronunciation, raw generation, actual stems if supplied, project/master/export lineage. Sources: [Kokoro](https://github.com/hexgrad/kokoro), [model](https://huggingface.co/hexgrad/Kokoro-82M), [voices](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md), [Misaki license](https://github.com/hexgrad/misaki/blob/main/LICENSE), [eSpeak license](https://github.com/espeak-ng/espeak-ng/blob/master/COPYING), [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5), [1.5 model](https://huggingface.co/ACE-Step/Ace-Step1.5), [original v1 model](https://huggingface.co/ACE-Step/ACE-Step-v1-3.5B).

## R13 — Operational policy choices

**Decision:** Initial planning defaults: session idle 2 hours/absolute 24 hours; auth transaction 10 minutes; deletion requires same-account provider authentication within 5 minutes; successful write receipts 7 days; metadata-only logs 7 days; daily consistent encrypted backups retained 7 days, initial recovery-point target 24 hours and recovery-time target 24 hours.

**Rationale:** These resolve planning-stage operational ambiguity without collecting extra player data or assuming new paid infrastructure. They are engineering policies, not user clarification answers, tested service guarantees or proof of host-managed retention. Verify reliable scheduling, key/recovery storage and actual provider backup windows at G0. Planned deployment rollback must preserve all acknowledged saves, independent of disaster-recovery targets.

**Alternatives:** More frequent backups if measured capacity allows; different documented policies if host evidence requires them. Never silently promise shorter deletion retention than the longest real backup window.

## Initial planning verification record

This records the original planning run. The subsequent authorized remediation expands the API to nine operations and supersedes its operation/reference counts; see [analysis-remediation.md](checklists/analysis-remediation.md).

Completed 2026-11-25: **26 planning checks passed**, using Python jsonschema Draft202012Validator with FormatChecker, YAML parsing with duplicate-key rejection and explicit document/reference assertions.

- Both JSON Schemas pass their metaschema checks. The minimal saved example and retained-stale-measurement structure validate. Negative cases reject client account fields, unsupported writable schema, unsafe shutdown/Continue, excessive or duplicate allies, unqualified IDs, invalid quantity/revision/UUID and oversize notes. Unicode notes pass at 4,096 characters and fail above it.
- A truthful planned asset record validates; a planned record cannot count toward quotas and an unsupported accepted asset fails. Hash/rights/source/render/listening facts still require real production evidence.
- The API has eight operations across seven paths, unique operation IDs, required path parameters and 62 resolved local references. Its component schemas pass metaschema checks. This is structural/reference validation, **not** a full OpenAPI conformance certification or PHP endpoint test.
- All 23 local links in the six planning prose documents resolve; FR-001–026 are covered; SAVE01–13 and W01–W09/G0–G7 remain represented. No unresolved template markers remain.
- The prescribed update-agent-context.sh codex completed. Generated generic paths/commands were corrected to match this plan and to state that application commands do not yet exist.
- Planning-only boundaries hold: no tasks.md, package.json, server/composer.json, application implementation or media production was created. Git whitespace validation also passed. Changes remain uncommitted; optional commit hooks are disabled in local configuration.

No application tests, real provider/host checks, performance measurements, human reviews or runtime acceptance gates were run by this planning workflow. Next: /speckit.tasks.

## R14 — Reliable deletion confirmation

**Decision:** Add POST /account/deletion-status, authorized only by an operation-specific 256-bit random receipt and exact Origin. The client supplies the receipt on confirmed DELETE and retains it in memory. The server stores only its hash/24-hour expiry and opaque deletion-ledger binding. Return pending/completed plus expiry, never account/progress data; unknown/expired status stays unconfirmed. Only a durable completed marker after live-row/session removal proves completion.

**Rationale:** A revoked or expired session can produce the same guest response as successful deletion. An operation-specific receipt can confirm the result after session revocation without granting account access or repeating deletion. Crash recovery updates the same durable ledger; receipt metadata stays outside the game database rollback set.

**Alternatives:** Treating guest status as deletion success is insufficient. Automatically signing in to check can create a new account; automatically retrying DELETE can affect the wrong current session. Neither is allowed. This is an engineering design correction authorized by the owner, not a new interview answer. Runtime proof remains assigned to T045–T056.
