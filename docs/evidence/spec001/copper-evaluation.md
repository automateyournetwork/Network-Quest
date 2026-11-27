# T070 — scoped copper evaluation

2026-11-26, loop 081. Local deterministic implementation evidence for
PHY03/PHY04/PHY05, T01–T03 and the copper portion of T068. T069 was accepted and
the native Safari timing reservation released before execution. The independent
source/physical/repair fixtures are unchanged.

`src/domain/copper.ts` retains the introductory length and continuity predicates.
The new `copper-path` / `test-path` call requires explicitly supplied compatibility,
nonempty metre lengths and all required conductor states. All authored facts are
validated before the command. A recognized incompatible choice is incorrect;
unknown profiles, malformed units/facts or unsupported topology are content
errors with no penalty or progress. Compatibility gates numerical scoring.

`copper-termination` / `check-termination` tests only the supplied termination
fact. Its success cannot imply compatibility of omitted endpoints/media or any
path result. Passive-path results report current version, total, headroom/excess,
continuity and open indexes. All results have no accepted effects; physical
observations retain `wholeRouteProven: false`. T074 owns objective preparation,
fresh submitted-evidence comparison and completion effects.

The existing exact decimal calculation compares before conversion to numeric
display readings. Tests retain the inclusive 100 m boundary and reject even
100 m plus the smallest positive finite JavaScript value. No regeneration limits
are invented. An added repeater leaves the diagnosed required break open; the
180 m two-segment regenerative proposal is an authoring error.

## Executed verification

Pinned Node 26.13.1/npm 11.20.0, using
`PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH"`.

- Before implementation, `npm run test:domain -- tests/domain/copper-repair.test.ts`:
  **18 failed / 26 passed** (44 checks). Failures demonstrated absent path and
  termination evaluation, scoped invalid-action behavior and regeneration reason.
  Generic invalid-content cases already rejected the then-unsupported predicates;
  those passes alone were not evidence of the new behavior.
- Initial implementation: both copper suites **97 passed**, typecheck passed.
- Final join at 18:55:57 local tool time: **625 passed / 120 TODO**, 11 suites,
  7.23s. Includes final copper **100 passed** (53 existing + 47 new), packet domain,
  packet/notebook state and UI, actual introduction state, and both frozen-oracle
  validation suites. Final `npm run typecheck` passed.

Final join command:

```sh
npm run test:domain -- tests/domain/copper.test.ts tests/domain/copper-repair.test.ts tests/domain/packet-journey.test.ts tests/domain/packet-journey-boundaries.test.ts tests/state/notebook.test.ts tests/state/packet-activity.test.ts tests/state/introduction.test.ts tests/ui/notebook.test.ts tests/ui/packet-journey.test.ts tests/domain/physical-cases.test.ts tests/domain/repair-routes.test.ts
```

The six RR-O03/O04 cases call the actual evaluator. Tests compare literal totals,
headrooms, failure reasons and outcomes from the frozen fixture; the narrower
continuity/termination fields are explicitly projected without inventing omitted
facts. Further negative checks cover malformed data before missing/stale commands,
extra topology, altered limits/identity, action mismatch and detached deterministic
observations. No evaluator-generated answer key is used.

The 120 shared TODOs (68 physical + 52 repair-route) remain untouched. They include
later evaluator and objective/route acceptance work; these scoped observations
do not certify complete O03/O04 gameplay, route restoration, browser acceptance,
human teaching review or any aggregate gate. No shared domain helper, state,
content, fixture, task tracking, media or publication change is part of T070.

Input/output hashes: [copper-evaluation-seal.json](copper-evaluation-seal.json).

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
