import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('windows_release', Path(__file__).resolve().parents[1] / 'tools/check_windows_release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class WindowsReleaseTests(unittest.TestCase):
    def test_newer_versions_publish(self):
        for previous, candidate in [('1.4.4', '1.4.5'), ('1.9.9', '1.10.0'), ('1.9.9', '2.0.0')]:
            with self.subTest(previous=previous, candidate=candidate):
                self.assertTrue(release.should_publish(candidate, previous))

    def test_same_version_is_validation_only(self):
        self.assertFalse(release.should_publish('1.4.5', '1.4.5'))

    def test_older_version_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'older'):
            release.should_publish('1.4.4', '1.4.5')

    def test_first_release_and_invalid_versions(self):
        self.assertTrue(release.should_publish('1.4.5', None))
        for value in ['1.4', '1.4.5+6', '01.4.5', '', None]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                release.should_publish(value, None)

    def test_release_manifests_match(self):
        import json
        root = Path(__file__).resolve().parents[1]
        version = json.loads((root / 'desktop/release.json').read_text())['version']
        package = json.loads((root / 'desktop/windows/package.json').read_text())
        lock = json.loads((root / 'desktop/windows/package-lock.json').read_text())
        self.assertEqual(package['version'], version)
        self.assertEqual(lock['version'], version)
        self.assertEqual(lock['packages']['']['version'], version)

    def test_beta_cannot_publish_even_when_called_as_main(self):
        import json
        import sys
        import tempfile
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'desktop').mkdir()
            (root / 'desktop/release.json').write_text(json.dumps({'channel':'beta','version':'1.5.0-beta.1'}))
            output = root / 'outputs'
            args = ['gate','--repository','owner/repo','--event','push','--ref','refs/heads/main','--output',str(output)]
            with patch.object(release,'ROOT',root), patch.object(sys,'argv',args), patch.object(release,'latest_version') as latest:
                release.main()
                self.assertIn('publish=false',output.read_text())
                latest.assert_not_called()
                with patch.object(sys,'argv',args+['--require-newer']), self.assertRaisesRegex(ValueError,'Beta'):
                    release.main()
