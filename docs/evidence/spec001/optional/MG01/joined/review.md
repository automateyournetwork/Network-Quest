# MG01 isolated actual integration review

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

This is the same T101/loop113 continuation. The executed source is the isolated
archive `.local/mg01-join-9a93bf7`, based on accepted commit
`9a93bf7815cda8b7055a8177bd61d5c468dc8f52` plus the exact reviewed MG01 candidate.
The shared working tree is still owned by the ordered SQ03/SQ04 joins. None of
this packet claims that the current application already runs MG01. Original
56-test authoring results, projection, candidate and source seal remain intact.

`changes.json` identifies every changed path against that accepted commit.
`integration.patch` is a review artifact, **not an instruction to apply an old
patch onto current work**. Mechanical schema/type and save-policy artifacts are
identified by exact hashes but omitted from the text patch; regenerate them from
the final reconciled source. The schema, content, loader, reducer/controller,
contained UI, hints and JavaScript/PHP policy are actual implementations in the
isolated archive, not a second candidate evaluator or a substitute controller.

## Runtime and receipt behavior

Only the reviewed `toy-symbol-loom` variant is added. The existing captured bits
intent and `evaluateSymbolAnswer` receive the actual T12 full strip or B-SYMBOL
practice sample. The dedicated semantic validator checks the exact own identity,
profile/source claims, samples, R10 entry, action, fact and completion batch.
Other minigames stay unavailable. Main calibration has no optional prerequisite.

Quest/minigame discriminants select the real once-only receipt. MG01 completes
`ACHIEVEMENT-MG01-complete` and `FACT-MG01-completion`; the achievement uses the
existing save-v1 field. Optional help belongs to MG01's explicit lesson source.
No score, timer, item, image allocation, manifest change or new save key exists.
The UI projects no media reward text for this practice-only benefit. Actual
native checks reject any `undefined` description or internal objective ID in the
panel. The input inherits the existing 200% font and remains inside the frame.

`finalizeOptionalSession(session, game, registry)` now advances replay
preparation by merging only the activity's own registered receipt into its
captured entry preparation. It requires a successful full result, the same
adventure, the actual registry mapping, the real receipt and the activity's own
completion fact. A fact alone or a caller's success label cannot advance it.
The reducer calls it only after atomic batch validation. It does not copy the
current flags, inventory, route, unrelated objectives, quests or achievements.
Existing entry progress stays intact. Facts, personal notes and assistance remain
outside the world preparation; rewind stales retained measurements and allocates
a new attempt. Existing encounter Retry/E03 whole-checkpoint semantics are
unchanged. This implements the reviewed future MG03 boundary without enabling
MG03 gameplay.

## Executed evidence

- **114 scoped checks PASS**, seven files, 4.03 s: 52 real MG01 loader/controller/
  captured-bus/reducer checks plus 62 retained SQ01/SQ02/framework checks.
  `08-runtime-green.log` is the final scoped result. All eight T092 MG01 lifecycle
  cases execute independently; mandatory calibration runs through both existing
  methods. Failure cases cover malformed content/input, detached/stale modes,
  retry, account generation, in-memory restore, failed CAS, forged input fields,
  partial receipt batches, raw effect injection and unearned practice completion.
- The actual safe snapshot earned by MG01 passes JavaScript and PHP validation.
  Seven differential candidates reject objective/quest aliases, unknown
  achievement and wrong lesson-source/hint associations. Generated policy is
  compared with the actual runtime policy. This is local validation and
  in-memory reconstruction, not a remote account/provider round trip.
- **Full isolated client run: 3,806 PASS / 1 FAIL / 360 existing TODO**, 100 files,
  38.81 s. The failure was an old-schema compatibility test applying the immutable
  pre-minigame schema to new MG01 fields. It now explicitly expects old rejection
  and current acceptance for this new document; no original schema or fixture was
  changed. The affected **24 checks PASS** in 8.63 s, accounting for **3,807 distinct
  passing client checks**. The original failed full run remains `11-full-client.log`;
  `13-compatibility-rerun.log` is an affected rerun, not a second full run.
- Scoped strict TypeScript, final `npm run check`, generated-policy validation
  and the production build pass. Build retains the existing large-chunk advisory.
  No server implementation or receipt-first transaction was changed.
- **11 actual headless Firefox groups PASS** against a normal isolated built
  preview. The browser performs the real guest introduction, walks to R10 and
  completes mandatory calibration before ever opening MG01. It checks start,
  practice, wrong/blank answers, stale detached controls, retry with a real
  calibration reading becoming stale, retained notes, every exit phase,
  completion, replay, no timer, source links, keyboard focus and 1280/390 px at
  200% text. Input text is 32 px at both widths. Axe reports zero violations;
  there are no observed page errors or API requests. Sources remain unchanged
  throughout the run. `14-native-initial.json` is the successful first native
  receipt, and the two `mg01-*-200.png` files were visually inspected by this agent.

The native process owns its headless profile and ephemeral preview port, closes
both, and never operates Safari, owner previews, another worker's browser, an
account or a provider. Parallel headless checks were coordinator-authorized.
No performance or OS-foreground claim follows from them. Screenshots show the
scrolled contextual panel, not produced media or human owner approval.

## Retained failures and limitations

`01-content-generate.log` records a missing `.ts` import suffix in the new
validator under Node's direct TypeScript loader. The corrected generation passes
in `04-content-generate.log`. `06-runtime-types.log` records five harness type
diagnostics: a type imported from the wrong module, a nonexistent snapshot
property and writes to readonly cloned fields. The corrected harness uses the
actual snapshot bytes and immutable replacements; `09-runtime-types-green.log`
passes. No evaluator, oracle or expected physical result was weakened.

Current-tree promotion is still pending root GO after SQ04. Reconcile these
specific shared boundaries rather than replacing files:

1. Preserve SQ03/SQ04 schema variants, content documents, loaders, pure adapters,
   closed intents, controls, practice/help and policy sources. Add MG01's explicit
   toy branch alongside them; do not treat every non-power variant as toy symbols.
2. Preserve Weather Diary and Maintenance Record openers. Replace the old three-
   entry isolated ternary with a small explicit name mapping (and validated
   metadata fallback), so later minigames cannot inherit another activity's name.
3. Keep media-bearing reward descriptions variant-specific. MG01 has no media
   description; SQ04's separate maintenance-history behavior must also survive.
4. Join the registry-aware finalizer call and exact-own-receipt merge, preserving
   the current quest paths and separate encounter recovery.
5. Merge the compatibility-test exception with the SQ03/SQ04 checks; preserve
   the immutable original schema and all original authoring packets.
6. Regenerate shared schema/types and policy from the final content; run affected
   common/minigame/SQ03/SQ04 tests, check/build and final current-tree native checks.
   Make the evidence runner's output directory relative/configurable for that
   promoted run; its absolute directory here identifies this isolated packet.

T101 is not self-accepted. T104/T105 full episode recovery, live save/providers,
human technical/learning/owner review, finished media and aggregate gates remain
separate. The coordinator owns tracking, staging, publication and any deployment.
