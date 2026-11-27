# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Rebuild the registered layers from the preserved OpenAI output pixels."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageChops, ImageDraw
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
LAYOUT = ROOT / 'assets-src/rooms/scene-layouts.json'
LAYERS = json.loads(LAYOUT.read_text())
SIZE = (1600, 900)
RESAMPLE = Image.Resampling.LANCZOS

# Width is measured in stage pixels after trimming transparent padding.
# Coordinates are the upper-left corner of that placed cutout. Negative positions
# allow an architectural or botanical form to continue beyond the frame.
# source half (None means complete), width, left, top. Preserve the generated aspect.
DETAILS = {
    'R09': [(None, 409, 303, 62)],
    'R10': [(None, 304, 1115, 64)],
    'R11': [(None, 219, 1388, 83)],
    'R12': [(0, 91, 579, 153), (1, 73, 1160, 151)],
}

def write(path, obj):
    path.write_text(json.dumps(obj, indent=2) + '\n')

def hash_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def place_cutout(stage, source, *, srcbox, width, left, top=None):
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
    height = round(width * im.height / im.width)
    im = im.resize((width, height), RESAMPLE)
    top = stage.height-height if top is None else top
    stage.alpha_composite(im, (left, top))
    return {'source': source.name, 'sourceSha256': hash_file(source), 'sourcePixels': original_size,
            'sourceBox': [box[0]+srcbox[0], box[1]+srcbox[1], box[2]+srcbox[0], box[3]+srcbox[1]],
            'destXYWH': [left, top, width, height]}

def project_passages(room,base,dst):
    """Project the room-specific generated paving to each registered exit foot point."""
    marks = []
    sw,sh = dst.size
    threshold = Image.open(base/'originals/passage.png').convert('RGBA')
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
        sideways = x < .5 or x > 11.5
        along = np.array([0,1.72] if sideways else [1.72,0])
        across = np.array([-.40,0] if sideways else [0,.40])
        start = np.array([x,z])-(along+across)/2
        corners = np.array([start,start+along,start+across,start+along+across])
        points = np.column_stack([corners,np.ones(4)]) @ projection
        tex_coords = np.array([[0.,0.],[tw,0],[0,th]])
        inverse = np.linalg.solve(np.column_stack([points[:3],np.ones(3)]),tex_coords)
        projected = threshold.transform(dst.size,Image.Transform.AFFINE,tuple(inverse.T.ravel()),Image.Resampling.BICUBIC)
        dst.alpha_composite(projected)
        marks.append({'existingExit':e['id'],'floorPoint':e['point'],'worldFootprintXZ':corners.tolist(),'destinationPixels':points.tolist()})
    return {'source':'originals/passage.png','sourceBox':box,'prefilterPixels':[tw,th],'instances':marks}


for room in LAYERS['rooms'][8:12]:
    rid = room['roomId'][-3:]
    base = ROOT / 'assets-src/images' / rid
    raw = base / 'originals'
    out = ROOT / 'public/assets/images' / rid
    out.mkdir(parents=True, exist_ok=True)
    evidence = ROOT / 'docs/evidence/spec001/image-production/T119' / rid
    evidence.mkdir(parents=True, exist_ok=True)
    camera_file = ROOT / room['registration']['plannedCameraPath']
    registration = ROOT / room['registration']['plannedRegistrationPath']
    write(camera_file, {'roomId': room['roomId'], **room['camera'], 'status':'Frozen T106 camera used for T119 Blender and browser registration.',
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
            path = raw / ('background-repair.png' if rid == 'R12' else 'background.png')
            original = Image.open(path)
            assert original.mode=='RGB'
            layer = original.resize(SIZE, RESAMPLE)
            transforms[role] = [{'source':path.name,'sourceSha256':hash_file(path),
                                 'sourcePixels':original.size,'sourceBox':[0,0,*original.size],'destXYWH':[0,0,*SIZE]}]
        else:
            layer = Image.new('RGBA', SIZE)
            placements = []
            if role=='midground':
                file = raw/'midground.png'
                w,h = Image.open(file).size
                for half,width,left,top in DETAILS[rid]:
                    box = None if half is None else (half*(w//2),0,w if half else w//2,h)
                    stage = Image.new('RGBA',SIZE)
                    fit = place_cutout(stage,file,srcbox=box,width=width,left=left,top=top)
                    if rid == 'R11':
                        # Atmospheric perspective over the far, cool rock face.
                        graded = Image.blend(stage.convert('RGB'),Image.new('RGB',SIZE,(104,108,143)),.33)
                        graded.putalpha(stage.getchannel('A'))
                        stage = graded
                        fit['distanceGrade'] = {'sRGB':[104,108,143],'mix':.33}
                    layer.alpha_composite(stage)
                    placements.append(fit)
                placements.append({'passages':project_passages(room,base,layer)})
            else:
                file = raw/'foreground.png'
                w,h = Image.open(file).size
                # R12's left three-block stone extends past the center line in the original.
                split = round(w*(.665 if rid=='R12' else .5))
                for side,box in enumerate(((0,0,split,h),(split,0,w,h))):
                    width = (69,67)[side]
                    x = 0 if side==0 else SIZE[0]-width
                    placements.append(place_cutout(layer,file,srcbox=box,width=width,left=x))
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
        'transformMethod':'Trim alpha <=3 in overlay sources; retain remaining natural alpha, resize with premultiplied Lanczos, apply the recorded Rift distance grade and composite source-over. Project paving after trimming alpha <=8. Clip foreground against editable L-mode allow mask. Export WebP quality 91, method 6, alpha quality 100. No parallax.',
        'layerPurposes':[a['purpose'] for a in LAYERS['nonmodelAllocations']['sceneLayers'] if a['roomId']==room['roomId']],
        'safePositions':room['authoritativeSafePositions'],'walkRegions':room['authoritativeWalkRegions'],
        'fullStageCameraSha256':hash_file(camera_file),'rawToExport':transforms})
