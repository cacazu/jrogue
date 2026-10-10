"""Bind finite original notice comments to immutable official Rust source bytes."""
from pathlib import Path
import hashlib
import importlib.util
import json
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('attribution_review', HERE / 'review.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
report_path = HERE / 'review-official.json'
report = json.loads(report_path.read_text(encoding='utf-8'))
certificate_path = HERE / 'notice-certificate.json'
bundle_path = HERE / 'original-comment-notices.txt'
assert not certificate_path.exists() and not bundle_path.exists()
checkpoint_path = m.ROOT / 'build/phase6-rust/source-checkpoint-formatted.json'
proof_path = m.ROOT / 'build/phase6-rust/actual-proof.json'
checkpoint = json.loads(checkpoint_path.read_text(encoding='utf-8'))
proof = json.loads(proof_path.read_text(encoding='utf-8'))
assert proof['source_checkpoint_sha256'] == m.sha(checkpoint_path.read_bytes())
assert proof['sourceFiles'] == checkpoint['sourceFiles']
assert proof['projectProvenance'] == checkpoint['projectProvenance']
for item in checkpoint['sourceFiles']:
    data = (m.ROOT / checkpoint['crateRoot'] / item['path']).read_bytes()
    assert len(data) == item['bytes'] and m.sha(data) == item['sha256']
for item in checkpoint['projectProvenance']:
    data = (m.ROOT / item['path']).read_bytes()
    assert len(data) == item['bytes'] and m.sha(data) == item['sha256']
source_rows = {}
rows = []
chunks = [b'Original compiler-builtins/libm source-comment notice inventory\n',
          b'Rust 1.98.1 source commit 48a229ceaefd4985c50990b14116b6d856af0985\n',
          b'All original notice block bytes follow verbatim; inventory is broader than final-link retention.\n\n']
for block in report['original_embedded_notice_inventory']['blocks']:
    origin = block['occurrences'][0]
    leaf = origin['rust_source_path']
    local = (m.SOURCE / leaf).read_bytes()
    if leaf not in source_rows:
        remote = m.fetch(m.RAW + leaf)
        assert remote == local, leaf
        source_rows[leaf] = {'rust_source_path': leaf, 'official_url': m.RAW + leaf,
                            'bytes': len(local), 'sha256': m.sha(local), 'local_equals_official': True}
    data = local[origin['start_byte']:origin['end_byte']]
    assert len(data) == block['bytes'] and m.sha(data) == block['sha256']
    for occurrence in block['occurrences']:
        other = (m.SOURCE / occurrence['rust_source_path']).read_bytes()
        assert m.sha(other) == occurrence['source_sha256']
        assert other[occurrence['start_byte']:occurrence['end_byte']] == data
    label = ('----- Original block ' + block['sha256'] + ' -----\n' +
             'Representative source: ' + leaf + '\n' +
             'Official source: ' + m.RAW + leaf + '\n').encode('utf-8')
    chunks.extend([label, data, b'\n\n'])
    rows.append({'block_sha256': block['sha256'], 'block_bytes': block['bytes'],
                 'representative_source_verified': source_rows[leaf],
                 'occurrences': block['occurrences']})
bundle = b''.join(chunks)
bundle_path.write_bytes(bundle)
certificate = {
    'schema_version': 1, 'status': 'passed', 'generated_at_utc': datetime.now(timezone.utc).isoformat(),
    'component_review': m.record(report_path), 'review_script': m.record(HERE / 'review.py'),
    'certificate_script': m.record(Path(__file__)),
    'source_checkpoint': m.record(checkpoint_path), 'actual_rust_proof': m.record(proof_path),
    'verified_rust_source_files': len(checkpoint['sourceFiles']),
    'verified_project_provenance_files': len(checkpoint['projectProvenance']),
    'runtime_provenance_unchanged': m.record(m.ROOT / 'licenses/RUNTIME-PROVENANCE.json'),
    'unique_original_notice_blocks': len(rows),
    'occurrences': sum(len(x['occurrences']) for x in rows),
    'official_representative_sources': list(source_rows.values()),
    'blocks': rows, 'verbatim_block_bundle': m.record(bundle_path),
    'qualifications': [
        'Every distinct inventoried original comment block is byte-verified against a representative immutable official Rust source file.',
        'All 75 recorded installed-source occurrences are byte-verified locally; representative verification does not claim the complete installed rust-src tree is independently validated.',
        'The bounded comment scan inventories matching copyright/license comment blocks; it is not a full source-file license audit.',
        'Preserving these original blocks is an evidence-backed additive notice option, not a claim that every routine survived final linking or a legal compatibility interpretation.',
        'The existing runtime bundle and actual Rust source/proof checkpoint remain unchanged; all 11 source and two project-provenance inputs still match.',
        'Only public-source reads and metadata operations ran; no compiler, Node, browser, installer or downloaded code was executed.',
    ],
}
certificate_path.write_text(json.dumps(certificate, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'certificate': m.record(certificate_path), 'bundle': m.record(bundle_path),
                  'official_sources': len(source_rows), 'blocks': len(rows), 'occurrences': certificate['occurrences']}))