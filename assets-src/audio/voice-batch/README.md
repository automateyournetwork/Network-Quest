# Producing and checking the Underworld voices

Each allocation has twenty authored lines. The renderer checks the line IDs, text hashes, pinned Kokoro weights and the speaker tensor against the T065 run. It leaves the accepted auditioned web files in place. The script files contain the exact visible wording, including punctuation. The optional per-batch `delivery.json`, `speeds.json` and `takes.json` map a three-digit line number to its directed text, voice speed and alternate take ID. Keep a superseded take separately before regenerating. Each batch supplies its own `NOTICE.md` and a `cues.json` mapping every line number to a listening target.

Run these steps from the repository root with the project Kokoro environment, FFmpeg and pinned Node runtime. Set `task=T129`, `T130` or `T131` for the assigned batch.

```sh
export HF_HUB_OFFLINE=1
export HF_HOME="$PWD/.runtime/media/cache/huggingface"
export PYTHONDONTWRITEBYTECODE=1
py=.runtime/media/kokoro-env/bin/python
node=.runtime/node-v26.13.1-darwin-arm64/bin/node
"$py" assets-src/audio/voice-batch/generate.py "$task"
```

For a new line import the 48 kHz prepared mono WAV in Audacity 4.0.2 under its filename stem, such as `voice-004`. Save the project, close the app, reopen the project in another process, and export the full project to signed PCM24 at 48 kHz mono. The existing native automation checks the track label and export settings, hashes the original and reopened project and verifies SQLite integrity. Run it in the dedicated studio with the assigned display. Keep the resulting `.aup4`, WAV and `voice-NNN-native.json` in this batch's `projects/`, `masters/` and `records/` directories. [Native workflow](../T124/native-studio.md) · [Native script](../T124/native-roundtrip.py)

```sh
"$py" assets-src/audio/voice-batch/prepare-review.py "$task"
"$node" assets-src/audio/voice-batch/verify-browser.mjs "$task"
"$py" assets-src/audio/voice-batch/transcribe.py "$task"
"$py" assets-src/audio/voice-batch/transcribe.py "$task" --recheck
python3 assets-src/audio/voice-batch/build-fragment.py "$task"
```

The transcription step reads the weights and processor files staged in `.runtime/media/models/whisper-base.en` from the linked pinned snapshot. It verifies the exact model-file digest. Speech recognition reads only each decoded final MP3. The optional second pass revisits clips that differed from the written text and uses five beams. Preserve the recognizer's actual words and interpret discrepancies against delivery and human testimony. [Pinned Whisper model and processor files](https://huggingface.co/openai/whisper-base.en/tree/911407f4214e0e1d82085af863093ec0b66f9cd6)

Open the batch's local `review.html` for the human listening pass. The packet seal identifies exact track, caption and page bytes. Record the line ID, issue or acceptance and physical playback devices against that seal. The fragment retains the original T065 evidence for exact reused clips. New records remain exported until the applicable reviews, real dialogue bindings and integration checks have passed.

Original tooling copyright 2026 John Capobianco, Apache-2.0. Third-party license snapshots in `rights/` retain their component licenses.
