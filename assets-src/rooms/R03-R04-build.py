# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Build each native room at its registered camera. Run Blender -b -P this-file -- R03 or R04."""

import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

BASE = Path(__file__).resolve().parents[2]
CODE = sys.argv[sys.argv.index("--") + 1]
assert CODE in ("R03", "R04")
source = BASE / "assets-src/rooms"
evidence = BASE / "docs/evidence/spec001/final-rooms/T136" / CODE
evidence.mkdir(parents=True, exist_ok=True)
read = lambda path: json.loads((BASE / path).read_text())
data = read(f"content/spec001/presentation/{CODE}.json")
room = read(f"content/spec001/rooms/{CODE}.json")
layout = next(
    r
    for r in read("assets-src/rooms/scene-layouts.json")["rooms"]
    if r["roomId"] == room["id"]
)
bindings = {b["assetId"]: b for b in room["mediaBindings"]}


def native(p):
    return Vector((p[0], -p[2], p[1]))


if CODE == "R04":
    # Reopening the original rig stage retains its actuated native poses, floor catcher and measured lighting.
    bpy.ops.wm.open_mainfile(
        filepath=str(BASE / "assets-src/sprites/R04/R04-sprite-stage.blend")
    )
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.name = layout["name"]
(
    scene.render.resolution_x,
    scene.render.resolution_y,
    scene.render.resolution_percentage,
) = 1024, 576, 100
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.fps = 24


def collection(name):
    group = bpy.data.collections.new(name)
    scene.collection.children.link(group)
    return group


def move(o, group):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    group.objects.link(o)


def material(name, color, metal=0, rough=0.64):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Metallic"].default_value = metal
    return m


architecture = collection("Built fabric • " + CODE)
camera_group = collection("Registered optics, lighting and plates")
anchors = collection("Interaction survey • world space")
stone = material(
    "Oiled shale" if CODE == "R03" else "Water-worn schist",
    (0.092, 0.084, 0.075) if CODE == "R03" else (0.073, 0.093, 0.11),
    0.12,
    0.77,
)
metal = material(
    "Copper edging" if CODE == "R03" else "Patinated brass edges",
    (0.32, 0.142, 0.052) if CODE == "R03" else (0.25, 0.185, 0.102),
    0.67,
    0.4,
)
iron = material("Blued wrought brackets", (0.054, 0.069, 0.078), 0.59, 0.54)
mortar = material("Deep tooling marks", (0.027, 0.038, 0.042), 0.08, 0.86)


def block(name, position, size, mat, bevel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=native(position))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Tool-rounded edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    obj.data.materials.append(mat)
    move(obj, architecture)
    return obj


def footing(name, x, z, w, d):
    # The models have a surveyed ground origin. A flush upper course avoids burying their feet.
    block(
        name + " • dark foundation", (x, -0.052, z), (w + 0.09, 0.08, d + 0.09), mortar
    )
    block(name + " • chamfered flagstone", (x, -0.03, z), (w, 0.06, d), stone, 0.025)
    for sign in (-1, 1):
        block(
            name + " • binding strap",
            (x + sign * (w * 0.5 - 0.07), 0.001, z),
            (0.030, 0.007, d - 0.07),
            metal,
            0.003,
        )


def bar(name, a, b, radius, mat):
    start, end = native(a), native(b)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12,
        radius=radius,
        depth=(end - start).length,
        location=(start + end) / 2,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = (end - start).to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    move(obj, architecture)


