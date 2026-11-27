# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Render the two original, level-set mono layers of each new T128 one-shot."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import scipy
from scipy.signal import butter, sosfilt
import soundfile as sf

RATE = 48000
TAU = 2 * np.pi
HERE = Path(__file__).resolve().parent

# The first layer carries the gesture and the second gives it a distinct material or response.
SCORES = {
    21: (.47, -13, 'keyway-slide', 'locking-tongue', 'A short plastic guide slides home; one bright tongue clicks into its recess.'),
    22: (.76, -14, 'lever-arc', 'brass-detent', 'Weighted pivot eases over center. One dry brass stop marks exactly one step.'),
    24: (.96, -13, 'continuity-pulses', 'braid-touch', 'Two damped current-like knocks travel under a soft brush against the braided jacket.'),
    25: (1.46, -16, 'bowed-glass', 'bow-friction', 'One steady, softly blooming glass pitch with a faint rosin attack.'),
    26: (1.58, -16, 'joined-glass', 'glass-halo', 'Three close resonances bloom out of one common stroke and settle together.'),
    27: (1.19, -15, 'feather-fan', 'survey-sweep', 'A feather fan opens in four uneven wisps over a soft descending electronic sweep.'),
    28: (.91, -13, 'large-shell', 'small-shell', 'Separate hollow knocks question and answer: the second cup is smaller and drier.'),
    29: (1.12, -15, 'audit-hum', 'ledger-tick', 'A low waxing electric-organ hum gives way to a single papery ledger tick.'),
    30: (.83, -14, 'bat-call', 'finite-answer', 'One chirrup is answered once, with a narrow, quieter copy and a short tail.'),
    31: (1.31, -16, 'upper-voice', 'lower-voice', 'Two reedlike pitches approach the same tuning from opposite directions and rest there.'),
    32: (.81, -16, 'meter-scan', 'stylus-texture', 'A band-limited rising instrument scan passes under the brushed movement of a stylus.'),
    33: (.97, -16, 'proof-dyad', 'felt-keys', 'Two quiet mallet notes descend by a fourth into a short resolution, with felt key noise.'),
    34: (1.03, -17, 'hovering-low', 'unsettled-upper', 'A slow low reed and a muted upper neighbor overlap without resolving.'),
    35: (.55, -13, 'stamp-pad', 'paper-fold', 'Soft block thud followed by a sheet lifting back off the stamp.'),
    36: (.98, -13, 'clamp-jaws', 'cable-release', 'Mismatched steel jaws bite together, followed by a de-tensioning cable twang.'),
    37: (.67, -13, 'cover-hinge', 'polymer-snap', 'A small enclosure hinge whispers around its pivot and the polymer cover snaps shut.'),
    38: (1.43, -14, 'tripod-legs', 'switch-detent', 'Three staggered telescoping leg slides land, then a small setup switch seats.'),
    39: (1.21, -13, 'conduit-impact', 'falling-grit', 'A muffled earthbound clunk loosens a descending scatter of gravel.'),
    40: (1.04, -14, 'isolation-handle', 'lock-bolt', 'A deliberate heavy throw and a delayed bolt slide end in a damped stop.'),
}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def clock(duration):
    return np.arange(round(RATE * duration)) / RATE

def contour(t, attack, release):
    return np.sin(np.pi / 2 * np.clip(t / attack, 0, 1))**2 * np.sin(
        np.pi / 2 * np.clip((t[-1] - t) / release, 0, 1))**2

def modal(duration, modes):
    t = clock(duration)
    return contour(t, .002, .018) * sum(
        amp * np.sin(TAU * hz * t) * np.exp(-t / decay) for hz, amp, decay in modes)

def air(rng, duration, low, high, attack, release):
    t = clock(duration)
    band = butter(3, (low, high), btype='bandpass', fs=RATE, output='sos')
    return contour(t, attack, release) * sosfilt(band, rng.normal(0, 1, len(t)))

