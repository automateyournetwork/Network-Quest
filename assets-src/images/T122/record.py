# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Record original generation receipts, reference provenance and actual guest surfaces."""
from pathlib import Path
import hashlib
import json
import re
from PIL import Image

root = Path(__file__).resolve().parents[3]
batch = 'assets-src/images/T122'
review = 'docs/evidence/spec001/image-production/T122'
typed = 'docs/evidence/spec001/assets/T122'
(root / typed).mkdir(parents=True, exist_ok=True)
def read(path):
    return json.loads((root/path).read_text())
def write(path, data):
    (root/path).write_text(json.dumps(data, indent=2, ensure_ascii=False)+'\n')
    return path
def sha(path):
    return hashlib.sha256((root/path).read_bytes()).hexdigest()
def info(path):
    return dict(path=path,sha256=sha(path),bytes=(root/path).stat().st_size,format=Path(path).suffix[1:])

current_game = review + '/with-workshop'
browser_path = current_game + '/browser.json'
browser = read(browser_path)
final_path = review + '/verified-joined/browser.json'
final = read(final_path)
exports = read(review+'/exports.json')
allocations = next(b['assetIds'] for b in read('assets-src/production-allocation.json')['batches'] if b['task']=='T122')
plans = read('assets-src/audio/production-plan.json')['illustrations']
reviewer = 'Codex worker loop139/T122'
environment = 'macOS arm64, Blender model references, genuine OpenAI built-in image returns, Pillow '+exports['pillow']+' / libwebp '+exports['libwebp']+', '+browser['browser']+' via Playwright.'
date = browser['startedUtc'][:10]
rights = dict(creators=['John Capobianco and Network Quest, original model designs, authored field guides and engineering examples','OpenAI built-in image generation with Codex-assisted direction'],licenseIds=['CC-BY-4.0'],reviewStatus='accepted',noticePaths=[batch+'/NOTICE.md','LICENSE-ASSETS'],sourceUrls=['https://openai.com/policies/terms-of-use/','https://openai.com/policies/services-agreement/','https://openai.com/policies/service-terms/'],termsSnapshotPaths=['assets-src/images/T117/terms-review.md'],inputPermissionPaths=[batch+'/input-permissions.md'],aiDisclosure='OpenAI generated the field-guide artwork from project-owned Blender renders. The project licenses its interest in the result. The operator-specific agreement, underlying model revision and seed were not exposed.')
manifests = ['assets-src/manifest.json','assets-src/props/R01-R02/manifest.json','assets-src/props/R03-R04/manifest.json','assets-src/props/R05-R06/manifest.json','assets-src/characters/batch-a.json','assets-src/characters/batch-b.json']
models = {a['assetId']:(path,a) for path in manifests for a in read(path)['assets'] if a['kind'] in {'room-model','prop-model','character-model'}}

def reference_model(ref):
    identity = re.search(r'(?:PR\d{3}|CH\d{2})',ref)
    asset_id = 'spec001:ASSET-'+(identity[0] if identity else 'ARCH-R01')
    path, asset = models[asset_id]
    native = next(s for s in asset['sources'] if s['role']=='native')
    assert info(native['file']['path']) == native['file']
    return dict(reference=info(ref),assetId=asset_id,manifest=path,native=native['file'],nativeReopenEvidence=native['reopenEvidencePath'])
