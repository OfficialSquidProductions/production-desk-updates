#!/usr/bin/env python3
"""Build isolated native Mac TestFlight candidates with existing signing assets.

No uploads, account mutations, profile generation, or credential generation.
Bundle ID is explicit so an App Store Connect record must be inspected first.
An ad-hoc candidate is for local checks only and cannot be uploaded.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import plistlib
import shutil
import subprocess

TEAM = 'FZ298DXLS3'
MAGIC = {bytes.fromhex(s) for s in ['feedface','cefaedfe','feedfacf','cffaedfe','cafebabe','bebafeca','cafebabf','bfbafeca']}

def run(*args, **kwargs):
    return subprocess.run([str(x) for x in args], check=True, **kwargs)

def plist(path, value):
    path.write_bytes(plistlib.dumps(value))

def native(path):
    if path.is_symlink() or not path.is_file(): return False
    with path.open('rb') as stream: return stream.read(4) in MAGIC

def build(args):
    root, out = args.source.resolve(), args.output.resolve()
    if out.exists(): raise ValueError('Use a new output directory; existing builds are preserved.')
    if args.identity != '-' and not args.profile and not args.local_development:
        raise ValueError('A distribution build requires an existing Mac TestFlight provisioning profile.')
    if args.local_development:
        identities = subprocess.check_output(['security','find-identity','-v','-p','codesigning'],text=True)
        if not any(args.identity in line and 'Apple Development:' in line for line in identities.splitlines()):
            raise ValueError('Local development requires an existing Apple Development identity.')
    if not args.bundle_id or not all(c.isalnum() or c in '.-' for c in args.bundle_id):
        raise ValueError('Provide the exact inspected bundle identifier.')
    profile = None
    if args.profile:
        profile = plistlib.loads(subprocess.check_output(['security','cms','-D','-i',str(args.profile)]))
        ent = profile['Entitlements']
        if 'OSX' not in profile.get('Platform', []): raise ValueError('This is not a Mac provisioning profile.')
        if profile['TeamIdentifier'] != [TEAM]: raise ValueError('Wrong provisioning team.')
        if ent.get('com.apple.application-identifier') != TEAM + '.' + args.bundle_id: raise ValueError('Wrong profile bundle ID.')
        if profile.get('ProvisionedDevices') or profile.get('ProvisionsAllDevices') or ent.get('get-task-allow') or ent.get('com.apple.security.get-task-allow'):
            raise ValueError('A Mac App Store distribution profile is required.')
        if profile['ExpirationDate'] <= datetime.now(timezone.utc).replace(tzinfo=None):
            raise ValueError('The Mac App Store profile has expired.')
        if args.identity.upper() not in {hashlib.sha1(cert).hexdigest().upper() for cert in profile['DeveloperCertificates']}:
            raise ValueError('The existing signing identity does not match the provisioning profile.')
    if args.installer_identity:
        identities = subprocess.check_output(['security','find-identity','-v','-p','basic'],text=True)
        if not any(args.installer_identity in line and ('3rd Party Mac Developer Installer:' in line or 'Mac Installer Distribution:' in line) for line in identities.splitlines()):
            raise ValueError('Use an existing Mac Installer Distribution identity; Developer ID Installer is a different distribution channel.')
    pd = args.product == 'production-desk'
    name, executable, minimum = ('Production Desk','ProductionDesk','12.0') if pd else ('Scenic','Scenic','13.3')
    config = json.loads((root / 'desktop/release.json').read_text())
    out.mkdir(parents=True)
    cache = out / 'build'; cache.mkdir()
    archive = out / (executable + '.xcarchive')
    app = archive / 'Products/Applications' / (name + '.app')
    contents, resources = app / 'Contents', app / 'Contents/Resources'
    resources.mkdir(parents=True); (contents / 'MacOS').mkdir()
    source_dir = root / ('desktop' if pd else 'macos')
    sources = [source_dir / ('Slate.swift' if pd else 'Scenic.swift'), source_dir / 'StoreUpdates.swift']
    flags = ['-D','APP_STORE']
    if pd:
        sources.append(source_dir / 'StoreMain.swift'); flags += ['-D','SUPPORT_TESTING']
        framework = Path('/Applications/Xcode.app/Contents/Developer/Library/Frameworks/Python3.framework')
        frameworks = contents / 'Frameworks'; frameworks.mkdir()
        shutil.copytree(framework, frameworks / framework.name, symlinks=True)
        # Development tools and package installers are not part of this runtime.
        python = frameworks / 'Python3.framework/Versions/3.9'
        shutil.rmtree(python / 'lib/python3.9/site-packages')
        (python / 'lib/python3.9/site-packages').mkdir()
        # Apple's launcher execs this nested interpreter. Preserve it, give the
        # copied runtime our identity, and sign it as a sandbox-inheriting child.
        for path, identifier in [(python / 'Resources/Info.plist', args.bundle_id + '.python-framework'),
                                 (python / 'Resources/Python.app/Contents/Info.plist', args.bundle_id + '.python')]:
            metadata = plistlib.loads(path.read_bytes())
            metadata['CFBundleIdentifier'] = identifier
            metadata.pop('NSAppleScriptEnabled', None)
            if metadata.get('CFBundlePackageType') == 'APPL': metadata['LSUIElement'] = True
            plist(path, metadata)
        runtime = resources / 'runtime'; runtime.mkdir()
        for filename in ['server.py','film.py','lined.py','project_file.py']:
            shutil.copy2(root / filename, runtime / filename)
        shutil.copy2(root / 'desktop/store_server.py', runtime / 'store_server.py')
        shutil.copytree(root / 'web', runtime / 'web')
        (runtime / 'tools').mkdir()
        for arch in ['arm64','x86_64']:
            run('swiftc','-O','-g','-module-cache-path',cache / 'swift','-target',arch + '-apple-macos' + minimum,root / 'tools/extract_pdf.swift','-o',cache / ('extract_pdf-' + arch))
        run('lipo','-create',cache / 'extract_pdf-arm64',cache / 'extract_pdf-x86_64','-output',runtime / 'tools/extract_pdf')
        shutil.copy2(root.parent / 'LICENSE', resources / 'LICENSE.txt')
        shutil.copy2(root.parent / 'THIRD_PARTY_NOTICES.md', resources / 'THIRD_PARTY_NOTICES.md')
    else:
        sources.append(source_dir / 'Reports.swift')
        shutil.copytree(root / 'dist', resources / 'web')
        index = resources / 'web/index.html'
        html = index.read_text()
        footer = 'Check for Updates in the Scenic menu to review the next release before installing.'
        if html.count(footer) != 1: raise ValueError('Expected one desktop update footer.')
        index.write_text(html.replace(footer,'Get beta updates in TestFlight and released updates in the App Store.'))
        shutil.copy2(root / 'LICENSE', resources / 'Scenic-LICENSE.txt')
        shutil.copy2(root / 'desktop/changelog.json', resources / 'Scenic-Changelog.json')
    for arch in ['arm64','x86_64']:
        run('swiftc','-O','-g','-module-cache-path',cache / 'swift','-target',arch + '-apple-macos' + minimum,*flags,*sources,'-o',cache / (executable + '-' + arch))
    main = contents / 'MacOS' / executable
    run('lipo','-create',cache / (executable + '-arm64'),cache / (executable + '-x86_64'),'-output',main)
    dsym = archive / 'dSYMs' / (name + '.app.dSYM')
    shutil.copytree(cache / (executable + '-arm64.dSYM'), dsym)
    dwarf = dsym / 'Contents/Resources/DWARF'
    (dwarf / (executable + '-arm64')).unlink()
    run('lipo','-create',cache / (executable + '-arm64.dSYM/Contents/Resources/DWARF/' + executable + '-arm64'),cache / (executable + '-x86_64.dSYM/Contents/Resources/DWARF/' + executable + '-x86_64'),'-output',dwarf / executable)
    run('swiftc','-module-cache-path',cache / 'swift',source_dir / 'Icon.swift','-o',cache / 'render-icon')
    icon_source = root / ('web/assets/sp-logo.png' if pd else 'dist/assets/sp-blue.png')
    run(cache / 'render-icon',cache / 'App.iconset',icon_source)
    run('iconutil','-c','icns',cache / 'App.iconset','-o',resources / 'App.icns')
    sdk = subprocess.check_output(['xcrun','--sdk','macosx','--show-sdk-version'],text=True).strip()
    info = {'CFBundleExecutable':executable,'CFBundleIdentifier':args.bundle_id,
            'CFBundleName':name,'CFBundleDisplayName':name,'CFBundlePackageType':'APPL',
            'CFBundleShortVersionString':config['version'],'CFBundleVersion':args.build or config['build'],
            'CFBundleIconFile':'App.icns','LSMinimumSystemVersion':minimum,'NSHighResolutionCapable':True,
            'NSPrincipalClass':'NSApplication','CFBundleSupportedPlatforms':['MacOSX'],'LSApplicationCategoryType':'public.app-category.productivity',
            'ITSAppUsesNonExemptEncryption':False,'DTPlatformName':'macosx','DTSDKName':'macosx' + sdk,
            'NSHumanReadableCopyright':'Squid Productions','StoreDistribution':True}
    if pd:
        info['NSAppTransportSecurity'] = {'NSAllowsLocalNetworking':True}
    else:
        uti = 'org.squidproductions.scenic.project'
        info['CFBundleDocumentTypes'] = [{'CFBundleTypeName':'Scenic Project','CFBundleTypeRole':'Editor','LSHandlerRank':'Owner','LSItemContentTypes':[uti]}]
        info['UTExportedTypeDeclarations'] = [{'UTTypeIdentifier':uti,'UTTypeDescription':'Scenic Project','UTTypeConformsTo':['public.json'],'UTTypeTagSpecification':{'public.filename-extension':['scenic'],'public.mime-type':'application/vnd.squidproductions.scenic+json'}}]
    plist(contents / 'Info.plist', info)
    if args.profile: shutil.copy2(args.profile, contents / 'embedded.provisionprofile')
    entitlements = plistlib.loads((source_dir / 'Store.entitlements').read_bytes())
    if profile:
        for key in ['com.apple.application-identifier','com.apple.developer.team-identifier','beta-reports-active']:
            if key in profile['Entitlements']: entitlements[key] = profile['Entitlements'][key]
    signing_entitlements = cache / 'Store.entitlements'; plist(signing_entitlements, entitlements)
    identity = args.identity
    def sign(path, entitlements_file=None):
        command = ['codesign','--force','--sign',identity,'--timestamp=none' if identity == '-' or args.local_development else '--timestamp','--options','runtime']
        if entitlements_file: command += ['--entitlements',entitlements_file]
        else:
            empty = cache / 'Empty.entitlements'; plist(empty,{})
            command += ['--entitlements',empty]
        run(*command,path)
    if pd:
        files = [p for p in contents.rglob('*') if native(p) and p != main]
        for path in files:
            child = path.name in ['python3.9','Python','extract_pdf']
            sign(path,source_dir / 'StoreChild.entitlements' if child else None)
        for bundle in sorted(contents.rglob('*.app'), key=lambda p:len(p.parts), reverse=True):
            sign(bundle, source_dir / 'StoreChild.entitlements')
        framework = contents / 'Frameworks/Python3.framework'
        sign(framework)
    sign(app,signing_entitlements)
    run('codesign','--verify','--deep','--strict','--verbose=2',app)
    properties = {'ApplicationPath':'Applications/' + app.name,'CFBundleIdentifier':args.bundle_id,
                  'CFBundleShortVersionString':info['CFBundleShortVersionString'],'CFBundleVersion':info['CFBundleVersion'],
                  'SigningIdentity':identity,'Team':TEAM}
    plist(archive / 'Info.plist',{'ArchiveVersion':2,'CreationDate':datetime.now(timezone.utc).replace(tzinfo=None),
                                'Name':name,'SchemeName':name + ' Store','ApplicationProperties':properties})
    manifest = {str(p.relative_to(resources)):hashlib.sha256(p.read_bytes()).hexdigest() for p in resources.rglob('*') if p.is_file()}
    result = {'product':name,'archive':str(archive),'app':str(app),'bundleId':args.bundle_id,
              'bundleIdStatus':'explicit input; verify against App Store Connect before upload',
              'version':info['CFBundleShortVersionString'],'build':info['CFBundleVersion'],
              'localCandidateOnly':identity == '-' or args.local_development,'distributionProfile':profile['Name'] if profile else None,
              'architectures':['arm64','x86_64'],'sparkleIncluded':False,'resourceHashes':manifest}
    (out / 'build-result.json').write_text(json.dumps(result,indent=2) + '\n')
    if profile and args.installer_identity and not args.local_development:
        options = {'method':'app-store-connect','destination':'export','signingStyle':'manual',
                   'teamID':TEAM,'signingCertificate':identity,'installerSigningCertificate':args.installer_identity,
                   'provisioningProfiles':{args.bundle_id:profile['Name']},'manageAppVersionAndBuildNumber':False,
                   'testFlightInternalTestingOnly':True,'uploadSymbols':True}
        plist(out / 'ExportOptions-export.plist', options)
        options['destination'] = 'upload'
        plist(out / 'ExportOptions-upload.plist', options)
    print(json.dumps({k:v for k,v in result.items() if k != 'resourceHashes'},indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--product',choices=['scenic','production-desk'],default='production-desk')
    parser.add_argument('--source',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--bundle-id',required=True)
    parser.add_argument('--build')
    parser.add_argument('--identity',default='-',help='Existing identity; default ad-hoc is local verification only')
    parser.add_argument('--local-development',action='store_true',help='Use an existing development identity for local sandbox checks only')
    parser.add_argument('--profile',type=Path,help='Existing downloaded Mac TestFlight distribution profile')
    parser.add_argument('--installer-identity',help='Existing Mac Installer Distribution SHA-1; emits manual export/upload options')
    build(parser.parse_args())
