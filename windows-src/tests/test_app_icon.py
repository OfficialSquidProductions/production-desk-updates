"""The installed app and Store icon must derive from the approved full artwork."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from app_icon import ICON_SOURCE, ICON_SIZES, build_windows_icon


def png_metadata(path):
    data = path.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Expected PNG')
    return struct.unpack('>IIBBBBB', data[16:29])


class AppIconTests(unittest.TestCase):
    def test_canonical_artwork_is_the_supplied_image(self):
        self.assertEqual(hashlib.sha256(ICON_SOURCE.read_bytes()).hexdigest(),
                         '2b6fd2cbe192de93c65c1697b64e5e5c87d55c217bf08f113c81b37475b32273')
        self.assertEqual(png_metadata(ICON_SOURCE)[:2], (2048, 2048))

    def test_both_mac_builders_use_the_canonical_image(self):
        for name in ('build_macos.py', 'build_macos_store.py'):
            self.assertIn('desktop/assets/ProductionDesk.png', (ROOT / 'tools' / name).read_text())
        renderer = (ROOT / 'desktop/Icon.swift').read_text()
        self.assertNotIn('roundedRect', renderer)
        self.assertNotIn('SP logo', renderer)

    def test_ios_icon_has_opaque_store_dimensions(self):
        path = ROOT.parent / 'ios/ProductionDesk/Assets.xcassets/AppIcon.appiconset/AppIcon.png'
        width, height, depth, color, *_ = png_metadata(path)
        self.assertEqual((width, height, depth, color), (1024, 1024, 8, 2))
        self.assertIn('windows-src/desktop/assets/ProductionDesk.png',
                      (ROOT.parent / 'ios/scripts/generate-app-icon.swift').read_text())

    def test_windows_application_and_installer_share_the_icon(self):
        package = json.loads((ROOT / 'desktop/windows/package.json').read_text())
        self.assertEqual(package['build']['win']['icon'], 'assets/icon.ico')
        self.assertEqual(package['build']['nsis']['installerIcon'], 'assets/icon.ico')
        self.assertEqual(package['build']['nsis']['uninstallerIcon'], 'assets/icon.ico')
        self.assertIn('build_windows_icon()', (ROOT / 'tools/build_windows.py').read_text())

    @unittest.skipUnless(importlib.util.find_spec('PIL'), 'Pillow is installed by the Windows build requirements')
    def test_windows_ico_contains_every_size_and_exact_full_artwork(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as directory:
            path = build_windows_icon(Path(directory) / 'icon.ico')
            with Image.open(path) as icon, Image.open(ICON_SOURCE) as source:
                self.assertEqual(icon.ico.sizes(), {(size, size) for size in ICON_SIZES})
                expected = source.convert('RGBA').resize((256, 256), Image.Resampling.LANCZOS)
                self.assertEqual(icon.ico.getimage((256, 256)).convert('RGBA').tobytes(), expected.tobytes())


if __name__ == '__main__':
    unittest.main()
