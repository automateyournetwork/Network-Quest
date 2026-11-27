# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Generate this allocation's new voice lines using the pinned, auditioned local cast."""
import hashlib
import importlib.metadata
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import time
from datetime import datetime, timezone

import numpy as np
import soundfile as sf
import torch
from kokoro import KModel, KPipeline

ROOT = Path(__file__).resolve().parents[3]
AUDIO = ROOT/'assets-src/audio'
MODEL = ROOT/'.runtime/media/models/kokoro'


def read(path):
    return json.loads(path.read_text())


def write(path, obj):
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + '\n')


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def pathref(path):
    return str(path.relative_to(ROOT))


def bindings(task):
    if task not in ('T129', 'T130', 'T131'):
        raise ValueError('Expected T129, T130 or T131')
    allocation = next(row for row in read(ROOT/'assets-src/production-allocation.json')['batches'] if row['task'] == task)
    plan = {row['assetId']:row for row in read(AUDIO/'production-plan.json')['voices']}
    rows = [plan[key] for key in allocation['assetIds']]
    assert len(rows) == 20 and len(set(allocation['assetIds'])) == 20
    return allocation, rows


def ffmpeg(source, args):
    result = subprocess.run(['ffmpeg','-hide_banner','-nostdin','-i',str(source),*args],
                            capture_output=True, text=True, check=True)
    return result.stderr


def prepare(source, prepared):
    stats = ffmpeg(source,['-af','loudnorm=I=-18:TP=-2:LRA=11:print_format=json','-f','null','-'])
    stats, _ = json.JSONDecoder().raw_decode(stats[stats.rfind('{'):])
    filters = ('loudnorm=I=-18:TP=-2:LRA=11:linear=true:print_format=json'
               f":measured_I={stats['input_i']}:measured_TP={stats['input_tp']}"
               f":measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:offset={stats['target_offset']}")
    ffmpeg(source,['-af',filters,'-map_metadata','-1','-ar','48000','-ac','1','-c:a','pcm_f32le',str(prepared)])
    return {'inputMeasurement':stats, 'filter':filters,'preparedPath':pathref(prepared),'preparedSha256':digest(prepared)}


def main(task):
    _, rows = bindings(task)
    out = AUDIO/task
    for name in ('records','scripts','raw','prepared','masters','projects'):
        (out/name).mkdir(parents=True,exist_ok=True)
    baseline = read(AUDIO/'auditions/provenance/voice-run.json')
    cast = {r['canonical']['speakerId']:r for r in baseline['records']}
    existing = {r['canonical']['assetId'] for r in baseline['records']}
    model_record = next(r for r in read(ROOT/'assets-src/feasibility/model-provenance.json') if r['repo_id'] == baseline['model'])
    assert model_record['download_revision'] == baseline['revision']
    weights = {r['path']:r['sha256'] for r in model_record['files'] if r['path'] in ('config.json','kokoro-v1_0.pth')}
    assert all(digest(MODEL/key)==value for key,value in weights.items())
    directed = read(out/'delivery.json') if (out/'delivery.json').exists() else {}
    ids = {r['assetId'][-3:] for r in rows if r['assetId'] not in existing}
    speeds = read(out/'speeds.json') if (out/'speeds.json').exists() else {}
    takes = read(out/'takes.json') if (out/'takes.json').exists() else {}
    assert all(set(values).issubset(ids) for values in (directed,speeds,takes))
    assert all(re.fullmatch('[a-z][a-z0-9-]*',x) for x in takes.values())
    os.environ['HF_HUB_OFFLINE']='1'
    torch.set_num_threads(3)
    model = KModel(repo_id=baseline['model'],config=str(MODEL/'config.json'),
                   model=str(MODEL/'kokoro-v1_0.pth')).to('cpu').eval()
    pipeline = KPipeline(lang_code='a',repo_id=baseline['model'],model=model,device='cpu')
    versions = {p:importlib.metadata.version(p) for p in ('torch','kokoro','misaki','soundfile','transformers','spacy')}
    for row in rows:
        if row['assetId'] in existing:
            continue
        number = row['assetId'][-3:]
        slug = 'voice-'+number
        script, raw, mixed = out/'scripts'/(slug+'.txt'), out/'raw'/(slug+'.wav'), out/'prepared'/(slug+'.wav')
        receipt = out/'records'/(slug+'-generation.json')
        text = row['text']
        assert hashlib.sha256(text.encode()).hexdigest()==row['textSha256']
        delivery = directed.get(number,text)
        chosen = cast[row['speakerId']]
        speed = speeds.get(number,chosen['speed'])
        take = takes.get(number,'b' if number in directed or number in speeds else 'a')
        event_id = f'{task.lower()}-{slug}-kokoro-{take}'
        assert isinstance(speed,(int,float)) and 0.5 <= speed <= 2
        assert delivery.strip() and (not script.exists() or script.read_text()==text)
        script.write_text(text)
        if receipt.exists():
            old = read(receipt)
            assert old['eventId'] == event_id
            assert (old['scriptSha256'],old['deliveryText'],old['speed'],old['rawSha256'],old['preparedSha256']) == (
                digest(script),delivery,speed,digest(raw),digest(mixed))
            continue
        assert not raw.exists() and not mixed.exists(), 'Retain interrupted run separately'
        voice_path = MODEL/'voices'/(chosen['voice']+'.pt')
        assert digest(voice_path)==chosen['voiceSha256']
        seed = 2026112700 + int(number)
        torch.manual_seed(seed)
        started = datetime.now(timezone.utc).isoformat()
        begin = time.monotonic()
        segments = list(pipeline(delivery, voice=torch.load(voice_path,weights_only=True), speed=speed))
        signal = np.concatenate([s.audio.numpy() for s in segments])
        elapsed = time.monotonic()-begin
        assert np.isfinite(signal).all() and 0.01 < np.max(np.abs(signal)) <= 1
        sf.write(raw,signal,24000,subtype='FLOAT')
        record = dict(assetId=row['assetId'],lineId=row['lineId'],speakerId=row['speakerId'],text=text,
            deliveryText=delivery,scriptPath=pathref(script),scriptSha256=digest(script),
            deliverySha256=hashlib.sha256(delivery.encode()).hexdigest(),
            pronunciationOverrides=[] if delivery==text else [{'visible':text,'spoken':delivery}],
            eventId=event_id,tool='Kokoro',version=versions['kokoro'],model=baseline['model'],
            modelRevision=baseline['revision'], modelFiles=weights,voiceId=chosen['voice'],voiceSha256=digest(voice_path),
            historicalCastingEvent=chosen['eventId'],speed=speed,lang_code='a',device='cpu',threads=3,
            torchSeed=seed,versions=versions,generationStartedUtc=started,generationSeconds=round(elapsed,4),
            rawPath=pathref(raw),rawSha256=digest(raw),rawFrames=len(signal),rawSampleRate=24000,
            durationSeconds=len(signal)/24000,wordsPerMinute=round(len(text.split())*60*24000/len(signal),2),
            phonemes=[s.phonemes for s in segments],ffmpegVersion=subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0],
            **prepare(raw,mixed))
        write(receipt,record)
        print(slug,chosen['voice'],record['durationSeconds'],flush=True)


if __name__=='__main__':
    main(sys.argv[1])
