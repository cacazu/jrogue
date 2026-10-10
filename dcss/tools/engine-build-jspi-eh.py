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
import re
import shutil
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
NEW_SOURCE = ROOT/'engine/work-wasm-eh/crawl-ref/source'
NEW_BUILD = ROOT/'engine/build-jspi-wasm-eh'
ACTIVE = ROOT/'engine/build-jspi'
HISTORY = ROOT/'engine/history/jspi-js-eh-20261002'
PROMOTION_STATE = ROOT/'engine/.jspi-native-eh-promotion.json'
BUNDLE_NAMES = ('dcss.js','dcss.wasm','dcss.data')
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

def source_inventory(directory):
    return {file.relative_to(directory).as_posix():digest(file)
            for file in sorted(directory.rglob('*'))
            if file.is_file() and not excluded(file)
            and file.relative_to(directory).as_posix() != 'compflag.h'}

def validate_copy(original, candidate):
    if (candidate/'compflag.h').read_text(encoding='utf-8') != COMPFLAG:
        raise ValueError('Unrecognized native-EH work metadata; refusing to overwrite')
    old_inventory = source_inventory(original)
    new_inventory = source_inventory(candidate)
    if old_inventory.keys() != new_inventory.keys():
        raise ValueError('Native source inventory drift: '+json.dumps({
            'missing':sorted(old_inventory.keys()-new_inventory.keys()),
            'extra':sorted(new_inventory.keys()-old_inventory.keys())}))
    drift = [name for name in old_inventory if old_inventory[name] != new_inventory[name]]
    if drift:
        raise ValueError('Native work copy source/header drift: '+', '.join(drift))
    retained = [{'path':name,'sha256':value} for name,value in old_inventory.items()]
    return {'files_equal_original_except_compflag':len(retained),
            'inventory_sha256':hashlib.sha256(json.dumps(retained,sort_keys=True).encode()).hexdigest(),
            'compflag_sha256':digest(candidate/'compflag.h'),
            'metadata_only_difference':'compflag.h compiler/link description'}

def prepare_copy(original):
    if not NEW_SOURCE.exists():
        def ignore(directory,names):
            return [name for name in names if excluded(Path(directory)/name)]
        temporary = NEW_SOURCE.with_name(NEW_SOURCE.name+'.copying-'+uuid.uuid4().hex)
        shutil.copytree(original,temporary,ignore=ignore)
        (temporary/'compflag.h').write_text(COMPFLAG,encoding='utf-8')
        receipt = validate_copy(original,temporary)
        temporary.rename(NEW_SOURCE)
        return receipt
    return validate_copy(original,NEW_SOURCE)

def save_json(path,value):
    path.write_text(json.dumps(value,indent=2),encoding='utf-8')

def save_json_atomic(path,value):
    temporary = path.with_name(path.name+'.writing-'+uuid.uuid4().hex)
    save_json(temporary,value)
    os.replace(temporary,path)

def verify_bundle(directory, expected_manifest=None, native=False):
    manifest_path = directory/'manifest.json'
    manifest_hash = digest(manifest_path)
    if expected_manifest is not None and manifest_hash != expected_manifest:
        raise ValueError('Bundle manifest hash mismatch: '+str(directory))
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if native and manifest.get('exception_model') != 'wasm':
        raise ValueError('Expected native-EH bundle: '+str(directory))
    outputs = manifest['outputs']
    if len(outputs) != len(BUNDLE_NAMES) or {item['name'] for item in outputs} != set(BUNDLE_NAMES):
        raise ValueError('Unexpected bundle output inventory: '+str(directory))
    for item in outputs:
        file = directory/item['name']
        if file.stat().st_size != item['bytes'] or digest(file) != item['sha256']:
            raise ValueError('Bundle output hash/size mismatch: '+str(file))
    return {'manifest':manifest,'manifest_sha256':manifest_hash}

