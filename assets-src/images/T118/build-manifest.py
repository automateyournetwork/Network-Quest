# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Bind saved production events and inspected pixels to the T118 exported fragment."""
import hashlib
import json
from pathlib import Path
import PIL

ROOT = Path(__file__).resolve().parents[3]
SRC = Path('assets-src/images')
MEDIA = Path('docs/evidence/spec001/image-production/T118')
TYPED = Path('docs/evidence/spec001/assets/T118')
REVIEWER = 'Codex agent loop135/T118'
DATE = '2026-11-27'
NOTICE = str(SRC/'T118/NOTICE.md')
LICENSE = 'LICENSE-ASSETS'
URLS = ['https://openai.com/policies/terms-of-use/', 'https://openai.com/policies/services-agreement/', 'https://openai.com/policies/service-terms/']
OBSERVATIONS = {
 'R05': ['Upper-left pearl light and the tiered water gardens leave the central inspection floor calm. The cast has separate dock and shelf silhouettes; Hydra partly overlaps the patch shelf.',
         'The upper-left bells and top-right ferns retain leaf gaps, fine stems and drop edges on both mattes. The upper middle remains open behind the grove trunk.',
         'The close curled fiddleheads and opposing maidenhair leaf occupy the two lower wedges. Neither exit square touches this layer.'],
 'R06': ['The broad violet vault has an empty floor, a ceiling light and two lateral passages. The right operational exit target falls on the staged filter door.',
         'Four suspended prisms create a glass silhouette below the bronze wall band. Their small footprint leaves the separate interactive prism engine and abacus legible.',
         'The two clipped amethyst outcrops show unequal silhouettes and cut faces. The right exit overlap is already in the 3D reference cast.'],
 'R07': ['The shelf and bright warm-rimmed cliffs open to cool sky behind the antenna. The far ledge is traversable within the frozen footprint. The cast needs matched contact light.',
         'The little viaduct and its draped relay cables sit high in the sky, with distinct arches and a light mist edge. The short cloud cutout has a softened left edge.',
         'The braided cable and masonry occupy the lower left and windblown grass the lower right. The alignment scope and exit band remain uncovered.'],
 'R08': ['Rain-dark window ribs frame clouds and warm horizon light beyond a dry stone work floor. The dish and telescope remain 3D silhouettes.',
         'The left rib joins the near window structure and the small right rain collector carries bead highlights. The desk, dish and window field remain clear of the decorative layer.',
         'A patinated leaf finial and wet copper tile lip bracket the lower corners, with the entire survey and present-noise control band transparent.'],
}

def read(path):
    return json.loads((ROOT/path).read_text())

def sha(path):
    return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()

def file(path):
    p = ROOT/path
    return {'path':str(path),'sha256':sha(path),'bytes':p.stat().st_size,'format':p.suffix[1:]}

def write(path,obj):
    (ROOT/path).write_text(json.dumps(obj,indent=2)+'\n')

