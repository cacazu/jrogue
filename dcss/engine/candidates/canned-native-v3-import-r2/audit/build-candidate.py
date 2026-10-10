"""Check or explicitly build reviewed DCSS canned-native-v3 message143 only.

Default is read-only --check. --build needs a parent-assigned heavy slot.
Preserves immutable baseline and installed V2; no installation or runtime.
GPL-3.0-or-later.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import candidate_common as common
from candidate_common import base

HERE = Path(__file__).resolve().parent

def utc():
    return datetime.now(timezone.utc).isoformat()

def check_sources(directory, contract):
    expected = {common.ALLOWED_OVERRIDES[entry['index']][0]: entry['transformed']['sha256']
                for entry in contract['overrides']}
    if {file.name for file in directory.iterdir()} != set(expected):
        raise ValueError('Patch-source must contain only the explicitly reviewed CPP units')
    for name, sha in expected.items():
        base.require_hash(common.regular(directory, name), sha)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--build', action='store_true')
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--patch', type=Path, required=True)
    parser.add_argument('--assets-root', type=Path, help='Reviewed new Rust/catalog tree; defaults to --root')
    parser.add_argument('--contract', type=Path, required=True)
    parser.add_argument('--contract-sha256', required=True, help='Explicit hash independently reviewed by root')
    parser.add_argument('--out', type=Path, default=Path('engine/candidates/canned-native-v3-import-r2'))
    parser.add_argument('--sdk', type=Path, default=Path(r'C:\Users\kit\emsdk'))
    args = parser.parse_args()
    root, patch, sdk = args.root.resolve(), args.patch.resolve(), args.sdk.resolve()
    assets = (args.assets_root or root).resolve()
    contract_path = args.contract.resolve()
    candidate = (args.out if args.out.is_absolute() else root/args.out).resolve()
    if candidate != (root/'engine/candidates/canned-native-v3-import-r2').resolve():
        raise ValueError('V3 output is fixed to the distinct engine/candidates/canned-native-v3-import-r2 path')
    if (sdk/'upstream/emscripten/emscripten-version.txt').read_text().strip().strip('"') != '6.0.8':
        raise ValueError('Only the reviewed official Emscripten6.0.8 SDK is supported')
    contract, baseline, receipt = common.validate_contract(root, patch, assets, sdk, contract_path, args.contract_sha256)
    receipt['output_candidate'] = candidate.relative_to(root).as_posix()
    helpers = common.helper_receipts()
    if not args.build:
        print(json.dumps(dict(receipt, helper_sources=helpers, operation='read-only validation'), indent=2))
        return
    if (root/'engine/.hold-link').exists():
        raise RuntimeError('Explicit parent heavy-build hold is present')
    if candidate.exists():
        raise RuntimeError('Preserve any existing V3 candidate; this recipe never overwrites one')
    candidate.mkdir(parents=True)
    source_dir = candidate/'patch-source'
    source_dir.mkdir()
    for entry in contract['overrides']:
        source = common.override_file(patch, contract, entry)
        shutil.copy2(source, source_dir/source.name)
    check_sources(source_dir, contract)
    library = candidate/'startup-library.js'
    shutil.copy2(common.library_file(patch, contract), library)
    base.require_hash(library, contract['library']['sha256'])
    # Preserve the exact reviewed contract and helpers with corresponding source.
    shutil.copy2(contract_path, candidate/'source-contract.json')
    audit = candidate/'audit'
    audit.mkdir()
    for name in helpers:
        (audit/name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(HERE/name, audit/name)
        base.require_hash(audit/name, helpers[name])
    python = sdk/'python/3.13.3_64bit/python.exe'
    emcc = sdk/'upstream/emscripten/emcc.py'
    environment = dict(os.environ, EM_CONFIG=str(sdk/'.emscripten'),
        EM_CACHE=str(root/'engine/em-cache'), PYTHONPATH=str(root/'engine/python'),
        PYTHONUTF8='1', EMCC_CORES='1', BINARYEN_CORES='1')
    flags = receipt['same_compile_flags']
    source_root = root/base.NATIVE_SOURCE
    ordered = common.ordered_parent_objects(root, contract)
    commands, stages, mappings = [], [], []
    for entry in contract['overrides']:
        index = entry['index']; name = common.ALLOWED_OVERRIDES[index][0]
        source = source_dir/name
        obj = candidate/(name.removesuffix('.cc')+'.o')
        command = [str(python), str(emcc), '-c', str(source), '-o', str(obj), *flags]
        stage = {'index': index, 'source': name, 'started_utc': utc()}
        print('CANNED_NATIVE_V3_CPP_COMPILE_START '+json.dumps(stage), flush=True)
        started = time.monotonic()
        result = subprocess.run(command, cwd=source_root, env=environment, capture_output=True,
                                text=True, encoding='utf-8', errors='replace')
        (candidate/(name+'.compile.stdout.log')).write_text(result.stdout, encoding='utf-8')
        (candidate/(name+'.compile.stderr.log')).write_text(result.stderr, encoding='utf-8')
        stage.update(finished_utc=utc(), wall_seconds=time.monotonic()-started, exit=result.returncode)
        stages.append(stage); commands.append(command)
        if result.returncode:
            raise RuntimeError('Reviewed replacement failed to compile: '+name)
        check_sources(source_dir, contract)
        object_hash = base.digest(obj)
        ordered[index] = obj
        mappings.append({'index': index, 'baseline_source': entry['source'],
            'baseline_source_sha256': entry['original_sha256'], 'replacement_source': 'patch-source/'+name,
            'replacement_source_sha256': entry['transformed']['sha256'],
            'baseline_object': baseline['objects'][index]['object'], 'replacement_object': obj.name,
            'replacement_object_sha256': object_hash,
            'replacement_cache_fingerprint': hashlib.sha256((base.FP+entry['transformed']['sha256']).encode()).hexdigest()})
    _, _, prelink = common.validate_contract(root, patch, assets, sdk, contract_path, args.contract_sha256)
    if prelink != {key: receipt[key] for key in prelink} or common.helper_receipts() != helpers:
        raise ValueError('Reviewed inputs or loaded helper changed during compilation')
    check_sources(source_dir, contract)
    response = candidate/'link.rsp'
    response.write_text('\n'.join('"'+str(file).replace('\\','/')+'"' for file in ordered), encoding='utf-8')
    response_hash = base.digest(response)
    base.require_hash(library, contract['library']['sha256'])
    link_flags = base.relocated_flags(root, baseline, baseline['link_flags'])
    link_flags[link_flags.index('--js-library')+1] = str(library)
    link_flags[link_flags.index('-o')+1] = str(candidate/'dcss.js')
    link = [str(python), str(emcc), '@'+str(response), *link_flags]
    receipt['link_started_utc'] = utc()
    print('CANNED_NATIVE_V3_CPP_LINK_START '+receipt['link_started_utc'], flush=True)
    started = time.monotonic()
    result = subprocess.run(link, cwd=source_root, env=environment, capture_output=True,
                            text=True, encoding='utf-8', errors='replace')
    (candidate/'link.stdout.log').write_text(result.stdout, encoding='utf-8')
    (candidate/'link.stderr.log').write_text(result.stderr, encoding='utf-8')
    receipt.update(link_finished_utc=utc(), link_wall_seconds=time.monotonic()-started,
                   link_exit=result.returncode, link_flags=link_flags)
    if result.returncode:
        raise RuntimeError('Reviewed incremental canned-native-v3 link failed')
    _, _, after = common.validate_contract(root, patch, assets, sdk, contract_path, args.contract_sha256)
    if after != prelink or common.helper_receipts() != helpers:
        raise ValueError('Immutable baseline, reviewed input or helper changed during linking')
    check_sources(source_dir, contract)
    base.require_hash(library, contract['library']['sha256'])
    base.require_hash(response, response_hash)
    base.require_hash(candidate/'source-contract.json', args.contract_sha256)
    for mapping in mappings:
        base.require_hash(candidate/mapping['replacement_object'], mapping['replacement_object_sha256'])
    outputs = [{'name': name, **base.receipt(candidate/name)} for name in ('dcss.js','dcss.wasm','dcss.data')]
    if outputs[2] != {'name': 'dcss.data', 'bytes': base.BASE_DATA_BYTES, 'sha256': base.BASE_DATA_SHA}:
        raise ValueError('Incremental link changed the frozen baseline data package')
    receipt.update(cxx_flags=flags, source_mapping=mappings, compile_commands=commands,
        compile_stages=stages, compile_exit=0,
        link_objects=common.link_object_receipts(root, contract, ordered, mappings),
        link_response_sha256=response_hash, outputs=outputs, build_helper_sha256=helpers['build-candidate.py'],
        helper_sources=helpers, runtime_tests='pending; no engine/browser execution by this recipe',
        emcc_cores=1, binaryen_cores=1)
    (candidate/'manifest.json').write_text(json.dumps(receipt, indent=2)+'\n', encoding='utf-8')
    # Validate the completed incremental manifest before returning success.
    common.validate_candidate(root, patch, assets, sdk, contract_path, args.contract_sha256,
                              candidate, helpers['build-candidate.py'])
    print(json.dumps({'objects_reused': receipt['objects_reused'],
                      'objects_recompiled': receipt['objects_recompiled'], 'outputs': outputs}, indent=2))

if __name__ == '__main__':
    main()
