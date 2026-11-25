# Gameplay and Authoring Contract

This contract implements [spec.md](../spec.md), including FR-010/016 and SAVE13. It defines behavior, not a second game specification.

## Action and rule interfaces

The four verbs are Walk, Look, Talk and Use. Inventory combinations and recruited abilities use the same validated command path as ordinary tools. A semantic list exposes every required object/exit/action/evidence; keyboard W/L/T/U, I/N/C, Tab/Enter/Escape and arrow navigation have visible equivalents. Shortcuts never fire while typing. Touch requires no hover.

A domain call has the conceptual signature:
```text
evaluate(challenge, action, relevantWorld) ->
  {status, reasonCode, observations, acceptedEffects}
status = correct | incorrect | invalid-input | content-error
```
Domain functions have no DOM, audio, network or persistence effects. The reducer applies acceptedEffects after checking action and state versions. Empty input is invalid-input; malformed source data is content-error with no learner penalty or reward. Correct alternative solutions have their own explanations.

Authoring records must provide typed values/units, model limitations, exact source claims, relevant rule/profile IDs, inspectable evidence, accepted alternatives, observable outcomes and a method → worked step → solution hint ladder. Fictional fixture thresholds remain labeled. Author expected T01–T16 results independently before evaluator implementation; cover correct, incorrect, exact boundary, compatibility-before-arithmetic, stale readings, malformed content, repeated actions and interruption.

R01/R12 highlight payload 0x4E 0x51 (01001110 01010001) inside an opaque upper-interface frame. Toy symbols and known-pattern comparison are explicitly teaching models; neither is a claim that the whole frame is two bytes or universal Layer 1 error detection. No seven invented mandatory wire headers. Pause/step/replay works from keyboard and pointer and reads the actual current domain result.

## Content validation

Validate IDs, references, conditions/effects, units, source coverage, safe positions, dialogue reachability, item recovery, ability equivalents and route graph. Detect impossible prerequisites, removed-content references, cycles that prevent progress, mandatory dependencies on optional rewards/future doors and missing presentation text.

Prove all three branches independently: O01→O02, then O03→O04 OR O05→O06 OR O07→O08; chosen branch plus common O09/O10 unlock O11→O12. Maintain all twelve meaningful rooms, all 25 compendium entries, nine recruits/max two active, SQ01–04 and MG01–03. Optional timing starts disabled; main reasoning is untimed.

## Transitions and persistence coordinator

Manual Save operates during stable exploration after an action completes. Explain temporary restrictions during dialogue transaction, transition, cutscene, active encounter, terminal failure/E03 or a write in progress. Eligible autosave events are safe arrival, completed objective after feedback dismissal, or safe preparation. Debounce events and serialize writes. Personal notes join the next safe snapshot.

New account autosave is false. Enabling it explains that it replaces the same slot and applies across devices. Each save transaction rechecks current account preference; a queued automatic write must not proceed after opt-out. Use X-Save-Mode to distinguish automatic requests; check current opt-in after receipt lookup so replaying a successful write is still acknowledged. First adoption invokes a manual save. Automatic writes require an existing slot for the same adventureId. Manual replacement of another adventure requires X-Confirm-Adventure-Replacement:true, bound to the request adventure and reviewed precondition. New Adventure and guest adoption need explicit replacement consent before any autosave can replace an existing adventure; existing account opt-in does not imply that consent.

Save UI distinguishes unsaved, saving, saved-at-server-time, failed and conflict. If gameplay advances while a write is in flight, its acknowledgement marks only that captured generation saved. Unconfirmed changes remain dirty. No browser memory is described as durable. An exact pending-request retry recovers a retained receipt before current content validation; do not reject that retry merely because a deployment has changed new-write policy. New writes still satisfy the current rules.

Conflict offers Load Server Save, Keep Playing Without Saving, and Replace Server Save after reviewing current summary. Replacement uses a new request ID and that reviewed revision; another concurrent change produces another conflict. Never merge automatically. Unsupported newer saves remain intact and disable replacement.

## Clarified retry and logout

Failure Retry and E03 Continue restore encounter/inventory preparation, retain new clues, notes and hint history, and make previous-attempt measurements visibly stale. All changed physical configurations invalidate dependent evidence. Rollback restores consumed items and completion flags together to avoid duplicate rewards. Retained learning becomes durable only at the next eligible manual/opt-in autosave. Restore Save replaces the entire current world/journal with the confirmed snapshot after warning about unsaved changes.

Logout first warns about unsaved progress. Cancel leaves both session and adventure untouched. Confirm stops queued automatic writes and auth attempts, revokes the server session, clears all current adventure/checkpoint/notebook memory and returns to title. No new save is issued and the slot is neither replaced nor deleted. An already committed earlier save is not rolled back. If an in-flight write has unknown outcome, explain it and reconcile; never claim logout saved the adventure. Network failure must not be reported as successful server logout; a session recheck may confirm a lost successful response.

## Authentication and destructive choices

Keep the gameplay tab alive while a user-initiated auth window/tab runs. Popup failure exposes Open Sign-in Tab. Canceled/failed login retains guest memory. On successful GET session, confirm provider identity; empty slot offers saving current run, occupied slot offers load/replace/cancel with summary. No automatic merging between providers or accounts.

New Adventure, load and replace warn before discarding unsaved progress. E01/E02 may save only with safe Continue; E03/fatal/unresolved transitions cannot overwrite the recoverable slot. Deletion requires explicit confirmation plus fresh same-account provider authentication; it deletes live account data and sessions and explains real backup expiry.

## Recovery and access

One semantic action/state interface survives missing images, bad asset decode, disabled audio, WebGL2/context loss and network loss. Renderer recovery uses current state; no fake progress. Show retry/low-detail/text controls as appropriate. Captions and text expose essential sounds, focus remains visible, 200% zoom and reduced motion retain all actions, and background tabs do not advance mandatory timers.

Automated checks supplement actual browser, keyboard/assistive, visual/listening and human learning review. The acceptance matrix remains AC01–21, with SAVE01–13 and both clarified transitions included.

## Deletion outcome confirmation

Before confirmed deletion, generate a 256-bit random receipt in memory and send X-Deletion-Receipt. After a lost response, display deletion unconfirmed and query POST /account/deletion-status with bounded backoff. Only DELETE 204 or a completed status confirms removal; pending remains pending, and unknown/expired receipt, guest session, network failure or a closed/reloaded tab with no receipt leaves the result unconfirmed. Explain that keeping the tab open retains this confirmation check. A status check performs no deletion, sign-in or account creation. Never automatically repeat the destructive request; a retry needs valid fresh same-account authorization and the explicit deletion choice. A response for an old operation cannot clear a later signed-in account or its adventure. The receipt exposes no progress or identity and is neither stored in browser persistence nor shown in URLs/logs.
