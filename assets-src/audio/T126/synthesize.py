# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Compose the continuous environment and foreground Foley of twelve circular rooms."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

import numpy as np
from scipy.signal import butter, sosfilt
import soundfile as sf

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
RATE = 48000
TAU = 2 * np.pi

# Each score names its two independently editable native tracks.
LAYERS = {
    'r01': (38, 'lift-ventilator', 'cage-and-bell'),
    'r02': (43, 'furnace-draught', 'bellows-and-cooling-metal'),
    'r03': (40, 'motor-armature', 'cable-tray-resonance'),
    'r04': (46, 'cavern-foundry-return', 'dripping-ledge'),
    'r05': (44, 'garden-air-handler', 'glass-reeds'),
    'r06': (48, 'vault-glass-resonance', 'shutter-mechanism'),
    'r07': (42, 'skywell-wind', 'mast-and-stays'),
    'r08': (49, 'rain-on-the-dome', 'far-thunder'),
    'r09': (41, 'market-and-cooling-fans', 'shell-counter'),
    'r10': (45, 'drive-belt', 'escapement'),
    'r11': (47, 'excavator-idle', 'aggregate-and-settling'),
    'r12': (50, 'threshold-and-city-air', 'maintenance-wind-chime'),
}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def levels(path):
    command = ['ffmpeg','-hide_banner','-nostdin','-i',str(path),'-af',
               'loudnorm=I=-30:TP=-1:LRA=11:print_format=json','-f','null','-']
    log = subprocess.run(command,check=True,capture_output=True,text=True).stderr
    return json.loads(re.findall(r'\{[^{}]+\}', log, re.S)[-1])

def pan(signal, position):
    angle = (position + 1) * np.pi / 4
    return np.column_stack((signal*np.cos(angle), signal*np.sin(angle)))

class Room:
    def __init__(self, number, seconds):
        self.seconds = seconds
        self.n = seconds * RATE
        self.t = np.arange(self.n) / RATE
        self.rng = np.random.default_rng(126000 + number)
        self.bed = np.zeros((self.n,2))
        self.foley = np.zeros_like(self.bed)

    def oscillator(self, hz, phase=0):
        # A whole number of cycles and periodic phase modulation keep the splice continuous.
        return np.sin(TAU * round(hz * self.seconds) * self.t / self.seconds + phase)

    def swell(self, cycles, floor=.3, phase=0):
        return floor + (1-floor)*(.5+.5*self.oscillator(cycles/self.seconds,phase))

    def noise(self, low, high, count=None):
        n = self.n if count is None else count
        samples = self.rng.standard_normal(n)
        filter_ = butter(3,[low,high],fs=RATE,btype='bandpass',output='sos')
        # A full second of periodic filter history also handles the lower bass bands.
        warm = min(n, RATE)
        wave = sosfilt(filter_, np.r_[samples[-warm:],samples])[warm:]
        return wave / np.sqrt(np.mean(wave**2))

    def air(self, low, high, level, motion, width=.24):
        level = level * motion
        self.bed += pan(self.noise(low,high)*level,0)
        for side in [-1,1]:
            self.bed += pan(self.noise(low,high)*level*width,side*.78)

    def place(self, wave, start, position, track=None):
        dest = self.foley if track is None else track
        clip = pan(wave,position)
        at = round(start*RATE) % self.n
        first = min(len(clip),self.n-at)
        dest[at:at+first] += clip[:first]
        if first<len(clip):
            dest[:len(clip)-first] += clip[first:]

    def strike(self, start, modes, decay, gain, position, attack=.003, track=None):
        t = np.arange(round(6*decay*RATE))/RATE
        # Inharmonic modes radiate and decay at different rates.
        wave = sum(weight*np.sin(TAU*hz*t)*np.exp(-t*(1+i*.22)/decay)
                   for i,(hz,weight) in enumerate(modes))
        wave *= (1-np.exp(-t/attack))*gain
        self.place(wave,start,position,track)

    def breath(self, start, length, low, high, gain, position):
        t=np.arange(round(length*RATE))/RATE
        wave=self.noise(low,high,len(t))*np.sin(np.pi*t/length)**2
        self.place(wave*gain,start,position)

def arrival(r):
    r.air(100,560,.18,r.swell(2,.7))
    r.bed += pan(.045*r.oscillator(116,.12*r.oscillator(.5)),.12)
    for start in [2.3,8.8,14.95,23.1,31.65]:
        for offset,gain in [(0,.46),(.12,.28),(.33,.18)]:
            r.strike(start+offset,[(118,1),(327,.5),(671,.16)],.09,gain,-.42)
    r.strike(19.8,[(397,1),(1011,.48),(1510,.12)],1.27,.43,.7,.012)

