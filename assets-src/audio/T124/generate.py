# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Produce original cue takes. Refuses to replace an existing take."""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import importlib.metadata as metadata
import json
import resource
import time
import torch
from acestep.handler import AceStepHandler
from acestep.inference import GenerationParams, GenerationConfig, generate_music

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
CUES = {
    'title': (92, 'D Minor', 84, 2714101,
        'The Apprentice Descends, original adventure title in 4/4. In a warm basalt lift a single rounded FM bell steps from D to G, then F E D. Mallet bass answers the second phrase. Soft analog pad widens for the middle eight, then thin the texture back to the opening D pedal. Curious, welcoming, gently swinging early PC MIDI timbres with spacious modern stereo. Keep a steady pulse through the last bars. Entirely instrumental, no vocals.'),
    'workshop': (88, 'D Minor', 92, 2714102,
        'Tools Before Thunder, instrumental workshop hub. D Dorian, gentle F natural and B natural over a patient walking bass. Rounded FM marimba poses a rising fourth and leaves long rests for the quiet answer from soft synth strings. Swishing brushes and tiny alternating wood and metal ticks mark a workbench rhythm. Middle section trades the melody with the bass. End on softly bobbing D pedal and return to work. Human scale, conversational and warm. No vocals.'),
    'copper': (104, 'D Minor', 86, 2714103,
        'The Braided Road, instrumental copper warren travel. Syncopated muted FM string pluck in D minor with a warm short bass answer and dry wooden taps. Two short lines weave, stop for each other, then swap registers; wider open chords in the middle, returning to a settled ostinato. Retro game counterpoint, light footfall, no snare build, no urgent alarm, no machine interference or signal sound effects. Spare lively stereo arrangement. No vocals.'),
    'fiber': (76, 'F Major', 102, 2714104,
        'Light Has a Long Memory. Slow instrumental garden music in four. F Lydian color with B natural over deep D pedal. A mellow glass electric piano lifts a fourth, leaves a suspended reply. Long bowed synth harmonics, a subtle low pulse; upper line stretches this fourth across the middle section before folding inward. Restrained treble, wide space between phrases for spoken explanations. Return to drifting D beneath the same suspended chords. No vocals, no cymbals.')
}

def save(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

def utc():
    return datetime.now(timezone.utc).isoformat()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('cue', choices=CUES)
    args = parser.parse_args()
    slug = args.cue
    bpm, key, duration, seed, prompt = CUES[slug]
    raw = OUT / 'sources' / (slug + '.wav')
    assert not raw.exists(), 'Use a new take directory for regeneration'
    torch.set_num_threads(4)
    handler = AceStepHandler()
    started = utc()
    status, ok = handler.initialize_service(project_root=str(ROOT / '.runtime/media/ACE-Step-1.5'),
        config_path='acestep-v15-turbo', device='mps', use_flash_attention=False, compile_model=False,
        offload_to_cpu=False, use_mlx_dit=True)
    if not ok:
        raise RuntimeError(status)
    params = GenerationParams(caption=prompt, lyrics='[Instrumental]', instrumental=True, bpm=bpm,
        keyscale=key, timesignature='4', duration=duration, inference_steps=8, seed=seed,
        guidance_scale=1.0, thinking=False, use_cot_metas=False, use_cot_caption=False, use_cot_language=False)
    config = GenerationConfig(batch_size=1, use_random_seed=False, seeds=[seed], audio_format='wav32')
    save(OUT / 'records' / (slug+'-request.json'), {'params':params.to_dict(), 'config':config.to_dict()})
    tic = time.monotonic()
    tmp = ROOT / '.local/T124' / 'inference' / slug
    result = generate_music(handler, None, params, config, save_dir=str(tmp))
    if not result.success or len(result.audios) != 1:
        raise RuntimeError(result.error or result.status_message)
    generated = result.audios[0]
    Path(generated['path']).rename(raw)
    save(OUT / 'records' / (slug+'-generation.json'), {
        'assetId':'spec001:ASSET-MUSIC-'+slug, 'startedUtc':started, 'finishedUtc':utc(),
        'generatorKey':generated.get('key'), 'actualParams':generated.get('params'),
        'rawPath':str(raw.relative_to(ROOT)), 'rawSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),
        'rawBytes':raw.stat().st_size, 'device':'MPS / MLX DiT', 'lmEnabled':False,
        'elapsedGenerationSeconds':time.monotonic()-tic, 'processMaximumRssBytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        'versions':{p: metadata.version(p) for p in ['ace-step','torch','diffusers','transformers','mlx','soundfile']},
        'publisherWeightRevision':'19671f406d603126926c1b7e2adc169acbcade22',
        'inputAudio':None, 'status':result.status_message})
