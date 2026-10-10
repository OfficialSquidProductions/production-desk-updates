#!/usr/bin/env python3
"""Download the pinned official Sparkle release once; subsequent builds are offline."""
import hashlib
from pathlib import Path
import shutil
import tarfile
import tempfile
import urllib.request
from macos_updates import ROOT, release_config


def main():
    config = release_config()
    name = "Sparkle-" + config["sparkle_version"]
    cache = ROOT / ".cache"
    cache.mkdir(exist_ok=True)
    archive = cache / (name + ".tar.xz")
    if not archive.exists():
        url = "https://github.com/sparkle-project/Sparkle/releases/download/" + config["sparkle_version"] + "/" + archive.name
        with tempfile.TemporaryDirectory(dir=cache) as temp:
            download = Path(temp) / archive.name
            urllib.request.urlretrieve(url, download)
            if hashlib.sha256(download.read_bytes()).hexdigest() != config["sparkle_sha256"]:
                raise RuntimeError("Sparkle download checksum mismatch")
            shutil.move(str(download), archive)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != config["sparkle_sha256"]:
        raise RuntimeError("Sparkle download checksum mismatch")
    with tempfile.TemporaryDirectory(dir=cache) as temp:
        with tarfile.open(archive) as tar:
            for entry in tar.getmembers():
                if entry.name.startswith("/") or ".." in Path(entry.name).parts:
                    raise RuntimeError("Unsafe Sparkle archive path")
            tar.extractall(temp)
        destination = cache / name
        if destination.exists():
            shutil.rmtree(destination)
        shutil.move(temp, destination)
    print("Verified Sparkle framework ready for offline builds")


if __name__ == "__main__":
    main()
