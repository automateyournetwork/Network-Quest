"""Rebuild the Spec001 source index from an immutable, reviewed Git commit.

Print to stdout. Reads committed Git blobs only. SPDX-License-Identifier: Apache-2.0
"""
import hashlib
import json
from pathlib import PurePosixPath
import re
import subprocess
import sys


REPOSITORY = "https://github.com/automateyournetwork/Network-Quest"
MANIFEST = "assets-src/manifest.json"
INDEX = "assets-src/source-index.json"


def git(*args):
    return subprocess.check_output(["git", *args])


def tree(revision, paths):
    # A symlink or submodule can never supply a source file.
    entries = git("ls-tree", "-r", "-z", revision, "--", *paths).split(b"\0")
    files = {}
    for entry in filter(None, entries):
        header, name = entry.split(b"\t", 1)
        mode, kind, oid = header.decode("ascii").split()
        path = name.decode("utf-8")
        if mode not in ("100644", "100755") or kind != "blob":
            raise ValueError(f"Unexpected source tree entry: {path}")
        if path != INDEX:
            files[path] = oid
    return files


def manifest_sources(manifest):
    claims, memberships = {}, {}
    rows = manifest["assets"] + manifest["additionalRenditions"]
    for asset in rows:
        paths = set()
        for source in asset["sources"]:
            file = source["file"]
            path = file["path"]
            claim = (file["sha256"], file["bytes"])
            if claims.setdefault(path, claim) != claim:
                raise ValueError(f"Conflicting manifest declarations: {path}")
            paths.add(path)
        for step in asset["production"]:
            paths.update(step[key] for key in ("settingsPath", "promptOrScriptPath") if step.get(key))
        for key in ("noticePaths", "termsSnapshotPaths", "inputPermissionPaths"):
            paths.update(asset["rights"][key])
        for path in paths:
            # Supporting records elsewhere must be exact manifest paths in the public project.
            if not re.fullmatch(r"(?:assets-src|docs/evidence/spec001|content/spec001/presentation)/[A-Za-z0-9_./-]+|LICENSE(?:-ASSETS)?|NOTICE", path) or any(
                part.startswith(".") for part in PurePosixPath(path).parts
            ):
                raise ValueError(f"Unexpected manifest path: {path}")
            memberships.setdefault(path, set()).add(asset["assetId"])
    return claims, memberships


def digests(blobs):
    # One Git process, bounded memory, no staging, checkout, LFS filter or repository config changes.
    result = {}
    with subprocess.Popen(["git", "cat-file", "--batch"], stdin=subprocess.PIPE, stdout=subprocess.PIPE) as process:
        for oid in sorted(set(blobs.values())):
            process.stdin.write((oid + "\n").encode("ascii"))
            process.stdin.flush()
            name, kind, raw_size = process.stdout.readline().split()
            if name.decode("ascii") != oid or kind != b"blob":
                raise ValueError(f"Unavailable Git blob: {oid}")
            size = remaining = int(raw_size)
            digest = hashlib.sha256()
            while remaining:
                chunk = process.stdout.read(min(1024 * 1024, remaining))
                if not chunk:
                    raise OSError(f"Short Git blob: {oid}")
                digest.update(chunk)
                remaining -= len(chunk)
            if process.stdout.read(1) != b"\n":
                raise OSError(f"Malformed Git response: {oid}")
            result[oid] = (digest.hexdigest(), size)
        process.stdin.close()
        if process.wait() != 0:
            raise OSError("git cat-file failed")
    return result


def build(revision):
    if not re.fullmatch(r"[0-9a-f]{40}", revision) or git("cat-file", "-t", revision) != b"commit\n":
        raise ValueError("Supply a full, lowercase Git commit ID.")
    manifest = json.loads(git("show", f"{revision}:{MANIFEST}"))
    claims, memberships = manifest_sources(manifest)
    outside = sorted(p for p in memberships if not p.startswith("assets-src/"))
    blobs = tree(revision, ["assets-src", *outside])
    missing = memberships.keys() - blobs.keys()
    if missing:
        raise ValueError(f"Missing committed sources: {sorted(missing)}")
    hashes = digests(blobs)
    files = []
    for path, oid in sorted(blobs.items()):
        digest, size = hashes[oid]
        if path in claims and claims[path] != (digest, size):
            raise ValueError(f"Commit bytes differ from canonical manifest: {path}")
        row = {"path": path, "bytes": size, "sha256": digest}
        if path in memberships:
            row["assetIds"] = sorted(memberships[path])
        files.append(row)
    return {"schemaVersion": 1, "repository": REPOSITORY, "revision": revision, "manifest": MANIFEST,
            "primaryRecords": len(manifest["assets"]), "additionalRenditions": len(manifest["additionalRenditions"]),
            "declaredSourcePaths": len(claims), "files": files}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 tools/index-sources.py FULL_COMMIT_SHA")
    print(json.dumps(build(sys.argv[1]), indent=2, ensure_ascii=True))
