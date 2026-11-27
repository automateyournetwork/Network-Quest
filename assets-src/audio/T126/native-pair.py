# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Assemble two independent room stems in the Audacity 4 studio and verify reopening."""
import importlib.util
import json
from pathlib import Path
import sys
import time

root = Path.cwd()
spec = importlib.util.spec_from_file_location('single',root/'native-roundtrip.py')
studio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(studio)
bed, foley = sys.argv[1:]
assert bed.startswith('r') and foley[:4]==bed[:4]
original = studio.open_audio
tracks = {}

def open_pair(path, tag, root, slug):
    proc, pid, first = original(path,tag,root,slug)
    if tag == 'create':
        studio.x('key','ctrl+shift+i')
        studio.wait(lambda: 'Audacity' not in studio.active() and studio.active(), 'audio import dialog')
        studio.x('key','ctrl+l')
        studio.replace(root/'prepared'/(foley+'.flac'))
        studio.x('key','Return')
        time.sleep(.55)
        if studio.active()=='Open':
            studio.x('key','Return')
    other = studio.wait(lambda: next((n.name for n in studio.nodes()
                        if n.name.startswith('Track 2: '+foley+', audio track')),None), 'second named layer')
    tracks[tag] = [first,other]
    return proc, pid, first

original_wait = studio.wait
def wait_for_window(check, description):
    if description != 'master written':
        return original_wait(check, description)
    def exported():
        if (root/'masters'/(bed+'.wav')).is_file() and not studio.active():
            # The isolated window manager occasionally drops focus after export.
            # Give it back only to this exact saved project.
            import subprocess
            search = subprocess.run(['xdotool','search','--onlyvisible','--name',bed+'.*Audacity'],
                                    capture_output=True,text=True)
            matches = search.stdout.splitlines()
            if len(matches)==1:
                studio.x('windowactivate', matches[0])
        return check()
    return original_wait(exported, description)

studio.wait = wait_for_window
studio.open_audio = open_pair
studio.run(bed,'Stereo')
receipt = root/(bed+'-native.json')
record = json.loads(receipt.read_text())
record['tracksAtCreation'] = tracks['create']
record['tracksAfterReopen'] = tracks['reopen']
record['secondSourceSha256'] = studio.sha(root/'prepared'/(foley+'.flac'))
receipt.write_text(json.dumps(record,indent=2)+'\n')
