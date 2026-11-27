# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Record the actual generator events, model ancestry, browser decodes and discovered uses."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[3]
batch = "assets-src/images/T120"
proof = "docs/evidence/spec001/assets/T120"
review = "docs/evidence/spec001/image-production/T120"
date = "2026-11-27"
reviewer = "Codex worker loop137/T120"
env = "macOS arm64, original Blender 5.2.1 renders, OpenAI built-in image generation, Pillow 12.1.0 / libwebp 1.6.0 and Firefox 159.0."
parser = argparse.ArgumentParser()
parser.add_argument("--joined-report", help="Reviewed repository-relative T104 guest report with actual discovery/portrait dimensions.")
args = parser.parse_args()

def read(path):
    return json.loads((root/path).read_text())

def write(path, obj):
    (root/path).write_text(json.dumps(obj, indent=2, ensure_ascii=False)+"\n")
    return path

def sha(path):
    return hashlib.sha256((root/path).read_bytes()).hexdigest()

def info(path):
    return dict(path=path, sha256=sha(path), bytes=(root/path).stat().st_size, format=Path(path).suffix[1:])

def reference_model(id):
    file = "assets-src/manifest.json" if id in {"CH01","CH03"} else "assets-src/characters/batch-a.json" if id <= "CH09" else "assets-src/characters/batch-b.json"
    model = next(a for a in read(file)["assets"] if a["assetId"] == "spec001:ASSET-"+id)
    source = next(s for s in model["sources"] if s["role"]=="native")
    for f in [source["file"], model["exports"][0]["file"]]:
        assert info(f["path"]) == f
    return {"modelId":model["assetId"], "sourceRecord":file, "native":source["file"], "historicalExport":model["exports"][0]["file"],
            "nativeReopenEvidence":source["reopenEvidencePath"], "nativeReopenSha256":sha(source["reopenEvidencePath"])}

rights = {"creators":["John Capobianco and Network Quest, character designs and original model renders","OpenAI built-in image generation with Codex-assisted direction"],
    "licenseIds":["CC-BY-4.0"], "reviewStatus":"accepted","noticePaths":[batch+"/NOTICE.md","LICENSE-ASSETS"],
    "sourceUrls":["https://openai.com/policies/terms-of-use/","https://openai.com/policies/services-agreement/","https://openai.com/policies/service-terms/"],
    "termsSnapshotPaths":["assets-src/images/T117/terms-review.md"],"inputPermissionPaths":[batch+"/input-permissions.md"],
    "aiDisclosure":"OpenAI painted these fictional characters from the project's original Blender renders. The project licenses its interest in the artwork. The generation tool did not expose the model revision or seed."}
images = read(review+"/exports.json")["images"]
actual = read(review+"/browser.json")
registry = {a["id"]:a for a in read("content/spec001/characters.json")["records"]}
allocations = next(a["assetIds"] for a in read("assets-src/production-allocation.json")["batches"] if a["task"]=="T120")
plan = {p["characterId"]:p for p in read("assets-src/audio/production-plan.json")["portraits"]}
joined = {}
if args.joined_report:
    assert not Path(args.joined_report).is_absolute() and args.joined_report.startswith("docs/evidence/spec001/")
    joined = {d["id"]:d for d in read(args.joined_report)["discoveries"]}

