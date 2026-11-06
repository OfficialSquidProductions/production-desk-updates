"""The installed app and Store icon must derive from the original SP assets."""
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
    def test_original_sp_source_is_preserved(self):
        self.assertEqual(hashlib.sha256(ICON_SOURCE.read_bytes()).hexdigest(),
                         'b98b8278c2fe100a4a13bd9fed2607d33c3f368d078a7638af45dc3807f80a7f')
        self.assertEqual(png_metadata(ICON_SOURCE)[:2], (2000, 2000))

    def test_both_mac_builders_use_the_canonical_image(self):
        for name in ('build_macos.py', 'build_macos_store.py'):
            self.assertIn('web/assets/sp-logo.png', (ROOT / 'tools' / name).read_text())
        renderer = (ROOT / 'desktop/Icon.swift').read_text()
        self.assertIn('roundedRect', renderer)
        self.assertIn('SP logo', renderer)

    def test_ios_icon_has_opaque_store_dimensions(self):
        path = ROOT.parent / 'ios/ProductionDesk/Assets.xcassets/AppIcon.appiconset/AppIcon.png'
        width, height, depth, color, *_ = png_metadata(path)
        self.assertEqual((width, height, depth, color), (1024, 1024, 8, 2))
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),
                         'bf1af819bc5a188c1a59f89bacd56506b4d997e049b1d3c478f7fa04b1ac474b')
        for name in ('archive-local.sh', 'archive-distribution.sh'):
            self.assertNotIn('generate-app-icon.swift', (ROOT.parent / 'ios/scripts' / name).read_text())

    def test_windows_application_and_installer_share_the_icon(self):
        package = json.loads((ROOT / 'desktop/windows/package.json').read_text())
        self.assertEqual(package['build']['win']['icon'], 'assets/icon.ico')
        self.assertEqual(package['build']['nsis']['installerIcon'], 'assets/icon.ico')
        self.assertEqual(package['build']['nsis']['uninstallerIcon'], 'assets/icon.ico')
        self.assertIn('build_windows_icon()', (ROOT / 'tools/build_windows.py').read_text())

    @unittest.skipUnless(importlib.util.find_spec('PIL'), 'Pillow is installed by the Windows build requirements')
    def test_windows_ico_contains_every_size_and_original_composition(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as directory:
            path = build_windows_icon(Path(directory) / 'icon.ico')
            with Image.open(path) as icon, Image.open(ICON_SOURCE) as source:
                self.assertEqual(icon.ico.sizes(), {(size, size) for size in ICON_SIZES})
                logo = source.convert('RGBA')
                logo.thumbnail((224, 224))
                expected = Image.new('RGBA', (256, 256), (25, 20, 25, 255))
                expected.alpha_composite(logo, ((256-logo.width)//2, (256-logo.height)//2))
                self.assertEqual(icon.ico.getimage((256, 256)).convert('RGBA').tobytes(), expected.tobytes())


if __name__ == '__main__':
    unittest.main()
