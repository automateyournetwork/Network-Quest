# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Render an exact-web context mix and generate the static, offline listening packet."""
import importlib
import os
from html import escape
from pathlib import Path
from tempfile import TemporaryDirectory
import numpy as np
import soundfile as sf

files = importlib.import_module('verify-exports')
OUT, ROOT = files.OUT, files.ROOT
PACKET = 't127-effects-01-20-a'
SCENES = ('Notebook entries', 'Bench controls and movement', 'Footfalls and machinery', 'Instrument adjustments')
VOICES = ('narrator-005','titan-019','narrator-001','titan-025')


def context_reel(cues):
    rate, span = 48000, 13
    backing = ROOT/'public/assets/audio/auditions/music-title.mp3'
    music, sr = sf.read(backing, always_2d=True)
    assert sr == rate and music.shape[1]==2
    start_offsets = (.8, 3.05, 5.40, 7.75, 10.1)
    reel = np.zeros((len(SCENES)*span*rate,2))
    scenes = []
    for i, (label, voice_id) in enumerate(zip(SCENES, VOICES)):
        start = round((.4 + i*1.75)*rate)
        segment = music[start:start+span*rate].copy()
        assert len(segment)==span*rate
        spoken = ROOT/'public/assets/audio/auditions'/(voice_id+'.mp3')
        voice, sr = sf.read(spoken,always_2d=True)
        onset = round(.45*rate)
        end = onset+len(voice)
        assert sr == rate and voice.shape[1]==1 and end + .35*rate < len(segment)
        attack, release = round(.12*rate), round(.35*rate)
        low = 10**(-6/20)
        segment[onset-attack:onset] *= np.linspace(1,low,attack)[:,None]
        segment[onset:end] *= low
        segment[end:end+release] *= np.linspace(low,1,release)[:,None]
        segment[:rate//5] *= np.linspace(0,1,rate//5)[:,None]
        segment[-rate//3:] *= np.linspace(1,0,rate//3)[:,None]
        segment[onset:end] += voice
        times = []
        for offset, cue in zip(start_offsets, cues[i*5:i*5+5]):
            effect, sr = sf.read(ROOT/cue['web']['path'],always_2d=True)
            assert sr == rate and effect.shape[1]==1
            first = round(offset*rate)
            segment[first:first+len(effect)] += effect
            times.append({'seconds':round(i*span+offset,2),'assetId':cue['assetId'],'caption':cue['caption'],
                          'exactInput':cue['web']})
        reel[i*span*rate:(i+1)*span*rate] = segment
        line = (files.AUDITIONS/'scripts'/(voice_id+'.txt')).read_text().strip()
        scenes.append(dict(label=label, startSeconds=i*span,voiceSeconds=i*span+onset/rate,
            transcript=line,voiceId=voice_id,inputVoice=files.reference(spoken),musicReadOffsetSeconds=start/rate,
            effects=times))
    premix_peak = float(np.max(np.abs(reel)))
    reel *= 10**(-3/20)
    assert np.max(np.abs(reel)) < .89
    with TemporaryDirectory() as scratch:
        wav = Path(scratch)/'scene.wav'
        sf.write(wav,reel,rate,subtype='PCM_24')
        mp3 = OUT/'listening/context.mp3'
        files.encode(wav,mp3,2,'192k')
    record = dict(inputMusic=files.reference(backing),durationSeconds=span*len(SCENES),
        effectsGainDb=0,voiceGainDb=0,musicDuckDb=-6,attackMs=120,releaseMs=350,
        busTrimDb=-3,beforeBusTrimPeakDbfs=files.db(premix_peak),
        method='Four short monitoring scenes. Source MP3s decoded once and mixed at recorded gains; gameplay events and room routing are separate.',
        actualWebLevels=files.loudness(mp3),web=files.reference(mp3),scenes=scenes)
    files.write(OUT/'records/context.json',record)
    return record


def audio(audio_id, name, path):
    url = escape(os.path.relpath(ROOT/path, OUT))
    return (f'<audio controls preload="metadata" id="{audio_id}" aria-label="{escape(name)}" src="{url}"></audio> '
            f'<button type="button" data-replay="{audio_id}">Replay {escape(name)}</button>')


def page(cues, context):
    parts = ['''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Underworld effect listening · 001–020</title>
<style>
:root{color-scheme:light dark;font:1em/1.5 system-ui,sans-serif}body{max-width:54rem;margin:auto;padding:1rem;overflow-wrap:anywhere}
a{color:LinkText}section{padding:1rem 0;border-top:1px solid GrayText}h1,h2,h3{line-height:1.18}
audio{display:block;max-width:100%;margin:.5rem 0}button{font:inherit;padding:.35rem .7rem;margin:.2rem 0}
:focus-visible{outline:.2rem solid Highlight;outline-offset:.15rem}p{max-width:68ch}
</style></head><body><main><h1>Underworld effect listening</h1>
<p>Listen to the full effects and the four-scene comparison on ordinary speakers and headphones.
Start at a comfortable volume. Follow the action text as you listen. For a change request,
give the effect number, playback device, and the moment or quality to revise. Check whether short sounds stay distinct and whether you can follow the dialogue.</p>
<p>Packet <code>t127-effects-01-20-a</code>. The owner previously heard the exact 001 and 013 clips on both devices.
The remaining eighteen clips and this comparison are awaiting listening.</p>
<p><a href="#context">Hear the comparison with dialogue</a> · <a href="#individual">Hear individual effects</a></p>
<button type="button" id="stop">Stop playback</button> <button type="button" id="mute" aria-pressed="false">Mute packet</button>
<p id="feedback" role="status"></p>
<section id="context"><h2>Effects under dialogue</h2>
<p>All twenty cues play in number order across four 13-second scenes. The controls allow seeking and replay. The effects keep their individual level settings. A fixed 3 dB reduction on the combined output provides headroom.</p>''']
    parts.append(audio('mix','Effects under dialogue',context['web']['path']))
    parts.append('<details><summary>Read the dialogue and cue timeline</summary>')
    for scene in context['scenes']:
        parts.append(f'<h3>{scene["startSeconds"]} s · {escape(scene["label"])}</h3><p>{escape(scene["transcript"])}</p><ul>')
        for effect in scene['effects']:
            parts.append(f'<li>{effect["seconds"]:.2f} s · {escape(effect["caption"])}</li>')
        parts.append('</ul>')
    parts.append('</details></section><h2 id="individual">Individual effects</h2>')
    for row in cues:
        ident = row['assetId'][-3:]
        parts.append(f'<section><h3>{ident} · {escape(row["name"])}</h3><p>{escape(row["purpose"])}.</p>')
        parts.append(f'<p><strong>Action text</strong> · {escape(row["caption"])}</p>')
        parts.append(audio('fx-'+ident,row['name'],row['web']['path']))
        parts.append('</section>')
    parts.append('''</main><script>
const audioList = [...document.querySelectorAll('audio')];
function stopAll() {
  for (const audio of audioList) { audio.pause(); audio.currentTime = 0; }
}
document.getElementById('stop').addEventListener('click', stopAll);
document.getElementById('mute').addEventListener('click', event => {
  const muted = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  for (const audio of audioList) audio.muted = muted;
  event.currentTarget.setAttribute('aria-pressed', String(muted));
});
for (const audio of audioList) {
  audio.addEventListener('play', () => {
    for (const other of audioList) if (other !== audio) other.pause();
  });
}
for (const button of document.querySelectorAll('[data-replay]')) {
  button.addEventListener('click', () => {
    stopAll();
    const feedback = document.getElementById('feedback');
    feedback.textContent = '';
    document.getElementById(button.dataset.replay).play().catch(() => {
      feedback.textContent = 'Audio could not start. Use the written action description for this cue.';
    });
  });
}
</script></body></html>''')
    page = OUT/'review.html'
    page.write_text('\n'.join(parts)+'\n')
    return page


if __name__=='__main__':
    cues = files.read(OUT/'records/exports.json')['cues']
    context = context_reel(cues)
    html = page(cues,context)
    files.write(OUT/'records/listening-seal.json', dict(packetId=PACKET,
        html=files.reference(html), context=context['web'], contextRecord=files.reference(OUT/'records/context.json'),
        individual=[{'assetId':r['assetId'],'caption':r['caption'],'raw':r['raw'],'prepared':r['prepared'],
                     'project':r['project'],'master':r['master'],'web':r['web'],
                     'priorListeningEvidencePath':r['priorListeningEvidencePath']} for r in cues],
        remainingReview='Actual ordinary-speaker and headphone listening on the 18 new complete effects and all 20 in the new scene mix.'))
