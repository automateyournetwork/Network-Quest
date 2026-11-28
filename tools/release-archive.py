# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Write and verify the portable regular-file-only Network Quest distribution."""
import argparse
import gzip
import hashlib
import os
import stat
import tarfile
from pathlib import Path

CHECKSUMS = "SHA256SUMS"


def inventory(root):
    rows = []
    for directory, children, names in os.walk(root, followlinks=False, onerror=raise_error):
        for entry in children:
            if (Path(directory) / entry).is_symlink():
                raise ValueError("Symlink directory in package")
        for name in names:
            path = Path(directory) / name
            if not stat.S_ISREG(path.lstat().st_mode):
                raise ValueError("Non-regular package entry")
            relative = path.relative_to(root).as_posix()
            if any(ord(char) < 32 or char == '\\' for char in relative):
                raise ValueError("Invalid package entry")
            rows.append(relative)
    return sorted(rows)


def raise_error(error):
    raise error


def checksum_ledger(root, paths):
    lines = []
    for name in paths:
        if name != CHECKSUMS:
            with (root / name).open("rb") as data:
                digest = hashlib.file_digest(data, "sha256").hexdigest()
            lines.append(f"{digest}  {name}\n")
    return "".join(lines).encode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["create", "verify"])
    parser.add_argument("stage", type=Path)
    parser.add_argument("archive", type=Path, nargs="?")
    args = parser.parse_args()
    if not args.stage.is_dir() or args.stage.is_symlink():
        parser.error("Use a real extracted package directory")
    paths = inventory(args.stage)
    ledger = checksum_ledger(args.stage, paths)
    ledger_path = args.stage / CHECKSUMS
    if args.operation == "verify":
        if args.archive or not ledger or ledger_path.read_bytes() != ledger:
            raise ValueError("Extracted file set or SHA-256 differs")
        print(f"Verified {len(paths)-1} package entries")
        return
    if not args.archive or args.archive.resolve().is_relative_to(args.stage.resolve()):
        parser.error("Supply a new archive outside the source")
    ledger_path.write_bytes(ledger)
    with args.archive.open("xb") as raw, gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=6, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w|", format=tarfile.PAX_FORMAT) as package:
            for name in sorted((set(paths) | {CHECKSUMS})):
                path = args.stage / name
                info = tarfile.TarInfo(name)
                info.mode = 0o644
                info.size = path.stat().st_size
                with path.open("rb") as source:
                    package.addfile(info, source)


if __name__ == "__main__":
    main()
