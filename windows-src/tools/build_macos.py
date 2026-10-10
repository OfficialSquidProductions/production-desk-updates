#!/usr/bin/env python3
"""Build a self-contained, locally signed Production Desk.app and optional DMG, offline."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys
import tempfile
from macos_updates import release_config, sparkle_distribution, updater_plist, build_update_release

ROOT = Path(__file__).resolve().parent.parent

def run(*args):
    print("Running " + str(args[0]), flush=True)
    subprocess.run([str(x) for x in args], check=True)

def build(dmg=True, share=True, update_release=False, release_notes=None):
    config = release_config()
    sparkle = sparkle_distribution(config)
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    app = dist / "Production Desk.app"
    # Only replace generated build outputs; never touch the user's workspace.
    if app.exists(): shutil.rmtree(app)
    contents = app / "Contents"
    resources = contents / "Resources"
    runtime = resources / "runtime"
    macos = contents / "MacOS"
    frameworks = contents / "Frameworks"
    for path in [resources, runtime, macos, frameworks]: path.mkdir(parents=True, exist_ok=True)
    python_home = Path(sys.base_prefix)
    framework = python_home.parent.parent
    if framework.name != "Python3.framework":
        framework = Path("/Applications/Xcode.app/Contents/Developer/Library/Frameworks/Python3.framework")
    if not framework.exists(): raise RuntimeError("Build requires a local Python3.framework; no runtime is downloaded.")
    shutil.copytree(framework, frameworks / "Python3.framework", symlinks=True)
    shutil.copytree(sparkle / "Sparkle.framework", frameworks / "Sparkle.framework", symlinks=True)
    shutil.copy2(sparkle / "LICENSE", resources / "Sparkle-LICENSE.txt")
    for name in ["server.py", "film.py"]: shutil.copy2(ROOT / name, runtime / name)
    shutil.copytree(ROOT / "web", runtime / "web")
    (runtime / "tools").mkdir()
    run("swiftc", "-O", "-module-cache-path", ROOT / ".cache" / "swift", "-target", "arm64-apple-macos12.0", ROOT / "tools" / "extract_pdf.swift", "-o", runtime / "tools" / "extract_pdf")
    run("swiftc", "-O", "-module-cache-path", ROOT / ".cache" / "swift", "-target", "arm64-apple-macos12.0", "-F", frameworks, "-framework", "Sparkle", "-Xlinker", "-rpath", "-Xlinker", "@executable_path/../Frameworks", ROOT / "desktop" / "Slate.swift", ROOT / "desktop" / "Updates.swift", "-o", macos / "ProductionDesk")
    icon_helper = ROOT / ".cache" / "render-icon"
    run("swiftc", "-module-cache-path", ROOT / ".cache" / "swift", ROOT / "desktop" / "Icon.swift", "-o", icon_helper)
    iconset = ROOT / ".cache" / "ProductionDesk.iconset"
    run(icon_helper, iconset, ROOT / "web/assets/sp-logo.png")
    run("iconutil", "-c", "icns", iconset, "-o", resources / "ProductionDesk.icns")
    shutil.copy2(ROOT / "README.md", resources / "README.md")
    with open(contents / "Info.plist", "wb") as file:
        plistlib.dump({"CFBundleExecutable":"ProductionDesk", "CFBundleIdentifier":"local.slate.filmscheduler", "CFBundleName":"Production Desk", "CFBundleDisplayName":"Production Desk", "CFBundlePackageType":"APPL", "CFBundleShortVersionString":config["version"], "CFBundleVersion":config["build"], "CFBundleIconFile":"ProductionDesk.icns", "LSMinimumSystemVersion":"12.0", "NSHighResolutionCapable":True, "NSPrincipalClass":"NSApplication", "NSAppTransportSecurity":{"NSAllowsLocalNetworking":True}, "NSHumanReadableCopyright":"Production Desk — Local Film Scheduler. Bundled Python and Sparkle are covered by their included licenses.", **updater_plist(config)}, file)
    run("codesign", "--force", "--deep", "--sign", "-", "--timestamp=none", app)
    run("codesign", "--verify", "--deep", "--strict", app)
    python = frameworks / "Python3.framework/Versions/3.9/bin/python3.9"
    run(python, "-I", "-B", "-c", "import json, http.server, uuid, xml.etree.ElementTree; print('Bundled runtime verified')")
    run(python, "-E", "-s", "-B", runtime / "server.py", "--help")
    if dmg:
        stage = dist / "installer"
        if stage.exists(): shutil.rmtree(stage)
        stage.mkdir()
        shutil.copytree(app, stage / "Production Desk.app", symlinks=True)
        (stage / "Applications").symlink_to("/Applications", target_is_directory=True)
        (stage / "Install Production Desk.txt").write_text("Install Production Desk\n\n1. Drag Production Desk.app to Applications.\n2. Open Production Desk from Applications or Spotlight.\n3. To launch with one click, drag Production Desk to your Dock.\n\nNo Terminal, Python installation, account, or internet connection is required.\nProjects are stored in ~/Library/Application Support/Slate/.\nThis build is for Apple Silicon Macs running macOS 12 or newer.\nThis app is locally signed for personal use, not Apple-notarized for public distribution.\n", encoding="utf-8")
        image = dist / "Production-Desk-macOS.dmg"
        run("hdiutil", "create", "-ov", "-volname", "Production Desk", "-srcfolder", stage, "-format", "UDZO", image)
        run("hdiutil", "verify", image)
    if share: build_share_package(dist, app)
    if update_release: build_update_release(app, config, release_notes)
    print("Ready: " + str(app), flush=True)

def build_share_package(dist, app):
    app_info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
    version, build_number = app_info["CFBundleShortVersionString"], app_info["CFBundleVersion"]
    folder = dist / "Production Desk — Share"
    if folder.exists(): shutil.rmtree(folder)
    folder.mkdir()
    installer = folder / "Install Production Desk.app"
    contents = installer / "Contents"
    macos = contents / "MacOS"
    resources = contents / "Resources"
    macos.mkdir(parents=True)
    resources.mkdir()
    shutil.copytree(app, resources / "Production Desk.app", symlinks=True)
    shutil.copy2(app / "Contents/Resources/ProductionDesk.icns", resources / "ProductionDesk.icns")
    run("swiftc", "-O", "-module-cache-path", ROOT / ".cache/swift", "-target", "arm64-apple-macos12.0", ROOT / "desktop/Installer.swift", "-o", macos / "InstallProductionDesk")
    with open(contents / "Info.plist", "wb") as file:
        plistlib.dump({"CFBundleExecutable":"InstallProductionDesk", "CFBundleIdentifier":"local.productiondesk.installer", "CFBundleName":"Install Production Desk", "CFBundleDisplayName":"Install Production Desk", "CFBundlePackageType":"APPL", "CFBundleShortVersionString":version, "CFBundleVersion":build_number, "CFBundleIconFile":"ProductionDesk.icns", "LSMinimumSystemVersion":"12.0", "NSHighResolutionCapable":True, "NSPrincipalClass":"NSApplication"}, file)
    with tempfile.TemporaryDirectory(prefix="production-desk-installer-") as test_directory:
        run(macos / "InstallProductionDesk", "--self-test", test_directory, resources / "Production Desk.app")
    run("codesign", "--force", "--deep", "--sign", "-", "--timestamp=none", installer)
    run("codesign", "--verify", "--deep", "--strict", installer)
    (folder / "READ ME FIRST.txt").write_text("""PRODUCTION DESK {version} — MAC SHARE PACKAGE

