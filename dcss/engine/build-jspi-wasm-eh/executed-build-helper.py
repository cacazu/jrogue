"""Build the complete native-Wasm-EH JSPI candidate in separate source/cache.

--check validates the retained full legacy graph; --build is the authorized
sequential compiler/link operation. No original source, object or bundle edits.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
NEW_SOURCE = ROOT/'engine/work-wasm-eh/crawl-ref/source'
NEW_BUILD = ROOT/'engine/build-jspi-wasm-eh'
ACTIVE = ROOT/'engine/build-jspi'
HISTORY = ROOT/'engine/history/jspi-js-eh-20261002'
COMPFLAG = ('#pragma once\n'
 '#define CRAWL_CFLAGS "Emscripten -std=c++11 -O1 -fwasm-exceptions"\n'
 '#define CRAWL_LDFLAGS "JSPI browser console (native Wasm exceptions)"\n'
 '#define CRAWL_HOST "Windows build host"\n'
 '#define CRAWL_ARCH "wasm32"\n')

def utc():
    return datetime.now(timezone.utc).isoformat()

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name,path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024), b''):
            h.update(block)
    return h.hexdigest()

def fixture_gate():
    path = ROOT/'tests/jspi-suspension/out/diagnostic-results.json'
    report = json.loads(path.read_text())
    variants = {item['variant']:item['driver'] for item in report['results']}
    for name in ('wasm-eh','wasm-eh-ctor'):
        if variants[name].get('status') != 'pass' or variants[name].get('mainStatus') != 0:
            raise ValueError('Native EH fixture did not pass: '+name)
    if variants['js-eh'].get('error') != 'SuspendError: trying to suspend JS frames':
        raise ValueError('Legacy indirect-suspension fixture receipt changed')
    if variants['js-eh-ctor'].get('error') != 'SuspendError: trying to suspend without WebAssembly.promising':
        raise ValueError('Legacy synchronous-constructor fixture receipt changed')
    sources = {name:digest(ROOT/'tests/jspi-suspension'/name)
               for name in ('caller.cpp','callee.cpp','fixture.h','library.js','driver.cjs')}
    expected = {'caller.cpp':'92851199f5a4a92511441f5ec26f4a804b5f1579acd5d46f01164e57262ad863',
        'callee.cpp':'129d1c856af3fc41a94f5da41ecc4813ab3e8e0e8194fdd6ddf4cdc17caf10f2',
        'fixture.h':'8146deb46a5aeed2a3ee0d793805e431ff419307ab619655ecc906e8cafbcb03',
        'library.js':'d35a0b3f85729c683e0676535b0ac8966f27b34f67298187df3ea4aa8dd0e1ba',
        'driver.cjs':'d4ce2313159befcfa9120be6ec29dded703852b9307b78537cc49688dbcff7dc'}
    if sources != expected:
        raise ValueError('Diagnostic source differs from tested fixture')
    return {'path':path.relative_to(ROOT).as_posix(),'sha256':digest(path),
            'source_hashes':sources,'native_variants_passed':['wasm-eh','wasm-eh-ctor'],
            'legacy_failures':{name:variants[name]['error'] for name in ('js-eh','js-eh-ctor')}}

def excluded(path):
    return path.suffix.lower() in {'.png','.jpg','.jpeg','.ogg','.wav','.mp3','.psd','.xcf'} or '.git' in path.parts

def prepare_copy(original):
    if not NEW_SOURCE.exists():
        def ignore(directory,names):
            return [name for name in names if excluded(Path(directory)/name)]
        shutil.copytree(original,NEW_SOURCE,ignore=ignore)
        (NEW_SOURCE/'compflag.h').write_text(COMPFLAG,encoding='utf-8')
    if (NEW_SOURCE/'compflag.h').read_text(encoding='utf-8') != COMPFLAG:
        raise ValueError('Unrecognized native-EH work metadata; refusing to overwrite')
    retained = []
    for old in sorted(original.rglob('*')):
        if not old.is_file() or excluded(old):
            continue
        relative = old.relative_to(original)
        new = NEW_SOURCE/relative
        if relative.as_posix() == 'compflag.h':
            continue
        if not new.is_file() or digest(old) != digest(new):
            raise ValueError('Native work copy source/header drift: '+str(relative))
        retained.append({'path':relative.as_posix(),'sha256':digest(old)})
    return {'files_equal_original_except_compflag':len(retained),
            'inventory_sha256':hashlib.sha256(json.dumps(retained,sort_keys=True).encode()).hexdigest(),
            'compflag_sha256':digest(NEW_SOURCE/'compflag.h'),
            'metadata_only_difference':'compflag.h compiler/link description'}

def save_json(path,value):
    path.write_text(json.dumps(value,indent=2),encoding='utf-8')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check',action='store_true')
    mode.add_argument('--build',action='store_true')
    parser.add_argument('--compile-only',action='store_true')
    args = parser.parse_args()
    legacy = load_module('dcss_legacy_jspi',ROOT/'tools/engine-link-jspi.py')
    builder = legacy.load_builder()
    _, base = legacy.validate(builder)
    evidence = fixture_gate()
    original_source = builder.SOURCE
    original_common = list(builder.COMMON)
    native_common = [flag.replace(str(original_source),str(NEW_SOURCE)) for flag in original_common]
    if native_common.count('-fexceptions') != 1:
        raise ValueError('Unexpected original exception flags')
    native_common = ['-fwasm-exceptions' if flag=='-fexceptions' else flag for flag in native_common]
    if not args.build:
        print(json.dumps({'upstream_commit':base['upstream_commit'],'units':333,
            'original_objects_validated':333,'native_source':str(NEW_SOURCE),'native_build':str(NEW_BUILD),
            'cxx_flags':native_common+['-std=c++11'],'fixture':evidence,
            'emcc_cores':1,'binaryen_cores':1,'original_compiler_fingerprint':base['compiler_fingerprint']},indent=2))
        return
    if (ROOT/'engine/.hold-link').exists():
        raise RuntimeError('Explicit parent heavy-job hold is present')
    NEW_BUILD.mkdir(parents=True,exist_ok=True)
    copy_receipt = prepare_copy(original_source)
    builder.SOURCE = NEW_SOURCE
    builder.BUILD = NEW_BUILD
    builder.COMMON = native_common
    builder.ENV = dict(builder.ENV,EMCC_CORES='1',BINARYEN_CORES='1')
    builder.BUILD_FINGERPRINT = builder.compiler_fingerprint()
    native_units = builder.units()
    if len(native_units) != 333 or builder.BUILD_FINGERPRINT == base['compiler_fingerprint']:
        raise ValueError('Fresh flag/header source fingerprint is required')
    provenance = {key:value for key,value in base.items() if key not in ('objects','outputs','cxx_flags','compiler_fingerprint','host_contract','link_helper_sha256')}
    provenance.update({'runtime':'jspi','exception_model':'wasm','support_longjmp':'wasm (official SDK default for -fwasm-exceptions)',
        'units':333,'cxx_flags':native_common+['-std=c++11'],'compiler_fingerprint':builder.BUILD_FINGERPRINT,
        'original_compiler_fingerprint':base['compiler_fingerprint'],'source_copy':copy_receipt,
        'fixture':evidence,'build_helper_sha256':digest(Path(__file__)),'emcc_cores':1,'binaryen_cores':1,
        'objects_recompiled':0,'objects_reused':0,'build_started_utc':utc(),'pid':os.getpid(),
        'host_contract':dict(base['host_contract'],exception_gate='native-EH tiny ctor/suspension/catch fixtures passed; full DCSS runtime pending')})
    save_json(NEW_BUILD/'build-state.json',provenance)
    compile_start = time.monotonic()
    failures = []
    for index,pair in enumerate(native_units,1):
        start = time.monotonic()
        try:
            result = builder.compile_unit(pair)
            provenance['objects_reused' if result.endswith(' (cached)') else 'objects_recompiled'] += 1
            print(json.dumps({'stage':'compile','index':index,'units':333,'source':result,
                              'wall_seconds':time.monotonic()-start,'time':utc()}),flush=True)
        except Exception as error:
            failures.append(str(error))
            print('FAILED '+str(error),flush=True)
    provenance.update({'compile_finished_utc':utc(),'compile_wall_seconds':time.monotonic()-compile_start,'failures':failures})
    objects = []
    for source,output in native_units:
        source_hash = digest(source)
        key = hashlib.sha256((builder.BUILD_FINGERPRINT+source_hash).encode()).hexdigest()
        if not output.is_file() or not output.with_suffix('.fingerprint').is_file() or output.with_suffix('.fingerprint').read_text()!=key:
            failures.append('Native object cache invalid: '+str(source))
        else:
            objects.append({'source':source.relative_to(ROOT).as_posix(),'source_sha256':source_hash,
                'object':output.relative_to(ROOT).as_posix(),'object_sha256':digest(output),'fingerprint':key})
    provenance['objects'] = objects
    save_json(NEW_BUILD/'compile-result.json',provenance)
    if failures:
        raise RuntimeError('Native-EH compilation failed; see separate compile-result.json')
    # Recheck every retained source/object/data input. Parent edits cannot silently
    # enter a half-old build; original caches and artifacts remain untouched.
    prepare_copy(original_source)
    unchanged_builder = legacy.load_builder()
    legacy.validate(unchanged_builder)
    if builder.compiler_fingerprint()!=provenance['compiler_fingerprint'] or digest(ROOT/'engine/library.js')!=provenance['library_sha256']:
        raise ValueError('Build input changed during native-EH compilation')
    if args.compile_only or (ROOT/'engine/.hold-link').exists():
        print('NATIVE_EH_COMPILE_COMPLETE_LINK_DEFERRED',flush=True)
        return
    response = NEW_BUILD/'link.rsp'
    response.write_text('\n'.join('"'+str(output).replace('\\','/')+'"' for _,output in native_units))
    pending = NEW_BUILD/'pending'
    pending.mkdir(exist_ok=True)
    command = legacy.link_arguments(builder,response,pending/'dcss.js')
    command = ['-fwasm-exceptions' if arg=='-fexceptions' else arg for arg in command]
    command = [str(unchanged_builder.BUILD/'data')+'@/data' if arg==str(NEW_BUILD/'data')+'@/data' else arg for arg in command]
    provenance['link_flags'] = command[3:]
    provenance['link_started_utc'] = utc()
    print('NATIVE_EH_LINK_START '+provenance['link_started_utc'],flush=True)
    link_start = time.monotonic()
    result = subprocess.run(command,cwd=NEW_SOURCE,env=builder.ENV,capture_output=True,text=True,encoding='utf-8',errors='replace')
    (NEW_BUILD/'link.stdout.log').write_text(result.stdout,encoding='utf-8')
    (NEW_BUILD/'link.stderr.log').write_text(result.stderr,encoding='utf-8')
    provenance.update({'link_finished_utc':utc(),'link_wall_seconds':time.monotonic()-link_start,'link_exit_code':result.returncode})
    if result.returncode:
        save_json(NEW_BUILD/'failed-link.json',provenance)
        raise RuntimeError('Native-EH JSPI link failed; retained all original artifacts')
    outputs = [{'name':name,'bytes':(pending/name).stat().st_size,'sha256':digest(pending/name)} for name in ('dcss.js','dcss.wasm','dcss.data')]
    if outputs[2]['sha256'] != next(item['sha256'] for item in base['base_outputs'] if item['name']=='dcss.data'):
        raise ValueError('Native-EH data package differs from pinned package')
    javascript = (pending/'dcss.js').read_text(encoding='utf-8')
    if 'function invoke_' in javascript:
        raise ValueError('Native-EH artifact unexpectedly retains legacy JS invoke frames')
    provenance.update({'outputs':outputs,'runtime_tests':'pending; no DCSS runtime executed by this builder',
                       'build_finished_utc':utc(),'legacy_invoke_functions':0})
    for name in ('dcss.js','dcss.wasm','dcss.data'):
        os.replace(pending/name,NEW_BUILD/name)
    save_json(NEW_BUILD/'manifest.json',provenance)
    # Preserve the exact failed legacy-JSPI candidate and receipts before promotion.
    if not HISTORY.exists():
        shutil.copytree(ACTIVE,HISTORY)
    history_manifest = json.loads((HISTORY/'manifest.json').read_text())
    active_manifest = json.loads((ACTIVE/'manifest.json').read_text())
    if active_manifest.get('exception_model') != 'wasm':
        if history_manifest['outputs'] != active_manifest['outputs']:
            raise ValueError('History does not preserve the current failed JS-EH candidate')
        for item in active_manifest['outputs']:
            if digest(HISTORY/item['name'])!=item['sha256']:
                raise ValueError('Preserved JS-EH history hash mismatch')
    # Each complete artifact is promoted atomically after all validation; the
    # manifest is last. Scheduling excludes consumers during this operation.
    for name in ('dcss.js','dcss.wasm','dcss.data','manifest.json'):
        staging = ACTIVE/(name+'.native-eh-pending')
        shutil.copy2(NEW_BUILD/name,staging)
        os.replace(staging,ACTIVE/name)
    print('NATIVE_EH_BUILD_COMPLETE '+json.dumps({'compile_wall_seconds':provenance['compile_wall_seconds'],
        'link_wall_seconds':provenance['link_wall_seconds'],'objects_recompiled':provenance['objects_recompiled'],
        'objects_reused':provenance['objects_reused'],'outputs':outputs}),flush=True)

if __name__=='__main__':
    main()
