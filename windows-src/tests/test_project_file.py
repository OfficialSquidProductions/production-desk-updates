import copy
import json
from pathlib import Path
import tempfile
import unittest
from project_file import export_project, import_project
from lined import pdf_path
from server import demo_workspace

FIXTURE = Path(__file__).parent / 'portable-project.productiondesk'

class ProjectFileTests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.datafile=Path(self.folder.name)/'workspace.json'
        self.datafile.write_text(json.dumps(demo_workspace()))
        self.before=self.datafile.read_bytes()
        self.value=json.loads(FIXTURE.read_bytes())
    def tearDown(self): self.folder.cleanup()
    def test_desktop_round_trip_preserves_all_fields_and_original_pdf(self):
        original=copy.deepcopy(self.value)
        workspace=import_project(self.datafile,self.value)
        exported=json.loads(export_project(self.datafile,workspace))
        self.assertEqual(exported,original)
        self.assertEqual(self.datafile.read_bytes(),self.before)
        for digest,encoded in original['workspace']['_pdfDocuments'].items():
            import base64
            self.assertEqual(pdf_path(self.datafile,digest).read_bytes(),base64.b64decode(encoded))
    def test_missing_embedded_pdf_never_uses_local_file(self):
        import_project(self.datafile,copy.deepcopy(self.value))
        self.value['workspace']['_pdfDocuments']={}
        with self.assertRaisesRegex(ValueError,'embedded'):import_project(self.datafile,self.value)
        self.assertEqual(self.datafile.read_bytes(),self.before)
    def test_unsupported_versions_and_corrupt_envelopes_preserve_work(self):
        variants=[None,[],{},dict(self.value,format='other'),dict(self.value,formatVersion=2),dict(self.value,formatVersion=True),dict(self.value,workspace={})]
        for value in variants:
            with self.subTest(value=str(value)[:50]):
                with self.assertRaises(ValueError):import_project(self.datafile,value)
                self.assertEqual(self.datafile.read_bytes(),self.before)
    def test_checksum_failure_does_not_write_assets(self):
        digest=next(iter(self.value['workspace']['_pdfDocuments']))
        self.value['workspace']['_pdfDocuments'][digest]='JVBERS1iYWQ='
        with self.assertRaisesRegex(ValueError,'checksum'):import_project(self.datafile,self.value)
        self.assertFalse((self.datafile.parent/'pdfs').exists())
        self.assertEqual(self.datafile.read_bytes(),self.before)
    def test_empty_or_duplicate_projects_rejected(self):
        for projects in [[],self.value['workspace']['projects']*2]:
            value=copy.deepcopy(self.value);value['workspace']['projects']=projects
            with self.assertRaises(ValueError):import_project(self.datafile,value)
    def test_legacy_json_and_uss_remain_supported_through_api(self):
        # Existing API regressions cover both forms and schedule repair.
        from film import prepare_project
        p=prepare_project(demo_workspace()['projects'][0]);self.assertTrue(p['stripboards'])

class ProjectFileAPITests(unittest.TestCase):
    def setUp(self):
        import threading
        from http.server import ThreadingHTTPServer
        from server import Handler
        self.folder=tempfile.TemporaryDirectory()
        self.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        self.server.datafile=Path(self.folder.name)/'workspace.json'
        self.server.datafile.write_text(json.dumps(demo_workspace()))
        self.before=self.server.datafile.read_bytes()
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join();self.folder.cleanup()
    def request(self,path,value=None,filename='Story.productiondesk',method='POST'):
        import http.client
        connection=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=5)
        body=value if isinstance(value,bytes) else json.dumps(value)
        connection.request(method,path,None if method=='GET' else body,{'X-Slate-Local':'1','X-Filename':filename})
        response=connection.getresponse();result=(response.status,response.read());connection.close();return result
    def test_project_export_download_and_import_endpoints(self):
        original=json.loads(FIXTURE.read_bytes())
        status,raw=self.request('/api/import',original)
        self.assertEqual(status,200,raw)
        workspace=json.loads(raw)['workspace']
        status,raw=self.request('/api/project-file',{'workspace':workspace,'filename':'Story.productiondesk'})
        self.assertEqual(status,200,raw)
        status,raw=self.request(json.loads(raw)['url'],method='GET')
        self.assertEqual(status,200);self.assertEqual(json.loads(raw),original)
        self.assertEqual(self.server.datafile.read_bytes(),self.before)
    def test_malformed_and_unsupported_files_leave_disk_unchanged(self):
        for raw in [b'{bad',b'null',b'[]',b'{}',b'{"formatVersion":2}',b'['*1100+b']'*1100]:
            with self.subTest(raw=raw[:25]):
                status,result=self.request('/api/import',raw)
                self.assertEqual(status,400,result);self.assertIn('error',json.loads(result))
                self.assertEqual(self.server.datafile.read_bytes(),self.before)
    def test_new_script_import_retains_original_source(self):
        raw=b'Title: Original\n\nINT. ROOM - DAY\n\nMAYA\nHello.'
        status,result=self.request('/api/import',raw,filename='Original.fountain')
        self.assertEqual(status,200,result)
        self.assertEqual(json.loads(result)['project']['_sourceScript'],{'filename':'Original.fountain','text':raw.decode()})
