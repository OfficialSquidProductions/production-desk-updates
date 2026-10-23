#!/usr/bin/env python3
"""Compile and exercise the real native updater's save gate."""
import subprocess
import os
import plistlib
from pathlib import Path
import tempfile
import xml.etree.ElementTree as ET
from macos_updates import ROOT, release_config, sparkle_distribution
from check_updater_launch import build_fixture

sparkle = sparkle_distribution(release_config())
with tempfile.TemporaryDirectory(prefix="production-desk-save-gate-") as temp:
    folder = Path(temp).resolve()
    # No engine is started by the save-gate fixture. Still package it under a
    # unique identity and verify Foundation routing before any native launch.
    app = build_fixture(folder, "http://127.0.0.1:1/unused.xml", sparkle, release_config(), "UpdaterSaveCheck.swift")
    home = folder / "home"
    home.mkdir()
    env = {**os.environ, "CFFIXED_USER_HOME": str(home)}
    probe = subprocess.check_output(["swift", "-module-cache-path", str(ROOT / ".cache/swift"), "-e",
        'import Foundation;let f=FileManager.default;print(f.homeDirectoryForCurrentUser.path);print((try f.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:false)).path)'], env=env, text=True).splitlines()
    assert [Path(value).resolve() for value in probe] == [home, home / "Library/Application Support"], probe
    info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
    assert info["CFBundleIdentifier"].startswith("org.squidproductions.productiondesk.update-qa.")
    assert info["SUFeedURL"] == "http://127.0.0.1:1/unused.xml"
    assert not (app / "Contents/Resources/runtime").exists()
    print("PREFLIGHT: save-gate test has unique identity, disposable home/preferences, no network or workspace backend", flush=True)
    subprocess.run([str(app / "Contents/MacOS/UpdateQA")], env=env, check=True)
subprocess.run(["python3", str(ROOT / "tools/check_updater_launch.py")], check=True)
subprocess.run(["python3", "-B", str(ROOT / "tools/check_updater_readiness.py")], check=True)
subprocess.run(["python3", "-B", str(ROOT / "tools/check_store_updater.py")], check=True)
feed = ROOT / "dist/updates/appcast.xml"
if feed.exists():
    config = release_config()
    ns = "http://www.andymatuschak.org/xml-namespaces/sparkle"
    item = next((item for item in ET.parse(feed).findall("./channel/item") if item.findtext("{%s}version" % ns) == config["build"]), None)
    if item is None:
        print("No signed update archive for this local build; updater save checks passed.")
        raise SystemExit(0)
    signature = item.find("enclosure").get("{%s}edSignature" % ns)
    signature_check = ROOT / ".cache/check-update-signature"
    subprocess.run(["swiftc", "-parse-as-library", "-module-cache-path", str(ROOT / ".cache/swift"),
                    str(ROOT / "tests/UpdaterSignatureCheck.swift"), "-o", str(signature_check)], check=True)
    subprocess.run([str(signature_check), config["public_key"], signature,
                    str(ROOT / "dist/updates" / ("Production-Desk-" + config["version"] + "-" + config["build"] + ".zip"))], check=True)
