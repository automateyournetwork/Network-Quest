# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Measure visible subjects in the flat-color survey saved by R11-R12-verify.py."""
import json
from pathlib import Path

from PIL import Image

evidence = Path(__file__).resolve().parents[2] / 'docs/evidence/spec001/final-rooms/T140'


def measure(code):
    directory = evidence / code
    source = json.loads((directory / 'source-reopen.json').read_bytes())
    with Image.open(directory / 'selection-survey.png') as image:
        survey = image.convert('RGBA')
    width, height = survey.size
    palette = {tuple(rgb): subject for subject, rgb in source['surveyPalette'].items()}
    points = {subject: [] for subject in palette.values()}
    for index, (r, g, b, alpha) in enumerate(survey.get_flattened_data()):
        subject = palette.get((r, g, b))
        if alpha >= 128 and subject:
            points[subject].append((index % width, index // width))

    models = {}
    for subject, coordinates in points.items():
        assert coordinates, f'Missing visible pixels for {subject}'
        x, y = zip(*coordinates)
        models[subject] = dict(exactIdPixels=len(coordinates), bounds=[min(x), min(y), max(x), max(y)])
    exclusions = [('CH25','PR101'),('CH25','PR104'),('CH01','PR103')] if code=='R11' else [('CH02','PR111'),('CH12','PR112'),('PR111','PR119')]
    gaps = []
    for a,b in exclusions:
        x1,y1,x2,y2=models[a]['bounds'];u1,v1,u2,v2=models[b]['bounds']
        gaps.append(dict(pair=[a,b],axisSeparation=max(x1-u2,u1-x2,y1-v2,v1-y2)-1))
    report=dict(pixelWidth=width,pixelHeight=height,method='Exact opaque flat object colors in the reopened native camera. Dithered boundaries omitted.',models=models,separations=gaps)
    (directory/'selection-measurements.json').write_text(json.dumps(report,indent=2)+'\n')
    print(code,gaps)


measure('R11')
measure('R12')
