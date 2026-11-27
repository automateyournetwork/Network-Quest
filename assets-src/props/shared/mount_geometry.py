# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Read-only evaluated bounds of authored fixture parts supporting this batch."""
import bpy
import hashlib
import json
from pathlib import Path
root=Path(__file__).resolve().parents[3]
layout=json.loads((root/'assets-src/rooms/scene-layouts.json').read_text())
parents={p['mountedToInstanceId'].split('-')[1].upper() for r in layout['rooms'] for p in r['propPlacements'] if p.get('mountedToInstanceId') and p['sourceAllocation']=='Shared'}
rows={}
for code in sorted(parents):
    src,=(root/'assets-src/props').glob('*/'+code+'.blend')
    bpy.ops.wm.open_mainfile(filepath=str(src))
    deps=bpy.context.evaluated_depsgraph_get();parts={}
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH':continue
        ev=ob.evaluated_get(deps)
        coords=[ev.matrix_world@v.co for v in ev.data.vertices]
        if not coords:continue
        parts[ob.name]=[[round(f(c[j] for c in coords),5) for j in range(3)] for f in (min,max)]
    rows[code]=dict(source=str(src.relative_to(root)),sha256=hashlib.sha256(src.read_bytes()).hexdigest(),nativePartBounds=parts)
(root/'docs/evidence/spec001/prop-production/T116/parent-geometry.json').write_text(json.dumps(rows,indent=2)+'\n')
