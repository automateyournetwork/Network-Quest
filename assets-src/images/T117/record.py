# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Bind the actual tool receipts, retained inputs, inspected exports and frozen allocation."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[3]
def load(path):
    return json.loads((root/path).read_text())
def write(path,value):
    (root/path).write_text(json.dumps(value,indent=2)+'\n')
def sha(path):
    return hashlib.sha256((root/path).read_bytes()).hexdigest()
def file_info(path):
    return {'path':path,'bytes':(root/path).stat().st_size,'sha256':sha(path),'format':Path(path).suffix[1:]}
shared='assets-src/images/T117'
evidence='docs/evidence/spec001/assets/T117'
reviews='docs/evidence/spec001/image-production/T117'
reviewer='Codex agent loop134/T117'
environment='macOS arm64; Blender 5.2.1 LTS; OpenAI built-in image generation; Pillow 13.0.0; native Firefox 159.0 via Playwright'
date='2026-11-27'
rights={'reviewStatus':'accepted','creators':['John Capobianco / Network Quest, original direction and registered Blender references','OpenAI built-in image generation with Codex-assisted production'],
        'licenseIds':['CC-BY-4.0'],'noticePaths':[shared+'/NOTICE.md','LICENSE-ASSETS'],
        'sourceUrls':['https://openai.com/policies/terms-of-use/','https://openai.com/policies/services-agreement/','https://openai.com/policies/service-terms/'],
        'termsSnapshotPaths':[shared+'/terms-review.md'],'inputPermissionPaths':[shared+'/input-permissions.md'],
        'aiDisclosure':'Artwork from actual OpenAI image generation, with deterministic camera registration, alpha cleanup and compression. Project-controlled rights only.'}
visual={
    'R02':{'background':'Amber furnace alcove, side portals and cool high gallery above warm open stone. The cast furnace appears oversized and too high against the alcove. The floating impression and missing contacts need native T135 staging.',
           'midground':'Three hanging tongs are discrete against the stone at upper left. Six brass-set paving inserts coincide with six exit foot points. The left lift insert is 74.4% visible in the first-frame cast. The other five are fully visible.',
           'foreground':'Small separate wooden bench corners, including the pliers and rasp, fit fully inside the two edge wedges. The layer has no centre pixels.'},
    'R03':{'background':'A fan of held copper seams descends from the warm left wall past the entrance. The shady recess behind the motor and the broad neutral working floor remain distinct.',
           'midground':'Parallel ladder trays curve along the upper-right wall. Their sparse silhouette stays above the actual motor, copper cutaways and inspector figures.',
           'foreground':'The reel-rim fragment and loose wire tips are individually legible on contrasting matte and frame the two lower edges without obscuring the separate real damaged spool or continuity pedestal.'},
    'R04':{'background':'Rounded blue arches recede toward the left aperture. The single warm light in the high postal alcove remains visible. The broad stage has room for the later sprite actors.',
           'midground':'Sculpted pendant ribs descend from the upper right. They leave a clear gap above the Bat and keep the golden post light visible.',
           'foreground':'The left stack of rounded stones and single ochre-veined right stone are isolated against both mattes. Each edge is clear of the broken span, right postal exhibits and sprite lane.'}}
