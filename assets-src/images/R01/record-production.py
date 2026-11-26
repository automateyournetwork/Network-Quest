#!/usr/bin/env python3
# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Bind the observed T064 invocations/reviews to current files; no image generation."""
from pathlib import Path
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parents[3]
BASE = Path('assets-src/images/R01')
EVIDENCE = Path('docs/evidence/spec001/assets')
DATE = '2026-11-26'
ACTOR = 'Codex agent loop069/T064'
ENV = 'macOS 26.6.2 arm64; built-in OpenAI imagegen; Pillow 12.1.0; Firefox 159.0 via Playwright 1.65.1'


def read(path):
    return json.loads((ROOT / path).read_text())


def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def write(path, value):
    (ROOT / path).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / path).write_text(json.dumps(value, indent=2) + '\n')


def file_record(path):
    return {'path': str(path), 'sha256': digest(path),
            'bytes': (ROOT / path).stat().st_size, 'format': Path(path).suffix[1:]}


def record(role, suffix, kind, hashes, status, details, check=None):
    path = EVIDENCE / f't064-R01-{role}-{suffix}.json'
    data = {'type': kind, 'assetId': f'spec001:ASSET-LAYER-R01-{role}',
            'hashes': sorted(set(hashes)), 'status': status, 'actor': 'agent',
            'reviewer': ACTOR, 'date': DATE, 'environment': ENV, 'details': details}
    if check:
        data['check'] = check
    write(path, data)
    return str(path)


stats = read(BASE / 'pixel-inspection.json')['files']
observations = read(BASE / 'native-review-observations.json')
camera = read(BASE / 'reference-inputs/camera-v3.json')
registration = read(BASE / 'reference-inputs/registration-v3.json')
previous = read(BASE / 'reference-inputs/registration-v1.json')
assert previous['anchors'] == registration['anchors']
assert read(BASE / 'reference-inputs/registration-v2.json')['anchors'] == registration['anchors']
shutil.copyfile(ROOT / BASE / 'reference-inputs/camera-v3.json', ROOT / BASE / 'camera.json')
shutil.copyfile(ROOT / 'LICENSE-ASSETS', ROOT / BASE / 'CC-BY-4.0.txt')

write(BASE / 'registration.json', {
    **registration,
    'status': 'exported candidates; T066 integration and T067 owner review pending',
    'cameraRecordPath': str(BASE / 'camera.json'),
    'cameraRecordSha256': digest(BASE / 'camera.json'),
    'sourcePixelSize': [1672, 941], 'sourceAspect': 1672 / 941,
    'cameraPlaneSize': [16, 9],
    'pixelAspectMapping': 'Full normalized canvas stretched to the 16 by 9 camera plane, horizontal factor 1.0005316321105793 relative to square source pixels; no crop/resample of files.',
    'resizing': 'heightSpan=max(9,13/aspect); widthSpan=heightSpan*aspect; plate width=viewportWidth*16/widthSpan; plate height=viewportHeight*9/heightSpan; centered. See actual review.html.',
    'planes': [
        {'role': 'background', 'order': 0, 'placement': 'camera-aligned backdrop behind all geometry', 'alpha': False},
        {'role': 'midground', 'order': 1, 'placement': 'camera-aligned behind focal geometry; no independent parallax', 'alpha': True},
        {'role': '3D-focal-reference', 'order': 2, 'placement': 'actual registered Blender source render for this review only; replace with real-time set in T066'},
        {'role': 'foreground', 'order': 3, 'placement': 'camera-aligned outer-corner overlay; no independent parallax', 'alpha': True},
    ],
    'alpha': 'Preserved original unassociated PNG alpha; browser source-over blend; no baked matte. No manual mask or cleanup.',
    'occlusion': 'No generated layer owns semantic hotspots. Sparse corner foreground does not visually cover the source set; sampled pivot margins are documented separately, not claimed as complete silhouette/target acceptance.',
    'depthMasks': [],
    'projectionCheck': {'method': 'Native Firefox observed plate rectangles compared against independent Three.js OrthographicCamera projection of the Blender anchors',
                        'maximumDeltaCssPixels': max(c['maxAnchorDeltaPixels'] for c in observations['captures']),
                        'scope': 'numeric projection agreement only, not artist-drawn landmark accuracy or gameplay acceptance'},
    'referenceSnapshots': [file_record(BASE / f'reference-inputs/blender-staging-v{v}.png') for v in [1, 2, 3]],
    'finalSourceRebuild': 'camera-v3/registration-v3 record T063 final native-source fingerprint after rebuild. Anchor arrays match v1/v2 exactly. The final v3 PNG has a different file hash and at most one RGB level difference from v2; alpha arrays are identical. See actual reference-v2-v3-comparison.json. Invocation inputs remain their preserved v1/v2 snapshots.',
    'captures': [{k: c[k] for k in ['name', 'viewport', 'screenshot', 'registration', 'maxAnchorDeltaPixels']} for c in observations['captures']],
})

