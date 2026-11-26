# T065 — project audio auditions

Date: 2026-11-26. Scope: C5/C10/C11/C13/C14, FR-018, AC10; one bounded audition
batch. **T065's source generation, native 4 roundtrip, representative audition and
human listening are executed.** No G3, bulk-production, runtime-library or release
acceptance is claimed. Coordinator owns final task acceptance and shared manifest.

## Actual candidates and listening

[Open the frozen twelve-clip packet](../../../assets-src/audio/auditions/review.html).
Exact packet ID: `t065-listening-20261126-a`; [seal](../../../assets-src/audio/auditions/provenance/review-packet-seal.json)
SHA256 `89e98ccf375c685164ba63b046a9c8daf17286cb8e0fa171d3a74e7900e6f3e0`.
It binds 12 original WAVs, 12 MP3 s, eight exact scripts and the review HTML.

| Speaker / purpose | Actual local candidate | Exact project line IDs / duration |
| --- | --- | --- |
| Narrator | Kokoro `af_heart`, speed 0.85 | VOICE-001 — 6.950 s; VOICE-005 — 8.250 s |
| Titan | Kokoro `am_michael`, speed 0.82 | VOICE-019 — 9.225 s; VOICE-025 — 8.150 s |
| Photon | Kokoro `af_bella`, speed 0.96 | VOICE-035 — 8.100 s; VOICE-042 — 8.875 s |
| Hermit | Kokoro `am_fenrir`, speed 0.85 | VOICE-051 — 7.250 s; VOICE-057 — 8.725 s |
| Title-theme excerpt | Actual ACE-Step 1.5 turbo inference | MUSIC-title — 20.000 s, one-shot ending excerpt; not an approved loop/full cue |
| Interface activation tick | Original AI-assisted NumPy synthesis | EFFECT-001 — 0.160 s; activation, not every Tab focus |
| Lift latch and weight settle | Original AI-assisted NumPy synthesis | EFFECT-013 — 1.400 s |
| Photon inspection glimmer | Original AI-assisted NumPy synthesis | EFFECT-023 — 1.800 s; decorative, no correctness state |

All IDs above have the `spec001:ASSET-` prefix. Spoken caption/line IDs are
`spec001:DIALOGUE-VOICE-NNN`. The exact script text and hashes match the reviewed
production plan. No line was silently rewritten or cloned from a performer.

Actual owner feedback, in order, was: **“it all sounds good to me yes”**,
**“built in mac speakers”**, and **“headphones were good too earbuds”**.
[The listening record](../../../assets-src/audio/auditions/provenance/owner-listening.json)
identifies John Capobianco, date, both methods, exact quotes and sealed scope.
Brand/model, volume and a per-clip scoring rubric were not supplied; none is
invented. The owner accepted the twelve fixed candidates and four voice choices.
No repeated approval was requested after those confirmations.

The human reviewed the frozen MP3 packet. Hashes of the raw/prepared/native source
lineage are bound separately; this does not claim the owner opened Audacity or
listened to all tracks simultaneously. All previews remain byte-identical after
native-source work. In-game mix, ducking, looping and lifecycle need their later
integration reviews.

## Generation and technical wording

Kokoro 0.9.4 / Kokoro-82M v1.0, revision
`f3ff3571791e39611d31c381e3a41a3af07b4987`, ran locally on CPU with four threads.
Eight lines total 65.525 s; load 1.455 s; full process 10.38 s; maxRSS 2,763,767,808 bytes;
peak footprint 2,680,507,248 bytes. The four distinct embedding hashes match the
pinned upstream LFS records. Three needed embeddings were each about523 KB;
the existing 82M model and dependencies were reused.

Canonical script and actual G2P phonemes preserve spoken hexadecimal “four E,
five one”, separate “S F P”, and distinct “D B M” / “D B”. Photon says propagation
modes do not guarantee independent payload channels; Titan distinguishes physical
link success from application health. No phoneme overrides were needed. This is
text/phoneme inspection, not inferred listening. Actual broad quality acceptance
comes from the owner feedback above. Full-line technical coverage remains part of
later voice batches. Measured pacing ranges approximately110–153 words/minute;
Titan and Photon samples are slower than some proposed targets, and the owner
accepted these fixed auditions. Do not silently speed them up after approval.

ACE-Step 1.5.0 code revision `ca1e85fe9430179831e6bc6be790c332190a3866`, weights
`19671f406d603126926c1b7e2adc169acbcade22`, actually generated the original theme
prompt. Turbo MLX DiT/VAE with MPS text encoder, eight steps, seed 20261126,
batch one, thinking/language-model inference disabled. The untouched output is
stereo48 kHz float WAV. Load15.763 s, inference 7.438 s, full process 29.57 s;
maxRSS 14,378,614,784 bytes; peak footprint 37,941,992,264 bytes. Loop 068 deferred
heavy Blender rendering for this reserved interval. No full-song resource estimate
is extrapolated. No new model or redundant environment was installed.

The three effects are honestly labeled synthesized, not model-generated or recorded.
Preserved NumPy 2.5.5/SoundFile 0.14.0 code, seed, resonator/envelope parameters and
raw float renders constitute their original editable design. No MIDI or separated
stems were fabricated.

