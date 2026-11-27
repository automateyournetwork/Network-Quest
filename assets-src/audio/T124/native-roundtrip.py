# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Save and freshly reopen an Audacity 4 project on a private Xvfb display.

Run inside the isolated production guest with the app's first-launch wizard complete.
Working directory contains squashfs-root/{AppRun,...}, prepared/, projects/, masters/.
Uses only the observed UI, an isolated display and release application binary.
"""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import pyatspi as at

def x(*args):
    return subprocess.check_output(['xdotool', *args], text=True, stderr=subprocess.DEVNULL).strip()

def active():
    try:
        return x('getactivewindow', 'getwindowname')
    except subprocess.CalledProcessError:
        return ''

def wait(fn, description):
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        value = fn()
        if value:
            return value
        time.sleep(.1)
    raise RuntimeError('Timed out waiting for ' + description + '; active window ' + active())

def walk(node):
    yield node
    for child in node:
        if child is not None:
            yield from walk(child)

def nodes():
    return [node for app in at.Registry.getDesktop(0) if app.name.lower().startswith('audacity')
            for node in walk(app)]

def find(name, role=None):
    return next((n for n in nodes() if n.name == name and (not role or n.getRoleName() == role)), None)

def click(name, role=None):
    node = wait(lambda: find(name, role), name)
    ax, ay, w, h = node.queryComponent().getExtents(at.DESKTOP_COORDS)
    frame = node
    while frame.getRoleName() != 'frame':
        frame = frame.parent
    fx, fy, _, _ = frame.queryComponent().getExtents(at.DESKTOP_COORDS)
    assert w > 0 and h > 0 and active() == frame.name
    x('mousemove', '--window', x('getactivewindow'), str(ax+w//2-fx), str(ay+h//2-fy), 'click','1')

def replace(value):
    x('key','ctrl+a')
    x('type','--clearmodifiers',str(value))

def open_audio(path, tag, root, slug):
    with (root / (tag + '-' + slug + '.log')).open('w') as log:
        proc = subprocess.Popen([str(root/'squashfs-root/AppRun'), str(path)], stdout=log, stderr=log)
    wait(lambda: slug in active() and 'Audacity' in active(), 'project window')
    actual = int(x('getactivewindow', 'getwindowpid'))
    observed = wait(lambda: next((n.name for n in nodes() if
        n.name.startswith('Track 1: '+slug+', audio track')), None), 'expected audio track')
    return proc, actual, observed

def quit_app(proc):
    x('key','ctrl+q')
    proc.wait(timeout=15)
    assert proc.returncode == 0

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def integrity(path):
    with sqlite3.connect(path.as_uri()+'?immutable=1', uri=True) as db:
        return db.execute('PRAGMA integrity_check').fetchone()[0]

def run(slug, channels):
    root = Path.cwd()
    assert re.fullmatch(r'[a-z0-9-]+', slug) and channels in ('Mono','Stereo')
    display = os.environ['DISPLAY']
    server = subprocess.check_output(['ps','-eo','args'], text=True)
    assert re.search(r'Xvfb\s+'+re.escape(display)+r'\s', server), 'Requires task-local virtual display'
    assert not any(app.name.lower().startswith('audacity') for app in at.Registry.getDesktop(0))
    prepared = root/'prepared'/(slug+'.wav')
    project = root/'projects'/(slug+'.aup4')
    master = root/'masters'/(slug+'.wav')
    assert prepared.is_file() and not project.exists() and not master.exists()
    record = {'slug':slug,'startedUtc':datetime.now(timezone.utc).isoformat(),'application':'Audacity 4.0.2 official Linux ARM64 AppImage'}
    first, record['creationPid'], record['observedAtCreation'] = open_audio(prepared,'create',root,slug)
    x('key','ctrl+s')
    wait(lambda: active() == 'Save project', 'native save dialog')
    if find('On your computer'):
        click('On your computer')
        wait(lambda: not find('On your computer'), 'local file dialog')
    replace(project)
    x('key','Return')
    wait(lambda: project.is_file() and slug in active() and '*' not in active(), 'persisted named project')
    quit_app(first)
    record['sha256BeforeReopen'] = sha(project)
    record['integrityBeforeReopen'] = integrity(project)
    second, record['reopenPid'], record['observedAtReopen'] = open_audio(project,'reopen',root,slug)
    assert record['creationPid'] != record['reopenPid']
    x('key','ctrl+shift+e')
    wait(lambda: active()=='Export audio', 'native export dialog')
    if find('On your computer'):
        click('On your computer')
    wait(lambda: find('Export panel, Type: Full project audio'), 'export settings')
    folder = next(n.name for n in nodes() if n.name.startswith('Folder: '))
    if folder != 'Folder: '+str(master.parent):
        click(folder, 'text')
        replace(master.parent)
        x('key','Tab')
    assert find('File name: '+slug, 'text') and find('Format: WAV (Microsoft)') and find('Format: 48000 Hz')
    click(channels, 'radio button')
    if not find('Encoding Signed 24-bit PCM'):
        encoding = next(n.name for n in nodes() if n.getRoleName() == 'combo box' and n.name.startswith('Encoding '))
        click(encoding)
        click('Signed 24-bit PCM', 'list item')
    assert find('Encoding Signed 24-bit PCM') and find('Folder: '+str(master.parent))
    click('Export','push button')
    wait(lambda: master.is_file() and slug in active(), 'master written')
    quit_app(second)
    record.update(sha256AfterReopen=sha(project), integrityAfterReopen=integrity(project),
        preparedSha256=sha(prepared), nativeMasterSha256=sha(master),
        nativeExportSettings='Full project audio / WAV (Microsoft) / 48000 Hz / Signed 24-bit PCM / '+channels,
        finishedUtc=datetime.now(timezone.utc).isoformat())
    assert record['sha256BeforeReopen'] == record['sha256AfterReopen']
    assert record['integrityBeforeReopen'] == record['integrityAfterReopen'] == 'ok'
    assert not list(project.parent.glob(project.name+'-*'))
    (root/(slug+'-native.json')).write_text(json.dumps(record,indent=2)+'\n')
    print(slug, record['sha256AfterReopen'], flush=True)

if __name__=='__main__':
    run(sys.argv[1], sys.argv[2] if len(sys.argv)>2 else 'Stereo')
