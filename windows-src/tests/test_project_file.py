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
    def test_original_scenic_demo_uses_normal_json_export_without_changing_workspace(self):
        content=(Path(__file__).resolve().parents[1]/'web/demo/the-last-light.scenic').read_text()
        status,raw=self.request('/api/export',{'filename':'The-Last-Light.scenic','content':content,'mime':'application/json'})
        self.assertEqual(status,200,raw)
        status,download=self.request(json.loads(raw)['url'],method='GET')
        self.assertEqual(status,200);self.assertEqual(download,content.encode())
        self.assertEqual(len(json.loads(download)['scenes']),8)
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

class CompleteImportTests(unittest.TestCase):
    setUp=ProjectFileTests.setUp
    tearDown=ProjectFileTests.tearDown
    def test_import_does_not_mutate_the_input_envelope(self):
        original=copy.deepcopy(self.value)
        import_project(self.datafile,self.value)
        self.assertEqual(self.value,original)

    def test_all_extensions_multiple_pdf_revisions_and_disk_reopen(self):
        import base64, hashlib
        from server import atomic_save, json_object
        project=self.value['workspace']['projects'][0]
        project['_extension']={'id':'arbitrary-extension-id','sceneId':project['breakdowns'][0]['id'],'literal':project['_shots'][0]['id'],'asset':'data:image/png;base64,aGVsbG8='}
        project['_shotSettings']['additionalSetting']={'preserve':True}
        old=project['_linedScript']['documents'][0]
        raw=base64.b64decode(self.value['workspace']['_pdfDocuments'][old['sha256']])+b'\n% Second synthetic revision\n'
        digest=hashlib.sha256(raw).hexdigest()
        document=copy.deepcopy(old);document['sha256']=digest;document['filename']='Revision two.pdf'
        for mark in document['marks']:mark['id']='revision-'+mark['id']
        project['_linedScript']['documents'].append(document)
        project['_linedScript']['activePdf']=digest
        self.value['workspace']['_pdfDocuments'][digest]=base64.b64encode(raw).decode()
        expected=copy.deepcopy(self.value)
        workspace=import_project(self.datafile,self.value)
        atomic_save(self.datafile,workspace)
        self.assertEqual(self.datafile.with_suffix('.previous.json').read_bytes(),self.before)
        reopened=json_object(self.datafile.read_bytes())
        self.assertEqual(json.loads(export_project(self.datafile,reopened)),expected)
        self.assertEqual(pdf_path(self.datafile,digest).read_bytes(),raw)

    def test_duplicate_ids_and_dangling_relationships_rejected(self):
        for kind in ['category','shot','annotation','scene','linked-element','calendar','board']:
            value=copy.deepcopy(self.value);p=value['workspace']['projects'][0]
            if kind=='category':p['categories'][1]['id']=p['categories'][0]['id']
            if kind=='shot':p['_shots'].append(copy.deepcopy(p['_shots'][0]))
            if kind=='annotation':p['_linedScript']['documents'][0]['marks'].append(copy.deepcopy(p['_linedScript']['documents'][0]['marks'][0]))
            if kind=='scene':p['_shots'][0]['sceneId']='missing'
            if kind=='linked-element':p['elements'][0]['linkedElements']=['missing']
            if kind=='calendar':p['stripboards'][0]['calendar']='missing'
            if kind=='board':p['stripboards'][0]['boards'][0]['breakdownIds'].append('missing')
            with self.subTest(kind=kind):
                with self.assertRaises(ValueError):import_project(self.datafile,value)
                self.assertEqual(self.datafile.read_bytes(),self.before)
                self.assertFalse((self.datafile.parent/'pdfs').exists())

    def test_valid_empty_production_and_older_breakdown_only_project(self):
        from film import empty_project
        from project_file import FORMAT
        p=empty_project('Empty production')
        envelope={'format':FORMAT,'formatVersion':1,'workspace':{'version':1,'activeProject':p['id'],'projects':[p],'_pdfDocuments':{}}}
        self.assertEqual(json.loads(export_project(self.datafile,import_project(self.datafile,envelope))),envelope)
        p['stripboards']=[];p.pop('calendars')
        restored=import_project(self.datafile,envelope)['projects'][0]
        self.assertTrue(restored['stripboards']);self.assertTrue(restored['calendars'])

    def test_large_project_and_data_size_limit(self):
        from project_file import validate_workspace
        p=self.value['workspace']['projects'][0];seed=p['_shots'][0]
        p['_shots'].extend(dict(seed,id='large-shot-'+str(n),number='QA'+str(n)) for n in range(5000))
        workspace=import_project(self.datafile,self.value)
        self.assertEqual(json.loads(export_project(self.datafile,workspace))['workspace']['projects'][0]['_shots'],p['_shots'])
        p['_oversized']='x'*(40*1024*1024)
        with self.assertRaisesRegex(ValueError,'40 MB'):validate_workspace(self.value['workspace'])
        self.assertEqual(self.datafile.read_bytes(),self.before)

class ImportJSONIntegrityTests(unittest.TestCase):
    def test_duplicate_json_fields_and_invalid_numbers_are_not_silently_discarded(self):
        from server import json_object
        for raw in [b'{"workspace":{},"workspace":{}}',b'{"project":{"id":"one","id":"two"}}',b'{"value":NaN}',b'{"value":Infinity}',b'']:
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):json_object(raw)

class BreakdownViewCompatibilityTests(unittest.TestCase):
    setUp=ProjectFileTests.setUp
    tearDown=ProjectFileTests.tearDown
    def test_view_mode_and_unknown_project_settings_survive_portable_round_trip(self):
        p=self.value['workspace']['projects'][0]
        p['_breakdownSettings']={'continuousScroll':True,'futureSetting':{'preserved':[None,'café']}}
        expected=copy.deepcopy(self.value)
        self.assertEqual(json.loads(export_project(self.datafile,import_project(self.datafile,self.value))),expected)
    def test_missing_view_mode_is_not_added_to_older_projects(self):
        p=import_project(self.datafile,self.value)['projects'][0]
        self.assertNotIn('_breakdownSettings',p)
    def test_invalid_viewing_settings_are_rejected_without_changing_disk(self):
        for settings in ['continuous',[],{'continuousScroll':'true'},{'continuousScroll':1}]:
            value=copy.deepcopy(self.value);value['workspace']['projects'][0]['_breakdownSettings']=settings
            with self.subTest(settings=settings),self.assertRaisesRegex(ValueError,'viewing settings'):import_project(self.datafile,value)
            self.assertEqual(self.datafile.read_bytes(),self.before)
