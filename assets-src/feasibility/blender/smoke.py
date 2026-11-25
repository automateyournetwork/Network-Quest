# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Original feasibility fixture, not a counted production asset.
Run create, reopen, then inspect-export in separate Blender processes.
"""
import bpy
import json
import math
from pathlib import Path
import sys
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
mode = sys.argv[sys.argv.index("--") + 1]
if mode == "create":
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=1, depth=0.4)
    base = bpy.context.object
    base.name = "feasibility_signal_socket"
    bevel = base.modifiers.new("rounded_edges", "BEVEL")
    bevel.width = 0.08
    bevel.segments = 3
    metal = bpy.data.materials.new("original_teal_metal")
    metal.diffuse_color = (0.025, 0.26, 0.32, 1)
    metal.use_nodes = True
    bsdf = metal.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = metal.diffuse_color
    bsdf.inputs["Metallic"].default_value = 0.65
    base.data.materials.append(metal)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.62, minor_radius=0.12, location=(0, 0, 0.28))
    ring = bpy.context.object
    ring.name = "feasibility_copper_ring"
    copper = bpy.data.materials.new("original_copper")
    copper.diffuse_color = (0.8, 0.25, 0.06, 1)
    copper.use_nodes = True
    copper.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = copper.diffuse_color
    ring.data.materials.append(copper)
    for i in range(4):
        a = i * math.pi / 2
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.07, location=(0.3*math.cos(a), 0.3*math.sin(a), 0.24))
        bpy.context.object.name = f"feasibility_pin_{i}"
        bpy.context.object.data.materials.append(copper)
    bpy.ops.object.camera_add(location=(3, -4, 4))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, 0, 0)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 3.5
    scene = bpy.context.scene
    scene.camera = camera
    bpy.ops.object.light_add(type="AREA", location=(1, -2, 4))
    bpy.context.object.data.energy = 600
    bpy.context.object.data.shape = "DISK"
    bpy.context.object.data.size = 4
    scene.world.color = (0.12, 0.12, 0.12)
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.render.resolution_x = 640
    scene.render.resolution_y = 480
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.unit_settings.system = "METRIC"
    scene["production_asset"] = False
    scene["fixture_id"] = "FEAS-BLENDER-001"
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "signal-socket.blend"))
elif mode == "reopen":
    assert bpy.context.scene["fixture_id"] == "FEAS-BLENDER-001"
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    assert len(meshes) == 6
    bpy.context.scene.render.filepath = str(ROOT / "reopened-render.png")
    bpy.ops.render.render(write_still=True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT / "signal-socket.glb"), export_format="GLB", export_cameras=False, export_lights=False)
    (ROOT / "source-inspection.json").write_text(json.dumps({"blender": bpy.app.version_string, "hash": bpy.app.build_hash.decode(), "meshes": [{"name": o.name, "vertices": len(o.data.vertices)} for o in meshes], "native_reopen": True, "render_from_reopened_source": True, "production_asset": False}, indent=2) + "\n")
elif mode == "inspect-export":
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "signal-socket.glb"))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    assert len(meshes) == 6
    (ROOT / "export-inspection.json").write_text(json.dumps({"glb_reimport": True, "meshes": len(meshes), "vertices": sum(len(o.data.vertices) for o in meshes), "triangles": sum(len(o.data.polygons) for o in meshes), "production_asset": False}, indent=2) + "\n")
else:
    raise ValueError(mode)
