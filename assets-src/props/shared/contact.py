# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Measure planned accessory-to-fixture fit on evaluated native triangle surfaces."""
import bpy, json, math
from pathlib import Path
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[3]
SRC=Path(__file__).resolve().parent
RAW=ROOT/'docs/evidence/spec001/prop-production/T116'
rooms=json.loads((ROOT/'assets-src/rooms/scene-layouts.json').read_text())['rooms']
fits=json.loads((SRC/'mounts.json').read_text())
R=Matrix.Rotation(-math.pi/2,3,'X')
def read(path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    deps=bpy.context.evaluated_depsgraph_get()
    verts=[];tris=[];labels=[]
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH':continue
        ev=obj.evaluated_get(deps);me=ev.data
        me.calc_loop_triangles();off=len(verts)
        verts.extend(ev.matrix_world@v.co for v in me.vertices)
        tris.extend(tuple(v+off for v in t.vertices) for t in me.loop_triangles)
        labels.extend([obj.name]*len(me.loop_triangles))
    return verts,tris,labels

def nearest(verts,tree,labels):
    samples=(tree.find_nearest(v) for v in verts)
    answer=min(samples,key=lambda s:s[3])
    return (answer[3],labels[answer[2]])

parents={}
result={}
for room in rooms:
    for p in room['propPlacements']:
        code=p['semanticId'][-5:]
        if code not in fits:continue
        fit=fits[code];parent=p['mountedToInstanceId'].split('-')[1].upper()
        if parent not in parents:
            src,=(ROOT/'assets-src/props').glob('*/'+parent+'.blend')
            pv,pt,pn=read(src);parents[parent]=(pv,pt,pn,BVHTree.FromPolygons(pv,pt,all_triangles=True))
        pv,pt,pn,tree=parents[parent]
        vertices,tris,cn=read(SRC/(code+'.blend'))
        parentrow=next(q for q in room['propPlacements'] if q['instanceId']==p['mountedToInstanceId'])
        dx,dy,dz=Vector(p['position'])-Vector(parentrow['position'])
        result[code]={}
        for kind,vec,angles in [
            ('frozen',(dx,-dz,dy),[0.,0.,0.]),
            ('mounted',fit['parentRelativeNative'],fit.get('runtimeEuler',[0.,0.,0.]))
        ]:
            rot=R.inverted()@Matrix.Rotation(angles[0],3,'X')@Matrix.Rotation(angles[1],3,'Y')@Matrix.Rotation(angles[2],3,'Z')@R
            v=[rot@v+Vector(vec) for v in vertices]
            child=BVHTree.FromPolygons(v,tris,all_triangles=True)
            pairs=tree.overlap(child)
            # Non-overlap distances are nearest vertex-to-surface samples, an upper
            # bound if the true minimum lies between edges of the two meshes.
            d,name=nearest(v,tree,pn)
            other,_=nearest(pv,child,cn)
            result[code][kind]=dict(parent=parent,triangleCrossings=len(pairs),
                sampledGapMetres=0 if pairs else min(d,other),
                observedParentParts=sorted({pn[i] for i,_ in pairs}) if pairs else [name])
(RAW/'surface-contact.json').write_text(json.dumps(dict(sorted(result.items())),indent=2)+'\n')
