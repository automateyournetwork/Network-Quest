#!/usr/bin/env python3
"""Refresh or verify lock-based notices; never install or execute dependencies.

Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
Refresh downloads only absent npm packages' public archives, verifies their SRI,
reads notice files without extraction, then discards archive bytes. Composer must
already be installed. No private config or environment credentials are read.
"""

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'licenses/dependency-inventory.json'
LEGAL = re.compile(r'^(licen[cs]e|notice|copying|copyright|authors|third[-_]?party)', re.I)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    return json.loads(path.read_text())


def legal_file(name):
    p = PurePosixPath(name)
    return bool(LEGAL.match(p.name)) and p.suffix.lower() in ('', '.txt', '.md', '.rst')


def copy_notice(ecosystem, name, version, relative, data, origin):
    # Construct destinations only from validated relative paths, never tar extraction.
    relative = PurePosixPath(relative)
    assert not relative.is_absolute() and '..' not in relative.parts
    slug = name.replace('@', '').replace('/', '__') + '@' + version
    target = ROOT / 'licenses' / ecosystem / slug / str(relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return {'path': target.relative_to(ROOT).as_posix(), 'sha256': sha(data),
            'bytes': len(data), 'origin': origin}


def local_notices(path, ecosystem, name, version):
    return [copy_notice(ecosystem, name, version, p.relative_to(path).as_posix(),
                        p.read_bytes(), p.relative_to(ROOT).as_posix())
            for p in sorted(path.rglob('*')) if p.is_file() and legal_file(p.name)]


def npm_entry(pair):
    path, locked = pair
    name = path.split('node_modules/')[-1]
    version = locked['version']
    installed = (ROOT / path / 'package.json').exists()
    notices = []
    if installed:
        manifest = read_json(ROOT / path / 'package.json')
        assert manifest['name'] == name and manifest['version'] == version
        notices = local_notices(ROOT / path, 'npm', name, version)
        basis = 'installed package'
    else:
        url = locked['resolved']
        assert url.startswith('https://registry.npmjs.org/')
        data = urllib.request.urlopen(url, timeout=60).read()
        algorithm, expected = locked['integrity'].split('-', 1)
        actual = base64.b64encode(hashlib.new(algorithm, data).digest()).decode()
        assert actual == expected, f'integrity mismatch: {name}'
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            manifest = json.load(archive.extractfile('package/package.json'))
            assert manifest['name'] == name and manifest['version'] == version
            for member in archive.getmembers():
                if member.isfile() and legal_file(member.name):
                    relative = str(PurePosixPath(member.name).relative_to('package'))
                    notices.append(copy_notice('npm', name, version, relative,
                                               archive.extractfile(member).read(),
                                               url + '#' + member.name))
        basis = 'SRI-verified public archive; not installed'
    assert manifest.get('license') == locked['license'], f'license mismatch: {name}'
    if not notices and name.startswith('@rolldown/binding-'):
        # The native package omits notices; the exact-version wrapper ships them.
        wrapper = read_json(ROOT / 'node_modules/rolldown/package.json')
        assert wrapper['version'] == version and wrapper['license'] == locked['license']
        notices = local_notices(ROOT / 'node_modules/rolldown', 'npm', name, version)
        basis += '; notices from same-version rolldown wrapper'
    if not notices:
        for supplement in read_json(ROOT / 'licenses/supplemental-notices.json'):
            if (name, version) == (supplement['package'], supplement['version']):
                data = (ROOT / supplement['path']).read_bytes()
                assert sha(data) == supplement['sha256']
                notices.append(copy_notice('npm', name, version, Path(supplement['path']).name,
                                           data, supplement['url']))
                basis += '; pinned upstream notice from supplemental-notices.json'
    assert notices, f'no notice found: {name}'
    return {'name': name, 'version': version, 'lockPath': path,
            'license': locked['license'], 'dev': locked.get('dev', False),
            'optional': locked.get('optional', False), 'installed': installed,
            'archiveUrl': locked['resolved'], 'archiveIntegrity': locked['integrity'],
            'repository': manifest.get('repository'), 'noticeBasis': basis,
            'notices': sorted(notices, key=lambda n: n['path'])}


def refresh():
    npm_lock = read_json(ROOT / 'package-lock.json')
    with ThreadPoolExecutor(max_workers=4) as pool:
        npm = list(pool.map(npm_entry, ((p, v) for p, v in npm_lock['packages'].items() if p)))
    composer_lock = read_json(ROOT / 'server/composer.lock')
    composer = []
    for group in ('packages', 'packages-dev'):
        for package in composer_lock[group]:
            path = ROOT / 'server/vendor' / package['name']
            assert path.is_dir(), f'not installed: {package["name"]}'
            notices = local_notices(path, 'composer', package['name'], package['version'])
            assert notices, f'no notice found: {package["name"]}'
            composer.append({'name': package['name'], 'version': package['version'],
                             'license': package['license'], 'dev': group == 'packages-dev',
                             'source': package['source'], 'dist': package.get('dist'),
                             'noticeBasis': 'installed locked package', 'notices': notices})
    result = {'schemaVersion': 1, 'scope': 'Lock packages and shipped legal notices; not release acceptance',
              'locks': {p: sha((ROOT / p).read_bytes())
                        for p in ('package-lock.json', 'server/composer.lock')},
              'npm': sorted(npm, key=lambda p: p['name']),
              'composer': sorted(composer, key=lambda p: p['name'])}
    OUTPUT.write_text(json.dumps(result, indent=2) + '\n')
    write_index(result)
    verify()


def write_index(inventory):
    lines = ['# Locked dependency index', '',
             'Generated from `dependency-inventory.json`. Upstream notices keep their own licenses.',
             'See [the scope and retrieval instructions](../THIRD-PARTY-NOTICES.md).', '']
    for ecosystem in ('npm', 'composer'):
        lines += ['## ' + ecosystem, '',
                  '| Package | Version | Declared license | Scope | Preserved notices |',
                  '| --- | --- | --- | --- | --- |']
        for package in inventory[ecosystem]:
            scope = 'development' if package['dev'] else 'production'
            scope += '; optional' if package.get('optional') else ''
            label = package['license']
            label = label if isinstance(label, str) else ', '.join(label)
            links = ', '.join('[' + Path(n['path']).name + '](' +
                              n['path'].removeprefix('licenses/') + ')'
                              for n in package['notices'])
            lines.append('| ' + ' | '.join((package['name'], package['version'], label, scope, links)) + ' |')
        lines.append('')
    (ROOT / 'licenses/DEPENDENCIES.md').write_text('\n'.join(lines))


def verify():
    inventory = read_json(OUTPUT)
    for path, expected in inventory['locks'].items():
        assert sha((ROOT / path).read_bytes()) == expected, f'lock changed: {path}'
    npm_lock = read_json(ROOT / 'package-lock.json')['packages']
    expected_npm = {(p, v['version']) for p, v in npm_lock.items() if p}
    assert {(p['lockPath'], p['version']) for p in inventory['npm']} == expected_npm
    for package in inventory['npm']:
        locked = npm_lock[package['lockPath']]
        assert package['license'] == locked['license']
        assert package['archiveUrl'] == locked['resolved']
        assert package['archiveIntegrity'] == locked['integrity']
        assert package['dev'] == locked.get('dev', False)
        assert package['optional'] == locked.get('optional', False)
    lock = read_json(ROOT / 'server/composer.lock')
    assert {(p['name'], p['version']) for p in inventory['composer']} == {
        (p['name'], p['version']) for g in ('packages', 'packages-dev') for p in lock[g]}
    for package in inventory['composer']:
        group = 'packages-dev' if package['dev'] else 'packages'
        locked = next(p for p in lock[group] if p['name'] == package['name'])
        assert package['license'] == locked['license']
        assert package['source'] == locked['source'] and package['dist'] == locked.get('dist')
    count = 0
    for ecosystem in ('npm', 'composer'):
        for package in inventory[ecosystem]:
            assert package['license'] and package['notices']
            for notice in package['notices']:
                data = (ROOT / notice['path']).read_bytes()
                assert sha(data) == notice['sha256'] and len(data) == notice['bytes'], notice['path']
                count += 1
    print(f"PASS: {len(inventory['npm'])} npm, {len(inventory['composer'])} Composer packages; {count} notice copies; both lock hashes match")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='copy notices from installed/locked public packages')
    args = parser.parse_args()
    refresh() if args.refresh else verify()
