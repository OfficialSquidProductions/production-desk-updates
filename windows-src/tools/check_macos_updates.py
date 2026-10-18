#!/usr/bin/env python3
"""Compile and exercise the real native updater's save gate."""
import subprocess
import xml.etree.ElementTree as ET
from macos_updates import ROOT, release_config, sparkle_distribution

sparkle = sparkle_distribution(release_config())
binary = ROOT / ".cache/check-updater-save"
subprocess.run(["swiftc", "-module-cache-path", str(ROOT / ".cache/swift"), "-F", str(sparkle),
                "-framework", "Sparkle", "-Xlinker", "-rpath", "-Xlinker", str(sparkle),
                str(ROOT / "desktop/Updates.swift"), str(ROOT / "tests/UpdaterSaveCheck.swift"),
                "-o", str(binary)], check=True)
subprocess.run([str(binary)], check=True)
subprocess.run(["python3", str(ROOT / "tools/check_updater_launch.py")], check=True)
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
