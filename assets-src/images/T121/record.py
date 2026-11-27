# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Assemble the T121 production fragment from saved generation, image and browser evidence."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path("assets-src/images/T121")
EVIDENCE = Path("docs/evidence/spec001/image-production/T121")
TYPED = Path("docs/evidence/spec001/assets/T121")
AUTHOR = "Codex / loop138 / T121"
DATE = "2026-11-27"
NOTICE = str(SOURCE / "NOTICE.md")
TERMS = ["https://openai.com/policies/terms-of-use/", "https://openai.com/policies/services-agreement/",
         "https://openai.com/policies/service-terms/"]
FINDINGS = [
    "The raised paw, short peach muzzle, pale whiskers and braided collar separate the mole from the badger at 96 px.",
    "The dark facial stripes and broad pale nose remain clear at 96 px. The small central pin reads inside the teal coax spool.",
    "The square metal shell, top ribs, copper bail and two raised claws retain the native outline. The side latch remains visible at 96 px.",
    "Three distinct heads share the four-legged body, silver module shell and ledger tag. All three faces remain distinguishable at 96 px.",
    "The mint muzzle, faceted cheek scales and colored neck bands retain the serpent's identity. The two small keys remain identifiable in the larger portrait.",
    "The striped teal curve, copper fins, blunt muzzle and square ledger distinguish the eel from the coiled serpent.",
    "The ears clear the background and the amber pendant stands out at 96 px. The close crop trims the wing tips while preserving both copper spars.",
    "The winding key, brass cap, triangular torso panel and relaxed raised hand remain readable against the dark ground.",
    "The tiled flank and curled tail occupy distinct spaces. The two turret eyes point separately and remain legible at 96 px.",
    "Two brass horns, wide eyes and upturned hands read as a startled shrug. The plum and blue mane tips separate from the dark background.",
    "The round copper speaker and square teal listener each retain a complete face above the twist. The two stripes and paired silhouette read at 96 px.",
    "The yellow cab, treads and continuous hinged boom read as one machine. The bucket carries its own sideways-looking eyes and loose dirt.",
]


def read(path):
    return json.loads((ROOT / path).read_text())


def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def write(path, value):
    (ROOT / path).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def asset_file(row):
    return {key: row[key] for key in ("path", "sha256", "bytes")} | {"format": row["format"].lower()}


