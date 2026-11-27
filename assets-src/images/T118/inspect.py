# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Inspect the saved originals, mask, composited exports and standalone browser frames."""
import json
import hashlib
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/evidence/spec001/image-production/T118'
ROOMS = json.loads((ROOT/'assets-src/rooms/scene-layouts.json').read_text())['rooms'][4:8]

def write(path, obj):
    path.write_text(json.dumps(obj, indent=2)+'\n')

def describe(path):
    with Image.open(path) as im:
        im.load()
        alpha = im.convert('RGBA').getchannel('A')
        hist = alpha.histogram()
        return {'path':str(path.relative_to(ROOT)), 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                'bytes':path.stat().st_size,'pixels':im.size,'mode':im.mode,'format':im.format,'metadataKeys':sorted(im.info),
                'alphaExtrema':alpha.getextrema(),'nonzeroAlpha':sum(hist[1:]),'partialAlpha':sum(hist[1:255]),
                'visibleBoundsAt8':alpha.point(lambda a:255 if a>8 else 0).getbbox()}

def montage(items, path, cell=(640,360), cols=2, mats=('#141c29',)):
    width,height=cell
    count=len(items)*len(mats)
    sheet=Image.new('RGB',(width*cols, (height+22)*((count+cols-1)//cols)),'#172838')
    pen=ImageDraw.Draw(sheet)
    for i,(src,label) in enumerate(items):
        with Image.open(src) as im:
            im=im.convert('RGBA')
            im.thumbnail(cell, resample=Image.Resampling.LANCZOS)
        for j,color in enumerate(mats):
            k=i*len(mats)+j
            mat=Image.new('RGBA',cell,color)
            mat.alpha_composite(im,((width-im.width)//2,(height-im.height)//2))
            x=(k%cols)*width; y=(k//cols)*(height+22)
            sheet.paste(mat.convert('RGB'),(x,y))
            pen.text((x+7,y+height+4),label+('  /  '+color if len(mats)>1 else ''),fill='white')
    sheet.save(path,quality=93,subsampling=0)

all_exports=[]
for room in ROOMS:
    rid=room['roomId'][-3:]
    src=ROOT/'assets-src/images'/rid
    pub=ROOT/'public/assets/images'/rid
    ev=EVIDENCE/rid
    raws=sorted((src/'originals').glob('*.png'))
    files=raws+sorted((src/'registered').glob('*.png'))+[src/'reference/cast.png',src/'reference/camera-guide.png',src/'foreground-allow-mask.png']+sorted(pub.glob('*.webp'))
    info=[describe(p) for p in files]
    mask=Image.open(src/'foreground-allow-mask.png')
    foreground=Image.open(pub/'foreground.webp').convert('RGBA').getchannel('A')
    # Lossless alpha must survive the final WebP round-trip exactly at the protected areas.
    outside=ImageChops.multiply(foreground,ImageChops.invert(mask))
    assert outside.getbbox() is None
    clear=foreground.crop((80,54,1520,846))
    assert not clear.getbbox()
    cast_path=ROOT / json.loads((ev/'browser.json').read_text())['castPath']
    cast=Image.open(cast_path).convert('RGBA').getchannel('A')
    floor_alpha=[]
    for e in room['exits']:
        u,v=e['uvAt16by9']
        x,y=round(u*cast.width),round(v*cast.height)
        around=cast.crop((x-22,y-22,x+22,y+22))
        floor_alpha.append({'id':e['id'],'uv':e['uvAt16by9'],'eyeHeightCastAlphaAtCenter':cast.getpixel((x,y)),
                            'modelSilhouetteFractionIn44pxCircleBoundingSquare':round(sum(around.histogram()[128:])/(44*44),4)})
    comparisons = []
    for role in ('background','midground','foreground'):
        master = Image.open(src/'registered'/(role+'.png')).convert('RGBA')
        runtime = Image.open(pub/(role+'.webp')).convert('RGBA')
        alpha_delta = ImageChops.difference(master.getchannel('A'), runtime.getchannel('A')).getextrema()[1]
        assert alpha_delta == 0
        black = Image.new('RGBA', master.size, '#000000')
        colors = ImageChops.difference(Image.alpha_composite(black,master).convert('RGB'), Image.alpha_composite(black,runtime).convert('RGB'))
        comparisons.append({'role':role,'masterExportMaxAlphaDelta':alpha_delta,'rmsRGBonBlack':ImageStat.Stat(colors).rms})
    write(ev/'pixels.json',{'decodedFiles':info,'sourceToExportComparisons':comparisons,'foregroundPixelsOutsideAllowedWedges':0,
                            'foregroundMaxAlphaInEvidenceZone':clear.getextrema()[1],
                            'castPathForExitComparison':str(cast_path.relative_to(ROOT)),'castVsProjectedExitTargetsDesktop':floor_alpha})
    overlay_names=[(p,p.stem+' / original') for p in raws if p.stem!='background']
    overlay_names += [(pub/(r+'.webp'), r+' / registered') for r in ('midground','foreground')]
    montage(overlay_names,ev/'alpha-mattes.jpg',cell=(540,304),mats=('#eef0de','#1b2432'))
    all_exports.extend([describe(p) for p in sorted(pub.glob('*.webp'))])
for label,size in [('exits',(620,349)),('narrow',(230,496)),('laptop',(512,384)),('desktop',(640,360))]:
    montage([(EVIDENCE/r['roomId'][-3:]/(label+'.png'),r['name']) for r in ROOMS],
            EVIDENCE/(label+'-contact.jpg'),cell=size,cols=4 if label=='narrow' else 2)
write(EVIDENCE/'export-sizes.json',{'exports':all_exports,'totalBytes':sum(e['bytes'] for e in all_exports)})