assets=[]
for row, asset_id, plan in zip(exports['images'],allocations,plans):
    n=row['number']; folder=batch+'/'+n
    prompt=folder+'/illustration.prompt.txt'; receipt_path=folder+'/tool-return.json'; receipt=read(receipt_path)
    room_path='content/spec001/rooms/'+plan['roomId'].split(':')[1]+'.json'
    binding=next(b for b in read(room_path)['illustrationBindings'] if b['assetId']==asset_id)
    observed=[v for v in browser['observed'] if v['assetId']==asset_id]
    assert len([v for v in final['observed'] if v['assetId']==asset_id]) == len(observed)
    assert all(v['sha256']==sha(binding['exportPath']) for v in final['observed'] if v['assetId']==asset_id)
    assert observed and all(v['contentId']==binding['contentId'] and v['src'].endswith(binding['exportPath'][6:]) for v in observed)
    original=folder+'/original.png'; web=binding['exportPath']; refs=receipt['referencePaths']
    ref_hashes=[sha(path) for path in refs]
    paths=[*refs,original,web]; hashes=[sha(path) for path in paths]
    assert all(v['sha256']==sha(web) and [v['width'],v['height']]==row['displaySize'] for v in observed)
    for path in paths:
        with Image.open(root/path) as im: im.load()
    settings=write(folder+'/settings.json',dict(eventId=receipt['eventId'],tool=receipt['tool'],transparent_background=False,modelRevision='not-exposed',toolVersion='not-exposed',seed='not-exposed',referencePathConvention='The tool received the equivalent absolute workspace paths.',referenced_image_paths=refs,referenceHashes=ref_hashes,nativeSources=[reference_model(r) for r in refs],original=info(original),prompt=info(prompt),receipt=info(receipt_path),originalSize=row['originalSize']))
    event=dict(method='openai-generated',tool=receipt['tool'],version='not-exposed',modelRevision='not-exposed',eventId=receipt['eventId'],settingsPath=settings,promptOrScriptPath=prompt,referenceHashes=ref_hashes,outputHashes=[sha(original)],notes='One genuine built-in generation. Full-frame PNG original; semantic captions and labels are separate authored HTML text.')
    checks=[]
    def evidence(kind,label,details,proof_hashes=hashes):
        path=typed+'/'+n+'-'+label+'.json'
        body=dict(type=kind,assetId=asset_id,hashes=proof_hashes,status='passed',actor='agent',reviewer=reviewer,date=date,environment=environment,details=details)
        if kind in {'review','rights'}:
            body['check']=label
            checks.append(dict(check=label,status='passed',reviewer=reviewer,date=date,hashes=proof_hashes,environment=environment,evidencePath=path,findings=details['findings']))
        return write(path,body)
    evidence('production','generation',{**event,'settingsSha256':sha(settings),'promptSha256':sha(prompt),'receiptPath':receipt_path,'receiptSha256':sha(receipt_path)},[ *ref_hashes,sha(original)])
    evidence('review','structure',dict(findings='The room registration, production allocation, semantic subject and nested WebP agree. Byte counts, decoded dimensions and SHA-256 values were checked.',observedPaths=paths,registeredRoom=room_path,displaySize=row['displaySize']))
    reopened=evidence('review','source-reopen',dict(findings='The referenced Blender renders, unaltered generation output and converted WebP decoded locally. Native Firefox independently decoded the display artwork.',observedPaths=paths,nativeModels=[reference_model(r) for r in refs],browserEvidence=browser_path))
    evidence('review','visual',dict(findings=binding['alt'],methods=['image-inspection'],tool='Codex view_image; native references, thumbnail review and readable field-guide comparison sheet',observedPaths=paths,displaySheet=review+'/display-sheet.jpg',reviewScope='Agent production inspection. Formal owner review remains open.'))
    compared=evidence('review','browser-comparison',dict(findings='The earned or contextual guest surface displayed its registered illustration. Firefox decoded its intrinsic size and its HTTP response matched the inspected derivative.',methods=['browser-inspection'],tool=browser['browser']+' via Playwright',observedPaths=paths,report=browser_path,finalSourceVerification=final_path,actualUses=observed))
    evidence('rights','rights',dict(findings='Each actual input traces to a project-owned model render. The generated output and localized browser export retain the original asset notice and public output terms review.',licenseIds=rights['licenseIds'],permitsModification=True,permitsCommercialReuse=True,permitsRedistribution=True,referenceHashes=ref_hashes,noticeHashes=[sha(p) for p in rights['noticePaths']],termsHashes=[sha(p) for p in rights['termsSnapshotPaths']],permissionHashes=[sha(p) for p in rights['inputPermissionPaths']]))
    use={k:binding[k] for k in ['assetId','contentId','use','exportPath','interactiveOrEvidence']}
    used=evidence('usage','usage',dict(bindings=[use],visible=True,meaningful=True,findings=binding['caption'],runtimeEvidencePath=browser_path,runtimeEvidenceSha256=sha(browser_path),finalSourceVerification=final_path,finalSourceVerificationSha256=sha(final_path),surfaces=observed,captures=[current_game+'/'+n+'-'+v['place']+'.png' for v in observed]),[sha(web)])
    registration=write(folder+'/display.json',dict(brief=plan,room=room_path,binding=binding,original=info(original),web=info(web),conversion='Scale the full uncropped frame with Lanczos and encode RGB WebP at quality 88, method 6. No retouching or labels in the derivative.',script=batch+'/export.py',displaySize=row['displaySize']))
    def source(path,role,app,version):
        return dict(file=info(path),role=role,application=app,version=version,reopenEvidencePath=reopened)
    assets.append(dict(assetId=asset_id,kind='illustration',semanticIdentity=asset_id.replace(':ASSET-',':'),status='integrated',countsTowardQuota=False,interactiveOrEvidence=False,variantOf=None,derivedFrom=[],sources=[*[source(p,'reference','Blender','5.2.1') for p in refs],source(original,'raw-generation',receipt['tool'],'not-exposed')],exports=[dict(file=info(web),mimeType='image/webp',sourceHashes=[sha(original)],tool='Pillow '+exports['pillow']+' / libwebp '+exports['libwebp'],preset='Full frame, Lanczos, quality 88, method 6',integrationEvidencePath=compared)],production=[event],rights=rights,usedBy=[dict(contentId=binding['contentId'],use=binding['use'],evidencePath=used)],verification=checks,image=dict(width=row['displaySize'][0],height=row['displaySize'][1],colorSpace='sRGB',alpha=False,cameraRecordPath=registration,layerRole=binding['use'],registrationPath=registration)))
assert len(assets)==12 and [a['assetId'] for a in assets]==allocations
write('assets-src/images/illustrations-01-12.json',dict(schemaVersion=1,episodeId='spec001',assets=assets))
