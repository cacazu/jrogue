"""Added 2026-10-02, NGPL: installed notice file comparison only.

Runs no SDK/compiler/native query, Node, browser, installer or network request.
Only this directory receives the factual report; existing notices remain intact.
"""
from __future__ import annotations
from collections import Counter
import hashlib
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SDK = Path(r'C:\Users\kit\emsdk\upstream\emscripten')
RUSTUP = Path(r'C:\Users\kit\.rustup\toolchains')


def sha(value):
    return hashlib.sha256(value).hexdigest()


def info(path):
    data = path.read_bytes()
    return {'path': str(path), 'bytes': len(data), 'sha256': sha(data)}


def ar_members(path):
    """Read ar headers/names, never execute an archive tool or object code."""
    names = []; strings = b''
    with path.open('rb') as stream:
        if stream.read(8) != b'!<arch>\n':
            raise ValueError('unexpected Rust staticlib archive format')
        while True:
            header = stream.read(60)
            if not header:
                break
            if len(header) != 60 or header[58:] != b'`\n':
                raise ValueError('invalid ar member header')
            name = header[:16].decode('ascii').strip(); size = int(header[48:58])
            if name == '//':
                strings = stream.read(size)
            else:
                if name.startswith('/') and name[1:].isdigit():
                    start = int(name[1:]); end = strings.find(b'/\n', start)
                    if end < 0: raise ValueError('invalid ar long name')
                    name = strings[start:end].decode('utf-8')
                names.append(name.rstrip('/'))
                stream.seek(size, 1)
            if size % 2:
                stream.seek(1, 1)
    return names


