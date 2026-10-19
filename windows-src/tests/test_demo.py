"""Canonical sample, portable attachments and cross-platform consistency."""
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from film import validate_uss
from project_file import import_project, export_project


class DemoTests(unittest.TestCase):
    def setUp(self):
        self.value = json.loads((ROOT/'web/demo/the-last-cue.productiondesk').read_text())
        self.workspace = self.value['workspace']
        self.project = self.workspace['projects'][0]

    def test_matches_canonical_scenic_story_and_shots(self):
        reference = json.loads((ROOT/'web/demo/scenic-reference.json').read_text())['scene']
        p = self.project
        validate_uss(p)
        scenes = [b for b in p['breakdowns'] if b['type'] == 'scene']
        self.assertEqual(len(scenes), 1)
        self.assertEqual(scenes[0]['scene'], '1')
        self.assertEqual(len(p['_shots']), 4)
        for expected, actual in zip(reference['shotList'], p['_shots']):
            self.assertEqual('1'+actual['number'], expected['number'])
            for key in ['description','size','movement','camera','lens','equipment','status','notes']:
                self.assertEqual(str(actual[key]), str(expected[key]), key)
            self.assertEqual(actual['sceneId'], scenes[0]['id'])
            self.assertEqual(actual['priority'], 'Preferred')  # Scenic Normal -> PD middle priority.
        for line in reference['notes'].split('\nDEMO NOTES\n')[0].splitlines():
            if line.startswith(('MAYA:', 'LEO:')):
                speaker, dialogue = line.split(':', 1)
                self.assertIn(speaker+'\n'+dialogue.strip(), p['_sourceScript']['text'])
        self.assertEqual(p['_sourceScript']['text'], (ROOT/'web/demo/the-last-cue.fountain').read_text())
        self.assertEqual(len(p['stripboards']), 2)
        doc = p['_linedScript']['documents'][0]
        raw = base64.b64decode(self.workspace['_pdfDocuments'][doc['sha256']])
        self.assertEqual(hashlib.sha256(raw).hexdigest(), doc['sha256'])
        self.assertIn(b'/Count 2', raw)
        self.assertEqual(len(doc['marks']), 6)
        self.assertEqual({m['type'] for m in doc['marks']}, {'coverage','pen','highlighter','arrow','text'})
        self.assertEqual({m['page'] for m in doc['marks']}, {0, 1})

    def test_portable_roundtrip_restores_pdf_and_every_project_field(self):
        with tempfile.TemporaryDirectory() as folder:
            datafile = Path(folder)/'workspace.json'
            imported = import_project(datafile, json.loads(json.dumps(self.value)))
            self.assertEqual(imported['projects'][0], self.project)
            self.assertEqual(json.loads(export_project(datafile, imported)), self.value)
            digest = self.project['_linedScript']['activePdf']
            self.assertEqual(hashlib.sha256((datafile.parent/'pdfs'/f'{digest}.pdf').read_bytes()).hexdigest(), digest)

    def test_generator_and_mobile_asset_consistency(self):
        before = (ROOT/'web/demo/the-last-cue.productiondesk').read_bytes()
        subprocess.run([sys.executable, str(ROOT/'tools/build_demo.py')], check=True, capture_output=True)
        self.assertEqual((ROOT/'web/demo/the-last-cue.productiondesk').read_bytes(), before)
        mobile = ROOT.parent/'ios/ProductionDesk/Web'
        for name in ['demo/demo.js','demo/demo-controls.js','demo/the-last-cue.productiondesk','demo/the-last-cue.fountain','demo/scenic-reference.json','production-start.css']:
            self.assertEqual((ROOT/'web'/name).read_bytes(), (mobile/name).read_bytes(), name)


if __name__ == '__main__':
    unittest.main()