def workshop(r):
    r.air(54,430,.27,r.swell(4,.52),.1)
    for start,length in [(2.2,2.7),(11.1,3.3),(22.0,2.8),(36.8,3.6)]:
        r.breath(start,length,210,1020,.16,-.5)
        r.strike(start+length-.27,[(94,1),(176,.42)],.13,.19,-.52,.014)
    for start in [5.9,6.46,8.05,16.7,27.85,29.36,33.0,40.8]:
        r.strike(start,[(948,1),(1751,.34),(2520,.17)],.055,.38,.43)

def copper(r):
    rotor = 54.4
    slip = .23*r.oscillator(.4)
    r.bed += pan(.34*r.oscillator(rotor,slip)+.18*r.oscillator(rotor*2,2*slip)
                 +.067*r.oscillator(rotor*5,5*slip),-.17)
    r.air(70,310,.067,r.swell(3,.83))
    # Slack tray rattles respond to the turning shaft, concentrated in two slow arcs.
    resonance = r.swell(2,.04,1)**3 * (.5+.5*r.oscillator(13.6))**4
    r.foley += pan(resonance*(.26*r.oscillator(392)+.12*r.oscillator(581)+.13*r.noise(390,1520)),.43)

def cavern(r):
    r.air(62,280,.067,r.swell(1,.72),.46)
    for start in [.8,14.7,30.9,44.8]:
        for delay,level,pos in [(0,.4,-.62),(.19,.23,.21),(.43,.13,.6),(.69,.055,-.25)]:
            r.strike(start+delay,[(71,1),(131,.45),(193,.2)],.31,level,pos,.032,r.bed)
    for start,freq,pos in [(3.4,1040,-.2),(7.8,740,.54),(8.27,1300,.52),(19.4,840,-.33),
                          (28.8,980,.46),(33.7,1350,-.55),(40.2,790,.28)]:
        t=np.arange(round(.42*RATE))/RATE
        # A falling droplet excites a chirping air bubble, with a sidewall reflection.
        bubble=np.sin(TAU*(freq*t+freq*.027*(1-np.exp(-t/.044))))*np.exp(-t/.057)*(1-np.exp(-t/.0018))
        for delay,amp,balance in [(0,.41,pos),(.127,.15,-pos),(.307,.057,pos/2)]:
            r.place(bubble*amp,start+delay,balance)

def garden(r):
    r.air(145,780,.11,r.swell(3,.65),.35)
    r.bed += pan(.055*r.oscillator(182)*(1+.4*r.oscillator(1.8)),.3)
    for i,(hz,pos) in enumerate([(387,-.54),(523,-.14),(758,.27),(882,.62)]):
        gust = r.swell(i+2,.01,i*1.59)**3
        reed = r.oscillator(hz,.16*r.oscillator(4.1+i*.16))+.17*r.oscillator(2.01*hz)
        r.foley += pan(gust*(.15*reed+.034*r.noise(hz-60,hz+80)),pos)

def vault(r):
    for hz,level,pos in [(157,.31,-.15),(159.2,.095,.26),(401.5,.063,.2),(654,.034,-.48)]:
        r.bed += pan(level*r.oscillator(hz)*r.swell(1,.64,hz),pos)
    r.air(80,350,.044,r.swell(2,.73))
    for start,direction in [(6.3,-.43),(25.1,.34),(38.55,-.26)]:
        r.breath(start,1.62,375,1530,.17,direction)
        for delay,amp in [(0,.13),(1.52,.21)]:
            r.strike(start+delay,[(213,1),(588,.31)],.083,amp,direction)

def skywell(r):
    gust=r.swell(2,.43)*r.swell(5,.67,.8)
    r.air(75,850,.26,gust,.42)
    r.air(710,2130,.063,r.swell(3,.17,1.7),.69)
    for start,length,pitch in [(5.6,1.1,148),(16.8,1.68,166),(33.2,1.25,136)]:
        t=np.arange(round(length*RATE))/RATE
        rub=np.sin(TAU*(pitch*t+14*t*t)+1.4*np.sin(TAU*21*t))
        r.place(.34*rub*np.sin(np.pi*t/length)**2,start,.45)
        r.strike(start+length,[(272,1),(433,.47)],.16,.098,.43)

def observatory(r):
    r.air(580,3650,.086,r.swell(3,.77),.67)
    # A stochastic field of individual tin dome impacts overlays the diffuse rain.
    for start in np.sort(r.rng.uniform(0,r.seconds,330)):
        pitch=r.rng.uniform(580,2100)
        r.strike(start,[(pitch,1),(pitch*1.52,.36)],.013,r.rng.uniform(.06,.21),r.rng.uniform(-.8,.8),.0011,r.bed)
    for start,length in [(8.1,6.6),(31.4,9.1)]:
        r.breath(start,length,37,164,.255,-.47)
        r.breath(start+1.35,length*.77,53,203,.148,.45)

