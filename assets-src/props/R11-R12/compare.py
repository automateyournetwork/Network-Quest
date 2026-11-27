# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Pair the actual native and browser renders using the same orthographic camera."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont
import numpy as np

root=Path(__file__).resolve().parents[3]
raw=root/'docs/evidence/spec001/prop-production/T115'
layout=json.loads((root/'assets-src/rooms/scene-layouts.json').read_text())
models=[p for room in layout['rooms'][10:12] for p in room['propPlacements'][:10]]
font=ImageFont.load_default(size=15)
rows=[]
for page in range(4):
    sheet=Image.new('RGB',(1060,592),'#243641')
    draw=ImageDraw.Draw(sheet)
    for j,p in enumerate(models[page*5:page*5+5]):
        code=p['semanticId'].split(':')[1]
        imgs=[Image.open(raw/(code+'-'+src+'.png')).convert('RGBA') for src in ['native','browser']]
        alphas=[np.asarray(im)[:,:,3] for im in imgs]
        masks=[a>=128 for a in alphas]
        iou=float(np.logical_and(*masks).sum()/np.logical_or(*masks).sum())
        lit=masks[0]&masks[1]
        a,b=[np.asarray(im).astype('int16')[:,:,:3] for im in imgs]
        mean_diff=np.abs(a[lit]-b[lit]).mean(axis=0)
        edges=[int(np.concatenate((m[0,:],m[-1,:],m[:,0],m[:,-1])).sum()) for m in masks]
        rows.append(dict(id=code,maskIoU=iou,meanAbsRGBOnSharedMask=mean_diff.tolist(),edgePixels=edges,
                         sourceSha256=hashlib.sha256((raw/(code+'-native.png')).read_bytes()).hexdigest(),
                         browserSha256=hashlib.sha256((raw/(code+'-browser.png')).read_bytes()).hexdigest()))
        for row,img in enumerate(imgs):
            thumb=img.resize((208,208),Image.Resampling.LANCZOS)
            sheet.paste(thumb,(j*212+2,37+row*264),thumb)
        draw.text((j*212+5,7),code+'  /  Blender',font=font,fill='#f4ddba')
        draw.text((j*212+5,273),'Three / Firefox',font=font,fill='#a6ccd1')
        words=p['sourceName'].capitalize()
        draw.text((j*212+4,545),words,font=font,fill='#f4ddba')
    sheet.save(raw/f'sheet-{page+1}.jpg',quality=91)
(raw/'comparison.json').write_text(json.dumps(rows,indent=2)+'\n')
