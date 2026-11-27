# Compendium integration review

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Date: 2026-11-27. Coordinator: `/root`. T095 is accepted for the contained,
read-only compendium, supported source navigation and application lifecycle join.
T094 owns real encounter discovery and party behavior. All portraits remain
planned; illustrated-media acceptance and full US7/T104 remain pending.

Root reviewed the complete projection/controller/renderer, notebook change and
bounded application patch. Discovered IDs alone select character entries; reading
cannot grant discovery, recruitment or progression. Source navigation uses actual
visited rooms and directed navigation resolutions. Selecting evidence opens its
actual notebook row and highlights the visited source without moving the player,
changing dirty state or refreshing a stale reading. Personal notes/hypotheses
remain distinct from observations. Technical links open a separate tab; portrait
URLs require explicit accepted bindings, absent for the current planned assets.

Root's visual review identified two presentation issues. Floating Game/Close
controls covered enlarged text; compendium-only CSS now keeps them in flow.
Raw attempt UUIDs consumed several lines; the same exact stored provenance is now
shown as this attempt or an earlier attempt. An actual browser journey exposed
focus occurring while the previous panel still made the notebook inert. Deferred
focus is now guarded by the exact capture, draft, selection and visible panel.
Original failures, corrections and the separate candidate scope are retained.

Worker evidence has 45 focused tests, 17 actual-module browser cases, eight actual
application cases and a final targeted narrow provenance check passing. Root
matched all four owned-source and 72 artifact hashes in the worker seal,
`50f668fd6174254d1a29d62430401bf961df551b817b98b8b08adba1ffb7f460`.
Its application snapshots included in-flight T094 dependencies and its final
whole-project build hit a concurrent T100 type error. Those results are preserved;
they are not described as independent release-candidate verification.

To separate that concurrent work, root reconstructed the accepted T093 public
checkpoint `1260a6bdcd9014f62e41f9cbe3ffcf1c556612b8`, then applied only the four
T095 source/test files and reviewed application patch. No T094/T100 implementation,
private configuration or injected adventure state was included. In that copy:

- Strict TypeScript, content/route validation, policy freshness and build passed.
- All 45 focused tests passed in 8.06 seconds.
- Eight real guest journeys passed against the built client, with zero observed
  page errors, API requests or source drift. They cover actual Look, source
  selection, Walk, stale observations and 1280/390 pixel layouts at 200% text.
- The final 390-pixel provenance and notebook-focus check passed. Root visually
  inspected the resulting reading and selected-source screenshots.

The first isolated native attempt was denied because the checkout lives under
`.local`, which the development server intentionally excludes. That failure is
retained. Verification then used normal production preview of the unchanged build;
no private-file boundary was disabled. The existing bundle-size advisory remains.

The reviewed application change is staged from the exact isolated patch so ongoing
party edits stay in the working tree. This checkpoint does not deploy the episode,
accept missing media, certify human learning or pass an aggregate gate.

See [worker report](compendium/README.md) and [root results](compendium/root-checks/results.json).
