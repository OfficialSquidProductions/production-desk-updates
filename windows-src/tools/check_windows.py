#!/usr/bin/env python3
"""Exercise the actual Windows bundle, one-file installer, and reinstall."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    if sys.platform != 'win32':
        raise SystemExit('Run this check on Windows.')
    product = json.loads((ROOT / 'desktop/windows/package.json').read_text())['build']['productName']
    output = ROOT / 'build/windows-check'
    output.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(ROOT))
    sys.path.insert(0, str(ROOT / 'tests'))
    from test_slate import simple_pdf
    (output / 'fixture.pdf').write_bytes(simple_pdf())
    shutil.copy2(ROOT / 'tests/fixture.fdx', output / 'fixture.fdx')
    shutil.copy2(ROOT / 'tests/lined-script.pdf', output / 'lined-script.pdf')
    result = output / 'result.json'

    def run_app(executable, label):
        if result.exists():
            result.unlink()
        completed = subprocess.run([str(executable), '--smoke-test', str(result)], timeout=180)
        if not result.exists():
            raise RuntimeError('Packaged app check exited without a report: ' + str(completed.returncode))
        report = json.loads(result.read_text())
        if report.get('passed'):
            from pypdf import PdfReader
            original = PdfReader(ROOT / 'tests/lined-script.pdf')
            exported = PdfReader(output / 'lined-script-export.pdf')
            assert len(exported.pages) == len(original.pages) == 2
            for before, after in zip(original.pages, exported.pages):
                assert before.extract_text() == after.extract_text()
                assert before.cropbox == after.cropbox and before.rotation == after.rotation
                assert len(after.images) == 1

        if completed.returncode or not report.get('passed'):
            raise RuntimeError(report)
        shutil.copy2(result, output / (label + '.json'))
        print(label + ': ' + ', '.join(report['checks']), flush=True)

    run_app(ROOT / ('dist/windows/win-unpacked/' + product + '.exe'), 'packaged')
    workspace = output / 'smoke-user-data/workspace.json'
    before = hashlib.sha256(workspace.read_bytes()).hexdigest()
    installer = ROOT / 'dist/windows/Production-Desk-Windows-Setup.exe'
    assert installer.read_bytes()[:2] == b'MZ'
    destination = output / 'installed'
    subprocess.run([str(installer), '/S', '/D=' + str(destination)], check=True, timeout=120)
    assert hashlib.sha256(workspace.read_bytes()).hexdigest() == before
    installed = destination / (product + '.exe')
    assert installed.is_file(), 'Installer did not install the application'
    assert (destination / 'resources/backend/ProductionDeskServer.exe').is_file()
    run_app(installed, 'installed')
    before = hashlib.sha256(workspace.read_bytes()).hexdigest()
    subprocess.run([str(installer), '/S', '/D=' + str(destination)], check=True, timeout=120)
    assert hashlib.sha256(workspace.read_bytes()).hexdigest() == before
    run_app(installed, 'reinstalled')
    (output / 'installer.json').write_text(json.dumps({
        'passed': True, 'single_exe': True, 'silent_install': True,
        'installed_app_runs': True, 'reinstall_preserves_projects': True,
        'sha256': hashlib.sha256(installer.read_bytes()).hexdigest()
    }, indent=2))


if __name__ == '__main__':
    main()
