# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Inspect a freshly reopened full scene, verify its mounts, render the fixed camera and isolated restaged prop cells."""

import bpy
import json
import hashlib
import struct
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

base = Path(__file__).resolve().parents[2]
code = Path(bpy.data.filepath).stem
assert code in ("R03", "R04")
sc = bpy.context.scene
data = json.loads((base / f"content/spec001/presentation/{code}.json").read_text())
out = base / f"docs/evidence/spec001/final-rooms/T136/{code}"
out.mkdir(parents=True, exist_ok=True)
(base / ".local/T136/inspection").mkdir(parents=True, exist_ok=True)


def digest(path):
    b = path.read_bytes()
    return {
        "path": str(path.relative_to(base)),
        "bytes": len(b),
        "sha256": hashlib.sha256(b).hexdigest(),
    }


def native(point):
    return Vector((point[0], -point[2], point[1]))


def projected(point):
    uv = world_to_camera_view(sc, sc.camera, point)
    return [uv.x * 1024, (1 - uv.y) * 576]


camera = data["camera"]
assert (sc.camera.location - native(camera["position"])).length < 0.00001
assert abs(sc.camera.data.ortho_scale - camera["plateSpan"][0]) < 0.000001
assert sc.camera.data.type == "ORTHO"
placements = []
items = data.get(
    "subjects", [m for m in data.get("models", []) if m["semanticId"] != data["roomId"]]
)
for row in items:
    aid = row["assetId"]
    id = aid.split("-")[-1]
    obj = bpy.data.objects[id + " placement"]
    assert (obj.location - native(row["position"])).length < 0.00001
    meshes = [o for o in obj.children_recursive if o.type == "MESH"]
    assert meshes
    p = projected(obj.location)
    if "footpoint" in row:
        assert max(abs(a - b) for a, b in zip(p, row["footpoint"])) < 0.003, (
            id,
            p,
            row["footpoint"],
        )
    bounds = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
    placements.append(
        {
            "assetId": aid,
            "source": digest(base / obj["input"]),
            "position": row["position"],
            "pixelRoot": p,
            "meshes": len(meshes),
            "worldBottom": min(v.z for v in bounds),
        }
    )
anchors = []
for a in data["anchors"]:
    obj = bpy.data.objects[a["objectId"]]
    px = projected(obj.location)
    if "point" in a:
        assert max(abs(x - y) for x, y in zip(px, a["point"])) < 0.004, (a, px)
    else:
        assert (obj.location - native(a["position"])).length < 0.00001
    anchors.append({"id": obj.name, "px": px})
lamps = [o.name for o in sc.objects if o.type == "LIGHT"]
assert (
    len(lamps) == (5 if code == "R03" else 3)
    and len(sc.camera.data.background_images) == 3
)
assert all(
    b.image.packed_file and tuple(b.image.size) == (1600, 900)
    for b in sc.camera.data.background_images
)
arch = base / f"public/assets/models/{code}-architecture.glb"
b = arch.read_bytes()
length = struct.unpack("<I", b[12:16])[0]
g = json.loads(b[20 : 20 + length])
if code == "R03":
    assert len(g["extensions"]["KHR_lights_punctual"]["lights"]) == 2
assert not any(
    f.startswith(("PR", "CH")) for f in (n.get("name", "") for n in g["nodes"])
)
report = {
    "blender": bpy.app.version_string,
    "camera": camera,
    "source": digest(Path(bpy.data.filepath)),
    "architecture": digest(arch),
    "nodes": [n["name"] for n in g["nodes"]],
    "lamps": lamps,
    "placements": placements,
    "packedLayers": [b.image.name for b in sc.camera.data.background_images],
    "anchors": anchors,
    "party": data["partyPositions"],
}
sc.render.filepath = str(out / "native-camera.png")
bpy.ops.render.render(write_still=True)
if code == "R04":
    # Rerender independently at the translated ground roots with the original rigid orientations and native lights.
    # These are inspection cells only. The released atlas retains its original lighting sample and lossless bytes.
    sc.render.use_compositing = False
    for obj in bpy.data.collections["Built fabric • R04"].objects:
        obj.hide_render = True
    moved = ["PR032", "PR033", "PR034", "PR036", "PR037", "PR039", "PR040"]
    for id in moved:
        for row in items:
            bpy.data.collections[row["id"] + " stage"].hide_render = row["id"] != id
        sc.render.filepath = str(base / f".local/T136/inspection/{id}.png")
        bpy.ops.render.render(write_still=True)
    report["rerenderedCells"] = moved
(out / "source-reopen.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n"
)