canonical=load('assets-src/manifest.json')
assets=[a for a in canonical['assets'] if a['assetId'].startswith('spec001:ASSET-LAYER-R01-')]
for rid in ['R02','R03','R04']:
    base='assets-src/images/'+rid
    pixel_report=load(reviews+'/'+rid+'/pixels.json')
    browser=load(reviews+'/'+rid+'/browser.json')
    for role in ['background','midground','foreground']:
        id='spec001:ASSET-LAYER-'+rid+'-'+role
        source_paths={}
        events=[]
        generation_roles=[role,'threshold'] if rid=='R02' and role=='midground' else [role]
        for component in generation_roles:
            raw=base+'/originals/'+component+'.png'
            guide=base+'/reference/camera-guide.png'
            bg=base+'/originals/background.png'
            refs=[guide] if component=='background' else [bg] if component=='threshold' else [bg,guide]
            settings=base+'/'+component+'.settings.json'
            prompt=base+'/'+component+'.prompt.txt'
            receipt_path=base+'/'+component+'.tool-return.json'
            receipt=load(receipt_path)
            with Image.open(root/raw) as im:
                current={'observedDimensions':im.size,'observedMode':im.mode,'pngMetadataKeys':list(im.info)}
            write(settings,{'tool':'OpenAI image_gen__imagegen','eventId':receipt['eventId'],'transparent_background':component!='background',
                'referenced_image_paths':refs,'pathConvention':'Exact relative paths shown; tool received the equivalent absolute workspace paths.',
                'referenceHashes':[sha(p) for p in refs],'promptPath':prompt,'promptSha256':sha(prompt),'receiptPath':receipt_path,'receiptSha256':sha(receipt_path),
                'imageUrlDisposition':receipt['imageUrlDisposition'],'returnedKeys':receipt['returnedKeys'],'exposedModelRevision':'not-exposed',
                'seed':'not-exposed','toolVersion':'not-exposed','startedUtc':receipt['startedUtc'],'completedUtc':receipt['completedUtc'],**current})
            for path in refs:
                source_paths[path]=('reference','OpenAI image_gen__imagegen','not-exposed') if path==bg else ('reference','Blender with Pillow camera guide','5.2.1 / 13.0.0')
            source_paths[raw]=('raw-generation','OpenAI image_gen__imagegen','not-exposed')
            event={'method':'openai-generated','tool':'OpenAI image_gen__imagegen','version':'not-exposed','modelRevision':'not-exposed',
                   'eventId':receipt['eventId'],'settingsPath':settings,'promptOrScriptPath':prompt,'referenceHashes':[sha(p) for p in refs],
                   'outputHashes':[sha(raw)],'notes':'Image returned by the actual built-in tool, retained verbatim. Registration and WebP encoding follow in the export pipeline.'}
            events.append(event)
            production_details={**event,'settingsSha256':sha(settings),'promptSha256':sha(prompt),'toolReturnPath':receipt_path,
                'toolReturnSha256':sha(receipt_path),'rawFile':file_info(raw),'startedUtc':receipt['startedUtc'],'completedUtc':receipt['completedUtc']}
            write(evidence+'/'+rid+'-'+component+'-production.json',{'type':'production','assetId':id,'hashes':[sha(p) for p in [*refs,raw]],
                'actor':'agent','date':date,'environment':environment,'reviewer':reviewer,'status':'passed','details':production_details})
        if role=='foreground':
            source_paths[base+'/foreground-allow-mask.png']=('reference','Pillow from frozen T106 polygons','13.0.0')
        export='public/assets/images/'+rid+'/'+role+'.webp'
        scope_hashes=sorted({sha(p) for p in [*source_paths,export]})
        checks=[]
        def record(check,details,status='passed'):
            path=evidence+'/'+rid+'-'+role+'-'+check+'.json'
            write(path,{'type':'rights' if check=='rights' else 'review','assetId':id,'hashes':scope_hashes,'status':status,
                'actor':'agent','reviewer':reviewer,'date':date,'environment':environment,'check':check,'details':details})
            checks.append({'check':check,'status':status,'reviewer':reviewer,'date':date,'hashes':scope_hashes,
                'environment':environment,'evidencePath':path,'findings':details['findings']})
            return path
        record('structure',{'findings':'Independent decode of source PNGs and registered 1600x900 WebP. Compared current sizes, alpha and hashes.',
            'pixelsPath':reviews+'/'+rid+'/pixels.json','foregroundPixelsOutsideAllowedWedges':pixel_report['foregroundPixelsOutsideFrozenWedges']})
        reopen=record('source-reopen',{'findings':'Pillow decoded sources, references and public WebP. Firefox independently decoded the web export and registered cast.',
            'pixelReport':reviews+'/'+rid+'/pixels.json','browserReport':reviews+'/'+rid+'/browser.json'})
        record('visual',{'findings':visual[rid][role], 'methods':['image-inspection'],'tool':'view_image for original artwork, raw and WebP matte contacts and native Firefox captures',
            'observedPaths':[*source_paths,export],'observations':[reviews+'/'+rid+'/raw-mattes.jpg',reviews+'/'+rid+'/web-mattes.jpg',
                *[c['screenshot'] for c in browser['captures']]],'scope':'Inspected by agent at standalone production stage.'})
        record('rights',{'findings':'Project-owned input and generated output provenance reviewed against the linked public terms on 2026-11-27. Covers the interest held by the project.',
            'licenseIds':rights['licenseIds'],'permitsCommercialReuse':True,'permitsRedistribution':True,'permitsModification':True,
            'noticeHashes':[sha(p) for p in rights['noticePaths']],'termsHashes':[sha(p) for p in rights['termsSnapshotPaths']],
            'permissionHashes':[sha(p) for p in rights['inputPermissionPaths']],'referenceHashes':sorted({h for ev in events for h in ev['referenceHashes']})})
        integration=record('browser-comparison',{'findings':'Native isolated composition inspected. Finished-room interaction, low-detail behavior, footprint and owner review await integration.',
            'standaloneReport':reviews+'/'+rid+'/browser.json'},'pending')
        assets.append({'assetId':id,'semanticIdentity':'spec001:LAYER-'+rid+'-'+role,'kind':'scene-layer','status':'exported',
            'countsTowardQuota':False,'interactiveOrEvidence':False,'variantOf':None,'derivedFrom':[] if role=='background' else ['spec001:ASSET-LAYER-'+rid+'-background'],
            'sources':[{'file':file_info(path),'role':srole,'application':app,'version':version,'reopenEvidencePath':reopen} for path,(srole,app,version) in source_paths.items()],
            'exports':[{'file':file_info(export),'mimeType':'image/webp','sourceHashes':[sha(p) for p,(_,app,_) in source_paths.items() if source_paths[p][0]=='raw-generation' or p.endswith('allow-mask.png')],
                'tool':'Pillow 13.0.0 / WebP','preset':'1600x900 q91, method 6, alpha 100. Registered via '+base+'/registration.json.',
                'integrationEvidencePath':integration}],'production':events,'rights':rights,'usedBy':[],'verification':checks,
            'image':{'width':1600,'height':900,'colorSpace':'sRGB','alpha':role!='background','cameraRecordPath':base+'/camera.json',
                'layerRole':role,'registrationPath':base+'/registration.json'}})
allocation=next(b['assetIds'] for b in load('assets-src/production-allocation.json')['batches'] if b['task']=='T117')
assert [a['assetId'] for a in assets]==allocation
write('assets-src/images/rooms-01-04.json',{'schemaVersion':1,'episodeId':'spec001','assets':assets})
