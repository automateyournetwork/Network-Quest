# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Pack exact-size pixel crops from the registered camera with native-frame timing and fixed ground pivots."""
from pathlib import Path
import hashlib
import json
import math
from PIL import Image, ImageChops, ImageFilter

base = Path.cwd()
source = base/'assets-src/sprites/R04'
temp = base/'.local/T134/frames'
out = base/'public/assets/sprites/R04'
out.mkdir(exist_ok=True,parents=True)
native = json.loads((source/'native-frames.json').read_text())
layout = next(r for r in json.loads((base/'assets-src/rooms/scene-layouts.json').read_text())['rooms'] if r['roomId']=='spec001:R04')
stage = {'roomId':layout['roomId'],'version':1,'stageSize':native['stageSize'],'fps':native['fps'],
         'layers':[{'assetId':id,'plane':id.split('-')[-1]} for id in layout['plannedSceneLayerIds']],
         'atlases':[],'subjects':[],'anchors':native['anchors']}
sheets = {}
source_stamps = {}
for id, details in native['subjects'].items():
    atlas = id if id.startswith('CH') else 'props'
    frames = {}
    l,t,r,b = details['renderCrop']
    for clip, track in details['clips'].items():
        for f in track['sourceFrames']:
            path = temp/f'{id}-{clip}-{f}.png'
            image = Image.open(path).convert('RGBA')
            assert image.size==(r-l,b-t), (id,image.size,(l,t,r,b))
            # Limit the shadow catcher's noisy far field. Keep the actual objects,
            # their antialiasing and the near-field Cycles floor shadows at full strength.
            alpha = image.getchannel('A')
            opaque = alpha.point(lambda a: 255 if a>126 else 0)
            near = opaque.filter(ImageFilter.MaxFilter(21))
            near = ImageChops.lighter(opaque.filter(ImageFilter.MaxFilter(3)), near.filter(ImageFilter.GaussianBlur(6)))
            a = ImageChops.multiply(alpha,near).point(lambda a:a if a>2 else 0)
            image.putalpha(a)
            frames[clip,f]=image
            source_stamps[path.name]=hashlib.sha256(path.read_bytes()).hexdigest()
    boxes = [im.getchannel('A').getbbox() for im in frames.values()]
    box = (min(p[0] for p in boxes),min(p[1] for p in boxes),max(p[2] for p in boxes),max(p[3] for p in boxes))
    # Same crop and fractional origin for all poses of a subject.
    sx,sy = details['stagePivot']
    pivot = [round(sx-l-box[0],3),round(sy-t-box[1],3)]
    obj = next((h['id'] for h in layout['hotspots'] if h['subjectId']=='spec001:'+id),None)
    if id=='CH01': obj='spec001:R04.entry'
    subject = {'id':id,'assetId':'spec001:ASSET-'+id,'objectId':obj,'atlasId':'spec001:ASSET-SPRITE-R04-'+atlas,
               'footpoint':[sx,sy],'pivot':pivot,'size':[box[2]-box[0],box[3]-box[1]],'depth':details['cameraDepth'],'clips':{}}
    stage['subjects'].append(subject)
    for clip, track in details['clips'].items():
        locations = []
        for f in track['sourceFrames']:
            record={'at':f,'offset':[]}
            sprite=frames[clip,f].crop(box)
            sheets.setdefault(atlas,[]).append((sprite,record))
            locations.append(record)
        subject['clips'][clip]={'end':track['endFrameExclusive'],'frames':locations}
for atlas,cells in sheets.items():
    width=max(max(im.width for im,_ in cells),math.ceil(math.sqrt(sum((im.width+1)*(im.height+1) for im,_ in cells))))
    x=y=height=right=0
    for image,record in cells:
        if x and x+image.width>width:
            x=0
            y+=height+1
            height=0
        record['offset']=[x,y]
        x+=image.width+1
        right=max(right,x-1)
        height=max(height,image.height)
    sheet=Image.new('RGBA',(right,y+height))
    for image,record in cells:
        sheet.paste(image,tuple(record['offset']))
    sheet.save(out/f'{atlas}.webp',lossless=True,method=5,exact=True)
    stage['atlases'].append({'assetId':'spec001:ASSET-SPRITE-R04-'+atlas,'width':sheet.width,'height':sheet.height})
    print(atlas,sheet.size,len(cells),(out/f'{atlas}.webp').stat().st_size)
stage['subjects'].sort(key=lambda s:-s['depth'])
(source/'render-hashes.json').write_text(json.dumps(source_stamps,indent=2)+'\n')
(base/'content/spec001/presentation/R04.json').write_text(json.dumps(stage,indent=2)+'\n')
