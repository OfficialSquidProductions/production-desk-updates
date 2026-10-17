#!/usr/bin/env python3
"""Package an already notarized Production Desk app in the established sealed installer."""
import argparse,json,plistlib,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser();p.add_argument('--payload',required=True,type=Path);p.add_argument('--app',required=True,type=Path);p.add_argument('--output',required=True,type=Path);a=p.parse_args()
 config=json.loads((ROOT/'desktop/release.json').read_text());info=plistlib.loads((a.app/'Contents/Info.plist').read_bytes())
 assert info['CFBundleIdentifier']=='local.slate.filmscheduler' and info['CFBundleShortVersionString']==config['version'] and info['CFBundleVersion']==config['build']
 subprocess.run(['codesign','--verify','--deep','--strict',str(a.app)],check=True);subprocess.run(['xcrun','stapler','validate',str(a.app)],check=True)
 out=a.output.resolve();assert not out.exists();resources=out/'Contents/Resources';mac=out/'Contents/MacOS';resources.mkdir(parents=True);mac.mkdir()
 shutil.copy2(a.payload,resources/'ProductionDeskPayload.zip');shutil.copy2(a.app/'Contents/Resources/ProductionDesk.icns',resources/'ProductionDesk.icns')
 metadata={'CFBundleExecutable':'InstallProductionDesk','CFBundleIdentifier':'local.productiondesk.installer','CFBundleName':'Install Production Desk','CFBundleDisplayName':'Install Production Desk','CFBundlePackageType':'APPL','CFBundleShortVersionString':config['version'],'CFBundleVersion':config['build'],'CFBundleIconFile':'ProductionDesk.icns','LSMinimumSystemVersion':'12.0','NSHighResolutionCapable':True,'NSPrincipalClass':'NSApplication'}
 (out/'Contents/Info.plist').write_bytes(plistlib.dumps(metadata))
 subprocess.run(['swiftc','-O','-module-cache-path',str(ROOT/'.cache/swift'),'-target','arm64-apple-macos12.0',str(ROOT/'desktop/InstallerNotarized.swift'),'-o',str(mac/'InstallProductionDesk')],check=True)
 print('Sealed installer ready for Developer ID signing:',out)
if __name__=='__main__':main()
