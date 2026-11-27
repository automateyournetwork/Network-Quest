# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Compare exact visible fixture pixels in the full native composition and its independently isolated meshes."""
from pathlib import Path
import json
from PIL import Image

root = Path(__file__).resolve().parents[2]
for code in ('R09','R10'):
    directory = root / 'docs/evidence/spec001/final-rooms/T139' / code
    report = json.loads((directory/'source-reopen.json').read_bytes())
    palette = {tuple(color): key for key, color in report['surveyPalette'].items()}
    survey = Image.open(directory/'selection-survey.png').convert('RGBA')
    width, height = survey.size
    coordinates = {key: [] for key in palette.values()}
    for i,(r,g,b,a) in enumerate(survey.get_flattened_data()):
        id = palette.get((r,g,b))
        if a >= 128 and id: coordinates[id].append((i%width,i//width))
    results = {}
    for id,points in coordinates.items():
        assert points,id
        x,y = zip(*points)
        row = dict(exactIdPixels=len(points), bounds=[min(x),min(y),max(x),max(y)])
        iso = directory/(id+'-isolated.png')
        if iso.exists():
            color = tuple(report['surveyPalette'][id])
            count = sum(rgb[:3]==color and rgb[3]>=128 for rgb in Image.open(iso).convert('RGBA').get_flattened_data())
            row.update(isolatedIdPixels=count, visiblePercent=round(100*len(points)/count,2))
        results[id]=row
    targetPixels=[]
    id='PR090' if code=='R09' else 'PR098'
    destination='R02' if code=='R09' else 'R11'
    u,v=next(a['uv'] for a in report['anchors'] if a['objectId'].endswith(destination) and a['objectId'].startswith('exit:'))
    for cssWidth in [384,1130.6667]:
        radius=22*width/cssWidth
        covered=sum(abs(x+.5-u*width)<radius and abs(y+.5-v*height)<radius for x,y in coordinates[id])
        targetPixels.append(dict(fixture=id,destination=destination,plateWidthCss=cssWidth,targetCss=[44,44],coveredPixels=covered))
        assert covered==0,(code,cssWidth,covered)
    summary=dict(width=width,height=height,method='Exact flat object colors in 1024x576 same-camera native views; fractional differences include material edges.',models=results,exitCoverage=targetPixels)
    (directory/'selection-measurements.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(code, {id:r['visiblePercent'] for id,r in results.items() if 'visiblePercent' in r})
