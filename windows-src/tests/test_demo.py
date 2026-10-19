"""Original screenplay, full tab coverage, paired fixtures and portable safety."""
import ast
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from film import validate_uss
from project_file import import_project,export_project

class DemoTests(unittest.TestCase):
    def setUp(self):
        self.value=json.loads((ROOT/'web/demo/the-last-light.productiondesk').read_text())
        self.workspace=self.value['workspace'];self.project=self.workspace['projects'][0]

    def test_original_script_and_all_tool_data(self):
        p=self.project;validate_uss(p)
        original=next(ast.literal_eval(n.value) for n in ast.parse((ROOT/'server.py').read_text()).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='DEMO' for t in n.targets))
        self.assertEqual(p['_sourceScript']['text'],original)
        self.assertEqual((ROOT/'web/demo/the-last-light.fountain').read_text(),original)
        scenes=[b for b in p['breakdowns'] if b['type']=='scene']
        self.assertEqual([b['scene'] for b in scenes],list(map(str,range(1,9))))
        self.assertTrue(all(b['_scriptText'] and b['description'] and b['comments'] and b['duration'] for b in scenes))
        self.assertEqual(len(p['stripboards']),2);self.assertEqual(len(p['stripboards'][0]['boards'][0]['breakdownIds']),3)
        self.assertTrue(p['stripboards'][0]['boards'][1]['breakdownIds'])
        self.assertEqual(len([b for b in p['breakdowns'] if b['type']=='banner']),3)
        self.assertEqual(len(p['_shots']),16)
        self.assertEqual({s['sceneId'] for s in p['_shots']},{b['id'] for b in scenes})
        done=next(s for s in p['_shots'] if s['status']=='Done')
        self.assertEqual((done['takes'],done['circleTake'],done['actualMinutes']),(3,'2',20))
        self.assertTrue(any(b['_needsReview'] for b in scenes));self.assertTrue(any(b['_completed'] for b in scenes))
        for ucid in [0,1,2,3,4,5,6,100,103,104,106,107,110,111,112,113,115,116,118,119,123,124]:
            cat=next(c['id'] for c in p['categories'] if c['ucid']==ucid)
            self.assertTrue(any(e['category']==cat for e in p['elements']),ucid)
        self.assertTrue(any(e['linkedElements'] for e in p['elements']));self.assertTrue(any(e['events'] for e in p['elements']))
        doc=p['_linedScript']['documents'][0];raw=base64.b64decode(self.workspace['_pdfDocuments'][doc['sha256']])
        self.assertEqual(hashlib.sha256(raw).hexdigest(),doc['sha256']);self.assertIn(b'/Count 8',raw)
        self.assertEqual(len(doc['marks']),12);self.assertEqual({m['page'] for m in doc['marks']},set(range(8)))
        self.assertEqual({m['type'] for m in doc['marks']},{'coverage','pen','highlighter','arrow','text'})

    def test_pair_matches_every_scene_and_shot(self):
        scenic=json.loads((ROOT/'web/demo/the-last-light.scenic').read_text());p=self.project
        scenes=[b for b in p['breakdowns'] if b['type']=='scene']
        self.assertEqual(scenic['sharedDemo'],p['_sharedDemo'])
        for b,scene in zip(scenes,scenic['scenes']):
            self.assertIn(b['_scriptText'],scene['notes'])
            expected=[s for s in p['_shots'] if s['sceneId']==b['id']]
            self.assertEqual(len(scene['shotList']),2)
            for s,other in zip(expected,scene['shotList']):
                self.assertEqual(b['scene']+s['number'],other['number'])
                for key in ['description','size','movement','camera','lens','equipment','setupMinutes','shootMinutes','status','takes','circleTake','priority','notes']:
                    self.assertEqual(str(s[key]),other[key],key)
                self.assertTrue(any(o.get('shotId')==other['id'] for o in scene['objects']))

    def test_portable_roundtrip_restores_all_fields_and_pdf(self):
        with tempfile.TemporaryDirectory() as folder:
            datafile=Path(folder)/'workspace.json';imported=import_project(datafile,json.loads(json.dumps(self.value)))
            self.assertEqual(imported['projects'][0],self.project)
            self.assertEqual(json.loads(export_project(datafile,imported)),self.value)
            digest=self.project['_linedScript']['activePdf'];self.assertEqual(hashlib.sha256((datafile.parent/'pdfs'/f'{digest}.pdf').read_bytes()).hexdigest(),digest)

    def test_generator_and_mobile_consistency(self):
        before=(ROOT/'web/demo/the-last-light.productiondesk').read_bytes()
        subprocess.run([sys.executable,str(ROOT/'tools/build_demo.py')],check=True,capture_output=True)
        self.assertEqual((ROOT/'web/demo/the-last-light.productiondesk').read_bytes(),before)
        mobile=ROOT.parent/'ios/ProductionDesk/Web'
        for name in ['demo/demo.js','demo/demo-controls.js','demo/the-last-light.productiondesk','demo/the-last-light.fountain','demo/the-last-light.scenic','production-start.css']:
            self.assertEqual((ROOT/'web'/name).read_bytes(),(mobile/name).read_bytes(),name)

if __name__=='__main__':unittest.main()
