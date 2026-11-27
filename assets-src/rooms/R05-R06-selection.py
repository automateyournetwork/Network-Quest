# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Measure visible subjects in the flat-color survey saved by R05-R06-verify.py."""
import json
from pathlib import Path

from PIL import Image

evidence = Path(__file__).resolve().parents[2] / 'docs/evidence/spec001/final-rooms/T137'


def measure(code, left, right):
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
    gap = models[right]['bounds'][0] - models[left]['bounds'][2] - 1
    assert gap > 0, f'{code} subjects overlap horizontally'

    filter_overlap = []
    if code == 'R06':
        u, v = next(anchor['uv'] for anchor in source['anchors'] if anchor['objectId'] == 'exit:spec001:R06:spec001:R11')
        for plate_width in (384, 1130.6666):
            radius = 22 * width / plate_width
            pixels = sum(abs(x + .5 - u * width) < radius and abs(y + .5 - v * height) < radius
                         for x, y in points['PR058'])
            assert pixels == 0, f'The wavelength filter overlaps the R11 target at {plate_width} CSS pixels'
            filter_overlap.append(dict(containedPlateWidthCss=plate_width, cssTarget=[44, 44], visibleFilterPixelsInExitSquare=pixels))

    report = dict(pixelWidth=width, pixelHeight=height,
                  method='Exact opaque flat object colors in the reopened native view. Dithered boundary pixels are omitted.',
                  models=models, separation=[dict(left=left, right=right, separatingHorizontalPixels=gap)],
                  filterDoorInRiftTarget=filter_overlap)
    (directory / 'selection-measurements.json').write_text(json.dumps(report, indent=2) + '\n')


measure('R05', 'CH06', 'PR045')
measure('R06', 'CH16', 'PR059')
