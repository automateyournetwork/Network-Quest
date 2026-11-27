# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Export full-frame WebP field illustrations, verify the six references, and reopen each file."""
import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, __version__, features

ROOT = Path(__file__).resolve().parents[3]
SRC = Path("assets-src/images/T123")
RAW = Path("docs/evidence/spec001/image-production/T123")
PRESET = "Full original composition, RGB, 640 px wide, Lanczos resampling, WebP quality 87 and method 6. No raster labels or added artwork."


def load(path):
    return json.loads(Path(path).read_text())


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def image_info(path):
    path = Path(path)
    with Image.open(path) as image:
        image.load()
        return {"path": str(path), "sha256": digest(path), "bytes": path.stat().st_size,
                "format": image.format.lower(), "dimensions": list(image.size), "mode": image.mode}


def carrier_path(receipt):
    name = re.search(r"(generated_images/[\w-]+/exec-[\w-]+\.png)", receipt["outputHint"])[1]
    return Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")) / name


def export(check_provider):
    os.chdir(ROOT)
    (ROOT / "public/assets/illustrations").mkdir(parents=True, exist_ok=True)
    rows = []
    for number in range(13, 25):
        ident = str(number)
        room = f"R{(number+1)//2:02}"
        receipt = load(SRC / ident / "tool-return.json")
        original = Path(receipt["original"])
        reference = Path(receipt["referenced_image_paths"][0])
        room_file = Path(f"public/assets/images/{room}/background.webp")
        batch = "05-08" if number <= 16 else "09-12"
        manifest = Path(f"assets-src/images/rooms-{batch}.json")
        layer = next(row for row in load(manifest)["assets"] if row["assetId"] == f"spec001:ASSET-LAYER-{room}-background")
        assert any(row["file"]["path"] == str(room_file) and row["file"]["sha256"] == digest(room_file) for row in layer["exports"])
        with tempfile.TemporaryDirectory() as temp:
            check = Path(temp) / "reference.png"
            subprocess.run(["sips", "-s", "format", "png", "-Z", "448", str(room_file), "--out", str(check)], check=True, capture_output=True)
            with Image.open(check) as decoded, Image.open(reference) as archived:
                assert decoded.mode == archived.mode and decoded.size == archived.size and decoded.tobytes() == archived.tobytes()
        destination = Path(f"public/assets/illustrations/{ident}.webp")
        with Image.open(original) as image:
            size = (640, round(640 * image.height / image.width))
            image.convert("RGB").resize(size, Image.Resampling.LANCZOS).save(destination, quality=87, method=6, exact=True)
        reopened = []
        with tempfile.TemporaryDirectory() as temp:
            for i, path in enumerate([reference, original, destination]):
                copy = Path(temp) / f"{i}.tiff"
                subprocess.run(["sips", "-s", "format", "tiff", str(path), "--out", str(copy)], check=True, capture_output=True)
                with Image.open(copy) as decoded:
                    decoded.load()
                    assert list(decoded.size) == image_info(path)["dimensions"]
                    reopened.append({"path": str(path), "dimensions": list(decoded.size), "nativeTIFFDecoded": True})
        row = {"id": ident, "room": room, "reference": image_info(reference), "referenceOrigin": image_info(room_file),
               "referenceManifest": str(manifest), "referenceLayer": layer["assetId"],
               "referencePixelMatch": True, "original": image_info(original), "export": image_info(destination),
               "nativeDecodes": reopened, "event": receipt["eventId"]}
        if check_provider:
            carrier = carrier_path(receipt)
            assert digest(carrier) == row["original"]["sha256"]
            row["toolCarrier"] = {"filename": carrier.name, "sha256": digest(carrier)}
        rows.append(row)
    write(RAW / "exports.json", {"pillow": __version__, "libwebp": features.version("webp"), "preset": PRESET,
                                 "nativeTool": subprocess.check_output(["sips", "--version"], text=True).strip(),
                                 "images": rows})
    for start in range(0, len(rows), 4):
        sheet = Image.new("RGB", (700, 512), "#19252b")
        draw = ImageDraw.Draw(sheet)
        for offset, row in enumerate(rows[start:start+4]):
            with Image.open(row["export"]["path"]) as picture:
                picture.thumbnail((340, 225))
                x, y = (offset % 2) * 350, (offset // 2) * 256
                sheet.paste(picture, (x+4, y+4))
                draw.text((x+4, y+232), "Illustration " + row["id"], fill="#fff3d6")
        sheet.save(RAW / f"review-{start//4+1}.jpg", quality=93)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify-provider-copy", action="store_true", help="Also compare production-host tool carrier hashes.")
    export(parser.parse_args().verify_provider_copy)
