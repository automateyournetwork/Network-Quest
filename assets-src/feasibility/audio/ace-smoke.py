# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Original instrumental feasibility prompt, single local 10-second output."""
from pathlib import Path
import importlib.metadata as metadata
import json
import resource
import time
import torch
from acestep.handler import AceStepHandler
from acestep.inference import GenerationParams, GenerationConfig, generate_music

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
PROJECT = ROOT / ".runtime/media/ACE-Step-1.5"
torch.set_num_threads(4)
start = time.perf_counter()
handler = AceStepHandler()
status, initialized = handler.initialize_service(project_root=str(PROJECT), config_path="acestep-v15-turbo", device="mps", use_flash_attention=False, compile_model=False, offload_to_cpu=False, use_mlx_dit=True)
print(status, flush=True)
assert initialized, status
load_seconds = time.perf_counter() - start
params = GenerationParams(caption="Original instrumental cue for a strange underground workshop. Warm marimba notes, soft analog synth chords, a gentle metallic pulse, and a curious rising melody. Sparse arrangement, playful science fiction adventure atmosphere. No voices or lyrics.", lyrics="[Instrumental]", instrumental=True, bpm=96, keyscale="C Major", timesignature="4", duration=10, inference_steps=8, seed=20261125, guidance_scale=1.0, thinking=False, use_cot_metas=False, use_cot_caption=False, use_cot_language=False)
config = GenerationConfig(batch_size=1, use_random_seed=False, seeds=[20261125], audio_format="wav32")
(OUT / "ace-request.json").write_text(json.dumps({"params": params.to_dict(), "config": config.to_dict()}, indent=2) + "\n")
start = time.perf_counter()
result = generate_music(handler, None, params, config, save_dir=str(OUT / "ace-output"))
record = {"success": result.success, "error": result.error, "status": result.status_message, "load_seconds": load_seconds, "generation_seconds": time.perf_counter()-start, "maximum_rss_bytes_macos": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss, "device": "mps", "use_mlx_dit": True, "lm_enabled": False, "versions": {p: metadata.version(p) for p in ["ace-step", "torch", "transformers", "diffusers", "mlx", "mlx-lm", "soundfile"]}, "outputs": [{"path": a.get("path"), "key": a.get("key"), "params": a.get("params")} for a in result.audios], "human_listening": "pending", "production_asset": False}
(OUT / "ace-run.json").write_text(json.dumps(record, indent=2, default=str) + "\n")
print(json.dumps(record, indent=2, default=str), flush=True)
assert result.success, result.error
