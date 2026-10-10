"""Validate/relink the complete DCSS O1 object graph with official SDK JSPI.

Default/--check is source/data/hash inspection only. --link performs the heavy
link explicitly, using a parent-assigned build slot. Outputs stay separately in
engine/build-jspi; no source/header, original bundle, Git or installer changes.
JSPI is a candidate memory mitigation; ordinary-browser safety and complete
gameplay/save/exception parity require measured runtime tests after linking.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
PIN = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796'
FINGERPRINT = '93d1d71b561e14f07589a24bc59598fac3960b95832a80d1fb3629f98a7e1042'
IMPORTS = ['dcss_host_read_key', 'dcss_host_delay']
EXPORTS = ['main', 'dcss_save']

def utc():
    return datetime.now(timezone.utc).isoformat()

def digest_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()

def load_builder():
    spec = importlib.util.spec_from_file_location('dcss_build', ROOT / 'tools/engine-build.py')
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    return builder

def pinned_head():
    git_dir = ROOT / 'upstream/.git'
    if git_dir.is_file():
        marker = git_dir.read_text().strip()
        if not marker.startswith('gitdir: '):
            raise ValueError('Unrecognized upstream repository metadata')
        git_dir = (git_dir.parent / marker[8:]).resolve()
    head = (git_dir / 'HEAD').read_text().strip()
    if head.startswith('ref: '):
        reference = PurePosixPath(head[5:])
        if reference.is_absolute() or '..' in reference.parts:
            raise ValueError('Unsafe repository reference')
        loose = git_dir / str(reference)
        if loose.is_file():
            head = loose.read_text().strip()
        else:
            head = next((line.split()[0] for line in (git_dir / 'packed-refs').read_text().splitlines()
                         if line and not line.startswith(('#','^')) and line.split()[1] == str(reference)), '')
    if head != PIN:
        raise ValueError('Upstream HEAD differs from the official reviewed commit')
    return head

def validate_package(builder, manifest):
    base = builder.BUILD
    for output in manifest['outputs']:
        file = base / output['name']
        if file.stat().st_size != output['bytes'] or digest_file(file) != output['sha256']:
            raise ValueError('Base bundle hash/size drift: ' + output['name'])
    javascript = (base / 'dcss.js').read_text(encoding='utf-8')
    marker = 'loadPackage({"files":'
    if javascript.count(marker) != 1:
        raise ValueError('Expected one exact official preload metadata object')
    first = javascript.index(marker) + len('loadPackage(')
    metadata, _ = json.JSONDecoder().raw_decode(javascript[first:])
    package = base / 'dcss.data'
    if package.stat().st_size != metadata['remote_package_size']:
        raise ValueError('Preload package size differs from generated metadata')
    data_root = base / 'data'
    packaged = set()
    blocked_assets = {'.png','.jpg','.jpeg','.ogg','.wav','.mp3','.psd','.xcf'}
    with package.open('rb') as stream:
        for entry in metadata['files']:
            name = entry['filename']
            if not name.startswith('/data/'):
                raise ValueError('Unexpected preloaded filesystem namespace')
            relative = PurePosixPath(name[len('/data/'):])
            if relative.is_absolute() or '..' in relative.parts or str(relative) in packaged:
                raise ValueError('Unsafe/duplicate preloaded path')
            file = data_root / str(relative)
            if file.suffix.lower() in blocked_assets:
                raise ValueError('Console candidate unexpectedly contains image/audio assets')
            length = entry['end'] - entry['start']
            if length < 0 or file.stat().st_size != length:
                raise ValueError('Preload input size drift: ' + str(relative))
            stream.seek(entry['start'])
            packaged_hash = hashlib.sha256(stream.read(length)).hexdigest()
            if digest_file(file) != packaged_hash:
                raise ValueError('Preload input differs from the already reviewed bundle: ' + str(relative))
            packaged.add(str(relative))
    actual = {file.relative_to(data_root).as_posix() for file in data_root.rglob('*') if file.is_file()}
    if actual != packaged or 'docs/CREDITS.txt' not in packaged:
        raise ValueError('Console data inventory or attribution differs from base package')
    vaults = sorted(name for name in packaged if name.startswith('dat/des/') and name.endswith('.des'))
    if len(vaults) != 143:
        raise ValueError('Official vault coverage differs from 143 files')
    inventory = hashlib.sha256(''.join(name+'\n' for name in sorted(packaged)).encode()).hexdigest()
    return {'files':len(packaged), 'official_vault_files':len(vaults),
            'inventory_sha256':inventory, 'all_inputs_equal_base_package':True,
            'graphics_audio_assets':0, 'credit_text_retained':True}

def validate(builder):
    manifest_path = builder.BUILD / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    if (manifest['version'] != '0.34.1' or manifest['upstream_commit'] != pinned_head()
        or manifest['compiler_fingerprint'] != FINGERPRINT or manifest['units'] != 333
        or manifest['cxx_flags'] != builder.COMMON + ['-std=c++11']):
        raise ValueError('Base compile provenance/flags differ from reviewed full build')
    if builder.compiler_fingerprint() != FINGERPRINT:
        raise ValueError('Current flags/headers/compiler no longer match existing objects')
    units = builder.units()
    if len(units) != 333 or '-DWIZARD' not in builder.COMMON:
        raise ValueError('Complete default-feature source graph is required')
    objects = []
    for source, output in units:
        source_hash = digest_file(source)
        cache_key = hashlib.sha256((FINGERPRINT + source_hash).encode()).hexdigest()
        if not output.is_file() or output.with_suffix('.fingerprint').read_text() != cache_key:
            raise ValueError('Object source/flag fingerprint drift: ' + str(source.relative_to(ROOT)))
        objects.append({'source':source.relative_to(ROOT).as_posix(), 'source_sha256':source_hash,
                        'object':output.relative_to(ROOT).as_posix(), 'object_sha256':digest_file(output),
                        'fingerprint':cache_key})
    library = ROOT / 'engine/library.js'
    library_source = library.read_text()
    for name in IMPORTS:
        if not re.search(r'\b'+name+r'__async:\s*true', library_source):
            raise ValueError('Async library import metadata changed: ' + name)
    async_source = (builder.SDK / 'upstream/emscripten/src/lib/libasync.js').read_text()
    if 'handleSleep: (startAsync) => Asyncify.handleAsync(() => new Promise(startAsync))' not in async_source:
        raise ValueError('Installed official JSPI handleSleep implementation is not the reviewed adapter')
    version = json.loads((builder.SDK / 'upstream/emscripten/emscripten-version.txt').read_text())
    return manifest, {'runtime':'jspi', 'version':'0.34.1', 'upstream_commit':PIN,
        'emscripten_version':version, 'compiler_fingerprint':FINGERPRINT,
        'cxx_flags':manifest['cxx_flags'], 'objects_reused':333, 'objects_recompiled':0,
        'objects':objects, 'base_manifest_sha256':digest_file(manifest_path),
        'base_outputs':manifest['outputs'], 'console_package':validate_package(builder,manifest),
        'async_imports':IMPORTS, 'async_exports':EXPORTS,
        'library_sha256':digest_file(library), 'link_helper_sha256':digest_file(Path(__file__)),
        'binaryen_cores':1, 'candidate_only':True,
        'host_contract':{'main':'observe callMain lifetime Promise without awaiting boot completion',
            'save':'await _dcss_save; serialize save and retain separate main/nested-input resolvers',
            'observers':'snapshot/repaint/clusters remain synchronous',
            'browser':'detect WebAssembly.Suspending and WebAssembly.promising before loading',
            'exception_gate':'existing -fexceptions invoke/indirect suspension parity remains unverified'},
        'official_sources':['https://emscripten.org/docs/porting/asyncify.html',
            'https://developer.chrome.com/release-notes/137#javascript_promise_integration',
            'https://v8.dev/blog/jspi']}

def link_arguments(builder, response, output):
    return [str(builder.PYTHON),str(builder.EMCC),'@'+str(response),'-O1','-fexceptions',
        '-sDEFAULT_TO_CXX=1','-Wl,--error-limit=0',
        '--js-library',str(ROOT/'engine/library.js'),'--preload-file',str(builder.BUILD/'data')+'@/data',
        '-sMODULARIZE=1','-sEXPORT_NAME=createDcssEngine','-sENVIRONMENT=web,worker,node',
        '-sALLOW_MEMORY_GROWTH=1','-sINITIAL_MEMORY=134217728','-sSTACK_SIZE=8388608',
        '-sJSPI=1','-sJSPI_IMPORTS='+json.dumps(IMPORTS,separators=(',',':')),
        '-sJSPI_EXPORTS='+json.dumps(EXPORTS,separators=(',',':')),
        '-sASSERTIONS=1','-sINVOKE_RUN=0',
        '-sEXPORTED_FUNCTIONS=["_main","_dcss_snapshot_json","_dcss_clusters_json","_dcss_save","_dcss_repaint","_malloc","_free"]',
        '-sEXPORTED_RUNTIME_METHODS=["FS","callMain","UTF8ToString","HEAPU8"]','-o',str(output)]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check',action='store_true')
    mode.add_argument('--link',action='store_true')
    args = parser.parse_args()
    builder = load_builder()
    base, provenance = validate(builder)
    destination = ROOT / 'engine/build-jspi'
    response = destination / 'link.rsp'
    pending = destination / 'pending'
    command = link_arguments(builder,response,pending/'dcss.js')
    provenance['link_flags'] = command[3:]
    if not args.link:
        print(json.dumps({key:value for key,value in provenance.items() if key!='objects'},indent=2))
        return
    if (ROOT/'engine/.hold-link').exists():
        raise RuntimeError('The explicit parent link hold sentinel is present')
    pending.mkdir(parents=True,exist_ok=True)
    response.write_text('\n'.join('"'+str(output).replace('\\','/')+'"' for _,output in builder.units()))
    started = time.monotonic()
    provenance['link_started_utc'] = utc()
    print('JSPI_LINK_START '+json.dumps({'pid':os.getpid(),'time':provenance['link_started_utc'],
          'objects_reused':333,'binaryen_cores':1}),flush=True)
    environment = dict(builder.ENV,BINARYEN_CORES='1')
    result = subprocess.run(command,cwd=builder.SOURCE,env=environment,capture_output=True,
                            text=True,encoding='utf-8',errors='replace')
    (destination/'link.stdout.log').write_text(result.stdout,encoding='utf-8')
    (destination/'link.stderr.log').write_text(result.stderr,encoding='utf-8')
    provenance['link_finished_utc'] = utc()
    provenance['link_wall_seconds'] = time.monotonic()-started
    provenance['link_exit_code'] = result.returncode
    if result.returncode:
        (destination/'failed-link.json').write_text(json.dumps(provenance,indent=2),encoding='utf-8')
        raise RuntimeError('JSPI candidate link failed; see engine/build-jspi/link.stderr.log')
    outputs = [{'name':name,'bytes':(pending/name).stat().st_size,'sha256':digest_file(pending/name)}
               for name in ('dcss.js','dcss.wasm','dcss.data')]
    if outputs[2]['sha256'] != next(item['sha256'] for item in base['outputs'] if item['name']=='dcss.data'):
        raise RuntimeError('Candidate console data differs from the validated base package')
    for name in ('dcss.js','dcss.wasm','dcss.data'):
        os.replace(pending/name,destination/name)
    provenance.update({'units':333,'official_vault_files':143,'outputs':outputs,
                       'runtime_tests':'pending; no engine/browser launched by this helper'})
    (destination/'manifest.json').write_text(json.dumps(provenance,indent=2),encoding='utf-8')
    print(json.dumps({'runtime':'jspi','link_wall_seconds':provenance['link_wall_seconds'],'outputs':outputs},indent=2),flush=True)

if __name__=='__main__':
    main()