manifest={'schemaVersion':1,'episodeId':'spec001','assets':[]}
for room in read('assets-src/rooms/scene-layouts.json')['rooms'][4:8]:
    rid = room['roomId'][-3:]
    base = SRC/rid
    ev = MEDIA/rid
    registration = Path(room['registration']['plannedRegistrationPath'])
    reg = read(registration)
    pixels = read(ev/'pixels.json')
    browser = read(ev/'browser.json')
    environment = f"Blender 5.2.1 LTS, Pillow {PIL.__version__}, {browser['browser']}, standalone camera composition on macOS arm64"
    for n,role in enumerate(('background','midground','foreground')):
        prefix = f'{rid}-{role}'
        aid = 'spec001:ASSET-LAYER-'+prefix
        master = base/'registered'/(role+'.png')
        export = Path('public/assets/images')/rid/(role+'.webp')
        path_roles = {}
        events = []
        def source(p,role,app,version):
            path_roles[p] = (role,app,version)
        inputs = list(dict.fromkeys(x['source'] for x in reg['rawToExport'][role]))
        edit_inputs = []
        for name in inputs:
            stem = Path(name).stem
            raw = base/'originals'/name
            receipt = base/(stem+'.receipt.json')
            result = read(receipt)
            prompt = Path(result['promptPath'])
            reference_hashes = []
            for p in result['referenced_image_paths']:
                p=Path(p)
                application = 'OpenAI image_gen__imagegen' if 'originals' in p.parts else 'Blender workbench cast with Pillow registration'
                version = 'not-exposed' if 'originals' in p.parts else f'Blender 5.2.1 and Pillow {PIL.__version__}'
                source(p,'reference',application,version)
                reference_hashes.append(sha(p))
            source(raw,'raw-generation',result['tool'],'not-exposed')
            assert result['original']==str(raw)
            edit_inputs.append(sha(raw))
            events.append({'method':'openai-generated','tool':result['tool'],'version':'not-exposed','modelRevision':'not-exposed',
                'eventId':result['eventId'],'settingsPath':str(receipt),'promptOrScriptPath':str(prompt),
                'referenceHashes':reference_hashes,'outputHashes':[sha(raw)],
                'notes':'Separate actual OpenAI built-in invocation. Authenticated by the returned PNG filename and preserved original bytes; carrier path and known tool metadata are in the receipt. Model revision and seed were not returned.'})
        if role=='foreground':
            mask = base/'foreground-allow-mask.png'
            source(mask,'reference','Pillow frozen-region rasterization',PIL.__version__)
            edit_inputs.append(sha(mask))
        source(master,'master','Pillow',PIL.__version__)
        events.append({'method':'manual-edit','tool':'Pillow registration and layer composition','version':PIL.__version__,'modelRevision':'not applicable',
            'eventId':'T118-register-'+prefix,'settingsPath':str(registration),'promptOrScriptPath':str(SRC/'T118/register-layers.py'),
            'referenceHashes':edit_inputs,'outputHashes':[sha(master)],'notes':'Camera registration and WebP encoding are deterministic derivatives. The registration JSON binds source rectangles, stage rectangles, mirror, opacity, alpha ramp and the edge mask.'})
        allpaths = [*path_roles, export]
        hashes = sorted(set(map(sha, allpaths)))
        def evidence(suffix,kind,status,details,check=None):
            record={'type':kind,'assetId':aid,'hashes':hashes,'status':status,'actor':'agent','reviewer':REVIEWER,'date':DATE,
                    'environment':environment,'details':details}
            if check: record['check']=check
            out=TYPED/f'{prefix}-{suffix}.json'
            write(out,record)
            return str(out)
        for i,event in enumerate(events):
            evidence('production-'+str(i+1),'production','passed',{**event,'settingsSha256':sha(event['settingsPath']),
                'promptSha256':sha(event['promptOrScriptPath']),'originalClockRecords':'See each image tool receipt; registration contributes zero calls.'})
        rights={'reviewStatus':'pending','creators':['John Capobianco and the Network Quest project','OpenAI image generation, directed using Codex'],
                'licenseIds':['CC-BY-4.0'],'noticePaths':[NOTICE,LICENSE],'sourceUrls':URLS,
                'termsSnapshotPaths':[NOTICE],'inputPermissionPaths':[NOTICE],
                'aiDisclosure':'Original OpenAI-generated image pixels. Project-owned camera guides and same-room original backgrounds provided references. Attribution covers project-controlled rights.'}
        reviews=[]
        def review(check,findings,details,status='passed'):
            path=evidence(check,'rights' if check=='rights' else 'review',status,{'findings':findings,**details},check)
            reviews.append({'check':check,'status':status,'reviewer':REVIEWER,'date':DATE,'hashes':hashes,
                            'environment':environment,'evidencePath':path,'findings':findings})
            return path
        review('rights','Project-owned original references, public terms and downstream notice inspected. Owner and release decisions remain pending.',{
            'licenseIds':rights['licenseIds'],'permitsCommercialReuse':True,'permitsRedistribution':True,'permitsModification':True,
            'noticeHashes':[sha(p) for p in rights['noticePaths']],'termsHashes':[sha(NOTICE)],'permissionHashes':[sha(NOTICE)],
            'referenceHashes':sorted(set(h for e in events for h in e['referenceHashes'])),'sourceUrls':URLS})
        stats=[x for x in pixels['decodedFiles'] if x['path'] in list(map(str,allpaths))]
        assert set(x['path'] for x in stats)==set(map(str,allpaths))
        review('structure','Raw sources, registered master and WebP reopened. Export geometry, channels and straight alpha verified by scanning the decoded pixels.',{
            'decodedPixelReport':str(ev/'pixels.json'),'artifacts':stats,
            'masterToExport':next(x for x in pixels['sourceToExportComparisons'] if x['role']==role)})
        reopen=review('source-reopen','A separate process decoded and hashed each preserved source. Firefox decoded the room WebPs and cast at all review sizes.',{
            'reports':[str(ev/'pixels.json'),str(ev/'browser.json')],'inspector':str(SRC/'T118/inspect.py')})
        review('visual',OBSERVATIONS[rid][n],{'methods':['image-inspection'],'tool':'view_image with light/dark matte sheets and Firefox screenshots',
            'observedPaths':list(map(str,allpaths)),'captures':[str(ev/'alpha-mattes.jpg')]+[c['screenshot'] for c in browser['captures']],
            'scope':'Standalone registered composition and source comparison, agent review.'})
        pending=review('browser-comparison','Standalone Firefox compositions decoded and were visually inspected. Game interaction and final model lighting await T137/T138.',{
            'scope':'Pending actual game and owner acceptance; the standalone cast is a Blender reference.'},'pending')
        manifest['assets'].append({'assetId':aid,'semanticIdentity':'spec001:LAYER-'+prefix,'kind':'scene-layer','status':'exported',
            'countsTowardQuota':False,'interactiveOrEvidence':False,'variantOf':None,
            'derivedFrom':[] if role=='background' else ['spec001:ASSET-LAYER-'+rid+'-background'],
            'sources':[{'file':file(p),'role':r,'application':a,'version':v,'reopenEvidencePath':reopen} for p,(r,a,v) in path_roles.items()],
            'exports':[{'file':file(export),'mimeType':'image/webp','sourceHashes':[sha(master)],'tool':f'Pillow {PIL.__version__}',
                        'preset':'WebP quality 91, method 6, alpha quality 100, registered 1600x900 full frame','integrationEvidencePath':pending}],
            'production':events,'rights':rights,'usedBy':[],'verification':reviews,
            'image':{'width':1600,'height':900,'colorSpace':'sRGB interpretation','alpha':role!='background',
                     'cameraRecordPath':room['registration']['plannedCameraPath'],'registrationPath':str(registration),'layerRole':role}})
write(SRC/'rooms-05-08.json',manifest)
