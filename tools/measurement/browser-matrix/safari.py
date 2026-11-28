# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Keyboard in a fresh native Safari private window, without enabling WebDriver."""
import json
import re
import subprocess
import time

def apple(script):
    result = subprocess.run(['/usr/bin/osascript','-e',script],capture_output=True,text=True,timeout=18,check=True)
    return result.stdout.strip()

def plist(key):
    return subprocess.check_output(['plutil','-extract',key,'raw','/Applications/Safari.app/Contents/Info.plist'],text=True).strip()

class Safari:
    def __init__(self):
        self.engine = 'safari-private'
        self.previous_pid = subprocess.check_output(['/usr/bin/osascript','-l','JavaScript','-e',
            'ObjC.import("AppKit");Number($.NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier)'],text=True).strip()
        self.wid = None
        self.url = None
        self.identity = {'browserName':'Safari','browserVersion':plist('CFBundleShortVersionString'),
           'CFBundleVersion':plist('CFBundleVersion'),'process':'Native private window with System Events keyboard',
           'platformName':subprocess.check_output(['sw_vers','-productVersion'],text=True).strip()}
    def open(self,url):
        if not re.fullmatch(r'http://127\.0\.0\.1:\d+/test\?size=\d+x\d+&input=keyboard&suite=(?:baseline|performance|credits)',url):
            raise ValueError('Expected isolated loopback keyboard fixture')
        self.url=url
        before=apple('tell application "Safari" to return id of every window')
        previous={int(i) for i in re.findall(r'\d+',before)}
        apple('tell application "System Events" to tell process "Safari" to click menu item "New Private Window" of menu 1 of menu bar item "File" of menu bar 1')
        for _ in range(25):
            candidate=int(apple('tell application "Safari" to return id of front window'))
            if candidate not in previous and candidate != 7338:
                self.wid=candidate
                break
            time.sleep(.12)
        if not self.wid: raise RuntimeError('New private window identity unavailable')
        requested=re.search(r'size=(\d+)x(\d+)',url)
        width,height=(int(x) for x in requested.groups())
        # With this native private window, the toolbar occupies 52 points.
        # Receipts measure the resulting host viewport and guest viewport.
        right,bottom=(10+width,32+height+52) if width>=1280 else (1630,1110)
        apple(f'tell application "Safari"\nactivate\nset bounds of window id {self.wid} to {{10,32,{right},{bottom}}}\nset URL of current tab of window id {self.wid} to {json.dumps(url)}\nend tell')
    def guard(self):
        if self.wid is None or self.wid == 7338: raise RuntimeError('Expected a task-created private window')
        return f'''tell application "Safari"
if id of front window is not {self.wid} then error "Owned private window lost foreground"
if (URL of current tab of window id {self.wid}) is not {json.dumps(self.url)} then error "Owned private window lost its origin"
if not frontmost then error "Safari lost foreground"
end tell
'''
    def perform(self,command):
        kind=command['kind']
        if kind=='tab':
            count=command['count']
            if not 1<=count<=30: raise ValueError('Tab count')
            modifiers = '{option down, shift down}' if command.get('reverse') else 'option down'
            keys=f'repeat {count} times\nkey code 48 using {modifiers}\nend repeat'
        elif kind=='enter': keys='key code 36'
        elif kind=='space': keys='key code 49'
        elif kind=='text':
            if not re.fullmatch(r'[A-Za-z .,]{1,100}',command['value']): raise ValueError('Unexpected test input')
            keys='keystroke '+json.dumps(command['value'])
        else: raise ValueError('Unsupported private Safari gesture')
        apple(self.guard()+'tell application "System Events" to tell process "Safari"\n'+keys+'\nend tell')
    def screenshot(self,path):
        apple(self.guard()+'return true')
        subprocess.run(['/usr/sbin/screencapture','-x','-o','-l',str(self.wid),str(path)],check=True)
    def close(self):
        if self.wid:
            # Cleanup does not require bringing any window forward. Recheck its
            # unique URL by ID before closing, even after a lost-focus error.
            was_front=apple(f'tell application "Safari" to return (frontmost and id of front window is {self.wid})') == 'true'
            apple(f'tell application "Safari"\nif (URL of current tab of window id {self.wid}) is {json.dumps(self.url)} then close window id {self.wid}\nend tell')

            if was_front and self.previous_pid.isdigit():
                subprocess.run(['/usr/bin/osascript','-l','JavaScript','-e',
                    'ObjC.import("AppKit"); const app=$.NSRunningApplication.runningApplicationWithProcessIdentifier('
                    + self.previous_pid + '); if (app && !app.terminated) app.activateWithOptions(2)'],check=True,capture_output=True)
