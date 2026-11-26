# T065 audition sources

Copyright 2026 John Capobianco. Original writing/direction/edits: CC BY 4.0 to the
extent controlled; scripts: Apache-2.0. Third-party notices: [rights](rights/NOTICE.md).

The [frozen listening packet](review.html) contains eight exact project lines,
one twenty-second generated title-theme excerpt and three synthesized effects.
The owner accepted all twelve on built-in Mac speakers and earbuds on 2026-11-26;
see [actual feedback](provenance/owner-listening.json). The frozen packet still
says candidates because its HTML/audio/transcript bytes were sealed before review.
That historical packet is deliberately unchanged.

- `raw/`: untouched Kokoro / ACE output and original synthesized effects.
- `scripts/`: eight exact reviewed canonical lines, without pronunciation overrides.
- `mix-inputs/`: reversible FFmpeg preparation, actual float WAV at 48 kHz; exact
  commands, source hashes and levels are in `provenance/mix-preparation.json`.
- [Audacity source](projects/audition-bank.aup4): genuine 4.0.2 native project,
  twelve separately named editable tracks. **Solo one track when auditioning.**
  Tracks start at zero to support individual export; playing all tracks together
  is not an authored mix. No MIDI, stems or performed recording is claimed.
- `masters/`: actual fresh-session Audacity exports, PCM24 WAV at 48 kHz;
  eleven mono voice/effect masters and one stereo music master.
- `../../../public/assets/audio/auditions/`: frozen MP3 previews (128 kbps mono,
  192 kbps stereo music), produced from the preserved prepared signals.
- [Candidate manifest](manifest-candidates.json): twelve exported, nonquota
  records. Root manifest integration is coordinator-owned. No runtime placement,
  full cue/loop, complete media library or G3 acceptance follows these auditions.

The saved source was closed, reopened in a new app process and exported. Its
SHA256 remained `3d17afa984c7ef855b7cd9bee434502c433f5a4ad28099a1b7e61043c6358d35`.
Native-export samples match each corresponding prepared input within 1.13e-6
absolute amplitude. Three spoken masters end one 48 kHz sample early; this is
recorded rather than represented as bit identity. Preview files were not changed.

`generate-voices.py`, `generate-music.py` and `synthesize-effects.py` preserve the
actual production logic. Do not rerun against frozen output paths; any revision
needs a new candidate/packet and the appropriate review. Use the existing isolated
`.runtime/media/kokoro-env` or ACE virtual environment and exact model revisions
in provenance. Explicit `VIRTUAL_ENV`, `UV_CACHE_DIR`, `HF_HOME` and offline mode
were used for Kokoro; ACE used its cached MLX turbo weights with MPS fallback,
eight steps, one sample, seed 20261126 and no language-model inference. Reserve
memory before ACE: this twenty-second run peaked at 37.94 GB footprint on a 48 GiB Mac.

Native4 has no scripting pipe. `native-bank.py` imports exact named files using
fresh macOS accessibility observations; `native-click.swift` supplies real mouse
input only for positions observed in Audacity's UI. Do not apply these to a user's
editing session. The bank was created through actual UI save/import/export actions,
not by writing a counterfeit SQLite file. Audacity 3 was not used for this task.
Detailed initial UI failures and corrected observations are in the report;
incidental logs/screenshots and the first diagnostic source/export remain private
under `.local/T065/`, not in the public asset library.

Verification, from the repository root:

```sh
.runtime/media/kokoro-env/bin/python assets-src/audio/auditions/verify-audio.py
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php .runtime/node-v26.13.1-darwin-arm64/bin/node assets-src/audio/auditions/verify-browser.mjs
.runtime/node-v26.13.1-darwin-arm64/bin/node tools/validate-assets.ts --manifest assets-src/audio/auditions/manifest-candidates.json --mode inventory
```

The browser probe uses an isolated trusted NSS profile and loopback HTTPS, then
closes browser/server/profile. It proves exact-file Firefox decoding and metadata,
not listening or later game's skip/replay/mix behavior. No Safari/Chrome, seamless
MP3 loop, production-host or release-performance result is implied.
