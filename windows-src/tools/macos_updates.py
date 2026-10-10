"""Production Desk's offline Sparkle configuration and signed release packaging."""
import base64
import hashlib
import html
import json
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
from urllib.parse import urlparse, urljoin
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
SPARKLE_NS = "http://www.andymatuschak.org/xml-namespaces/sparkle"


def release_config():
    config = json.loads((ROOT / "desktop/release.json").read_text())
    if not re.fullmatch(r"\d+\.\d+\.\d+", config["version"]):
        raise ValueError("Release version must be major.minor.patch")
    if not re.fullmatch(r"[1-9]\d*", config["build"]):
        raise ValueError("Release build must be a positive, increasing integer")
    feed = urlparse(config["feed_url"])
    if feed.scheme != "https" or not feed.hostname or feed.username or feed.password or feed.query or feed.fragment or not feed.path.endswith("/appcast.xml"):
        raise ValueError("Set a permanent HTTPS appcast.xml URL")
    if len(base64.b64decode(config["public_key"], validate=True)) != 32:
        raise ValueError("Set Sparkle's 32-byte public key; never put a private key here")
    return config


def sparkle_distribution(config):
    path = ROOT / ".cache" / ("Sparkle-" + config["sparkle_version"])
    archive = ROOT / ".cache" / ("Sparkle-" + config["sparkle_version"] + ".tar.xz")
    if not archive.is_file() or hashlib.sha256(archive.read_bytes()).hexdigest() != config["sparkle_sha256"]:
        raise RuntimeError("Missing verified Sparkle download. Run python3 tools/fetch_sparkle.py once (internet required).")
    for relative in ["Sparkle.framework/Sparkle", "LICENSE", "bin/generate_appcast", "bin/sign_update"]:
        if not (path / relative).is_file():
            raise RuntimeError("Incomplete Sparkle distribution. Run python3 tools/fetch_sparkle.py.")
    return path


def updater_plist(config):
    return {
        "SUFeedURL": config["feed_url"], "SUPublicEDKey": config["public_key"],
        "SUEnableAutomaticChecks": True, "SUAutomaticallyUpdate": False,
        "SUEnableSystemProfiling": False, "SUScheduledCheckInterval": 86400,
        "SUVerifyUpdateBeforeExtraction": True,
    }


def build_update_release(app, config, notes=None):
    distribution = sparkle_distribution(config)
    public_key = subprocess.check_output([str(distribution / "bin/generate_keys"), "--account", config["keychain_account"], "-p"], text=True).strip()
    if public_key != config["public_key"]:
        raise ValueError("The update signing key does not match the public key trusted by installed apps")
    info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
    for name, expected in [("CFBundleIdentifier", "local.slate.filmscheduler"),
                           ("CFBundleShortVersionString", config["version"]),
                           ("CFBundleVersion", config["build"]),
                           ("SUFeedURL", config["feed_url"]), ("SUPublicEDKey", config["public_key"])]:
        if info.get(name) != expected:
            raise ValueError("Rebuild the app first: inconsistent " + name)
    output = ROOT / "dist/updates"
    output.mkdir(parents=True, exist_ok=True)
    feed = output / "appcast.xml"
    if feed.exists():
        previous = ET.parse(feed)
        builds = [int(n.text) for n in previous.findall(".//{%s}version" % SPARKLE_NS)]
        if builds and int(config["build"]) <= max(builds):
            raise ValueError("Increase desktop/release.json build before preparing another release; published versions are immutable.")
    name = "Production-Desk-" + config["version"] + "-" + config["build"]
    archive = output / (name + ".zip")
    if archive.exists():
        raise ValueError("This release archive already exists. Increase the release build rather than overwriting it.")
    subprocess.run(["codesign", "--verify", "--deep", "--strict", str(app)], check=True)
    subprocess.run(["ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", str(app), str(archive)], check=True)
    if notes:
        shutil.copyfile(notes, output / (name + ".html"))
    prefix = urljoin(config["feed_url"], "./")
    subprocess.run([str(distribution / "bin/generate_appcast"), "--account", config["keychain_account"],
                    "--download-url-prefix", prefix, "--maximum-versions", "1", "--maximum-deltas", "0", "--embed-release-notes",
                    "-o", str(feed), str(output)], check=True)
    validate_release(output, config, distribution)
    (output / "CNAME").write_text(urlparse(config["feed_url"]).hostname + "\n")
    (output / ".nojekyll").touch()
    write_download_page(output, config, archive.name)
    print("Signed update release ready: " + str(output), flush=True)


def write_download_page(output, config, archive_name):
    version = html.escape(config["version"])
    name = html.escape(archive_name, quote=True)
    template = (ROOT / "desktop/update-site.html").read_text()
    (output / "index.html").write_text(template.replace("{{VERSION}}", version).replace("{{ARCHIVE_NAME}}", name))


def validate_release(output, config, distribution):
    tree = ET.parse(output / "appcast.xml")
    matches = [item for item in tree.findall("./channel/item")
               if item.findtext("{%s}version" % SPARKLE_NS) == config["build"]]
    if len(matches) != 1:
        raise RuntimeError("The appcast must include this build exactly once")
    item = matches[0]
    if item.findtext("{%s}shortVersionString" % SPARKLE_NS) != config["version"]:
        raise RuntimeError("The update version does not match the app")
    enclosure = item.find("enclosure")
    archive_name = "Production-Desk-" + config["version"] + "-" + config["build"] + ".zip"
    if enclosure is None or enclosure.get("url") != urljoin(config["feed_url"], archive_name):
        raise RuntimeError("Incorrect update download URL")
    archive = output / archive_name
    if int(enclosure.get("length", "0")) != archive.stat().st_size:
        raise RuntimeError("Incorrect update archive length")
    signature = enclosure.get("{%s}edSignature" % SPARKLE_NS)
    if not signature:
        raise RuntimeError("Unsigned update rejected")
    subprocess.run([str(distribution / "bin/sign_update"), "--account", config["keychain_account"],
                    "--verify", str(archive), signature], check=True)
