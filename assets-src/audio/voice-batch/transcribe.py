# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Transcribe each exact final MP3 independently, without giving the recognizer any dialogue."""
from difflib import SequenceMatcher
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re
import subprocess
import sys

import numpy as np
import torch
from transformers import WhisperForConditionalGeneration, WhisperProcessor

ROOT = Path(__file__).resolve().parents[3]
REVISION = '911407f4214e0e1d82085af863093ec0b66f9cd6'
WEIGHTS = 'd4dd5542fd6a1d35639e21384238f3bfe6c557c849d392b5905d33ee29e71db5'


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()


def words(text):
    return re.findall(r"[a-z0-9]+",text.lower())


def main(task, recheck=False):
    assert task in ('T129','T130','T131')
    folder = ROOT/'assets-src/audio'/task/'records'
    rows = json.loads((folder/'exports.json').read_text())['voices']
    if recheck:
        original = json.loads((folder/'transcription.json').read_text())['lines']
        selected = {r['assetId'] for r in original if r['caseAndPunctuationNormalizedDifferences']}
        rows = [r for r in rows if r['assetId'] in selected]
    model_path = ROOT/'.runtime/media/models/whisper-base.en'
    assert digest(model_path/'model.safetensors') == WEIGHTS
    torch.set_num_threads(3)
    model = WhisperForConditionalGeneration.from_pretrained(model_path, local_files_only=True).eval().to('cpu')
    processor = WhisperProcessor.from_pretrained(model_path,local_files_only=True)
    results=[]
    with torch.inference_mode():
        for row in rows:
            path = ROOT/row['web']['path']
            assert digest(path)==row['web']['sha256']
            decoded = subprocess.check_output(['ffmpeg','-v','error','-nostdin','-i',str(path),
                '-ar','16000','-ac','1','-f','f32le','pipe:1'])
            samples = np.frombuffer(decoded,dtype='<f4')
            inputs = processor(samples, sampling_rate=16000,return_attention_mask=True,return_tensors='pt')
            output = model.generate(input_features=inputs.input_features, attention_mask=inputs.attention_mask,
                                    do_sample=False,num_beams=5 if recheck else 1,max_new_tokens=128)
            result = processor.batch_decode(output,skip_special_tokens=True)[0].strip()
            assert result
            a,b = words(row['caption']),words(result)
            differences = [{'change':tag,'expected':' '.join(a[i:j]),'recognized':' '.join(b[k:l])}
                 for tag,i,j,k,l in SequenceMatcher(None,a,b,autojunk=False).get_opcodes() if tag!='equal']
            results.append(dict(assetId=row['assetId'],web=row['web'],caption=row['caption'],transcript=result,
                                caseAndPunctuationNormalizedDifferences=differences))
            print(row['number'],result,flush=True)
    record=dict(model='openai/whisper-base.en',revision=REVISION,weightsSha256=WEIGHTS,device='CPU',
        transformers=importlib.metadata.version('transformers'),torch=importlib.metadata.version('torch'),
        beams=5 if recheck else 1,method='Unprompted English transcription from the decoded 16 kHz mono final MP3, independent segments, deterministic decoding; word alignment lowercases and removes punctuation. Interpret recognized differences by line. A recognition result cannot establish a human listener’s judgment.',lines=results)
    (folder/('transcription-recheck.json' if recheck else 'transcription.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':
    main(sys.argv[1],sys.argv[2:]==['--recheck'])
