# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Rebuild the registered layers from the preserved OpenAI output pixels."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageChops, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[3]
LAYOUT = ROOT / 'assets-src/rooms/scene-layouts.json'
LAYERS = json.loads(LAYOUT.read_text())
SIZE = (1600, 900)
RESAMPLE = Image.Resampling.LANCZOS

# Width is measured in stage pixels after trimming transparent padding.
# Coordinates are the upper-left corner of that placed cutout. Negative positions
# allow an architectural or botanical form to continue beyond the frame.
DETAILS = {
    'R05': [('midground', 455, 1150, -17, True, 0.86), ('canopy', 477, -38, -30, False, 0.92)],
    'R06': [('midground', 541, 1078, -6, False, 0.84), ('prisms', 219, 1257, -36, False, 0.91)],
    'R07': [('midground', 312, 574, -24, False, 0.58), ('relay', 375, 584, 50, False, 0.82)],
    'R08': [('struts', 515, -407, -46, True, 0.97), ('midground', 355, 1247, -15, False, 0.97)],
}

def write(path, obj):
    path.write_text(json.dumps(obj, indent=2) + '\n')

def hash_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def place_cutout(stage, source, *, srcbox, width, left, top=None, flip=False, opacity=1.0, feather_left=0):
    im = Image.open(source).convert('RGBA')
    original_size = im.size
    if srcbox is None:
        srcbox = (0, 0, *im.size)
    im = im.crop(srcbox)
    alpha = im.getchannel('A').point(lambda v: v if v > 3 else 0)
    box = alpha.getbbox()
    assert box, source
    im.putalpha(alpha)
    im = im.crop(box)
    if flip:
        im = ImageOps.mirror(im)
    height = round(width * im.height / im.width)
    im = im.resize((width, height), RESAMPLE)
    if feather_left:
        ramp = Image.new('L', (width,1))
        ramp.putdata([min(255, round(255*x/feather_left)) for x in range(width)])
        im.putalpha(ImageChops.multiply(im.getchannel('A'), ramp.resize(im.size)))
    if opacity != 1:
        im.putalpha(im.getchannel('A').point(lambda v: round(v*opacity)))
    top = stage.height-height if top is None else top
    stage.alpha_composite(im, (left, top))
    return {'source': source.name, 'sourceSha256': hash_file(source), 'sourcePixels': original_size,
            'sourceBox': [box[0]+srcbox[0], box[1]+srcbox[1], box[2]+srcbox[0], box[3]+srcbox[1]],
            'destXYWH': [left, top, width, height], 'mirrorX': flip, 'opacity': opacity, 'leftAlphaRampPx': feather_left}

for room in LAYERS['rooms'][4:8]:
    rid = room['roomId'][-3:]
    base = ROOT / 'assets-src/images' / rid
    raw = base / 'originals'
    out = ROOT / 'public/assets/images' / rid
    out.mkdir(parents=True, exist_ok=True)
    evidence = ROOT / 'docs/evidence/spec001/image-production/T118' / rid
    evidence.mkdir(parents=True, exist_ok=True)
    camera_file = ROOT / room['registration']['plannedCameraPath']
    registration = ROOT / room['registration']['plannedRegistrationPath']
    write(camera_file, {'roomId': room['roomId'], **room['camera'], 'status':'Frozen T106 camera used for T118 Blender and browser registration.',
                        'staging':'Center the complete 16:9 stage using contain; calculate the camera at that stage aspect.',
                        'sourcePath': str(LAYOUT.relative_to(ROOT)), 'sourceSha256':hash_file(LAYOUT)})
    allow = Image.new('L', SIZE)
    for polygon in room['occlusion']['foregroundOpaqueAllowRegionsUV']:
        # Pixel centers map into the normalized frozen camera plane.
        ImageDraw.Draw(allow).polygon([(round(x*(SIZE[0]-1)),round(y*(SIZE[1]-1))) for x,y in polygon], fill=255)
    allow.save(base/'foreground-allow-mask.png', optimize=True)
    transforms = {}
    for role in ('background','midground','foreground'):
        if role=='background':
            path = raw / 'background.png'
            original = Image.open(path)
            assert original.mode=='RGB'
            layer = original.resize(SIZE, RESAMPLE)
            transforms[role] = [{'source':path.name,'sourceSha256':hash_file(path),
                                 'sourcePixels':original.size,'sourceBox':[0,0,*original.size],'destXYWH':[0,0,*SIZE]}]
        else:
            layer = Image.new('RGBA', SIZE)
            placements = []
            if role=='midground':
                for name,width,left,top,mirror,opacity in DETAILS[rid]:
                    placements.append(place_cutout(layer, raw/(name+'.png'), srcbox=None, width=width,
                                                   left=left, top=top, flip=mirror, opacity=opacity,
                                                   feather_left=48 if rid=='R07' and name=='midground' else 0))
            else:
                for side in range(2):
                    name = 'cable-edge' if rid=='R07' and side==0 else 'foreground'
                    file = raw / (name+'.png')
                    w,h = Image.open(file).size
                    widths = {'R05':(64,59),'R06':(58,68),'R07':(67,56),'R08':(60,68)}
                    width = widths[rid][side]
                    x = 0 if side==0 else SIZE[0]-width
                    placements.append(place_cutout(layer, file, srcbox=(side*(w//2),0,w if side else w//2,h),
                                                   width=width,left=x))
                layer.putalpha(ImageChops.multiply(layer.getchannel('A'), allow))
            transforms[role] = placements
        masters = base / 'registered'
        masters.mkdir(exist_ok=True)
        layer.save(masters/(role+'.png'), optimize=True)
        with Image.open(masters/(role+'.png')) as master:
            master.save(out/(role+'.webp'), quality=91, method=6, alpha_quality=100)
    write(registration, {'roomId':room['roomId'],'cameraPath':str(camera_file.relative_to(ROOT)),
        'frozenLayoutSha256':hash_file(LAYOUT),'stagedReference':str((base/'reference/inputs.json').relative_to(ROOT)),
        'worldToUV':'Orthographic, normalized UV from top left; all exports use a centered full contained stage.',
        'exportSize':SIZE,'layerOrder':room['registration']['layerOrder'],'frozenFloorAnchors':room['registration']['coordinateAnchors'],
        'hotspotAnchors':room['registration']['hotspotAnchors'],'exits':room['exits'],
        'foregroundMask':str((base/'foreground-allow-mask.png').relative_to(ROOT)),
        'foregroundOpaqueAllowRegionsUV':room['occlusion']['foregroundOpaqueAllowRegionsUV'],
        'transformMethod':'Trim alpha <=3 in overlay sources; retain remaining natural alpha, resize with premultiplied Lanczos, apply declared uniform opacity, source-over composite. Clip foreground against editable L-mode allow mask. Export WebP quality 91, method 6, alpha quality 100. No parallax.',
        'layerPurposes':[a['purpose'] for a in LAYERS['nonmodelAllocations']['sceneLayers'] if a['roomId']==room['roomId']],
        'rawToExport':transforms})
