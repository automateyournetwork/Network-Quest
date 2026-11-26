# T066 contained adventure screen correction — loop077

Status: implementation built, independently reviewed and final joined verification passed. T066 is not accepted; revised owner
review and the separate T067 benchmark remain pending. This packet does not replace
or modify the sealed historical `t066` packet, pass G3, or authorize deployment.

The owner requested one classic adventure screen after reviewing the first R01
candidate: the prior composition placed too much text and too many buttons below
the playable room. This change preserves the produced Blender/OpenAI/audio media,
room camera, deterministic actions, persistence controllers and one-save contract.
It changes the composition of the actual application.

The room fills a bounded viewport between a slim header and command bar. Walk,
Look, Talk, Use, Inventory, Notebook and Compendium retain visible labels, original
inline SVG icons and keyboard equivalents. Scene, Evidence, Game, and Sound and
reading open contained windows. The Scene list retains every named object/action,
text description, replay control and visual fallback option. Numeric hotspots and
the safe-position marker are off by default; Show hotspots is an explicit choice.
No media, content, domain rule, server route or save schema was changed.

The window coordinator moves the original semantic nodes; it does not generate
new action captures. Background content is inert during a modal window. Windows
scroll internally. Only the heading/close bar is sticky. New nonempty action
feedback is revealed in normal window flow outside text editing; long on-scene
feedback and audio captions support keyboard scrolling. Escape and explicit close/cancel controls retain controller
semantics and restore the original opener, including a suspended Scene window.
Successful New Adventure and Restore clear the presentation windows. A compact
save indicator remains visible in ordinary play, and the same controller-owned
status/message nodes move into the active Game/save window. Busy account work
keeps the application's own inert boundary distinct from frame modality.

## Executed checks and retained failures

All browser runs below used the actual Firefox executable through Playwright,
strict isolated local TLS (`ignoreHTTPSErrors: false`) and the existing isolated
PHP fixtures. Synthetic account fixtures do not establish actual provider or host
acceptance. Raw traces and fixture/request data remain in ignored `.local/t077/`;
they are not public artifacts.

| Attempt | Result | Assessment/correction |
| --- | --- | --- |
| Initial typecheck | Passed | First composed frame compiled. |
| First build before run1 | Failed | Unused test import; corrected, no runtime result inferred. |
| run1 | 1 failed | Hotspot preference intentionally persisted across New Adventure; test now turns the toggle off before testing the next default entry. |
| run2 | 1 passed, 1 failed | Escape restoration attempted to focus an inert opener. The frame now restores after clearing its own modality. |
| run3 | 1 failed | Test used a nonexistent curly-apostrophe exit label while Use was selected. It now scrolls to the actual last Scene action. |
| run4 | 16 passed, 7 failed | Audio test needed to reopen Sound; logout assertions needed to dismiss the confirmation; unsafe Save needed discoverable Game access from activity windows; save status/recovery messages needed to stay visible in their active context. Source changed during this development run, so it is diagnostic only. |
| run5 | 22 passed, 2 failed | Direct New/Restore, owner layout, real media hashes, audio, logout and save regressions passed. Remaining failures were explicit menu navigation after session adoption and ambiguous Game routing with an activity open. |
| run6 | 6 failed, 2 passed, 1 interrupted, 56 not run | Stopped with SIGINT after a repeated helper routing race: an asynchronous deletion-phase control was incorrectly treated as a Scene destination. All partial evidence retained; no joined acceptance claimed. |
| run7 | 3 passed, 2 failed | Desktop containment, direct lifecycle, exact Scene opener restoration, 390/768 at 200% in-game text, and full axe checks passed. Two remaining driver races involved redundant deletion checks and returning from Game to a suspended activity. |
| run8 | 2 passed | Lost committed DELETE receipt and unsafe-Save/explicit-autosave paths passed after UI-driver correction. |
| Independent078 | 5 direct cases passed; narrow defect confirmed | A sticky feedback region overlapped its header at 390/200% and failed full axe `scrollable-region-focusable`. Historical browser crashes during runner-based axe attempts were retained separately; an isolated full axe run established this actual defect. |
| run9 | 1 failed | Normal-flow feedback was readable by scrolling, but the new test incorrectly demanded the entire long paragraph fit at once. The test now measures first/last text separately through actual internal scrolling. |
| run10 | 1 passed | The exact long-feedback case passes at 390/768 and 200% in-game text: no overlap, readable first/last lines, close in view, no document overflow, and full default axe in both Scene and ordinary room view. |
| run11 | 57 passed, 8 failed | Stable full joined run exposed an obsolete packet Return control surviving close/reopen because it had moved outside the owning renderer. Controls are now restored immediately before owner reconciliation, then recomposed with focus preserved. Other failures were a redundant session-check race, over-dismissed pending logout, intentional media fallback incorrectly rejected by a helper, empty feedback now hidden by design, and a 44px control rounding just below 44px. The latter now has a 45px minimum; the test threshold remains 44px. |
| run12 | 9 passed | Every affected run11 case and a new exact stale-control regression passed. The packet test checks one current Return control, detachment of the prior control, ignored obsolete events, and successful current return. |
| run13 final | 66 passed, 0 failed (5.4m) | All ten relevant suites passed after the final control-reconciliation change, using the same frozen source/build. Guest, packet, visual/keyboard/recovery/accessibility, title, save, account, logout and deletion paths retain their independent assertions. |

