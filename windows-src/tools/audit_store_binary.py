#!/usr/bin/env python3
"""Fail closed on Apple's complete 2026-10-26 rejection list and external linkage."""
import argparse
import json
from pathlib import Path
import re
import subprocess

MAGIC = {bytes.fromhex(s) for s in ['feedface','cefaedfe','feedfacf','cffaedfe','cafebabe','bebafeca','cafebabf','bfbafeca']}
TCL = '''TclBN_mp_clear TclBN_mp_init TclBN_mp_read_radix TclBN_mp_to_unsigned_bin_n
TclBN_mp_unsigned_bin_size TclFreeObj Tcl_AddErrorInfo Tcl_AttemptAlloc
Tcl_ConditionFinalize Tcl_ConditionNotify Tcl_ConditionWait Tcl_CreateFileHandler
Tcl_CreateInterp Tcl_CreateObjCommand Tcl_CreateTimerHandler Tcl_DeleteCommand
Tcl_DeleteFileHandler Tcl_DeleteInterp Tcl_DeleteTimerHandler Tcl_DoOneEvent
Tcl_Eval Tcl_EvalFile Tcl_EvalObjv Tcl_ExprBoolean Tcl_ExprDouble Tcl_ExprLong
Tcl_ExprString Tcl_FindExecutable Tcl_Free Tcl_GetBignumFromObj Tcl_GetBoolean
Tcl_GetBooleanFromObj Tcl_GetByteArrayFromObj Tcl_GetCurrentThread Tcl_GetDouble
Tcl_GetDoubleFromObj Tcl_GetLongFromObj Tcl_GetObjResult Tcl_GetObjType Tcl_GetString
Tcl_GetStringFromObj Tcl_GetStringResult Tcl_GetThreadData Tcl_GetVar Tcl_GetVar2Ex
Tcl_GetWideIntFromObj Tcl_Init Tcl_ListObjGetElements Tcl_ListObjIndex
Tcl_ListObjLength Tcl_MutexLock Tcl_MutexUnlock Tcl_NewBignumObj Tcl_NewBooleanObj
Tcl_NewByteArrayObj Tcl_NewDoubleObj Tcl_NewListObj Tcl_NewLongObj Tcl_NewStringObj
Tcl_NewWideIntObj Tcl_RecordAndEval Tcl_ResetResult Tcl_SetObjResult Tcl_SetVar
Tcl_SetVar2 Tcl_SetVar2Ex Tcl_SplitList Tcl_ThreadAlert Tcl_ThreadQueueEvent Tcl_UnsetVar2'''.split()
LZMA = '''lzma_alone_decoder lzma_alone_encoder lzma_auto_decoder lzma_check_is_supported
lzma_code lzma_easy_encoder lzma_end lzma_get_check lzma_lzma_preset
lzma_properties_decode lzma_properties_encode lzma_properties_size lzma_raw_decoder
lzma_raw_encoder lzma_stream_decoder lzma_stream_encoder'''.split()
SYMBOLS = ['_' + symbol for symbol in TCL + LZMA]

def audit(app, output):
    app = app.resolve()
    records, failures = [], []
    for path in sorted(app.rglob('*')):
        if path.is_symlink():
            if not path.resolve().is_relative_to(app) or not path.exists(): failures.append({'file':str(path.relative_to(app)),'missingOrEscapingSymlink':True})
            continue
        if not path.is_file(): continue
        with path.open('rb') as stream:
            if stream.read(4) not in MAGIC: continue
        relative = str(path.relative_to(app))
        linked = subprocess.check_output(['otool','-L',str(path)],text=True)
        symbols = subprocess.check_output(['nm','-u',str(path)],text=True,stderr=subprocess.DEVNULL)
        strings = subprocess.check_output(['strings','-a',str(path)],text=True,errors='replace')
        arches = subprocess.check_output(['lipo','-archs',str(path)],text=True).strip().split()
        dependencies = sorted({line.strip().split(' (',1)[0] for line in linked.splitlines() if line.startswith('\t')})
        hits = [symbol for symbol in SYMBOLS if re.search(r'(?<![A-Za-z0-9_])' + re.escape(symbol) + r'(?![A-Za-z0-9_])', symbols + '\n' + strings)]
        if hits: failures.append({'file':relative,'rejectedSymbols':hits})
        if '/PrivateFrameworks/' in linked + strings or 'TrustEvaluationAgent' in linked + strings:
            failures.append({'file':relative,'privateFrameworkReference':True})
        if set(arches) != {'arm64','x86_64'}: failures.append({'file':relative,'architectures':arches})
        for dependency in dependencies:
            if dependency.startswith('@loader_path/'):
                target = (path.parent / dependency[len('@loader_path/'):]).resolve()
                if not target.is_relative_to(app) or not target.is_file():
                    failures.append({'file':relative,'missingOrEscapingDependency':dependency})
            elif dependency.startswith('@executable_path/'):
                target = (app / 'Contents/MacOS' / dependency[len('@executable_path/'):]).resolve()
                if not target.is_relative_to(app) or not target.is_file(): failures.append({'file':relative,'missingOrEscapingDependency':dependency})
            elif dependency.startswith('@rpath/'):
                # Only a dylib's own install name may remain @rpath: all actual
                # bundled runtime dependencies are resolved relative to their loader.
                ids = subprocess.check_output(['otool','-D',str(path)],text=True).splitlines()
                if dependency not in [line.strip() for line in ids]: failures.append({'file':relative,'unresolvedRpathDependency':dependency})
            elif not dependency.startswith(('/System/Library/Frameworks/','/usr/lib/')):
                failures.append({'file':relative,'externalDependency':dependency})
        records.append({'file':relative,'architectures':arches,'dependencies':dependencies,'rejectedSymbolMatches':hits})
    if not records: failures.append({'emptyNativeAudit':True})
    result = {'passed':not failures,'rejectionDate':'2026-10-26','symbolCount':len(SYMBOLS),
              'forbiddenSymbols':SYMBOLS,'nativeFileCount':len(records),'files':records,'failures':failures}
    output.write_text(json.dumps(result,indent=2) + '\n')
    if failures: raise ValueError('Packaged binary audit failed; see ' + str(output))
    print('Binary audit passed:', len(records), 'universal native files;', len(SYMBOLS), 'rejected symbols absent.')
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('app',type=Path)
    parser.add_argument('--output',type=Path,required=True)
    args = parser.parse_args()
    audit(args.app,args.output)