def verify_inputs(builder,legacy,original_source,base,provenance,native_units):
    copy_receipt = validate_copy(original_source,NEW_SOURCE)
    if copy_receipt != provenance['source_copy']:
        raise ValueError('Native source receipt changed')
    fingerprint = builder.compiler_fingerprint()
    if fingerprint != provenance['compiler_fingerprint'] or builder.COMMON+['-std=c++11'] != provenance['cxx_flags']:
        raise ValueError('Native compiler flags/header fingerprint changed')
    expected_units = [(item['source'],item['object']) for item in provenance['objects']]
    actual_units = [(source.relative_to(ROOT).as_posix(),output.relative_to(ROOT).as_posix())
                    for source,output in native_units]
    if expected_units != actual_units:
        raise ValueError('Native compilation-unit inventory changed')
    for item in provenance['objects']:
        source,output = ROOT/item['source'],ROOT/item['object']
        if (digest(source) != item['source_sha256'] or digest(output) != item['object_sha256']
            or output.with_suffix('.fingerprint').read_text() != item['fingerprint']):
            raise ValueError('Native source/object receipt changed: '+item['source'])
    if digest(ROOT/'engine/library.js') != provenance['library_sha256']:
        raise ValueError('JavaScript library changed')
    if digest(Path(__file__)) != provenance['build_helper_sha256'] or digest(ROOT/'tools/engine-link-jspi.py') != provenance['legacy_link_helper_sha256']:
        raise ValueError('Loaded build/link helper source changed')
    unchanged_builder = legacy.load_builder()
    _,checked_base = legacy.validate(unchanged_builder)
    for key in ('compiler_fingerprint','cxx_flags','objects','base_manifest_sha256','base_outputs','console_package','library_sha256'):
        if checked_base[key] != base[key]:
            raise ValueError('Retained legacy input receipt changed: '+key)
    return unchanged_builder, {'verified_utc':utc(),'compiler_fingerprint':fingerprint,
        'source_copy':copy_receipt,'library_sha256':provenance['library_sha256'],
        'objects_inventory_sha256':hashlib.sha256(json.dumps(provenance['objects'],sort_keys=True).encode()).hexdigest(),
        'base_manifest_sha256':checked_base['base_manifest_sha256']}

def recover_promotion():
    state = json.loads(PROMOTION_STATE.read_text(encoding='utf-8'))
    if state.get('version') != 1:
        raise ValueError('Unrecognized native-EH promotion state')
    stage_name,backup_name = state['stage_name'],state['backup_name']
    if not re.fullmatch(re.escape(ACTIVE.name)+r'\.native-eh-staged-[0-9a-f]{32}',stage_name):
        raise ValueError('Unsafe promotion staging path')
    if backup_name != HISTORY.name and not re.fullmatch(r'jspi-active-before-native-[0-9a-f]{64}-[0-9a-f]{32}',backup_name):
        raise ValueError('Unsafe promotion history path')
    for key in ('target_manifest_sha256','old_manifest_sha256','legacy_history_sha256'):
        if not re.fullmatch(r'[0-9a-f]{64}',state[key]):
            raise ValueError('Invalid promotion receipt hash')
    stage,backup = ACTIVE.parent/stage_name,HISTORY.parent/backup_name
    if HISTORY.exists():
        history = verify_bundle(HISTORY,state['legacy_history_sha256'])
        if history['manifest'].get('exception_model') == 'wasm':
            raise ValueError('Legacy history unexpectedly contains native EH')
    elif backup != HISTORY:
        raise ValueError('Preserved legacy history is missing')
    if ACTIVE.exists():
        current = verify_bundle(ACTIVE)
        if current['manifest_sha256'] == state['target_manifest_sha256']:
            verify_bundle(ACTIVE,state['target_manifest_sha256'],native=True)
            if state['old_manifest_sha256'] == state['target_manifest_sha256'] and not backup.exists():
                # An older staged version could persist an unstarted no-op.
                # Clear only its fully verified receipt; retain staged files.
                verify_bundle(stage,state['target_manifest_sha256'],native=True)
                verify_bundle(HISTORY,state['legacy_history_sha256'])
                PROMOTION_STATE.unlink()
                return current
            verify_bundle(backup,state['old_manifest_sha256'])
            PROMOTION_STATE.unlink()
            return current
        if current['manifest_sha256'] != state['old_manifest_sha256']:
            raise ValueError('Active bundle changed during promotion')
        verify_bundle(stage,state['target_manifest_sha256'],native=True)
        if backup.exists():
            raise ValueError('Promotion backup already exists while old ACTIVE remains')
        ACTIVE.rename(backup)
    try:
        verify_bundle(backup,state['old_manifest_sha256'])
        verify_bundle(stage,state['target_manifest_sha256'],native=True)
        stage.rename(ACTIVE)
    except Exception:
        if not ACTIVE.exists() and backup.exists():
            backup.rename(ACTIVE)
        raise
    try:
        promoted = verify_bundle(ACTIVE,state['target_manifest_sha256'],native=True)
        verify_bundle(HISTORY,state['legacy_history_sha256'])
    except Exception:
        ACTIVE.rename(stage)
        backup.rename(ACTIVE)
        raise
    PROMOTION_STATE.unlink()
    return promoted

