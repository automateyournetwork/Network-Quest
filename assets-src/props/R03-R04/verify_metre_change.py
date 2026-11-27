# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Compare native part geometry against the first published T111 checkpoint."""
import hashlib
import json
import struct
import subprocess
import tempfile
from pathlib import Path
import bpy

here=Path(__file__).resolve().parent
root=here.parents[2]
raw=root/'docs/evidence/spec001/prop-production/T111'
checkpoint='a1c766ce57f98fa7865ad4b8dd934780cf02efe1'
def original(path):
    return subprocess.check_output(['git','show',checkpoint+':'+str(path.relative_to(root))],cwd=root)
def sha(data):
    return hashlib.sha256(data).hexdigest()
def measure(path,id):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    scene=bpy.context.scene
    data={}
    for obj in scene.objects[id].children:
        data_hash=hashlib.sha256()
        for vertex in obj.data.vertices:
            data_hash.update(struct.pack('<3f',*(obj.matrix_world@vertex.co)))
        for polygon in obj.data.polygons:
            data_hash.update(struct.pack('<I',len(polygon.vertices)))
            data_hash.update(struct.pack('<'+'I'*len(polygon.vertices),*polygon.vertices))
            data_hash.update(struct.pack('<I?',polygon.material_index,polygon.use_smooth))
        for mat in obj.data.materials:
            pbr=mat.node_tree.nodes.get('Principled BSDF').inputs
            data_hash.update(mat.name.encode())
            data_hash.update(struct.pack('<7f',*pbr['Base Color'].default_value,pbr['Alpha'].default_value,pbr['Roughness'].default_value,pbr['Metallic'].default_value))
        data[obj.name]=data_hash.hexdigest()
    return data
results={}
for id,engraving in [('PR024','Replacement stock tab engraving'),('PR030','Passive path lengths engraving')]:
    source=here/f'{id}.blend'; glb=root/f'public/assets/models/R03-R04/{id}.glb'
    old_file=original(source)
    with tempfile.TemporaryDirectory() as temp:
        older=Path(temp)/source.name
        older.write_bytes(old_file)
        old=measure(older,id)
    new=measure(source,id)
    assert set(old)==set(new)
    changed=[name for name in old if new[name]!=old[name]]; assert changed==[engraving],changed
    results[id]={'oldSourceSha256':sha(old_file),'newSourceSha256':sha(source.read_bytes()),'oldGlbSha256':sha(original(glb)),'newGlbSha256':sha(glb.read_bytes()),
                 'changedNativeParts':changed,'unchangedNativePartCount':len(old)-1,'oldEngravingGeometryAndMaterialSha256':old[engraving],
                 'newEngravingGeometryAndMaterialSha256':new[engraving]}
for n in range(21,41):
    id=f'PR{n:03}'
    if id in results:continue
    for path in (here/f'{id}.blend',root/f'public/assets/models/R03-R04/{id}.glb'):
        assert path.read_bytes()==original(path)
(raw/'metre-geometry-comparison.json').write_text(json.dumps({'originalCommit':checkpoint,'unchangedOtherSourceExportPairs':18,
    'compared':'Native part names, world-space vertices, polygon topology, smoothing flags, per-polygon material assignment and Principled base color, alpha, roughness, metallic.', 'results':results},indent=2)+'\n')