The final passive-render sequence restores relocated controls immediately after panel selection and before the original inventory/notebook/dialogue/packet/menu/save/settings renderers reconcile. The final frame composition restores focus to a still-current control; obsolete controls retain their original stale-intent protection.

The browser helpers navigate the real visible controls. They do not force clicks,
change game state, suppress application errors or weaken independent snapshot,
receipt, conflict, deletion or write-count assertions. Temporarily unavailable
modal controls are awaited; only known Scene/Game/Sound destinations navigate.

## Observed layout and remaining work

The inspected final 1440×900 entry has a 1428×766 stage (85.1% of viewport height); at 1280×720 it is 1268×578.8 (80.4%).
The desktop test also requires more than 75% at 1280×720, zero document overflow,
no initial modal, and the original action bar in the viewport. The camera fits
the original scene; it is not cropped to inflate scene coverage.

Narrow checks use 390/768 CSS-pixel viewports at 200% **in-game text size**, with
internal window scrolling and the close control still in view. These checks are
not evidence of native browser zoom or advertised phone performance. Full axe
runs retain the default rules; automated checks do not certify all accessibility
or human usability.

Final captures and inspection notes are in [visual-observations.json](visual-observations.json),
with [desktop geometry](t077-entry-layout.json) and [narrow geometry/axe results](t077-access.json).
All account identities in the browser evidence are synthetic local fixtures.
The ordinary-play screenshots are [1280×720](t077-entry-1280x720.png) and
[1440×900](t077-entry-1440x900.png). The long-feedback [first](t077-feedback-start-390-200percent.png)
and [last](t077-feedback-end-390-200percent.png) lines demonstrate internal scrolling;
these are different scroll positions, not a claim the whole paragraph fits at once.

## Final verification

- [Check](check.txt): PASS typecheck, semantic content validation and generated save policy.
- [Focused units](unit-results.txt): 17 files, 287 tests PASS.
- [Production build](build.txt): PASS; Vite's existing large-main-chunk warning retained.
- [Final joined run13](joined-results.txt): 66/66 PASS in 5.4m against the sealed source; all source/build hashes remained unchanged.
- Independent078 final review: five direct native cases passed after the final
  reconciliation change. Separate Scene/stage full default axe, Tab/ArrowDown long
  status/caption scrolling, text→visual recovery, and packet phases/replay/reopen/
  exact-one-Return/obsolete detached click checks passed. See [independent packet](../t078/review.md).
  Its initial immediate scroll assertion needed a bounded native scroll settle;
  runtime remained unchanged. The original observation is retained there.
- [Isolated full-default axe report](t066-accessibility.json): ordinary stage,
  expanded Sound, Notebook, Inventory and Save all have zero violations. The stage
  retains one color-contrast incomplete group on location/save/caption/status;
  expanded Sound has no incomplete items. Root's [bounded contrast review](../frame-contrast-review.md)
  supplements those observations without modifying the original axe result.
- [Runtime/media report](t066-runtime-budget.json) and [audio response hashes](t066-audio-runtime.json)
  preserve actual produced-media use. This unthrottled local run is not T067's
  shaped-network performance acceptance.

Exact commands ran from the repository root with
`PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH"`; browser command also used
`NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php`:

```sh
npm run check
npm run test:domain -- tests/ui tests/presentation tests/services/save-coordinator.test.ts tests/services/account.test.ts
npm run build
node node_modules/@playwright/test/cli.js test tests/e2e/finished-room.spec.ts tests/e2e/guest-introduction.spec.ts tests/e2e/introduction-graybox.spec.ts tests/e2e/packet-introduction.spec.ts tests/e2e/title.spec.ts tests/e2e/save-dialogs.spec.ts tests/e2e/account-settings.spec.ts tests/e2e/single-save.spec.ts tests/e2e/logout.spec.ts tests/e2e/account-deletion.spec.ts --project=firefox-local-https --workers=1 --output=.local/t077/run13
```

The [source/build seal](final-source-build.json) records exact hashes/sizes of all
20 changed source/test/helper files, four build inputs and all 33 production files.
Root-font enlargement is separately checked; neither text-scaling method is native
page zoom. Simulated hidden-document events verify application wiring, not native
background-tab behavior. Automated rules and agent screenshot inspection do not
certify full accessibility, mobile performance, integrated listening or human play.
The owner's positive response to the original artwork is preserved; acceptance of
this revised interface and the separate revised T067 benchmark remain pending.

The [evidence seal](evidence-seal.json) records the final public packet and loop-note hashes. Raw diagnostic traces and private fixtures remain excluded.
