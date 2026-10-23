#!/usr/bin/env python3
"""Reproduce/test native startup with unique identities, disposable homes and loopback only."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import tempfile
from threading import Thread
import uuid
from macos_updates import ROOT, release_config, sparkle_distribution, updater_plist


class Fixture(BaseHTTPRequestHandler):
    requests = []

    def do_GET(self):
        self.requests.append(self.path)
        if self.path == "/appcast.xml":
            body = b'<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><item><title>Current</title><sparkle:version>23</sparkle:version><sparkle:shortVersionString>1.5.4</sparkle:shortVersionString><enclosure url="https://fixture.invalid/never-download.zip" length="1" type="application/octet-stream"/></item></channel></rss>'
            kind = "application/xml"
        else:
            script = "setTimeout(()=>{window.slateDesktop={ready:Promise.resolve(true)};window.fixtureReady=true;},450)"
            if self.path == "/delayed-promise":
                script = "window.slateDesktop={ready:new Promise(r=>setTimeout(()=>{window.fixtureReady=true;r(true)},450))}"
            elif self.path == "/rejected-promise":
                script = "window.slateDesktop={ready:Promise.reject(new Error('synthetic editor failure'))};setTimeout(()=>{window.slateDesktop.ready=Promise.resolve(true);window.fixtureReady=true},700)"
            elif self.path == "/probe-error":
                script = "Object.defineProperty(window,'slateDesktop',{configurable:true,get(){throw new Error('synthetic probe failure')}});setTimeout(()=>{delete window.slateDesktop;window.slateDesktop={ready:Promise.resolve(true)};window.fixtureReady=true},700)"
            elif self.path == "/navigation-retry":
                script = "window.slateDesktop={ready:new Promise(()=>{})}"
            body = ("<!doctype html><title>Synthetic readiness</title><script>" + script + "</script>").encode()
            kind = "text/html"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", help="Reproduce against unmodified native files from this commit")
    args = parser.parse_args()
    config = release_config()
    sparkle = sparkle_distribution(config)
    out = ROOT / "build/updater-startup-fix"
    out.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), Fixture)
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with tempfile.TemporaryDirectory(prefix="pd-ready-qa-", dir=out) as temp:
            folder = Path(temp).resolve()
            app = folder / "Readiness QA.app"
            contents = app / "Contents"
            (contents / "MacOS").mkdir(parents=True)
            (contents / "Frameworks").mkdir()
            shutil.copytree(sparkle / "Sparkle.framework", contents / "Frameworks/Sparkle.framework", symlinks=True)
            url = "http://127.0.0.1:" + str(server.server_port)
            identity = "local.productiondesk.updater-readiness-qa." + uuid.uuid4().hex
            info = {"CFBundleExecutable": "ReadinessQA", "CFBundleIdentifier": identity,
                    "CFBundleName": "Readiness QA", "CFBundlePackageType": "APPL", "CFBundleVersion": "23",
                    "CFBundleShortVersionString": "1.5.4", "NSPrincipalClass": "NSApplication",
                    "NSAppTransportSecurity": {"NSAllowsLocalNetworking": True},
                    **updater_plist(config), "SUFeedURL": url + "/appcast.xml"}
            (contents / "Info.plist").write_bytes(plistlib.dumps(info))
            sources = [ROOT / "desktop/Slate.swift", ROOT / "desktop/Updates.swift"]
            flags = []
            if args.baseline:
                flags = ["-D", "BASELINE_UPDATER"]
                sources = []
                for name in ["Slate.swift", "Updates.swift"]:
                    target = folder / name
                    target.write_bytes(subprocess.check_output(["git", "show", args.baseline + ":windows-src/desktop/" + name], cwd=ROOT))
                    sources.append(target)
            binary = contents / "MacOS/ReadinessQA"
            subprocess.run(["swiftc", "-parse-as-library", "-D", "SUPPORT_TESTING", *flags,
                            "-module-cache-path", str(ROOT / ".cache/swift"), "-F", str(sparkle), "-framework", "Sparkle",
                            "-Xlinker", "-rpath", "-Xlinker", "@executable_path/../Frameworks", *map(str, sources),
                            str(ROOT / "tests/UpdaterReadinessCheck.swift"), "-o", str(binary)], check=True)
            subprocess.run(["codesign", "--force", "--deep", "--sign", "-", str(app)], check=True)
            modes = ["missing-bridge"] if args.baseline else ["missing-bridge", "delayed-promise", "missed-navigation",
                "rejected-promise", "probe-error", "navigation-retry", "interrupted", "automatic-retry", "untrusted-origin", "quitting"]
            results = []
            for mode in modes:
                home = folder / ("home-" + mode)
                home.mkdir()
                env = {**os.environ, "CFFIXED_USER_HOME": str(home)}
                actual = subprocess.check_output(["swift", "-module-cache-path", str(ROOT / ".cache/swift"), "-e",
                    'import Foundation;let f=FileManager.default;print(f.homeDirectoryForCurrentUser.path);print((try f.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:false)).path)'], env=env, text=True).splitlines()
                assert [Path(value).resolve() for value in actual] == [home, home / "Library/Application Support"], actual
                assert info["CFBundleIdentifier"].startswith("local.productiondesk.updater-readiness-qa.")
                assert info["SUFeedURL"] == url + "/appcast.xml" and not (contents / "Resources/runtime").exists()
                Fixture.requests = []
                print("PREFLIGHT: unique identity, disposable Foundation storage/preferences, nonpersistent WebKit, loopback-only feed; no project backend", flush=True)
                value = subprocess.check_output([str(binary), url, str(home), mode], env=env, text=True,
                                                stderr=subprocess.STDOUT, timeout=20)
                print(value, flush=True)
                count = Fixture.requests.count("/appcast.xml")
                assert count == (0 if args.baseline or mode in ["untrusted-origin", "quitting"] else 1), (mode, Fixture.requests)
                assert all(path == "/appcast.xml" or path in ["/" + mode, "/missing-bridge"] for path in Fixture.requests)
                results.append({"mode": mode, "feedRequests": count, "passed": True, "output": value.strip()})
            destination = "baseline-reproduction.json" if args.baseline else "readiness-regressions.json"
            (out / destination).write_text(json.dumps({"baseline": args.baseline, "identity": identity, "results": results}, indent=2) + "\n")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
