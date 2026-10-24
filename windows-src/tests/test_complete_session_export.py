"""Lossless rich-production handoff with the sender's storage removed."""
import base64
import copy
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from project_file import export_project, import_project
from server import atomic_save, json_object


def rich_project():
    value = json.loads((Path(__file__).resolve().parents[1] / 'web/demo/the-last-light.productiondesk').read_bytes())
    p = value['workspace']['projects'][0]
    b = p['breakdowns'][0]
    p['project'] = 'Café, "lighthouse" — 東京 🎬'
    b['description'] = 'Maya says "bonjour", then leaves.\nSecond line — café.'
    b['comments'] = 'Continuity\r\nPreserve key, map and cast tags.'
    b['_completed'] = True
    b['_needsReview'] = True
    p['_sourceScript']['text'] += '\n# Complete original source: café 東京 🎬\n'
    p['_breakdownSettings'] = {'continuousScroll': True, 'futureProjectOption': [False, 'preserve']}
    p['_shotSettings'] = {'startTime': '06:45', 'futureSetting': {'preserved': True}}
    p['_shotShootingOrder'] = [s['id'] for s in reversed(p['_shots'])] + ['older-client-stale-id']
    p['_extension'] = {'notes': 'Unknown persisted project data', 'sceneId': b['id'], 'shotId': p['_shots'][0]['id']}
    p['_shots'][0].update(status='Done', takes=4, circleTake='3', actualMinutes=11, notes='ÉLI, "close"\nKeep the take.')
    p['categories'].append({'id': 'qa-custom-category', 'ucid': 999, 'name': 'Custom department', 'created': p['created']})
    p['elements'].append({'id': 'qa-custom-element', 'category': 'qa-custom-category', 'created': p['created'],
                          'name': 'Lantern, "brass"\n東京', 'daysOff': [], 'events': [], 'linkedElements': [p['elements'][0]['id']]})
    b['elements'].append('qa-custom-element')
    cast_category = next(c['id'] for c in p['categories'] if c['ucid'] == 100)
    cast = next(e for e in p['elements'] if e['category'] == cast_category)
    cast.update(name='ÉLI, "principal"', daysOff=[0, 3], events=[{'id': 'qa-cast-day-off', 'type': 'dayOff', 'date': '2026-11-05T12:00:00.000Z', 'name': 'Unavailable'}])
    p['elements'][0]['linkedElements'] = [cast['id']]
    document = p['_linedScript']['documents'][0]
    document['marks'][0].update(labelAt=[-.23, .14], space='document', endPage=1)
    document['marks'][1]['labelAt'] = [1.24, .7]
    document['marks'].append({'id': 'qa-unlinked', 'type': 'coverage', 'page': 0, 'start': [.4, .2], 'end': [.4, .8],
                              'color': '#E60026', 'width': 2, 'style': 'wavy', 'shotId': None, 'labelAt': [1.2, .4],
                              'draft': {'sceneId': b['id'], 'number': 'Unlinked', 'description': 'Keep draft coverage details'}})
    raw = base64.b64decode(value['workspace']['_pdfDocuments'][document['sha256']]) + b'\n% Second portable QA revision\n'
    digest = hashlib.sha256(raw).hexdigest()
    revision = copy.deepcopy(document)
    revision.update(sha256=digest, filename='Revision two — café.pdf')
    for mark in revision['marks']:
        mark['id'] = 'revision-two-' + mark['id']
    p['_linedScript']['documents'].append(revision)
    p['_linedScript']['activePdf'] = digest
    value['workspace']['_pdfDocuments'][digest] = base64.b64encode(raw).decode('ascii')
    scenario = copy.deepcopy(p['stripboards'][0])
    scenario['id'] = 'qa-alternate-scenario'
    scenario['name'] = 'Alternate filming schedule'
    for n, board in enumerate(scenario['boards']):
        board['id'] = 'qa-alternate-board-' + str(n)
    scenario['boards'][0]['breakdownIds'].reverse()
    p['stripboards'].append(scenario)
    return value


class CompleteSessionExportTests(unittest.TestCase):
    def test_rich_demo_survives_sender_removal_fresh_recipient_edit_and_reexport(self):
        envelope = rich_project()
        original = copy.deepcopy(envelope)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            sender = root / 'sender/workspace.json'
            sender.parent.mkdir()
            workspace = import_project(sender, envelope)
            atomic_save(sender, workspace)
            source_files = {p.relative_to(sender.parent): p.read_bytes() for p in sender.parent.rglob('*') if p.is_file()}
            saved = json_object(sender.read_bytes())
            before = copy.deepcopy(saved)
            portable = json.loads(export_project(sender, saved))
            self.assertEqual(saved, before)
            self.assertEqual(envelope, original)
            self.assertEqual(portable, original)
            self.assertEqual(source_files, {p.relative_to(sender.parent): p.read_bytes() for p in sender.parent.rglob('*') if p.is_file()})
            shutil.rmtree(sender.parent)
            recipient = root / 'recipient/workspace.json'
            received = import_project(recipient, portable)
            self.assertEqual(received['projects'], original['workspace']['projects'])
            for digest, encoded in original['workspace']['_pdfDocuments'].items():
                self.assertEqual((recipient.parent / 'pdfs' / (digest + '.pdf')).read_bytes(), base64.b64decode(encoded))
            # Work normally after import; retain every other project field.
            received['projects'][0]['breakdowns'][0]['comments'] = 'Recipient editing — café\nKeeps all tags.'
            received['projects'][0]['_shots'][0]['notes'] = 'Recipient camera note'
            received['projects'][0]['_linedScript']['documents'][0]['marks'][0]['labelAt'] = [-.3, .2]
            atomic_save(recipient, received)
            reexported = json.loads(export_project(recipient, json_object(recipient.read_bytes())))
            expected = copy.deepcopy(original)
            expected['workspace']['projects'] = received['projects']
            self.assertEqual(reexported, expected)
            third = root / 'third-profile/workspace.json'
            self.assertEqual(import_project(third, reexported)['projects'], received['projects'])
            self.assertFalse(sender.exists())
            self.assertEqual(envelope, original)

    def test_malformed_rich_relationships_and_pdf_fail_before_any_asset_write(self):
        for kind in ['tag', 'linked-element', 'shot', 'label', 'original-pdf']:
            value = rich_project()
            p = value['workspace']['projects'][0]
            if kind == 'tag': p['breakdowns'][0]['elements'].append('missing-tag')
            if kind == 'linked-element': p['elements'][0]['linkedElements'] = ['missing']
            if kind == 'shot': p['_shots'][0]['sceneId'] = 'missing'
            if kind == 'label': p['_linedScript']['documents'][0]['marks'][0]['labelAt'] = [-3, .2]
            if kind == 'original-pdf': value['workspace']['_pdfDocuments'][next(iter(value['workspace']['_pdfDocuments']))] = 'JVBERS1iYWQ='
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as folder:
                datafile = Path(folder) / 'workspace.json'
                datafile.write_text('{"existing":"work"}')
                with self.assertRaises(ValueError): import_project(datafile, value)
                self.assertEqual(datafile.read_text(), '{"existing":"work"}')
                self.assertFalse((datafile.parent / 'pdfs').exists())