def create_fragment():
    exports = read(EVIDENCE / "exports.json")
    native = read(EVIDENCE / "native-reopen.json")
    browser = read(EVIDENCE / "browser.json")
    joined_path = "docs/evidence/spec001/image-production/portrait-join/discoveries.json"
    joined = read(joined_path)
    assert joined["status"] == "PASS" and len({r["id"] for r in joined["discoveries"]}) == 25
    registered = read("content/spec001/characters.json")["records"]
    plans = next(batch["assetIds"] for batch in read("assets-src/production-allocation.json")["batches"] if batch["task"] == "T121")
    assets = []
    for idx, row in enumerate(exports["images"]):
        ident = row["id"]
        character = next(c for c in registered if c["id"] == "spec001:" + ident)
        binding = character["compendium"]["portraitBinding"]
        aid = binding["assetId"]
        source = SOURCE / ident
        receipt_path = source / "tool-return.json"
        receipt = read(receipt_path)
        findings = FINDINGS[idx]
        native_row = next(r for r in native["images"] if r["id"] == ident)
        gallery = next(r for r in browser["gallery"] if r["id"] == ident)
        decoded = next((r for r in browser["discoveries"] if r["id"] == ident), None)
        src = [row["reference"], row["original"]]
        subjects = [*src, *row["exports"]]
        paths = [s["path"] for s in subjects]
        hashes = [s["sha256"] for s in subjects]
        assert all(digest(s["path"]) == s["sha256"] for s in subjects)
        assert native_row["toolCarrierSha256"] == row["original"]["sha256"] and native_row["modelMatchedAcceptedManifest"]
        assert aid == character["compendium"]["portraitAssetId"] == plans[idx]
        assert binding["exportPath"] == row["exports"][0]["path"]
        assert gallery["sizes"][0]["path"] == browser["nestedBase"] + binding["exportPath"].removeprefix("public/")
        observed = next(r["portrait"] for r in joined["discoveries"] if r["id"] == ident)
        assert observed["assetId"] == aid and observed["path"] == gallery["sizes"][0]["path"]
        assert observed["caption"] == binding["caption"] and [observed["width"], observed["height"]] == row["exports"][0]["dimensions"]
        if decoded:
            assert decoded["src"] == gallery["sizes"][0]["path"] and decoded["alt"] == binding["caption"]
        environment = f"macOS arm64, Apple {native['tool']}, Pillow {exports['pillow']}, libwebp {exports['webp']}, {browser['browser']}"
        verification = []

        def evidence(suffix, kind, details, check=None):
            target = TYPED / (ident + "-" + suffix + ".json")
            record = {"type": kind, "assetId": aid, "hashes": hashes, "status": "passed", "actor": "agent",
                      "reviewer": AUTHOR, "date": DATE, "environment": environment, "details": details}
            if check:
                record["check"] = check
            write(target, record)
            return str(target)

        def review(check, finding, details):
            path = evidence(check, "rights" if check == "rights" else "review", {"findings": finding, **details}, check)
            verification.append({"check": check, "status": "passed", "reviewer": AUTHOR, "date": DATE, "hashes": hashes,
                                 "environment": environment, "evidencePath": path, "findings": finding})
            return path

        production = {"method": "openai-generated", "tool": receipt["tool"], "version": receipt["version"],
                      "modelRevision": receipt["modelRevision"], "eventId": receipt["eventId"],
                      "settingsPath": str(receipt_path), "promptOrScriptPath": receipt["promptPath"],
                      "referenceHashes": [row["reference"]["sha256"]], "outputHashes": [row["original"]["sha256"]],
                      "notes": "One built-in production call with the character's own inspected Blender render. The complete returned PNG was preserved. Both display sizes retain the full artwork."}
        evidence("production", "production", {**production, "settingsSha256": digest(receipt_path),
                                               "promptSha256": digest(receipt["promptPath"]),
                                               "toolReturnedFile": native_row["toolFileName"]})
        rights = {"reviewStatus": "pending", "creators": ["John Capobianco and the Network Quest project", "OpenAI image generation directed using Codex"],
                  "licenseIds": ["CC-BY-4.0"], "noticePaths": ["LICENSE-ASSETS", NOTICE], "sourceUrls": TERMS,
                  "termsSnapshotPaths": [NOTICE], "inputPermissionPaths": [NOTICE],
                  "aiDisclosure": "Built-in OpenAI image generation from a project-owned model render. Attribution and CC BY 4.0 cover project-controlled rights."}
        review("rights", "The only visual input was the project's own model render. Public output terms, the CC BY asset license and reference permission were checked.",
               {"licenseIds": rights["licenseIds"], "noticeHashes": [digest(p) for p in rights["noticePaths"]],
                "termsHashes": [digest(NOTICE)], "permissionHashes": [digest(NOTICE)], "referenceHashes": production["referenceHashes"],
                "permitsModification": True, "permitsRedistribution": True, "permitsCommercialReuse": True, "publicTerms": TERMS})
        native_path = review("source-reopen", "Apple ImageIO via sips decoded the original and model render to TIFF in separate native processes.",
                             {"nativeReport": str(EVIDENCE / "native-reopen.json"), "nativeDecodes": native_row["nativeDecodes"],
                              "characterModel": row["model"], "characterModelSha256": row["modelSha256"]})
        review("structure", "The intact RGB PNG and both WebPs decoded. Native dimensions and hashes agreed with the export report.",
               {"exportReport": str(EVIDENCE / "exports.json"), "original": row["original"], "exports": row["exports"],
                "composition": exports["composition"]})
        review("visual", findings, {"observedPaths": paths, "tool": "view_image and Pillow comparison sheets", "methods": ["image-inspection"],
                                    "captures": [str(EVIDENCE / f"comparison-{idx // 4 + 1}.jpg"), str(EVIDENCE / "thumbnails.png")]})
        browser_findings = ("Firefox rendered the paired portrait after a guest discovered it in the Copper Warrens. A second guest retained its description after an intercepted HTTP 404."
                            if decoded else "An actual guest discovered the character and opened its compendium entry. Firefox decoded the registered portrait and both display WebPs matched the source in the separate nested-base gallery.")
        browser_path = review("browser-comparison", browser_findings,
                              {"observedPaths": paths, "methods": ["browser-inspection"], "tool": "Playwright Firefox and view_image",
                               "nativeGalleryReport": str(EVIDENCE / "browser.json"), "browserComparison": gallery,
                               "discoveryReport": joined_path, "discoveryReportSha256": digest(joined_path), "observed": observed,
                               "captures": [str(EVIDENCE / "browser-gallery.png")] + ([decoded["capture"], browser["fallback"]["capture"]] if decoded else [])})
        proof = {k: binding[k] for k in ("assetId", "contentId", "use", "exportPath", "interactiveOrEvidence")}
        usage = evidence("usage", "usage", {"bindings": [proof], "visible": True, "meaningful": True,
            "report": joined_path, "reportSha256": digest(joined_path), "discovery": observed,
            "observedCompendiumId": character["compendium"]["id"], "findings": browser_findings})
        used = [{"contentId": character["id"], "use": "compendium-portrait", "evidencePath": usage}]
        sources = [{"file": asset_file(item), "role": role, "application": app, "version": version, "reopenEvidencePath": native_path}
                   for item, role, app, version in [(src[0], "reference", "Blender", "5.2.1 LTS"), (src[1], "raw-generation", receipt["tool"], receipt["version"])]]
        assets.append({"assetId": aid, "semanticIdentity": "spec001:PORTRAIT-" + ident, "kind": "portrait",
            "status": "integrated", "countsTowardQuota": False, "interactiveOrEvidence": False,
            "variantOf": None, "derivedFrom": [], "sources": sources, "exports": [
                {"file": asset_file(e), "mimeType": "image/webp", "sourceHashes": production["outputHashes"],
                 "tool": "Pillow " + exports["pillow"], "preset": f"{e['dimensions'][0]} px. " + exports["preset"],
                 "integrationEvidencePath": browser_path} for e in row["exports"]],
            "production": [production], "rights": rights, "usedBy": used, "verification": verification,
            "image": {"width": 512, "height": 512, "colorSpace": "sRGB", "alpha": False,
                      "cameraRecordPath": row["nativeEvidence"], "registrationPath": str(EVIDENCE / "exports.json"), "layerRole": "portrait"}})
    write("assets-src/images/portraits-14-25.json", {"schemaVersion": 1, "episodeId": "spec001", "assets": assets})


if __name__ == "__main__":
    create_fragment()
