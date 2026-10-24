"""Shipping resource removal must never delete existing productions."""
import copy
import http.client
import json
from pathlib import Path
import unittest

import test_import_api

ROOT = Path(__file__).resolve().parents[1]


class ShippingContentTests(unittest.TestCase):
    setUp = test_import_api.ImportAPITests.setUp
    tearDown = test_import_api.ImportAPITests.tearDown
    request = test_import_api.ImportAPITests.request
    # Reuse only the disposable server lifecycle and request helper.
    def test_fresh_workspace_is_empty_and_existing_sample_is_preserved(self):
        status, fresh = self.request('/api/workspace', method='GET')
        self.assertEqual(status, 200)
        self.assertEqual(len(fresh['projects']), 1)
        self.assertEqual(fresh['projects'][0]['breakdowns'], [])
        self.assertFalse(fresh['projects'][0].get('_demo'))
        sample = json.loads((ROOT/'tests/fixtures/demo/the-last-light.productiondesk').read_text())['workspace']
        sample['projects'].insert(0, fresh['projects'][0])
        sample['projects'][0]['project'] = 'User-created production — keep me'
        before = copy.deepcopy(sample)
        self.assertEqual(self.request('/api/workspace', sample)[0], 200)
        self.assertEqual(self.request('/api/workspace', method='GET')[1], before)
        for name in ['demo.js','demo-controls.js','the-last-light.productiondesk','the-last-light.fountain','the-last-light.scenic']:
            connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
            connection.request('GET', '/demo/'+name)
            response = connection.getresponse()
            self.assertEqual(response.status, 404)
            response.read(); connection.close()
        self.assertEqual(self.request('/api/workspace', method='GET')[1], before)

    def test_app_resources_exclude_demo_and_external_fixtures(self):
        for web in [ROOT/'web', ROOT.parent/'ios/ProductionDesk/Web']:
            self.assertFalse((web/'demo').exists())
            self.assertFalse(list(web.rglob('*.productiondesk')))
            self.assertNotIn('demo-launcher', (web/'index.html').read_text())
            self.assertNotIn('createDemoControls', (web/'app.js').read_text())
        server = (ROOT/'server.py').read_text()
        self.assertNotIn('def demo_workspace', server)
        self.assertNotIn('THE LAST LIGHT', server)
