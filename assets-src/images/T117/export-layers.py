# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Fit genuine RGBA generations behind/around the frozen camera and encode registered web plates."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageChops

root = Path(__file__).resolve().parents[3]
layout = json.loads((root/'assets-src/rooms/scene-layouts.json').read_text())
size = (1600,900)
def write(path,data):
    path.write_text(json.dumps(data,indent=2)+'\n')

def workshop_thresholds(room,base,dst):
    """Project the sole reusable threshold texture to the six existing ground points."""
    marks = []
    sw,sh = dst.size
    threshold = Image.open(base/'originals/threshold.png').convert('RGBA')
    alpha = threshold.getchannel('A').point(lambda a: 0 if a <= 8 else a)
    threshold.putalpha(alpha)
    box = alpha.getbbox()
    threshold = threshold.crop(box)
    # Prefilter before the affine warp to avoid undersampling fine stone grain.
    threshold = threshold.resize((288,62),Image.Resampling.LANCZOS)
    # The fixed orthographic floor projection is affine over the entire ground plane.
    samples = room['registration']['coordinateAnchors'][:3]
    world_mat = np.array([[p['world'][0],p['world'][2],1] for p in samples])
    pix_mat = np.array([[p['uvAt16by9'][0]*sw,p['uvAt16by9'][1]*sh] for p in samples])
    projection = np.linalg.solve(world_mat,pix_mat)
    tw,th = threshold.size
    for e in room['exits']:
        x,z=e['point']
        # The threshold's long side follows the boundary at this exact entrance.
        sideways = x < .5 or x > 9.5
        along = np.array([0,1.48] if sideways else [1.48,0])
        across = np.array([-.34,0] if sideways else [0,.34])
        start = np.array([x,z])-(along+across)/2
        corners = np.array([start,start+along,start+across,start+along+across])
        points = np.column_stack([corners,np.ones(4)]) @ projection
        tex_coords = np.array([[0.,0.],[tw,0],[0,th]])
        inverse = np.linalg.solve(np.column_stack([points[:3],np.ones(3)]),tex_coords)
        projected = threshold.transform(dst.size,Image.Transform.AFFINE,tuple(inverse.T.ravel()),Image.Resampling.BICUBIC)
        dst.alpha_composite(projected)
        marks.append({'existingExit':e['id'],'floorPoint':e['point'],'worldFootprintXZ':corners.tolist(),'destinationPixels':points.tolist()})
    return {'source':'originals/threshold.png','sourceBox':box,'prefilterPixels':[tw,th],'instances':marks}

for room in layout['rooms'][1:4]:
    rid = room['roomId'][-3:]
    base = root/'assets-src/images'/rid
    out = root/'public/assets/images'/rid
    out.mkdir(parents=True,exist_ok=True)
    w,h = size
    # U/V frame and orthographic properties come directly from the frozen layout.
    write(base/'camera.json', {'roomId':room['roomId'], 'camera':room['camera'], 'stageAspect':[16,9],
        'viewport':'Center the complete 16:9 stage using contain. Evaluate the frozen camera at the contained stage dimensions.'})
    regs = {}
    allow = Image.new('L',size)
    draw = ImageDraw.Draw(allow)
    for polygon in room['occlusion']['foregroundOpaqueAllowRegionsUV']:
        draw.polygon([(round(x*(w-1)),round(y*(h-1))) for x,y in polygon],fill=255)
    allow.save(base/'foreground-allow-mask.png',optimize=True)
    for role in ['background','midground','foreground']:
        raw = Image.open(base/'originals'/f'{role}.png')
        reg = {'sourceSize':raw.size,'destinationSize':size}
        if role == 'background':
            # The native generation differs from 16:9 by 0.05%. Use its entire frame.
            dst = raw.resize(size,Image.Resampling.LANCZOS)
            reg['frame'] = 'Entire opaque image projected on the 16:9 stage.'
        else:
            a = raw.convert('RGBA')
            a.putalpha(a.getchannel('A').point(lambda v:0 if v<=3 else v))
            dst = Image.new('RGBA',size)
            if role == 'midground':
                scale, shift = {'R02':(.68,-.012), 'R03':(.72,-.10), 'R04':(.64,-.065)}[rid]
                ew,eh = round(w*scale),round(h*scale)
                x = 0 if rid=='R02' else w-ew
                if rid=='R03': x += round(w*.025)
                y = round(h*shift)
                dst.alpha_composite(a.resize((ew,eh),Image.Resampling.LANCZOS),(x,y))
                reg['placement'] = {'sourceBox':[0,0,*a.size],'destRect':[x,y,ew,eh]}
                if rid=='R02': reg['architecturalThresholds'] = workshop_thresholds(room,base,dst)
            else:
                # Retain the silhouettes on both edges; each unscaled source half is independently available.
                reg['placements'] = []
                for side,(x0,x1) in enumerate([(0,a.width//2),(a.width//2,a.width)]):
                    half = a.crop((x0,0,x1,a.height))
                    box = half.getchannel('A').getbbox()
                    obj = half.crop(box)
                    ew = round(w*.043); eh = round(ew*obj.height/obj.width)
                    y=h-eh; x=0 if side==0 else w-ew
                    dst.alpha_composite(obj.resize((ew,eh),Image.Resampling.LANCZOS),(x,y))
                    reg['placements'].append({'sourceBox':[box[0]+x0,box[1],box[2]+x0,box[3]],'destRect':[x,y,ew,eh]})
                dst.putalpha(ImageChops.multiply(dst.getchannel('A'),allow))
                reg['mask'] = 'foreground-allow-mask.png'
            reg['alpha'] = 'Straight alpha. Remove non-subject alpha values 0–3 before premultiplied Lanczos resizing. All other retained alpha is original antialiasing, transformed with its subject.'
        dst.save(out/f'{role}.webp',quality=91,method=6,alpha_quality=100,exact=False)
        regs[role] = reg
    write(base/'registration.json',{'roomId':room['roomId'],'camera':'camera.json','generationGuide':'reference/camera-guide.png',
        'layerOrder':['background','midground','realtime cast or R04 sprites','foreground'],'transforms':regs,'layerPurpose':[
            a['purpose'] for a in layout['nonmodelAllocations']['sceneLayers'] if a['roomId']==room['roomId']],
        'frozenFloorAnchors':room['registration']['coordinateAnchors'],'foregroundAllowRegionsUV':room['occlusion']['foregroundOpaqueAllowRegionsUV'],
        'exits':[{'id':e['id'],'uv':e['uvAt16by9']} for e in room['exits']],
        'targets':[{'id':e['id'],'uv':e['uvAt16by9']} for e in room['hotspots']],
        'export':'Pillow WebP quality 91 method 6, lossless alpha quality 100, sRGB interpretation. No painted semantic labels. Separate standard images, identical 1600x900 registration.'})
