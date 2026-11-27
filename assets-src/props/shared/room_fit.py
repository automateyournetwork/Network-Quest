# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Compare the two camera stages and the evaluated surfaces at each mounting origin."""
from pathlib import Path
import json, math, hashlib, itertools
from PIL import Image, ImageDraw, ImageFont
import numpy as np

ROOT=Path(__file__).resolve().parents[3];RAW=ROOT/'docs/evidence/spec001/prop-production/T116'
read=lambda p:json.loads(p.read_text())
room_layouts=read(ROOT/'assets-src/rooms/scene-layouts.json')['rooms']
contact=read(RAW/'surface-contact.json')
font=ImageFont.load_default(size=16)
sheet=Image.new('RGB',(1200,4*257),'#253641');draw=ImageDraw.Draw(sheet)
rows=[]
for i,room in enumerate(room_layouts[1:]):
    code=room['roomId'][-3:]
    png=Image.open(RAW/(code+'-mounted.png')).convert('RGBA').resize((400,225),Image.Resampling.LANCZOS)
    x=i%3*400;y=i//3*257
    sheet.paste(png,(x,y+29),png);draw.text((x+5,y+5),code+'   '+room['name'],font=font,fill='#f8e3b7')
    before=read(RAW/(code+'-frozen.json'));after=read(RAW/(code+'-mounted.json'))
    assert before['inputs']==after['inputs']
    for data in after['inputs']:
        assert hashlib.sha256((ROOT/data['path']).read_bytes()).hexdigest()==data['sha256']
    for p,b,a,t in zip(room['propPlacements'],before['coverage'],after['coverage'],after['transforms'],strict=True):
        assert t['id']==a['id']==b['id']==p['semanticId']
        if p['sourceAllocation']!='Shared':continue
        short=a['id'][-5:]
        box=read(RAW/(short+'-browser.json'))['bounds']
        points=np.array(list(itertools.product(*zip(*box)))).T
        ax,ay,az=t['euler']
        c,s=math.cos,math.sin
        rx=np.array([[1,0,0],[0,c(ax),-s(ax)],[0,s(ax),c(ax)]])
        ry=np.array([[c(ay),0,s(ay)],[0,1,0],[-s(ay),0,c(ay)]])
        rz=np.array([[c(az),-s(az),0],[s(az),c(az),0],[0,0,1]])
        world=rx@ry@rz@points+np.array(t['position'])[:,None]
        lo,hi=world.min(axis=1),world.max(axis=1);safe=room['authoritativeSafePositions'][0]['point']
        dx=max(lo[0]-safe['x'],safe['x']-hi[0],0);dz=max(lo[2]-safe['y'],safe['y']-hi[2],0)
        clearance=math.hypot(dx,dz)
        assert clearance>=room['visualWalkGuide']['safeArrivalRadiusMetres'] and a['visiblePixels']>0 and a['fullyInFrame']
        rows.append(dict(id=short,room=code,parent=p['mountedToInstanceId'],frozenWorld=p['position'],
                         candidateRuntimeWorld=t['position'],candidateRuntimeEuler=t['euler'],
                         conservativeArrivalClearanceMetres=clearance,frozenPixels=b['visiblePixels'],
                         mountedPixels=a['visiblePixels'],mountedVisibleFraction=a['visibleFraction'],
                         mountSurface=contact.get(short),fullyInFrame=a['fullyInFrame']))
assert set(r['id'] for r in rows)=={f'PR{n}' for n in range(121,151)} and len(contact)==23
(RAW/'room-fit.json').write_text(json.dumps(sorted(rows,key=lambda r:r['id']),indent=2)+'\n')
sheet.save(RAW/'mounted-rooms.jpg',quality=93)
