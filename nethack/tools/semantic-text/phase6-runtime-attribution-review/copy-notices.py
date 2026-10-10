"""Root-authorized additive original-notice copies; preserve every existing input."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('attribution_review', HERE / 'review.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
ROOT = m.ROOT
EXPECTED = {
    ROOT / 'licenses/RUNTIME-PROVENANCE.json': '0e3c16320cbba84114f40d3d20fd547f6d7fa661e788970f4e8e9eb55722efdb',
    ROOT / 'build/phase6-rust/source-checkpoint-formatted.json': 'b4ac648b01256462d9a24169cea025a1f539ac9966fcb133030e222af977dd5c',
    ROOT / 'build/phase6-rust/actual-proof.json': 'd115a3d6b82dcba2233f15a70be052d2c1895fb931cde6f8edcee49dac667ff3',
    HERE / 'review-official.json': '9bd67ae429556c5ae800ec68e9738250bd6196e46ec1c3b3200289052dcb938f',
    HERE / 'notice-certificate.json': '1c8381848459dfe3df6aa267ba119ea71ea400ca3e2801edf20eb52079be9a7c',
    HERE / 'original-comment-notices.txt': 'f77f6b96321d03039dbb2a6fbe29960aa824c0c50499b401c68835fb9b3faa28',
}
review = json.loads((HERE / 'review-official.json').read_text(encoding='utf-8'))
certificate = json.loads((HERE / 'notice-certificate.json').read_text(encoding='utf-8'))
checkpoint = json.loads((ROOT / 'build/phase6-rust/source-checkpoint-formatted.json').read_text(encoding='utf-8'))
proof = json.loads((ROOT / 'build/phase6-rust/actual-proof.json').read_text(encoding='utf-8'))
baseline = json.loads((ROOT / 'licenses/RUNTIME-PROVENANCE.json').read_text(encoding='utf-8-sig'))
assert proof['sourceFiles'] == checkpoint['sourceFiles']
assert proof['projectProvenance'] == checkpoint['projectProvenance']
assert proof['tested_fixtureSha256'] == checkpoint['tested_fixtureSha256']
for item in checkpoint['sourceFiles']:
    EXPECTED[ROOT / checkpoint['crateRoot'] / item['path']] = item['sha256']
for item in checkpoint['projectProvenance']:
    EXPECTED[ROOT / item['path']] = item['sha256']
fixture_manifest = checkpoint['approvedFixtureManifest']
EXPECTED[ROOT / fixture_manifest['path']] = fixture_manifest['sha256']
for item in checkpoint['tested_fixtureSha256']:
    EXPECTED[ROOT / item['project_path']] = item['sha256']
assert len(baseline['files']) == 14
for item in baseline['files']:
    EXPECTED[ROOT / item['destination']] = item['sha256']
for item in review['source_evidence']:
    assert item['official_bytes_verified']
    EXPECTED[Path(item['local']['path'])] = item['official_sha256']
EXPECTED[Path(review['selected_staticlib']['path'])] = review['selected_staticlib']['sha256']
EXPECTED[Path(review['installed_target_rlib']['path'])] = review['installed_target_rlib']['sha256']
for item in certificate['official_representative_sources']:
    EXPECTED[m.SOURCE / item['rust_source_path']] = item['sha256']
for item in certificate['blocks']:
    for occurrence in item['occurrences']:
        EXPECTED[m.SOURCE / occurrence['rust_source_path']] = occurrence['source_sha256']
for item in [certificate['review_script'], certificate['certificate_script']]:
    EXPECTED[Path(item['path'])] = item['sha256']

def verify_guards():
    rows = []
    for path, digest in EXPECTED.items():
        assert path.is_file() and not path.is_symlink(), str(path)
        data = path.read_bytes()
        assert m.sha(data) == digest, 'Guard mismatch: ' + str(path)
        rows.append({'path': str(path), 'bytes': len(data), 'sha256': digest})
    return rows

before = verify_guards()
selected = m.ar_members(Path(review['selected_staticlib']['path']))
installed = m.ar_members(Path(review['installed_target_rlib']['path']))
selected_members = {name: data for name, data in selected.items() if name.startswith('compiler_builtins-')}
installed_members = {name: data for name, data in installed.items() if name.startswith('compiler_builtins-')}
assert selected_members.keys() == installed_members.keys() and len(selected_members) == 269
assert all(data == installed_members[name] for name, data in selected_members.items())
assert m.sha((ROOT / proof['rustLibrary']['path']).read_bytes()) == proof['rustLibrary']['sha256']
license_dir = ROOT / 'licenses/runtime/rust-compiler-builtins'
provenance_path = ROOT / 'licenses/RUST-COMPILER-BUILTINS-PROVENANCE.json'
verification_path = HERE / 'copy-verification.json'
copy_specs = [
    (m.SOURCE / 'library/compiler-builtins/LICENSE.txt', license_dir / 'LICENSE.txt', 15078,
     'ab6eec6caf0fa5775e411c7a8bc6a45c4ef2956b0980b157ab74fc5cd62a928b'),
    (m.SOURCE / 'library/compiler-builtins/libm/LICENSE.txt', license_dir / 'libm-LICENSE.txt', 14088,
     '3823dda7cf046602f4b4e77ec8e227863dc4736037cc85bb33d9f19febe16bb7'),
    (HERE / 'original-comment-notices.txt', license_dir / 'original-comment-notices.txt', 20114,
     'f77f6b96321d03039dbb2a6fbe29960aa824c0c50499b401c68835fb9b3faa28'),
]
for path in [provenance_path, verification_path] + [row[1] for row in copy_specs]:
    assert not path.exists() and not path.is_symlink(), 'Fresh exclusive path required: ' + str(path)
assert not license_dir.exists(), 'Fresh additive directory required'
copy_records = []
for source, destination, byte_count, digest in copy_specs:
    data = source.read_bytes()
    assert len(data) == byte_count and m.sha(data) == digest
    copy_records.append({'source_path': str(source), 'destination': destination.relative_to(ROOT).as_posix(),
                         'bytes': byte_count, 'sha256': digest, 'verbatim': True})
credits = review['referenced_llvm_credits']
assert credits['remote_verified'] and credits['existing_bundle_equals_snapshot']
assert credits['snapshot_commit'] == '439c28996aae50467c2c1e18e10b901e33ddf279'
assert credits['snapshot_sha256'] == 'a9901f47a089da41e4690682d00ce4cedaa2baf41fedbe79beee366d43ac2461'
provenance = {
    'schema_version': 1, 'generated_at_utc': datetime.now(timezone.utc).isoformat(),
    'scope': 'Additive original compiler_builtins/libm notices bound to the actual selected Rust staticlib input; no legal interpretation.',
    'component': review['component'],
    'rust_toolchain': {'version': '1.98.1', 'commit': m.COMMIT, 'target': 'wasm32-unknown-emscripten',
                      'channel_date': review['rust']['channel_date'],
                      'source_package_metadata': review['rust']['source_package'],
                      'target_std_package_metadata': review['rust']['target_std_package']},
    'actual_selected_input': {'staticlib': review['selected_staticlib'], 'installed_target_rlib': review['installed_target_rlib'],
                             'byte_identical_compiler_builtins_object_members': 269, 'failed_member_comparisons': 0,
                             'member_name_set_and_payload_equality': True,
                             'member_digests_recorded_in': 'tools/semantic-text/phase6-runtime-attribution-review/review-official.json'},
    'files': copy_records,
    'official_source_evidence': [{key: item[key] for key in ['rust_source_path', 'official_url', 'official_bytes', 'official_sha256', 'official_bytes_verified']}
                                for item in review['source_evidence']],
    'referenced_compiler_rt_credits': {'reference_url_in_original_component_license': credits['url_referenced_by_component_license'],
                                     'immutable_snapshot_commit': credits['snapshot_commit'], 'immutable_source_url': credits['snapshot_url'],
                                     'bytes': credits['snapshot_bytes'], 'sha256': credits['snapshot_sha256'],
                                     'existing_bundle_destination': 'licenses/runtime/LLVM-compiler-rt-CREDITS.txt',
                                     'existing_bundle_independently_equals_official_snapshot': True,
                                     'qualification': 'This referenced author file was checked independently; an Emscripten license is not assumed to cover a distinct Rust component.'},
    'original_comment_notices': {'distinct_verbatim_blocks': certificate['unique_original_notice_blocks'],
                                'recorded_local_occurrences': certificate['occurrences'],
                                'immutable_official_representative_source_files': len(certificate['official_representative_sources']),
                                'each_unique_block_verified_against_official_source': True,
                                'certificate_path': 'tools/semantic-text/phase6-runtime-attribution-review/notice-certificate.json',
                                'certificate_sha256': EXPECTED[HERE / 'notice-certificate.json']},
    'evidence': [{'path': path.relative_to(ROOT).as_posix(), 'sha256': EXPECTED[path]}
                 for path in [HERE / 'review-official.json', HERE / 'notice-certificate.json',
                              ROOT / 'build/phase6-rust/source-checkpoint-formatted.json', ROOT / 'build/phase6-rust/actual-proof.json']],
    'preserved_existing_runtime_bundle': {'path': 'licenses/RUNTIME-PROVENANCE.json',
                                         'sha256': EXPECTED[ROOT / 'licenses/RUNTIME-PROVENANCE.json'],
                                         'original_notice_artifact_count': 14, 'all_original_artifact_hashes_verified': True},
    'qualifications': [
        'Exact archive-member comparison proves component presence in the selected Rust input staticlib; retention of particular members or routines in the final linked WASM is unproved.',
        'The bounded comment scan records copyright/license comment blocks and is not a complete per-file license audit or final-link coverage conclusion.',
        'Every distinct inventoried block matches a representative immutable official Rust source; all 75 installed-source occurrences were byte-verified locally, without claiming independent validation of the entire rust-src distribution.',
        'No separate standalone compiler-builtins repository commit is inferred; the immutable official Rust tree supplies the exact in-tree source revision.',
        'No official distribution archive was independently downloaded or validated; pinned source-file comparisons and installed package metadata are the recorded source binding.',
        'The original declared license expression is metadata, not a license compatibility or rights conclusion.',
        'This is an additive notice record. Existing runtime provenance, its 14 original artifacts, actual Rust proof/source checkpoint, installed toolchains and build artifacts were unchanged.',
    ],
}
provenance_bytes = (json.dumps(provenance, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
license_dir.mkdir()
for source, destination, byte_count, digest in copy_specs:
    data = source.read_bytes()
    assert len(data) == byte_count and m.sha(data) == digest
    with destination.open('xb') as stream:
        stream.write(data)
    assert destination.read_bytes() == data and m.sha(destination.read_bytes()) == digest
with provenance_path.open('xb') as stream:
    stream.write(provenance_bytes)
assert provenance_path.read_bytes() == provenance_bytes
assert verify_guards() == before
for source, destination, byte_count, digest in copy_specs:
    assert source.read_bytes() == destination.read_bytes()
verification = {
    'schema_version': 1, 'status': 'passed', 'generated_at_utc': datetime.now(timezone.utc).isoformat(),
    'root_authorized_scope': 'Additive staging notice copies and separate provenance only',
    'exclusive_fresh_paths_used': True, 'copied_files': copy_records,
    'provenance': {'path': provenance_path.relative_to(ROOT).as_posix(), 'bytes': len(provenance_bytes), 'sha256': m.sha(provenance_bytes)},
    'source_and_destination_bytes_identical': True, 'actual_compiler_builtins_member_comparisons': 269,
    'guarded_existing_inputs': before, 'all_guards_unchanged_before_after': True,
    'rust_source_inputs_verified': len(checkpoint['sourceFiles']), 'project_provenance_inputs_verified': len(checkpoint['projectProvenance']),
    'tested_fixture_inputs_verified': len(checkpoint['tested_fixtureSha256']),
    'existing_runtime_notice_artifacts_verified': len(baseline['files']),
    'installed_changes': False, 'compiler_node_browser_git_executed': False,
    'copy_script': m.record(Path(__file__)),
    'qualifications': provenance['qualifications'],
}
with verification_path.open('xb') as stream:
    stream.write((json.dumps(verification, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
print(json.dumps({'verification': m.record(verification_path), 'provenance': verification['provenance'],
                  'copied_files': copy_records, 'guard_count': len(before), 'status': 'passed'}))