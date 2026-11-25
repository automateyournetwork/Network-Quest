# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Small original local TTS fixture; no human listening is implied."""
from pathlib import Path
import json
import resource
import time
import importlib.metadata as metadata
import numpy as np
import soundfile as sf
import torch
from kokoro import KModel, KPipeline

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
MODEL = ROOT / ".runtime/media/models/kokoro"
text = "The lamp is lit, but that does not prove the service is working. Check the physical link, record your evidence, and then test the path."
(OUT / "narrator-script.txt").write_text(text + "\n")
torch.set_num_threads(4)
start = time.perf_counter()
model = KModel(repo_id="hexgrad/Kokoro-82M", config=str(MODEL / "config.json"), model=str(MODEL / "kokoro-v1_0.pth")).to("cpu").eval()
pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M", model=model, device="cpu")
load_seconds = time.perf_counter() - start
voice = torch.load(MODEL / "voices/af_heart.pt", weights_only=True)
start = time.perf_counter()
segments = list(pipeline(text, voice=voice, speed=1.0))
generation_seconds = time.perf_counter() - start
audio = np.concatenate([s.audio.numpy() for s in segments])
assert np.isfinite(audio).all() and np.max(np.abs(audio)) > 0
sf.write(OUT / "kokoro-narrator-raw.wav", audio, 24000, subtype="FLOAT")
record = {"model": "hexgrad/Kokoro-82M", "revision": "f3ff3571791e39611d31c381e3a41a3af07b4987", "voice": "af_heart", "speed": 1.0, "device": "cpu", "threads": 4, "text": text, "phonemes": [s.phonemes for s in segments], "versions": {p: metadata.version(p) for p in ["kokoro", "misaki", "torch", "transformers", "soundfile", "spacy"]}, "load_seconds": load_seconds, "generation_seconds": generation_seconds, "duration_seconds": len(audio)/24000, "peak_absolute": float(np.max(np.abs(audio))), "rms": float(np.sqrt(np.mean(audio**2))), "sample_rate": 24000, "maximum_rss_bytes_macos": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss, "human_listening": "pending", "production_asset": False}
(OUT / "kokoro-run.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record, indent=2))
