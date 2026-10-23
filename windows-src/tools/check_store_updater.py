#!/usr/bin/env python3
"""Compile the Store app and verify its updater policy without opening an editor."""
import os
from pathlib import Path
import plistlib
import subprocess
import tempfile
import uuid
from macos_updates import ROOT


def main():
    with tempfile.TemporaryDirectory(prefix="production-desk-store-updater-") as temp:
        folder = Path(temp).resolve()
        contents = folder / "Store Updater QA.app/Contents"
        (contents / "MacOS").mkdir(parents=True)
        info = {"CFBundleExecutable": "StoreUpdaterQA", "CFBundleIdentifier": "local.productiondesk.store-updater-qa." + uuid.uuid4().hex,
                "CFBundleName": "Store Updater QA", "CFBundleVersion": "1", "CFBundlePackageType": "APPL"}
        (contents / "Info.plist").write_bytes(plistlib.dumps(info))
        sources = [ROOT / "desktop" / name for name in ["Slate.swift", "StoreUpdates.swift", "StoreExports.swift"]]
        command = ["swiftc", "-parse-as-library", "-D", "APP_STORE", "-D", "SUPPORT_TESTING",
                   "-module-cache-path", str(ROOT / ".cache/swift"), *map(str, sources)]
        # Compile the real shipping entry point as well as the policy fixture.
        subprocess.run([*command, str(ROOT / "desktop/StoreMain.swift"), "-o", str(folder / "StoreCompileCheck")], check=True)
        binary = contents / "MacOS/StoreUpdaterQA"
        subprocess.run([*command, str(ROOT / "tests/StoreUpdaterPolicyCheck.swift"), "-o", str(binary)], check=True)
        for target in [folder / "StoreCompileCheck", binary]:
            linked = subprocess.check_output(["otool", "-L", str(target)], text=True)
            assert "Sparkle" not in linked, linked
        subprocess.run(["codesign", "--force", "--sign", "-", str(contents.parent)], check=True)
        home = folder / "home"
        home.mkdir()
        env = {**os.environ, "CFFIXED_USER_HOME": str(home)}
        probe = subprocess.check_output(["swift", "-module-cache-path", str(ROOT / ".cache/swift"), "-e",
            'import Foundation;let f=FileManager.default;print(f.homeDirectoryForCurrentUser.path);print((try f.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:false)).path)'], env=env, text=True).splitlines()
        assert [Path(value).resolve() for value in probe] == [home, home / "Library/Application Support"], probe
        assert info["CFBundleIdentifier"].startswith("local.productiondesk.store-updater-qa.")
        assert "SUFeedURL" not in info and not (contents / "Resources/runtime").exists()
        print("PREFLIGHT: unique Store QA identity, disposable storage/preferences, no Sparkle/feed or project backend", flush=True)
        subprocess.run([str(binary), str(home)], env=env, check=True, timeout=15)


if __name__ == "__main__":
    main()
