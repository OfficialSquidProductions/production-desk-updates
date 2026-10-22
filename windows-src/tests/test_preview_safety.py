import importlib.util
from pathlib import Path
import plistlib
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('preview_safety',ROOT/'tools/preview_safety.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class PreviewSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name).resolve();self.app=self.root/'Dedicated Preview.app'
        (self.app/'Contents/MacOS').mkdir(parents=True);(self.app/'Contents/MacOS/ProductionDesk').write_bytes(b'preview')
        self.home=self.root/'disposable-home';self.home.mkdir()
        self.info={'CFBundleIdentifier':'local.productiondesk.import-preview.test','ProductionDeskPreview':True,'ProductionDeskBeta':True,'ProductionDeskSourceCommit':'a'*40,'SUEnableAutomaticChecks':False,'SUAutomaticallyUpdate':False,'SUAllowsAutomaticUpdates':False}
        self.write()
    def tearDown(self):self.temp.cleanup()
    def write(self):(self.app/'Contents/Info.plist').write_bytes(plistlib.dumps(self.info))
    def probe(self):return patch.object(module.subprocess,'check_output',return_value=str(self.home)+'\n'+str(self.home/'Library/Application Support')+'\n')
    def test_all_storage_and_backups_use_preview_namespace_before_launch(self):
        with self.probe():result=module.preflight(self.app,self.home)
        self.assertTrue(result['support'].endswith('ProductionDeskPreviews/preview-local.productiondesk.import-preview.test'))
        self.assertTrue(all(Path(result['support'])==Path(p).parent for p in result['storage'].values()))
        self.assertIn('workspace.previous.json',result['storage']);self.assertIn('desktop.log',result['storage']);self.assertIn('pdfs',result['storage'])
    def test_no_preview_flag_or_enabled_feed_fails_closed(self):
        for update in [{'ProductionDeskPreview':False},{'SUFeedURL':'https://example.invalid/feed'},{'SUEnableAutomaticChecks':True},{'CFBundleIdentifier':'org.squidproductions.productiondesk'}]:
            old=dict(self.info);self.info.update(update);self.write()
            with self.subTest(update=update),self.assertRaises(ValueError):module.preflight(self.app,self.home)
            self.info=old
    def test_wrong_foundation_home_and_nonempty_home_rejected(self):
        with patch.object(module.subprocess,'check_output',return_value='/Users/other\n/Users/other/Library/Application Support\n'),self.assertRaisesRegex(ValueError,'Foundation'):module.preflight(self.app,self.home)
        (self.home/'workspace.json').write_text('preserve')
        with self.assertRaisesRegex(ValueError,'empty'):module.preflight(self.app,self.home)
