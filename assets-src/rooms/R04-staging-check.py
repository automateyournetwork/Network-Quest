# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Compare the final layered silhouettes, recorded pivots, and independently rerendered moved apparatus."""

from pathlib import Path
import json
from PIL import Image, ImageChops, ImageFilter

base = Path.cwd()
out = base / "docs/evidence/spec001/final-rooms/T136/R04"
read = lambda path: json.loads((base / path).read_text())
stage = read("content/spec001/presentation/R04.json")
sheets = {
    r["assetId"]: Image.open(
        base / ("public/assets/sprites/R04/" + r["assetId"].split("-")[-1] + ".webp")
    ).convert("RGBA")
    for r in stage["atlases"]
}


def cell(row):
    x, y = next(iter(row["clips"].values()))["frames"][0]["offset"]
    w, h = row["size"]
    image = sheets[row["atlasId"]].crop((x, y, x + w, y + h))
    layer = Image.new("RGBA", (1024, 576))
    layer.paste(
        image, tuple(round(v - p) for v, p in zip(row["footpoint"], row["pivot"]))
    )
    return layer


subjects = stage["subjects"]
masks = {
    s["id"]: cell(s).getchannel("A").point(lambda v: 255 if v >= 128 else 0)
    for s in subjects
}
foreground = Image.open(base / "public/assets/images/R04/foreground.webp").getchannel("A")
foreground = foreground.resize((1024, 576), Image.Resampling.LANCZOS).point(lambda v: 255 if v >= 128 else 0)
front_coverage = {
    id: round(100 * ImageChops.multiply(mask, foreground).histogram()[255] / mask.histogram()[255], 3)
    for id, mask in masks.items()
}
overlaps = {}
occupied = Image.new("L", (1024, 576))
picks = {}
for row in reversed(subjects):
    id = row["id"]
    m = masks[id]
    actual = ImageChops.subtract(m, occupied)
    overlaps[id] = round((1 - actual.histogram()[255] / m.histogram()[255]) * 100, 3)
    center = (
        round(row["footpoint"][0]),
        round(row["footpoint"][1] - row["pivot"][1] * 0.42),
    )
    for size in (19, 13, 7, 3, 1):
        eroded = actual.filter(ImageFilter.MinFilter(size)) if size > 1 else actual
        box = eroded.getbbox()
        if box:
            p = min(
                (
                    (x, y)
                    for y in range(box[1], box[3])
                    for x in range(box[0], box[2])
                    if eroded.getpixel((x, y))
                ),
                key=lambda p: sum((q - r) ** 2 for q, r in zip(p, center)),
            )
            picks[id] = p
            break
    occupied = ImageChops.lighter(occupied, m)
report = {
    "stagePx": [1024, 576],
    "alphaThreshold": 128,
    "opaqueAreaCoveredByAllNearerSubjectsPercent": overlaps,
    "opaqueAreaCoveredByForegroundPlatePercent": front_coverage,
    "ordinaryArrivalPickPixel": picks,
    "rerenderedCells": [],
}
for id in ("PR032", "PR033", "PR034", "PR036", "PR037", "PR039", "PR040"):
    f = base / f".local/T136/inspection/{id}.png"
    ref = Image.open(f).getchannel("A").point(lambda v: 255 if v >= 128 else 0)
    fixed = masks[id]
    union = ImageChops.lighter(ref, fixed).histogram()[255]
    intersection = ImageChops.multiply(ref, fixed).histogram()[255]
    iou = intersection / union
    report["rerenderedCells"].append(
        {
            "id": id,
            "nativeBounds": ref.getbbox(),
            "webBounds": fixed.getbbox(),
            "intersectionOverUnion": round(iou, 5),
        }
    )
    assert iou > 0.90, (id, ref.getbbox(), fixed.getbbox(), iou)
for far, near in [("CH13", "PR040"), ("PR033", "CH13"), ("PR039", "CH01")]:
    assert ImageChops.multiply(masks[far], masks[near]).histogram()[255] == 0
(out / "staging.json").write_text(json.dumps(report, indent=2) + "\n")
