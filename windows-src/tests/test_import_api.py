import copy
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer

from film import validate_uss
from server import Handler, demo_workspace


class ImportAPITests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.server.datafile = Path(self.folder.name) / 'workspace.json'
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.folder.cleanup()

    def request(self, path, value=None, method='POST'):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        connection.request(method, path, None if method == 'GET' else json.dumps(value),
                           {'X-Slate-Local': '1', 'X-Filename': 'test.json'})
        response = connection.getresponse()
        result = response.status, json.loads(response.read())
        connection.close()
        return result

    def test_nonobject_roots_return_json_errors_without_losing_workspace(self):
        original = demo_workspace()
        self.assertEqual(self.request('/api/workspace', original)[0], 200)
        before = self.server.datafile.read_bytes()
        for route in ['/api/import', '/api/new', '/api/export', '/api/workspace', '/api/settings']:
            for value in [[], None, 0, True, 'text']:
                with self.subTest(route=route, value=value):
                    status, result = self.request(route, value)
                    self.assertEqual(status, 400)
                    self.assertIn('error', result)
        self.assertEqual(self.server.datafile.read_bytes(), before)
        self.assertEqual(self.request('/api/workspace', method='GET')[0], 200)

    def test_invalid_nested_event_dates_return_json_errors(self):
        for date in [None, 0, False, [], {}, 'not-a-date']:
            project = demo_workspace()['projects'][0]
            project['calendars'][0]['events'][0]['date'] = date
            with self.subTest(date=date):
                status, result = self.request('/api/import', {'universalScheduleStandard': project})
                self.assertEqual(status, 400)
                self.assertEqual(result['error'], 'Invalid event date.')

    def test_invalid_events_collection_is_rejected(self):
        for events in [False, 0, '', {}]:
            project = demo_workspace()['projects'][0]
            project['calendars'][0]['events'] = events
            with self.subTest(events=events):
                self.assertEqual(self.request('/api/import', {'universalScheduleStandard': project})[0], 400)

    def test_both_import_formats_repair_missing_schedules_and_keep_all_scenes(self):
        for missing in [True, False]:
            for kind in ['uss', 'backup']:
                workspace = demo_workspace()
                project = workspace['projects'][0]
                original = copy.deepcopy(project)
                if missing:
                    project.pop('stripboards')
                    project.pop('calendars')
                else:
                    project['stripboards'] = []
                body = {'universalScheduleStandard': project} if kind == 'uss' else workspace
                with self.subTest(missing=missing, kind=kind):
                    status, result = self.request('/api/import', body)
                    self.assertEqual(status, 200)
                    restored = result['project'] if kind == 'uss' else result['workspace']['projects'][0]
                    self.assertEqual(restored['breakdowns'], original['breakdowns'])
                    self.assertEqual(restored['elements'], original['elements'])
                    self.assertEqual(restored['stripboards'][0]['boards'][1]['breakdownIds'],
                                     [b['id'] for b in original['breakdowns']])
                    validate_uss(restored)

    def test_valid_backups_preserve_existing_scenarios(self):
        workspace = demo_workspace()
        status, result = self.request('/api/import', workspace)
        self.assertEqual(status, 200)
        self.assertEqual(result['workspace'], workspace)

    def test_older_saved_workspaces_are_repaired_and_can_be_saved_again(self):
        workspace = demo_workspace()
        workspace['projects'][0]['stripboards'] = []
        self.server.datafile.write_text(json.dumps(workspace), encoding='utf-8')
        status, restored = self.request('/api/workspace', method='GET')
        self.assertEqual(status, 200)
        self.assertTrue(restored['projects'][0]['stripboards'])
        self.assertEqual(self.request('/api/workspace', restored)[0], 200)
        self.assertEqual(self.request('/api/workspace', method='GET'), (200, restored))
