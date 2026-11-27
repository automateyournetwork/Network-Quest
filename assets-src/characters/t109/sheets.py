# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Assemble the actual Blender and Firefox captures, reference dimensions and palette."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[3]
RAW=ROOT/'docs/evidence/spec001/character-production/T109'
CAPTURES=ROOT/'.local/t109/render'
FONT=Path('/System/Library/Fonts/Supplemental')
small=ImageFont.truetype(str(FONT/'Arial.ttf'),17)
namefont=ImageFont.truetype(str(FONT/'Arial Bold.ttf'),36)
label=ImageFont.truetype(str(FONT/'Arial Bold.ttf'),18)
ink='#F0DFC1'; faded='#ABBEBC'; bg='#172A35'; amber='#DBAD71'
names=['Rainbow Serpent','Electric Eel','Echo Bat','Metronome Golem','Chameleon','Noise Demon','Crosstalk Twins','Backhoe of Doom']
roles=['Prism Vault keykeeper','Shell Market power accountant','Repeater companion','The Clockworks timekeeper','Common-capability companion','Storm Observatory encounter','One paired cable-creature encounter','The Severed at the Rift']
# Every swatch is a sRGB input from the native material palette.
palette={'teal':'368B86','sea':'205A60','copper':'B76F49','brass':'DCAB66','ink':'182A36','slate':'364E61','pearl':'CEE7DA','cream':'F0DDB8','rust':'BD6850','mint':'A5D6BF','iris':'8E79AD','charcoal':'40515C','blue':'689CB7','ochre':'D7A454','olive':'65956D','pine':'385E50','stone':'657581','plum':'765668','walnut':'664D43','amber':'EFB15F','coal':'15232B'}
overview=Image.new('RGB',(1290,744),bg)
od=ImageDraw.Draw(overview);od.text((19,14),'The Underworld cast',font=namefont,fill=ink)
od.text((19,62),'CH18–25    /    Blender models    /    individually framed',font=small,fill=faded)
for ix,name in enumerate(names):
    id='CH'+str(18+ix);raw=RAW/id;work=CAPTURES/id
    native=json.loads((raw/'native.json').read_text())
    browser=json.loads((raw/'browser.json').read_text())
    tile=272;gap=8;pad=18;step=tile+34
    w=pad*2+tile*4+gap*3;h=98+step*3+12
    sheet=Image.new('RGB',(w,h),bg);d=ImageDraw.Draw(sheet)
    d.text((pad,13),name,fill=ink,font=namefont)
    d.text((pad,60),f'{id}   /   {roles[ix]}',fill=faded,font=small)
    def panel(col,row,path,title):
        x=pad+col*(tile+gap);y=92+row*step
        im=Image.open(work/(path+'.png')).convert('RGB').resize((tile,tile),Image.Resampling.LANCZOS)
        sheet.paste(im,(x,y));d.text((x,y+tile+6),title,font=small,fill=ink)
    for col,(f,title) in enumerate([('source','Blender · three-quarter'),('front','Blender · front'),('side','Blender · side'),('web-rest','Firefox GLB · three-quarter')]):
        panel(col,0,f,title)
    for col,(f,title) in enumerate([('idle','Blender · idle 25%'),('web-idle','Firefox GLB · idle 25%'),('reaction','Blender · reaction 50%'),('web-reaction','Firefox GLB · reaction 50%')]):
        panel(col,1,f,title)
    if 'ability' in native['clips']:
        panel(0,2,'ability','Blender · ability contact');panel(1,2,'web-ability','Firefox GLB · ability contact')
    else:
        x=pad;y=92+2*step
        # Identify the unit explicitly. The native views above have individual framing.
        lo,hi=native['restBoundsBlender'];modelHeight=hi[2]-lo[2]
        pixels_per_m=105 if modelHeight<=2.1 else 66
        base=y+min(241,modelHeight*pixels_per_m+45)
        d.text((x,y),'Scale reference',font=label,fill=amber)
        for k,height in enumerate([1,modelHeight]):
            left=x+16+k*128;top=base-height*pixels_per_m
            d.line((left,top,left,base),fill=faded,width=3)
            for yy in (top,base):d.line((left-7,yy,left+7,yy),fill=faded,width=2)
            d.text((left+10,top),f'{height:.2f} m',font=small,fill=ink)
        d.text((x,base+4),'Metre',font=small,fill=faded);d.text((x+128,base+4),id,font=small,fill=faded)
    x=pad+2*(tile+gap);y=92+2*step+13
    lo,hi=native['restBoundsBlender'];size=[b-a for a,b in zip(lo,hi)]
    d.text((x,y),'Model dimensions',font=label,fill=amber)
    d.text((x,y+32),f'{size[0]:.2f} m wide   ×   {size[1]:.2f} m deep   ×   {size[2]:.2f} m high',font=small,fill=ink)
    d.text((x,y+66),f"{browser['triangles']:,} triangles   /   {len(browser['materials'])} PBR materials",font=small,fill=faded)
    d.text((x,y+97),f"{len(native['clips'])} articulated clips   /   24 fps",font=small,fill=faded)
    for j,mat in enumerate(browser['materials']):
        left=x+(j%8)*45;top=y+149+(j//8)*48
        d.rounded_rectangle((left,top,left+31,top+28),radius=4,fill='#'+palette[mat])
    d.text((x,y+250),'Native material swatches · sRGB',font=small,fill=faded)
    sheet.save(raw/'sheet.jpg',quality=94,subsampling=0)
    ox=18+ix%4*317;oy=94+ix//4*318
    # Preserve square geometry, trim only neutral studio margins.
    im=Image.open(work/'source.png').convert('RGB').crop((0,24,480,456)).resize((299,269),Image.Resampling.LANCZOS)
    overview.paste(im,(ox,oy));od.text((ox,oy+278),f'{id}  {name}',font=label,fill=ink)
overview.save(RAW/'cast.jpg',quality=94,subsampling=0)
