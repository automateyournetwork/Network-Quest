#!/usr/bin/env python3
# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Read actual image bytes and report geometry/alpha; never modify image pixels."""
from pathlib import Path
import hashlib
import json
import sys
from PIL import Image, __version__ as pillow_version


def inspect(path):
    data = path.read_bytes()
    with Image.open(path) as source:
        source.load()
        rgba = source.convert('RGBA')  # In-memory inspection only; no output image.
        alpha = rgba.getchannel('A')
        histogram = alpha.histogram()
        count = source.width * source.height
        regions = {}
        for name, box in {
            'central_stage': (0.20, 0.25, 0.80, 0.85),
            'top_middle': (0.30, 0.00, 0.70, 0.25),
            'bottom_middle': (0.20, 0.85, 0.80, 1.00),
        }.items():
            pixel_box = tuple(round(v * (source.width if i % 2 == 0 else source.height))
                              for i, v in enumerate(box))
            crop = alpha.crop(pixel_box)
            h = crop.histogram()
            regions[name] = {
                'normalizedBox': box,
                'pixels': crop.width * crop.height,
                'nonzeroAlphaPixels': sum(h[1:]),
                'maxAlpha': crop.getextrema()[1],
            }
        return {
            'path': path.as_posix(), 'sha256': hashlib.sha256(data).hexdigest(),
            'bytes': len(data), 'format': source.format, 'mode': source.mode,
            'width': source.width, 'height': source.height,
            'metadataKeys': sorted(source.info),
            'iccProfileBytes': len(source.info.get('icc_profile', b'')),
            'hasAlphaChannel': 'A' in source.getbands(),
            'alphaExtrema': alpha.getextrema(), 'nonzeroAlphaBounds': alpha.getbbox(),
            'alphaAbove1Bounds': alpha.point(lambda v: 255 if v > 1 else 0).getbbox(),
            'alphaAbove127Bounds': alpha.point(lambda v: 255 if v > 127 else 0).getbbox(),
            'transparentPixels': histogram[0], 'opaquePixels': histogram[255],
            'partialAlphaPixels': sum(histogram[1:255]),
            'transparentFraction': histogram[0] / count,
            'decodedRgbaBytes': count * 4,
            'regions': regions,
        }


if __name__ == '__main__':
    print(json.dumps({'tool': 'Pillow', 'version': pillow_version,
                      'files': [inspect(Path(p)) for p in sys.argv[1:]]}, indent=2))
