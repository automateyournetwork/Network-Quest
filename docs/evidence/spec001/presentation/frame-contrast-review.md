# Contained-frame contrast follow-up

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

On 2026-11-26 the coordinator inspected the actual desktop and enlarged-text
captures and checked the five stage text regions that axe left incomplete.
The original automated result remains incomplete; these are supplemental
source-color calculations and agent visual inspection, not human review or
whole-application accessibility certification.

The calculation follows W3C's [relative luminance definition](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance).
The [contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
permits evaluation from the underlying colors rather than antialiased edge pixels;
its ordinary-text threshold is 4.5:1. We use that threshold for all five regions.

| Region | Checked source colors | Lowest calculated ratio |
| --- | --- | ---: |
| Location | Both defined chrome gradient endpoints | 7.440:1 |
| Save indicator | Both defined chrome gradient endpoints | 7.314:1 |
| Text-scene fallback | Normal and hover button backgrounds | 7.274:1 |
| Sound caption | Dark translucent background over white | 6.131:1 |
| Shared feedback | Dark translucent background over white | 7.085:1 |

For translucent panels, both sRGB and linear-light alpha calculations were
checked over a white backdrop; the table retains the lower ratio. This is a
conservative brightness comparison, not a claim about the browser's compositing
implementation. Gradient results cover the declared endpoints. The
[machine-readable record](frame-contrast-review.json) preserves unrounded values,
inputs, method and the exact CSS hash.

Inspected captures include loop077's final 1440×900/1280×720 entry and loop078's
final enlarged-text feedback start, last Scene action, stage and restored room.
These show legible light text against dark panels. The earlier sticky-header
occlusion was a separate real defect and is preserved in loop078's report;
source contrast alone would not have detected it. Native browser zoom,
screen-reader/human checks and the complete release matrix remain pending.
