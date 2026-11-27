# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Import two aligned mono Foley layers, save/reopen the project, and mix to PCM24."""
import importlib.util
import json
from pathlib import Path
import re
import sys
import time
from gi.repository import GLib

root = Path.cwd()
spec = importlib.util.spec_from_file_location('studio', root/'native-roundtrip.py')
studio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(studio)
first, second = sys.argv[1:]
assert re.fullmatch(r'fx\d\d-[a-z-]+',first) and second[:5] == first[:5] and first != second
observed_tracks = {}
open_one = studio.open_audio

# A modeless Qt import dialog may disappear while AT-SPI is enumerating its children.
# Retry that specific stale accessibility snapshot. A missing track still times out.
original_nodes = studio.nodes
def stable_nodes():
    for attempt in range(6):
        try:
            return original_nodes()
        except GLib.GError as exc:
            if 'does not exist' not in str(exc) or attempt==5:
                raise
            time.sleep(.05)
studio.nodes = stable_nodes

def open_two(path, tag, root, slug):
    process, pid, track_one = open_one(path, tag, root, slug)
    if tag == 'create':
        studio.x('key', 'ctrl+shift+i')
        studio.wait(lambda: studio.active() and 'Audacity' not in studio.active(), 'Import Audio dialog')
        studio.x('key', 'ctrl+l')
        studio.replace(root/'prepared'/(second+'.wav'))
        studio.x('key','Return')
    track_two = studio.wait(lambda: next((node.name for node in studio.nodes()
        if node.name.startswith('Track 2: '+second+', audio track')), None), second)
    observed_tracks[tag] = [track_one,track_two]
    return process,pid,track_one

studio.open_audio = open_two
studio.run(first, 'Mono')
receipt = root/(first+'-native.json')
record = json.loads(receipt.read_text())
record.update(tracksAtCreation=observed_tracks['create'], tracksAfterReopen=observed_tracks['reopen'],
              secondSourceSha256=studio.sha(root/'prepared'/(second+'.wav')))
receipt.write_text(json.dumps(record,indent=2)+'\n')
