# MG03 execution-report preservation correction

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

The promoted MG03 test module wrote random-ID execution receipts beside itself
unconditionally after every run. Root's broad verification overwrote the worker's
original receipt before commit9484507. The subsequent Q03 affected run wrote a
third receipt. This was an evidence-preservation error, not a game-state failure.

Root had matched all269 worker hashes before running the follow-up tests. The
original receipt's recorded hash is
`31e08fd41435a958dd0846a120fa865c8fb1741d6381589f870be9dd22f742fc`.
Its exact bytes could not be recovered from local/temp copies, Git objects or
recorded tool outputs. No IDs or missing records were reconstructed. The original
seal and prior verification record remain historical; that one owned artifact
can no longer be rechecked against its original hash. The other23 owned packet
artifacts still match. The full broad-run receipt published in9484507 is distinct,
with hash`3b43a0fe9f2c70281b59deba95ab46b5ce8ac241de83a0e8eda4cfea11682119`.

The broad receipt is also preserved as `07-full-client-runtime-receipts.json` in
this directory. The Q03 affected receipt is preserved separately in
`quality/Q03/root-checks/05-affected-mg03-runtime-receipts.json`, with hash
`1fd70f62cde795adefed2bcbb4c09c81acb922fbd01448a3cd8256e0f6061c95`.
Neither is presented as the lost worker artifact. The previously published
`promoted/runtime-receipts.json` bytes remain unchanged and have that disclosed
broad-run provenance.

Normal test discovery now imports `current-regression/runtime.test.ts`, retaining
all64 checks while requiring an explicit `NQ_MG03_RECEIPTS_OUT` destination
to write a new report. The sealed historical test module is untouched. All64
checks pass through the new default path, and the published historical receipt
remains byte-identical afterward. Current game acceptance rests on the preserved
source, real assertion results and separately identified current reports; this
incident is not concealed by a replacement seal or an invented historical pass.
