# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Check the Blender crops against decoded atlas pixels, then compare the native browser focal canvas."""
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat

root=Path.cwd()
src=root/'assets-src/sprites/R04'
scratch=root/'.local/T134'
out=root/'docs/evidence/spec001/sprites/T134'
out.mkdir(exist_ok=True,parents=True)
scene=json.loads((root/'content/spec001/presentation/R04.json').read_text())
native=json.loads((src/'native-frames.json').read_text())
hashes=json.loads((src/'render-hashes.json').read_text())
layout=next(r for r in json.loads((root/'assets-src/rooms/scene-layouts.json').read_text())['rooms'] if r['roomId']==scene['roomId'])
assets={sheet['assetId']:Image.open(root/'public/assets/sprites/R04'/(sheet['assetId'].split('-')[-1]+'.webp')).convert('RGBA') for sheet in scene['atlases']}
cast=Image.new('RGBA',tuple(scene['stageSize']))
summary={}
poses=Image.new('RGB',(720,430),'#142630')
pen=ImageDraw.Draw(poses)
for subject in scene['subjects']:
    id=subject['id']
    original=native['subjects'][id]
    x,y,w,h=(*[round(f-p) for f,p in zip(subject['footpoint'],subject['pivot'])],*subject['size'])
    originX, originY = x-original['renderCrop'][0], y-original['renderCrop'][1]
    sheet=assets[subject['atlasId']]
    summary[id]={}
    for clip,track in subject['clips'].items():
        source_track=original['clips'][clip]
        assert [f['at'] for f in track['frames']]==source_track['sourceFrames'] and track['end']==source_track['endFrameExclusive']
        distinct=set()
        for i,frame in enumerate(track['frames']):
            stem=f"{id}-{clip}-{frame['at']}.png"
            path=scratch/'frames'/stem
            assert hashlib.sha256(path.read_bytes()).hexdigest()==hashes[stem]
            png=Image.open(path).convert('RGBA').crop((originX,originY,originX+w,originY+h))
            sx,sy=frame['offset']
            cell=sheet.crop((sx,sy,sx+w,sy+h))
            # Opaque native geometry survives packing exactly; cast shadows are tapered far from the body.
            mask=png.getchannel('A').point(lambda a:255 if a>170 else 0)
            assert mask.getbbox(),id
            rgbdiff=ImageChops.difference(cell.convert('RGB'),png.convert('RGB'))
            assert max(ImageStat.Stat(rgbdiff,mask).extrema)[1]==0,(id,clip,i)
            assert ImageChops.multiply(ImageChops.difference(cell.getchannel('A'),png.getchannel('A')),mask).getbbox() is None
            distinct.add(hashlib.sha256(ImageChops.multiply(cell.convert('L'),mask).tobytes()).hexdigest())
            if clip in ['idle','rest'] and i==0: cast.alpha_composite(cell,(x,y))
            if id.startswith('CH') and ((clip=='idle' and i in [0,len(track['frames'])//2]) or (clip=='reaction' and i==len(track['frames'])//2) or (clip=='walk' and i==3)):
                col=['CH01','CH13','CH20'].index(id)
                row=0 if clip=='idle' and i==0 else 1 if clip=='idle' else 2 if clip=='reaction' else 3
                sample=cell.copy(); sample.thumbnail((195,81),Image.Resampling.NEAREST)
                cx=col*240+120-sample.width//2; cy=row*106+84-sample.height
                poses.paste(sample,(cx,cy),sample)
                pen.text((col*240+15,row*106+84),f'{id}   {clip}   frame {frame["at"]}',fill='#f5dfa8')
        assert len(distinct)>=min(3,len(track['frames']))
        summary[id][clip]={'frames':len(track['frames']),'distinctNativeGeometryImages':len(distinct),'durationSeconds':track['end']/scene['fps']}
poses.save(out/'native-poses.png')
projection=[]
for anchor in layout['hotspots']+layout['exits']:
    point=next(a['point'] for a in scene['anchors'] if a['objectId']==anchor['id'])
    projection.extend(abs(a*b-c) for a,b,c in zip(anchor['uvAt16by9'],scene['stageSize'],point))
assert max(projection)<.01
measure={'blender':native['blender'],'nativeFrames':len(hashes),'sha256VerifiedRawFrames':len(hashes),'stageSize':scene['stageSize'],
         'maximumFrozenToBlenderAnchorErrorPx':max(projection),'clips':summary,'sheetDecodedBytes':sum(im.width*im.height*4 for im in assets.values())}
browser=scratch/'browser/stable-canvas.png'
if browser.exists():
    shot=Image.open(browser).convert('RGBA')
    assert shot.size==cast.size
    # Compare premultiplied RGBA because transparent RGB has no composited meaning.
    diffs=ImageChops.difference(cast.convert('RGBa'),shot.convert('RGBa'))
    channels=ImageStat.Stat(diffs)
    measure['browserCanvasComparison']={'meanAbsolutePremultipliedChannelError':channels.mean,'maximumAbsoluteError':[v[1] for v in channels.extrema],
                                      'reference':'Independent Pillow composite of all 15 native cells in registered depth order at their authored pivots.'}
    assert max(channels.mean)<.08 and max(v[1] for v in channels.extrema)<=5,measure
contacts = ['CH01','PR031','PR035','CH13','CH20']
if all((scratch/'contacts'/f'{id}.png').exists() for id in contacts):
    panel = Image.new('RGB',(780,500),'#182833')
    labels = ImageDraw.Draw(panel)
    for column,label in enumerate(['Floor disabled in Blender','Native Cycles floor contact','Exported atlas on gray']):
        labels.text((column*260+15,4),label,fill='#f5dfa8')
    for row,id in enumerate(contacts):
        sub = next(s for s in scene['subjects'] if s['id']==id)
        clip = sub['clips'].get('idle') or sub['clips']['rest']
        sx,sy=clip['frames'][0]['offset']
        w,h=sub['size']
        l,t,_,_=native['subjects'][id]['renderCrop']
        bx,by=[round(p-f) for p,f in zip(sub['footpoint'],sub['pivot'])]
        box=(bx-l,by-t,bx-l+w,by-t+h)
        samples=[Image.open(scratch/'contacts'/f'{id}.png').convert('RGBA').crop(box),
                 Image.open(scratch/'frames'/f"{id}-{'idle' if id.startswith('CH') else 'rest'}-0.png").convert('RGBA').crop(box),
                 assets[sub['atlasId']].crop((sx,sy,sx+w,sy+h))]
        for col,pic in enumerate(samples):
            pic.thumbnail((236,74),Image.Resampling.NEAREST)
            card = Image.new('RGB',(250,89),'#667480')
            card.paste(pic,((250-pic.width)//2,2),pic)
            ImageDraw.Draw(card).text((6,71),id,fill='#ffffff')
            panel.paste(card,(col*260+5,24+94*row))
    panel.save(out/'contact-comparison.png')
# Measure intersecting opaque silhouettes at rest in actual native registration.
masks={}
for s in scene['subjects']:
    f=(s['clips'].get('idle') or s['clips']['rest'])['frames'][0]
    sx,sy=f['offset']; w,h=s['size']
    alpha=assets[s['atlasId']].crop((sx,sy,sx+w,sy+h)).getchannel('A').point(lambda a:255 if a>=170 else 0)
    mask=Image.new('L',cast.size)
    mask.paste(alpha,tuple(round(p-f) for p,f in zip(s['footpoint'],s['pivot'])))
    masks[s['id']]=mask
intersections=[]
for i,s in enumerate(scene['subjects']):
    mask=masks[s['id']]
    total=mask.histogram()[255]
    for other in scene['subjects'][i+1:]:
        intersection=ImageChops.multiply(mask,masks[other['id']]).histogram()[255]
        if intersection: intersections.append({'behind':s['id'],'inFront':other['id'],'opaquePixels':intersection,'fractionOfBehindSubject':round(intersection/total,5)})
measure['idleOcclusionPairs']=intersections
(out/'verification.json').write_text(json.dumps(measure,indent=2)+'\n')
