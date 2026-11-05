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
    from check_windows_release import release_config
    release = release_config()
    package = ROOT / 'desktop/windows/package.json'
    config = json.loads(package.read_text())
    config['version'] = release['version']
    package.write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
    from app_icon import build_windows_icon
    icon = build_windows_icon()
    subprocess.run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean',
                    '--onedir', '--console', '--name', 'ProductionDeskServer',
                    '--icon', str(icon),
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
