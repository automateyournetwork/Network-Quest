# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Documented Audacity 3.x named-pipe roundtrip. Run only in isolated empty session."""
from pathlib import Path
import json
import os
import select
import sys
import time

OUT = Path(__file__).resolve().parent
uid = os.getuid()
reader = os.open(f"/tmp/audacity_script_pipe.from.{uid}", os.O_RDONLY | os.O_NONBLOCK)
writer = os.open(f"/tmp/audacity_script_pipe.to.{uid}", os.O_WRONLY | os.O_NONBLOCK)
phase = sys.argv[1] if len(sys.argv) > 1 else "create"
transcript = []

def command(value):
    start = time.perf_counter()
    os.write(writer, (value + "\n").encode())
    data = b""
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if select.select([reader], [], [], 1)[0]:
            data += os.read(reader, 65536)
            if data.endswith(b"\n\n"):
                break
    result = data.decode()
    transcript.append({"command": value.replace(str(OUT), "${SOURCE_DIR}"), "response": result.replace(str(OUT), "${SOURCE_DIR}"), "seconds": time.perf_counter()-start})
    (OUT / f"audacity-{phase}.json").write_text(json.dumps(transcript, indent=2) + "\n")
    assert "BatchCommand finished: OK" in result and "Command not found" not in result, result
    print(value, result, flush=True)

command("GetInfo: Type=Tracks")
if phase == "create":
    command(f'Import2: Filename="{OUT / "kokoro-narrator-raw.wav"}"')
    command("SelectAll:")
    command("Amplify: Ratio=0.707945784 AllowClipping=0")
    command(f'SaveProject2: Filename="{OUT / "narrator-smoke.aup3"}" AddToHistory=0')
    command("GetInfo: Type=Tracks")
    command("Close:")
elif phase == "export":
    # Restart the isolated Audacity executable with narrator-smoke.aup3 as a
    # command-line argument before this phase. Closing the last project then
    # issuing OpenProject2 stalled in this build; the timeout is preserved.
    command("SelectAll:")
    # This Mac build's PCM exporter produces AIFF using its saved preferences.
    # The first trial used .wav; header inspection corrected its name afterward.
    command(f'Export2: Filename="{OUT / "narrator-audacity-master.aiff"}" NumChannels=1')
    command(f'Export2: Filename="{OUT / "narrator-web.ogg"}" NumChannels=1')
    command("Close:")
else:
    raise ValueError(phase)
os.close(reader)
os.close(writer)