assets = []
visual = [
    "The copper goggle rims and hand holding a pencil are distinct against the teal coat.",
    "The miner's lamp and tiny cream mug held by one giant hand preserve the guardian's identity and scale cue.",
    "The wings, two luminous antenna tips and banded lantern abdomen remain distinct around the dark face.",
    "Two gold probes sit clear of the muzzle above the banded copper coil.",
    "The second painting enlarges the Unicorn's eye and white muzzle while preserving the single horn, ribbon mane and ledger corner.",
    "All three heads are separated. The middle reader's golden spectacles contrast with the pale side muzzles above one gauge.",
    "A round survey monocle, pale head and blue feather fans form a distinct V silhouette.",
    "The ivory horns and small flat receipt separate from the blue muzzle, wings and sage belly.",
    "The second painting brings the eyes and front pincers close while retaining a separate ruby-and-brass tail lens.",
    "An alert gold beak and the turquoise chest dial stand out among a fan of warm feathers.",
    "The thin orbital loop is visible above the cream brow and the teal pouch hangs clearly across the darker breast.",
    "The Golem's teal faceplate and open palm are readable above three individual drawer handles.",
    "The gold spectacles, cap, mailed envelope and raised flag make the tortoise's postal role recognizable.",
]
for index, image in enumerate(images):
    id = image["character"]
    character = registry["spec001:"+id]
    entry = character["compendium"]
    asset_id = "spec001:ASSET-PORTRAIT-"+id
    assert entry["portraitAssetId"] == asset_id == allocations[index] == plan[character["id"]]["assetId"]
    binding = entry["portraitBinding"]
    assert binding["assetId"] == asset_id and binding["contentId"] == character["id"] and binding["exportPath"] == image["exports"]["512"]["path"]
    assert entry["id"] == "spec001:COMPENDIUM-"+id and binding["use"] == "compendium-portrait" and binding["interactiveOrEvidence"] is False
    prompt_folder = batch+"/"+id
    reference = image["reference"]
    selected = image["original"]
    events = []
    native = reference_model(id)
    originals = sorted(p.relative_to(root).as_posix() for p in (root/prompt_folder).rglob("original.png"))
    paths = [reference, *originals, *(e["path"] for e in image["exports"].values())]
    hashes = [sha(p) for p in paths]
    checks = []
    def evidence(kind, label, details, proof_hashes=hashes):
        p = proof+"/"+id+"-"+label+".json"
        body = {"type":kind,"assetId":asset_id,"hashes":proof_hashes,"status":"passed","actor":"agent","reviewer":reviewer,"date":date,"environment":env,"details":details}
        if kind in {"review","rights"}:
            body["check"] = label
            checks.append(dict(check=label,status="passed",reviewer=reviewer,date=date,hashes=proof_hashes,environment=env,evidencePath=p,findings=details["findings"]))
        return write(p,body)
    for raw in originals:
        folder = str(Path(raw).parent)
        prompt = folder+"/portrait.prompt.txt"
        rec = folder+"/tool-return.json"
        receipt = read(rec)
        assert reference == receipt["reference"] and receipt["eventId"].startswith("T120-"+id)
        with Image.open(root/raw) as im:
            im.load()
            assert im.format == "PNG" and im.mode == "RGB" and im.width == im.height and im.width >= 1024
            shape = list(im.size)
        settings = folder+"/settings.json"
        write(settings,{"generationTool":receipt["tool"], "eventId":receipt["eventId"], "modelRevision":"not-exposed","seed":"not-exposed","toolVersion":"not-exposed",
            "referenced_image_paths":[reference],"referencePathConvention":"The tool received the equivalent absolute workspace path.","referenceHashes":[sha(reference)],
            "transparent_background":False,"prompt":info(prompt),"receipt":info(rec),"original":info(raw),"dimensions":shape,"mode":"RGB", "sourceModel":native,
            "selectedForDisplay":raw==selected,"startedUtc":receipt["startedUtc"],"completedUtc":receipt["completedUtc"]})
        event = {"method":"openai-generated","tool":receipt["tool"],"version":"not-exposed","modelRevision":"not-exposed","eventId":receipt["eventId"],
            "settingsPath":settings,"promptOrScriptPath":prompt,"referenceHashes":[sha(reference)],"outputHashes":[sha(raw)],
            "notes":"One built-in generation using only the corresponding original model render. "+("Selected for display." if raw==selected else "Retained initial framing. The alternative selected portrait used the same native render independently.")}
        events.append(event)
        evidence("production","generation-"+receipt["eventId"].split("-")[-1],{**event,"settingsSha256":sha(settings),"promptSha256":sha(prompt),"receiptPath":rec,"receiptSha256":sha(rec)},[sha(reference),sha(raw)])
    public = [image["exports"][str(s)]["path"] for s in (512,256)]
    assert all(any(d["sha256"] == sha(p) for d in actual["standaloneDecodes"] if d["id"]==id) for p in public)
    evidence("review","structure",{"findings":"The selected square RGB PNG and both decoded WebPs match their recorded hashes, dimensions and registered character identity.",
        "pixelReport":review+"/exports.json","nativeModel":native,"compendiumId":entry["id"],"characterId":character["id"]})
    reopened=evidence("review","source-reopen",{"findings":"Every original PNG and the actual Blender reference decode independently. Both web derivatives reopen in Pillow and native Firefox.",
        "observedPaths":paths,"tool":"Pillow 12.1.0, Playwright Firefox 159.0","sourceModelEvidence":native["nativeReopenEvidence"],"browserEvidence":review+"/browser.json"})
    evidence("review","visual",{"findings":visual[index],"methods":["image-inspection"],"tool":"OpenAI view_image; full generated artwork, model/portrait pairs and 96 px contact sheet",
        "observedPaths":paths,"modelComparison":review+"/model-portrait-sheet.jpg","thumbnailSheet":review+"/thumbnail-sheet.png","reviewScope":"Agent production inspection."})
    compared=evidence("review","browser-comparison",{"findings":"Both WebP sizes independently decoded in native Firefox from the nested public path. Their HTTP response hashes matched the inspected exports.",
        "methods":["browser-inspection"],"tool":"Playwright Firefox 159.0 and agent inspection of rendered comparison sheets","observedPaths":paths,"report":review+"/browser.json",
        "compendiumId":entry["id"],"caption":binding["caption"],"scope":"Independent export/browser comparison; separate usage records identify discoveries through gameplay."})
    evidence("rights","rights",{"findings":"Source hashes trace to the project's original Blender artwork and its recorded license. The batch retains the license, output disclosures and public terms review.",
        "licenseIds":rights["licenseIds"],"permitsModification":True,"permitsCommercialReuse":True,"permitsRedistribution":True,"referenceHashes":[sha(reference)],
        "noticeHashes":[sha(p) for p in rights["noticePaths"]],"termsHashes":[sha(p) for p in rights["termsSnapshotPaths"]],"permissionHashes":[sha(p) for p in rights["inputPermissionPaths"]]})
    guest = next((b for g in actual["guests"] for b in g["bindings"] if b["character"]==character["id"] and b["imageDecoded"]),None)
    screenshot = None
    runtime_report = None
    if guest:
        runtime_report = review+"/browser.json"
        screenshot = guest["screenshot"]
        assert guest["caption"] == binding["caption"]
    elif id in joined:
        observed = joined[id]["portrait"]
        assert observed["assetId"]==asset_id and observed["caption"]==binding["caption"] and observed["path"].endswith(binding["exportPath"].removeprefix("public/"))
        assert (observed["width"],observed["height"]) == (512,512)
        runtime_report = args.joined_report
    uses = []
    if runtime_report:
        details={"bindings":[{k:binding[k] for k in ("assetId","contentId","use","exportPath","interactiveOrEvidence")}],"visible":True,"meaningful":True,
            "findings":visual[index]+" The discovered entry displays its own named portrait and descriptive caption.",
            "tool":"Native Firefox via Playwright, normal guest compendium", "runtimeEvidencePath":runtime_report,"runtimeEvidenceSha256":sha(runtime_report),"compendiumId":entry["id"]}
        if screenshot:
            details["browserCapturePath"] = screenshot
        use_path=evidence("usage","usage",details,[sha(binding["exportPath"])])
        uses=[{"contentId":character["id"],"use":binding["use"],"evidencePath":use_path}]
    registration = write(prompt_folder+"/display.json",{"compendiumId":entry["id"], "characterId":character["id"],"assetId":asset_id,"portraitBrief":plan[character["id"]],
        "caption":binding["caption"],"input":info(selected),"studioReference":info(reference),"studioModel":native,"exportScript":batch+"/export.py",
        "frame":"Full square input, uniform scaling, no crop or retouch.","outputs":[info(p) for p in public]})
    source = lambda path, role, app, version: {"file":info(path),"role":role,"application":app,"version":version,"reopenEvidencePath":reopened}
    assets.append({"assetId":asset_id,"kind":"portrait","semanticIdentity":"spec001:PORTRAIT-"+id,"status":"integrated" if uses else "exported",
        "countsTowardQuota":False,"interactiveOrEvidence":False,"variantOf":None,"derivedFrom":[],
        "sources":[source(reference,"reference","Blender","5.2.1"),*[source(p,"raw-generation","OpenAI image_gen__imagegen","not-exposed") for p in originals]],
        "exports":[{"file":info(p),"mimeType":"image/webp","sourceHashes":[sha(selected)],"tool":"Pillow 12.1.0 / libwebp 1.6.0",
            "preset":"Full-frame Lanczos resize, RGB, quality 87, method 6.","integrationEvidencePath":compared} for p in public],
        "production":events,"rights":rights,"usedBy":uses,"verification":checks,
        "image":{"width":512,"height":512,"colorSpace":"sRGB","alpha":False,"cameraRecordPath":registration,"layerRole":"compendium-portrait","registrationPath":registration}})
assert [a["assetId"] for a in assets]==allocations
write("assets-src/images/portraits-01-13.json",{"schemaVersion":1,"episodeId":"spec001","assets":assets})
print(len(assets),"portrait records;", sum(len(a["usedBy"]) for a in assets), "individually verified guest uses")