def market(r):
    r.air(175,685,.128,r.swell(3,.73),.46)
    r.bed += pan(.082*r.oscillator(229,.42*r.oscillator(.24))*r.swell(5,.42),.46)
    for start in [2.6,8.91,14.45,21.8,30.25,37.2]:
        for i in range(int(r.rng.integers(2,6))):
            hz=r.rng.uniform(720,1140)
            r.strike(start+i*.092+r.rng.uniform(0,.045),[(hz,1),(hz*2.64,.28)],.034,
                     r.rng.uniform(.20,.52),-.52+i*.13,.0014)

def clockworks(r):
    r.air(125,760,.155,.6+.4*r.swell(15,.12),.14)
    r.bed += pan(.092*r.oscillator(89,.43*r.oscillator(1.5))+.045*r.oscillator(178),-.17)
    for i,start in enumerate(np.arange(.4,r.seconds,1.875)):
        high=(i%2==0)
        r.strike(start,[(489 if high else 318,1),(847 if high else 682,.46)],.069,.39,-.18 if high else .24)
        r.strike(start+.078,[(142,1),(244,.36)],.084,.24,-.11)
    # Exact integer cycle: two alternating teeth return after 45 seconds.

def rift(r):
    pistons=(.58+.42*r.oscillator(8.63,.51*r.oscillator(.43)))**2
    r.bed += pan((.39*r.oscillator(62)+.21*r.oscillator(124)+.088*r.oscillator(186))*pistons,-.33)
    r.air(42,280,.14,r.swell(2,.8),.23)
    for start,length in [(4.8,.7),(14.2,1.12),(32.6,1.06),(42.9,.58)]:
        r.breath(start,length,780,2380,.14,.54)
        for i in range(5):
            r.strike(start+length+i*.084,[(r.rng.uniform(175,310),1),(612,.32)],.038,.32/(1+i*.3),.41-i*.06,.002)

def threshold(r):
    r.air(128,490,.145,r.swell(2,.77),.27)
    for hz,lev,pos in [(74,.13,-.62),(221,.052,.54),(284,.038,-.39)]:
        r.bed += pan(lev*r.oscillator(hz,.26*r.oscillator(.28))*r.swell(3,.36,hz),pos)
    for start,hz,level,pos in [(8.8,585,.37,.5),(9.46,702,.21,.56),(26.7,463,.31,.41),
                                (38.4,702,.26,.55),(39.51,585,.16,.4)]:
        r.strike(start,[(hz,1),(hz*2.77,.43),(hz*5.12,.1)],.97,level,pos,.008)

SCORES = [arrival,workshop,copper,cavern,garden,vault,skywell,observatory,market,clockworks,rift,threshold]

def produce(key, destination):
    seconds, background, foreground = LAYERS[key]
    index=int(key[1:])
    r=Room(index,seconds)
    SCORES[index-1](r)
    mix=r.bed+r.foley
    with tempfile.TemporaryDirectory() as scratch:
        source=Path(scratch)/'sum.wav'
        sf.write(source,mix,RATE,subtype='FLOAT')
        before=levels(source)
    gain_db=min(-30-float(before['input_i']),-2-float(before['input_tp']))
    gain=10**(gain_db/20)
    paths=[]
    for role,data in [(background,r.bed),(foreground,r.foley)]:
        path=destination/'sources'/(key+'-'+role+'.flac')
        path.parent.mkdir(exist_ok=True,parents=True)
        assert np.max(np.abs(data*gain))<1
        sf.write(path,data*gain,RATE,subtype='PCM_24',format='FLAC')
        paths.append({'track':path.stem,'path':str((OUT/'sources'/path.name).relative_to(ROOT)),
                      'sha256':digest(path),'bytes':path.stat().st_size,'format':'flac'})
    row={'room':key.upper(),'scoreFunction':SCORES[index-1].__name__,'seed':126000+index,'seconds':seconds,'sampleRate':RATE,
         'frames':r.n,'channels':2,'layers':paths,'sourceMixGainDb':gain_db,'ungainedIntegratedLufs':float(before['input_i']),
         'synthesis':'Seeded periodic noise, original oscillator and resonator performances, handwritten event score.',
         'loop':'Full timeline. Continuous material uses whole-cycle modulation or wrapped filter history. All event tails wrap on the source timeline.'}
    (destination/'records').mkdir(exist_ok=True,parents=True)
    (destination/'records'/(key+'-score.json')).write_text(json.dumps(row,indent=2)+'\n')
    print(key,seconds,flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('rooms',nargs='*',metavar='ROOM')
    parser.add_argument('--destination',type=Path,default=OUT)
    args=parser.parse_args()
    if any(key not in LAYERS for key in args.rooms):
        parser.error('Room IDs run from r01 through r12')
    for key in args.rooms or LAYERS:
        produce(key,args.destination)
