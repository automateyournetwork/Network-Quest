# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Independently import the eight delivered binary glTFs in fresh empty Blender scenes."""
import hashlib
import json
from pathlib import Path
import bpy

root=Path(__file__).resolve().parents[3]
raw=root/'docs/evidence/spec001/character-production/T109'
for number in range(18,26):
    asset='CH'+str(number)
    path=root/'public/assets/models'/(asset+'.glb')
    source=json.loads((raw/asset/'native.json').read_text())
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    sc=bpy.context.scene
    meshes=[o for o in sc.objects if o.type=='MESH']
    triangles=0
    for o in meshes:
        o.data.calc_loop_triangles()
        triangles+=len(o.data.loop_triangles)
    assert triangles==source['triangles'],(asset,triangles,source['triangles'])
    report={
        'blender':bpy.app.version_string,'sourceExportSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'triangles':triangles,'importedMeshObjects':len(meshes),
        'materials':sorted({m.name for o in meshes for m in o.data.materials if m}),
        'actions':sorted(a.name for a in bpy.data.actions),
        'renderableObjects':sorted(o.name for o in meshes),'externalLibraries':len(bpy.data.libraries),
    }
    assert report['externalLibraries']==0 and report['actions']
    (raw/asset/'import.json').write_text(json.dumps(report,indent=2)+'\n')
    print(asset,triangles,flush=True)
