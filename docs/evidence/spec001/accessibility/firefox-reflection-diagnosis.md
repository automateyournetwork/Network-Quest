# Firefox ARIA reflection crash diagnosis

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Coordinator investigation after T078, 2026-11-26. The failed R12 axe audits remain
failed historical evidence. A separate minimal diagnostic now reproduces a known
browser failure without loading the game, its renderer, server or any identity.

Playwright documents a Firefox failure when ARIA element references are read in
both the page and its isolated automation context; both read orders can crash.
The upstream report links the Mozilla defect and distinguishes same-context
controls. [Playwright issue43967](https://github.com/microsoft/playwright/issues/43967).
The browser update in revision1575 carries the relevant upstream correction.
[Firefox roll43982](https://github.com/microsoft/playwright/pull/43982).

Actual local results use the project's pinned Node26.13.1 and Playwright1.65.1.
The standalone probe creates four disposable headless browser instances with a
small labeled button. It reads the real DOM property and uses the real named
Playwright locator; no patched property or disabled audit rule is involved.

| Case | Pinned Firefox159 revision1572 | Isolated revision1575 candidate |
| --- | --- | --- |
| Automation context twice | PASS | PASS |
| Page context twice | PASS | PASS |
| Page then automation context | Browser process crash | PASS |
| Automation then page context | Browser process crash | PASS |

The reports record timestamps, probe hash, environment, exact errors and counts.
The candidate came from the official Playwright CDN; its archive and executable
hashes and upstream browser commit are preserved in the provenance JSON. It is
stored separately under ignored `.runtime/firefox-1575-diagnostic/`. The project
package/lock files, existing browser cache, owner preview and Safari state were
not changed. A fresh npm metadata query still reports1.65.1 as the stable package.

This explains a credible mechanism for the related R12 failure, but a minimal
reproduction is not a completed application accessibility audit. T152 still needs
the actual room/dialog audit, a reviewed reproducible browser-pin decision and
any real violations resolved. Do not count the four candidate passes as episode,
Safari, production or human accessibility acceptance.

Run the preserved probe from the repository root:

```sh
.runtime/node-v26.13.1-darwin-arm64/bin/node docs/evidence/spec001/accessibility/firefox-reflection-probe.mjs .local/firefox-baseline.json
```

An optional third argument selects an explicitly recorded diagnostic executable;
it is never a hidden substitution for the pinned project browser.
