import http.client
import json
from pathlib import Path
import tempfile
import os
import threading
import unittest
from http.server import ThreadingHTTPServer

from server import Handler


class SettingsTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.path = Path(self.folder.name) / 'app-settings.json'
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.server.datafile = Path(self.folder.name) / 'workspace.json'
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.folder.cleanup()

    def request(self, path='/api/settings', value=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        headers = {'Origin': 'http://127.0.0.1:%s' % self.server.server_port,
                   'X-Slate-Local': '1'}
        connection.request('GET' if value is None else 'POST', path,
                           None if value is None else json.dumps(value), headers)
        response = connection.getresponse()
        result = response.status, json.loads(response.read())
        connection.close()
        return result

    def test_existing_theme_survives_and_obsolete_preferences_are_ignored(self):
        self.path.write_text(json.dumps({'theme': 'dark', 'gcasperLinks': {'old': 'link'},
                                        'calendarId': 'old-calendar'}))
        self.assertEqual(self.request(), (200, {'preferences': {'theme': 'dark'}}))
        self.assertEqual(self.request(value={'theme': 'light', 'calendarId': 'ignored'}),
                         (200, {'preferences': {'theme': 'light'}}))
        self.assertEqual(json.loads(self.path.read_text(encoding='utf-8')), {'theme': 'light'})
        self.assertEqual(self.request(), (200, {'preferences': {'theme': 'light'}}))
        if os.name != 'nt':
            self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
        self.assertFalse(self.server.datafile.exists())

    def test_invalid_settings_do_not_overwrite_saved_theme(self):
        self.path.write_text('{"theme":"dark"}')
        for value in [[], {'theme': 'invalid'}]:
            self.assertEqual(self.request(value=value)[0], 400)
        self.assertEqual(self.request(), (200, {'preferences': {'theme': 'dark'}}))

    def test_missing_or_malformed_settings_use_light(self):
        self.assertEqual(self.request(), (200, {'preferences': {'theme': 'light'}}))
        for raw in ['bad json', '[]', 'null', '{"theme":"invalid"}']:
            self.path.write_text(raw)
            self.assertEqual(self.request(), (200, {'preferences': {'theme': 'light'}}))

    def test_removed_integration_routes_return_not_found(self):
        for path in ['/api/google/callback', '/api/google/calendars']:
            self.assertEqual(self.request(path)[0], 404)
        for path in ['/api/google/connect', '/api/google/disconnect',
                     '/api/google/preview', '/api/google/sync']:
            self.assertEqual(self.request(path, {})[0], 404)
