# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Add Photon's connector inspection to the retained T063 model.

Run Blender in background with --python-exit-code 1 --python build.py --
build <new.blend>, then in a new process with -- export <new.blend> <new.glb>.
"""
import hashlib
import math
from pathlib import Path
import sys

import bpy


ORIGINAL = Path(__file__).resolve().parents[1] / "CH03.blend"
ORIGINAL_HASH = "70e1897cf9e18b245804745bf7a25bbeb900a8113762bd4113229bd239df50c3"
END = 48
CONTACT = 24


def build(target):
    if target == ORIGINAL or target.exists():
        raise FileExistsError(target)
    if hashlib.sha256(ORIGINAL.read_bytes()).hexdigest() != ORIGINAL_HASH:
        raise ValueError("The retained T063 Photon source has changed.")
    bpy.ops.wm.open_mainfile(filepath=str(ORIGINAL))
    scene = bpy.context.scene
    body, head, left, right = (
        scene.objects[name] for name in ("CH03_hover", "CH03_head", "CH03_wing_L", "CH03_wing_R")
    )
    parts = [body, head, left, right]
    rest = {part: (part.location.copy(), part.rotation_euler.copy()) for part in parts}

    # Hover to one side of the connector, lower the antennae, then trace its face.
    # The short hold at the inspection point leaves the connection visibly untouched.
    for frame in range(END + 1):
        phase = frame / END
        lean = math.sin(math.pi * phase) ** 2
        sweep = math.sin(2 * math.pi * phase) * lean
        for part, (location, rotation) in rest.items():
            part.location, part.rotation_euler = location, rotation
        body.location.x += 0.10 * sweep
        body.location.y -= 0.14 * lean
        body.location.z -= 0.075 * lean
        body.rotation_euler.x += 0.28 * lean
        head.rotation_euler.x += 0.40 * lean
        head.rotation_euler.z += 0.43 * sweep
        left.rotation_euler.y -= 0.65 * lean + 0.16 * sweep
        right.rotation_euler.y += 0.65 * lean - 0.16 * sweep
        for part in parts:
            part.keyframe_insert(data_path="rotation_euler", frame=frame)
        body.keyframe_insert(data_path="location", frame=frame)

    for part in parts:
        animation = part.animation_data
        action = animation.action
        action.name = f"{part.name}_ability"
        track = animation.nla_tracks.new()
        track.name = "ability"
        track.strips.new("ability", 0, action)
        animation.action = None
        track.mute = True
        part.location, part.rotation_euler = rest[part]
    scene.timeline_markers.new("ability: inspect connector face", frame=CONTACT)
    scene.objects["CH03_ROOT"]["abilityContactFrame"] = CONTACT
    scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True)


def export(source, target):
    if source == ORIGINAL or target.exists():
        raise ValueError("Pass the versioned native derivative and a fresh export path.")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    if scene.objects["CH03_ROOT"]["abilityContactFrame"] != CONTACT:
        raise ValueError("Missing Photon inspection marker.")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in scene.objects:
        if obj.type in ("MESH", "EMPTY") and not obj.name.startswith("COLLISION"):
            obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(target), export_format="GLB", use_selection=True,
        export_yup=True, export_extras=True, export_cameras=False, export_lights=False,
        export_apply=True, export_animations=True, export_animation_mode="NLA_TRACKS",
        export_force_sampling=True, export_frame_range=False, export_materials="EXPORT",
    )


mode, *paths = sys.argv[sys.argv.index("--") + 1:]
paths = [Path(path).resolve() for path in paths]
if mode == "build" and len(paths) == 1:
    build(*paths)
elif mode == "export" and len(paths) == 2:
    export(*paths)
else:
    raise ValueError("Expected build <new.blend> or export <new.blend> <new.glb>")
