#!/usr/bin/env python3
"""Stream and verify the corresponding-source archive using Python 3.11+.

New integration utility, 2026-10-02; NGPL (see THIRD-PARTY-NOTICES.md).
No compiler, browser, subprocess or network access is used. Optional references
bind existing build/test/preparation evidence; they do not rerun those checks.
The report stays outside the archive to avoid an archive-hash self-reference.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import tarfile
import tempfile


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def relative_path(base, name):
    normalized = name.replace('\\', '/')
    parts = PurePosixPath(normalized)
    require(not parts.is_absolute() and '..' not in parts.parts and ':' not in normalized,
            f'Unsafe manifest path: {name}')
    path = base.joinpath(*parts.parts)
    require(path.resolve().is_relative_to(base.resolve()), f'Escaping manifest path: {name}')
    return path


def tree_hashes(root):
    return {p.relative_to(root).as_posix(): sha(p) for p in root.rglob('*') if p.is_file()}


def phase6_rust_proof(root, proof, checkpoint, checkpoint_path, manifest):
    """Rebind recorded checks to the selected portable crate; run no compiler."""
    require(proof['status'] == 'native_rust_phase6_tests_passed' and proof['failed'] == 0,
            'Selected Phase6 Rust tests did not pass')
    require(sha(checkpoint_path) == proof['source_checkpoint_sha256'], 'Selected Rust checkpoint differs')
    require(proof['sourceFiles'] == checkpoint['sourceFiles'], 'Selected Rust source record differs')
    for item in checkpoint['sourceFiles']:
        path = relative_path(root/'rust', item['path'])
        require(path.stat().st_size == item['bytes'] and sha(path) == item['sha256'],
                f'Selected tested Rust source differs: {item["path"]}')
    for item in checkpoint['projectProvenance'] + [checkpoint['approvedFixtureManifest']]:
        path = relative_path(root, item['path'])
        require(path.stat().st_size == item['bytes'] and sha(path) == item['sha256'], 'Rust project provenance differs')
    for item in checkpoint['tested_fixtureSha256']:
        name = item['source_package_path']
        require(name.startswith('nethack/'), 'Rust fixture package path escaped project')
        require(sha(relative_path(root, name[len('nethack/'):])) == item['sha256'], 'Tested Rust fixture differs')
    require(proof['rustLibrary']['sha256'] == manifest['rust_library']['sha256'] and
            proof['rustLibrary']['bytes'] == manifest['rust_library']['bytes'], 'Linked Rust library differs from release proof')
    native_count = 0
    for kind, item in proof['validation'].items():
        require(kind in {'native','clippy','fmt','release'} and item['status'] == 'passed', 'Unknown/failed Rust validation')
        resource_path, log_path = relative_path(root,item['resourcePath']), relative_path(root,item['logPath'])
        require(sha(resource_path) == item['resourceSha256'] and sha(log_path) == item['logSha256'], 'Rust validation transcript differs')
        resource, log = read(resource_path), log_path.read_text('utf-8')
        require(resource['exit_code'] == 0 and resource['command'] == item['command'], 'Rust validation execution differs')
        if kind == 'native':
            counts = [int(value) for value in re.findall(r'test result: ok\. (\d+) passed; 0 failed; 0 ignored; 0 measured; 0 filtered out;',log)]
            require(counts == item['testGroups'] and sum(counts) == proof['tests_passed'], 'Native Rust counts not proved by transcript')
            native_count = sum(counts)
        elif kind == 'fmt':
            require('--check' in resource['command'], 'Rust formatting was not checked')
        elif kind == 'clippy':
            require('--all-targets' in resource['command'] and '-D' in resource['command'] and 'warnings' in resource['command'] and
                    re.search(r'Finished .+ profile',log), 'Strict Clippy completion not proved')
        else:
            require('--release' in resource['command'] and 'wasm32-unknown-emscripten' in resource['command'] and
                    re.search(r'Finished .?release.? profile',log), 'WASM release completion not proved')
    require(set(proof['validation']) == {'native','clippy','fmt','release'} and native_count > 0, 'Incomplete Rust validation set')
    return {'native_tests_passed':native_count,'source_files':len(checkpoint['sourceFiles']),
            'tested_fixtures':len(checkpoint['tested_fixtureSha256']),'actual_suite_rerun_by_audit':False,
            'selected_runtime_catalog_is_separate_from_native_compile_time_fixtures':True}


def main():
    project = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, default=project / 'web/downloads/corresponding-source.tar.gz')
    parser.add_argument('--report', type=Path, default=project / 'build/source-check-report.json')
    parser.add_argument('--extract-dir', type=Path, help='Fresh directory; existing directories are never deleted or reused')
    parser.add_argument('--live-root', type=Path, help='Optional nethack project containing actual web/engine artifacts')
    parser.add_argument('--web-root', type=Path, help='Optional isolated actual web tree inside --live-root')
    parser.add_argument('--engine-source-prefix', default='work/NetHack-5.0.0/', help='Packaged evidence path prefix mapped to engine-source/')
    parser.add_argument('--prior-report', type=Path, help='Optional prior independent audit with offline Rust/preparation evidence')
    parser.add_argument('--prepared-root', type=Path, help='Optional already prepared NetHack-5.0.0 source tree; no build is invoked')
    parser.add_argument('--sdk-root', type=Path, help='Optional installed emscripten directory for original-notice comparisons')
    parser.add_argument('--rust-doc-root', type=Path, help='Optional installed share/doc/rust directory for original-notice comparisons')
    parser.add_argument('--boundary-report', default='build/browser-boundary-verification.json', help='Packaged report path for the tested runtime revision')
    parser.add_argument('--rust-test-report', help='Packaged current native Rust proof path; distinct from historical empty-Cargo-home evidence')
    parser.add_argument('--rust-checkpoint', help='Packaged current Rust source checkpoint path, required with --rust-test-report')
    args = parser.parse_args()
    prior = read(args.prior_report) if args.prior_report else None
    digest = sha(args.archive)
    if args.extract_dir:
        extraction = args.extract_dir.resolve()
        require(not extraction.exists(), 'Extraction directory already exists; choose a fresh path')
        extraction.mkdir(parents=True)
    else:
        scratch = project / 'build/source-check'
        scratch.mkdir(parents=True, exist_ok=True)
        extraction = Path(tempfile.mkdtemp(prefix=f'package-{digest[:12]}-', dir=scratch))
    report = {'audited_at_utc': datetime.now(timezone.utc).isoformat(), 'status': 'audit_in_progress',
              'archive': {'path': str(args.archive.resolve()), 'bytes': args.archive.stat().st_size, 'sha256': digest},
              'extraction': str(extraction), 'checks': [], 'limitations': ['No compiler/browser/network activity or full C engine relink was performed.']}

    def check(name, details, status='passed'):
        report['checks'].append({'name': name, 'status': status, 'details': details})

    suffixes = {'.exe','.dll','.a','.lib','.o','.obj','.wasm','.data','.wav','.aiff','.aif','.mp3','.ogg','.flac','.uu','.save','.sav'}
    forbidden_parts = {'.git','.aws','.ssh','target','node_modules','.sites-runtime','source-check'}
    forbidden_names = {'.env','.env.local','credentials','id_rsa','id_ed25519'}
    makefiles = {'nethack/upstream/NetHack-5.0.0/sys/share/Makefile.lib',
                 'nethack/engine-source/sys/share/Makefile.lib',
                 'nethack/work/phase4/NetHack-5.0.0/sys/share/Makefile.lib'}
    names, total = set(), 0
    with tarfile.open(args.archive, 'r|gz') as archive:
        for member in archive:
            name = PurePosixPath(member.name)
            require(member.isfile(), f'Nonregular member: {member.name}')
            require(not name.is_absolute() and '..' not in name.parts and name.parts[0] == 'nethack', f'Unsafe member: {member.name}')
            require(':' not in member.name and '\\' not in member.name, f'Unsafe member: {member.name}')
            require(member.name not in names, f'Duplicate member: {member.name}')
            require(not forbidden_parts.intersection(name.parts) and name.name.lower() not in forbidden_names, f'Forbidden member: {member.name}')
            require(name.suffix.lower() not in suffixes or member.name in makefiles, f'Forbidden artifact: {member.name}')
            require(not name.name.lower().endswith('.save.json'), f'Forbidden save payload: {member.name}')
            names.add(member.name)
            total += member.size
            require(len(names) <= 30000 and total <= 768*1024*1024, 'Archive exceeds source audit size limits')
            destination = relative_path(extraction, member.name)
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(member) as source, destination.open('wb') as output:
                shutil.copyfileobj(source, output, length=1024*1024)
            require(destination.stat().st_size == member.size, f'Truncated member: {member.name}')
    check('safe_source_only_archive_members', {'regular_files':len(names), 'duplicates':0, 'unsafe_paths':0, 'forbidden_artifact_or_credential_paths':0})
    root = extraction / 'nethack'
    snapshot_path = root/'build/packaged-input-manifest.json'
    if snapshot_path.is_file():
        snapshot = read(snapshot_path)
        require(snapshot['schema_version'] == 1, 'Unsupported packaged source snapshot')
        expected_names = set(snapshot['files']) | {'nethack/build/packaged-input-manifest.json'}
        require(expected_names == names, 'Packaged source snapshot file set differs')
        for name, metadata in snapshot['files'].items():
            source = relative_path(extraction, name)
            require(source.stat().st_size == metadata['bytes'] and sha(source) == metadata['sha256'],
                    f'Packaged source snapshot mismatch: {name}')
        check('all_archive_bytes_match_frozen_selected_input_snapshot', {'files':len(snapshot['files']), 'unlisted_members':0})
    required = ['upstream/NetHack-5.0.0/dat/license','engine-source/dat/license','engine-source/lib/lua-5.4.8/doc/readme.html',
                'rust/Cargo.lock','rust/.cargo/config.toml','tools/build-upstream.py','tools/package-source.py',
                'build/upstream-adapter.patch','build/source-changes.json','build/lua-source-manifest.json',
                'build/rust-dependencies.json','build/engine-manifest.json','provenance.json','THIRD-PARTY-NOTICES.md',
                'licenses/Lua-5.4.8-MIT.txt','licenses/RUNTIME-PROVENANCE.json','docs/AUXILIARY-PERSISTENCE-AUDIT.md',
                'tools/audit-source-package.py']
    require(all((root/name).is_file() for name in required), 'Required source/build/license input missing')
    check('required_rebuild_source_and_notices_present', required)
    license_hash = sha(root/'upstream/NetHack-5.0.0/dat/license')
    require(license_hash == '93a3ae2cb8dee482daddfaebe53bcffe5b114b603def19b4dca21621cbc5a747', 'NGPL differs from verified official release')
    require(sha(root/'engine-source/dat/license') == license_hash, 'Modified-tree NGPL differs')
    check('ngpl_license_verbatim', {'sha256':license_hash})
    provenance = read(root/'provenance.json')
    require(provenance['release_commit'] == '16ff59115315917b93185d026aeefea06db9b0f4', 'Unexpected upstream commit')
    require(provenance['archive']['sha256'] == '2959b7886aac76185b90aea0c9f80d14343f604de0ae96b3dd2a760f7ab3bde9', 'Unexpected original archive')
    pristine = root/'upstream/NetHack-5.0.0'
    included, omitted = 0, []
    for file in provenance['source']['files']:
        path = relative_path(pristine,file['path'])
        if path.is_file():
            require(sha(path) == file['sha256'] and path.stat().st_size == file['bytes'], f'Upstream mismatch: {file["path"]}')
            included += 1
        else:
            require(path.suffix.lower() in suffixes and path.name != 'Makefile.lib', f'Excluded source input: {file["path"]}')
            omitted.append(file['path'])
    check('all_distributed_upstream_files_match_official_provenance', {'verified_files':included, 'intentionally_excluded_unused_audio_or_artifacts':len(omitted), 'excluded_extensions':sorted({Path(x).suffix for x in omitted})})
    lua = read(root/'build/lua-source-manifest.json')
    require(lua['archive_sha256'] == '4f18ddae154e793e46eeab727c59ef1c0c0c2b744e7b94219710d76f530629ae', 'Unexpected pinned Lua')
    require(tree_hashes(root/'engine-source/lib/lua-5.4.8') == lua['files'], 'Lua file set/checksum mismatch')
    require(b'Permission is hereby granted' in (root/'engine-source/lib/lua-5.4.8/doc/readme.html').read_bytes(), 'Lua MIT notice missing')
    check('pinned_lua_exact_sources_and_mit_notice', {'version':lua['version'], 'archive_sha256':lua['archive_sha256'], 'files':len(lua['files'])})
    modified = read(root/'build/source-changes.json')
    dated = []
    for file in modified:
        path = relative_path(root/'engine-source',file['path'])
        require(sha(path) == file['sha256'], f'Modified source mismatch: {file["path"]}')
        if file['status'] == 'modified':
            require(b'2026-10-02' in path.read_bytes()[:1600], f'Missing dated change notice: {file["path"]}')
            dated.append(file['path'])
    check('actual_modified_sources_match_change_manifest', {'entries':len(modified), 'dated_modified_files':dated})
    changed = {x['path'] for x in modified}
    unchanged = 0
    for file in provenance['source']['files']:
        if (pristine/file['path']).is_file() and file['path'] not in changed:
            require(sha(relative_path(root/'engine-source',file['path'])) == file['sha256'], f'Unrecorded engine change: {file["path"]}')
            unchanged += 1
    check('all_unmodified_engine_inputs_match_pinned_pristine_source', {'verified_files':unchanged})
    dependencies = read(root/'build/rust-dependencies.json')
    vendor_files = 0
    for package in dependencies['packages']:
        for file in package['license_files']:
            require(sha(relative_path(root,file['path'])) == file['sha256'], f'Vendor notice mismatch: {file["path"]}')
        vendor = relative_path(root,package['source_path'])
        checksum = read(vendor/'.cargo-checksum.json')
        require(checksum['package'] == package['registry_checksum'], 'Registry checksum mismatch')
        for name, expected in checksum['files'].items():
            require(sha(relative_path(vendor,name)) == expected, f'Vendored source mismatch: {name}')
            vendor_files += 1
    check('vendored_rust_sources_checksums_and_licenses', {'packages':len(dependencies['packages']), 'verified_source_files':vendor_files})

    japanese = read(root/'licenses/jnethack/PROVENANCE.json')
    require(japanese['pinned_commit'] == '25adee135c4bbd43ac8567664f600b565332435c', 'Unexpected Japanese text source commit')
    for item in japanese['files']:
        path = relative_path(root,item['retained_path'])
        require(sha(path) == item['retained_sha256'] and path.stat().st_size == item['retained_bytes'], 'Japanese original notice mismatch')
    check('pinned_japanese_translation_notices_and_credits_preserved', {'pinned_commit':japanese['pinned_commit'], 'notice_files':len(japanese['files']), 'authors':len(japanese['translation_authors']), 'fork_gameplay_used':False})

    runtime = read(root/'licenses/RUNTIME-PROVENANCE.json')
    sdk_notices = {'Emscripten-6.0.8-LICENSE.txt':'LICENSE','Emscripten-6.0.8-AUTHORS.txt':'AUTHORS',
        'musl-COPYRIGHT.txt':'system/lib/libc/musl/COPYRIGHT','LLVM-compiler-rt-LICENSE.txt':'system/lib/compiler-rt/LICENSE.TXT',
        'LLVM-compiler-rt-CREDITS.txt':'system/lib/compiler-rt/CREDITS.TXT','LLVM-libc-LICENSE.txt':'system/lib/llvm-libc/LICENSE.TXT'}
    originals = 0
    for file in runtime['files']:
        path = relative_path(root,file['destination'])
        require(sha(path) == file['sha256'] and path.stat().st_size == file['bytes'], 'Runtime notice mismatch')
        basename = path.name
        original = None
        if args.sdk_root and basename in sdk_notices:
            original = args.sdk_root/sdk_notices[basename]
        if args.rust_doc_root and basename == 'Rust-1.98.1-COPYRIGHT-library.html':
            original = args.rust_doc_root/'COPYRIGHT-library.html'
        if args.rust_doc_root and '/rust/' in file['destination']:
            original = args.rust_doc_root/'licenses'/basename
        if original:
            require(path.read_bytes() == original.read_bytes(), f'Original runtime notice differs: {basename}')
            originals += 1
        if args.sdk_root and file.get('verbatim_blocks'):
            output = path.read_bytes()
            for block in file['blocks']:
                source = relative_path(args.sdk_root,block['source_paths'][0])
                matching = [x for x in re.findall(rb'/\*[\s\S]*?\*/',source.read_bytes()) if hashlib.sha256(x).hexdigest() == block['original_notice_sha256']]
                require(bool(matching) and matching[0] in output, 'Original embedded musl notice differs')
            originals += 1
        if args.sdk_root and basename == 'dlmalloc-2.8.6-original-notice.txt':
            require(path.read_bytes().rstrip(b'\n') in (args.sdk_root/'system/lib/dlmalloc.c').read_bytes(), 'Original dlmalloc notice differs')
            originals += 1
    check('linked_runtime_notices_original_hashes_and_provenance', {'notice_files':len(runtime['files']), 'bytes':sum(x['bytes'] for x in runtime['files']), 'installed_originals_compared':originals, 'emscripten':runtime['emscripten_version'], 'rust':runtime['rust_version']})
    manifest = read(root/'build/engine-manifest.json')
    lineage = manifest.get('source_lineage')
    if lineage:
        require(sha(root/'build/source-changes.json') == lineage['source_changes_sha256'], 'Engine source-change lineage differs')
        require(sha(root/'build/upstream-adapter.patch') == lineage['upstream_adapter_patch_sha256'], 'Engine adapter lineage differs')
        require(sha(root/'build/lua-source-manifest.json') == lineage['lua_manifest_sha256'], 'Engine Lua lineage differs')
    if manifest.get('isolated_phase6'):
        selected_source_manifest = root/'build/phase6/source-manifest.json'
        require(sha(selected_source_manifest) == manifest['isolated_phase6']['source_manifest_sha256'], 'Actual Phase6 source manifest differs')
        require(sha(selected_source_manifest) == manifest['semantic_producer']['phase4']['source_manifest_sha256'], 'Semantic producer source manifest differs')
        check('actual_phase6_source_manifest_and_engine_lineage_binding', {'source_manifest_sha256':sha(selected_source_manifest), 'source_lineage_verified':bool(lineage)})
    for name in manifest['compiled_sources']:
        require(relative_path(root/'engine-source',name).is_file(), f'Compiled source missing: {name}')
    if args.live_root:
        web_root = (args.web_root or args.live_root/'web').resolve()
        require(web_root.is_relative_to(args.live_root.resolve()), 'Actual web tree escaped live project')
        for name, metadata in manifest['artifacts'].items():
            live = relative_path(web_root/'engine',name)
            require(sha(live) == metadata['sha256'] and live.stat().st_size == metadata['bytes'], f'Engine artifact mismatch: {name}')
    check('complete_compiled_sources_and_actual_engine_artifact_binding', {'compiled_sources':len(manifest['compiled_sources']), 'artifacts':manifest['artifacts'], 'actual_artifacts_compared':bool(args.live_root)})
    boundary = read(relative_path(root,args.boundary_report))
    require(boundary['status'] == 'passed' and boundary['failed'] == 0, 'Boundary evidence not passed')
    missing_artifacts = []
    for name, expected in boundary['runtime_sha256'].items():
        path = relative_path(root,name)
        if not path.is_file() and args.live_root:
            path = relative_path(web_root,name[len('web/'):]) if name.startswith('web/') else relative_path(args.live_root,name)
        if not path.is_file():
            missing_artifacts.append(name)
        else:
            require(sha(path) == expected, f'Boundary runtime binding mismatch: {name}')
    for name, expected in boundary['source_sha256'].items():
        require(sha(relative_path(root,name.replace(args.engine_source_prefix,'engine-source/',1))) == expected, f'Boundary source binding mismatch: {name}')
    check('packaged_final_host_and_actual_wasm_boundary_evidence_binding', {'passed':boundary['total_passed'], 'failed':boundary['failed'], 'wasm_sha256':boundary['wasm_sha256'], 'unavailable_binary_inputs':missing_artifacts, 'independent_suite_rerun':False})

    if args.rust_test_report:
        require(not prior and args.rust_checkpoint, 'Current Rust proof needs its checkpoint and cannot use a historical prior report')
        proof_path = relative_path(root,args.rust_test_report)
        checkpoint_path = relative_path(root,args.rust_checkpoint)
        proof, checkpoint = read(proof_path), read(checkpoint_path)
        if proof['status'] == 'native_rust_phase6_tests_passed':
            details = phase6_rust_proof(root, proof, checkpoint, checkpoint_path, manifest)
            check('packaged_selected_rust_sources_match_actual_offline_locked_tests', details)
        else:
            require(proof['status'] == 'native_rust_phase3_tests_passed' and proof['failed'] == 0 and proof['tests_passed'] > 0, 'Current native Rust proof did not pass')
            require(sha(checkpoint_path) == proof['source_checkpoint_sha256'], 'Rust checkpoint differs from executed proof')
            for item in checkpoint['sourceFiles']:
                path = (root/'rust'/item['path']).resolve()
                require(path.is_relative_to(root.resolve()) and path.is_file(), 'Rust checkpoint source escapes packaged root')
                require(sha(path) == item['sha256'] and path.stat().st_size == item['bytes'], f'Current tested Rust source mismatch: {item["path"]}')
            require(sha(root/'locales/gameplay-core.json') == proof['gameplay_catalog_sha256'], 'Tested gameplay catalog mismatch')
            log = relative_path(root,'build/rust-phase3-final-test.log')
            resource = relative_path(root,'build/rust-phase3-final-test-resource.json')
            require(sha(log) == proof['test_log_sha256'] and sha(resource) == proof['resource_report_sha256'], 'Actual native test transcript/resource proof mismatch')
            actual = read(resource)
            require(actual['exit_code'] == 0 and re.search(rf'test result: ok\. {proof["tests_passed"]} passed; 0 failed;',log.read_text('utf-8')), 'Native test transcript does not prove pass')
            check('packaged_current_rust_sources_match_actual_offline_locked_tests', {'native_tests_passed':proof['tests_passed'], 'native_tests_failed':0, 'source_files':len(checkpoint['sourceFiles']), 'log_sha256':proof['test_log_sha256'], 'offline_locked':True, 'isolated_empty_cargo_home':False, 'suite_rerun_by_audit':False})
            check('vendored_lua_and_offline_builder_inputs_present_for_current_revision', {'lua_source_files_verified':len(lua['files']), 'builder_included':True, 'preparation_rerun_by_audit':False})
    elif prior:
        previous = Path(prior['extraction'])/'nethack'
        offline = next((x for x in prior['checks'] if x['name'] in {'extracted_rust_offline_empty_cargo_home_test','final_rust_sources_identical_to_independent_offline_tested_extraction'} and x['status'] == 'passed'),None)
        require(offline is not None and offline['details']['native_tests_passed'] == 24 and offline['details']['native_tests_failed'] == 0, 'Prior offline Rust evidence missing')
        require(tree_hashes(root/'rust') == tree_hashes(previous/'rust'), 'Rust source changed since offline test')
        check('final_rust_sources_identical_to_independent_offline_tested_extraction', {'prior_archive_sha256':prior['archive']['sha256'], 'native_tests_passed':24, 'native_tests_failed':0, 'isolated_empty_cargo_home':True, 'final_suite_rerun':False})
        prepared_evidence = next((x for x in prior['checks'] if x['name'] in {'extracted_offline_lua_and_patched_source_prepare','extracted_final_offline_lua_and_patched_source_prepare'} and x['status'] == 'passed'),None)
        require(prepared_evidence is not None, 'Prior executed offline source-preparation evidence missing')
        require((root/'build/lua-source-manifest.json').read_bytes() == (previous/'build/lua-source-manifest.json').read_bytes(), 'Lua prepare inputs changed')
        require((root/'tools/build-upstream.py').read_bytes() == (previous/'tools/build-upstream.py').read_bytes(), 'Builder changed since prior offline preparation')
        check('final_offline_lua_source_preparation_inputs_match_verified_prior_extraction', {'prior_offline_prepare_passed':True, 'builder_unchanged':True})
    else:
        check('final_rust_sources_identical_to_independent_offline_tested_extraction', 'Supply --prior-report to bind previous offline evidence','skipped')
        check('final_offline_lua_source_preparation_inputs_match_verified_prior_extraction', 'Supply --prior-report to bind previous preparation evidence','skipped')
    if args.prepared_root:
        matched = []
        for file in modified:
            name = file['path']
            if file['status'] == 'modified' or name == 'include/nhlua.h':
                require(relative_path(args.prepared_root,name).read_bytes() == relative_path(root/'engine-source',name).read_bytes(), f'Prepared input mismatch: {name}')
                matched.append(name)
        require((root/'tools/build-upstream-abi.c').read_bytes() == (root/'engine-source/sys/libnh/jrogue-abi.c').read_bytes(), 'Compile-phase ABI copy differs')
        for name, expected in lua['files'].items():
            require(sha(relative_path(args.prepared_root/'lib/lua-5.4.8',name)) == expected, f'Prepared Lua differs: {name}')
        check('extracted_final_offline_lua_and_patched_source_prepare', {'compiler_launched':False, 'full_c_engine_rebuild':False, 'prepared_sources_byte_identical_to_actual_packaged_modified_inputs':matched, 'pinned_lua_files_verified':len(lua['files']), 'prepared_reference':str(args.prepared_root.resolve()), 'preparation_rerun':False})
    else:
        check('extracted_final_offline_lua_and_patched_source_prepare', 'Supply --prepared-root to compare an existing offline prepared tree','skipped')
    if not args.live_root:
        report['limitations'].append('Actual compiled binary artifact checks require --live-root.')
    if not args.sdk_root or not args.rust_doc_root:
        report['limitations'].append('Installed-original runtime notice comparisons require --sdk-root and --rust-doc-root; distributed checksums were verified.')
    report['limitations'].append('Japanese gameplay translation is incomplete; this audit does not establish exhaustive gameplay coverage.')
    report['status'] = 'passed_source_integrity' if any(x['status'] == 'skipped' for x in report['checks']) or missing_artifacts or originals != len(runtime['files']) else 'passed_integrity_and_offline_rebuild_setup'
    report['completed_at_utc'] = datetime.now(timezone.utc).isoformat()
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':report['status'], 'archive_sha256':digest, 'bytes':args.archive.stat().st_size,
                      'checks_passed':sum(x['status']=='passed' for x in report['checks']), 'checks_skipped':sum(x['status']=='skipped' for x in report['checks']),
                      'regular_source_files':len(names), 'extraction':str(extraction)}))


if __name__ == '__main__':
    main()
