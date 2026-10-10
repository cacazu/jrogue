"""Check/repack the exact reviewed text-v2 candidate; default is read-only.

Data-only official SDK packager, exactly one PDF omission, unchanged WASM.
Requires independently reviewed contract and builder hashes. No game execution,
installation, promotion or runtime proof. GPL-3.0-or-later.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import candidate_common as common
from immutable_baseline import (PIN, OMITTED, PDF_SHA, PDF_BYTES, BASE_DATA_SHA,
    BASE_DATA_BYTES, digest, receipt, require_hash, same_json, under, metadata,
    inventory, validate_payload, loader_slice)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,required=True,help='Immutable DCSS baseline folder')
    parser.add_argument('--candidate',type=Path,default=Path('engine/candidates/startup-text-v2'))
    parser.add_argument('--patch',type=Path,required=True)
    parser.add_argument('--assets-root',type=Path)
    parser.add_argument('--contract',type=Path,required=True)
    parser.add_argument('--contract-sha256',required=True)
    parser.add_argument('--builder-sha256',required=True)
    parser.add_argument('--sdk', type=Path, default=Path(r'C:\Users\kit\emsdk'))
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent / 'generated-text-v2-font-free')
    parser.add_argument('--check', action='store_true', help='Explicit read-only validation (also the default)')
    parser.add_argument('--repack', action='store_true', help='Later explicit packaging operation; default is read-only check')
    args = parser.parse_args()
    if args.check and args.repack:
        parser.error('--check and --repack are mutually exclusive')
    helper_hash = digest(Path(__file__))
    root = args.root.resolve()
    candidate = (args.candidate if args.candidate.is_absolute() else root/args.candidate).resolve()
    candidates=under(root,'engine/candidates')
    if candidate != (root/'engine/candidates/startup-text-v2').resolve():raise ValueError('Only the separate reviewed text-v2 candidate is accepted')
    patch=args.patch.resolve()
    assets=(args.assets_root or root).resolve()
    contract_path=args.contract.resolve()
    helpers=common.helper_receipts()
    sdk = args.sdk.resolve()
    version = (sdk / 'upstream/emscripten/emscripten-version.txt').read_text().strip().strip('"')
    if version != '6.0.8':
        raise ValueError('Reviewed installed Emscripten 6.0.8 is required')
    baseline = root / 'engine/build'
    data_root = baseline / 'data'
    manifest, input_receipt = common.validate_candidate(root,patch,assets,sdk,contract_path,args.contract_sha256,candidate,args.builder_sha256)
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
        'package_helper_sha256': helper_hash, 'helper_sources':helpers, 'source_contract_sha256':args.contract_sha256,
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
    _, after = common.validate_candidate(root,patch,assets,sdk,contract_path,args.contract_sha256,candidate,args.builder_sha256)
    if common.helper_receipts()!=helpers:raise ValueError('Loaded v2 validation helper changed during packaging')
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