INSTALL
Open Install Production Desk.app. It installs and launches Production Desk
automatically. No Terminal, Python installation, internet, or account is needed.
If updating, save your work and quit Production Desk before opening the installer.

The app is installed in your own ~/Applications folder, without an administrator
password. Find Production Desk there or in Spotlight. Drag it to the Dock for
one-click launches. You can discard this share folder after installation.

SHARE
Send the Production-Desk-Share-Mac.zip file to others. They should unzip it,
open the Production Desk — Share folder, and open Install Production Desk.app.
Keep the installer app intact: it contains the complete app and runtime.
No private scripts, projects, backups, or personal font files are included.
New users start with a fictional sample production; existing projects are preserved.

REQUIREMENTS
Apple Silicon (M1 or newer), macOS 12 or newer. This package does not support
Intel Macs or Windows. It is locally signed and is not Apple-notarized;
macOS may require approval on the first launch of a downloaded copy.

FIRST-LAUNCH HELP
If macOS says the developer cannot be verified, follow Apple's instructions:
https://support.apple.com/en-us/102445
After attempting to open the installer, trusted recipients can allow that app
in System Settings > Privacy & Security > Open Anyway. On macOS 12, look in
System Preferences > Security & Privacy. The installed Production Desk app
may also need its own first-launch approval. A managed work Mac may require IT.

FEATURES
Light/dark mode, local breakdowns, schedules, shots, and exports are included.
No account is needed.

TESTING AND BUG REPORTS
Email alexanderhosier@squidproductions.org with Production Desk {version}, your
macOS version, steps to reproduce the issue, expected behavior, and what
actually happened. Screenshots are helpful. The contact is also in Quick guide.

FONTS AND PRIVACY
The app works fully offline. Futura is used when installed; otherwise a system
font is used. Locally available Reross Quadratic and Courier Final Draft are
used when present, with Futura and Courier New fallbacks respectively.
Fonts from Adobe and Final Draft are not redistributed in this package.

Project files stay on each recipient's computer in:
~/Library/Application Support/Slate/
Use Export > Full Production Desk backup to transfer a project separately.
Updating or reinstalling replaces the app, not your project data.

APP UPDATES
Use Production Desk > Check for Updates… to check manually. The Updates menu
controls automatic checks and automatic download/installation. Downloaded
updates are verified before installation, and pending changes are saved before
restarting. The first update requires manually installing this version.
Automatic delivery is available at updates.squidproductions.org. Update checks
require internet; local scheduling still works offline. Users on 1.3.x need one
manual installation; users with the updater receive later releases in the app.
""".format(version=version), encoding="utf-8")
    archive = dist / "Production-Desk-Share-Mac.zip"
    if archive.exists(): archive.unlink()
    run("ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", folder, archive)
    # Confirm that only the installer and its instructions are included; no workspace files.
    import zipfile
    with zipfile.ZipFile(archive) as file:
        paths = file.namelist()
        if any(Path(path).name in {"workspace.json", "workspace.previous.json", "migration-source.txt"} for path in paths):
            raise RuntimeError("Unexpected project or migration file in the share archive")
    archive.with_suffix(".sha256").write_text(hashlib.sha256(archive.read_bytes()).hexdigest() + "  " + archive.name + "\n")
    print("Share: " + str(archive), flush=True)

if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--app-only", action="store_true")
    parser.add_argument("--no-share", action="store_true", help="Do not create duplicate share installers")
    parser.add_argument("--share-from", type=Path, help="Package an existing Mac app without rebuilding it")
    parser.add_argument("--update-release", action="store_true", help="Also prepare a signed app archive and appcast in dist/updates (requires update signing key in Keychain)")
    parser.add_argument("--release-notes", type=Path, help="HTML release notes to embed in the update feed")
    args = parser.parse_args()
    if args.share_from:
        build_share_package(ROOT / "dist", args.share_from)
    else:
        build(not args.app_only, not args.no_share, args.update_release, args.release_notes)
