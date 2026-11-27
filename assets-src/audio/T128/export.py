# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Verify the source/master chain, encode final one-shots and assemble room review excerpts."""
import hashlib
import html
import json
import math
from pathlib import Path
import sqlite3
import subprocess
import tempfile

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RATE = 48000
REC = HERE/'records'
AUDITION = HERE.parent/'auditions'

def load(path):
    return json.loads(path.read_text())

def write(path,data):
    path.write_text(json.dumps(data,indent=2,ensure_ascii=False,allow_nan=False)+'\n')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def ref(path):
    return {'path':str(path.relative_to(ROOT)), 'sha256':digest(path), 'bytes':path.stat().st_size}

def check(record):
    path = ROOT/record['path']
    actual = ref(path)
    assert all(value == record[key] for key,value in actual.items()), path
    return path

def db(signal):
    return float(20*np.log10(np.max(np.abs(signal))))

def encode(path, dest, channels, bitrate):
    args = ['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-i',str(path),'-map_metadata','-1',
            '-ar',str(RATE),'-ac',str(channels),'-c:a','libmp3lame','-b:a',bitrate]
    with tempfile.TemporaryDirectory() as d:
        candidate = Path(d)/'candidate.mp3'
        subprocess.run(args+[str(candidate)],check=True)
        if dest.exists():
            assert digest(dest)==digest(candidate), f'Changed output at {dest}'
        else:
            dest.write_bytes(candidate.read_bytes())

def loudness(path):
    args = ['ffmpeg','-nostdin','-hide_banner','-i',str(path),'-af',
            'loudnorm=I=-23:TP=-1:LRA=11:print_format=json','-f','null','-']
    log = subprocess.run(args,check=True,capture_output=True,text=True).stderr
    metrics, _ = json.JSONDecoder().raw_decode(log[log.rindex('{'):])
    return {k:float(metrics[k]) if math.isfinite(float(metrics[k])) else None for k in ('input_i','input_tp')}

def decode(path,channels):
    result = subprocess.run(['ffmpeg','-loglevel','error','-nostdin','-i',str(path),'-ar',str(RATE),
                    '-ac',str(channels),'-f','f32le','-'],capture_output=True,check=True)
    return np.frombuffer(result.stdout,dtype='<f4').reshape(-1,channels)

def preserved():
    seal = AUDITION/'provenance/review-packet-seal.json'
    assert digest(seal)=='89e98ccf375c685164ba63b046a9c8daf17286cb8e0fa171d3a74e7900e6f3e0'
    packet = load(seal)
    entries = [packet['html']]+[f for c in packet['candidates'] for f in c['files']]
    for entry in entries: check(entry)
    entry = next(a for a in load(ROOT/'assets-src/manifest.json')['assets'] if a['assetId'].endswith('-EFFECT-023'))
    for item in entry['sources']+entry['exports']: check(item['file'])
    owner = next(v for v in entry['verification'] if v['check']=='listening')
    evidence = load(ROOT/owner['evidencePath'])
    assert evidence['actor']=='human' and evidence['status']=='passed'
    assert set(evidence['details']['methods'])=={'headphones','ordinary-speakers'}
    assert evidence['details']['frozenWebSha256']==entry['exports'][0]['file']['sha256']
    return entry, {'packet':ref(seal),'frozenPacketEntries':len(entries),
                   'exactOwnerEvidence':ref(ROOT/owner['evidencePath'])}

