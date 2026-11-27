# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Confirm editability with a clean Blender profile independent of local user add-ons."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

BATCH=Path(__file__).resolve().parent
ROOT=BATCH.parents[2]
RAW=ROOT/'docs/evidence/spec001/prop-production/T114'

if '--native-check' in sys.argv:
    import bpy
    src=Path(bpy.data.filepath)
    report=json.loads((RAW/(src.stem+'-native.json')).read_bytes())
    meshes=sorted(o.name for o in bpy.context.scene.objects if o.type=='MESH')
    assert meshes==sorted(report['editableMeshes'])
    assert bpy.app.version_string==report['version']
    assert bpy.context.scene.unit_settings.scale_length==1
    assert bpy.context.scene.unit_settings.system=='METRIC'
    assert bpy.context.scene.camera.data.type=='ORTHO'
    assert report['rig'] in bpy.context.scene.objects
    assert src==BATCH/(report['id']+'.blend')
    print('NQ_NATIVE_OK',json.dumps(dict(id=src.stem,sha256=hashlib.sha256(src.read_bytes()).hexdigest(),
                                         editableMeshParts=len(meshes),blender=bpy.app.version_string)))
else:
    output=[]
    for i in range(81,101):
        code=f'PR{i:03}'
        src=BATCH/(code+'.blend')
        proc=subprocess.run(['blender','--factory-startup','-b',str(src),'-t','2','--python-exit-code','1',
                             '-P',__file__,'--','--native-check'],capture_output=True,text=True,check=True)
        row,=[s for s in proc.stdout.splitlines() if s.startswith('NQ_NATIVE_OK ')]
        result=json.loads(row.split(' ',1)[1])
        assert result['sha256']==json.loads((RAW/(code+'-native.json')).read_bytes())['sourceSha256']
        output.append(result)
    (RAW/'factory-reopen.json').write_text(json.dumps(dict(method='Separate Blender --factory-startup process per native file. Checked scene, camera, units, mesh names, root and source digest.',models=output),indent=2)+'\n')
