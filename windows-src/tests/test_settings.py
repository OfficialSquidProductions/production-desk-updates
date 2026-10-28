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

    def test_lined_settings_merge_persist_and_do_not_touch_workspace(self):
        from app_preferences import DEFAULT_BINDS
        bindings = dict(DEFAULT_BINDS, coverage='Shift+k')
        self.assertEqual(self.request(value={'linedKeyBinds': bindings})[0], 200)
        self.assertEqual(self.request(value={'linedLabelOpacity': .35})[0], 200)
        self.assertEqual(self.request(value={'theme': 'dark'})[0], 200)
        expected = {'theme':'dark', 'linedKeyBinds':bindings, 'linedLabelOpacity':.35}
        self.assertEqual(self.request(), (200, {'preferences':expected}))
        self.assertEqual(json.loads(self.path.read_text()), expected)
        self.assertFalse(self.server.datafile.exists())

    def test_invalid_lined_settings_are_atomic(self):
        self.request(value={'theme':'dark', 'linedLabelOpacity':.5})
        before = self.path.read_bytes()
        for value in [{'linedLabelOpacity':0}, {'linedLabelOpacity':1.1},
                      {'linedLabelOpacity':True}, {'linedLabelOpacity':'50'},
                      {'linedLabelOpacity':float('nan')}, {'linedKeyBinds':[]},
                      {'linedKeyBinds':{'coverage':'v'}},
                      {'linedKeyBinds':{'coverage':'Mod+z'}},
                      {'linedKeyBinds':{'coverage':'Mod+s'}},
                      {'linedKeyBinds':{'coverage':'Mod+w'}},
                      {'linedKeyBinds':{'missing':'k'}},
                      {'theme':'light','linedKeyBinds':{'coverage':None}}]:
            with self.subTest(value=value):
                self.assertEqual(self.request(value=value)[0], 400)
                self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual(self.request(value={'linedKeyBinds':{'coverage':''}})[0], 200)
        self.assertEqual(self.request()[1]['preferences']['linedKeyBinds']['coverage'], '')

    def test_tab_order_persists_with_other_preferences_without_touching_project(self):
        order = ['lined','workspace','shots','schedule','elements','reports']
        project = b'{"private-project":"keep exactly"}'
        self.server.datafile.write_bytes(project)
        self.assertEqual(self.request(value={'navigationOrder':order})[0], 200)
        self.assertEqual(self.request(value={'theme':'dark','linedLabelOpacity':.35})[0], 200)
        expected = {'theme':'dark','navigationOrder':order,'linedLabelOpacity':.35}
        self.assertEqual(self.request(), (200, {'preferences':expected}))
        self.assertEqual(json.loads(self.path.read_text()), expected)
        self.assertEqual(self.server.datafile.read_bytes(), project)
        self.assertFalse(self.server.datafile.with_suffix('.previous.json').exists())

    def test_invalid_tab_orders_cannot_partially_save_or_remove_a_tab(self):
        default = ['workspace','lined','shots','schedule','reports','elements']
        self.request(value={'theme':'dark','navigationOrder':default})
        before = self.path.read_bytes()
        for order in [None, {}, 'workspace', [], default[:-1], default+['shots'],
                      ['workspace']*6, ['workspace','lined','shots','schedule','reports','unknown'],
                      [True,*default[1:]], [[tab] for tab in default]]:
            with self.subTest(order=order):
                self.assertEqual(self.request(value={'theme':'light','navigationOrder':order})[0], 400)
                self.assertEqual(self.path.read_bytes(), before)

    def test_malformed_saved_tab_order_falls_back_without_rewriting_settings(self):
        value = {'theme':'dark','linedLabelOpacity':.35,'navigationOrder':['lined','lined']}
        self.path.write_text(json.dumps(value))
        before = self.path.read_bytes()
        self.assertEqual(self.request(), (200, {'preferences':{'theme':'dark','linedLabelOpacity':.35}}))
        self.assertEqual(self.path.read_bytes(), before)