def build_audio(number, design):
    slug = f'effect-{number:03}'
    receipt = load(REC/f'{number}-native.json')
    src = [HERE/'sources'/l['file'] for l in design['layers']]
    project = HERE/'projects'/(slug+'.aup4')
    master = HERE/'masters'/(slug+'.wav')
    web = ROOT/'public/assets/audio/effects'/(slug+'.mp3')
    assert digest(project)==receipt['sha256BeforeReopen']==receipt['sha256AfterReopen']
    assert receipt['integrityBeforeReopen']==receipt['integrityAfterReopen']=='ok'
    assert receipt['creationPid']!=receipt['reopenPid'] and digest(master)==receipt['nativeMasterSha256']
    assert receipt['tracksAtCreation']==receipt['tracksAfterReopen']
    assert len(receipt['tracksAfterReopen'])==2 and all(p.stem in n for p,n in zip(src,receipt['tracksAfterReopen']))
    assert [digest(p) for p in src]==[l['sha256'] for l in design['layers']]==[
        receipt['preparedSha256'],receipt['secondSourceSha256']]
    with sqlite3.connect(project.resolve().as_uri()+'?immutable=1',uri=True) as connection:
        assert connection.execute('pragma integrity_check').fetchone()[0]=='ok'
    layers = [sf.read(p)[0] for p in src]
    reference = layers[0]+layers[1]
    actual,sr = sf.read(master)
    assert actual.ndim==1 and sr==RATE and sf.info(master).subtype=='PCM_24'
    assert 0<=len(reference)-len(actual)<=1
    residual = np.abs(actual-reference[:len(actual)])
    assert np.max(residual)<2e-6, (number,float(np.max(residual)))
    assert np.isfinite(actual).all() and -18 < db(actual) < -10
    encode(master,web,1,'128k')
    decoded = decode(web,1).ravel()
    assert len(decoded)==len(actual) and -19 < db(decoded) < -9
    corr = float(np.corrcoef(actual,decoded)[0,1])
    assert corr > .97 and np.max(np.abs(decoded[-120:])) < .001, (number,corr)
    metrics = loudness(web)
    assert metrics['input_tp'] <= -1
    return dict(number=number,sources=[ref(p) for p in src],nativeProject=ref(project),
        master=ref(master),web=ref(web),frameCount=len(actual),nativeTrailingFramesLost=len(reference)-len(actual),
        maxSampleResidual=float(np.max(residual)),masterPeakDbfs=db(actual),webPeakDbfs=db(decoded),
        webMasterCorrelation=corr,webLoudness=metrics,webCodec='MP3 / libmp3lame / 128 kbps mono / 48 kHz',
        native=ref(REC/f'{number}-native.json'))

def contextual(row, brief, room):
    number = row['number']
    key = room['roomId'].split(':')[-1].lower()
    amb = ROOT/'public/assets/audio/ambience'/(key+'.mp3')
    ambrec = load(HERE.parent/'T126/records'/(key+'-export.json'))
    assert digest(amb) in json.dumps(ambrec), amb
    beds = [amb]
    for item in room['plannedAudioIds']['music']:
        beds.append(ROOT/'public/assets/audio/music'/(item.split('-')[-1]+'.mp3'))
    effect = decode(check(row['web']),1)
    start = int(RATE*.75)
    count = start+len(effect)+int(RATE*.90)
    mix = np.zeros((count,2))
    for bed in beds:
        offset = RATE*(6+number%5)
        mix += decode(bed,2)[offset:offset+count] * (.62 if bed==amb else .44)
    mix[start:start+len(effect)] += effect
    fade = round(.13*RATE)
    mix[:fade] *= np.linspace(0,1,fade)[:,None]
    mix[-fade:] *= np.linspace(1,0,fade)[:,None]
    assert db(mix) < -1
    directory = HERE/'listening'
    directory.mkdir(exist_ok=True)
    path = directory/f'context-{number:03}.mp3'
    with tempfile.TemporaryDirectory() as d:
        raw = Path(d)/'mix.wav'
        sf.write(raw,mix,RATE,subtype='FLOAT')
        encode(raw,path,2,'160k')
    metrics = loudness(path)
    assert metrics['input_tp']<=-1
    return dict(file=ref(path),effect=brief['assetId'],startFrame=start,durationFrames=count,
        backgroundOffsetSeconds=6+number%5,ambienceGain=.62,musicGain=.44 if len(beds)>1 else None,
        effectGain=1,background=[ref(p) for p in beds],webLoudness=metrics,
        purpose='Full exact effect heard once against excerpts of the allocated ambience and music, where allocated. Proposed static review balances.')

def html_packet(rows):
    header = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Underworld effects 021–040</title><style>
