import base64
import copy
import hashlib
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from server import Handler, demo_workspace
from lined import store_pdf, add_backup_pdfs, restore_backup_pdfs, pdf_path

FIXTURE = (Path(__file__).parent / 'lined-script.pdf').read_bytes()

class LinedScriptTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.server.datafile = Path(self.folder.name) / 'workspace.json'
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.workspace = demo_workspace()
        self.project = self.workspace['projects'][0]
        from test_slate import ShotTests
        sample = ShotTests(); sample.setUp()
        self.project['_shots'] = [dict(sample.shot, sceneId=self.project['breakdowns'][0]['id'])]
        self.document = store_pdf(self.server.datafile, FIXTURE, 'original.pdf')
        self.project['_linedScript'] = {'activePdf': self.document['sha256'], 'documents': [self.document]}

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(); self.folder.cleanup()

    def request(self, route, value=None, method='POST', headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        body = value if isinstance(value, bytes) else json.dumps(value)
        connection.request(method, route, None if method == 'GET' else body,
                           {'X-Slate-Local': '1', 'X-Filename': 'test.json', **(headers or {})})
        response = connection.getresponse(); result = response.status, response.read(); connection.close()
        return result

    def test_original_is_immutable_and_local_only(self):
        digest = hashlib.sha256(FIXTURE).hexdigest()
        self.assertEqual(self.document['sha256'], digest)
        self.assertEqual(store_pdf(self.server.datafile, FIXTURE, 'revision.pdf')['sha256'], digest)
        self.assertEqual(self.request('/api/pdf/' + digest, method='GET'), (200, FIXTURE))
        self.assertEqual(self.request('/api/pdf/' + digest, method='GET', headers={'Origin':'https://example.com'})[0], 403)
        self.assertEqual(self.request('/api/pdf/' + 'f'*64, method='GET')[0], 404)
        self.assertEqual(self.request('/api/pdf', b'not a PDF')[0], 400)
        self.assertEqual(pdf_path(self.server.datafile, digest).read_bytes(), FIXTURE)

    def test_full_backup_restores_originals_on_a_fresh_computer(self):
        status, raw = self.request('/api/backup', {'workspace':self.workspace,'filename':'full.json'})
        self.assertEqual(status, 200, raw)
        status, raw = self.request(json.loads(raw)['url'], method='GET')
        self.assertEqual(status, 200)
        backup = json.loads(raw)
        digest = self.document['sha256']
        self.assertEqual(base64.b64decode(backup['_pdfDocuments'][digest]), FIXTURE)
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'workspace.json'
            restored = restore_backup_pdfs(target, copy.deepcopy(backup))
            self.assertEqual(restored, self.workspace)
            self.assertEqual(pdf_path(target, digest).read_bytes(), FIXTURE)
        status, imported = self.request('/api/import', backup)
        self.assertEqual(status, 200, imported)
        self.assertEqual(json.loads(imported)['workspace'], self.workspace)

    def test_incomplete_or_tampered_backup_is_rejected_before_writing_assets(self):
        backup = add_backup_pdfs(self.server.datafile, self.workspace)
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'workspace.json'
            with self.assertRaisesRegex(ValueError, 'missing'):
                restore_backup_pdfs(target, copy.deepcopy(self.workspace))
            backup['_pdfDocuments'][self.document['sha256']] = base64.b64encode(b'%PDF-tampered').decode()
            with self.assertRaisesRegex(ValueError, 'checksum'):
                restore_backup_pdfs(target, backup)
            self.assertFalse((target.parent / 'pdfs').exists())

    def test_bad_marks_never_replace_a_saved_workspace(self):
        self.assertEqual(self.request('/api/workspace', self.workspace)[0], 200)
        before = self.server.datafile.read_bytes()
        valid = {'id':'line','type':'coverage','page':0,'start':[.2,.2],'end':[.2,.6],
                 'shotId':self.project['_shots'][0]['id'],'style':'solid','width':2,'color':'#E60026'}
        for patch in [{'shotId':'missing'},{'page':-1},{'start':[2,.3]},{'end':[.3,.6]},
                      {'color':'url(evil)'},{'width':float('inf')},{'type':'unknown'}, {'note':'x'*2001}]:
            with self.subTest(patch=patch):
                changed = copy.deepcopy(self.workspace)
                changed['projects'][0]['_linedScript']['documents'][0]['marks'] = [dict(valid, **patch)]
                self.assertEqual(self.request('/api/workspace', changed)[0], 400)
                self.assertEqual(self.server.datafile.read_bytes(), before)
        self.document['marks'] = [valid]
        self.assertEqual(self.request('/api/workspace', self.workspace)[0], 200)

    def test_pdf_export_is_binary_and_rejects_wrong_encoding(self):
        body = {'filename':'lined.pdf','content':base64.b64encode(FIXTURE).decode(),'mime':'application/pdf','encoding':'base64'}
        status, raw = self.request('/api/export', body)
        self.assertEqual(status, 200, raw)
        self.assertEqual(self.request(json.loads(raw)['url'], method='GET'), (200, FIXTURE))
        body.pop('encoding'); self.assertEqual(self.request('/api/export', body)[0], 400)

    def test_new_pdf_script_import_retains_original_pages(self):
        status, raw = self.request('/api/import', FIXTURE, headers={'X-Filename':'script.pdf'})
        self.assertEqual(status, 200, raw)
        project = json.loads(raw)['project']
        self.assertTrue(project['breakdowns'])
        self.assertEqual(project['_linedScript']['activePdf'], self.document['sha256'])
