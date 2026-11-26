# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""T065 original title-theme audition, single local 20-second output."""
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
params = GenerationParams(caption="Original title-theme audition for Network Quest, The Apprentice Descends. Warm, curious science-fiction fantasy adventure in an underground basalt lift. D minor at 92 BPM, four beats per bar. A tentative rising fourth answered by a warm three-note descent. FM bell melody, soft analog pad, restrained mallet bass. Sparse early PC game timbres with modern spacious production. Gentle invitation, not urgency. Instrumental only; no voices or lyrics. A short phrase with a soft natural ending. No reference recording, borrowed melody, named artist or imitation.", lyrics="[Instrumental]", instrumental=True, bpm=92, keyscale="D Minor", timesignature="4", duration=20, inference_steps=8, seed=20261126, guidance_scale=1.0, thinking=False, use_cot_metas=False, use_cot_caption=False, use_cot_language=False)
config = GenerationConfig(batch_size=1, use_random_seed=False, seeds=[20261126], audio_format="wav32")
(OUT / "provenance/ace-request.json").write_text(json.dumps({"params": params.to_dict(), "config": config.to_dict()}, indent=2) + "\n")
start = time.perf_counter()
result = generate_music(handler, None, params, config, save_dir=str(OUT / "raw/ace-output"))
record = {"success": result.success, "error": result.error, "status": result.status_message, "load_seconds": load_seconds, "generation_seconds": time.perf_counter()-start, "maximum_rss_bytes_macos": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss, "device": "mps", "use_mlx_dit": True, "lm_enabled": False, "versions": {p: metadata.version(p) for p in ["ace-step", "torch", "transformers", "diffusers", "mlx", "mlx-lm", "soundfile"]}, "outputs": [{"path": a.get("path"), "key": a.get("key"), "params": a.get("params")} for a in result.audios], "human_listening": "pending", "assetId": "spec001:ASSET-MUSIC-title", "eventId": "t065-title-ace-20261126-a", "candidateOnly": True}
(OUT / "provenance/ace-run.json").write_text(json.dumps(record, indent=2, default=str) + "\n")
print(json.dumps(record, indent=2, default=str), flush=True)
assert result.success, result.error
