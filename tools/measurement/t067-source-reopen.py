# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Read-only native Blender inspection; never save or render the opened source."""
import bpy
import hashlib
import json
import math
import pathlib
import sys

args = sys.argv[sys.argv.index("--") + 1:]
if len(args) != 2:
    raise RuntimeError("Expected repository root and unique evidence output path")
root, target = map(pathlib.Path, args)
source = pathlib.Path(bpy.data.filepath)
allowed = {root / "assets-src/rooms/R01.blend", root / "assets-src/characters/CH01.blend", root / "assets-src/characters/CH03.blend"}
if source not in allowed or target.exists():
    raise RuntimeError("Only frozen R01/CH01/CH03 source and new output are allowed")
objects = []
for obj in bpy.data.objects:
    if not all(math.isfinite(float(n)) for row in obj.matrix_world for n in row):
        raise RuntimeError("Nonfinite object matrix")
    objects.append({"name": obj.name, "type": obj.type, "vertices": len(obj.data.vertices) if obj.type == "MESH" else None,
                    "polygons": len(obj.data.polygons) if obj.type == "MESH" else None,
                    "hiddenRender": obj.hide_render,
                    "materials": [slot.material.name if slot.material else None for slot in obj.material_slots]})
result = {"source": str(source.relative_to(root)), "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
          "blenderVersion": bpy.app.version_string, "blenderBuildHash": bpy.app.build_hash.decode(),
          "method": "Actual saved .blend reopened with factory startup, background mode, one thread; no render or save",
          "sceneNames": [s.name for s in bpy.data.scenes], "objectCount": len(objects), "objects": objects,
          "actions": [{"name": a.name, "frameRange": list(a.frame_range)} for a in bpy.data.actions],
          "imageSources": [{"name": image.name, "source": image.source, "packed": bool(image.packed_file)} for image in bpy.data.images],
          "finiteObjectMatrices": True}
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(result, indent=2) + "\n")
print("T067 reopened", source.name, "objects", len(objects), "source", result["sourceSha256"])
