# Quickstart: Spec001 implementation

The Spec001 candidate includes twelve connected rooms and three endings. Choose
**New Adventure** for the guest game. The public build includes the registered
media and the Credits links from the title and Game menus. The configured PHP
test service exercises single-slot account journeys with disposable synthetic
accounts. The implementation handoff records the remaining provider, human and
release evidence. [Current handoff](../../docs/implementation/HANDOFF.md) · [Delivery contract](contracts/delivery.md)

## Run the public candidate

1. Clone `001-physical-layer-underworld` from the public repository into a clean directory. For an exact repeat use the full Git revision of the candidate being checked. Use Node 26.13.1, npm 11.20.0, PHP 8.4.28 and Composer 2.11.3. The README includes the clone command and links to the verified downloads and PHP platform requirements. [Toolchain and build](../../README.md#build-and-play-from-a-public-checkout)
2. From the project root run `npm ci` and `composer install --working-dir=server`. Run `npm run check` and `npm run build`. The build produces `dist/` with its Vite manifest, playable exports and both credits files.
3. Run `npm run preview:client` and open the printed loopback address at `/arcade/play/network-quest/` for the static game. For a shared HTTPS client and PHP server, use the documented local certificate/key procedure and `npm run dev`. The default unconfigured API reports 503 and leaves guest play available. [Local HTTPS](../../README.md#local-https-and-php)
4. Use an empty sibling directory to independently fetch editable media, including Blender scenes, Audacity projects, raw images and audio. The fetcher checks the size and SHA-256 of each source. The versioned index and guide retain the earlier source snapshot as well. [Retrieval and offline verification](../../docs/source-retrieval.md)
5. Run the credit-register and bundle checks from the public checkout to verify asset and software attribution against source files, the lockfiles and installed production packages. [Verify the credits](../../docs/licenses.md#verify-the-registers)

## Local verification

| Command | What it exercises |
| --- | --- |
| `npm run dev:verify` | Disposable local HTTPS, same-origin routing, certificate trust, synthetic cookie and private-file controls |
| `npm run test:domain` | Authored content, UI, physical rules, measurements, state and retry handling |
| `npm run test:api` | PHP services, security, concurrency, migrations and recovery against isolated storage |
| `npm run test:e2e` | The registered browser projects, including guest play, keyboard/recovery and configured synthetic-account journeys |
| `npm run assets:verify` | Inventory, uses, sources, exports, rights and recorded review |
| `npm run assets:verify -- --mode release` | Enforces accepted counts and distribution; the media audit records the remaining listening-dependent findings |

For PHP-backed tests put the pinned binaries on PATH. Set `NQ_PHP_BIN` and
`NQ_TEST_NODE_BIN` to their absolute paths. The browser suite also requires
its pinned Playwright browsers, OpenSSL and Mozilla NSS. Installation and
test-run instructions are in the README. Release packaging, host recovery and
publication are tracked separately. [Test commands](../../README.md#available-commands-and-limits) · [Gate ledger](../../docs/evidence/spec001/gates.md)

## Implementation contracts

Read the specification, plan, research and constitution. The execution table
controls the order of implementation across story sections. Preserve the
independent teaching fixtures, the one-save contract, the external hosting and
provider checks, genuine native sources and human listening decisions.
[Spec001](spec.md) · [Plan](plan.md) · [Research](research.md) · [Constitution](../../.specify/memory/constitution.md) · [Task batches](tasks.md)

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
