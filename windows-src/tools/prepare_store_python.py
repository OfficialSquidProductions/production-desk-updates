#!/usr/bin/env python3
"""Extract a pinned PSF runtime without installing Python or running package scripts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

VERSION = '3.14.10'
ABI = '3.14'
SHA256 = '286c7018aa2730f6747ca433dccdc2b31be45f078a9ea0ffa44d5f06368fd2d7'
URL = 'https://www.python.org/ftp/python/3.14.10/python-3.14.10-macos11.pkg'
MAGIC = {bytes.fromhex(s) for s in ['feedface','cefaedfe','feedfacf','cffaedfe','cafebabe','bebafeca','cafebabf','bfbafeca']}

def native(path):
    return path.is_file() and not path.is_symlink() and path.read_bytes()[:4] in MAGIC

def hashes(root):
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(root.rglob('*')) if p.is_file() and not p.is_symlink()}

def symlinks(root):
    result = {}
    for path in sorted(root.rglob('*')):
        if path.is_symlink():
            if not path.resolve().is_relative_to(root.resolve()) or not path.exists():
                raise ValueError('Runtime symlink is missing or escapes its framework: ' + str(path))
            result[str(path.relative_to(root))] = os.readlink(path)
    return result

def prepare(installer, output):
    if hashlib.sha256(installer.read_bytes()).hexdigest() != SHA256:
        raise ValueError('Installer does not match the pinned official Python release.')
    signature = subprocess.check_output(['pkgutil', '--check-signature', str(installer)], text=True)
    if 'Python Software Foundation (BMM5U3QVKW)' not in signature or 'Status: signed by a developer certificate issued by Apple for distribution' not in signature:
        raise ValueError('Installer signature is not the trusted PSF distribution signature.')
    if output.exists():
        raise ValueError('Use a new runtime output directory.')
    with tempfile.TemporaryDirectory(prefix='productiondesk-python-', dir=output.parent) as temporary:
        expanded = Path(temporary) / 'expanded'
        subprocess.run(['pkgutil','--expand-full',str(installer),str(expanded)], check=True)
        framework = output / 'Python.framework'
        shutil.copytree(expanded / 'Python_Framework.pkg/Payload', framework, symlinks=True)
        for name in ['License.rtf','ReadMe.rtf']:
            shutil.copy2(expanded / 'Resources' / name, framework / 'Resources' / ('Python-Installer-' + name))
    version = framework / 'Versions' / ABI
    # The app uses AppKit/WebKit and PDFKit. Tcl/Tk and XZ/LZMA are unused;
    # remove those complete optional modules rather than editing their symbols.
    removed = []
    patterns = ['Headers','Frameworks','share','lib/pkgconfig','lib/python3.14/config-*',
                'lib/python3.14/test','lib/python3.14/idlelib','lib/python3.14/tkinter',
                'lib/python3.14/turtle*','lib/python3.14/turtledemo','lib/python3.14/lzma.py',
                'lib/python3.14/ensurepip','lib/python3.14/site-packages/*',
                'lib/python3.14/lib-dynload/_tkinter.*','lib/python3.14/lib-dynload/_lzma.*',
                'lib/python3.14/lib-dynload/*test*','lib/python3.14/lib-dynload/xx*',
                'bin/*config*','bin/*intel64','bin/idle*','bin/pydoc*']
    for pattern in patterns:
        for path in version.glob(pattern):
            removed.append(str(path.relative_to(framework)))
            if path.is_dir() and not path.is_symlink(): shutil.rmtree(path)
            else: path.unlink()
    for path in list(framework.rglob('__pycache__')):
        shutil.rmtree(path)
    (framework / 'Headers').unlink()
    prefix = '/Library/Frameworks/Python.framework/Versions/' + ABI + '/'
    changes = []
    for path in framework.rglob('*'):
        if not native(path): continue
        # Relocate actual dynamic dependencies to other packaged files. No
        # private API, symbol or diagnostic string is rewritten or concealed.
        linked = subprocess.check_output(['otool','-L',str(path)],text=True)
        dependencies = {line.strip().split(' (',1)[0] for line in linked.splitlines()[1:] if line.startswith('\t')}
        command = ['install_name_tool']
        for dependency in sorted(dependencies):
            if dependency.startswith(prefix):
                target = version / dependency[len(prefix):]
                if not target.exists(): raise ValueError('Missing bundled dependency: ' + dependency)
                relative = '@loader_path/' + os.path.relpath(target, path.parent)
                command += ['-change',dependency,relative]
                changes.append([str(path.relative_to(framework)),dependency,relative])
        if path == version / 'Python': command += ['-id','@rpath/Python.framework/Versions/' + ABI + '/Python']
        elif path.suffix == '.dylib': command += ['-id','@rpath/' + path.name]
        if len(command) > 1: subprocess.run(command + [str(path)],check=True,stdout=subprocess.DEVNULL)
        subprocess.run(['codesign','--remove-signature',str(path)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    manifest = {'version':VERSION,'abi':ABI,'url':URL,'installerSha256':SHA256,
                'signature':signature,'removedUnusedComponents':removed,'relocations':changes,
                'hashes':hashes(framework),'symlinks':symlinks(framework)}
    (output / 'runtime-source.json').write_text(json.dumps(manifest,indent=2) + '\n')
    print(framework)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--installer',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args = parser.parse_args()
    prepare(args.installer.resolve(),args.output.resolve())
