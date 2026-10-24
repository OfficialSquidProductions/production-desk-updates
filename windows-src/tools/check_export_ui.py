#!/usr/bin/env python3
"""Run real export/import controls in an isolated native WebKit QA app."""
import csv
import io
import json
import os
from pathlib import Path
import plistlib
import subprocess
import sys
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from project_file import export_project, import_project


def main():
    output = ROOT / 'build/export-check'
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pd-export-ui-', dir=output) as temp:
        folder = Path(temp).resolve()
        contents = folder / 'Production Desk Export QA.app/Contents'
        (contents / 'MacOS').mkdir(parents=True)
        identity = 'local.productiondesk.export-qa.' + uuid.uuid4().hex
        info = {'CFBundleExecutable': 'ExportQA', 'CFBundleIdentifier': identity,
                'CFBundleName': 'Production Desk Export QA', 'CFBundlePackageType': 'APPL'}
        (contents / 'Info.plist').write_bytes(plistlib.dumps(info))
        source = (ROOT / 'tests/DesktopWebKitCheck.swift').read_text()
        source = source.replace('web = WKWebView(frame: NSRect(x: 0, y: 0, width: 1440, height: 940))',
            'let configuration = WKWebViewConfiguration(); configuration.websiteDataStore = .nonPersistent()\n        web = WKWebView(frame: NSRect(x: 0, y: 0, width: 1440, height: 940), configuration: configuration)')
        source = source.replace('window.orderFront(nil)', 'window.orderBack(nil)')
        source = source.replace('(error && error.stack) || String(error)', "String(error) + ': ' + ((error && error.stack) || '')")
        swift = folder / 'ExportQA.swift'
        swift.write_text(source)
        binary = contents / 'MacOS/ExportQA'
        subprocess.run(['swiftc', '-parse-as-library', '-module-cache-path', str(ROOT / '.cache/swift'), str(swift), '-o', str(binary)], check=True)
        subprocess.run(['codesign', '--force', '--sign', '-', str(contents.parent)], check=True)
        home = folder / 'home'
        home.mkdir()
        env = {**os.environ, 'CFFIXED_USER_HOME': str(home)}
        probe = subprocess.check_output(['swift', '-module-cache-path', str(ROOT / '.cache/swift'), '-e',
            'import Foundation;let f=FileManager.default;print(f.homeDirectoryForCurrentUser.path);print((try f.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:false)).path)'], env=env, text=True).splitlines()
        assert [Path(value).resolve() for value in probe] == [home, home / 'Library/Application Support'], probe
        data = home / 'Library/Application Support/ExportQA/workspace.json'
        data.parent.mkdir(parents=True)
        assert identity.startswith('local.productiondesk.export-qa.') and 'SUFeedURL' not in info
        (output / 'preflight.json').write_text(json.dumps({'identity': identity, 'home': str(home),
            'workspace': str(data), 'pdfsAndBackups': str(data.parent), 'logs': str(home / 'Library/Logs'),
            'webKit': 'nonpersistent', 'installedAppLaunched': False}, indent=2) + '\n')
        print('PREFLIGHT: unique identity, disposable Foundation storage/preferences, explicit synthetic backend data/PDF/backup paths; installed app unused', flush=True)
        ready = home / 'ready.json'
        with (output / 'backend.log').open('w') as log:
            server = subprocess.Popen([os.environ.get('PRODUCTION_DESK_PYTHON', sys.executable), '-E', '-s', '-B', str(Path(os.environ.get('PRODUCTION_DESK_RUNTIME', ROOT)) / 'server.py'), '--port', '0',
                '--data', str(data), '--ready-file', str(ready), '--parent-pid', str(os.getpid())], env=env, stdout=log, stderr=log)
            try:
                deadline = time.monotonic() + 20
                while not ready.exists():
                    if server.poll() is not None or time.monotonic() > deadline:
                        raise RuntimeError('Synthetic backend failed to start')
                    time.sleep(.05)
                origin = json.loads(ready.read_text())['url']
                assert origin.startswith('http://127.0.0.1:')
                with (output / 'webkit.log').open('w') as checks:
                    subprocess.run([str(binary), origin, str(ROOT)], env=env, stdout=checks, stderr=subprocess.STDOUT, check=True, timeout=180)
                text = (output / 'webkit.log').read_text()
                assert 'Actual breakdown CSV export' in text and 'Actual .productiondesk Save As/import/edit/re-export' in text
                assert 'FAIL:' not in text
            finally:
                server.terminate()
                server.wait(timeout=10)
    # The sender backend and its complete storage are now gone. Parse the actual
    # UI download with a standard CSV reader and restore its portable output fresh.
    source = json.loads((output / 'source-project.json').read_bytes())
    raw = (output / 'breakdowns.csv').read_bytes()
    assert raw.startswith(b'\xef\xbb\xbf')
    rows = list(csv.reader(io.StringIO(raw.decode('utf-8-sig'), newline='')))
    assert len(rows) == 1 + len(source['breakdowns']) and all(len(row) == len(rows[0]) for row in rows)
    for row, scene in zip(rows[1:], source['breakdowns']):
        expected = [source['project'], scene['id'], scene['type'],
            scene['scene'], scene['scriptPage'], scene['pages'],
            '' if scene['duration'] is None else scene['duration'] / 60000, scene['description'], scene['comments'], scene['bannerText']]
        for index, value in enumerate(expected):
            if index in (5, 6) and value not in (None, ''):
                assert float(row[index]) == value
            else:
                assert row[index] == (str(value) if value is not None else '')
        for column, category in enumerate(source['categories'], 10):
            tagged = [next(e for e in source['elements'] if e['id'] == eid) for eid in scene['elements']]
            expected = '\n'.join(e['name'] for e in tagged if e['category'] == category['id'])
            assert row[column] == expected
    portable = json.loads((output / 'rich-session.productiondesk').read_bytes())
    with tempfile.TemporaryDirectory(prefix='pd-export-recipient-', dir=output) as temp:
        data = Path(temp) / 'workspace.json'
        received = import_project(data, portable)
        assert json.loads(export_project(data, received)) == portable
    result = {'passed': True, 'actualExportImportUI': True, 'csvParsedByPythonStandardLibrary': True,
              'csvBreakdownRows': len(rows) - 1, 'completePortableIntoFreshProfileAfterSenderRemoved': True,
              'pdfRevisions': len(portable['workspace']['_pdfDocuments']), 'nativeAggregate': True,
              'installedAppOrRealProjectsUsed': False}
    (output / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