:root{color-scheme:dark;font:110%/1.5 system-ui;color:#f1eddf;background:#192323}
body{max-width:62rem;margin:2rem auto;padding:0 1rem}h1,h2{line-height:1.17}p{max-width:68ch}
article{border-top:1px solid #66827a;padding:1.1rem 0}audio{display:block;width:min(100%,24rem)}
.pair{display:flex;gap:1.5rem;flex-wrap:wrap}.pair>div{flex:1 1 19rem}h3{font-size:1rem}a{color:#a7dfd1}
</style><main><h1>Underworld effects 021–040</h1><p>Listen once on ordinary speakers and once on headphones or earbuds. Each row contains a complete effect followed by a short mix with its room ambience and any allocated music. Listen for the named action and whether the background masks it. Record the output devices, effect numbers and any changes requested.</p>
<p><button type="button" id="dry">Play all effects</button> <button type="button" id="mix">Play all room mixes</button> <button type="button" id="stop">Stop playback</button></p>
<output aria-live="polite" id="state">Ready</output>'''
    tags = [header]
    esc = html.escape
    for row in rows:
        brief = row['brief']
        number = row['number']
        tracks = [('Effect',row['web']),('Room mix',row['context']['file'])]
        players = ''
        for label,item in tracks:
            rel = str(Path('../../../')/item['path'])
            players += (f'<div><h3>{label}</h3><audio aria-label="{label} {number}" controls preload="none" '
                        f'src="{esc(rel)}"></audio></div>')
        tags.append(f'<article data-number="{number}"><h2>{number:03} · {esc(brief["name"])}</h2>'
                    f'<p>{esc(brief["roomId"].split(":")[-1])} · {esc(row["design"])}</p>'
                    f'<p class="caption">{esc(brief["caption"])}</p><div class="pair">{players}</div></article>')
    tags.append('''<script>
const players = [...document.querySelectorAll("audio")];
const state = document.getElementById("state");
let queue = [];
function stop() {
  queue = [];
  for (const player of players) { player.pause(); if (player.readyState && player.currentTime > 0) player.currentTime = 0; }
  state.textContent = "Stopped";
}
function next() {
  if (!queue.length) { state.textContent = "Finished"; return; }
  const player = queue[0];
  if (player.currentTime > 0) player.currentTime = 0;
  player.play().catch(() => { if (queue[0] !== player) return; queue = []; state.textContent = "Playback unavailable. Use the individual audio controls to retry."; });
}
function start(label) {
  stop();
  queue = players.filter(p => p.getAttribute("aria-label").startsWith(label));
  next();
}
document.addEventListener("play", e => {
  if (!(e.target instanceof HTMLAudioElement)) return;
  for (const player of players) if (player !== e.target) player.pause();
  if (queue[0] !== e.target) queue = [];
  state.textContent = "Playing " + e.target.getAttribute("aria-label");
}, true);
document.addEventListener("ended", e => {
  if (e.target === queue[0]) { queue.shift(); next(); }
  else if (e.target instanceof HTMLAudioElement) state.textContent = "Finished";
}, true);
document.getElementById("dry").onclick = () => start("Effect ");
document.getElementById("mix").onclick = () => start("Room mix ");
document.getElementById("stop").onclick = stop;
window.addEventListener("pagehide", stop);
document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
</script></main></html>''')
    (HERE/'review.html').write_text('\n'.join(tags)+'\n')

def main():
    plan = load(HERE.parent/'production-plan.json')
    allocation = next(b for b in load(ROOT/'assets-src/production-allocation.json')['batches'] if b['task']=='T128')
    briefs = [b for b in plan['effects'] if b['assetId'] in allocation['assetIds']]
    assert len(briefs)==20 and [b['assetId'] for b in briefs]==allocation['assetIds']
    rooms = {r['roomId']:r for r in load(ROOT/'assets-src/rooms/scene-layouts.json')['rooms']}
    designs = {d['number']:d for d in load(HERE/'sources/design.json')['designs']}
    prior,prior_record = preserved()
    rows = []
    for brief in briefs:
        number = int(brief['assetId'].split('-')[-1])
        if number==23:
            row = dict(number=number,web=ref(ROOT/prior['exports'][0]['file']['path']),
                nativeProject=ref(ROOT/prior['audio']['nativeProjectPath']),master=ref(ROOT/prior['audio']['masterPath']),
                frameCount=sf.info(ROOT/prior['audio']['masterPath']).frames,
                design='Three glass partials rise on successive soft attacks in Photon’s original inspection gesture.',
                priorAudition=prior_record)
        else:
            row = build_audio(number,designs[number])
            row['design'] = designs[number]['design']
        row['brief'] = {k:brief[k] for k in ('assetId','roomId','name','category','purpose','caption','playback','reviewPlan')}
        room = rooms[brief['roomId']]
        assert brief['assetId'] in room['plannedAudioIds']['effects']
        row['context'] = contextual(row,brief,room)
        rows.append(row)
    assert len({r['web']['sha256'] for r in rows})==20
    html_packet(rows)
    write(REC/'exports.json',{'encoder':subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0],
        'packetId':'t128-effects-021-040-a','effects':rows})
    write(REC/'listening-seal.json',{'packetId':'t128-effects-021-040-a','reviewPage':ref(HERE/'review.html'),
        'pairedFiles':[f for r in rows for f in (r['web'],r['context']['file'])],
        'sourceIndex':ref(REC/'exports.json'),'ownerSoloPreviouslyHeard':[23],
        'pending':{'fullEffect':sorted(designs),'roomMix':list(range(21,41)),
                   'methods':['ordinary-speakers','headphones']}})

if __name__=='__main__':
    main()