def pitched(duration, first, last, attack, release, harmonics=(1,), travel=1, vibrato=0):
    t = clock(duration)
    pos = np.minimum(t / travel, 1)
    smooth = pos * pos * (3 - 2 * pos)
    frequency = (first + (last-first) * smooth) * (1 + vibrato * np.sin(TAU * 4.3 * t))
    phase = TAU * np.cumsum(frequency) / RATE
    return contour(t, attack, release) * sum(gain * np.sin((i+1)*phase) for i, gain in enumerate(harmonics))

def render(number, destination):
    duration, peak_db, first, second, direction = SCORES[number]
    seed = 2026112700 + number
    rng = np.random.default_rng(seed)
    layers = np.zeros((2, round(duration * RATE)))

    def add(layer, start, signal, gain=1):
        index = round(start * RATE)
        assert 0 <= index and index + len(signal) <= layers.shape[1]
        layers[layer, index:index+len(signal)] += gain * signal

    def rub(layer, start, duration, band, gain, attack=.008, release=.045):
        add(layer, start, air(rng, duration, *band, attack, release), gain)

    def hit(layer, start, duration, modes, gain=1):
        add(layer, start, modal(duration, modes), gain)

    def note(layer, start, duration, first, last, attack, release, gain=1, **kwargs):
        add(layer, start, pitched(duration, first, last, attack, release, **kwargs), gain)

    if number == 21:
        rub(0,.018,.135,(900,2950),.29,.035,.04)
        hit(1,.145,.27,[(810,.48,.033),(2240,.21,.012),(340,.22,.041)])
        hit(1,.173,.12,[(593,.16,.015),(1331,.13,.011)])
    elif number == 22:
        note(0,.016,.265,138,97,.04,.055,.31,harmonics=(1,.18,.11),travel=.25)
        rub(0,.031,.207,(280,1080),.28,.06,.05)
        hit(1,.299,.42,[(354,.64,.057),(869,.29,.103),(1411,.11,.041),(2327,.07,.02)])
    elif number == 24:
        for start, gain in [(0.018,.74),(.43,.68)]:
            note(0,start,.34,172,123,.024,.18,gain,harmonics=(1,.31,.13),travel=.24)
        rub(1,.188,.29,(540,2020),.14,.065,.12)
        rub(1,.61,.22,(470,1730),.09,.033,.10)
    elif number == 25:
        note(0,.015,1.39,664,660,.27,.46,.70,harmonics=(1,.038,.073,.023),vibrato=.0008)
        rub(1,.028,1.09,(1430,3110),.09,.19,.37)
    elif number == 26:
        for hz, start, gain in [(554.37,.02,.43),(583.1,.17,.28),(622.25,.29,.23)]:
            note(0,start,1.49-start,hz*.996,hz,.126,.51,gain,travel=.47)
        hit(1,.061,1.20,[(1112,.11,.32),(1749,.067,.24),(2493,.037,.17)])
    elif number == 27:
        for start, width, high, gain in [(.014,.13,4250,.50),(.10,.17,3620,.42),(.23,.21,2980,.34),(.42,.23,2600,.21)]:
            rub(0,start,width,(1050,high),gain,.04,.09)
        note(1,.19,.94,815,252,.16,.27,.24,harmonics=(1,.07),travel=.79)
    elif number == 28:
        hit(0,.021,.43,[(251,.68,.072),(539,.39,.047),(785,.22,.028),(1635,.09,.013)])
        rub(0,.017,.065,(520,1880),.34,.004,.047)
        hit(1,.478,.34,[(497,.53,.043),(828,.29,.025),(1554,.13,.015)])
        rub(1,.476,.049,(980,2800),.27,.004,.038)
    elif number == 29:
        note(0,.01,.81,93,93,.114,.206,.54,harmonics=(1,.48,.21,.07))
        rub(1,.84,.10,(1250,3220),.43,.009,.073)
        hit(1,.847,.165,[(731,.31,.026),(1297,.13,.01)])
    elif number == 30:
        call = pitched(.242,1220,548,.013,.083,(1,.22,.04),travel=.195)
        add(0,.023,call,.63)
        add(1,.367,call,.42)
        hit(1,.57,.22,[(549,.068,.051),(1099,.019,.03)])
    elif number == 31:
        note(0,.017,1.21,494,392,.112,.254,.53,harmonics=(1,.21,.055),travel=.65)
        note(1,.092,1.135,294,392,.092,.254,.45,harmonics=(1,.065,.18),travel=.58)
    elif number == 32:
        note(0,.016,.73,318,956,.065,.125,.46,harmonics=(1,.22,.043),travel=.67)
        rub(1,.035,.63,(560,1640),.28,.11,.16)
    elif number == 33:
        hit(0,.026,.45,[(523.25,.58,.128),(1047,.11,.089),(1572,.032,.049)])
        hit(0,.375,.55,[(392,.56,.165),(784,.16,.084),(1178,.046,.061)])
        for start in (.021,.37):
            rub(1,start,.068,(280,1320),.245,.006,.042)
    elif number == 34:
        note(0,.022,.919,293.66,293.66,.095,.235,.54,harmonics=(1,.18,.057))
        note(1,.195,.746,311.13,311.13,.11,.224,.29,harmonics=(1,.09,.042),vibrato=.0007)
    elif number == 35:
        hit(0,.04,.26,[(122,.65,.039),(226,.26,.025),(683,.16,.014)])
        rub(0,.026,.093,(180,1230),.55,.009,.047)
        rub(1,.167,.288,(1160,4800),.39,.031,.16)
    elif number == 36:
        for start, gain in [(.021,.62),(.093,.43)]:
            hit(0,start,.355,[(236,gain,.062),(632,gain*.62,.052),(1504,gain*.33,.025)])
        note(1,.211,.71,235,119,.014,.53,.42,harmonics=(1,.28,.12,.06),travel=.48)
    elif number == 37:
        note(0,.022,.32,417,648,.078,.079,.12,harmonics=(1,.24,.09),travel=.27)
        rub(0,.018,.32,(950,2510),.20,.068,.12)
        hit(1,.39,.245,[(652,.57,.029),(1184,.26,.017),(2037,.125,.009)])
        rub(1,.388,.054,(1440,3380),.255,.003,.038)
    elif number == 38:
        for start, width, hz in [(.016,.22,303),(.284,.25,271),(.618,.218,238)]:
            rub(0,start,width,(490,hz*6),.39,.028,.065)
            hit(0,start+width-.021,.25,[(hz,.40,.05),(hz*2.66,.16,.039)])
        hit(1,1.082,.274,[(738,.32,.029),(1393,.18,.017),(392,.21,.053)])
    elif number == 39:
        hit(0,.029,.74,[(79,.66,.139),(153,.43,.078),(366,.18,.055)])
        rub(0,.023,.24,(95,570),.77,.021,.12)
        for start, hz, gain in [(.156,1050,.47),(.227,820,.40),(.328,1190,.34),(.496,640,.28),(.55,860,.24),(.726,622,.18),(.933,506,.09)]:
            rub(1,start,.088,(hz/2,hz*3),gain,.005,.057)
            hit(1,start+.002,.11,[(hz,gain*.41,.019),(hz*1.61,gain*.17,.015)])
    elif number == 40:
        rub(0,.035,.414,(190,880),.61,.133,.076)
        hit(0,.404,.36,[(147,.59,.084),(356,.21,.048)])
        rub(1,.687,.138,(625,1650),.34,.015,.045)
        hit(1,.813,.211,[(269,.43,.039),(709,.16,.02)])
    scale = 10**(peak_db/20) / np.max(np.abs(layers.sum(axis=0)))
    rows = []
    for name, layer in zip((first,second), layers):
        path = destination / f'fx{number}-{name}.wav'
        if path.exists():
            raise FileExistsError(path)
        sf.write(path, layer * scale, RATE, subtype='FLOAT')
        rows.append({'layer':name,'file':path.name,'sha256':sha(path)})
    return {'number':number,'design':direction,'sampleRate':RATE,'frames':layers.shape[1],
            'peakTargetDbfs':peak_db,'gainAppliedToBothLayers':scale,'seed':seed,'layers':rows}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    args.destination.mkdir(exist_ok=True, parents=True)
    rows = [render(number,args.destination) for number in SCORES]
    (args.destination/'design.json').write_text(json.dumps({'rate':RATE,'numpy':np.__version__,
        'scipy':scipy.__version__,'soundfile':sf.__version__,'designs':rows}, indent=2)+'\n')
