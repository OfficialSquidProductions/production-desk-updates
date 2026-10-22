#!/usr/bin/env python3
"""Check preview identity and all storage paths before launching its executable."""
import argparse
import json
import os
from pathlib import Path
import plistlib
import re
import subprocess


def preflight(app, home=None, require_empty=True):
    app=Path(app).resolve()
    info=plistlib.loads((app/'Contents/Info.plist').read_bytes())
    identity=info.get('CFBundleIdentifier','')
    if info.get('ProductionDeskPreview') is not True or not identity.startswith('local.productiondesk.'):
        raise ValueError('This is not a dedicated local Production Desk preview.')
    for key in ['SUEnableAutomaticChecks','SUAutomaticallyUpdate','SUAllowsAutomaticUpdates']:
        if info.get(key) is not False:raise ValueError('Preview updates must be disabled: '+key)
    if info.get('SUFeedURL'):raise ValueError('A preview must not contain an update feed.')
    if not re.fullmatch('[0-9a-f]{40}',info.get('ProductionDeskSourceCommit','')):
        raise ValueError('Preview source commit is missing.')
    executable=app/'Contents/MacOS/ProductionDesk'
    if not executable.is_file():raise ValueError('Preview executable is missing.')
    env=dict(os.environ)
    if home:
        home=Path(home).resolve()
        if not home.is_dir() or (require_empty and any(home.iterdir())):raise ValueError('Choose a new, empty disposable preview home.')
        env['CFFIXED_USER_HOME']=str(home)
    else:
        env.pop('CFFIXED_USER_HOME',None)
    probe=subprocess.check_output(['swift','-module-cache-path','/tmp/pd-preview-swift','-e','import Foundation; let f=FileManager.default; print(f.homeDirectoryForCurrentUser.path); print((try f.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:false)).path)'],env=env,text=True).splitlines()
    if len(probe)!=2:raise ValueError('Foundation storage probe failed.')
    support=Path(probe[1])
    if home and probe!=[str(home),str(home/'Library/Application Support')]:raise ValueError('Foundation did not honor the disposable preview home.')
    safe=''.join(c if c.isascii() and (c.isalnum() or c in '.-') else '_' for c in identity)[:100] or 'local'
    data=support/'ProductionDeskPreviews'/('preview-'+safe)
    for production in ['Slate','ProductionDeskBeta']:
        if data.resolve()==(support/production).resolve() or (support/production).resolve() in data.resolve().parents:raise ValueError('Preview storage overlaps production data.')
    # Native Preview routing was verified in SupportSessionCheck; every backend
    # path derives from this directory. Check direct-launch routing as well as
    # the temporary home before starting either AppKit or its child process.
    return {'artifact':str(app),'sourceCommit':info['ProductionDeskSourceCommit'],'identity':identity,'home':probe[0],'support':str(data),'storage':{name:str(data/name) for name in ['workspace.json','workspace.previous.json','app-settings.json','app-settings.previous.json','desktop.log','support-session.json','support-crash.json','support-crash.previous.json','pdfs']},'updatesDisabled':True}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--app',type=Path,required=True);parser.add_argument('--home',type=Path);args=parser.parse_args()
    print(json.dumps(preflight(args.app,args.home),indent=2))
