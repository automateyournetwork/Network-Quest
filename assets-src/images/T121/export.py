# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Export compendium art and record image lineage from the retained tool receipts."""
import hashlib
import json
import math
from pathlib import Path

import PIL
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat, features

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path("assets-src/images/T121")
EVIDENCE = Path("docs/evidence/spec001/image-production/T121")
PUBLIC = Path("public/assets/portraits")


def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def file_info(path):
    with Image.open(ROOT / path) as image:
        image.load()
        return {"path": str(path), "sha256": digest(path), "bytes": (ROOT / path).stat().st_size,
                "format": image.format, "dimensions": list(image.size), "mode": image.mode}


def read(path):
    return json.loads((ROOT / path).read_text())


def rmse(left, right):
    return round(math.sqrt(sum(ImageStat.Stat(ImageChops.difference(left, right)).sum2)
                           / (left.width * left.height * 3)), 4)


def export(number, name):
    character = f"CH{number}"
    directory = SOURCE / character
    receipt = read(directory / "tool-return.json")
    reference = Path(receipt["referenced_image_paths"][0])
    model = f"assets-src/characters/{character}.blend"
    native = (f"docs/evidence/spec001/character-production/T108/{character}-native.json" if number < 18
              else f"docs/evidence/spec001/character-production/T109/{character}/native.json")
    row = {"id": character, "name": name, "model": model, "modelSha256": digest(model),
           "nativeEvidence": native, "nativeEvidenceSha256": digest(native),
           "reference": file_info(reference), "original": file_info(Path(receipt["original"])),
           "promptSha256": digest(receipt["promptPath"]), "receiptSha256": digest(directory / "tool-return.json"),
           "exports": []}

    # Check T109's separately retained full-resolution Blender capture against the
    # three-quarter panel of its accepted public comparison sheet.
    if number >= 18:
        sheet = Path(native).with_name("sheet.jpg")
        assert row["modelSha256"] == read(native)["nativeSourceSha256"]
        with Image.open(ROOT / reference) as ref, Image.open(ROOT / sheet) as approved:
            scaled = ref.convert("RGB").resize((272, 272), Image.Resampling.LANCZOS)
            error = rmse(scaled, approved.crop((18, 92, 290, 364)).convert("RGB"))
        assert error < 3, (character, error)
        row["publicReferenceComparison"] = {"sheet": str(sheet), "sheetSha256": digest(sheet),
                                            "sourcePanelPx": [18, 92, 290, 364], "rmse8BitRgb": error}
    with Image.open(ROOT / receipt["original"]) as original:
        original.load()
        assert original.mode == "RGB" and original.width == original.height and original.width >= 1024
        for width, suffix in [(512, ""), (256, "-256")]:
            path = PUBLIC / f"{character}{suffix}.webp"
            scaled = original.resize((width, width), Image.Resampling.LANCZOS)
            scaled.save(ROOT / path, "WEBP", quality=87, method=6, exact=True)
            with Image.open(ROOT / path) as image:
                assert image.mode == "RGB" and image.size == (width, width)
                row["exports"].append({**file_info(path), "rmse8BitRgbFromResizedOriginal": rmse(scaled, image)})
    return row


def sheet(rows, tile, cols, path, model=False):
    cell = tile * (2 if model else 1)
    sheet = Image.new("RGB", (cols * cell, math.ceil(len(rows) / cols) * (tile + 24)), "#192a30")
    draw = ImageDraw.Draw(sheet)
    for idx, row in enumerate(rows):
        x, y = idx % cols * cell, idx // cols * (tile + 24)
        if model:
            with Image.open(ROOT / row["reference"]["path"]) as ref:
                rgba = ref.convert("RGBA").resize((tile, tile), Image.Resampling.LANCZOS)
                sheet.paste(rgba, (x, y), rgba)
            x += tile
        with Image.open(ROOT / row["exports"][0]["path"]) as image:
            sheet.paste(image.resize((tile, tile), Image.Resampling.LANCZOS), (x, y))
        label = row["name"] if model else row["id"]
        draw.text((x + 3, y + tile + 3), label, fill="#f1e4c5", font=ImageFont.load_default(15))
    sheet.save(ROOT / EVIDENCE / path, **({"quality": 93, "subsampling": 0} if path.endswith(".jpg") else {}))


if __name__ == "__main__":
    (ROOT / EVIDENCE).mkdir(parents=True, exist_ok=True)
    (ROOT / PUBLIC).mkdir(parents=True, exist_ok=True)
    plans = read("assets-src/audio/production-plan.json")["portraits"][13:25]
    rows = [export(number, plan["name"].removesuffix(" portrait")) for number, plan in enumerate(plans, 14)]
    assert len(set(row["original"]["sha256"] for row in rows)) == 12
    assert len(set(e["sha256"] for row in rows for e in row["exports"])) == 24
    for page in range(3):
        sheet(rows[4 * page:4 * page + 4], 256, 2, f"comparison-{page + 1}.jpg", model=True)
    sheet(rows, 96, 4, "thumbnails.png")
    report = {"pillow": PIL.__version__, "webp": features.version("webp"),
              "preset": "Full-frame RGB Lanczos resize; WebP quality 87, method 6, exact=True.",
              "composition": "Whole square, with the generator framing unchanged at both display sizes.",
              "images": rows}
    (ROOT / EVIDENCE / "exports.json").write_text(json.dumps(report, indent=2) + "\n")
