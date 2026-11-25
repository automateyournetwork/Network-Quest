# Feasibility fixtures — never counted as finished assets

Created 2026-11-25 for T005. No fixture is integrated into the game or approved as
production art/audio. Source generation is genuine; human listening is pending.
See [the evidence report](../../docs/evidence/spec001/media-feasibility.md).

## Reviewable outputs

- [Blender render](blender/reopened-render.png), [native scene](blender/signal-socket.blend),
  [GLB](blender/signal-socket.glb). Original geometry; Blender render, not AI imagery.
- [Raw Kokoro narration](audio/kokoro-narrator-raw.wav), [readable script](audio/narrator-script.txt),
  [Audacity 3 native project](audio/narrator-smoke.aup3), [native AIFF export](audio/narrator-audacity-master.aiff),
  [derived WAV master](audio/narrator-master.wav), [MP3](audio/narrator-web.mp3),
  [Audacity Ogg](audio/narrator-web.ogg).
- [Raw ACE instrumental](audio/ace-output/df548503-cbc2-d030-3ea8-bed034171b85.wav),
  [MP3 derivative](audio/ace-web.mp3), [exact request](audio/ace-request.json).
  It is generated music, not MIDI composition, recorded performance or stems.

## Reproduction boundary

Use the preserved Python scripts and exact package versions in `*-environment.json`.
Install dependencies/models separately under ignored `.runtime/media/`; no private
generation service or account is required. `model-provenance.json` provides model
repository revisions, file hashes and upstream LFS comparisons. Do not copy installed
tool binaries into public game assets. Seed/platform versions document a run but do
not promise cross-platform bit-identical generation.

Blender commands, from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python assets-src/feasibility/blender/smoke.py -- create
/Applications/Blender.app/Contents/MacOS/Blender --background assets-src/feasibility/blender/signal-socket.blend --python assets-src/feasibility/blender/smoke.py -- reopen
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python assets-src/feasibility/blender/smoke.py -- inspect-export
```

For voice: run `audio/kokoro-smoke.py` with the isolated Kokoro Python, explicit
`VIRTUAL_ENV`, `UV_CACHE_DIR` and `HF_HOME` under `.runtime/media/`. For music: run
`audio/ace-smoke.py` with ACE's isolated Python, `HF_HOME`, `MPLCONFIGDIR` and
`PYTORCH_ENABLE_MPS_FALLBACK=1`. Model and output paths are rooted relative to the scripts.
The report records the exact code revision; ACE's frozen `uv.lock` was used.

For Audacity, use the official isolated 3.7.9 app with a `Contents/Portable Settings`
directory and enabled `mod-script-pipe`. The first registered module path must be
present before re-enabling/restarting. Run `audio/audacity-smoke.py create` in an
empty **isolated** session/output copy; restart the executable with the resulting
`.aup3` path and run `audio/audacity-smoke.py export`. Do not run this against a
user's existing editing session or overwrite these evidence files casually.

The historical `audacity-roundtrip.json` preserves the first timed-out in-process
open attempt. `audacity-create.json` and `audacity-export.json` contain the actual
successful stages. The successful export command named the PCM file `.wav`, but
header inspection found AIFF; its bytes were renamed `.aiff`. FFmpeg 9.0.1 commands
then created these correctly typed derivatives. The preserved script now names
future native exports `.aiff` directly; the historical replies remain unchanged:

```sh
ffmpeg -nostdin -v error -i assets-src/feasibility/audio/narrator-audacity-master.aiff -c:a pcm_s24le assets-src/feasibility/audio/narrator-master.wav
ffmpeg -nostdin -v error -i assets-src/feasibility/audio/narrator-master.wav -c:a libmp3lame -b:a 128k assets-src/feasibility/audio/narrator-web.mp3
ffmpeg -nostdin -v error -i assets-src/feasibility/audio/ace-output/df548503-cbc2-d030-3ea8-bed034171b85.wav -c:a libmp3lame -b:a 192k assets-src/feasibility/audio/ace-web.mp3
```

`process-observations.json` contains actual run timing/memory; `audio/signal-checks.json`
contains format/signal observations. Neither certifies listening. `sha256-manifest.json`
hashes each preserved fixture/evidence file except itself.

Original scripts: Copyright 2026 John Capobianco, Apache-2.0. Original authored
geometry, text and edits: CC BY 4.0 to the extent controlled by the project.
Generated voice/music include the recorded third-party model provenance; no
exclusive copyright or individual speaker consent claim is made. Third-party
license texts retain their own terms. Full downstream release review is pending.
