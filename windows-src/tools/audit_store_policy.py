#!/usr/bin/env python3
"""Audit the complete shipped Store payload, including compressed Python assets."""
import io
import plistlib
import zipfile


def audit_policy(app):
    failures, checked = [], 0
    def scan(data, name, depth=0):
        nonlocal checked
        checked += 1
        if b'itms-services' in data.lower():
            failures.append({'file':name,'installerSchemeReference':True})
        if zipfile.is_zipfile(io.BytesIO(data)):
            if depth >= 3:
                failures.append({'file':name,'uninspectedNestedArchive':True})
                return
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                for member in archive.infolist():
                    if not member.is_dir(): scan(archive.read(member), name + '!' + member.filename, depth + 1)
    for path in sorted(app.rglob('*')):
        if path.is_symlink() or not path.is_file(): continue
        relative = str(path.relative_to(app))
        if any(part.lower() in ['sparkle.framework','updater.app','autoupdate.app','installer.app'] for part in path.parts):
            failures.append({'file':relative,'externalUpdaterComponent':True})
        data = path.read_bytes()
        scan(data, relative)
        if path.name == 'Info.plist':
            info = plistlib.loads(data)
            forbidden = [key for key in info if key.startswith('SU') and key not in ['SupportedPlatforms']]
            if forbidden: failures.append({'file':relative,'sparkleMetadata':forbidden})
    info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
    if info.get('StoreDistribution') is not True: failures.append({'missingStoreDistributionMarker':True})
    if info.get('CFBundleURLTypes'): failures.append({'unexpectedIncomingURLHandler':True})
    return {'passed':not failures,'checkedPayloads':checked,'failures':failures}
