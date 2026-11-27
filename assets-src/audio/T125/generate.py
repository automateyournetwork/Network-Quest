# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Generate four independent instrumentals using the approved ACE-Step pipeline."""
from datetime import datetime, timezone
import hashlib
import importlib.metadata as packages
import json
from pathlib import Path
import sys
import time
import torch
from acestep.handler import AceStepHandler
from acestep.inference import GenerationParams, GenerationConfig, generate_music

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
CUES = {
    'radio': (98, 'G Minor', 90, 2714201,
        'Across the Skywell, original instrumental adventure score. Slow half-note arcs over a light 98 BPM four-beat ground. G Dorian with a warm E natural. An airy breath synth calls G C B-flat; a lower reed answers in the spaces, gently set to opposite sides with both clearly present in the center. Soft tuned toms and a low soft-focus pad suggest great open air; spare, conversational 1990s MIDI color in warm stereo. Develop two answering phrases, leave a bar of air, settle back to the first groove; avoid any alert, static effect, bright sibilance or vocals.'),
    'clockworks': (84, 'D Minor', 80, 2714202,
        'A Step in Your Own Time. Instrumental puzzle-room chamber music in D Dorian, steady 84 beats per minute. A soft FM celesta gives a lilting three-note question across two bars of four; a round plucked bass answers one beat late. B natural glows briefly over D. Wooden mallet and quiet pad weave a second eight-bar phrase, then the opening motif returns. Gentle human breathing space, a regular but very soft low pulse, no clock ticking, no increase in tempo or urgency, no voices. Vintage FM instruments, modern warm stereo.'),
    'rift': (72, 'D Minor', 100, 2714203,
        'The Severed, Considered. Spacious slow instrumental for deliberate repair planning in a silent quarry. A low bowed analogue synth gives D G F E D over a D minor drone; distant glass answers only at the ends of long phrases. A muted frame drum touches the first beat of alternating bars. The middle opens toward a suspended A and thins down, low unresolved D as the opening returns. Dark, careful, still kind. Restrained early PC game synth scoring in a wide modern mix. No heavy accent, sudden peak, accelerando, combat groove, voices or triumphant release.'),
    'epilogue': (80, 'D Major', 64, 2714204,
        'What the Record Remembers, original instrumental closing credits miniature in D. One complete piece, a beginning, a second thought and a clearly authored last chord. Warm synth strings, sparse soft FM bell and felt mallet voices. A single rising fourth D G followed by F-sharp E D; the middle borrows a gentle G minor color, then returns. Leave the last four bars for a slowly spaced, reflective cadence, ending on a still open D fifth; instruments stop and their natural reverb falls away completely. Respectful, neither victorious nor tragic. No percussion flourish, no vocals, no repeat.')
}

def write(path, data):
    with path.open('x') as stream:
        json.dump(data, stream, indent=2)
        stream.write('\n')

def generate(handler, slug):
    raw = OUT / 'sources' / (slug + '.wav')
    assert not raw.exists()
    bpm, key, seconds, seed, prompt = CUES[slug]
    now = lambda: datetime.now(timezone.utc).isoformat()
    params = GenerationParams(caption=prompt, lyrics='[Instrumental]', instrumental=True, bpm=bpm,
        keyscale=key, timesignature='4', duration=seconds, inference_steps=8, seed=seed,
        guidance_scale=1.0, thinking=False, use_cot_metas=False, use_cot_caption=False, use_cot_language=False)
    config = GenerationConfig(batch_size=1, use_random_seed=False, seeds=[seed], audio_format='wav32')
    write(OUT/'records'/(slug+'-request.json'), {'params':params.to_dict(), 'config':config.to_dict()})
    started, utc = time.monotonic(), now()
    result = generate_music(handler, None, params, config, save_dir=str(ROOT/'.local/T125/inference'/slug))
    if not result.success or len(result.audios) != 1:
        raise RuntimeError(result.error or result.status_message)
    take = result.audios[0]
    Path(take['path']).rename(raw)
    write(OUT/'records'/(slug+'-generation.json'), {
        'assetId':'spec001:ASSET-MUSIC-'+slug,'startedUtc':utc,'finishedUtc':now(),
        'elapsedGenerationSeconds':time.monotonic()-started,'generatorKey':take.get('key'),
        'actualParams':take.get('params'),'device':'MPS with MLX DiT','inputAudio':None,
        'versions':{p:packages.version(p) for p in ['ace-step','torch','diffusers','transformers','mlx','soundfile']},
        'weightsRevision':'19671f406d603126926c1b7e2adc169acbcade22','rawPath':str(raw.relative_to(ROOT)),
        'rawSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'rawBytes':raw.stat().st_size})
    print(slug, 'finished', flush=True)

if __name__ == '__main__':
    selected = sys.argv[1:] or list(CUES)
    assert all(slug in CUES for slug in selected)
    torch.set_num_threads(4)
    handler = AceStepHandler()
    status, ok = handler.initialize_service(project_root=str(ROOT/'.runtime/media/ACE-Step-1.5'),
        config_path='acestep-v15-turbo',device='mps',use_flash_attention=False,compile_model=False,
        offload_to_cpu=False,use_mlx_dit=True)
    if not ok:
        raise RuntimeError(status)
    for slug in selected:
        generate(handler,slug)
