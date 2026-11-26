# T005 — local media feasibility

Observed 2026-11-25 on the owner's Mac by Codex, loop 007. Scope: C5/C11/C13,
FR-017/018/021, NQ-09 and the media part of W01/G0. **T005 accepted on 2026-11-26
after stronger T063/T065 native4 and actual human-listening evidence.** The original
2026-11-25 observations below are retained, including their then-pending checks.
This does not pass G0/G3/G5, approve a production voice/music choice, or contribute
any finished room, character, prop, image, music, effect or voice-line count.

## Actual machine and installation boundary

- macOS 26.6.2 (25G83), arm64; Apple M4 Pro, 14 CPU cores, 48 GB unified memory.
- Free disk before downloads: about 217 GiB; final evidence snapshot: about 202 GiB.
  `.runtime/media/` occupies about 14 GiB, including about 2.1 GiB of package/cache
  data. These are approximate `df -h`/`du -sh` observations, not quotas.
- Existing Blender and Audacity 4 installations were not replaced. Python 3.12.12
  was selected explicitly from Homebrew; default Python 3.14.6/PATH were unchanged.
  uv 0.10.12 created isolated environments. Models, installed third-party code,
  Audacity 3 and caches remain Git-ignored under `.runtime/media/`.
- No provider keys, cloud audio generation, remote deployment or paid service was
  used. No external audio, reference recording, artist imitation or voice clone
  was supplied. Source fixtures/evidence total about 8.3 MiB.

## Observed results

| Component | Actual test and result | Measured resources |
| --- | --- | --- |
| Blender 5.2.1 LTS, build `9e2066aef7ef` | Created `signal-socket.blend`; reopened in a second headless process; rendered PNG and exported GLB; imported GLB in a third fresh process. Six mesh objects survive; imported export has 4,512 vertices / 2,236 triangles. PASS. | Create 1.17 s; reopen/render/export 1.38 s; GLB import 0.54 s. Reopen peak RSS 858,800,128 bytes; macOS peak footprint 710,002,344 bytes. |
| Installed Audacity 4.0.0, build `262451605` | Version rechecked. Native `.aup4` roundtrip not executed: no available CUA surface, and Audacity 4 removed the legacy pipe. This is not a fabricated `.aup4` test. | Not measured; metadata alone is not execution evidence. |
| Isolated Audacity 3.7.9 arm64, build `3.7.9.0` | Imported generated narration, applied amplitude ratio 0.707945784 (−3 dB), saved real `.aup3`, closed, reopened with the executable in a fresh process, queried the 8.25 s track, exported native PCM audio and Ogg. SQLite integrity check `ok`. PASS for fallback. | Last sampled app RSS 163,696 KiB; not a peak measurement. The export **driver** took 0.15 s / 16,809,984-byte max RSS; that is not Audacity's whole-process memory or startup time. |
| Kokoro 0.9.4 / Kokoro-82M v1.0 / `af_heart` | Original 25-word English script generated on CPU, four threads, speed 1.0. Actual 8.25 s mono 24 kHz float WAV. PASS for local generation. | Initialization 3.249 s; generation 0.605 s; complete process 6.38 s. Max RSS 1,880,358,912 bytes; peak footprint 1,794,672,896 bytes. |
| ACE-Step 1.5.0, source `ca1e85fe9430179831e6bc6be790c332190a3866` | Local `acestep-v15-turbo`, native MLX DiT and VAE, MPS text encoder; one original 10 s instrumental prompt, eight steps, seed 20261125, batch one, LM/thinking disabled. Actual stereo 48 kHz float WAV. PASS for local generation. | Initialization 50.284 s; generation 10.549 s; complete cold process 95.53 s. Max RSS 13,750,108,160 bytes; macOS peak footprint 29,817,003,088 bytes. |

Memory measures are from `/usr/bin/time -l` except the explicitly labeled Audacity
RSS sample. Metal/unified memory footprint and resident set are different measures;
the larger ACE footprint is material on this 48 GB Mac. Do not extrapolate this
single ten-second run to full songs, batch generation or simultaneous model jobs.
ACE's initial imports/font cache and model setup explain why full-process time is
longer than its reported generation stage. No warm-run benchmark was performed.

Kokoro used PyTorch 2.15.0, Transformers 5.24.1, Misaki 0.9.4, spaCy 3.8.18,
`en_core_web_sm` 3.8.0, SoundFile 0.14.0, phonemizer-fork 3.3.2 and
espeakng-loader 0.2.4 / loaded eSpeak-NG 1.52.0. ACE used PyTorch 2.10.0,
Transformers 4.57.6, Diffusers 0.37.1, MLX 0.30.6, mlx-lm 0.29.1 and SoundFile
0.13.1. Full installed version inventories and selected license-file hashes are
preserved under [the fixture directory](../../../assets-src/feasibility/README.md).

