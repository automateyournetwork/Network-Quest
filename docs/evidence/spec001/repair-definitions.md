# T069 physical profile and objective authoring

2026-11-26, loop079. This records content authoring and validation, not executed
repair routes, evaluator correctness, human learning or gate acceptance.

## Authored result

- `content/spec001/profiles.json` contains all seven existing reviewed profiles.
  Parameters, units, assumptions, limitations, source sections/claims and original
  correct/incorrect/boundary/invalid case references retain the T006 authority.
- `content/spec001/objectives.json` contains O01–O12. O01/O02 and the two existing
  introduction profiles are unchanged record copies; their original files and the
  runtime world's document selection remain untouched.
- O03–O12 have evidence, prerequisites, conventional/direct alternatives,
  completion effects, outcomes, explanations and method/worked/solution hints.
  Player-facing prose uses room names and plain language. Exact IDs, authoring
  status, source/runtime unit aliases and implementation obligations stay in
  metadata and this evidence.

The full collections are not automatically loaded by the current two-room build.
The test constructs a separate world-document projection to validate their eventual
join with the real semantic registry. Root owns that runtime integration. Metadata
graph reachability is not evidence that the remaining rooms or route controls exist.

## Teaching and state review

| Obligation | Authored coverage |
| --- | --- |
| Copper preparation | 95 m and exact 100 m valid alternatives; compatibility, diagnosed defect and every required conductor checked separately |
| Copper validation | Retained open-before/fresh intact-after comparison; repeater cannot repair the unchanged break; unreviewed regenerated topology remains unsupported |
| Fiber preparation | Inspect before cleaning/replacing; match fiber, wavelength direction, rate, connector/polarity and host support before arithmetic |
| Optical power | −11 dBm/3 dB and −12 dBm/exact 2 dB pass; −13 dBm/1 dB fails reserve; independently observed 0 dBm fails overload; impossible passive-power assertions remain author errors |
| Radio | Explicit viable path/settings; fresh 25 dB and exact 20 dB alternatives; 13 dB fails; no inferred real channel ranking or throughput |
| Equipment/power | All form-factor/PHY/media/host/per-port fields; 23 W and exact 30 W delivered allocations; 33 W exceeds by 3 W |
| Capability | Both negotiate; 100/full is the sole common mode; source Mb/s explicitly maps to runtime Mbps without creating support |
| Symbols | Ordered −3,+1,+3,−1 yields 00101101; pause/step/notebook/replay are untimed; toy levels are not persisted voltages |
| Intervention | Each single completed branch plus equipment/Clockworks; warning, current evidence and completed execution required; safe deliberate isolation is distinct |
| Ending | Permanent and temporary require fresh physical and separate endpoint proof; temporary requires dependency/follow-up; shutdown records unresolved service and recovery |

Alternative conditions express availability. Their rule/evidence references are
obligations for the T070–T074 evaluator/controller join, not proof of correctness.
Reading a profile has no effects. Objective completion is an atomic once-only effect
accepted only after current evaluation; no text button, animation, choice position,
interruption or stale observation can independently award it. The O11 route-choice
effects only identify the selected route. Ending alternatives do not declare an
outcome effect that could bypass validated classification.

All mandatory alternatives are available with ordinary actions or the existing
never-consumed inspection kit. Optional ally equivalents remain later authored
ability integration; no unimplemented ability ID was invented to satisfy a count.
The before/after copper comparison explicitly allows equivalent ally evidence
under the same rules when available. Hint use remains nonpunitive; retry/E03
retention, fresh validation and the one-slot save contract are unchanged.

## Validation

First targeted run: `tests/content/repair-definitions.test.ts`,
`tests/content/introduction.test.ts` and `tests/domain/repair-routes.test.ts`:
**123 passed, 52 TODO**, three suites, 2.99 s. The 52 TODOs remain unimplemented
route/evaluator expectations. No case was promoted to pass without implementation.

The 14 new authoring checks exercise the existing schema and real semantic
registry, preserve the introduction, resolve all references and independent route
metadata, check exact profile boundaries and reject changed units/thresholds,
unreviewed source promises, missing hints, stale measurement definitions, wrong
dimensions, absent evidence and cross-objective completion effects.

Root review requested removal of development IDs/jargon from new visible prose.
Those prose corrections preserve every parameter, reference, effect and independent
expected result. Root also removed over-restrictive test assumptions: conventional
choices stay required, while additional valid choices and later ally equivalents
are permitted. The tests do not require the runtime to remain introduction-only.

After root and loop073 released the actual Safari timing reservation, final checks
ran on pinned Node26.13.1/npm11.20.0:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run test:domain -- tests/content/repair-definitions.test.ts tests/content/introduction.test.ts tests/domain/repair-routes.test.ts --maxWorkers=1
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run typecheck
```

Both exited0. Final Vitest5.1.2 result: **123 passed,52 TODO,3 suites**,2.96s.
Typecheck completed without diagnostics. No failed test run occurred. No full
build, browser, host/API test or deployment was performed for this content-only
task. The actual runtime documents and the full test-only projection both pass
the real content registry. Protected source/oracle hashes and all four copied
introduction records match; all five owned text files have clean whitespace.

## Remaining integration

T070–T073 implement physical evaluators; T074 enforces objective evidence/freshness
and effects; T075–T081 supply rooms/controls and wire the complete documents.
Encounter and ending controllers still need their own fixtures and browser checks.
This authoring does not imply complete media, a passed G3/G4, provider acceptance
or a deployed episode.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
