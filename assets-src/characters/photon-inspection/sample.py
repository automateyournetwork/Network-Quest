# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Sample the reopened native ability in the same axes as the GLB renderer."""
import json
from pathlib import Path
import sys

import bpy
from mathutils import Matrix


output = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
assert scene.objects["CH03_ROOT"]["abilityContactFrame"] == 24
assert scene.render.fps == 24
for obj in scene.objects:
    if obj.animation_data:
        for track in obj.animation_data.nla_tracks:
            track.mute = track.name != "ability"

scene.render.resolution_percentage = 50
basis = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
poses = {}


def capture_pose(render_scene, depsgraph):
    if depsgraph.mode != "RENDER":
        return
    meshes = {}
    for obj in render_scene.objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        converted = basis @ obj.evaluated_get(depsgraph).matrix_world @ basis.transposed()
        meshes[obj.name] = [converted[row][col] for col in range(4) for row in range(4)]
    poses[render_scene.frame_current] = meshes


bpy.app.handlers.frame_change_post.append(capture_pose)
for frame in (0, 12, 24, 36, 48):
    scene.frame_set(frame)
    scene.render.filepath = str(output / f"native-{frame}.png")
    bpy.ops.render.render(write_still=frame in (0, 24))
bpy.app.handlers.frame_change_post.remove(capture_pose)
assert set(poses) == {0, 12, 24, 36, 48}

(output / "native-poses.json").write_text(json.dumps(poses) + "\n")