if CODE == "R03":
    rows = [m for m in data["models"] if m["semanticId"] != room["id"]]
    for m in rows:
        id = m["semanticId"].split(":")[1]
        group = collection(id + " stage")
        existing = set(bpy.data.objects)
        path = bindings[m["assetId"]]["exportPath"]
        bpy.ops.import_scene.gltf(filepath=str(BASE / path))
        items = set(bpy.data.objects) - existing
        origin = bpy.data.objects.new(id + " placement", None)
        group.objects.link(origin)
        for o in items:
            if not o.parent:
                o.parent = origin
            move(o, group)
        rx, ry, rz = m.get("rotation", (0, 0, 0))
        origin.rotation_euler = (rx, -rz, ry)
        origin.location = native(m["position"])
        origin["input"] = path
    # Front-left spool / recovery shelf, back panel bank and east motor sit on independent beds.
    for name, x, z, w, d in [
        ("Spool winch seat", 1.4, 4.62, 1.43, 1.04),
        ("Sample frame sill", 0.8, 1.00, 1.67, 0.82),
        ("Patch rack sill", 3.2, 0.35, 1.75, 0.81),
        ("Armature vibration bed", 8.85, 0.5, 1.65, 0.99),
        ("Route wheel seat", 6.05, 0.40, 1.12, 0.82),
        ("Continuity column seat", 7.85, 2.65, 1.12, 0.94),
        ("Store elbow footing", 7.6, 4.85, 1.55, 0.76),
    ]:
        footing(name, x, z, w, d)
    block(
        "Recovery docket • wooden ledger shelf",
        (2.8, 0.714, 4.6),
        (0.83, 0.072, 0.60),
        stone,
        0.022,
    )
    for x in (2.48, 3.12):
        block(
            "Docket shelf • angle iron foot", (x, 0.34, 4.62), (0.064, 0.68, 0.43), iron
        )
        bar("Docket shelf • brace", (x, 0.13, 4.73), (x, 0.64, 4.43), 0.023, metal)
    # The two real work lights travel with the architecture export. Each falls only on its own apparatus.
    for name, x, z, tint in [
        ("Panel inspection lamp", 3.2, 0.35, (1, 0.67, 0.37)),
        ("Motor service lamp", 8.85, 0.5, (0.47, 0.79, 1)),
    ]:
        bar(
            name + " • upright",
            (x - 0.80, 0, z - 0.37),
            (x - 0.80, 1.72, z - 0.37),
            0.027,
            iron,
        )
        bar(
            name + " • bracket",
            (x - 0.80, 1.7, z - 0.37),
            (x - 0.38, 1.7, z - 0.12),
            0.030,
            metal,
        )
        block(name + " • hood", (x - 0.38, 1.66, z - 0.12), (0.24, 0.09, 0.16), iron)
        bulb = bpy.data.lights.new(name, "POINT")
        bulb.color = tint
        bulb.energy = 0.095
        bulb.use_custom_distance = True
        bulb.cutoff_distance = 2.2
        obj = bpy.data.objects.new(name, bulb)
        architecture.objects.link(obj)
        obj.location = native((x - 0.38, 1.60, z - 0.12))
    # Service conduits enter the exposed rack from behind, never across its port face.
    for h in (0.44, 0.57):
        bar(
            "Rack feed • horizontal return",
            (2.67, h, -0.05),
            (2.11, h, -0.05),
            0.025,
            metal,
        )
        bar("Rack feed • drop", (2.11, h, -0.05), (2.11, 0.07, -0.05), 0.025, metal)
    bpy.ops.object.camera_add(location=native(data["camera"]["position"]))
    camera = bpy.context.object
    camera.name = "Copper Warrens • fixed lens"
    move(camera, camera_group)
    camera.rotation_euler = (
        (native(data["camera"]["target"]) - camera.location)
        .to_track_quat("-Z", "Y")
        .to_euler()
    )
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 16
    camera.data.clip_start, camera.data.clip_end = 0.1, 80
    scene.camera = camera
    scene.world = bpy.data.worlds.new("Low copper tunnel bounce")
    scene.world.color = (0.18, 0.20, 0.21)
    for name, position, color, energy, size in [
        ("Copper ribbon • warm key", [-1, 8, 1], (1, 0.65, 0.39), 1540, 7),
        ("Work lamp • cool fill", [10, 6, 4], (0.56, 0.79, 1), 1230, 5),
        ("Copper tunnel • clipping rim", [4, 7, -5], (0.98, 0.76, 0.50), 1030, 6),
    ]:
        light = bpy.data.lights.new(name, "AREA")
        obj = bpy.data.objects.new(name, light)
        camera_group.objects.link(obj)
        obj.location = native(position)
        obj.rotation_euler = (
            (native([5, 0.65, 3]) - obj.location).to_track_quat("-Z", "Y").to_euler()
        )
        light.color, light.shape, light.size, light.energy = color, "DISK", size, energy
    bpy.ops.mesh.primitive_plane_add(size=35, location=native([5, -0.008, 3]))
    bpy.context.object.name = "Surveyed floor • contact shadow receiver"
    bpy.context.object.is_shadow_catcher = True
    move(bpy.context.object, camera_group)
    points = {a["objectId"]: a["position"] for a in data["anchors"]}
