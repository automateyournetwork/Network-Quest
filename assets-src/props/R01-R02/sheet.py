# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Arrange actual source and GLB captures into two review sheets with identical view scales."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[3]
out=root/'docs/evidence/spec001/prop-production/T110'
names={p['id']:p['name'] for p in json.loads((root/'assets-src/rooms/scene-layouts.json').read_text())['sourcePropRoster']}
font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',19)
small=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',13)
for start,group in [(11,'bench'),(16,'preparation')]:
    frame=Image.new('RGB',(1000,568),'#253642')
    draw=ImageDraw.Draw(frame)
    for i in range(5):
        asset=f'PR{start+i:03}'
        x=i*200
        draw.text((x+8,8),asset,fill='#f3d09c',font=font)
        draw.text((x+8,38),names['spec001:'+asset],fill='#e6ece6',font=small)
        for j,key in enumerate(['native','browser']):
            y=68+250*j
            capture=Image.open(out/asset/(key+'.png')).convert('RGB')
            capture.thumbnail((200,200),Image.Resampling.LANCZOS)
            frame.paste(capture,(x,y))
            draw.text((x+8,y+207),['Blender source','Firefox GLB'][j],fill='#bed5d1',font=small)
    frame.save(out/(group+'-comparison.jpg'),quality=93)
