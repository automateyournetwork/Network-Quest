#!/usr/bin/env python3
# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Build or verify the public, on-demand Spec001 media credits and distribution notices."""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from functools import cache
from html import escape
from pathlib import Path
from urllib.parse import quote, urlsplit
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = 'https://github.com/automateyournetwork/Network-Quest'
MEDIA_REVISION = '33db08b7ba26cdcbcac5460229f8cf484c7db5e8'
PUBLIC = Path('public/credits')
MEDIA = Path('assets-src/manifest.json')
REFERENCE = 'public/assets/models/R01.glb'
BROWSER_PACKAGES = {'ajv', 'ajv-formats', 'fast-deep-equal', 'three'}
INJECTED_PACKAGES = {'vite', 'rolldown'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_json(path):
    return json.loads(Path(path).read_bytes())


@cache
def digest(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def checked_file(path, roots):
    file = Path(path)
    require(file.as_posix() == path and not file.is_absolute() and '..' not in file.parts
            and (file.parts[0] in roots or path in roots)
            and not any(p.startswith('.') for p in file.parts), f'Unexpected public path {path}')
    require(file.resolve() == ROOT / file and file.is_file(), f'Expected ordinary project file {path}')
    return file


def project_link(path, label):
    url = f'{REPOSITORY}/blob/{MEDIA_REVISION}/{quote(path)}'
    return f'<a href="{escape(url)}">{escape(label)}</a>'


def rights_record(asset, public_links):
    rights = asset['rights']
    evidence, = [v for v in asset['verification'] if v['check'] == 'rights']
    path = evidence['evidencePath']
    require(path.startswith('docs/evidence/spec001/'), path)
    record = read_json(checked_file(path, {'docs'}))
    files = [row['file'] for row in asset['sources'] + asset['exports']]
    hashes = {row['sha256'] for row in files}
    require(record['type'] == 'rights' and record['assetId'] == asset['assetId']
            and record['status'] == evidence['status'] == 'passed'
            and rights['reviewStatus'] == 'accepted'
            and set(record['hashes']) == set(evidence['hashes']) == hashes, f'Rights evidence differs: {path}')
    details = record['details']
    require(set(rights['licenseIds']) == set(details['licenseIds'])
            and all(details[key] is True for key in
                    ('permitsModification', 'permitsRedistribution', 'permitsCommercialReuse')), path)
    public_links.add(path)
    for field, key in [('noticePaths', 'noticeHashes'), ('termsSnapshotPaths', 'termsHashes'),
                       ('inputPermissionPaths', 'permissionHashes')]:
        paths = rights[field]
        actual = {digest(checked_file(p, {'assets-src', 'LICENSE', 'LICENSE-ASSETS', 'NOTICE'})) for p in paths}
        require(actual == set(details[key]), f'Changed {field} in {path}')
        public_links.update(paths)
    return path


def media_register(public_links):
    manifest = read_json(MEDIA)
    assets = manifest['assets'] + manifest['additionalRenditions']
    sections = defaultdict(list)
    exports = set()
    public_links.update([MEDIA.as_posix(), 'docs/source-retrieval.md'])
    for asset in assets:
        credit = asset['rights']
        evidence = rights_record(asset, public_links)
        id_ = asset['assetId'].removeprefix('spec001:ASSET-')
        title = id_
        rows = []
        for output in asset['exports']:
            file = output['file']
            path = file['path']
            require(path.startswith('public/assets/'), path)
            ordinary = checked_file(path, {'public'})
            require(ordinary.stat().st_size == file['bytes'] and digest(ordinary) == file['sha256'], path)
            exports.add(path)
            rows.append(escape(path.removeprefix('public/assets/')))
        if asset in manifest['additionalRenditions']:
            title += ' · alternate rendition'
        source_list = []
        for source in asset['sources']:
            file = source['file']
            require(file['path'].startswith(('assets-src/', 'docs/evidence/spec001/')), file['path'])
            checked_file(file['path'], {'assets-src', 'docs'})
            public_links.add(file['path'])
            source_list.append(project_link(file['path'], f"{source['role']} · {Path(file['path']).name}"))
        notices = [project_link(p, p) for p in dict.fromkeys(
            credit['noticePaths'] + credit['termsSnapshotPaths'] + credit['inputPermissionPaths'])]
        for url in credit['sourceUrls']:
            parsed = urlsplit(url)
            require(parsed.scheme == 'https' and parsed.netloc in {'openai.com', 'huggingface.co', 'github.com'}
                    and not parsed.query and not parsed.fragment, 'Unexpected upstream media URL')
            notices.append(f'<a href="{escape(url)}">{escape(url)}</a>')
        notices.append(project_link(evidence, 'Verified rights, terms and input permissions'))
        sections[asset['kind']].append('\n'.join([
            f'<details><summary>{escape(title)} — {", ".join(rows)}</summary>',
            f'<p>{escape(" · ".join(credit["creators"]))}</p>',
            f'<p>{escape(credit["aiDisclosure"])}</p>',
            f'<p>Recorded licenses (project and inputs): {escape(", ".join(credit["licenseIds"]))}</p>',
            '<p>Sources: ' + ' · '.join(source_list) + '</p>',
            '<p>Notices: ' + ' · '.join(notices) + '</p></details>']))
    # The artist retained a full R01 composition beside the live architecture export.
    full_path = read_json('assets-src/rooms/R01-placements.json')['fullSceneReferenceExportPath']
    full = checked_file(full_path, {'public'})
    parity = read_json('assets-src/rooms/R01-animation-parity.json')['exportStructure'][full.name]
    require(full_path == REFERENCE and digest(full) == parity['sha256'] and full.stat().st_size == parity['bytes'],
            'Arrival Lift reference export changed')
    exports.add(full_path)
    require(exports == {p.as_posix() for p in Path('public/assets').rglob('*') if p.is_file()},
            'Public media inventory differs from the credited files; inspect additions and removals.')
    public_links.update(['assets-src/rooms/T063-NOTICE.md', 'assets-src/rooms/R01.blend'])
    names = {'room-model':'Room architecture', 'character-model':'Character models', 'prop-model':'Props',
             'sprite-sheet':'Sprite sheets', 'scene-layer':'Room layers', 'portrait':'Portraits',
             'illustration':'Illustrations', 'music':'Music', 'ambience':'Room ambience',
             'effect':'Effects', 'voice':'Voices'}
    require(sections.keys() == names.keys(), 'Review changed media families')
    body = ['<!doctype html><html lang="en"><head><meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<title>Network Quest · Media credits and editable sources</title>',
            '<style>body{font:1.05rem/1.55 system-ui,sans-serif;max-width:56rem;margin:auto;padding:1rem;'
            'overflow-wrap:anywhere;color:#182720;background:#f8f6ef}a{color:#185443}summary{cursor:pointer;'
            'padding:.45rem 0}details{border-top:1px solid #aaa}a:focus-visible,summary:focus-visible{'
            'outline:3px solid #9b4218;outline-offset:2px}</style></head><body><main>',
            '<h1>Media credits and editable sources</h1><p>Network Quest — John Capobianco and contributors. '
            'Credit each named creator, link the project and its applicable license, and identify changes. '
            'CC BY 4.0 covers project-controlled creative work. Original scripts use Apache-2.0. '
            'Production software, weights and references retain their own terms.</p>',
            '<p>' + project_link('docs/source-retrieval.md', 'Download and verify editable media')
            + ' · ' + project_link(MEDIA.as_posix(), 'Full manifest, prompts and export lineage')
            + ' · <a href="notices.txt">Full license texts</a></p>',
            '<nav aria-label="Media families">' + ' · '.join(f'<a href="#{k}">{name}</a>' for k, name in names.items()) + '</nav>']
    for kind, name in names.items():
        body.extend([f'<h2 id="{kind}">{name}</h2>', *sections[kind]])
    body.extend(['<h2>Full Arrival Lift reference model</h2><p>models/R01.glb · John Capobianco and Network Quest. '
                 'Codex-assisted Blender construction. The reference composition contains the original architecture, '
                 'characters and props. Project-controlled media use CC BY 4.0. '
                 + project_link('assets-src/rooms/R01.blend', 'Editable room') + ' · '
                 + project_link('assets-src/rooms/T063-NOTICE.md', 'Source and export notice') + '</p>',
                 '</main></body></html>'])
    return '\n'.join(body) + '\n', len(assets), exports


def software_register():
    inventory = read_json('licenses/dependency-inventory.json')
    php_packages = {p['name']: p for p in read_json('server/vendor/composer/installed.json')['packages']}
    chunks = ['Network Quest — software and original-work notices\n'
              'Credit John Capobianco and contributors. Describe changes and preserve the applicable notice.\n'
              'https://github.com/automateyournetwork/Network-Quest\n'
              'Media attribution, sources and generation methods accompany this file in media.html.\n'
              'Project-controlled works use the following licenses. Dependencies keep their terms.']
    for file in ('NOTICE', 'LICENSE', 'LICENSE-ASSETS'):
        chunks += [file, Path(file).read_bytes().decode()]
    for ecosystem in ('npm', 'composer'):
        for package in inventory[ecosystem]:
            name = package['name']
            if package['dev'] and not (ecosystem == 'npm' and name in INJECTED_PACKAGES):
                continue
            if ecosystem == 'composer':
                scope = 'PHP service dependency'
                installed = Path('server/vendor') / name
                actual = php_packages[name]
                require(actual['version'] == package['version'] and actual['source'] == package['source'],
                        f'Installed Composer version differs: {name}')
                url = package['source']['url'] + ' @ ' + package['source']['reference']
            else:
                scope = ('Browser dependency' if name in BROWSER_PACKAGES else 'Emitted build helpers'
                         if name in INJECTED_PACKAGES else 'Production lock; contributor tooling')
                installed = Path(package['lockPath'])
                actual = read_json(installed / 'package.json')
                require(actual['name'] == name and actual['version'] == package['version']
                        and actual['license'] == package['license'], f'Installed npm package differs: {name}')
                url = package['archiveUrl']
            declared = package['license']
            chunks += [f'{name} {package["version"]} · {scope} · '
                       + (declared if isinstance(declared, str) else ', '.join(declared)), url]
            for row in package['notices']:
                source = checked_file(row['path'], {'licenses'})
                relative = Path(*source.parts[3:])
                copy = installed / relative
                require(digest(copy) == digest(source) == row['sha256'], f'Installed notice differs: {copy}')
                chunks += [relative.as_posix(), source.read_bytes().decode()]
    for source in read_json('licenses/runtime/sources.json'):
        file = checked_file(source['path'], {'licenses'})
        require(digest(file) == source['sha256'], file)
        chunks += [source['name'] + ' · ' + source['license'], source['use'], source['source'], file.read_bytes().decode()]
    require(Path('server/vendor/composer/LICENSE').read_bytes().strip()
            == Path('licenses/runtime/composer.txt').read_bytes().strip(), 'Composer autoloader notice differs')
    return '\n\n'.join(chunks) + '\n'


def verify_public(paths):
    url = f'https://api.github.com/repos/automateyournetwork/Network-Quest/git/trees/{MEDIA_REVISION}?recursive=1'
    with urlopen(url, timeout=45) as response:
        tree = json.load(response)
    require(tree['sha'] == MEDIA_REVISION and not tree['truncated'], 'Incomplete public source tree')
    blobs = {item['path']: item['sha'] for item in tree['tree'] if item['type'] == 'blob'}
    for path in sorted(paths):
        data = Path(path).read_bytes()
        oid = hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
        if path == 'docs/source-retrieval.md':
            # The link intentionally retrieves the historical guide at the media pin.
            require(path in blobs, 'Missing pinned retrieval guide')
        else:
            require(blobs.get(path) == oid, f'Public source link differs: {path}')
    print(f'Verified {len(paths) - 1} public blobs and the historical guide at {MEDIA_REVISION}.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true', help='update the two checked-in distribution artifacts')
    parser.add_argument('--public', action='store_true', help='compare linked local bytes with the anonymous immutable GitHub tree')
    args = parser.parse_args()
    os.chdir(ROOT)
    subprocess.run([sys.executable, 'tools/license-inventory.py'], check=True)
    public_links = set()
    media, count, exports = media_register(public_links)
    if args.public:
        verify_public(public_links)
    rendered = {'media.html': media.encode(), 'notices.txt': software_register().encode()}
    sensitive = re.compile(rb'/Users/|/root/loop|\.local/operator|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|'
                           rb'gh[pousr]_[A-Za-z0-9]{22,}|GOCSPX-[A-Za-z0-9_-]{15,}|ya29\.[A-Za-z0-9_-]{20,}')
    for name, data in rendered.items():
        require(not sensitive.search(data), f'Private path or credential pattern in {name}')
    if args.write:
        PUBLIC.mkdir(exist_ok=True)
    require(PUBLIC.resolve() == ROOT / PUBLIC and all(not p.is_symlink() for p in PUBLIC.iterdir()),
            'Credits directory must contain ordinary files')
    if args.write:
        for name, data in rendered.items():
            (PUBLIC / name).write_bytes(data)
    require({p.name for p in PUBLIC.iterdir()} == set(rendered), 'Unexpected public credits file')
    for name, data in rendered.items():
        require((PUBLIC / name).read_bytes() == data, f'Stale or edited public/credits/{name}')
    print(f'Verified {count} rights-backed renditions, {len(exports)} public media files and both credits registers.')


if __name__ == '__main__':
    main()
