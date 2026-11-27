# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Measure support contacts and rig clips in the reopened final room, in metres."""
import bpy
import json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

code = Path(bpy.data.filepath).stem
base = Path(__file__).resolve().parents[2]
evidence = base/f'docs/evidence/spec001/final-rooms/T140/{code}'
models = json.loads((base/f'content/spec001/presentation/{code}.json').read_text())['models']
deps = bpy.context.evaluated_depsgraph_get()

def geometry(short):
    vertices, faces = [], []
    for obj in bpy.data.objects[short+' placement'].children_recursive:
        if obj.type != 'MESH':
            continue
        obj = obj.evaluated_get(deps)
        mesh = obj.to_mesh()
        start = len(vertices)
        vertices.extend(obj.matrix_world @ v.co for v in mesh.vertices)
        faces.extend(tuple(start+i for i in p.vertices) for p in mesh.polygons)
        obj.to_mesh_clear()
    return vertices, faces

supports = [('PR129','PR105'),('PR132','PR106')] if code == 'R11' else [('PR150','PR113')]
contacts = []
for tool, fixture in supports:
    points, _ = geometry(tool)
    vertices, faces = geometry(fixture)
    tree = BVHTree.FromPolygons(vertices, faces)
    gaps = []
    for p in points:
        # Cast from just above the tool vertex to the nearest fixture surface.
        point, _, _, _ = tree.ray_cast(p+Vector((0,0,.012)),Vector((0,0,-1)),.25)
        if point is not None:
            gaps.append(p.z-point.z)
    near = [g for g in gaps if abs(g) <= .012]
    assert near, f'No real supporting geometry within 12 mm under {tool}'
    contacts.append(dict(tool=tool,fixture=fixture,vertices=len(points),contactVerticesWithin12mm=len(near),
                         closestGapMetres=round(min(abs(g) for g in gaps),7)))
actors=[]
for model in (m for m in models if m['character']):
    short = model['semanticId'].split(':')[1]
    objs=bpy.data.objects[short+' placement'].children_recursive
    joints=[o for o in objs if o.animation_data and o.animation_data.nla_tracks]
    tracks=set(t.name for o in joints for t in o.animation_data.nla_tracks)
    assert len(joints)>=2 and {'idle','reaction'} <= tracks
    clips={}
    for track in sorted(tracks):
        strips=[strip for o in joints for t in o.animation_data.nla_tracks if t.name==track for strip in t.strips]
        assert strips and all(st.action and st.frame_end>st.frame_start for st in strips)
        clips[track]=dict(animatedJoints=len(strips),frameRange=[min(st.frame_start for st in strips),max(st.frame_end for st in strips)])
    actors.append(dict(actor=short,rig='articulated object hierarchy',joints=[o.name for o in joints],clips=clips))
(evidence/'rigs-and-contacts.json').write_text(json.dumps(dict(room=code,actors=actors,contacts=contacts),indent=2)+'\n')
