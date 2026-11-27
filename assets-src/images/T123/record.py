# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Build the T123 inventory fragment and typed reviews from immutable media and native observations."""
import hashlib
import json
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path("assets-src/images/T123")
RAW = Path("docs/evidence/spec001/image-production/T123")
TYPED = Path("docs/evidence/spec001/assets/T123")
FRAGMENT = Path("assets-src/images/illustrations-13-24.json")
REPORT = RAW / "native-01/browser.json"
NOTICE = str(SOURCE / "NOTICE.md")
AUTHOR = "Codex / loop140 / T123"
TERMS = ["https://openai.com/policies/terms-of-use/", "https://openai.com/policies/services-agreement/",
         "https://openai.com/policies/service-terms/"]
FINDINGS = [
    "The large scope and two opposing dishes are legible against the unbroken pale sky. The semantic card describes the separate settings check.",
    "The two rail markers sit at distinct heights. Below the painting, real labels, two bars and a bracket preserve the worked example and units.",
    "The cabled analyzer, folded square-stamped card and round-stamped card remain distinct. The caption dates the example sheets and distinguishes actual revisions.",
    "Both diary panes hold the same tripod geometry and framing. Clear sky, rain and the blank note band are distinct even at reduced size.",
    "The module shell and crab, shape gauge, mode plate, coiled medium and spectrum swatch are distinguishable in the market palette.",
    "One empty allowance tray faces exactly three endpoint tiles. The earned card and the Workshop caption state all wattages and preserve the unresolved deficit.",
    "The circle, triangle, square and rotated diamond frames are conspicuous. The semantic key labels their exact toy levels and bit pairs.",
    "Two fans converge on the single empty slot. Their inner cards carry the same three-node motif, while outer cards carry distinct motifs.",
    "The separated conduit ends, open clamp and empty boxes remain separate. No tool is depicted executing a repair.",
    "Copper, capped fiber, facing radio dishes and marked-off isolation each occupy an equal folio quadrant with visibly distinct silhouettes.",
    "The previous notched card bears diagonal hatching; the newer card retains a crisp edge and circular stamp. No image element claims a passing test.",
    "The lantern, braced temporary span and closed gate each get a full folio leaf and different top-edge outline. Actual classification stays in the game."
]


def read(path):
    return json.loads(Path(path).read_text())


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def public_file(row):
    return {key: row[key] for key in ("path", "sha256", "bytes", "format")}