def promote_native_bundle():
    if PROMOTION_STATE.exists():
        return recover_promotion()
    target = verify_bundle(NEW_BUILD,native=True)
    current = verify_bundle(ACTIVE)
    if HISTORY.exists():
        history = verify_bundle(HISTORY)
        if history['manifest'].get('exception_model') == 'wasm':
            raise ValueError('Legacy history unexpectedly contains native EH')
        if current['manifest'].get('exception_model') != 'wasm' and history['manifest']['outputs'] != current['manifest']['outputs']:
            raise ValueError('History does not preserve the current failed JS-EH candidate')
        history_hash = history['manifest_sha256']
        backup_name = 'jspi-active-before-native-'+current['manifest_sha256']+'-'+uuid.uuid4().hex
    else:
        if current['manifest'].get('exception_model') == 'wasm':
            raise ValueError('Native ACTIVE exists without preserved legacy history')
        history_hash = current['manifest_sha256']
        backup_name = HISTORY.name
    if current['manifest_sha256'] == target['manifest_sha256']:
        return current
    HISTORY.parent.mkdir(parents=True,exist_ok=True)
    stage = ACTIVE.with_name(ACTIVE.name+'.native-eh-staged-'+uuid.uuid4().hex)
    stage.mkdir()
    for name in (*BUNDLE_NAMES,'manifest.json'):
        shutil.copy2(NEW_BUILD/name,stage/name)
    if {file.name for file in stage.iterdir()} != {*BUNDLE_NAMES,'manifest.json'}:
        raise ValueError('Unexpected staged bundle inventory')
    verify_bundle(stage,target['manifest_sha256'],native=True)
    save_json_atomic(PROMOTION_STATE,{'version':1,'stage_name':stage.name,'backup_name':backup_name,
        'target_manifest_sha256':target['manifest_sha256'],'old_manifest_sha256':current['manifest_sha256'],
        'legacy_history_sha256':history_hash})
    return recover_promotion()

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
    if PROMOTION_STATE.exists():
        if args.compile_only:
            raise RuntimeError('An interrupted promotion must finish before compile-only work')
        promoted = recover_promotion()
        print('NATIVE_EH_PROMOTION_RECOVERED '+promoted['manifest_sha256'],flush=True)
        return
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
        'fixture':evidence,'build_helper_sha256':digest(Path(__file__)),
        'legacy_link_helper_sha256':digest(ROOT/'tools/engine-link-jspi.py'),'emcc_cores':1,'binaryen_cores':1,
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
    unchanged_builder,provenance['prelink_input_receipt'] = verify_inputs(
        builder,legacy,original_source,base,provenance,native_units)
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
    try:
        _,provenance['postlink_input_receipt'] = verify_inputs(
            builder,legacy,original_source,base,provenance,native_units)
    except Exception as error:
        provenance['postlink_validation_error'] = str(error)
        save_json(NEW_BUILD/'failed-postlink-validation.json',provenance)
        raise
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
    # Consumers remain excluded through a whole-directory swap. A persistent
    # receipt recovers either completed rename or restores the previous ACTIVE.
    # Existing legacy history is validated and never replaced.
    promote_native_bundle()
    print('NATIVE_EH_BUILD_COMPLETE '+json.dumps({'compile_wall_seconds':provenance['compile_wall_seconds'],
        'link_wall_seconds':provenance['link_wall_seconds'],'objects_recompiled':provenance['objects_recompiled'],
        'objects_reused':provenance['objects_reused'],'outputs':outputs}),flush=True)

if __name__=='__main__':
    main()