## Genuine native 4 source and exports

[The native project](../../../assets-src/audio/auditions/projects/audition-bank.aup4)
was saved by actual Audacity 4.0.2 on this Mac, closed, reopened in a new app process
and exported as twelve separate named tracks. It is an editable audition bank:
solo one track; the simultaneous sum is not an authored mix. Native-file size is
21,823,488 bytes. SHA256 remained
`3d17afa984c7ef855b7cd9bee434502c433f5a4ad28099a1b7e61043c6358d35`
before and after the fresh reopen/export. Both immutable SQLite integrity checks
returned `ok`; no journal sidecars remain in the source tree.

The installed 4.0.0 app was preserved. Official isolated 4.0.2 arm64 package
50,030,766 bytes was downloaded under ignored `.runtime/media/tools`, matching
GitHub release SHA256
`fd462da6204cbf9758b44c7ce1c29d5fe5cab4f31ba308d33c125f1b170401c3`.
[Official 4.0.2 notes](https://www.audacityteam.org/changelog/4.0.2/) identify project
and Save As fixes. The actual 4.0.2 app version was checked. No Audacity 3 project
was relabeled or used as production source.

Native macOS accessibility was available although CUA was not. Actual System Events
menus/native file dialogs and CoreGraphics mouse events used observed Audacity
labels/coordinates. Qt custom controls needed explicit window raising and mouse
movement before clicking; merely reporting an AX click was insufficient. Early
persistent AppleScript observations became stale, and one wrong duplicate import
was caught by actual track names. A later observation found the unsaved attempt closed; exact source
inputs remained intact. The bank was rebuilt from those inputs. The final bank contains twelve distinct correct tracks,
verified in a fresh process and by exported sample identity. Failed attempts,
screenshots and raw logs remain under ignored `.local/T065`; bounded failure
history and hashes are public in [native-roundtrip.json](../../../assets-src/audio/auditions/provenance/native-roundtrip.json).

[Masters](../../../assets-src/audio/auditions/masters/) are actual native PCM24 WAV,
48 kHz: eleven mono voices/effects and stereo music. Initial stereo speech exports
were retained privately; explicit mono export corrected them. Native masters were
compared to their own prepared inputs, not just checked by filename. All overlapping
samples differ by less than 1.13e-6 absolute amplitude, consistent with the recorded
24-bit export quantization/dither. VOICE-019,035,057 end one sample early
(20.83 microseconds); this is preserved and disclosed, with no bit-identity or
inferred audibility claim. The approved web previews are unchanged.

FFmpeg 9.0.1 preparation preserves raw sample rates, then creates48 kHz float inputs
using actual two-pass normalization and stated title edge fades. Resampling does
not add fidelity. Native voice masters measure −18.67 to−17.72 LUFS; frozen voice
MP3s −19.12 to−18.16 LUFS; music MP3 −23.24 LUFS. The highest voice web true peak is
−1.43 dBTP. The short activation tick has undefined integrated loudness, retained as
null rather than forced to a fictitious LUFS value. Exact per-file peak/true-peak,
frames, codecs, hash/bytes and all render arguments are preserved in provenance.
Loop bounds are null; no seamless MP3 loop is claimed.

## Rights, verification and remaining integration

[Rights notice](../../../assets-src/audio/auditions/rights/NOTICE.md) and snapshots
retain exact selected voices, model/code terms and limitations. Kokoro's pinned
[model card](https://huggingface.co/hexgrad/Kokoro-82M/blob/f3ff3571791e39611d31c381e3a41a3af07b4987/README.md)
declares Apache-2.0 and publisher training representations; no individual speaker
consent record or exclusive generated-output copyright is inferred. ACE's pinned
[model card](https://huggingface.co/ACE-Step/Ace-Step1.5/blob/19671f406d603126926c1b7e2adc169acbcade22/README.md)
identifies MIT and permits commercial generated music. Original text/direction and
synthesis use the project licenses. No borrowed reference audio, named artist,
real-person imitation or unlicensed imported effect was used.

Executed checks:

- Forty-eight raw/prepared/native-master/web files decode finite, nonzero and below
  full scale; twelve native masters match their correct prepared candidates.
- The full frozen 33-file listening seal verifies unchanged. Candidate inventory
  schema and semantic audit pass with zero counted assets and no false runtime use.
- Native Firefox 159.0/Playwright 1.65.1, strict trusted loopback HTTPS with
  `ignoreHTTPSErrors:false`, fetched all twelve exact MP3 hashes. HTMLMediaElement
  metadata and WebAudio decode succeeded for all. The disposable browser/server/
  trust profile closed; this is not a Safari/Chrome or production-host result.
- Genuine native 4 close/fresh-process reopen/export and actual speaker/headphone
  listening are separately recorded. No waveform/metrics result stands in for a
  human audition.

The [candidate fragment](../../../assets-src/audio/auditions/manifest-candidates.json)
uses exported/nonquota status; shared manifest and runtime bindings belong to the
coordinator/T066. Later tasks still owe full cues/loops, ambience, remaining effects
and 52spoken lines, in-game gesture/skip/replay/ducking/pause/disposal, cross-browser
and measured G3 acceptance. No publication, provider configuration or next episode
was performed by T065.
