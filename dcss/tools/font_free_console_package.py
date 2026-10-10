"""Stage/repack a font-free console payload without recompiling the native core.

Source-only recipe, added 2026-10-02; GPL-3.0-or-later.
Default --check is read-only. --repack is an explicit later packaging operation;
it runs only the official installed Emscripten file_packager, never the game.
The original engine/build/data, native objects, JS/WASM/data and pristine PDF
remain untouched. This script is not a runtime or publication readiness test.
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

def digest(file):
    h = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def receipt(file):
    return {'bytes': file.stat().st_size, 'sha256': digest(file)}

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
    parser.add_argument('--root', required=True, type=Path, help='Installed dcss directory')
    parser.add_argument('--candidate', default='engine/build-jspi-wasm-eh', help='Immutable completed native-EH candidate under root')
    parser.add_argument('--sdk', type=Path, default=Path(r'C:\Users\kit\emsdk'))
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent / 'generated')
    parser.add_argument('--repack', action='store_true', help='Later explicit packaging operation; default is read-only check')
    args = parser.parse_args()
    root = args.root.resolve()
    candidate = (root / args.candidate).resolve()
    if not candidate.is_relative_to(root):
        raise ValueError('Candidate directory escapes dcss root')
    baseline = root / 'engine/build'
    data_root = baseline / 'data'
    manifest = json.loads((candidate / 'manifest.json').read_text(encoding='utf-8'))
    if manifest.get('upstream_commit') != PIN or manifest.get('runtime') != 'jspi' or manifest.get('exception_model') != 'wasm':
        raise ValueError('A completed pinned native-Wasm-EH JSPI candidate is required')
    if manifest.get('units') != 333 or len(manifest.get('objects', [])) != 333:
        raise ValueError('Complete native-EH object/source provenance is required')
    flags = manifest['cxx_flags']
    if '-fwasm-exceptions' not in flags or '-fexceptions' in flags:
        raise ValueError('Candidate does not have the reviewed native exception flags')
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
    version = (args.sdk / 'upstream/emscripten/emscripten-version.txt').read_text().strip().strip('"')
    if version != '6.0.8':
        raise ValueError('Reviewed installed Emscripten 6.0.8 is required')
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
    command = [str(args.sdk / 'python/3.13.3_64bit/python.exe'),
        str(args.sdk / 'upstream/emscripten/tools/file_packager.py'), str(artifacts / 'dcss.data'),
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
    report.update({'completed_utc': datetime.now(timezone.utc).isoformat(),
        'packager_command': command, 'packager_only': True,
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
        'runtime_tests': report['runtime_tests'], 'release_ready': False})
    (artifacts / 'manifest.json').write_text(json.dumps(final_manifest, indent=2) + '\n', encoding='utf-8')
    (output / 'omission-receipt.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
