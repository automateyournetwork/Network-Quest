# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Pair original source and browser captures; compare alpha masks at native resolution."""
import hashlib, json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[3]
raw=root/'docs/evidence/spec001/prop-production/T111'
font=Path('/System/Library/Fonts/Supplemental/Arial.ttf')
def label(size):
    return ImageFont.truetype(str(font),size) if font.exists() else ImageFont.load_default(size=size)
measurements={}
for start in range(21,41,5):
    sheet=Image.new('RGB',(1420,635),'#253541');draw=ImageDraw.Draw(sheet)
    draw.text((14,10),('COPPER WARRENS' if start<31 else 'ECHO CAVERN')+'   /   SOURCE & BROWSER',font=label(21),fill='#eee1be')
    draw.text((14,41),'Top row    Blender 5.2.1',font=label(16),fill='#bbd9d8')
    draw.text((14,345),'Bottom row    Firefox / Three.js',font=label(16),fill='#bbd9d8')
    for col,n in enumerate(range(start,start+5)):
        id=f'PR{n:03}';native=json.loads((raw/f'{id}-native.json').read_text());browser=json.loads((raw/f'{id}-browser.json').read_text())
        assert native['glbSha256']==browser['glbSha256']
        masks=[]
        for medium,top,expected in [('source',64,native['sourceRenderSha256']),('browser',371,browser['browserRenderSha256'])]:
            p=raw/f'{id}-{medium}.png';assert hashlib.sha256(p.read_bytes()).hexdigest()==expected
            img=Image.open(p).convert('RGBA')
            mask=img.getchannel('A').point(lambda x:255 if x>=128 else 0);bbox=mask.getbbox()
            assert bbox and min(bbox)>0 and bbox[2]<img.width-1 and bbox[3]<img.height-1
            masks.append(mask)
            img.thumbnail((243,243),Image.Resampling.LANCZOS)
            offset=col*282+18
            sheet.paste(img,(offset,top),img)
        draw.text((col*282+12,311),id+'   '+native['title'].capitalize(),font=label(16),fill='#eee1be')
        intersect=ImageChops.darker(*masks).histogram()[-1];union=ImageChops.lighter(*masks).histogram()[-1]
        measurements[id]={'silhouetteIoU':round(intersect/union,6),'pixelSize':[540,540],'alphaThreshold':128,'sourceBoundsPixels':masks[0].getbbox(),
                          'browserBoundsPixels':masks[1].getbbox(),'bothInsideFrame':True,'comparedSourceSha256':native['sourceSha256'],'comparedGLBSha256':browser['glbSha256']}
    sheet.save(raw/f'PR{start:03}-PR{start+4:03}.jpg',quality=93,subsampling=0)
(raw/'projection-comparison.json').write_text(json.dumps(measurements,indent=2)+'\n')
print(min((v['silhouetteIoU'],i) for i,v in measurements.items()))