def main():
    provenance_path = ROOT / 'licenses/RUNTIME-PROVENANCE.json'
    provenance = json.loads(provenance_path.read_text(encoding='utf-8'))
    errors = []; files = []; embedded = []
    for row in provenance['files']:
        destination = ROOT / row['destination']; data = destination.read_bytes()
        valid = len(data) == row['bytes'] and sha(data) == row['sha256']
        if not valid: errors.append('runtime destination changed: ' + row['destination'])
        result = {'component': row['component'], 'version': row['version'],
                  'destination': row['destination'], 'bytes': len(data), 'sha256': sha(data),
                  'matches_recorded_destination': valid, 'source_path': row['source_path']}
        if row.get('verbatim'):
            original = Path(row['source_path']).read_bytes()
            result['original'] = {'bytes': len(original), 'sha256': sha(original)}
            result['exact_original_bytes_present'] = data == original
            if data != original: errors.append('runtime original differs: ' + row['destination'])
        elif row.get('verbatim_blocks'):
            result['distinct_block_count'] = len(row['blocks']); checked = 0
            for block in row['blocks']:
                evidence = {'original_notice_sha256': block['original_notice_sha256'], 'sources': []}
                for name in block['source_paths']:
                    path = SDK / name; original = path.read_bytes()
                    matches = [match for match in re.finditer(rb'/\*.*?\*/', original, re.S)
                               if sha(match.group()) == block['original_notice_sha256']]
                    included = bool(matches and all(match.group() in data for match in matches))
                    evidence['sources'].append({'path': str(path), 'source_sha256': sha(original),
                        'matching_original_blocks': len(matches), 'exact_block_present_in_bundle': included,
                        'byte_offsets': [{'start': match.start(), 'end': match.end()} for match in matches]})
                    checked += 1
                    if not included: errors.append('musl exact notice block missing: ' + name)
                embedded.append(evidence)
            result['source_block_occurrences_checked'] = checked
        elif row.get('verbatim_block'):
            original = Path(row['source_path']).read_bytes()
            matches = [match for match in re.finditer(rb'/\*.*?\*/', original, re.S)
                       if match.group() == data.rstrip(b'\n')]
            result['exact_original_comment_present'] = bool(matches)
            result['bundled_trailing_newline_bytes'] = len(data) - len(data.rstrip(b'\n'))
            result['original_source_sha256'] = sha(original)
            result['original_comment_offsets'] = [{'start': match.start(), 'end': match.end()} for match in matches]
            if not matches: errors.append('dlmalloc original comment missing')
        files.append(result)

    dependency_path = ROOT / 'build/rust-dependencies.json'
    dependencies = json.loads(dependency_path.read_text(encoding='utf-8'))
    packages = []; crate = ROOT / 'tools/semantic-text/phase6-immutable-catalog/rust-copy'
    for row in dependencies['packages']:
        notices = []
        for notice in row['license_files']:
            source = ROOT / notice['path']
            selected = crate / Path(notice['path']).relative_to('rust')
            matches = source.is_file() and selected.is_file() and sha(source.read_bytes()) == notice['sha256'] == sha(selected.read_bytes())
            notices.append({'canonical_path': notice['path'], 'selected_source_path': selected.relative_to(ROOT).as_posix(),
                            'sha256': notice['sha256'], 'exact_in_both_vendor_trees': matches})
            if not matches: errors.append('vendored notice mismatch: ' + notice['path'])
        packages.append({'name': row['name'], 'version': row['version'], 'declared_license': row['license'], 'notices': notices})

    rust_documents = []
    for toolchain in sorted(RUSTUP.iterdir()):
        for name in ('COPYRIGHT-library.html', 'COPYRIGHT.html'):
            document = toolchain / 'share/doc/rust' / name
            if not document.is_file(): continue
            text = document.read_text(encoding='utf-8')
            rust_documents.append({**info(document), 'inventory_kind': name,
                'same_as_preserved_library_inventory': document.read_bytes() == (ROOT / 'licenses/runtime/Rust-1.98.1-COPYRIGHT-library.html').read_bytes() if name == 'COPYRIGHT-library.html' else None,
                'compiler_builtins_name_matches': len(re.findall(r'compiler[-_]builtins', text, re.I)),
                'compiler_rt_name_matches': len(re.findall(r'compiler[-_]rt', text, re.I))})

    proof = json.loads((ROOT / 'build/phase6-rust/actual-proof.json').read_text(encoding='utf-8'))
    library = ROOT / proof['rustLibrary']['path']; names = ar_members(library)
    families = Counter('compiler_builtins' if 'compiler_builtins' in name else 'std' if name.startswith('std-')
                       else 'other' for name in names)
    compiler_names = [name for name in names if 'compiler_builtins' in name]
    report = {'schema_version': 1, 'date': '2026-10-02', 'status': 'installed-runtime-notice-file-comparison-complete',
        'source_only': True, 'sdk_compiler_or_native_queries_executed': False,
        'network_or_installation_executed': False, 'existing_notices_or_locked_inputs_modified': False,
        'runtime_provenance': {**info(provenance_path), 'path': 'licenses/RUNTIME-PROVENANCE.json'},
        'counts': {'runtime_notice_artifacts': len(files), 'whole_original_files': sum(bool(row.get('exact_original_bytes_present')) for row in files),
            'musl_distinct_original_blocks': len(embedded), 'musl_source_block_occurrences': sum(len(row['sources']) for row in embedded),
            'vendored_crates': len(packages), 'vendored_notice_files': sum(len(row['notices']) for row in packages)},
        'runtime_files': files, 'musl_original_blocks': embedded,
        'rust_dependency_provenance': {**info(dependency_path), 'path': 'build/rust-dependencies.json'},
        'vendored_crates': packages, 'installed_rust_library_inventories': rust_documents,
        'selected_rust_staticlib_header_observation': {'path': proof['rustLibrary']['path'],
            'sha256': sha(library.read_bytes()), 'matches_existing_proof': sha(library.read_bytes()) == proof['rustLibrary']['sha256'],
            'ar_member_header_count': len(names), 'member_name_families': dict(families), 'compiler_builtins_member_names': compiler_names,
            'qualification': 'Archive header observation proves member presence in the selected input staticlib; it does not prove retention in the final linked WASM.'},
        'source_facts': ['The existing bundle contains original Emscripten LICENSE/AUTHORS, LLVM compiler-rt LICENSE/CREDITS and LLVM libc LICENSE.',
            'The existing bundle contains the exact installed Rust standard-library copyright inventory and Apache/MIT/Unicode/BSD/LLVM texts.',
            'All recorded musl comment blocks are compared as exact bytes in their original source and bundled notice inventory.',
            'Installed Rust copyright HTML inventories do not name compiler_builtins; component-specific notice coverage cannot be inferred from that name absence or generic license texts.'],
        'remaining_evidence_limits': ['Final engine link is a separate gate. This audit does not inventory which SDK/Rust archive members survived linking.',
            'No component-specific installed compiler_builtins notice was identified by the recorded inventory search; this is a factual attribution mapping limit, not a legal conclusion.',
            'The installed SDK and Rust source/library paths are recorded for provenance; no SDK implementation or binary was copied.',
            'No rights interpretation, license compatibility judgment, approval request or publication action is performed.'],
        'error_count': len(errors), 'errors': errors}
    if not report['selected_rust_staticlib_header_observation']['matches_existing_proof']:
        raise ValueError('selected Rust staticlib differs from existing proof')
    (HERE / 'runtime-notices.audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'counts': report['counts'], 'error_count': len(errors), 'errors': errors,
                      'compiler_builtins_members_in_selected_staticlib': len(compiler_names)}, indent=2))
    raise SystemExit(bool(errors))


if __name__ == '__main__':
    main()