else:
    camera = scene.camera
    rows = data["subjects"]
    positions = {o["id"]: o["position"] for o in rows}
    for row in rows:
        o = bpy.data.objects[row["id"] + " placement"]
        o.location = native(row["position"])
        o["input"] = next(
            i["source"]
            for i in json.loads(scene["sourceInputs"])
            if i["assetId"] == row["assetId"]
        )
    for id, name, w, d in [
        ("PR033", "Telegraph tapping station", 1.61, 0.83),
        ("PR040", "Printer drying bed", 1.81, 1.04),
        ("PR038", "Broken-span isolation bay", 1.48, 0.92),
        ("PR031", "After-reading station", 1.83, 1.02),
        ("PR037", "Relay test bed", 1.09, 1.03),
        ("PR039", "Signal ladder sill", 1.19, 0.79),
    ]:
        x, y, z = positions[id]
        footing(name, x, z, w, d)
    # Raised reveal and shallow drainage joints make the two postal stations a recognizable dry group.
    x, _, z = positions["PR033"]
    for i in range(9):
        block(
            "Post shelf • radial drain slot",
            (x - 0.65 + i * 0.16, 0.006, z + 0.51),
            (0.078, 0.011, 0.084),
            mortar,
            0.004,
        )
    x, _, z = positions["PR135"]
    bar("Pendant rib • mounting socket", (x, 3.86, z), (x, 4.00, z), 0.083, iron)
    points = {}
    by_object = {s["objectId"]: s for s in rows if s["objectId"]}
    by_asset = {
        s["assetId"]: s["position"]
        for s in layout["propPlacements"] + layout["characterPlacements"]
    }
    for a in layout["hotspots"] + layout["exits"]:
        p = list(a["anchorWorld"])
        if a["id"].startswith("exit:"):
            p[1] = 0
        s = by_object.get(a["id"])
        if s:
            p = [
                v + now - old
                for v, now, old in zip(p, s["position"], by_asset[s["assetId"]])
            ]
        points[a["id"]] = p
    points.update({"spec001:WALK-R04": [4.7, 0, 4.4], "spec001:R04.entry": [5, 0, 3]})
# Inlaid thresholds sit on the walkable side of their registered exit. The camera and exit IDs stay fixed.
for ex in layout["exits"]:
    x, z = ex["point"]
    direction = 1 if x < 5 else -1
    for i in range(3):
        tread = block(
            "Exit • bronze tread " + str(i + 1),
            (x + direction * (i * 0.13), 0.006, z),
            (0.052, 0.012, 0.54 - i * 0.07),
            metal,
            0.005,
        )
        tread["objectId"] = ex["id"]
for id, pos in points.items():
    o = bpy.data.objects.new(id, None)
    anchors.objects.link(o)
    o.empty_display_type = "CIRCLE"
    o.empty_display_size = 0.105
    o.location = native(pos)
for i, pos in enumerate(data["partyPositions"]):
    o = bpy.data.objects.new("Party berth " + str(i + 1), None)
    anchors.objects.link(o)
    o.location = native(pos)
# GLB contains only original room fabric. Every apparatus/resident remains individually selectable.
bpy.ops.object.select_all(action="DESELECT")
for o in architecture.objects:
    o.select_set(True)
bpy.context.view_layer.objects.active = architecture.objects[0]
bpy.ops.export_scene.gltf(
    filepath=str(BASE / f"public/assets/models/{CODE}-architecture.glb"),
    export_format="GLB",
    use_selection=True,
    export_animations=False,
    export_extras=True,
    export_lights=True,
)
# Use the native film with a three-layer compositor so the plate cannot intercept contact shadows or light the rigs.
scene.render.film_transparent = True
scene.world.use_nodes = True
scene.view_settings.view_transform = "Standard" if CODE == "R03" else "AgX"
scene.frame_set(0)
# Camera backdrops expose each artwork independently in the editable viewport as well.
camera.data.show_background_images = True
images = {}
for layer in data["layers"]:
    plane = layer["plane"]
    path = bindings[layer["assetId"]]["exportPath"]
    im = bpy.data.images.load(str(BASE / path), check_existing=True)
    im.pack()
    im.filepath = "//../../" + path
    images[plane] = im
    plate = camera.data.background_images.new()
    plate.image = im
    plate.alpha = 1
    plate.display_depth = "FRONT" if plane == "foreground" else "BACK"
    plate.frame_method = "FIT"
tree = bpy.data.node_groups.new(
    "Registered plates • independent alpha", "CompositorNodeTree"
)
tree.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
scene.compositing_node_group = tree
result = None
for name in ("background", "midground", "focal", "foreground"):
    if name == "focal":
        n = tree.nodes.new("CompositorNodeRLayers")
    else:
        n = tree.nodes.new("CompositorNodeImage")
        n.image = images[name]
        # RELATIVE factor converts each 1600x900 plate to the native 1024x576 render.
        scale = tree.nodes.new("CompositorNodeScale")
        scale.inputs["Type"].default_value = "Render Size"
        tree.links.new(n.outputs["Image"], scale.inputs["Image"])
        n = scale
    n.label = name
    if result is None:
        result = n.outputs["Image"]
    else:
        over = tree.nodes.new("CompositorNodeAlphaOver")
        tree.links.new(result, over.inputs["Background"])
        tree.links.new(n.outputs["Image"], over.inputs["Foreground"])
        result = over.outputs[0]
out = tree.nodes.new("NodeGroupOutput")
tree.links.new(result, out.inputs[0])
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_perspective = "CAMERA"
bpy.ops.wm.save_as_mainfile(filepath=str(source / f"{CODE}.blend"), compress=True)
