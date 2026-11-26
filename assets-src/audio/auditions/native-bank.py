# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Bounded native4 import, fresh accessibility process per observation.

Start with a new task project and its Import dialog last used in mix-inputs.
Only exact filenames from candidate-index.json may be selected. Never use on a
user editing session. An existing named track is skipped, not duplicated.
"""
from pathlib import Path
import json
import subprocess
import time

OUT=Path(__file__).resolve().parent
def ax(body):
    script='with timeout of 8 seconds\ntell application "System Events"\ntell process "Audacity"\n'+body+'\nend tell\nend tell\nend timeout'
    result=subprocess.run(['/usr/bin/osascript','-e',script],capture_output=True,text=True,timeout=12)
    if result.returncode:raise RuntimeError(result.stderr)
    return result.stdout.strip()
def wait(predicate):
    end=time.monotonic()+12
    while time.monotonic()<end:
        if predicate():return
        time.sleep(.2)
    raise TimeoutError('Native UI did not reach the expected state; inspect before resuming.')
def tracks():return ax('get name of groups of window 1')
def has_track(slug):return ': '+slug+', audio track' in tracks()
def quote(value):return json.dumps(value,ensure_ascii=False)
rows=json.loads((OUT/'provenance/candidate-index.json').read_text())
for row in sorted(rows,key=lambda r:r['slug']):
    slug=row['slug']
    if has_track(slug):
        print('Already observed exact track:',slug,flush=True);continue
    ax('set frontmost to true\nperform action "AXRaise" of window 1\nclick menu item "Import…" of menu 1 of menu bar item "File" of menu bar 1')
    wait(lambda:ax('get exists window "Open"')=='true')
    ax('''if value of pop up button "Where:" of splitter group 1 of window "Open" is not "mix-inputs" then error "Wrong directory"
set foundFile to false
repeat with r in rows of outline 1 of scroll area 1 of splitter group 1 of splitter group 1 of window "Open"
 try
  if value of text field 1 of UI element 1 of r is '''+quote(slug+'.wav')+''' then
   select r
   set foundFile to true
   exit repeat
  end if
 end try
end repeat
if not foundFile then error "Candidate file absent"
click button "Open" of splitter group 1 of window "Open"''')
    wait(lambda:ax('get exists window "Open"')=='false')
    wait(lambda:has_track(slug))
    print('Imported and observed exact track:',slug,flush=True)
print(tracks(),flush=True)
