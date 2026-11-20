#!/usr/bin/env python3
"""Build a deterministic Linux newc initramfs using the five downloaded Alpine APKs."""
import gzip
import io
import os
from pathlib import Path
import stat
import sys
import tarfile

assets = Path(sys.argv[1])
target = Path(sys.argv[2])
here = Path(__file__).resolve().parent
entries = {}
for pkg in ("musl", "musl-dev", "tcc", "tcc-dev", "tcc-libs"):
    data = gzip.decompress((assets / (pkg + ".apk")).read_bytes())
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:", ignore_zeros=True) as tar:
        for member in tar:
            name = member.name.rstrip("/")
            if name.split("/")[0] not in ("lib", "usr") or name == "usr/lib/libc.a":
                continue
            if member.isdir():
                mode, contents = stat.S_IFDIR | 0o755, b""
            elif member.issym():
                mode, contents = stat.S_IFLNK | 0o777, member.linkname.encode()
            elif member.isfile():
                mode, contents = stat.S_IFREG | (member.mode & 0o777), tar.extractfile(member).read()
            else:
                raise ValueError(name)
            entries[name] = (mode, contents)
entries["usr/lib/i386-linux-gnu"] = (stat.S_IFDIR | 0o755, b"")
for crt in ("crt1", "crti", "crtn", "Scrt1"):
    entries["usr/lib/i386-linux-gnu/" + crt + ".o"] = (stat.S_IFLNK | 0o777, ("../" + crt + ".o").encode())
for name, mode in (("guest-init", 0o755), ("supervise.c", 0o644)):
    entries[name] = (stat.S_IFREG | mode, (here / name).read_bytes())

archive = io.BytesIO()
def pad():
    archive.write(b"\0" * (-archive.tell() % 4))
def write_entry(index, name, mode, data):
    path = name.encode() + b"\0"
    fields = [index, mode, 0, 0, 1, 0, len(data), 0, 0, 0, 0, len(path), 0]
    archive.write(("070701" + "".join(f"{v:08x}" for v in fields)).encode() + path)
    pad()
    archive.write(data)
    pad()
for i, (name, (mode, data)) in enumerate(sorted(entries.items()), 1):
    write_entry(i, name, mode, data)
write_entry(0, "TRAILER!!!", 0, b"")
target.write_bytes(gzip.compress(archive.getvalue(), compresslevel=9, mtime=0))
