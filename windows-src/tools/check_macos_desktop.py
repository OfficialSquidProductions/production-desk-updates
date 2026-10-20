#!/usr/bin/env python3
"""Test the packaged Mac runtime and UI in native WebKit with synthetic data."""
import argparse
import json
import sys
from pathlib import Path
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", action="store_true", help="Check this checkout with the current Python, without building or signing an app")
    args = parser.parse_args()
    app = ROOT / ('dist/Production Desk Beta.app' if json.loads((ROOT / 'desktop/release.json').read_text()).get('channel') == 'beta' else 'dist/Production Desk.app')
    python = app / 'Contents/Frameworks/Python3.framework/Versions/3.9/bin/python3.9'
    runtime = app / 'Contents/Resources/runtime'
    if args.source:
        python, runtime = Path(sys.executable), ROOT
    binary = ROOT / '.cache/check-desktop-webkit'
    binary.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['swiftc', '-parse-as-library', '-module-cache-path', str(ROOT / '.cache/swift'),
                    str(ROOT / 'tests/DesktopWebKitCheck.swift'), '-o', str(binary)], check=True)
    with tempfile.TemporaryDirectory(prefix='production-desk-native-check-') as folder:
        ready = Path(folder) / 'ready.json'
        with (Path(folder) / 'server.log').open('w') as log:
            server = subprocess.Popen([str(python), '-E', '-s', '-B', str(runtime / 'server.py'),
                                       '--port', '0', '--data', str(Path(folder) / 'workspace.json'),
                                       '--ready-file', str(ready)], stdout=log, stderr=log)
            try:
                deadline = time.monotonic() + 15
                while not ready.exists():
                    if server.poll() is not None or time.monotonic() > deadline:
                        raise RuntimeError('Packaged Mac server did not start.')
                    time.sleep(.05)
                url = json.loads(ready.read_text())['url']
                subprocess.run([str(binary), url, str(ROOT)], check=True, timeout=150)
            finally:
                server.terminate()
                server.wait(timeout=10)


if __name__ == '__main__':
    main()
