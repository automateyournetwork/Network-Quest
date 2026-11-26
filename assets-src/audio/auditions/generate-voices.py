# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""T065 bounded, original project-line audition. No listening approval implied."""
from pathlib import Path
import datetime
import hashlib
import importlib.metadata as metadata
import json
import resource
import time
import numpy as np
import soundfile as sf
import torch
from kokoro import KModel, KPipeline

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
MODEL = ROOT / '.runtime/media/models/kokoro'
request = json.loads((OUT / 'provenance/voice-requests.json').read_text())
torch.set_num_threads(4)
torch.manual_seed(20261126)
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
load_start = time.perf_counter()
model = KModel(repo_id=request['model'], config=str(MODEL / 'config.json'),
               model=str(MODEL / 'kokoro-v1_0.pth')).to('cpu').eval()
pipeline = KPipeline(lang_code='a', repo_id=request['model'], model=model, device='cpu')
load_seconds = time.perf_counter() - load_start
records = []
for row in request['rows']:
    script = (ROOT / row['scriptPath']).read_text()
    assert hashlib.sha256(script.encode()).hexdigest() == row['canonical']['textSha256']
    voice_path = MODEL / 'voices' / (row['voice'] + '.pt')
    voice = torch.load(voice_path, weights_only=True)
    begin = time.perf_counter()
    segments = list(pipeline(script, voice=voice, speed=row['speed']))
    audio = np.concatenate([s.audio.numpy() for s in segments])
    elapsed = time.perf_counter() - begin
    assert np.isfinite(audio).all() and np.max(np.abs(audio)) > 0
    output = OUT / 'raw' / (row['slug'] + '.wav')
    assert not output.exists(), 'Preserve previous attempt; use a new candidate ID.'
    sf.write(output, audio, 24000, subtype='FLOAT')
    records.append({**row, 'eventId': 't065-' + row['slug'] + '-kokoro-20261126-a',
                    'scriptSha256': hashlib.sha256(script.encode()).hexdigest(),
                    'voiceSha256': hashlib.sha256(voice_path.read_bytes()).hexdigest(),
                    'rawPath': str(output.relative_to(ROOT)),
                    'rawSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                    'phonemes': [s.phonemes for s in segments],
                    'generationSeconds': elapsed, 'durationSeconds': len(audio)/24000,
                    'approxWordsPerMinute': len(script.split()) * 60 / (len(audio)/24000),
                    'peakAbsolute': float(np.max(np.abs(audio))),
                    'sampleRate': 24000, 'channels': 1, 'subtype': 'FLOAT',
                    'audiblePronunciation': 'pending human headphones and speakers',
                    'humanListening': 'pending'})
record = {'startedUtc': started, 'model': request['model'], 'revision': request['revision'],
          'device': 'cpu', 'threads': 4, 'torchSeed': 20261126, 'loadSeconds': load_seconds,
          'versions': {p: metadata.version(p) for p in ['kokoro','misaki','torch','transformers','soundfile','spacy']},
          'maximumRssBytesMacos': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
          'records': records, 'productionSelection': 'pending; no voice selected for bulk production'}
(OUT / 'provenance/voice-run.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'count': len(records), 'loadSeconds': load_seconds,
                  'durationSeconds': sum(r['durationSeconds'] for r in records),
                  'maxRss': record['maximumRssBytesMacos']}, indent=2))
