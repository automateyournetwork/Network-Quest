# Network Quest — Spec001 Build Plan

Version 0.1 · Kickoff plan 2026-11-24 · Implementation initiated 2026-11-25

Copyright 2026 John Capobianco. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). SPDX-License-Identifier: CC-BY-4.0.

Read the [current constitution](.specify/memory/constitution.md) and [SPEC.md](SPEC.md) first; [CONSTITUTION.md](CONSTITUTION.md) preserves the original decisions. This plan delivers Spec001 before work advances to Specs002–007. The original 2026-11-24 kickoff delivered three Markdown files; the 2026-11-25 Spec Kit setup adds governance and templates. All game source paths, scripts, commands, services, tests, and assets proposed below are future deliverables unless expressly listed as observed evidence.

The detailed implementation plan is now [specs/001-physical-layer-underworld/plan.md](specs/001-physical-layer-underworld/plan.md), with [research decisions](specs/001-physical-layer-underworld/research.md), data/API contracts and a planned quickstart. It preserves this build contract and both accepted clarifications. The [implementation handoff](docs/implementation/HANDOFF.md) records current execution and scoped results. G0 remains blocked; G1–G7 remain pending.

Owner continuation on 2026-11-25 explicitly authorizes scoped reviewed GitHub commits/pushes and deployment/arcade listing of the finished accepted release after required owner reviews and acceptance checks. GitHub publication and GoDaddy activation are separate operations; no repeated generic permission is needed once those conditions are met. Preserve existing work and use current private operator practices, never an old manifest.

## Starting evidence (kickoff observations)