manifest = {'schemaVersion': 1, 'episodeId': 'spec001', 'assets': []}
for role, stat in zip(['background', 'midground', 'foreground'], stats):
    raw = BASE / f'originals/{role}-v1.png'
    export = Path(f'public/assets/images/R01/{role}.png')
    assert digest(raw) == digest(export)
    reference_paths = [BASE / 'reference-inputs/blender-staging-v1.png'] if role == 'background' else [BASE / 'originals/background-v1.png', BASE / 'reference-inputs/blender-staging-v2.png']
    settings_path = BASE / f'{role}-v1.settings.json'
    prompt_path = BASE / f'{role}-v1.prompt.txt'
    returned = read(BASE / f'{role}-v1.tool-return.json')
    write(settings_path, {
        'eventId': returned['eventId'], 'tool': 'OpenAI image_gen__imagegen',
        'transparent_background': role != 'background',
        'referenced_image_paths': [str(p) for p in reference_paths],
        'pathResolution': 'Actual tool arguments used absolute workspace paths obtained by prepending the repository root to these exact preserved paths.',
        'promptPath': str(prompt_path), 'promptSha256': digest(prompt_path),
        'modelRevision': 'not-exposed', 'toolVersion': 'not-exposed', 'seed': 'not-exposed',
        'requestedDimensionsInPrompt': [2048, 1152] if role == 'background' else [1672, 941],
        'observedDimensions': [stat['width'], stat['height']],
        'returnedMetadataKeys': ['image_url', 'output_hint'], 'pngMetadataKeys': stat['metadataKeys'],
        'startedUtc': returned['startedUtc'], 'completedUtc': returned['completedUtc'],
        'fallbackUsed': False,
    })
    production = {
        'method': 'openai-generated', 'tool': 'OpenAI image_gen__imagegen',
        'version': 'not-exposed', 'modelRevision': 'not-exposed',
        'eventId': returned['eventId'], 'settingsPath': str(settings_path),
        'promptOrScriptPath': str(prompt_path), 'referenceHashes': [digest(p) for p in reference_paths],
        'outputHashes': [digest(raw)],
        'notes': 'Actual built-in imagegen invocation; output displayed with generatedImage, copied from the reported Codex generated_images artifact. Originals retained. Unknown model/seed remain not-exposed; exact original PNG exported unchanged. Alpha layers are separate own-background-derived generations. No pixel edits.',
    }
    source_paths = [raw] + reference_paths
    hashes = sorted(set(digest(p) for p in source_paths + [export]))
    production_path = record(role, 'production', 'production', hashes, 'passed', {
        **production, 'settingsSha256': digest(settings_path), 'promptSha256': digest(prompt_path),
        'toolReturnPath': str(BASE / f'{role}-v1.tool-return.json'),
        'toolReturnSha256': digest(BASE / f'{role}-v1.tool-return.json'),
        'returnedArtifact': returned['outputHint'], 'rawFile': file_record(raw),
        'startedUtc': returned['startedUtc'], 'completedUtc': returned['completedUtc'],
        'scope': 'Actual production and copied bytes verified; does not mean asset/owner acceptance',
    })
    findings = ('Opaque painterly basalt/copper shaft with cool teal depth and calm staging center; no duplicated foreground props or baked text.' if role == 'background'
                else 'Sparse copper/insulated upper arches; genuine alpha, clear central stage. Fifteen central-region pixels retain alpha 1/255; no cleanup claimed.' if role == 'midground'
                else 'Sparse insulated rail ends in bottom corners; genuine alpha leaves landing/exit visible. Thirty-four central-region pixels retain alpha 1/255; no cleanup claimed.')
    verification = []
    for check, details in [
        ('structure', {'findings': 'Actual PNG decoding, dimensions, channels, alpha statistics and exact source/export SHA-256 equality passed.', 'pixels': stat, 'export': file_record(export), 'scope': 'image structure, not whole-room performance'}),
        ('source-reopen', {'findings': 'Fresh Pillow process decoded original sources and references/exports; actual image inspection and Firefox re-opened the exported files.', 'commands': ['.runtime/media/ACE-Step-1.5/.venv/bin/python assets-src/images/R01/inspect-pixels.py [original PNG paths]', '.runtime/media/ACE-Step-1.5/.venv/bin/python assets-src/images/R01/inspect-pixels.py [reference and public PNG paths]', '.runtime/node-v26.13.1-darwin-arm64/bin/node assets-src/images/R01/review-native.mjs'], 'reports': [str(BASE/'pixel-inspection.json'), str(BASE/'source-export-reopen.json'), str(BASE/'native-review-observations.json')]}),
        ('visual', {'findings': findings + ' Standalone native composition and light/dark matte captures inspected by agent. T066 game and T067 owner reviews remain pending.', 'methods': ['image-inspection'], 'tool': 'view_image and native Firefox screenshots via Playwright', 'observedPaths': [str(p) for p in source_paths + [export]], 'captures': [c['screenshot'] for c in observations['captures']], 'projectionScope': 'Frame transform is registered; no invented exact generated geometry landmarks.'}),
    ]:
        evidence_path = record(role, check, 'review', hashes, 'passed', details, check)
        verification.append({'check': check, 'status': 'passed', 'reviewer': ACTOR, 'date': DATE, 'hashes': hashes, 'environment': ENV, 'evidencePath': evidence_path, 'findings': details['findings']})
    pending = record(role, 'integration-pending', 'review', hashes, 'pending', {'findings': 'Only standalone layer/source composition was observed. Actual T066 game integration, hotspot selection, source/GLB/browser parity and T067 owner/performance acceptance remain pending.'}, 'browser-comparison')
    verification.append({'check': 'browser-comparison', 'status': 'pending', 'reviewer': ACTOR, 'date': DATE, 'hashes': hashes, 'environment': ENV, 'evidencePath': pending, 'findings': 'Actual game integration deferred to T066; standalone composition is not runtime acceptance.'})
    rights = {
        'reviewStatus': 'pending', 'creators': ['John Capobianco (project direction and original reference work)', 'OpenAI image generation; Codex-assisted production'],
        'licenseIds': ['CC-BY-4.0'],
        'noticePaths': [str(BASE/'NOTICE.md'), str(BASE/'CC-BY-4.0.txt')],
        'sourceUrls': ['https://openai.com/policies/terms-of-use/', 'https://openai.com/policies/services-agreement/', 'https://openai.com/policies/service-terms/'],
        'termsSnapshotPaths': [str(BASE/'terms-review-2026-11-26.md')],
        'inputPermissionPaths': [str(BASE/'input-permissions.md')],
        'aiDisclosure': 'Image pixels generated by the actual OpenAI built-in image tool. Project-controlled rights only; no exclusive copyright or third-party clearance guarantee. Exact model revision not exposed.',
    }
    record(role, 'rights', 'rights', hashes, 'passed', {
        'scope': 'Agent public terms/input provenance review; canonical acceptance remains pending coordinator/owner review.',
        'licenseIds': rights['licenseIds'], 'permitsCommercialReuse': True, 'permitsRedistribution': True, 'permitsModification': True,
        'qualification': 'Only project-controlled rights to the extent permitted by law and provider terms; no exclusive copyright, custom entitlement or noninfringement guarantee.',
        'noticeHashes': [digest(p) for p in rights['noticePaths']], 'termsHashes': [digest(p) for p in rights['termsSnapshotPaths']],
        'permissionHashes': [digest(p) for p in rights['inputPermissionPaths']], 'referenceHashes': production['referenceHashes'],
        'sourceUrls': rights['sourceUrls'],
    }, 'rights')
    manifest['assets'].append({
        'assetId': f'spec001:ASSET-LAYER-R01-{role}', 'semanticIdentity': f'spec001:LAYER-R01-{role}',
        'kind': 'scene-layer', 'status': 'exported', 'countsTowardQuota': False,
        'interactiveOrEvidence': False, 'variantOf': None,
        'derivedFrom': [] if role == 'background' else ['spec001:ASSET-LAYER-R01-background'],
        'sources': [{'file': file_record(p), 'role': 'raw-generation' if p == raw else 'reference', 'application': 'OpenAI image_gen__imagegen' if 'originals' in p.parts else 'Blender', 'version': 'not-exposed' if 'originals' in p.parts else '5.2.1', 'reopenEvidencePath': str(EVIDENCE/f't064-R01-{role}-source-reopen.json')} for p in source_paths],
        'exports': [{'file': file_record(export), 'mimeType': 'image/png', 'sourceHashes': [digest(raw)], 'tool': 'Python shutil.copyfile', 'preset': 'byte-for-byte original PNG; no pixel edits/crop/resampling', 'integrationEvidencePath': pending}],
        'production': [production], 'rights': rights, 'usedBy': [], 'verification': verification,
        'image': {'width': stat['width'], 'height': stat['height'], 'colorSpace': 'sRGB browser interpretation; no embedded profile', 'alpha': stat['hasAlphaChannel'], 'cameraRecordPath': str(BASE/'camera.json'), 'layerRole': role, 'registrationPath': str(BASE/'registration.json')},
    })
write(BASE / 'manifest-candidates.json', manifest)
print(json.dumps({'candidateAssets': len(manifest['assets']), 'exportBytes': sum(a['exports'][0]['file']['bytes'] for a in manifest['assets']), 'acceptedQuotaCount': 0}, indent=2))
