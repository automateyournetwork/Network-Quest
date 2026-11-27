# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Verify every native image decode on macOS and, during production, its tool carrier."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

from export import ROOT, EVIDENCE, SOURCE, read, digest


def native_decode(record, scratch):
    path = ROOT / record["path"]
    result = subprocess.check_output(["sips", "-g", "pixelWidth", "-g", "pixelHeight", "-g", "format", path], text=True)
    dimensions = [int(re.search(key + r": (\d+)", result)[1]) for key in ("pixelWidth", "pixelHeight")]
    assert dimensions == record["dimensions"] and re.search(r"format: (\w+)", result)[1].upper() == record["format"]
    converted = scratch / (record["sha256"] + ".tiff")
    subprocess.run(["sips", "-s", "format", "tiff", path, "--out", converted], check=True, stdout=subprocess.DEVNULL)
    assert converted.stat().st_size > 0 and digest(record["path"]) == record["sha256"]
    converted.unlink()
    return {"path": record["path"], "sha256": record["sha256"], "pixelDimensions": dimensions, "nativeTiffDecoded": True}


def verify():
    out = []
    seal = {row["path"]: row["sha256"] for row in read("docs/evidence/spec001/character-production/T108/seal.json")["files"]}
    # The recorded tool carrier is local to the production machine. All public
    # comparison and decode checks use shipped source and export files.
    codex_dir = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
    with tempfile.TemporaryDirectory(prefix="nq-portrait-decode-") as tmp:
        for row in read(EVIDENCE / "exports.json")["images"]:
            ident = row["id"]
            receipt = read(SOURCE / ident / "tool-return.json")
            carrier = re.search(r"\$CODEX_HOME/(generated_images/[a-z0-9-]+/exec-[a-z0-9-]+\.png)", receipt["outputHint"])[1]
            carrier_hash = hashlib.sha256((codex_dir / carrier).read_bytes()).hexdigest()
            assert carrier_hash == row["original"]["sha256"]
            manifest = "batch-b.json" if int(ident[2:]) < 18 else "batch-c.json"
            model = next(a for a in read("assets-src/characters/" + manifest)["assets"] if a["assetId"] == "spec001:ASSET-" + ident)
            assert next(s for s in model["sources"] if s["role"] == "native")["file"]["sha256"] == row["modelSha256"]
            assert receipt["referenced_image_paths"] == [row["reference"]["path"]]
            if manifest == "batch-b.json":
                assert seal[row["reference"]["path"]] == row["reference"]["sha256"]
            subjects = [row["reference"], row["original"], *row["exports"]]
            out.append({"id": ident, "eventId": receipt["eventId"], "toolFileName": Path(carrier).name,
                        "toolCarrierSha256": carrier_hash, "modelMatchedAcceptedManifest": True,
                        "exactRenderedReferenceSha256": row["reference"]["sha256"],
                        "nativeDecodes": [native_decode(subject, Path(tmp)) for subject in subjects]})
    assert len({r["eventId"] for r in out}) == 12
    result = {"scope": "Each immutable original matched the exact PNG named in its own built-in tool hint, and every character model hash matched its accepted T108 or T109 source manifest. CH14–17 input hashes also matched the T108 model-production seal. Apple sips performed a new TIFF conversion for all 48 references, originals and exports. The TIFFs were temporary verification files.",
              "tool": subprocess.check_output(["sips", "--version"], text=True).strip(), "images": out}
    (ROOT / EVIDENCE / "native-reopen.json").write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    verify()
