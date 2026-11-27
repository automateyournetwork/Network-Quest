# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Build room-specific placement reference images from exact camera anchors and GLB renders."""
import json
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[3]
rooms = json.loads((root/'assets-src/rooms/scene-layouts.json').read_text())['rooms'][1:4]
for room in rooms:
    base = root/'assets-src/images'/room['roomId'][-3:]/'reference'
    image = Image.new('RGBA',(1280,720),'#344353')
    draw = ImageDraw.Draw(image)
    def pixel(uv):
        return (int(uv[0]*1280), int(uv[1]*720))
    draw.polygon([pixel(a['uvAt16by9']) for a in room['registration']['coordinateAnchors']],fill='#737678')
    for exit_point in room['exits']:
        x,y = pixel(exit_point['uvAt16by9'])
        draw.ellipse((x-9,y-9,x+9,y+9),outline='#e7c77d',width=3)
    image.alpha_composite(Image.open(base/'cast.png').convert('RGBA'))
    image.convert('RGB').save(base/'camera-guide.png')
