import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer

from server import Handler


class SupportTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.data = Path(self.folder.name) / 'workspace.json'
        self.data.write_text('{"private": "do not attach"}')
        self.start()

    def start(self):
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.server.datafile = self.data
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def tearDown(self):
        self.stop()
        self.folder.cleanup()

    def request(self, path='/api/support', value=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        if headers is None:
            headers = {'Origin': f'http://127.0.0.1:{self.server.server_port}', 'X-Slate-Local': '1'}
        connection.request('GET' if value is None else 'POST', path, None if value is None else json.dumps(value), headers)
        response = connection.getresponse()
        result = response.status, response.read()
        connection.close()
        return result

    def report(self):
        return {'kind': 'script', 'message': 'Synthetic failure', 'location': 'app.js:24',
                'time': '2026-10-14T12:00:00Z', 'version': '1.5.1', 'workspace': 'must be dropped'}

    def test_report_survives_restart_and_excludes_productions(self):
        status, raw = self.request(value={'action': 'record', 'report': self.report()})
        self.assertEqual(status, 200)
        self.assertNotIn('workspace', json.loads(raw)['report'])
        self.stop()
        self.start()
        status, raw = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)['report']['message'], 'Synthetic failure')
        self.assertNotIn('do not attach', raw.decode())
        self.assertEqual(self.data.read_text(), '{"private": "do not attach"}')

    def test_dismissal_clears_only_saved_diagnostics(self):
        self.request(value={'action':'record','report':self.report()})
        self.request(value={'action':'record','report':self.report()})
        self.assertEqual(self.request(value={'action':'clear'})[0], 200)
        self.assertEqual(json.loads(self.request()[1]), {'report':None})
        self.assertFalse((self.data.parent / 'support-crash.previous.json').exists())
        self.assertTrue(self.data.exists())

    def test_invalid_requests_preserve_saved_report(self):
        self.request(value={'action': 'record', 'report': self.report()})
        for value in [{}, {'action': 'record'}, {'action':'record', 'report':None},
                      {'action': 'record', 'report': {'kind': 'invalid'}},
                      {'action': 'record', 'report': {**self.report(), 'message': 'x' * 501}}]:
            self.assertEqual(self.request(value=value)[0], 400)
        self.assertEqual(json.loads(self.request()[1])['report']['message'], 'Synthetic failure')

    def test_corrupt_saved_report_does_not_block_startup(self):
        for content in ['broken', '[]', '{"kind":"invalid"}']:
            (self.data.parent / 'support-crash.json').write_text(content)
            self.assertEqual(json.loads(self.request()[1]), {'report': None})

    def test_support_mutations_require_local_origin_and_header(self):
        payload = {'action': 'record', 'report': self.report()}
        self.assertEqual(self.request(value=payload, headers={})[0], 403)
        self.assertEqual(self.request(value=payload, headers={'Origin':'https://example.org','X-Slate-Local':'1'})[0], 403)
        self.assertEqual(self.request(value={'action':'record','report':{**self.report(),'message':'x'*17000}})[0], 413)
        self.assertFalse((self.data.parent / 'support-crash.json').exists())

    def test_export_only_contains_reviewed_report(self):
        content = 'What happened:\nSynthetic crash\nProduction Desk 1.5.1'
        status, raw = self.request('/api/support/export', {'content': content})
        self.assertEqual(status, 200)
        status, downloaded = self.request(json.loads(raw)['url'])
        self.assertEqual(status, 200)
        self.assertEqual(downloaded.decode(), content)
