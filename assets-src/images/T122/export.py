# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Convert complete, unmodified OpenAI originals to browser WebP, and render a comparison sheet."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, features, __version__
root = Path(__file__).resolve().parents[3]
evidence = root / 'docs/evidence/spec001/image-production/T122'
exports = root / 'public/assets/illustrations'
evidence.mkdir(parents=True, exist_ok=True)
exports.mkdir(parents=True, exist_ok=True)
sheet = Image.new('RGB', (3*350,4*267),'#172427')
draw = ImageDraw.Draw(sheet)
rows = []
for i in range(1,13):
    number = f'{i:02d}'
    folder = root / 'assets-src/images/T122' / number
    with Image.open(folder/'original.png') as original:
        original.load()
        size = original.size
        display = original.convert('RGB')
        display.thumbnail((768, 576),Image.Resampling.LANCZOS)
        output = exports/(number+'.webp')
        display.save(output, 'WEBP', quality=88, method=6)
    with Image.open(output) as converted:
        converted.load()
        rows.append(dict(number=number, originalSize=size, displaySize=converted.size, bytes=output.stat().st_size))
        thumb = converted.copy()
        thumb.thumbnail((346,239), Image.Resampling.LANCZOS)
        x, y = (i-1)%3 *350,(i-1)//3 *267
        sheet.paste(thumb,(x+(350-thumb.width)//2,y))
        draw.text((x+4,y+241),number,fill='white')
sheet.save(evidence/'display-sheet.jpg',quality=93)
(evidence/'exports.json').write_text(json.dumps(dict(pillow=__version__,libwebp=features.version('webp'),images=rows), indent=2)+'\n')
