# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Create both display sizes and compare them with each character's actual model render."""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, features
import PIL

root = Path(__file__).resolve().parents[3]
base = Path("assets-src/images/T120")
output = Path("public/assets/portraits")
evidence = Path("docs/evidence/spec001/image-production/T120")
rows = []
for folder in sorted((root / base).glob("CH[0-9][0-9]")):
    selected = folder / "second" if folder.name in {"CH05", "CH09"} else folder
    receipt = json.loads((selected / "tool-return.json").read_text())
    original = selected / "original.png"
    reference = root / receipt["reference"]
    with Image.open(original) as image:
        image.load()
        assert image.mode == "RGB" and image.width == image.height and image.width >= 1024
        sizes = {}
        for width in (512, 256):
            filename = folder.name + ("" if width == 512 else "-256") + ".webp"
            target = root / output / filename
            image.resize((width, width), Image.Resampling.LANCZOS).save(target, quality=87, method=6, exact=True)
            with Image.open(target) as display:
                display.load()
                assert display.mode == "RGB" and display.size == (width, width)
            sizes[str(width)] = {"path": str(target.relative_to(root)), "bytes": target.stat().st_size}
        rows.append({"character": folder.name, "reference": str(reference.relative_to(root)), "original": str(original.relative_to(root)),
                     "pixels": list(image.size), "pngMetadataKeys": list(image.info), "mode": image.mode, "exports": sizes})

assert len(rows) == 13
def draw_sheet(width, columns, path, include_model):
    label_height = 25
    cell_width = width * (2 if include_model else 1)
    sheet = Image.new("RGB", (columns * cell_width, ((len(rows)+columns-1)//columns) * (width+label_height)), "#16292d")
    draw = ImageDraw.Draw(sheet)
    for i, row in enumerate(rows):
        x = i % columns * cell_width
        y = i // columns * (width + label_height)
        if include_model:
            with Image.open(root / row["reference"]) as ref:
                rgba = ref.convert("RGBA")
                bounds = rgba.getbbox()
                if bounds:
                    rgba = rgba.crop(bounds)
                rgba.thumbnail((width-12, width-12), Image.Resampling.LANCZOS)
                sheet.paste(rgba, (x+(width-rgba.width)//2, y+(width-rgba.height)//2), rgba)
            x += width
        with Image.open(root / row["exports"]["256"]["path"]) as display:
            sheet.paste(display.resize((width,width), Image.Resampling.LANCZOS), (x,y))
        draw.text((x+5, y+width+4), row["character"], fill="#f6e6c4", font=ImageFont.load_default(15))
    sheet.save(root / evidence / path, quality=92)
draw_sheet(256, 3, "model-portrait-sheet.jpg", True)
draw_sheet(96, 5, "thumbnail-sheet.png", False)
(root / evidence / "exports.json").write_text(json.dumps({"pillow": PIL.__version__, "webp": features.version("webp"),
    "preset":"Full-frame Lanczos resize, WebP quality 87, method 6. No crop or recolor.", "images":rows}, indent=2)+"\n")