- The separate public Network-Quest repository exists; the website repository is closed source and remains independent.
- Read-only inspection of the website workspace found 28 arcade entries, an Astro/Three.js integration, and PC Globe exploration/audio work.
- Existing server documentation describes a production PHP/PDO SQLite analytics service. This is evidence that PHP and SQLite have been used on the host, not a current game-capacity or authentication readiness check.
- Blender 5.2.1 LTS is installed on the owner's Mac; Audacity is also installed. No character, room, soundtrack, or voice audition has been produced for Network Quest.
- Workshop [CONSTITUTION.md](https://github.com/automateyournetwork/NAF_AC6/blob/main/WORKSHOP/LAB/StarterKit/CONSTITUTION.md), [SPEC.md](https://github.com/automateyournetwork/NAF_AC6/blob/main/WORKSHOP/LAB/StarterKit/SPEC.md), and [PLAN.md](https://github.com/automateyournetwork/NAF_AC6/blob/main/WORKSHOP/LAB/StarterKit/PLAN.md) informed the method. Their short-session, no-account, no-backend defaults are intentionally replaced by this project's interview decisions.

## Architectural direction

Use an independently buildable browser client with TypeScript, Vite, semantic HTML controls, and Three.js for the 3D portions. Treat pre-rendered imagery, sprites, and real-time assets as alternate room presentation modes over one interaction and state system. Author game content as validated data and keep deterministic networking rules separate from presentation.

Serve the client as static files under a dedicated arcade game path. Use a small PHP backend on the existing GoDaddy host for Google/GitHub authentication and the single account save. Target a PHP minor that is security-supported at implementation time, subject to the host audit. Start with a dedicated PDO SQLite database outside the public document root; validate locking, backup, and expected concurrency before adopting it for production. A host limitation must produce a documented same-host alternative, not an unannounced hosting migration.

Do not introduce a live LLM into gameplay, a paid per-player model dependency, a Node production server, or a copy of the closed website. AI image/music/TTS work happens during asset production. The shipped game consumes reviewed files.

## Build order

| Gate | Work package | Required exit evidence |
| --- | --- | --- |
| G0 | Verify host, sources, providers, and creative pipeline | Feasibility findings; no fabricated capability claims |
| G1 | Prove one room and one physical diagnostic | Playable graybox, four verbs, notebook, independently checked rule |
| G2 | Prove saving and the authored world structure | Guest-to-account transition, single-slot save/restore, room graph |
| G3 | Produce a representative finished room | Blender and image-generation sources, animation, sound/voice audition, browser comparison |
| G4 | Build all Spec001 gameplay | All rooms, routes, recruits, notebook, compendium, side quests, outcomes |
| G5 | Complete and integrate the media library | Required distinct assets; sources, credits, actual in-game use |
| G6 | Test the whole episode and refine | Independent content cases, playthroughs, save migrations, usability/performance/security checks |
| G7 | Package and release the episode | Reproducible standalone build, owner satisfaction, integration and recovery evidence |

Gates describe evidence needed to proceed; they are not dates. Rework any failed gate. A finished representative room does not waive the asset quantities for the final episode.

## Work packages and episode sequencing

| Package | Gate | Concrete build deliverable |
| --- | --- | --- |
| W01 | G0 | Host capability report, dependency/license inventory, OAuth registration checklist, creative-tool smoke checks |
| W02 | G1 | Independent client shell; accessible verb controls; one R01/R02 graybox; pure physical-rule evaluator |
| W03 | G2 | Content schema and graph validation; notebook/inventory/compendium state; PHP auth and one-slot persistence |
| W04 | G3 | One final-art sample room with matching Blender, generated-image, animation, music/effect and voice sources |
| W05 | G4 | Copper, fiber and radio branches; market and Clockworks; all twelve playable rooms |
| W06 | G4 | Team abilities, side quests/minigames, Rift encounter, all ending conditions and replay paths |
| W07 | G5 | Complete asset library, production manifests, credits and optimized exports |
| W08 | G6 | Full route/save/content/accessibility/performance checks and recorded owner review |
| W09 | G7 | Standalone release archive, same-host integration, backup/rollback and production verification |

Before W05, prove a complete route using simple temporary development geometry. It must exercise state and teaching; temporary geometry does not satisfy final asset acceptance. Develop content and presentation through the same engine, not a custom implementation per room.

Include the R01/R12 packet-perspective sequences in W02/W06. Share the domain state with the apprentice view; neither cutscene scripting nor an independent animation may fabricate a successful repair. Compare the declared payload/bit mapping independently and retain keyboard step/replay controls. AC21 verifies the physical simulation and truthful upper-layer context.

Keep the root `SPEC.md` as Spec001. When the owner starts the next realm, add its dedicated specification under a future `specs/002-data-link/` directory, followed by analogous directories through `specs/007-application/`. Record affected earlier room IDs, shared-system changes, migration examples and regression cases in each new realm specification. Do not generate those six files during this kickoff. Each episode cycles through specification, clarification of genuine unknowns, implementation planning, build, validation and refinement before the next proceeds.

## Content and state design

Use one typed content registry with `schemaVersion` and stable IDs for rooms, walk edges, hotspots, dialogue, evidence, objectives, items, recruits, abilities, encounters, outcomes, assets and sources. Each objective references its prerequisite expression, learning outcome, decision inputs, accepted results, hint ladder and verification cases. Each walk edge has unlock conditions and a player-readable reason when closed. Validate all references and detect unreachable required objectives before shipping.

Keep scene presentation in a `RoomDefinition`: logical coordinate system, camera/presentation mode, walk region, collision/occlusion data, hotspot bounds, accessible names, layered imagery, 3D asset references, audio cues, and entry/exit rules. Camera and hotspots share coordinates; background changes must not move an interaction away from what the player sees. Every room mode implements the same select/inspect/act contract.

Separate immutable definitions from `GameState`: current safe room/location, completed objectives, inventory, recruited/active allies, notebook facts/notes, dialogue flags, route consequences, assistance records and ending history. Runtime-only animation, pointer position, open menus and pending network requests are not save data. Versioned settings include audio, reduced motion, text size and autosave choice.

Use explicit transitions: `loading → introduction/exploring → dialogue/inspection/planning → resolving → feedback → exploring/outcome`. Loading, malformed content and unsupported save versions have distinct recovery screens. The reducer validates allowed actions; replayed inputs cannot double-grant items or complete an objective twice. Evaluate networking decisions as pure functions returning status, reason, observations and accepted-result evidence; then apply effects through the reducer.

At G2, implement deterministic replay of recorded decisions for test fixtures, a content graph check, and safe encounter preparation snapshots kept in memory. In-session retry and E03 Continue restore encounter and inventory state from preparation while preserving new notebook clues, personal notes and hint-use history; mark measurements from the prior attempt stale. Keep this retention separate from Restore Save, which loads the confirmed saved adventure, and persist retained information only through the existing safe save rules. The public client is inspectable and a single-player save is not a trusted certification record. The backend still validates ownership, schemas, sizes and accepted field types; it does not execute uploaded code or arbitrary rules.

### Owner-reviewed game-screen correction — 2026-11-26

T066's first real-media room received positive visual feedback, with a required
interface correction: replace the document-style stack below the scene with one
contained adventure frame. Keep existing semantic controllers and captured intents;
compose compact in-frame verbs/inventory plus contextual panels for text, evidence,
notebook, dialogue, game/account controls and sound. Preserve keyboard navigation,
Escape/focus restoration, text mode and scalable readable panels. Do not reduce
content, remove actions or change save/domain behavior to achieve the layout.
Verify ordinary desktop play has no controls below the game frame; inspect actual
1280×720/1440×900 and narrow/200% views, relevant persistence flows and accessibility.
Preserve the previous T066/T067 measurements as historical candidate evidence,
then freeze and review the corrected room before repeating affected benchmarks.
No media assets or episode quantities change, and final owner acceptance remains
pending. The correction is tracked in the existing T066 work, with a fresh worker
loop and root review; T067 retains performance/owner evidence ownership.

## Rule implementation and evidence

Implement small evaluators for profile compatibility, copper continuity/length, optical receive range and margin, radio scenario checks, delivered-power allocation, common capabilities and toy-symbol decoding. Domain inputs carry units and provenance. Keep profile selection separate from arithmetic: a valid power budget does not override an incompatible optic. Measurements include a topology/configuration revision so changes invalidate stale evidence.

Use `evaluate(challenge, action) → {status, reasonCode, observations, acceptedEffects}` with statuses `correct`, `incorrect`, `invalid-input`, and `content-error`. Empty input does not count as an incorrect engineering decision. Unsupported source content blocks the affected challenge with a readable error. Each valid alternative returns its own explanation.

Write T01–T16 expected values directly from SPEC.md into independent fixtures before writing the evaluator. Do not derive expected values by calling the implementation. Add fixture cases for empty selections, boundaries, opposite directions where relevant, ambiguous matches, repeated actions and interrupted transitions. The optical fixture uses dBm for levels and dB for differences; preserve those units in text and diagnostics.

G0 records title, URL, section, publication/retrieval date, applicable profile and supported claim for each teaching rule. G1 proves one correct, incorrect and boundary case in a browser. G4 requires every mandatory objective to reference a reviewed rule and independent case. G6 adds transfer cases and a beginner playthrough; it does not infer learning from a screenshot or a passing program test alone.

## Asset production on the Mac

Planning research on 2026-11-25 selects ACE-Step 1.5 (MIT code/model) as the first local music audition candidate; the original Apache-2.0 v1 candidate below remains an alternative. Audacity 4 uses .aup4 and lacks the older scripting pipe/MIDI tracks. See the feature research for tested-version gates, independent MIDI/source handling and precise component/output license review; no audition has yet passed.

1. **Art benchmark:** establish apprentice/Photon/Titan sheets, the Workshop keyframe, one copper scene and one fiber scene. Check silhouette, lighting, scale, UI readability and camera consistency before multiplying assets.
2. **Blender sources:** create actual `.blend` scenes and reusable asset files. Use named collections, consistent units/orientation, applied export transforms where appropriate, meaningful pivots, material slots, collision proxies and animation names. Reopen sources in Blender and render a contact sheet. Save modeling scripts when used.
3. **Runtime exports:** export GLB characters/props and selected scenes; export sprite sheets and room renders where that mode suits the scene. Validate meshes, rigs, animation clips, materials and texture references in the actual browser. Complex Blender node effects may require baking or a deliberate runtime equivalent; an export button is not proof of visual parity. Use [Khronos glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) as the interchange reference.
4. **Real generated imagery:** use the available OpenAI image-generation tool for each requested image or variant. Prompt with room/character ID, camera, palette, subject placement, layers, transparency and interaction clearances. Inspect actual outputs. Preserve original generated files, prompts and accepted edits; copy project assets into the repository's future asset tree. Use the built-in tool by default; do not substitute CSS gradients or fabricated image-generation records.
5. **Compositing:** align Blender cameras with image plates, create foreground occluders and depth masks, and test player walk regions and hotspot placement. Make reduced-motion and low-detail variants without hiding evidence. Keep source layers and document which changes are manual, generated or rendered.
6. **Music/effects:** audition an original AI-assisted theme on the Mac, then develop the eight cues. [ACE-Step](https://github.com/ace-step/ACE-Step) and its [Apache-labeled model card](https://huggingface.co/ACE-Step/ACE-Step-v1-3.5B) are candidates for a local generation experiment, not a claim of proven Mac performance. Verify model/dependency/output terms and run-time/memory requirements first. Keep original composition/MIDI/synthesis as a documented complementary method. Edit and mix in [Audacity](https://www.audacityteam.org/); preserve projects and lossless masters. Do not install or purchase a cloud generation service silently if a local audition fails.
7. **Voice:** audition [Kokoro](https://github.com/hexgrad/kokoro) with its [model/voice documentation](https://huggingface.co/hexgrad/Kokoro-82M) as the first free/local TTS candidate. Check the selected voice and dependency licenses, runtime on this Mac, pronunciation, pacing and noise. Produce short narrator/Photon/Titan/Hermit samples before rendering the 60 lines. Keep exact scripts, pronunciation overrides and voice/model versions.
8. **Delivery and verification:** normalize web playback levels, preserve loop boundaries, encode browser-compatible alternatives, and listen on headphones and ordinary speakers. Pause/mute correctly on focus loss and scene changes. Scan the inventory for source/export/runtime-reference/attribution gaps. A human audition is required before claiming voice or mix quality acceptance.

Future asset manifest fields: `assetId`, kind, semantic identity, source paths, runtime paths, source hash, tool/version, generation prompt/reference where applicable, license/credit, dimensions or mesh/texture budgets, animation names, used-by room IDs and verification status. File checks can prove existence and structure; visual and audible checks establish quality. Record an unavailable tool capability honestly and resolve it before the affected gate passes.

Large editable sources may use Git LFS or versioned public release archives after checking repository/storage limits. Keep the lightweight manifest in Git, with content hashes and a reproducible retrieval command. A contributor must be able to obtain every required licensed source without the closed website or a private generation session.

## PHP identity and save service

Proposed base path: `/arcade/play/network-quest/api/v1`. Keep it configurable for independent deployments. A server router maps only the game's API namespace; the client never connects directly to a database. Use prepared queries, transactions and a reviewed OAuth/OIDC library, pinned in the eventual dependency lock. Do not hand-roll token signature validation.

Google uses its documented [OpenID Connect flow](https://developers.google.com/identity/openid-connect/openid-connect); verify signature, issuer, audience, expiry and nonce. GitHub uses its [authorization-code flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) and a server-side identity lookup; it is not treated as a Google-style ID-token provider. Bind single-use state to the initiating browser session, use PKCE where supported, allowlist callback/return paths and reject replay. Keep provider tokens and client secrets off the client and out of logs; discard tokens when no longer needed for identity.

Issue a host-only Secure, HttpOnly, SameSite=Lax game session cookie named `__Secure-nq_session`, scoped to the game path. Rotate it at login and invalidate it at logout/deletion. A cookie path organizes the application; it is not a separate security origin from the rest of the website. Protect mutations with server-session CSRF tokens and origin checks. Apply payload and rate limits; escape all displayed user text. Request minimal profile/identity scope and no repository permissions. Identify users with `(provider, subject)`, not display names or email matching.

Keep the gameplay document open while a user-initiated provider window/tab completes authentication. Reserve the window synchronously on the click, then initiate the server flow. If blocked, show a clickable separate-tab fallback. On completion/focus return, fetch `/session`; do not trust a client message as proof of identity. If `postMessage` is used as a wake-up signal, validate origin/source and include no credentials. Cancellation leaves guest memory unchanged. Use local HTTPS or a dedicated staging origin for real Secure-cookie tests instead of weakening production cookie settings.

| Method / endpoint | Contract |
| --- | --- |
| GET `/session` | Return authenticated/guest status, provider/display label, CSRF token, save summary and preferences; no provider tokens |
| POST `/auth/{provider}/start` | CSRF-checked initiation; create state/nonce/PKCE as applicable; return an allowlisted provider redirect |
| GET `/auth/{provider}/callback` | Validate one-use provider response; create/rotate session; complete in the sign-in window/tab |
| POST `/logout` | Invalidate session; preserve saved adventure. The client warns about unsaved progress and allows cancellation before logout; confirmed logout clears the in-memory adventure and returns to title without an implicit save. |
| GET `/save` | Return this account's save and ETag/revision, or an explicit empty-slot response |
| PUT `/save` | Authenticate/bound the request, resolve retained acknowledgements before current semantic policy, then validate and conditionally commit only a new operation |
| PATCH `/preferences` | Update allowlisted settings including explicit autosave choice; independent revision check |
| DELETE `/account` | Require recent same-account authentication, explicit confirmation and a random deletion receipt; durably remove live data and record completion |
| POST `/account/deletion-status` | Read pending/completed status for that narrow receipt after session revocation; expose no identity/progress and perform no deletion |

Proposed tables: `accounts`, `identities`, `sessions`, `preferences`, `saves`, `write_receipts` and schema migrations. `saves.account_id` is unique. Keep the database, session storage and backups outside the web root in a dedicated game directory. Browser requests cannot select the account ID used in SQL. Save snapshots are schema-validated data, capped initially at 256 KiB; notes have a separate 4,096-character limit. Validate every collection length and item ID against the supported content registry.

For an empty slot, require `If-None-Match: *`; for replacement, require `If-Match` with the current revision ETag. Conditional failure returns HTTP 412 and a current summary, not a silent overwrite. Authenticate and bound requests before receipt lookup. Resolve a retained matching receipt before current schema/content/safe-state policy as well as revision checks, including after a deployment changes new-write policy. Semantic validation may run outside the write lock, but its error cannot be returned until a final transaction rechecks authorization and any concurrently committed receipt. Only a still-new operation is subject to current semantic validation, autosave/adoption policy and revision comparison; then write the snapshot, advance revision once and store the receipt atomically. Bind receipts to account, request ID and a fingerprint of method, route, save mode, replacement-confirmation header, precondition and exact payload bytes. A repeated matching request returns its prior committed revision without another write; different request bytes are rejected. If another device has since advanced the slot, report that current summary separately and reconcile before autosave. The check-and-write must be atomic under simultaneous requests.

Deletion confirmation uses a client-generated 256-bit random receipt, retained only in memory and sent in a header. Keep its hash/24-hour expiry with the external deletion ledger; completed status requires committed live-data removal and session revocation. The exact-origin, receipt-authorized status POST returns only pending/completed and expiry, even after the account session ends. Unknown/expired receipts and guest session status leave deletion unconfirmed. Never log or persist the raw client receipt, automatically repeat deletion, or clear a later signed-in account from an old status result.

Use server timestamps. Return explicit 401/403/412/413/422/429/error responses as appropriate; do not include stack traces or credentials. Session expiry leaves the client's current adventure in memory. Do not keep unsynchronized browser drafts as undisclosed persistent extra slots. Service backups are operational recovery copies, not user-selectable saves.

G0 verifies the actual host PHP version/extensions, outbound HTTPS to both providers, callback routing, private writable storage, filesystem locking, SQLite concurrency, backups, quotas and error logging. G2 uses real local/staging provider callbacks or reports those checks unverified; mocked login alone cannot satisfy release acceptance. Register the exact callback paths through the owner's provider accounts during implementation; credentials are private runtime inputs, not part of this kickoff.

## Independent repository and website integration

Future structure: `src/` for engine/UI/domain rules, `content/` for rooms/quests/dialogue/source cases, `assets-src/` for editable media, `public/assets/` for optimized web exports, `server/` for the PHP service and schema migrations, `tools/` for content/asset/build validation, and `tests/` for independent cases and browser/API checks. Create the necessary files only once implementation is initiated. Add public licenses, contributor/run instructions and asset retrieval at that time.

Build the game without importing the website's Astro components, private files, analytics code or Git history. A versioned public build produces a manifest and checksummed static bundle. A small integration change in the separate website repository adds the arcade entry, screenshot, description and launch link, then serves the bundle under its dedicated path. Website-specific deployment credentials and host configuration remain outside the game repository. Inspect any candidate shared component's public release and license before reuse.

For GoDaddy deployment, stage static files and the PHP router under the dedicated game namespace; install the private runtime alongside the document root in a distinct `network-quest-data` location chosen by the host operator. Preserve the website analytics database, `.well-known` certificate paths, other games and unrelated rewrite rules. Scope changes to the game route. Back up the existing game release and obtain a consistent database backup before a migration; use a database-aware backup method, not an uncoordinated copy of a live SQLite file.

Package code and database migrations as coordinated versions. Apply additive changes where possible, verify the new client against the supported save schema, and keep the previous release recoverable. If a schema migration is not backward compatible, rollback requires the matching database recovery procedure; do not simply point the old client at the new schema. Test recovery against a staging copy. Release validation includes actual provider callbacks, both account save cycles, representative scene loads, existing arcade navigation and database isolation.

### Reference research and reuse procedure

Use the [arcade](https://automateyournetwork.com/arcade/) and [field notes](https://automateyournetwork.com/arcade/field-notes/) to identify teaching and presentation patterns. Review the [NAF AC6 workshop](https://github.com/automateyournetwork/NAF_AC6/tree/main/WORKSHOP) as the specification method. [Hello, Planet](https://github.com/automateyournetwork/hello-planet) provides the public PC Globe-inspired exploration/audio context. The earlier PC Globe work used structural inspection and independently sourced media; do not describe it as a recovered complete source tree or import private DOS materials.

For Sierra research, compare room state, verbs, dialogue, inventory, timing and failure presentation using the user-supplied historical references: [AGI interpreter](https://github.com/lanceewing/agi), [King's Quest III](https://github.com/historicalsource/kings-quest-3), [SCI16](https://github.com/OmerMor/SCI16), [SCI32](https://github.com/OmerMor/SCI32), and [decompiled SCI scripts](https://github.com/sluicebox/sci-scripts). Preserve the distinction between historical source and decompilation. No copied engine/game implementation is selected by this plan.

For each arcade candidate: inspect the exact public revision, identify the useful pattern, check code and media licenses separately, write a small original experiment or import only a verified component with notices, and record acceptance/rejection. Initial promising subjects are Firewall Security Faceoff's 3D presentation, PacketJedi's scope explanations, Network Ops: Night Shift's evidence/repair loop, TCP Kart's cause-and-effect animation, AS You Were's reasoning feedback, and Per-Hop Works' workshop structure. These are study directions, not a claim of completed code review or approved reuse.

## Arcade research inventory

Snapshot of 28 entries inspected on 2026-11-24. License text below is catalog metadata, not a fresh upstream verification. Unknown, placeholder and reserved entries require explicit resolution before any copying. No game code or assets have been copied into this kickoff.

| Game | Public source | Catalog license |
| --- | --- | --- |
| [Grid Defender](https://automateyournetwork.com/arcade/grid-defender/) | [Repository](https://github.com/FeelinRouty/Grid_Defender) | unknown |
| [NETCRASH](https://automateyournetwork.com/arcade/netcrash/) | [Repository](https://github.com/richdeprez/netcrash) | MIT |
| [Firewall Rule TypeRacer](https://automateyournetwork.com/arcade/firewall-rule-typeracer/) | [Repository](https://github.com/thelinoperez/firewall-rule-typeracer) | unknown |
| [Network Change Roulette](https://automateyournetwork.com/arcade/network-change-roulette/) | [Repository](https://github.com/CodeByDannyV/ArcadeLab-ChangeRoulette) | Apache-2.0 |
| [Signal Age](https://automateyournetwork.com/arcade/signal-age/) | [Repository](https://github.com/chadius62/signal-age) | Apache-2.0 |
| [Split Decision](https://automateyournetwork.com/arcade/split-decision/) | [Repository](https://github.com/mrjohnk/split-decision) | Apache-2.0 |
| [Subnet Sashimi](https://automateyournetwork.com/arcade/subnet-sashimi/) | [Repository](https://github.com/silas-ever/subnetting-game) | COMING SOON |
| [TCP Kart: Congestion Control](https://automateyournetwork.com/arcade/tcp-congestion-control-game/) | [Repository](https://github.com/jmizquierdo/tcp-congestion-control-game) | Apache-2.0 |
| [Uptime Survivors](https://automateyournetwork.com/arcade/uptime-survivors/) | [Repository](https://github.com/tjmohr/uptime-survivors) | LicenseRef-All-Rights-Reserved |
| [NOC Ninja — Guided NOC Patrol](https://automateyournetwork.com/arcade/noc-ninja/) | [Repository](https://github.com/shimamizu/noc-ninja-game) | Apache-2.0 |
| [Round Trip](https://automateyournetwork.com/arcade/round-trip/) | [Repository](https://github.com/slbyrnes1/round-trip) | Apache-2.0 |
| [Peering Patrol](https://automateyournetwork.com/arcade/peering-patrol/) | [Repository](https://github.com/fpessoanunes/PeeringPatrol) | unknown |
| [Permit or Pew](https://automateyournetwork.com/arcade/permit-or-pew/) | [Repository](https://github.com/pyjonathan/permit-or-pew) | Apache-2.0 |
| [AS You Were](https://automateyournetwork.com/arcade/as-you-were/) | [Repository](https://github.com/adarshanegithub/AD-NAF-network-game) | Apache-2.0 |
| [AS-PATH Of Glory](https://automateyournetwork.com/arcade/as-path-of-glory/) | [Repository](https://github.com/lilgreml1n/AS-PATH-Of-Glory) | MIT |
| [Exchange Hall](https://automateyournetwork.com/arcade/exchange-hall/) | [Repository](https://github.com/wsdoprado/loopengineering) | Apache-2.0 |
| [Firewall Security Faceoff](https://automateyournetwork.com/arcade/firewall-security-faceoff/) | [Repository](https://github.com/GTalksTech/firewall-security-game) | Apache-2.0 |
| [NetMaul: Defend the Datacenter](https://automateyournetwork.com/arcade/netmaul/) | [Repository](https://github.com/trevorpatch73/netmaul) | Apache-2.0 |
| [Network Ops: Night Shift](https://automateyournetwork.com/arcade/network-ops-night-shift/) | [Repository](https://github.com/ThisN8/my-n8work-game) | unknown |
| [Packet Dash](https://automateyournetwork.com/arcade/packet-dash/) | [Repository](https://github.com/bharadwajbb/packet-dash) | Apache-2.0 |
| [PacketJedi](https://automateyournetwork.com/arcade/packetjedi/) | [Repository](https://github.com/Seifou90/PacketJedi) | Apache-2.0 |
| [PACketMan - Networking Maze](https://automateyournetwork.com/arcade/packetman-networking-maze/) | [Repository](https://github.com/ajragusa/PACketMAN-Arcade) | Apache-2.0 |
| [Slow Ping](https://automateyournetwork.com/arcade/slow-ping/) | [Repository](https://github.com/housepbass/SlowPing) | Apache-2.0 |
| [Threat Level: Goose](https://automateyournetwork.com/arcade/threat-level-goose/) | [Repository](https://github.com/john-e-armstrong/threat-level-goose) | Apache-2.0 |
| [Throughput](https://automateyournetwork.com/arcade/throughput/) | [Repository](https://github.com/Sharanya2015/Throughput) | unknown |
| [RIBRush](https://automateyournetwork.com/arcade/ribrush/) | [Repository](https://github.com/AutomateIP/NAF_AC6) | Apache-2.0 |
| [Backbone](https://automateyournetwork.com/arcade/backbone/) | [Repository](https://github.com/E-Conners-Lab/backbone) | Apache-2.0 |
| [Per-Hop Works](https://automateyournetwork.com/arcade/per-hop-works/) | [Repository](https://github.com/automateyournetwork/NAF_AC6) | Apache-2.0 |

## Validation strategy and release evidence

| Family | Required coverage | Evidence method |
| --- | --- | --- |
| Domain | T01–T16 plus authored per-puzzle cases | Pure evaluator checks against independent expected values |
| Content | Unique/qualified IDs, references, prerequisites, valid alternatives, source records | Schema and graph checks; deliberate corrupt-content fixtures |
| State | Retry/E03 rollback with retained clues, notes and hint-use history, stale measurements, item consumption, duplicate actions, dialogue skip, route choice, outcomes | Transition tests and deterministic replay |
| Identity/save | SAVE01–13; CSRF/replay/ownership rejection; real Google and GitHub callbacks | API checks against isolated test DB and browser sessions; actual provider smoke tests |
| Gameplay | Copper/fiber/radio completion, four side quests, three minigames, E01/E02/E03 | Browser paths plus human playthrough notes |
| Accessibility | Keyboard, text scene controls, focus, captions, zoom, reduced motion, touch layout | Automated checks plus manual keyboard/assistive-technology review; state untested combinations |
| Assets | 12 rooms, 25 character sources/exports, 150 unique props, image/audio quotas and usage | Manifest audit, Blender reopening, render comparison, browser inspection and listening |
| Performance | Cold loads, worst room, scene disposal, low detail, failed assets, staging save load | Recorded device/browser/network profile and traces |
| Release | Independent checkout, versioned assets, no private data, host routing and rollback | Reproducible build; staging recovery; scoped live smoke checks when released |

At G3 choose and record a reference laptop and exact supported browser versions. Test the representative room before producing all media. Inspect draw calls, triangle counts, estimated texture residency, frame time, decode time and request waterfall; reduce export costs through sensible mesh detail, texture sizing, shared materials and scene loading. Test WebGL context loss and recovery using the semantic interaction view. Do not use an uninstrumented animation as proof of performance.

Use a temporary isolated test database for destructive API cases, never a production save store. Exercise true competing writes, not sequential calls described as concurrency. Restore a database-aware backup to a separate staging location and verify both identity ownership and save content. Define log redaction and a short operational retention policy before accounts are public; document deletion and backup expiration accurately.

For human review, recruit at least one networking beginner and one technical reviewer when available. Record task completion, observed misconceptions, requested hints, confusing hotspot choices and time spent. If people are unavailable, keep that gate visibly unverified; automated agents cannot certify human learning. The owner reviews the representative room at G3 and the complete episode at G6. Refinement addresses concrete failures and feedback, without pressure to move to Spec002.

## Instructions for the build agent

The owner initiated implementation on 2026-11-25. Follow this sequence and the explicit task dependencies. Commands and capabilities are available only when their task evidence records actual implementation.

| Step | Instruction | Evidence before proceeding |
| --- | --- | --- |
| 1 | Read the three contracts, map AC01–21 to work, and complete W01/G0. Pin supported dependencies. Verify host, provider and media prerequisites without exposing credentials. W01 may create the dependency/configuration/license/local HTTPS bootstrap necessary to test feasibility and freeze working locks. After local tool/source/bootstrap checks pass, continue independent domain/state/room implementation under the owner's instruction to stop only for urgent issues. Unresolved host/provider/listening checks block their dependent integration or media acceptance, and keep aggregate G0/G1 acceptance open. | Capability matrix separates observed, tested and unavailable items; unresolved critical capabilities remain open |
| 2 | After local prerequisites pass, expand the verified standalone Vite/TypeScript client and PHP service bootstrap and create the test harness. Implement T01/T02/T14 and one full R01/R02 interaction. | G1: valid/invalid decisions, explanatory feedback, keyboard/text controls and notebook |
| 3 | Implement content/graph validation, T01–T16, guest promotion and single-slot persistence. | G2: account ownership, conditional writes and SAVE cases demonstrated; unconfigured provider checks remain unverified |
| 4 | Finish a representative room with real Blender/generated imagery; audition music, effects and key voices. | G3: owner reviews actual media; export, browser and performance evidence meets benchmark |
| 5 | Complete one gameplay route, then the others, side activities, compendium and endings. | G4: all routes/outcomes work; authored puzzles replace temporary scaffolding |
| 6 | Produce and integrate all required media in reviewed batches. | G5: distinct assets, sources, image records and audible/visual checks satisfy AC08–10 |
| 7 | Run the G6-executable matrix rows, play the episode, fix findings and retest affected behavior; keep G7 packaging, operational recovery, staging and publication rows pending with named dependencies. | G6: all scoped criteria pass and the owner is satisfied; later release checks remain explicitly pending |
| 8 | Prepare a versioned release, stage same-host integration and test recovery; publish when the owner initiates release. | G7: provider/save/browser and unaffected arcade/analytics checks; otherwise retain prior release |

### Future command contract

Implement these commands during scaffolding and document actual verified versions/invocations in the future README. They must fail on real errors and never deploy implicitly.

| Command | Required meaning |
| --- | --- |
| `npm ci` | Install pinned client/tool dependencies from the committed lockfile |
| `composer install --working-dir=server` | Install pinned PHP dependencies; production packaging excludes development dependencies |
| `npm run dev` | Start client preview and documented API proxy; explain how to launch local PHP |
| `npm run check` | Type checking plus content/schema/graph validation |
| `npm run test:domain` | Independent domain/state fixtures including T01–T16 |
| `npm run test:api` | Account/save tests against an explicitly isolated test database |
| `npm run test:e2e` | Browser routes, keyboard paths, save flows and recovery |
| `npm run assets:verify` | Source/export/use/license/count checks; human visual/audio checks reported separately |
| `npm run build` | Standalone static client and manifest; no website source dependency |
| `npm run package:release` | Checksummed client/PHP/schema package; no secrets, databases or private media |

Use a local API proxy or staging origin to exercise the same route shape as production. Mock identity fixtures stay in tests; production rejects test-auth configuration. Freeze PHP/Node/Blender/dependency versions from actual supported tools at G0. Blender 5.2.1 is an observed starting point, not a permanent requirement for contributors.

### Build-loop instructions

For each work package: read its requirements; choose the highest-priority unmet acceptance condition; make a reviewable improvement; run meaningful checks; inspect the output; record changed files, results, failures and next action. Broaden testing when a shared contract, new failure or unresolved concern warrants it. Never mark a planned check passed. Do not move to Spec002 because a counter elapsed. Amend affected contracts when evidence changes the design.

### Known prerequisites

| Item | Current evidence | Resolution gate |
| --- | --- | --- |
| Host | Existing website documentation reports PHP/PDO SQLite | G0: current supported PHP/extensions, storage, locking, outbound HTTPS, quotas |
| OAuth | Official provider flows researched; no game registrations created | G0/G2: register both, supply secrets privately and demonstrate actual callbacks |
| Audio | Audacity installed; ACE-Step/Kokoro are candidates | G0/G3: Mac runtime/quality/terms check and actual auditions |
| Devices | Browser/arcade delivery confirmed; tiers not selected | G3/G6: record desktop baseline results; avoid untested mobile claims |
| Assets | Pipeline/inventory defined; no game media created | G3/G5: generate, model, license, inspect and publish sources/exports |
| Human review | Requirements specified, no playtesting performed | G3/G6: owner, beginner and technical reviews with actual findings |

## Kickoff handoff

The three planning documents were the entire original kickoff release; the current constitution and Spec Kit templates now govern subsequent work. Their ten review passes each checked decisions, progression, learning rules, media, persistence, distribution, accessibility, execution and final consistency. Document validation covers Markdown structure, relative links, IDs, asset arithmetic, graph connectivity, explicit unknowns and the file boundary. It does not claim that any future gameplay, authentication, media or deployment check has passed.

Suggested next instruction when the owner is ready: “Start Network Quest Spec001 at G0 using .specify/memory/constitution.md, SPEC.md and PLAN.md. Verify prerequisites, then implement through the current evidence gate. Keep the public game independent of the website, preserve the asset scope and single-save contract, and show actual results before advancing.”

No generated art, Blender assets, audio, game source, deployment, provider registrations or player database are created by this kickoff. Implementation can create the future files described here when the owner starts that work. Preserve this distinction in the repository's first commit and final handoff.

## Refinement record

Each pass improves this future build contract. No entry means that a proposed application test has already passed.

| Pass | Assessment and improvement | Verification |
| --- | --- | --- |
| P01 | Established evidence, standalone client/same-host backend direction, and ordered evidence gates | Observed tools are separated from unbuilt deliverables; website source is not a dependency |
| P02 | Expanded gates into nine work packages and a seven-spec episode workflow | Every package has a gate; later specs explicitly include earlier-room regression work |
| P03 | Defined content/state separation, shared room contract and idempotent transitions | Objectives, evidence and presentation have separate responsibilities; ephemeral encounter retries do not create account slots |
| P04 | Specified pure evaluators, unit-aware inputs, source records and independent expectations | T01–T16 map to domain behavior; no evaluator-generated answer key is permitted |
| P05 | Defined Mac Blender/export/compositing and real image/music/TTS workflows | Installed tools distinguished from unauditioned candidates; manifest covers sources, rights, outputs and actual use |
| P06 | Added provider-specific flows, scoped session service, conditional/idempotent saves and private database contract | API maps to SAVE01–12; one unique account slot and atomic revision checks are explicit |
| P07 | Defined standalone packaging, same-host integration, coordinated rollback and source-reuse review | Only public inputs enter the game; historical code is research, and all 28 arcade references are inventoried |
| P08 | Added independent validation families, performance profiling and human review expectations | Each quality target names an evidence method; no planned test is reported as executed |
| P09 | Added build-agent steps, future command contracts and prerequisite table; corrected OAuth guest-memory lifecycle | Each step has an evidence gate; real provider callbacks are distinguished from mocked login |
| P10 | Final review connected packet journeys to work packages and added an explicit kickoff handoff | All 21 acceptance checks have build/validation coverage; 10 reviews recorded; only the three documents are produced |
