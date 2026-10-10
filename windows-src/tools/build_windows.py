#!/usr/bin/env python3
"""Build a complete offline Windows installer on a Windows x64 machine."""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    if sys.platform != 'win32':
        raise SystemExit('Run this builder on Windows x64, or use the Windows GitHub Actions workflow.')
    release = json.loads((ROOT / 'desktop/release.json').read_text())
    package = ROOT / 'desktop/windows/package.json'
    config = json.loads(package.read_text())
    config['version'] = release['version']
    package.write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
    from PIL import Image
    assets = ROOT / 'desktop/windows/assets'
    assets.mkdir(parents=True, exist_ok=True)
    logo = Image.open(ROOT / 'web/assets/sp-logo.png').convert('RGBA')
    logo.thumbnail((224, 224))
    canvas = Image.new('RGBA', (256, 256), (25, 20, 25, 255))
    canvas.alpha_composite(logo, ((256-logo.width)//2, (256-logo.height)//2))
    canvas.save(assets / 'icon.ico', sizes=[(16,16), (32,32), (48,48), (64,64), (128,128), (256,256)])
    subprocess.run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean',
                    '--onedir', '--console', '--name', 'ProductionDeskServer',
                    '--distpath', str(ROOT / 'build/windows/backend'),
                    '--workpath', str(ROOT / 'build/windows/pyinstaller'),
                    '--specpath', str(ROOT / 'build/windows'),
                    '--paths', str(ROOT), '--collect-all', 'pypdf',
                    '--add-data', str(ROOT / 'web') + os.pathsep + 'web',
                    str(ROOT / 'server.py')], check=True, cwd=ROOT)
    subprocess.run(['npm.cmd', 'ci'], check=True, cwd=package.parent)
    subprocess.run(['npm.cmd', 'run', 'dist'], check=True, cwd=package.parent)


if __name__ == '__main__':
    main()
