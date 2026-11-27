# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Render original mono foley from editable gestures, damped modes and friction.

From the repository root: python assets-src/audio/T127/synthesize.py
With --out DIR, rebuild the raw and prepared PCM sources into a separate directory.
Requires NumPy and SciPy. All durations and envelope times are in seconds.
"""
import argparse
import hashlib
import json
from pathlib import Path
import wave

import numpy as np
import scipy
from scipy.signal import butter, sosfilt

RATE = 48000
DESIGNS = {
    2: (.56, -17, 'Paper hinge bends into a fan of fibre crackles and lands with a flutter.'),
    3: (.68, -18, 'Three graphite strokes of different lengths; the last stops at the finished entry.'),
    4: (.26, -16, 'A downward thumb press, puncture, then a short cork-body knock.'),
    5: (.61, -16, 'Leather stretches, a brass tongue hits the clasp, and the satchel flap settles.'),
    6: (.58, -14, 'A keyed part slides in a slot; a separate locking pin seats after a pause.'),
    7: (.18, -21, 'A single felt-damped knuckle tap on the desk edge.'),
    8: (.54, -19, 'Small left and right cover clasps spring down, separated by hand travel.'),
    9: (.83, -15, 'Two alternating boot soles excite different regions of a hanging steel lift plate.'),
    10: (.50, -16, 'Heel on dense basalt, a dry sole scrape, then a slight toe contact.'),
    11: (.57, -17, 'Individual gravel grains crush under a slow sole and scatter on toe release.'),
    12: (.51, -15, 'Heel transfers weight through a hollow timber plank, with a softer toe landing.'),
    14: (1.19, -17, 'A leather hinge groans into a rounded bellows air stroke; the valve closes.'),
    15: (1.54, -18, 'A brushed motor coasts from fast commutation to separate pulses and stops.'),
    16: (.30, -19, 'The light armature picks up; the return contact settles into its stop.'),
    17: (.69, -19, 'A dry fibre pad swipes across a ferrule once; pressure eases on lift-off.'),
    18: (.46, -18, 'Overlapping iris leaves slide inward; the blade stop makes a thin click.'),
    19: (.82, -17, 'A hand lever first takes up slack, then advances the pawl over five teeth.'),
    20: (1.02, -15, 'Two broad dome dogs release in sequence, each loading the lower metal frame.'),
}


def put(signal, onset, part):
    first = round(onset * RATE)
    available = min(len(part), len(signal) - first)
    assert first >= 0 and available > 0
    signal[first:first+available] += part[:available]


class Foley:
    def __init__(self, number):
        self.rng = np.random.default_rng(127000 + number)
        self.signal = np.zeros(round(DESIGNS[number][0] * RATE))

    def strike(self, onset, length, modes, attack=.0015):
        """(Frequency, e-folding decay, magnitude) for each physical mode."""
        t = np.arange(round(length * RATE)) / RATE
        wavelet = np.zeros_like(t)
        for hz, decay, gain in modes:
            wavelet += gain * np.sin(2*np.pi*hz*t) * np.exp(-t/decay)
        wavelet *= np.minimum(t/attack, 1) * np.clip((length-t)/.012, 0, 1)
        put(self.signal, onset, wavelet)

    def rub(self, onset, length, low, high, pressure, gain, grain=0):
        """Band-limited friction under hand-drawn normalized pressure points."""
        t = np.arange(round(length * RATE)) / RATE
        noise = self.rng.standard_normal(len(t))
        band = butter(3, [low, high], btype='bandpass', fs=RATE, output='sos')
        friction = sosfilt(band, noise)
        friction /= max(1e-8, np.sqrt(np.mean(friction**2)))
        positions, strength = zip(*pressure)
        envelope = np.interp(t/length, positions, strength)
        if grain:
            steps = np.arange(0, len(t)+grain, grain)
            envelope *= np.interp(np.arange(len(t)), steps, self.rng.uniform(.15, 1.2, len(steps)))
        put(self.signal, onset, friction * gain * envelope)

    def grains(self, onset, length, count, hz_pair, decay_pair, gain):
        for pos in np.sort(self.rng.beta(2, 3, count)):
            hz = self.rng.uniform(*hz_pair)
            decay = self.rng.uniform(*decay_pair)
            strength = gain * self.rng.uniform(.25, 1)
            self.strike(onset + pos*length, decay*5, [(hz, decay, strength),
                        (hz*1.61, decay*.55, strength*.27)], attack=.001)


SWELL = [(0, 0), (.23, .8), (.56, 1), (.82, .58), (1, 0)]
SNAP = [(0, 0), (.05, 1), (.35, .38), (1, 0)]


def gesture(number):
    f = Foley(number)
    strike, rub = f.strike, f.rub
    if number == 2:
        rub(.025, .35, 740, 3700, [(0,0),(.20,.28),(.74,1),(1,0)], .075, 155)
        f.grains(.09, .29, 27, (1100, 3600), (.002, .005), .052)
        rub(.33, .136, 360, 2100, SNAP, .082)
        strike(.358, .14, [(283,.027,.105),(720,.015,.08)])
    elif number == 3:
        for onset, length, level, grit in [(.025,.20,.09,95),(.274,.095,.06,69),(.427,.186,.10,113)]:
            rub(onset, length, 1040, 4900, SWELL, level, grit)
            rub(onset, length, 480, 990, SNAP, .023, grit)
    elif number == 4:
        rub(.018, .067, 190, 1030, SWELL, .035)
        strike(.081,.13,[(380,.017,.42),(790,.011,.17),(1920,.004,.08)])
        rub(.09,.085,480,2350,SNAP,.041,42)
    elif number == 5:
        rub(.023,.25,190,1240,SWELL,.07,240)
        strike(.25,.23,[(910,.044,.34),(1752,.023,.17),(2870,.013,.08)])
        strike(.295,.17,[(535,.03,.24),(1280,.013,.09)])
        rub(.388,.156,160,850,SNAP,.055)
    elif number == 6:
        rub(.024,.214,340,2500,[(0,0),(.2,.3),(.8,1),(1,0)],.075,135)
        strike(.213,.18,[(322,.032,.36),(745,.024,.16),(1440,.011,.08)])
        strike(.392,.17,[(490,.042,.48),(1385,.018,.2),(2005,.013,.09)])
    elif number == 7:
        strike(.02,.14,[(217,.022,.57),(409,.012,.12),(813,.006,.04)],.006)
        rub(.02,.04,180,1300,SNAP,.045)
    elif number == 8:
        for onset, base, level in [(.045,830,.28),(.309,737,.34)]:
            strike(onset,.147,[(base,.022,level),(base*2.37,.012,level*.36)])
            rub(onset+.021,.06,320,1430,SNAP,.025)
    elif number == 9:
        for onset, hz, level in [(.028,149,.52),(.438,164,.43)]:
            rub(onset,.134,64,820,SNAP,.092)
            strike(onset+.014,.33,[(hz,.068,level),(hz*2.78,.091,.19),(hz*5.63,.054,.07)],.006)
            rub(onset+.089,.092,280,1350,SWELL,.039, 90)
    elif number == 10:
        rub(.024,.11,82,690,SNAP,.17)
        strike(.036,.115,[(176,.02,.35),(470,.009,.14)],.005)
        rub(.109,.269,350,2140,[(0,0),(.24,1),(.72,.33),(1,0)],.092,165)
        f.grains(.26,.141,8,(850,2100),(.003,.006),.043)
    elif number == 11:
        rub(.03,.319,121,730,SWELL,.082,195)
        f.grains(.043,.279,73,(595,3170),(.002,.009),.112)
        f.grains(.307,.169,24,(730,3600),(.002,.006),.075)
    elif number == 12:
        strike(.027,.304,[(127,.062,.65),(319,.039,.29),(560,.018,.13)],.006)
        rub(.034,.102,100,900,SNAP,.072)
        strike(.169,.24,[(177,.047,.26),(387,.029,.13),(689,.013,.055)],.005)
    elif number == 14:
        t = np.arange(round(.53*RATE))/RATE
        hinge = np.sin(2*np.pi*(143*t+90*t*t)+.47*np.sin(2*np.pi*39*t))
        put(f.signal,.028,.12*hinge*np.sin(np.pi*t/.53)**2)
        rub(.148,.875,115,1450,[(0,0),(.24,.68),(.52,1),(.89,.46),(1,0)],.103,720)
        rub(.269,.63,1100,2860,SWELL,.034)
        strike(.978,.155,[(186,.035,.23),(511,.013,.095)])
    elif number == 15:
        duration = 1.38
        t = np.arange(round(duration*RATE))/RATE
        # Integrated shaft frequency falls continuously from 71 Hz to 4 Hz.
        hz = 4 + 67*(1-t/duration)**1.55
        phase = 2*np.pi*np.cumsum(hz)/RATE
        whirr = .24*np.sin(phase*7)+.13*np.sin(phase*14)+.078*np.sin(phase*21)
        whirr += .052*np.sin(phase*28+.9*np.sin(phase)) + .07*np.sin(phase*2)
        env = np.minimum(t/.044,1)*(1-t/duration)**.72
        put(f.signal,.021, whirr*env*(.80+.20*np.cos(phase)))
        rub(.021,1.0,230,1300,[(0,0),(.045,1),(.48,.65),(1,0)],.059)
    elif number == 16:
        strike(.029,.138,[(1180,.018,.32),(2555,.009,.14)])
        rub(.027,.02,800,4100,SNAP,.032)
        strike(.137,.122,[(790,.018,.29),(1780,.012,.12),(2920,.004,.05)])
    elif number == 17:
        rub(.036,.54,595,2950,[(0,0),(.18,.57),(.42,1),(.74,.75),(1,0)],.092,130)
        rub(.114,.375,220,720,SWELL,.031,280)
    elif number == 18:
        for onset, length, band in [(.025,.163,980),(.094,.155,1260),(.166,.128,1530)]:
            rub(onset,length,band,band+1340,SWELL,.033,140)
        strike(.283,.137,[(1430,.026,.25),(2450,.012,.105),(3880,.007,.04)])
    elif number == 19:
        rub(.035,.168,180,850,SWELL,.045,160)
        for i, onset in enumerate([.157,.258,.347,.432,.526]):
            hz = 645 + 24*i
            strike(onset,.119,[(hz,.021,.24),(hz*2.16,.012,.095)])
            rub(onset,.033,610,2650,SNAP,.047)
        strike(.625,.14,[(306,.03,.35),(920,.015,.08)])
    elif number == 20:
        for onset, hz, level in [(.041,113,.49),(.443,91,.64)]:
            rub(onset,.087,105,1140,SWELL,.09)
            strike(onset+.066,.408,[(hz,.085,level),(hz*2.43,.066,.26),
                (hz*4.84,.058,.144),(hz*8.85,.027,.067)],.003)
    return f.signal


def pcm(path, samples):
    """Deterministic little-endian PCM24 RIFF; avoid generated timestamps."""
    values = np.rint(np.clip(samples, -1, 1-2**-23)*2**23).astype('<i4')
    packed = values.view(np.uint8).reshape(-1, 4)[:, :3].copy()
    with wave.open(str(path), 'wb') as w:
        w.setparams((1,3,RATE,0,'NONE','not compressed'))
        w.writeframes(packed.tobytes())
    return values.astype('float64')/2**23


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render(out):
    for subdir in ('raw','prepared','records'):
        (out/subdir).mkdir(parents=True, exist_ok=True)
    for n, (duration, target, description) in DESIGNS.items():
        slug = f'fx-{n:03}'
        raw = out/'raw'/(slug+'.wav')
        mixed = out/'prepared'/(slug+'.wav')
        # Mild headroom on isolated production take; don't normalize the web file.
        signal = gesture(n)
        original = pcm(raw, signal*.80/max(.95, np.max(np.abs(signal))))
        highpass = butter(2, 45, fs=RATE, btype='highpass', output='sos')
        clean = sosfilt(highpass, original)
        fade = np.sin(np.linspace(0,np.pi/2,round(.012*RATE)))**2
        clean[:len(fade)] *= fade
        clean[-len(fade):] *= fade[::-1]
        gain = 10**(target/20) / np.max(np.abs(clean))
        prepared = pcm(mixed, clean*gain)
        record = dict(slug=slug, seed=127000+n, generator=f'NumPy {np.__version__} / SciPy {scipy.__version__}',
            design=description, seconds=duration, rate=RATE, channels=1, frames=len(prepared),
            edit='45 Hz second-order high-pass; 12 ms raised-cosine outer fades; per-cue static gain',
            gainDb=20*np.log10(gain),targetPeakDbfs=target, rawSha256=sha(raw), preparedSha256=sha(mixed))
        (out/'records'/(slug+'-design.json')).write_text(json.dumps(record,indent=2)+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=Path(__file__).resolve().parent)
    render(parser.parse_args().out)
