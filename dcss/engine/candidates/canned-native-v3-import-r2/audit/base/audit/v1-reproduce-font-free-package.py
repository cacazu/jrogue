"""Validate/repack only the reviewed one-unit startup weapon candidate.

Source-only recipe, added 2026-10-02; GPL-3.0-or-later.
Default --check is read-only. --repack is an explicit later packaging operation;
it runs only the official installed Emscripten file_packager, never the game.
The original candidate remains pinned; a reproduced candidate is accepted only
with the reviewed repository-local reproduction helper and exact incremental
contract and all 333 immutable native baseline receipts are checked separately.
The candidate, baseline sources/objects/artifacts and pristine PDF remain
untouched. This script is not a runtime or publication readiness test.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess

PIN = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796'
OMITTED = 'docs/quickstart.pdf'
PDF_SHA = '07d56a1cd908293a6f556aa2898d616699c035ee2cca6891b75168fa1fba76ab'
PDF_BYTES = 80328
BASE_DATA_SHA = '45829be50686e2d101666e027d0418f884ef5f34d8bdbded1198ad724da8094d'
BASE_DATA_BYTES = 12601558
CANDIDATE = 'engine/candidates/startup-weapon'
CANDIDATE_MANIFEST_SHA = 'c1cf28266417f53ae7d7256f8cff2cac5583b0d792f8774c72de747d99be4abd'
CANDIDATE_OUTPUTS = [
    {'name': 'dcss.js', 'bytes': 341756, 'sha256': '4ba0d454b90e58846c51adaf4102c83eea8459e1fd86f27016f6db68df749df5'},
    {'name': 'dcss.wasm', 'bytes': 12618378, 'sha256': '366ca002895a92cdac5031b469c83008d9e399077661f872513db528a2e92246'},
    {'name': 'dcss.data', 'bytes': BASE_DATA_BYTES, 'sha256': BASE_DATA_SHA},
]
NATIVE_BASE = 'engine/build-jspi-wasm-eh'
NATIVE_SOURCE = 'engine/work-wasm-eh/crawl-ref/source'
NATIVE_MANIFEST_SHA = '984f8a0abb84db4b6ccea02219b9059b435e1ff96a7dcb818e9c1c0413cf1834'
FP = 'd2a8162d2fd3d9d760c9e509b6523d8eec022c884669a5b3e5353ce78fa1d0ba'
WASM_BASE_SHA = '432ba14e7903ff3678c2c19342917c240f3dc82ce62a121acd7bb9e127671c1e'
NEWGAME_BASE_SHA = 'b3186394e72e533d40fbf2e69d5b4b8a3b123f847a3a488ac49fb4252b92f10c'
NEWGAME_PATCH_SHA = 'ef20867b4f3af194368217864b076a17828492665480753dda9a2d722e46ef11'
LIB_BASE_SHA = 'ffdad020054a28f92e7030a9199cefcbee59dc332264091173b72e214647a6a5'
LIB_PATCH_SHA = 'a71cd6ff8ddcaaf479fd7c37c2eea7731c4ab9fd86944576eb634f8fd2c5137c'
RECEIPTS_SHA = '52ad256fe2ddeedc605379e5a87a76e11815c164d700355c751c1516f8541592'
BUILDER_SHA = 'fed917abb533ec1eb62102b6a376fc7724643a6c3ac05ecdbf3a84dca90803f7'
REPRO_BUILDER_SHA = 'ac80166cb5b0ef9cb66976840c57b9eb556005a2c7f10df5ff281591a6c8afc4'
BRIDGE_SHA = '2bbbae4b169d62777409e897d22abee8d4493ca697e85a99c663efe39587d8f8'
BOUNDARY_SHA = 'b35e93f807923e5320ccb7d11d9edf84bc296d713a4cd6056c11306c31577f2c'
INDEX = 170
BUNDLE_NAMES = ('dcss.js', 'dcss.wasm', 'dcss.data')
STARTUP_TEXT = {'schema_version': 1, 'source': 'startup-weapon-prompt-v1',
    'upstream': PIN, 'ids': ['startup.weapon.prompt'],
    'source_sha256': NEWGAME_BASE_SHA, 'transformed_source_sha256': NEWGAME_PATCH_SHA,
    'bridge_sha256': BRIDGE_SHA, 'boundary_sha256': BOUNDARY_SHA,
    'boundary_bytes': 701559, 'locale_mode': 'session'}

def digest(file):
    h = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def receipt(file):
    return {'bytes': file.stat().st_size, 'sha256': digest(file)}

def require_hash(file, expected):
    if not file.is_file() or digest(file) != expected:
        raise ValueError('Reviewed file hash drift: ' + str(file))

def same_json(left, right):
    options = {'sort_keys': True, 'separators': (',', ':'), 'allow_nan': False}
    return json.dumps(left, **options) == json.dumps(right, **options)

def under(root, relative):
    if (not isinstance(relative, str) or not relative or '\\' in relative or ':' in relative
        or PurePosixPath(relative).is_absolute()
        or any(part in ('', '.', '..') for part in relative.split('/'))):
        raise ValueError('Unsafe corresponding-source path')
    result = (root / relative).resolve()
    if not result.is_relative_to(root):
        raise ValueError('Corresponding-source path escapes its root')
    return result

def verify_outputs(directory, outputs):
    if (len(outputs) != 3 or {item['name'] for item in outputs} != set(BUNDLE_NAMES)):
        raise ValueError('Expected exactly three bundle outputs')
    for item in outputs:
        if receipt(directory / item['name']) != {key: item[key] for key in ('bytes', 'sha256')}:
            raise ValueError('Bundle artifact receipt drift: ' + item['name'])

def compiler_fingerprint(root, source, sdk, flags):
    value = hashlib.sha256(json.dumps([flag.replace(str(root), '${DCSS_ROOT}') for flag in flags]).encode())
    for header in sorted(file for file in source.rglob('*')
                         if file.is_file() and file.suffix in ('.h', '.hpp', '.inc')):
        if not header.resolve().is_relative_to(root):
            raise ValueError('Native header resolves outside the immutable root')
        value.update(header.relative_to(source).as_posix().encode())
        value.update(bytes.fromhex(digest(header)))
    value.update(bytes.fromhex(digest(sdk / 'upstream/emscripten/emcc.py')))
    return value.hexdigest()

def relocated_flags(root, baseline, flags):
    ending='engine\\work-wasm-eh\\crawl-ref\\source'
    matches=[flag[2:] for flag in baseline['cxx_flags'] if flag.startswith('-I') and flag.endswith(ending)]
    if len(matches)!=1:raise ValueError('Expected one baseline native source include')
    old_root=matches[0][:-len(ending)].rstrip('\\/')
    return [flag.replace(old_root,str(root)) for flag in flags]

def validate_native_baseline(root, sdk):
    baseline, source = under(root, NATIVE_BASE), under(root, NATIVE_SOURCE)
    require_hash(baseline / 'manifest.json', NATIVE_MANIFEST_SHA)
    manifest = json.loads((baseline / 'manifest.json').read_text(encoding='utf-8'))
    if (manifest.get('version') != '0.34.1' or manifest.get('upstream_commit') != PIN
        or manifest.get('runtime') != 'jspi' or manifest.get('exception_model') != 'wasm'
        or manifest.get('units') != 333 or len(manifest.get('objects', [])) != 333
        or manifest.get('compiler_fingerprint') != FP):
        raise ValueError('The pinned full native-EH baseline is required')
    flags = relocated_flags(root,manifest,manifest['cxx_flags'])
    if (flags[-1] != '-std=c++11' or flags.count('-fwasm-exceptions') != 1
        or '-fexceptions' in flags or '-DWIZARD' not in flags
        or compiler_fingerprint(root, source, sdk, flags[:-1]) != FP):
        raise ValueError('Immutable native flags/header/compiler fingerprint drift')
    seen_sources, seen_objects = set(), set()
    for item in manifest['objects']:
        if item['source'] in seen_sources or item['object'] in seen_objects:
            raise ValueError('Duplicate immutable baseline compilation unit')
        seen_sources.add(item['source']); seen_objects.add(item['object'])
        original, obj = under(root, item['source']), under(root, item['object'])
        require_hash(original, item['source_sha256']); require_hash(obj, item['object_sha256'])
        key = hashlib.sha256((FP + item['source_sha256']).encode()).hexdigest()
        if item['fingerprint'] != key or obj.with_suffix('.fingerprint').read_text() != key:
            raise ValueError('Immutable baseline object cache drift: ' + item['source'])
    expected_source = NATIVE_SOURCE + '/newgame.cc'
    if ([index for index, item in enumerate(manifest['objects']) if item['source'] == expected_source] != [INDEX]
        or manifest['objects'][INDEX]['object'] != NATIVE_BASE + '/obj/newgame.o'):
        raise ValueError('The baseline newgame unit must occur only at index 170')
    require_hash(source / 'newgame.cc', NEWGAME_BASE_SHA)
    require_hash(root / 'engine/library.js', LIB_BASE_SHA)
    verify_outputs(baseline, manifest['outputs'])
    require_hash(baseline / 'dcss.wasm', WASM_BASE_SHA)
    original = root / 'engine/build'
    require_hash(original / 'manifest.json', manifest['base_manifest_sha256'])
    verify_outputs(original, manifest['base_outputs'])
    expected_data = {'bytes': BASE_DATA_BYTES, 'sha256': BASE_DATA_SHA}
    if receipt(original / 'dcss.data') != expected_data or receipt(baseline / 'dcss.data') != expected_data:
        raise ValueError('Immutable original/native data package drift')
    native_rows = validate_payload(metadata((baseline / 'dcss.js').read_bytes().decode('utf-8')),
                                   baseline / 'dcss.data', original / 'data')
    original_rows = validate_payload(metadata((original / 'dcss.js').read_bytes().decode('utf-8')),
                                     original / 'dcss.data', original / 'data')
    if len(native_rows) != 1449 or {row['path']: row for row in native_rows} != {row['path']: row for row in original_rows}:
        raise ValueError('Immutable original/native 1,449-file payload mismatch')
    require_hash(baseline / 'manifest.json', NATIVE_MANIFEST_SHA)
    return manifest

def validate_startup_candidate(root, candidate, sdk):
    baseline = validate_native_baseline(root, sdk)
    manifest_path = candidate / 'manifest.json'
    manifest_hash = digest(manifest_path)
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    reproduced=manifest.get('reproduction_schema_version')==1
    if reproduced:
        if candidate==under(root,CANDIDATE):raise ValueError('Preserve the exact original executed candidate')
        require_hash(Path(__file__).resolve().parent/'reproduce-startup.py',REPRO_BUILDER_SHA)
    else:
        if candidate!=under(root,CANDIDATE):raise ValueError('Only the exact original candidate or reviewed reproduction is accepted')
        require_hash(manifest_path,CANDIDATE_MANIFEST_SHA)
    # This adapter accepts this exact incremental schema, never generic objects.
    expected = {'version': '0.34.1', 'upstream_commit': PIN, 'runtime': 'jspi',
        'exception_model': 'wasm', 'units': 333, 'objects_reused': 332, 'objects_recompiled': 1,
        'replacement_index': INDEX, 'baseline_manifest_sha256': NATIVE_MANIFEST_SHA,
        'baseline_wasm_sha256': WASM_BASE_SHA, 'baseline_compiler_fingerprint': FP,
        'compiler_fingerprint': FP, 'same_compile_flags': relocated_flags(root,baseline,baseline['cxx_flags']) if reproduced else baseline['cxx_flags'],
        'cxx_flags': relocated_flags(root,baseline,baseline['cxx_flags']) if reproduced else baseline['cxx_flags'], 'baseline_objects': baseline['objects'],
        'replacement_source_sha256': NEWGAME_PATCH_SHA, 'link_library_sha256': LIB_PATCH_SHA,
        'source_receipts_sha256': RECEIPTS_SHA, 'async_import_change': False,
        'public_header_change': False, 'data_package_files': 1449, 'startup_slice': 'startup.weapon.prompt',
        'startup_text': STARTUP_TEXT, 'build_helper_sha256': REPRO_BUILDER_SHA if reproduced else BUILDER_SHA,
        'compile_exit': 0, 'link_exit': 0, 'emcc_cores': 1, 'binaryen_cores': 1,
        'outputs': manifest.get('outputs') if reproduced else CANDIDATE_OUTPUTS}
    if reproduced:
        expected.update({'reproduction_schema_version':1,'baseline_cxx_flags':baseline['cxx_flags'],
            'output_candidate':candidate.relative_to(root).as_posix(),'audit_executed_builder_sha256':BUILDER_SHA})
    if 'objects' in manifest or any(not same_json(manifest.get(key), value) for key, value in expected.items()):
        raise ValueError('Candidate is not the exact reviewed one-unit startup build')
    patch_dir = candidate / 'patch-source'
    files = list(patch_dir.iterdir())
    if len(files) != 1 or files[0].name != 'newgame.cc' or files[0].is_symlink() or not files[0].is_file():
        raise ValueError('Startup patch directory must contain only its regular reviewed source')
    replacement_source, replacement_object = candidate / 'patch-source/newgame.cc', candidate / 'newgame.o'
    require_hash(replacement_source, NEWGAME_PATCH_SHA)
    if not replacement_object.is_file() or replacement_object.is_symlink():
        raise ValueError('Replacement object must be the preserved regular candidate object')
    object_hash = digest(replacement_object)
    mapping = {'baseline_source': baseline['objects'][INDEX]['source'], 'baseline_source_sha256': NEWGAME_BASE_SHA,
        'replacement_source': 'patch-source/newgame.cc', 'replacement_source_sha256': NEWGAME_PATCH_SHA,
        'baseline_object': baseline['objects'][INDEX]['object'], 'replacement_object': 'newgame.o',
        'replacement_object_sha256': object_hash,
        'replacement_cache_fingerprint': hashlib.sha256((FP + NEWGAME_PATCH_SHA).encode()).hexdigest(),
        'link_library': 'startup-library.js', 'link_library_sha256': LIB_PATCH_SHA}
    if not same_json(manifest.get('source_mapping'), mapping):
        raise ValueError('Startup source/object/library mapping mismatch')
    require_hash(candidate / 'startup-library.js', LIB_PATCH_SHA)
    if (candidate / 'startup-library.js').is_symlink():
        raise ValueError('Startup link library must be a regular preserved candidate file')
    patch = Path(__file__).resolve().parent / 'inputs'
    require_hash(patch / 'source-receipts.json', RECEIPTS_SHA)
    require_hash(patch / 'engine/newgame.cc', NEWGAME_PATCH_SHA)
    require_hash(patch / 'base/newgame.cc', NEWGAME_BASE_SHA)
    require_hash(patch / 'engine/library.js', LIB_PATCH_SHA)
    require_hash(patch / 'web/startup-text.mjs', BRIDGE_SHA)
    require_hash(Path(__file__).resolve().parent / 'audit/executed-build-startup.py', BUILDER_SHA)
    require_hash(Path(__file__).resolve().parent / 'audit/executed-font-free-startup-package.py', '52e44e62ea2ed5b8d13de2b862401b2899b3c13fa08df2074257d38b167ec921')
    original_text = (under(root, NATIVE_SOURCE) / 'newgame.cc').read_text(encoding='utf-8')
    patched_text = replacement_source.read_text(encoding='utf-8')
    start, end = '// BEGIN jrogue startup-weapon-prompt adapter v1\n', '// END jrogue startup-weapon-prompt adapter v1\n\n'
    expression = 'formatted_string(_dcss_startup_weapon_prompt(), CYAN)'
    if patched_text.count(start) != 1 or patched_text.count(end) != 1 or patched_text.count(expression) != 1:
        raise ValueError('Unexpected startup source transform')
    restored = patched_text[:patched_text.index(start)] + patched_text[patched_text.index(end) + len(end):]
    restored = restored.replace(expression, 'formatted_string("You have a choice of weapons.", CYAN)', 1)
    if restored != original_text:
        raise ValueError('Startup source inverse does not recover the immutable native source')
    ordered = [under(root, item['object']) for item in baseline['objects']]
    ordered[INDEX] = replacement_object
    link_objects = [{'index': index, 'object': file.relative_to(root).as_posix(),
        'object_sha256': object_hash if index == INDEX else baseline['objects'][index]['object_sha256'],
        'replacement': index == INDEX} for index, file in enumerate(ordered)]
    if not same_json(manifest.get('link_objects'), link_objects):
        raise ValueError('The ordered 333-object link list differs from its sole replacement')
    expected_response = '\n'.join('"' + str(file).replace('\\', '/') + '"' for file in ordered)
    response = candidate / 'link.rsp'
    if response.read_text() != expected_response or digest(response) != manifest.get('link_response_sha256'):
        raise ValueError('Actual response file differs from the ordered link provenance')
    flags = relocated_flags(root,baseline,baseline['link_flags']) if reproduced else list(baseline['link_flags'])
    flags[flags.index('--js-library') + 1] = str(candidate / 'startup-library.js')
    flags[flags.index('-o') + 1] = str(candidate / 'dcss.js')
    compile_command = [str(sdk / 'python/3.13.3_64bit/python.exe'), str(sdk / 'upstream/emscripten/emcc.py'),
        '-c', str(replacement_source), '-o', str(replacement_object), *expected['cxx_flags']]
    if not same_json(manifest.get('link_flags'), flags) or not same_json(manifest.get('compile_command'), compile_command):
        raise ValueError('Startup compile/link arguments differ beyond reviewed source/library/output paths')
    verify_outputs(candidate, manifest['outputs'])
    if receipt(candidate / 'dcss.data') != {'bytes': BASE_DATA_BYTES, 'sha256': BASE_DATA_SHA}:
        raise ValueError('Startup candidate no longer carries the immutable full payload')
    if receipt(root / 'build/boundary.wasm') != {'bytes': 701559, 'sha256': BOUNDARY_SHA}:
        raise ValueError('Reviewed separate Rust boundary artifact changed')
    for name, expected_hash in [('en.json', '1fe29184d921ff7b809f168394efddd9601681c357481fddb87bda8cc77bb866'),
        ('ja.json', '849f34f6db7f27595bbec292b1ad522baf8757db8c392b82da6c9b0102a629ab'),
        ('source-map.json', 'cac159c02ec30ebcadebf8188228d25f15e03af51d1a7533ad25c9c64dec042c')]:
        require_hash(root / 'locales/startup' / name, expected_hash)
    require_hash(manifest_path, manifest_hash)
    return manifest, {'immutable_native_manifest_sha256': NATIVE_MANIFEST_SHA,
        'immutable_baseline_objects': 333, 'objects_reused': 332, 'objects_recompiled': 1,
        'replacement_index': INDEX, 'replacement_object_sha256': object_hash,
        'ordered_link_objects_sha256': hashlib.sha256(json.dumps(link_objects, sort_keys=True).encode()).hexdigest(),
        'link_response_sha256': digest(response), 'startup_text': STARTUP_TEXT,
        'candidate_manifest_sha256': manifest_hash, 'corresponding_source_candidate': candidate.relative_to(root).as_posix()}

def metadata(javascript):
    marker = 'loadPackage({"files":'
    if javascript.count(marker) != 1:
        raise ValueError('Expected exactly one official preload metadata object')
    value, _ = json.JSONDecoder().raw_decode(javascript[javascript.index(marker) + len('loadPackage('):])
    return value

def inventory(names):
    return hashlib.sha256(''.join(name + '\n' for name in sorted(names)).encode()).hexdigest()

def safe_name(entry):
    name = entry['filename']
    if not name.startswith('/data/'):
        raise ValueError('Unexpected preload namespace')
    relative = name[len('/data/'):]
    pure = PurePosixPath(relative)
    if not relative or pure.is_absolute() or any(x in ('', '.', '..') for x in relative.split('/')) or '\\' in relative or ':' in relative:
        raise ValueError('Unsafe preload path')
    return relative

def validate_payload(meta, package, data_root):
    if package.stat().st_size != meta['remote_package_size']:
        raise ValueError('Preload metadata/byte count mismatch')
    rows, seen = [], set()
    with package.open('rb') as stream:
        for entry in meta['files']:
            name = safe_name(entry)
            if name in seen:
                raise ValueError('Duplicate preload path')
            seen.add(name)
            file = data_root / name
            length = entry['end'] - entry['start']
            if length < 0 or entry['start'] < 0 or entry['end'] > package.stat().st_size:
                raise ValueError('Invalid preload byte range')
            source = receipt(file)
            stream.seek(entry['start'])
            packed = hashlib.sha256(stream.read(length)).hexdigest()
            if source['bytes'] != length or source['sha256'] != packed:
                raise ValueError('Preload bytes differ from source: ' + name)
            rows.append({'path': name, **source})
    actual = {file.relative_to(data_root).as_posix() for file in data_root.rglob('*') if file.is_file()}
    if actual != seen:
        raise ValueError('Payload file tree differs from metadata whitelist')
    return rows

def loader_slice(javascript):
    includes = list(re.finditer(r'(?m)^// include: ([^\r\n]+)\r?\n', javascript))
    matches = []
    for include in includes:
        ending = re.search(r'(?m)^// end include: ' + re.escape(include.group(1)) + r'\r?$',
                           javascript[include.end():])
        if ending is None:
            continue
        stop = include.end() + ending.start()
        section = javascript[include.end():stop]
        if "Module['expectedDataFileDownloads']++" in section[:500]:
            matches.append((include.end(), stop))
    if len(matches) != 1:
        raise ValueError('Expected one unique official generated preload include')
    return matches[0]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parent.parents[2],help='Installed DCSS folder')
    parser.add_argument('--candidate',type=Path,default=Path('engine/candidates/startup-weapon-reproduced'),help='Exact original or reviewed reproduced candidate beneath engine/candidates')
    parser.add_argument('--sdk', type=Path, default=Path(r'C:\Users\kit\emsdk'))
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent / 'generated-startup-font-free')
    parser.add_argument('--check', action='store_true', help='Explicit read-only validation (also the default)')
    parser.add_argument('--repack', action='store_true', help='Later explicit packaging operation; default is read-only check')
    args = parser.parse_args()
    if args.check and args.repack:
        parser.error('--check and --repack are mutually exclusive')
    helper_hash = digest(Path(__file__))
    root = args.root.resolve()
    candidate = (args.candidate if args.candidate.is_absolute() else root/args.candidate).resolve()
    candidates=under(root,'engine/candidates')
    if not candidate.is_relative_to(candidates) or candidate==candidates:raise ValueError('Candidate must be a distinct child of engine/candidates')
    sdk = args.sdk.resolve()
    version = (sdk / 'upstream/emscripten/emscripten-version.txt').read_text().strip().strip('"')
    if version != '6.0.8':
        raise ValueError('Reviewed installed Emscripten 6.0.8 is required')
    baseline = root / 'engine/build'
    data_root = baseline / 'data'
    manifest, input_receipt = validate_startup_candidate(root, candidate, sdk)
    outputs = {item['name']: item for item in manifest['outputs']}
    for name in ('dcss.js', 'dcss.wasm', 'dcss.data'):
        if receipt(candidate / name) != {key: outputs[name][key] for key in ('bytes', 'sha256')}:
            raise ValueError('Candidate artifact differs from its manifest: ' + name)
    if receipt(baseline / 'dcss.data') != {'bytes': BASE_DATA_BYTES, 'sha256': BASE_DATA_SHA}:
        raise ValueError('The preserved 1,449-file baseline package changed')
    if receipt(candidate / 'dcss.data') != {'bytes': BASE_DATA_BYTES, 'sha256': BASE_DATA_SHA}:
        raise ValueError('Candidate is not based on the frozen original payload')
    # Decode raw bytes so CRLFs in generated runtime source remain untouched.
    javascript = (candidate / 'dcss.js').read_bytes().decode('utf-8')
    first, stop = loader_slice(javascript)
    original_meta = metadata(javascript)
    rows = validate_payload(original_meta, candidate / 'dcss.data', data_root)
    by_name = {row['path']: row for row in rows}
    if len(rows) != 1449 or by_name.get(OMITTED) != {'path': OMITTED, 'bytes': PDF_BYTES, 'sha256': PDF_SHA}:
        raise ValueError('Exact reviewed PDF or 1,449-file baseline differs')
    names = set(by_name)
    final_names = names - {OMITTED}
    required = {'docs/CREDITS.txt', 'docs/quickstart.md', 'docs/quickstart.txt'}
    if not required <= final_names or len([x for x in final_names if x.startswith('dat/des/') and x.endswith('.des')]) != 143:
        raise ValueError('Required credits, text quickstart or complete official vaults are missing')
    media_extensions = {'.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg',
        '.ttf', '.otf', '.woff', '.woff2', '.ogg', '.wav', '.mp3', '.flac', '.mp4', '.webm', '.psd', '.xcf'}
    if any(PurePosixPath(name).suffix.lower() in media_extensions for name in final_names):
        raise ValueError('Unexpected remaining font/PDF/image/audio/video payload')
    original_manifest_hash = digest(candidate / 'manifest.json')
    report = {'schema_version': 1, 'upstream_commit': PIN,
        'scope': 'Exact console payload omission; data processing only, no game execution or new runtime proof',
        'candidate': str(candidate), 'candidate_manifest_sha256': original_manifest_hash,
        'corresponding_source_candidate': candidate.relative_to(root).as_posix(), 'incremental_input_receipt': input_receipt,
        'package_helper_sha256': helper_hash,
        'baseline_files': 1449, 'baseline_inventory_sha256': inventory(names),
        'final_files': 1448, 'final_inventory_sha256': inventory(final_names),
        'expected_uncompressed_data_bytes': BASE_DATA_BYTES - PDF_BYTES,
        'omissions': [{'path': OMITTED, 'bytes': PDF_BYTES, 'sha256': PDF_SHA,
            'reason': 'Unused printable PDF embeds six Type1 font subsets; retain supported plain-text quickstart and preserve original PDF separately',
            'runtime_source_receipts': ['command.cc:441-452', 'command.cc:1321-1358', 'Makefile:1473-1474', 'util/gen-all.py:90']}],
        'baseline_outputs': manifest['outputs'], 'native_core_recompiled': False,
        'runtime_tests': 'pending for final JS/data; this helper never starts the engine',
        'release_ready': False}
    if not args.repack:
        print(json.dumps(report, indent=2))
        return
    # Only a separate new directory under this recipe workspace is writable.
    workspace = Path(__file__).resolve().parent
    output = args.output.resolve()
    if not output.is_relative_to(workspace) or output == workspace or output.exists():
        raise ValueError('Output must be a new child directory of this recipe workspace')
    output.mkdir(parents=True)
    payload = output / 'payload'
    payload.mkdir()
    for name in sorted(final_names):
        target = payload / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(data_root / name, target)
        if receipt(target) != {key: by_name[name][key] for key in ('bytes', 'sha256')}:
            raise ValueError('Staged byte drift: ' + name)
    artifacts = output / 'artifacts'
    artifacts.mkdir()
    loader = artifacts / 'dcss-data.js'
    packager = sdk / 'upstream/emscripten/tools/file_packager.py'
    packager_hash = digest(packager)
    command = [str(sdk / 'python/3.13.3_64bit/python.exe'),
        str(packager), str(artifacts / 'dcss.data'),
        '--preload', str(payload) + '@/data', '--from-emcc', '--quiet', '--js-output=' + str(loader)]
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', errors='replace')
    (output / 'packager.stdout.log').write_text(result.stdout, encoding='utf-8')
    (output / 'packager.stderr.log').write_text(result.stderr, encoding='utf-8')
    if result.returncode:
        raise RuntimeError('Official file packager failed; immutable originals remain unchanged')
    replacement = loader.read_bytes().decode('utf-8')
    final_javascript = javascript[:first] + replacement + '\n' + javascript[stop:]
    final_meta = metadata(final_javascript)
    final_rows = validate_payload(final_meta, artifacts / 'dcss.data', payload)
    if {row['path']: row for row in final_rows} != {name: by_name[name] for name in final_names}:
        raise ValueError('Final package changes bytes outside the single approved PDF omission')
    if (artifacts / 'dcss.data').stat().st_size != BASE_DATA_BYTES - PDF_BYTES:
        raise ValueError('Final uncompressed package size differs from exact omission')
    (artifacts / 'dcss.js').write_bytes(final_javascript.encode('utf-8'))
    shutil.copy2(candidate / 'dcss.wasm', artifacts / 'dcss.wasm')
    if digest(artifacts / 'dcss.wasm') != outputs['dcss.wasm']['sha256']:
        raise ValueError('Native WASM changed during data-only packaging')
    # Check immutable original artifacts and manifest again after packaging.
    if digest(candidate / 'manifest.json') != original_manifest_hash:
        raise ValueError('Candidate changed while packaging; final output must not be promoted')
    for name in ('dcss.js', 'dcss.wasm', 'dcss.data'):
        if digest(candidate / name) != outputs[name]['sha256']:
            raise ValueError('Candidate artifact changed while packaging')
    if digest(baseline / 'dcss.data') != BASE_DATA_SHA or digest(data_root / OMITTED) != PDF_SHA:
        raise ValueError('Original payload or original PDF changed while packaging')
    _, after = validate_startup_candidate(root, candidate, sdk)
    if not same_json(input_receipt, after):
        raise ValueError('Startup or immutable baseline provenance changed during packaging')
    require_hash(packager, packager_hash)
    require_hash(Path(__file__), helper_hash)
    report.update({'completed_utc': datetime.now(timezone.utc).isoformat(),
        'packager_command': command, 'packager_sha256': packager_hash, 'packager_only': True,
        'unchanged_native_wasm_sha256': outputs['dcss.wasm']['sha256'],
        'outputs': [{'name': name, **receipt(artifacts / name)} for name in ('dcss.js', 'dcss.wasm', 'dcss.data')],
        'unchanged_js_prefix_sha256': hashlib.sha256(javascript[:first].encode()).hexdigest(),
        'unchanged_js_suffix_sha256': hashlib.sha256(javascript[stop:].encode()).hexdigest()})
    final_manifest = dict(manifest)
    final_manifest.update({'outputs': report['outputs'], 'console_package': {
        'files': 1448, 'official_vault_files': 143, 'inventory_sha256': inventory(final_names),
        'all_retained_inputs_equal_base_package': True, 'graphics_audio_fonts_pdf_assets': 0,
        'credit_text_retained': True, 'omissions': report['omissions']},
        'packaging': report, 'candidate_only': True,
        'corresponding_source_candidate': candidate.relative_to(root).as_posix(),
        'runtime_tests': report['runtime_tests'], 'release_ready': False})
    (artifacts / 'manifest.json').write_text(json.dumps(final_manifest, indent=2) + '\n', encoding='utf-8')
    (output / 'omission-receipt.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
