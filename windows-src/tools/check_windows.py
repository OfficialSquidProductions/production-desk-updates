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
    subprocess.run(['node', '--test', 'tests/desktop-updates.cjs'], cwd=ROOT, check=True)
    subprocess.run(['node', '-e', "const fs=require('node:fs'),assert=require('node:assert/strict'),yaml=require('js-yaml');"
                    "assert.equal(yaml.load(fs.readFileSync(process.argv[1],'utf8')).releaseNotes.trim(),fs.readFileSync(process.argv[2],'utf8').trim());"
                    "console.log('Windows update metadata includes the existing release changelog.');",
                    str(ROOT / 'dist/windows/latest.yml'), str(ROOT / 'desktop/release-notes.txt')],
                   cwd=ROOT / 'desktop/windows', check=True)
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
        data = output / 'smoke-user-data'
        data.mkdir(exist_ok=True)
        (data / 'support-session.json').write_text('{"pid":999999999}')
        completed = subprocess.run([str(executable), '--smoke-test', str(result)], timeout=180)
        if not result.exists():
            raise RuntimeError('Packaged app check exited without a report: ' + str(completed.returncode))
        report = json.loads(result.read_text())
        if report.get('passed'):
            from pypdf import PdfReader
            original = PdfReader(ROOT / 'tests/lined-script.pdf')
            exported = PdfReader(output / 'lined-script-export.pdf')
            continuous = PdfReader(output / 'continuous-script-export.pdf')
            assert len(continuous.pages) == len(original.pages)
            for before, after in zip(original.pages, continuous.pages):
                assert before.extract_text() == after.extract_text()
                assert after.mediabox.left <= before.mediabox.left and after.mediabox.bottom <= before.mediabox.bottom
                assert after.mediabox.right >= before.mediabox.right and after.mediabox.top >= before.mediabox.top
                assert after.cropbox.left <= before.cropbox.left and after.cropbox.bottom <= before.cropbox.bottom
                assert after.cropbox.right >= before.cropbox.right and after.cropbox.top >= before.cropbox.top
                assert before.rotation == after.rotation and len(after.images) == 1
            assert len(exported.pages) == len(original.pages) == 2
            for before, after in zip(original.pages, exported.pages):
                assert before.extract_text() == after.extract_text()
                assert after.cropbox.left <= before.cropbox.left and after.cropbox.bottom <= before.cropbox.bottom
                assert after.cropbox.right >= before.cropbox.right and after.cropbox.top >= before.cropbox.top
                assert before.rotation == after.rotation
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