def record():
    os.chdir(ROOT)
    exports = read(RAW / "exports.json")
    report = read(REPORT)
    plans = read("assets-src/audio/production-plan.json")["illustrations"]
    allocated = next(b for b in read("assets-src/production-allocation.json")["batches"] if b["task"] == "T123")
    assert report["status"] == "PASS" and not report["errors"] and len(exports["images"]) == 12
    assert report["fallback"]["id"] == "13" and sha(report["fallback"]["capture"]) == report["fallback"]["sha256"]
    assert sorted(o["use"] for o in report["observations"] if o["id"] == "18") == ["earned-activity", "earned-decoration", "journal"]
    environment = f"macOS arm64, Apple {exports['nativeTool']}, Pillow {exports['pillow']}, libwebp {exports['libwebp']}, {report['browser']}"
    records = []
    for i, row in enumerate(exports["images"]):
        ident = row["id"]
        room_file = f"content/spec001/rooms/{row['room']}.json"
        binding = next(b for b in read(room_file)["illustrationBindings"] if b["assetId"].endswith("-" + ident))
        aid = binding["assetId"]
        assert aid == plans[12+i]["assetId"] == allocated["assetIds"][i]
        assert plans[12+i]["intendedUse"] == binding["surface"] and plans[12+i]["roomId"] == "spec001:" + row["room"]
        proof = {key: binding[key] for key in ("assetId", "contentId", "use", "exportPath", "interactiveOrEvidence")}
        observations = [o for o in report["observations"] if o["id"] == ident]
        assert observations and all(o["contentId"] == binding["contentId"] and o["alt"] == binding["alt"] and binding["caption"] in o["caption"] for o in observations)
        assert all(o["webpSha256"] == row["export"]["sha256"] and o["captureSha256"] == sha(o["capture"]) for o in observations)
        assert row["referencePixelMatch"] and row["toolCarrier"]["sha256"] == row["original"]["sha256"]
        assert len(row["nativeDecodes"]) == 3 and all(o["nativeTIFFDecoded"] for o in row["nativeDecodes"])
        inputs = [row["reference"], row["original"], row["export"]]
        paths = [entry["path"] for entry in inputs]
        hashes = [entry["sha256"] for entry in inputs]
        assert list(map(sha, paths)) == hashes and binding["exportPath"] == paths[2]
        settings = SOURCE / ident / "tool-return.json"
        receipt = read(settings)
        date = report["finished"][:10]
        checks = []

        def evidence(kind, suffix, details, check=None):
            target = TYPED / (ident + "-" + suffix + ".json")
            typed = {"type": kind, "assetId": aid, "status": "passed", "actor": "agent", "reviewer": AUTHOR,
                     "date": date, "environment": environment, "hashes": hashes, "details": details}
            if check:
                typed["check"] = check
            write(target, typed)
            return str(target)

        def review(check, finding, details):
            path = evidence("rights" if check == "rights" else "review", check, {"findings": finding, **details}, check)
            checks.append({"check": check, "status": "passed", "reviewer": AUTHOR, "date": date, "hashes": hashes,
                           "environment": environment, "evidencePath": path, "findings": finding})
            return path

        production = {"method": "openai-generated", "tool": receipt["tool"], "version": receipt["version"],
                      "modelRevision": receipt["modelRevision"], "eventId": receipt["eventId"],
                      "settingsPath": str(settings), "promptOrScriptPath": receipt["promptPath"],
                      "referenceHashes": [hashes[0]], "outputHashes": [hashes[1]],
                      "notes": "One built-in OpenAI call referenced the registered room background derivative. The saved PNG matches the tool carrier. The web export retains the complete original composition."}
        evidence("production", "production", {**production, "settingsSha256": sha(settings), "promptSha256": sha(receipt["promptPath"]),
                 "toolReturnedFile": row["toolCarrier"]["filename"], "roomLayer": row["referenceLayer"],
                 "roomLayerManifest": row["referenceManifest"], "roomLayerOrigin": row["referenceOrigin"]})
        rights = {"reviewStatus": "pending", "creators": ["John Capobianco and the Network Quest project","OpenAI image generation directed using Codex"],
                  "licenseIds": ["CC-BY-4.0"], "noticePaths": ["LICENSE-ASSETS", NOTICE], "sourceUrls": TERMS,
                  "termsSnapshotPaths": [NOTICE], "inputPermissionPaths": [NOTICE],
                  "aiDisclosure": "OpenAI-generated adventure art using a project room as the sole visual input. CC BY 4.0 applies to the project's controlled rights."}
        review("rights", "The six project room backgrounds were checked against their production manifests. Public terms and the project-controlled reuse notice were inspected.",
               {"licenseIds": rights["licenseIds"], "noticeHashes": [sha(p) for p in rights["noticePaths"]],
                "termsHashes": [sha(NOTICE)], "permissionHashes": [sha(NOTICE)], "referenceHashes": [hashes[0]],
                "permitsCommercialReuse": True, "permitsRedistribution": True, "permitsModification": True})
        reopened = review("source-reopen", "The reference, exact original and web export each reopened to TIFF through Apple ImageIO.",
                          {"nativeDecodes": row["nativeDecodes"], "toolCarrier": row["toolCarrier"], "exportReport": str(RAW / "exports.json")})
        review("structure", "The immutable reference and original decoded and the 640-pixel-wide playable derivative retained their documented dimensions and exact SHA-256.",
               {"original": row["original"], "export": row["export"], "referenceOrigin": row["referenceOrigin"], "referencePixelMatch": True})
        review("visual", FINDINGS[i], {"methods": ["image-inspection"], "tool": "view_image and Pillow comparison sheets", "observedPaths": paths,
                                       "capture": str(RAW / f"review-{i//4+1}.jpg"), "layout": plans[12+i]})
        browser_finding = f"Firefox decoded the registered WebP at a player-accessible {binding['surface']} disclosure in {row['room']}. The exact caption and alternative text matched the room binding."
        if ident == "18":
            browser_finding += " The earned activity, R09 notebook and earned R02 Workshop decoration displayed the same asset."
        comparison = review("browser-comparison", browser_finding, {"methods": ["browser-inspection"], "tool": "Playwright Firefox and view_image",
                            "observedPaths": paths, "captures": [o["capture"] for o in observations], "report": str(REPORT),
                            "reportSha256": sha(REPORT), "observations": observations})
        usage = evidence("usage", "usage", {"bindings": [proof], "visible": True, "meaningful": True, "observations": observations,
                                            "roomDocument": room_file, "roomDocumentSha256": sha(room_file), "report": str(REPORT), "reportSha256": sha(REPORT)})
        sources = [{"file": public_file(entry), "role": role, "application": app, "version": version, "reopenEvidencePath": reopened}
                   for entry, role, app, version in [(inputs[0], "reference", "Apple sips", exports["nativeTool"]),
                                                     (inputs[1], "raw-generation", receipt["tool"], receipt["version"])]]
        width, height = inputs[2]["dimensions"]
        records.append({"assetId": aid, "semanticIdentity": "spec001:ILLUSTRATION-" + ident, "kind": "illustration",
            "status": "integrated", "countsTowardQuota": False, "interactiveOrEvidence": False, "variantOf": None, "derivedFrom": [],
            "sources": sources, "exports": [{"file": public_file(inputs[2]), "mimeType": "image/webp", "sourceHashes": [hashes[1]],
                "tool": "Pillow " + exports["pillow"], "preset": "Full-frame RGB, 640 px wide, Lanczos, WebP quality 87 method 6. No raster labels.", "integrationEvidencePath": comparison}],
            "production": [production], "rights": rights, "usedBy": [{"contentId": binding["contentId"], "use": binding["use"], "evidencePath": usage}],
            "verification": checks, "image": {"width": width, "height": height, "colorSpace": "sRGB", "alpha": False,
                "cameraRecordPath": str(settings), "registrationPath": str(RAW / "exports.json"), "layerRole": "illustration"}})
    write(FRAGMENT, {"schemaVersion": 1, "episodeId": "spec001", "assets": records})


if __name__ == "__main__":
    record()
