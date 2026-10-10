"""Unchanged immutable native-EH and payload guards extracted from reviewed v1.
No startup-candidate acceptance or execution path is retained. GPL-3.0-or-later.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path, PurePosixPath
import re

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

