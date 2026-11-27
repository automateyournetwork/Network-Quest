# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Compose native and Firefox RGBA captures without repainting either image."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops

root=Path(__file__).resolve().parents[3]
out=root/'docs/evidence/spec001/assets/t107'
raw=root/'docs/evidence/spec001/character-production/T107'
scratch=root/'.local/t107'
names={'CH02':'The Titan','CH04':'Copperhead Snake','CH05':'Single-Mode Unicorn','CH06':'Multimode Hydra',
       'CH07':'Thunderbird','CH08':'Blue Dragon','CH09':'Red Scorpion'}
fontpath=Path('/System/Library/Fonts/Supplemental/Arial.ttf')
def font(size):
    return ImageFont.truetype(str(fontpath),size) if fontpath.exists() else ImageFont.load_default(size=size)
metrics={}
for asset,name in names.items():
    capture=json.loads((raw/f'{asset}-browser.json').read_text())
    nameset={c['name'] for c in capture['clips']}
    poses=['rest','idle','reaction']+(['ability'] if 'ability' in nameset else [])
    cell=234; left=101; top=69; h=2*cell+top+8
    sheet=Image.new('RGB',(left+cell*len(poses)+8,h),'#202d38')
    draw=ImageDraw.Draw(sheet)
    draw.text((15,12),asset+'   '+name,font=font(22),fill='#f0dfbf')
    for row,label in enumerate(['Blender','Firefox']):
        draw.text((12,top+row*cell+cell//2-8),label,font=font(17),fill='#a5d4c6')
    metrics[asset]={}
    for col,pose in enumerate(poses):
        label={'rest':'Rest','idle':'Idle · 25%','reaction':'Reaction · 50%','ability':'Ability · 50%'}[pose]
        draw.text((left+col*cell+8,45),label,font=font(15),fill='#eedfc9')
        masks=[]
        for row,medium in enumerate(['source','browser']):
            p=out/f'{asset}-{medium}.png' if pose=='rest' else scratch/f'{asset}-{pose}-{medium}.png'
            im=Image.open(p).convert('RGBA')
            alpha=im.getchannel('A')
            mask=alpha.point(lambda x:255 if x>127 else 0)
            box=mask.getbbox()
            assert box and min(box)>0 and box[2]<im.width-1 and box[3]<im.height-1
            masks.append(mask)
            im.thumbnail((cell-4,cell-4),Image.Resampling.LANCZOS)
            sheet.paste(im,(left+cell*col+2,top+cell*row+2),im)
        intersect=ImageChops.darker(*masks).histogram()[-1]
        union=ImageChops.lighter(*masks).histogram()[-1]
        metrics[asset][pose]={'silhouetteIoU':intersect/union,'pixels':list(masks[0].size),'alphaThreshold':127,'bothInsideFrame':True}
        assert intersect/union>.97,(asset,pose,intersect/union)
    sheet.save(out/f'{asset}-poses.png',optimize=True)
(raw/'projection-comparison.json').write_text(json.dumps(metrics,indent=2)+'\n')
