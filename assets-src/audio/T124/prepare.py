# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Find a musically similar return, join the take to itself and set a static gain."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import numpy as np
import soundfile as sf

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
# Target seconds, overlap seconds. Slower bowed phrases use a longer overlap.
DESIGN = {'title': (72, .64), 'workshop': (80, .68), 'copper': (74, .44), 'fiber': (90, 1.16)}

def fingerprint(audio, rate):
    """25 Hz trajectories for logarithmic band energies and octave-folded pitch classes."""
    hop = rate // 25
    frame = 4096
    mono = audio.mean(axis=1)
    segments = np.lib.stride_tricks.sliding_window_view(mono, frame)[::hop]
    spectrum = np.abs(np.fft.rfft(segments * np.hanning(frame))) ** 2
    freqs = np.fft.rfftfreq(frame, 1 / rate)
    bounds = [35, 80, 160, 320, 640, 1280, 2560, 5120, 12000]
    bands = np.stack([np.log1p(spectrum[:, (freqs >= low) & (freqs < high)].sum(axis=1))
                      for low, high in zip(bounds, bounds[1:])], axis=1)
    pitch = np.rint(69 + 12 * np.log2(np.maximum(freqs, 1) / 440)).astype(int) % 12
    chroma = np.stack([np.sqrt(spectrum[:, (pitch == note) & (freqs > 95) & (freqs < 1600)].sum(axis=1))
                       for note in range(12)], axis=1)
    chroma /= np.maximum(1, np.linalg.norm(chroma, axis=1, keepdims=True))
    return np.hstack((bands / 5, chroma * 2))

def levels(path):
    command = ['ffmpeg', '-hide_banner', '-nostdin', '-i', str(path), '-af',
               'loudnorm=I=-23:TP=-1:LRA=11:print_format=json', '-f', 'null', '-']
    log = subprocess.run(command, capture_output=True, text=True, check=True).stderr
    return json.loads(re.findall(r'\{[^{}]+\}', log, re.S)[-1])

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def loop_audio(audio, start, end, n):
    # End the cycle in a piece of the original opening. Crossing frame N-1 to 0
    # now amounts to two consecutive frames of the same original performance.
    t = np.linspace(0, 1, n, dtype='float64')[:, None]
    weight = .5 - .5 * np.cos(t * np.pi)
    seam = audio[end:end+n] * (1 - weight) + audio[start:start+n] * weight
    return np.vstack((audio[start+n:end], seam)).astype('float32')

def restore(slug, target, record):
    source = OUT / 'sources' / (slug+'.wav')
    assert digest(source) == record['sourceSha256']
    audio, rate = sf.read(source, dtype='float32', always_2d=True)
    assert rate == record['sampleRate']
    samples = loop_audio(audio, record['rawHeadStartSample'], record['rawTailStartSample'], record['crossfadeFrames'])
    samples *= 10 ** (record['gainDb'] / 20)
    header = bytes.fromhex(record['preparedWaveHeaderHex'])
    payload = samples.astype('<f4').tobytes()
    assert header[-8:-4] == b'data' and int.from_bytes(header[-4:], 'little') == len(payload)
    contents = header + payload
    assert hashlib.sha256(contents).hexdigest() == record['preparedSha256']
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        assert digest(target) == record['preparedSha256']
    else:
        target.write_bytes(contents)
    print(slug, 'verified byte-exact reconstruction', flush=True)

def prepare(slug):
    source = OUT / 'sources' / (slug + '.wav')
    target = ROOT / '.local/T124/prepared' / (slug + '.wav')
    target.parent.mkdir(parents=True, exist_ok=True)
    audio, rate = sf.read(source, dtype='float32', always_2d=True)
    assert rate == 48000 and audio.shape[1] == 2 and np.isfinite(audio).all()
    duration, fade_sec = DESIGN[slug]
    fp = fingerprint(audio, rate)
    overlap = round(fade_sec * 25)
    # Choose a spectral/level/pitch trajectory match near the commissioned length.
    # Reject opening silence and keep well away from a generated end fade.
    candidates = []
    for a in range(25, 150):
        for b in range(a + (duration - 2) * 25, a + (duration + 2) * 25 + 1):
            if b + overlap + 25 >= len(fp):
                continue
            error = np.square(fp[a:a+overlap] - fp[b:b+overlap]).mean()
            candidates.append((float(error), a, b))
    error, a, b = min(candidates)
    hop = rate // 25
    start, end, n = a * hop, b * hop, overlap * hop
    body = loop_audio(audio, start, end, n)
    with tempfile.NamedTemporaryFile(suffix='.wav') as intermediate:
        sf.write(intermediate.name, body, rate, subtype='FLOAT')
        analysis = levels(intermediate.name)
    gain_db = min(-23 - float(analysis['input_i']), -1.5 - float(analysis['input_tp']))
    body *= 10 ** (gain_db / 20)
    sf.write(target, body, rate, subtype='FLOAT')
    record = {'slug': slug, 'sourceSha256': digest(source), 'preparedSha256': digest(target),
              'sampleRate':rate, 'channels':2, 'rawFrames':len(audio), 'frameCount':len(body),
              'loopStartSample':0, 'loopEndSample':len(body), 'rawHeadStartSample':start,
              'rawTailStartSample':end, 'crossfadeFrames':n, 'crossfade':'raised-cosine complementary gains',
              'initialSpectralDistance':error, 'gainDb':gain_db, 'preGainLoudness':analysis,
              'preparedLoudness':levels(target), 'adjacentEdgeStepAbsoluteByChannel':np.abs(body[0]-body[-1]).tolist(),
              'method':'Whole track loop; the last crossfade returns to the original opening at the exact source sample preceding the first frame.'}
    (OUT / 'records' / (slug+'-edit.json')).write_text(json.dumps(record, indent=2) + '\n')
    print(slug, len(body)/rate, gain_db, flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('cue', choices=DESIGN)
    parser.add_argument('--restore-to', type=Path, help='Restore and verify a sealed native input at this path')
    args = parser.parse_args()
    settings = OUT / 'records' / (args.cue+'-edit.json')
    if settings.exists():
        target = args.restore_to or ROOT / '.local/T124/prepared' / (args.cue + '.wav')
        restore(args.cue, target, json.loads(settings.read_text()))
    else:
        if args.restore_to:
            raise ValueError('No sealed edit recipe exists')
        prepare(args.cue)