## Inspection, corrections and limitations

1. **Visual inspection was real.** Viewed the PNG rendered from the reopened
   `.blend`. The first render showed an unintended white ring/pins because their
   shader nodes lacked the requested color. Set explicit shader colors and reran
   all three Blender stages. Final preview shows a teal socket, copper-colored
   ring and four pins, with no missing geometry. It is a simple diagnostic model,
   not production art. Browser appearance/performance and animation were not tested.
2. **Audacity automation needed a genuine fallback.** The existing research R11
   permits isolated tested 3.x when automation requires it. Used the official
   [3.7.9 release](https://github.com/audacity/audacity/releases/tag/Audacity-3.7.9),
   [portable settings](https://manual.audacityteam.org/man/portable_audacity.html)
   and documented [scripting commands](https://manual.audacityteam.org/man/scripting_reference.html).
   First launch registers module paths and changes pipe status; a bounded restart
   with the discovered path enabled the pipe. `OpenProject2` after closing the last
   window then timed out after 30 s. Reopening the saved file as an executable
   argument in a fresh process worked. Both failure and successful command replies
   remain in the fixture evidence. No GUI interactions were invented.
3. **File contents, not extensions, were verified.** Audacity reported WAV for
   `narrator-master.wav`, but SoundFile and its `FORM` magic identified AIFF PCM16
   at the project's default 44.1 kHz. Preserved those bytes as
   `narrator-audacity-master.aiff`; FFmpeg 9.0.1 made a correctly identified PCM24
   WAV and MP3 derivative. Conversion adds no fidelity. Original 24 kHz float
   generation and `.aup3` are retained. Ogg is the actual Audacity export.
4. **Local generation was exercised.** Initial Kokoro run stopped because spaCy's
   automatic model installer could not identify its virtual environment. Explicit
   `VIRTUAL_ENV`/`UV_CACHE_DIR` fixed that; no global Python package install was used.
   ACE's initializer also downloaded the default 1.7B LM weights even though this
   request disabled LM inference. They are inventoried as downloaded but unused;
   no LM capability or quality is claimed. Downloaded weight hashes match the
   pinned repository metadata. ACE syncs its model Python implementation from the
   recorded code revision; local post-sync hashes are preserved.
5. **Signal inspection is not listening.** All delivered decoded samples are finite,
   non-silent and below full scale. Duration/channel/rate/magic/peak/RMS evidence is
   in `audio/signal-checks.json`. Nobody's headphone/speaker listening, technical
   pronunciation rating, music originality judgment, noise/artifact rating or
   owner satisfaction is claimed. The original narration script remains readable.

Audacity 3's first launch logged a reset of microphone approval for its own
`org.audacityteam.audacity` bundle ID. Its first temporary project used the default
Audacity SessionData path; subsequent launch used the isolated temporary directory.
No recording was performed. Portable app processes were stopped after saving and
closing the fixture; the tools and sources remain available.

## Component and output rights inspected

| Component | Inspected basis and bounded conclusion |
| --- | --- |
| Original fixture modeling/scripts/text | Original work for Network Quest; scripts Apache-2.0, authored geometry/text/edits CC BY 4.0 to the extent project-controlled. No third-party visual reference or imported geometry. |
| Blender / Audacity / FFmpeg | Installed Blender copyright and bundled license register; Audacity 3.7.9 `LICENSE.txt` (GPLv3, individual-file exceptions); FFmpeg 9.0.1 build flags include GPL/version3. These are production tools, not bundled game libraries. Their code licenses do not by themselves impose a license on independent project media. Preserve tool notices if redistributing the tools; this fixture does not do so. |
| Kokoro code/model/selected voice | Inspected [code license](https://github.com/hexgrad/kokoro/blob/main/LICENSE), pinned [model card](https://huggingface.co/hexgrad/Kokoro-82M/blob/f3ff3571791e39611d31c381e3a41a3af07b4987/README.md) and [voice register](https://huggingface.co/hexgrad/Kokoro-82M/blob/f3ff3571791e39611d31c381e3a41a3af07b4987/VOICES.md). Apache-2.0 model/repository; selected `af_heart` matches the published hash prefix. Card describes permissive/synthetic training and separately credits CC BY datasets. The voice page does not supply an individual speaker consent record for `af_heart`; neither copyright exclusivity nor a stronger voice-rights guarantee is inferred. No separate noncommercial output condition was found in the inspected card/license. |
| TTS preprocessing | Misaki Apache-2.0; spaCy and its English model declare MIT; the model's separately preserved `LICENSES_SOURCES` identifies licensed OntoNotes training and WordNet attribution/notice conditions. Phonemizer-fork GPLv3; espeakng-loader MIT wrapper with eSpeak-NG 1.52.0 GPLv3 library. Copied actual license texts. The wrapper's MIT label does not relicense the bundled native library. All remain local tooling. |
| ACE code/weights/output | Inspected [MIT code license](https://github.com/ace-step/ACE-Step-1.5/blob/ca1e85fe9430179831e6bc6be790c332190a3866/LICENSE), [pinned model card](https://huggingface.co/ACE-Step/Ace-Step1.5/blob/19671f406d603126926c1b7e2adc169acbcade22/README.md) and code README's originality/rights caution. The card identifies MIT and expressly permits commercial use of generated music. It describes licensed/synthetic training; this is the publisher's representation, not an independent audit of every recording. Original prompt uses no artist/song/reference audio. Output still needs listening/originality review; no exclusive copyright guarantee. |
| ACE text embedding | [Qwen3-Embedding-0.6B upstream card](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) declares Apache-2.0; copied ACE-bundled weight hash is recorded separately. An attempted standalone model LICENSE fetch returned 404, so a separate license-file inspection is not claimed. |

Selected license texts and retrieval outcomes are in `assets-src/feasibility/licenses/`.
Environment JSON inventories record transitive package identities/license metadata
and concrete installed license-file hashes; they are **not** a completed release
redistribution audit of every optional training/UI dependency. No production
release or blanket rights clearance follows this local feasibility run. Preserve
model/voice attribution and these limitations when deciding the eventual asset license.

## Sources, reproduction and remaining acceptance

See [fixture README](../../../assets-src/feasibility/README.md), original scripts,
native sources, `model-provenance.json`, `process-observations.json`, actual command
replies and `sha256-manifest.json`. Model revisions:

- Kokoro `f3ff3571791e39611d31c381e3a41a3af07b4987`;
  model SHA-256 `496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4`;
  voice SHA-256 `0ab5709b8ffab19bfd849cd11d98f75b60af7733253ad0d67b12382a102cb4ff`.
- ACE weights `19671f406d603126926c1b7e2adc169acbcade22`;
  turbo SHA-256 `3f6e0797fad420a39bd33979eb6e840e30989e34a3794e843d23b60ec6e422d7`.
  VAE, embedding, downloaded unused LM and local model-code hashes are in the manifest.

**Remaining input:** a real listener must audition narration and music, record
headphone/speaker equipment and observations, and accept/reject these candidates.
Until then T005's listening portion stays pending. T065 still owes the full
narrator/Titan/Photon/Hermit audition and production review.

The production `.aup4` contract remains unchanged. Audacity
[4.0.0 removed automation](https://www.audacityteam.org/changelog/4.0.0/), and
[4.0.2 fixes project/export defects](https://www.audacityteam.org/changelog/4.0.2/).
Before production, obtain an available native UI/human operator and test a supported
4.x patch with real `.aup4` reopen/export. A broader 3.x production choice would
require an explicit synchronized plan/provenance change; this smoke fallback does
not make that choice. No OpenAI image-generation audition was part of T005.

## Coordinator reassessment — 2026-11-26

T005 is accepted for media feasibility using the original technical smoke plus
stronger actual representative production evidence. The original two smoke clips
were not reported heard and are not retroactively marked approved. The original
sources and failure history remain unchanged and do not count as finished assets.

[T063](../../implementation/loops/068-T063.md) exercised real Blender5.2.1 sources,
14 fresh GLB imports and native Firefox/source pose comparison. [T065](audio-auditions.md)
then exercised genuine Audacity4.0.2 save, close, fresh-process reopen and twelve
PCM24 exports from its 21,823,488-byte `.aup4`. Root independently checked the
project's immutable SQLite integrity, its unchanged SHA256 and all207 sealed files;
reran48-file signal decoding and twelve correct-input/native-master comparisons.
All pass. Three one-sample-short masters and export dither remain disclosed.

The actual four-voice Kokoro batch and twenty-second ACE-Step excerpt have exact
versions, pinned model/voice terms and measured runtime/memory, preserving the
prior disk/environment inventories. This is a bounded feasibility result, not a
full-song or parallel-production capacity guarantee. The official isolated4.0.2
patch and three small voice embeddings are documented in T065, with existing apps
and model environments preserved.

John Capobianco accepted all twelve frozen production auditions: “it all sounds
good to me yes”, then “built in mac speakers” and “headphones were good too earbuds”.
The [sealed listening record](../../../assets-src/audio/auditions/provenance/owner-listening.json)
binds the exact preview bytes and user-reported equipment. Brand/model and volume
were not supplied. No source-project listening, older smoke audition or detailed
per-clip scoring is invented. This real representative listening resolves the
previous missing feasibility capability; the old pending question is superseded.

G0 remains blocked by host retention/package and provider configuration evidence.
Full R01 owner review, final media counts and whole-episode listening remain later
requirements. No aggregate gate or production release passes by accepting T005.
