# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Reopen images, inspect final WebP alpha, measure target/silhouette overlap and make matte sheets."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parents[3]
rooms=json.loads((root/'assets-src/rooms/scene-layouts.json').read_text())['rooms'][1:4]
def signature(path):
    with Image.open(path) as im:
        im.load()
        a=np.asarray(im.getchannel('A')) if 'A' in im.getbands() else None
        return {'file':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'bytes':path.stat().st_size,'size':im.size,'mode':im.mode,'metadataKeys':list(im.info),
            'pixelsWithNonzeroAlpha':int(np.count_nonzero(a)) if a is not None else None,
            'pixelsWithFullAlpha':int(np.count_nonzero(a==255)) if a is not None else None}
def matte_sheet(paths,out):
    w,h=620,350
    sheet=Image.new('RGB',(w*2,(h+28)*len(paths)),'#202830')
    draw=ImageDraw.Draw(sheet)
    for i,p in enumerate(paths):
        with Image.open(p) as im:
            im=im.convert('RGBA')
            im.thumbnail((w,h))
            for j,matte in enumerate(('#f5edd9','#152333')):
                tile=Image.new('RGBA',(w,h),matte)
                tile.alpha_composite(im,((w-im.width)//2,(h-im.height)//2))
                sheet.paste(tile.convert('RGB'),(j*w,i*(h+28)))
                draw.text((j*w+6,(i+1)*(h+28)-21),p.parent.name+'/'+p.name+'   '+matte,fill='white')
    sheet.save(out,quality=90)
for room in rooms:
    rid=room['roomId'][-3:]
    base=root/'assets-src/images'/rid
    exports=root/'public/assets/images'/rid
    evidence=root/'docs/evidence/spec001/image-production/T117'/rid
    mid=Image.open(exports/'midground.webp').getchannel('A')
    fg=np.asarray(Image.open(exports/'foreground.webp').getchannel('A'))
    allow=np.asarray(Image.open(base/'foreground-allow-mask.png'))
    cast=Image.open(evidence/'cast.png').getchannel('A')
    cast_alpha=np.array(cast.resize((1600,900),Image.Resampling.NEAREST))
    outside=int(np.count_nonzero(fg[allow==0]))
    assert outside==0
    # Test the 44 CSS px minimum target at both actual view widths, including crop at frame edges.
    protected=[]
    for point in room['exits']+room['hotspots']:
        u,v=point['uvAt16by9']
        for width in [1280,390]:
            x,y=round(u*1600),round(v*900)
            half=int(np.ceil(22*1600/width))
            region=fg[max(0,y-half):min(900,y+half),max(0,x-half):min(1600,x+half)]
            assert np.count_nonzero(region)==0,(rid,point['id'])
            if point in room['exits']:
                c=cast_alpha[max(0,y-half):min(900,y+half),max(0,x-half):min(1600,x+half)]
                protected.append({'exit':point['toRoomId'],'viewportWidth':width,'foregroundPixels':0,
                    'castFractionAboveHalfAlpha':round(float(np.mean(c>127)),4),'castAtEyeAnchor':int(cast_alpha[y,x])})
    clipped=[]
    reg=json.loads((base/'registration.json').read_text())
    if rid=='R02':
        thresholds=reg['transforms']['midground']['architecturalThresholds']['instances']
        assert [t['existingExit'] for t in thresholds]==[e['id'] for e in room['exits']]
        for t in thresholds:
            corners=t['destinationPixels']
            mask=Image.new('L',(1600,900))
            ImageDraw.Draw(mask).polygon([tuple(corners[i]) for i in [0,1,3,2]],fill=255)
            footprint=(np.asarray(mask)>0)&(np.asarray(mid)>127)
            clipped.append({'id':t['existingExit'],'visibleFractionOfThreshold':round(float(np.mean(cast_alpha[footprint]<128)),4),
                'foregroundPixels':int(np.count_nonzero(fg[footprint]))})
    raw=sorted((base/'originals').glob('*.png'))
    output_files=sorted(exports.glob('*.webp'))
    for stage,files in [('raw',raw),('web',output_files)]:
        matte_sheet(files,evidence/(stage+'-mattes.jpg'))
    report={'roomId':rid,'foregroundPixelsOutsideFrozenWedges':outside,'thresholds':clipped,'allSemanticAnchors':len(room['exits']+room['hotspots']),
        'minimumTargetClear':True,'targetWidthsTestedCssPx':[44,44],'viewportWidthsCssPx':[1280,390],'exitCastCoverage':protected,
        'files':[signature(p) for p in raw+output_files+[base/'reference/camera-guide.png',base/'reference/cast.png',base/'foreground-allow-mask.png',evidence/'cast.png']],
        'inspectionScope':'Foreground alpha checked after WebP decoding at all frozen targets and exits. Cast fractions are from the independent frame-1 Blender render and do not certify live gameplay or sprite access.'}
    (evidence/'pixels.json').write_text(json.dumps(report,indent=2)+'\n')
