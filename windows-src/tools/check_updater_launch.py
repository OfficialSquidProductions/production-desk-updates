#!/usr/bin/env python3
"""Exercise real Sparkle against local fixtures, with no live feeds or installers."""
import base64
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import plistlib
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
from threading import Thread
import uuid
from macos_updates import ROOT, release_config, sparkle_distribution, updater_plist


class Feed(BaseHTTPRequestHandler):
    mode = "newer"
    requests = []

    def do_GET(self):
        self.requests.append(self.path)
        if self.mode == "malformed":
            data = b"<rss><channel><item>broken"
        elif self.mode == "offline":
            self.connection.shutdown(socket.SHUT_RDWR)
            self.connection.close()
            return
        else:
            version = "23" if self.mode in ("equal", "opt-out") else "22" if self.mode == "older" else "24"
            minimum = "99.0" if self.mode == "incompatible" else "12.0"
            data = f'''<?xml version="1.0"?><rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><title>Production Desk local fixture</title><item><title>Production Desk 1.5.5</title><sparkle:version>{version}</sparkle:version><sparkle:shortVersionString>1.5.5</sparkle:shortVersionString><sparkle:minimumSystemVersion>{minimum}</sparkle:minimumSystemVersion><description><![CDATA[<h2>What's new</h2><ul><li>Launch update notice with a changelog.</li><li>Your scripts and portable productions stay intact.</li></ul>]]></description><enclosure url="https://production-desk-fixture.invalid/Production-Desk-1.5.5.zip" length="1024" type="application/octet-stream" sparkle:edSignature="{base64.b64encode(bytes(64)).decode()}"/></item></channel></rss>'''.encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/rss+xml")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *_args):
        pass


def build_fixture(folder, feed_url, sparkle, config):
    app = folder / "Production Desk Update QA.app"
    contents = app / "Contents"
    (contents / "MacOS").mkdir(parents=True)
    (contents / "Frameworks").mkdir()
    shutil.copytree(sparkle / "Sparkle.framework", contents / "Frameworks/Sparkle.framework", symlinks=True)
    info = {"CFBundleExecutable": "UpdateQA", "CFBundleIdentifier": "org.squidproductions.productiondesk.update-qa." + str(uuid.uuid4()),
            "CFBundleName": "Production Desk Update QA", "CFBundleDisplayName": "Production Desk Update QA",
            "CFBundlePackageType": "APPL", "CFBundleVersion": "23", "CFBundleShortVersionString": "1.5.4",
            "NSPrincipalClass": "NSApplication", "LSMinimumSystemVersion": "12.0", "NSAppTransportSecurity": {"NSAllowsLocalNetworking": True},
            **updater_plist(config), "SUFeedURL": feed_url}
    (contents / "Info.plist").write_bytes(plistlib.dumps(info))
    subprocess.run(["swiftc", "-module-cache-path", str(ROOT / ".cache/swift"), "-F", str(sparkle), "-framework", "Sparkle",
                    "-Xlinker", "-rpath", "-Xlinker", "@executable_path/../Frameworks", str(ROOT / "desktop/Updates.swift"),
                    str(ROOT / "tests/UpdaterLaunchCheck.swift"), "-o", str(contents / "MacOS/UpdateQA")], check=True)
    subprocess.run(["codesign", "--force", "--deep", "--sign", "-", str(app)], check=True)
    return app


def main():
    config = release_config()
    sparkle = sparkle_distribution(config)
    server = ThreadingHTTPServer(("127.0.0.1", 0), Feed)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with tempfile.TemporaryDirectory(prefix="production-desk-update-fixtures-") as temp:
            folder = Path(temp)
            folder.mkdir(parents=True, exist_ok=True)
            app = build_fixture(folder, f"http://127.0.0.1:{server.server_port}/appcast.xml", sparkle, config)
            binary = app / "Contents/MacOS/UpdateQA"
            # This QA app only talks to the loopback fixture and has no project
            # backend. Keep Sparkle preferences/caches/logs in a disposable home,
            # and verify Foundation's actual routing before any fixture launch.
            home = (folder / "disposable-home").resolve()
            home.mkdir()
            env = {**os.environ, "CFFIXED_USER_HOME": str(home)}
            probe = subprocess.check_output(["swift", "-module-cache-path", str(ROOT / ".cache/swift"), "-e",
                'import Foundation; let f=FileManager.default; print(f.homeDirectoryForCurrentUser.path); print((try f.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:false)).path)'], env=env, text=True).splitlines()
            assert [Path(value).resolve() for value in probe] == [home, home / "Library/Application Support"], probe
            info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
            assert info["CFBundleIdentifier"].startswith("org.squidproductions.productiondesk.update-qa.")
            assert info["CFBundleExecutable"] == "UpdateQA" and info["SUFeedURL"] == f"http://127.0.0.1:{server.server_port}/appcast.xml"
            assert not (app / "Contents/Resources/runtime").exists()
            print("Before fixture launch: dedicated home, preferences/cache/log routing, unique QA identity and loopback-only feed verified; no workspace, PDF or backup backend", flush=True)
            for mode in ["equal", "older", "newer", "newer", "incompatible", "offline", "malformed", "opt-out"]:
                Feed.mode = mode
                Feed.requests.clear()
                subprocess.run([str(binary), mode], env=env, check=True, timeout=45)
                expected = 0 if mode == "opt-out" else 3 if mode == "newer" else 1
                if mode == "offline":
                    # NSURLSession may retry an abruptly closed connection.
                    assert 1 <= len(Feed.requests) <= 3, (mode, Feed.requests)
                else:
                    assert len(Feed.requests) == expected, (mode, Feed.requests)
                assert all(path == "/appcast.xml" for path in Feed.requests)
                print(f"Fixture {mode}: {len(Feed.requests)} feed requests, quiet background policy and no installer requests", flush=True)
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
