"""Added 2026-10-02, NGPL: read-only extracted-source prerequisite checks.

No compiler, preprocessor, Node, browser, network, generator, or packager runs.
--record is only for the source reviewer and writes this owned audit directory.
The default command verifies the recorded closure without changing any file.
"""
from __future__ import annotations

import argparse
import ast
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LEX = re.compile(r'/\*.*?\*/|//[^\n]*|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[A-Za-z_]\w*|\d+|\S', re.S)
FOUNDATIONS = ('work/phase4/NetHack-5.0.0', 'work/phase4/semantic-generated')
STAGE_EVIDENCE = ('build/phase6', 'build/phase6-rust', 'build/data-consumer-qa/phase6')
CAPTURED_DATA_SOURCES = (
    'build/data-consumer-qa/phase6/original-consumer.c',
    'build/data-consumer-qa/phase6/target-dlb-preprocessed.c',
)
PACKAGE_ALIASES = {
    'engine-source': 'work/phase6/NetHack-5.0.0',
    'rust': 'tools/semantic-text/phase6-immutable-catalog/rust-copy',
    'web': 'build/phase6/web',
}
EXTRA_INPUTS = (
    'tools/package-source.py', 'tools/audit-source-package.py', 'tools/deliver-local.py',
    'tools/check-phase6-js-syntax.py',
    'tools/instrument-semantic-text.py', 'tools/inventory_source.py',
    'locales/build-gameplay-catalog.py', 'tools/semantic-text/phase5-grammar/prepare.py',
    'tools/semantic-text/phase6-integration/inputs.lock.json',
    'work/phase4/semantic-generated/audit.json',
    'work/phase4/semantic-generated/phase4-inputs/call-operations.json',
    'build/lua-source-manifest.json',
    'build/phase6/source-manifest.json',
    'tools/semantic-text/phase6-immutable-catalog/approved-fixtures.json',
    *CAPTURED_DATA_SOURCES,
)


def load(path):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('duplicate JSON key: ' + key)
            result[key] = value
        return result
    return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=pairs)


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def relative(root, path):
    path = path.resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError('input escapes extracted project: ' + str(path))
    return path.relative_to(root.resolve()).as_posix()


def composer_paths(root):
    """Evaluate only the reviewed path-list function, never the generator."""
    source = root / 'tools/semantic-text/phase6-integration/prepare.py'
    tree = ast.parse(source.read_text(encoding='utf-8'))
    functions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'input_paths']
    if len(functions) != 1:
        raise ValueError('composer path-list function changed')
    scope = {'ROOT': root, 'TOOLS': root / 'tools/semantic-text',
             'HERE': source.parent, 'FOUNDATION_META': root / FOUNDATIONS[1]}
    exec(compile(ast.Module(body=functions, type_ignores=[]), str(source), 'exec'), scope)
    return scope['input_paths']()


def native_save(path):
    return path.suffix.lower() in ('.save', '.sav') or path.name.lower().endswith('.save.json')


def generic_package_eligible(path):
    return (not any(part in ('target', 'downloads', 'node_modules', '.sites-runtime', 'results', '__pycache__')
                    for part in path.parts)
            and path.suffix.lower() not in ('.wasm', '.data') and not native_save(path))


def source_eligible(path, subtree):
    parts = path.relative_to(subtree).parts
    if any(part in ('obj', 'native', '__pycache__', 'browser-profiles', 'node_modules') for part in parts):
        return False
    if native_save(path):
        return False
    return path.suffix.lower() not in ('.wav', '.uu', '.o', '.obj', '.exe', '.dll', '.a', '.lib', '.wasm', '.save') or path.name == 'Makefile.lib'


def fixture_records(root, crate):
    records = []
    for source in sorted(crate.rglob('*.rs')):
        if any(part in ('target', 'vendor') for part in source.relative_to(crate).parts):
            continue
        for match in re.finditer(r'include_(?:bytes|str)!\s*\(\s*"([^"\n]+)"\s*\)', source.read_text(encoding='utf-8')):
            target = (source.parent / match.group(1)).resolve()
            records.append({'consumer': relative(root, source), 'literal': match.group(1),
                            'path': relative(root, target), 'exists': target.is_file()})
    return records


def closure_paths(root):
    paths = set(composer_paths(root)) | {root / name for name in EXTRA_INPUTS}
    # The composer clones the foundation recursively. Preserve/hash every
    # source/data member selected by the package's rebuild-input filter.
    for name in (*FOUNDATIONS, 'upstream/NetHack-5.0.0'):
        directory = root / name
        paths.update(path for path in directory.rglob('*') if path.is_file() and source_eligible(path, directory))
    # Generated native wrapper headers are read by the composer but not listed
    # individually in its existing input lock. Preserve the complete header set.
    headers = root / 'tools/semantic-text/phase6-native-api/generated/include/nh-phase6-native'
    paths.update(headers.glob('*.h'))
    crate = root / 'tools/semantic-text/phase6-immutable-catalog/rust-copy'
    paths.update(path for path in crate.rglob('*') if path.is_file() and 'target' not in path.relative_to(crate).parts)
    fixtures = fixture_records(root, crate)
    paths.update(root / row['path'] for row in fixtures)
    # Runtime frontend sources are copied from this complete reviewed overlay.
    web = root / 'tools/semantic-text/phase6-immutable-catalog/host-overlay'
    paths.update(path for path in web.rglob('*') if path.is_file() and 'engine' not in path.relative_to(web).parts)
    # These Rust proof inputs are complete/stable. Compiler/data/browser output
    # from the currently running Phase6 engine build is deliberately not frozen
    # into the source-prerequisite list; the final package snapshot binds it.
    # The completed data gate's two exact captured C inputs are separate EXTRA
    # guards; this does not broaden the evidence selection to arbitrary C files.
    paths.update(stage_files(root, 'build/phase6-rust'))
    return sorted(paths), fixtures


def stage_files(root, name):
    directory = root / name
    return [path for path in sorted(directory.rglob('*')) if path.is_file()
            and not native_save(path)
            and not any(part in ('web', 'browser-profiles', 'screenshots', 'target', '__pycache__', 'node_modules')
                        for part in path.relative_to(directory).parts)
            and (path.suffix.lower() in ('.json', '.patch', '.log')
                 or relative(root, path) in CAPTURED_DATA_SOURCES)]


def stage_freeze_policy(name):
    if name == 'build/phase6-rust':
        return 'stable Rust evidence guarded'
    if name == 'build/data-consumer-qa/phase6':
        return 'two exact completed captured C inputs guarded; other evidence bound by final packaged member snapshot'
    return 'future/current engine and data outputs bound by final packaged member snapshot'


def package_selected_paths(root, crate, web):
    """Read-only simulation of current package-source.py selected paths.

    It assumes all three repeated --stage-evidence values plus both foundations.
    This is an input-closure check, not an actual tar creation/validation.
    """
    selected = set()
    for name in ('tools', 'docs', 'rust', 'web', 'catalog', 'locales', 'licenses', 'tests'):
        directory = crate if name == 'rust' else web if name == 'web' else root / name
        for path in directory.rglob('*'):
            if not path.is_file() or not generic_package_eligible(path):
                continue
            selected.add(path.resolve())
    for name in ('upstream/NetHack-5.0.0', *FOUNDATIONS):
        directory = root / name
        selected.update(path.resolve() for path in directory.rglob('*') if path.is_file() and source_eligible(path, directory))
    selected.update(path.resolve() for pattern in ('*.json', '*.patch') for path in (root / 'build').glob(pattern)
                    if not native_save(path))
    for name in STAGE_EVIDENCE:
        selected.update(path.resolve() for path in stage_files(root, name))
    return selected


def record_package_aliases(root):
    """Capture selected source bytes; this does not create or extract an archive."""
    rows = []
    for alias, source_name in PACKAGE_ALIASES.items():
        directory = root / source_name
        if not directory.is_dir():
            raise ValueError('selected package source missing: ' + source_name)
        for path in sorted(directory.rglob('*')):
            if not path.is_file():
                continue
            if alias == 'engine-source':
                selected = (not any(part in ('obj', 'native') for part in path.parts)
                            and not native_save(path)
                            and (path.suffix.lower() not in ('.wav', '.uu', '.o', '.obj', '.exe', '.dll', '.a', '.lib')
                                 or path.name == 'Makefile.lib'))
            else:
                selected = generic_package_eligible(path)
            if not selected:
                continue
            if path.is_symlink():
                raise ValueError('selected alias source is a symlink: ' + relative(root, path))
            rows.append({'path': alias + '/' + path.relative_to(directory).as_posix(),
                         'source_path': relative(root, path), 'bytes': path.stat().st_size, 'sha256': sha(path)})
    crate = root / PACKAGE_ALIASES['rust']
    fixtures = []
    for row in fixture_records(root, crate):
        consumer = root / row['consumer']
        alias_consumer = root / 'rust' / consumer.relative_to(crate)
        target = (alias_consumer.parent / row['literal']).resolve()
        original = root / row['path']
        fixtures.append({'consumer': relative(root, alias_consumer), 'literal': row['literal'],
                         'path': relative(root, target), 'source_target': row['path'],
                         'bytes': original.stat().st_size, 'sha256': sha(original)})
        if not target.is_relative_to((root / 'rust').resolve()):
            if not target.is_file() or sha(target) != sha(original):
                raise ValueError('portable Rust external fixture differs: ' + relative(root, target))
    return {'schema_version': 1, 'date': '2026-10-02', 'source_only': True,
            'archive_created_or_extracted': False, 'aliases': PACKAGE_ALIASES,
            'files': sorted(rows, key=lambda row: row['path']), 'rust_literal_fixtures': fixtures,
            'limits': ['Captures the selected candidate source bytes without claiming archive extraction.',
                       'WASM/data downloads are excluded; live binary verification is a separate gate.',
                       'Run package-layout verification on a fresh extraction before compiling or modifying aliases.']}


def verify_package_aliases(root, manifest, errors):
    checked = 0
    expected = {row['path'] for row in manifest['files']}
    for row in manifest['files']:
        original = root / row['path']
        path = original.resolve(); relative(root, path)
        if not path.is_file() or original.is_symlink():
            errors.append('package alias file missing/nonregular: ' + row['path'])
        elif path.stat().st_size != row['bytes'] or sha(path) != row['sha256']:
            errors.append('package alias file changed: ' + row['path'])
        checked += 1
    for alias in manifest['aliases']:
        directory = root / alias
        actual = {relative(root, path) for path in directory.rglob('*') if path.is_file() or path.is_symlink()}
        for name in sorted(actual - {name for name in expected if name.startswith(alias + '/')}):
            errors.append('unrecorded package alias file: ' + name)
    for row in manifest['rust_literal_fixtures']:
        path = (root / row['path']).resolve(); relative(root, path)
        if not path.is_file() or path.stat().st_size != row['bytes'] or sha(path) != row['sha256']:
            errors.append('portable Rust alias fixture missing/changed: ' + row['path'])
    return {'requested': True, 'files_checked': checked,
            'rust_literal_fixtures_checked': len(manifest['rust_literal_fixtures'])}


def verify_rust_proof(root, errors):
    proof_path = root / 'build/phase6-rust/actual-proof.json'
    proof = load(proof_path)
    checkpoint = root / 'build/phase6-rust/source-checkpoint-formatted.json'
    if sha(checkpoint) != proof['source_checkpoint_sha256']:
        errors.append('Rust formatted source checkpoint differs from actual proof')
    crate = (root / proof['selectedRustRoot']).resolve(); relative(root, crate)
    checked = 0
    for row in proof['sourceFiles']:
        target = (crate / row['path']).resolve(); relative(root, target)
        if not target.is_file() or target.stat().st_size != row['bytes'] or sha(target) != row['sha256']:
            errors.append('Rust proof source changed: ' + row['path'])
        checked += 1
    for row in proof['projectProvenance']:
        target = (root / row['path']).resolve(); relative(root, target)
        if not target.is_file() or sha(target) != row['sha256']:
            errors.append('Rust proof project provenance changed: ' + row['path'])
    for row in proof['tested_fixtureSha256']:
        target = (root / row['project_path']).resolve(); relative(root, target)
        if not target.is_file() or sha(target) != row['sha256']:
            errors.append('Rust proof literal fixture changed: ' + row['project_path'])
    for name, row in proof['validation'].items():
        for field in ('resource', 'log'):
            path = (root / row[field + 'Path']).resolve(); relative(root, path)
            if not path.is_file() or sha(path) != row[field + 'Sha256']:
                errors.append('Rust proof ' + name + ' ' + field + ' missing/changed')
    return {'source_files_checked': checked, 'validation_groups_checked': len(proof['validation']),
            'log_files_checked': len(proof['validation']), 'recorded_tests_passed': proof['tests_passed'],
            'qualification': 'Existing proof inputs verified; this checker runs no Rust/compiler command.'}


def tokens(source):
    return [match for match in LEX.finditer(source) if not match.group().startswith(('/*', '//', '"', "'"))]


def logical_location(source, physical, default_file):
    presumed, filename = 1, default_file
    for line in source.splitlines()[:physical - 1]:
        directive = re.match(r'^\s*#\s*(?:line\s+)?(\d+)(?:\s+"([^"]+)")?', line)
        if directive:
            presumed = int(directive.group(1))
            if directive.group(2):
                filename = directive.group(2)
        else:
            presumed += 1
    return {'physical_line': physical, 'presumed_line': presumed, 'presumed_file': filename,
            'method': 'lexical #line interpretation only; no preprocessor executed'}


def macro_inventory(root):
    official = root / 'upstream/NetHack-5.0.0'
    files, direct, headers, prepared = [], [], [], []
    for path in sorted((official / 'src').glob('*.c')):
        source = path.read_text(encoding='utf-8'); name = path.relative_to(official).as_posix()
        files.append({'source': name, 'sha256': sha(path)})
        builtins = [match for match in tokens(source) if match.group() in ('__LINE__', '__FILE__')]
        for match in builtins:
            line = source.count('\n', 0, match.start()) + 1
            if name == 'src/dungeon.c':
                classification = 'debug-output-control'
                meaning = 'explicitdebug gates wizard DEBUG dungeon diagnostics; no RNG seed/gameplay choice uses this filename'
                evidence = ['src/dungeon.c:90-132', 'src/files.c:3126-3168', 'include/lint.h:24-27']
            elif name == 'src/dlb.c':
                classification = 'overflow-diagnostic-location'
                meaning = 'FITSuint_ casts original value; line is used only in overflow panic text'
                evidence = ['src/alloc.c:275-283']
            else:
                classification = 'unused-format-diagnostic-location'
                meaning = 'nh_snprintf marks line UNUSED; diagnostic use is in original #if 0, formatting/truncation does not depend on its value'
                evidence = ['src/hacklib.c:854-875']
            direct.append({'source': name, 'line': line, 'token': match.group(),
                           'source_sha256': sha(path), 'classification': classification,
                           'meaning': meaning, 'consumer_evidence': evidence,
                           'original_line': source.splitlines()[line - 1],
                           'rng_or_normal_game_control_use': False})
        target = root / 'work/phase6/NetHack-5.0.0' / name
        if target.is_file() and builtins:
            current = target.read_text(encoding='utf-8')
            occurrences = [match for match in tokens(current) if match.group() in ('__LINE__', '__FILE__')]
            prepared.append({'source': name, 'sha256': sha(target),
                             'original_builtin_sequence': [m.group() for m in builtins],
                             'prepared_builtin_sequence': [m.group() for m in occurrences],
                             'location_record_kind': 'lexical builtin token location; macro definitions expand at their call sites',
                             'locations': [logical_location(current, current.count('\n', 0, m.start()) + 1, name) for m in occurrences]})
    for path in sorted((official / 'include').glob('*.h')):
        source = path.read_text(encoding='utf-8'); name = path.relative_to(official).as_posix()
        for match in tokens(source):
            if match.group() not in ('__LINE__', '__FILE__'):
                continue
            line = source.count('\n', 0, match.start()) + 1
            if path.name == 'lint.h':
                kind, evidence = 'debug-output-control', ['include/lint.h:24-68', 'src/files.c:3126-3168']
            elif path.name == 'extern.h' and 230 < line < 245:
                kind, evidence = 'diagnostic-breadcrumb-state', ['src/ball.c:180-188', 'src/ball.c:259-345']
            elif path.name == 'global.h' and 330 < line < 345:
                kind, evidence = 'heap-log-and-failure-location', ['src/alloc.c:152-228']
            elif path.name in ('windconf.h', 'winX.h') or (path.name == 'global.h' and line > 460):
                kind, evidence = 'assertion-or-fatal-diagnostic-location', ['src/pline.c:690-717', name + ':' + str(line)]
            elif 'Snprintf' in '\n'.join(source.splitlines()[max(0, line - 3):line]):
                kind, evidence = 'unused-format-diagnostic-location', ['src/hacklib.c:854-875']
            else:
                kind, evidence = 'overflow-diagnostic-location', ['src/alloc.c:266-283', 'src/strutil.c:82-98']
            headers.append({'source': name, 'line': line, 'token': match.group(), 'sha256': sha(path),
                            'classification': kind, 'consumer_evidence': evidence,
                            'original_line': source.splitlines()[line - 1],
                            'rng_or_normal_game_control_use': False})
    return {'schema_version': 1, 'source_only': True, 'preprocessor_executed': False,
            'official_commit': '16ff59115315917b93185d026aeefea06db9b0f4',
            'core_file_count': len(files), 'core_files': files, 'actual_core_builtin_occurrences': direct,
            'header_builtin_occurrences': headers, 'prepared_core_builtin_snapshot': prepared,
            'counts': {'core_occurrences': len(direct), 'core_tokens': dict(Counter(row['token'] for row in direct)),
                       'header_occurrences': len(headers), 'header_tokens': dict(Counter(row['token'] for row in headers))},
            'limits': ['Header macro records are definitions; this is not a preprocessor expansion census.',
                       'BREADCRUMBS stores source locations in bookkeeping fields; restriction/RNG uses original pin/state, never the location.',
                       'Original and combined source physical line numbers may differ. Phase7-only #line restores do not certify earlier composition.',
                       'No compiler, target macro branch activation, binary equivalence, gameplay or RNG execution was tested.']}


def verify_packaged_snapshot(root, errors):
    path = root / 'build/packaged-input-manifest.json'
    if not path.is_file():
        return {'present': False, 'checked': 0, 'note': 'No archive extraction tested; current workspace has no packaged member snapshot.'}
    snapshot = load(path)
    # package-source currently stores the member map under selected_files.
    if 'selected_files' in snapshot:
        snapshot = snapshot['selected_files']
    elif 'files' in snapshot:
        snapshot = snapshot['files']
    elif 'members' in snapshot:
        snapshot = snapshot['members']
    if not isinstance(snapshot, dict):
        raise ValueError('unsupported packaged member snapshot shape')
    checked = 0
    for name, record in snapshot.items():
        if not name.startswith('nethack/'):
            raise ValueError('packaged path escapes nethack: ' + name)
        target = (root / name[len('nethack/'):]).resolve()
        relative(root, target)
        if not target.is_file():
            errors.append('packaged member missing: ' + name)
        elif target.stat().st_size != record['bytes'] or sha(target) != record['sha256']:
            errors.append('packaged member changed: ' + name)
        checked += 1
    return {'present': True, 'checked': checked}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--record', action='store_true')
    parser.add_argument('--project-root', type=Path, default=ROOT)
    parser.add_argument('--sdk', type=Path, help='Optional read-only installed SDK/native compiler prerequisite check')
    parser.add_argument('--package-layout', action='store_true', help='Verify engine-source/rust/web aliases on a fresh archive extraction')
    args = parser.parse_args(); root = args.project_root.resolve(); errors = []
    output = root / 'tools/semantic-text/source-offer-rebuild-check'
    manifest_path = output / 'closure.manifest.json'
    if args.record:
        if output.resolve() != HERE.resolve():
            raise ValueError('--record is restricted to this reviewer directory')
        paths, fixtures = closure_paths(root)
        lock_path = root / 'tools/semantic-text/phase6-integration/inputs.lock.json'
        lock = load(lock_path); locked = {row['path'] for row in lock['inputs']}
        rows = []
        for path in paths:
            if not path.is_file():
                raise ValueError('required source input missing: ' + relative(root, path))
            rows.append({'path': relative(root, path), 'bytes': path.stat().st_size, 'sha256': sha(path)})
        selected = package_selected_paths(root, root / 'tools/semantic-text/phase6-immutable-catalog/rust-copy',
                                          root / PACKAGE_ALIASES['web'])
        missing = [row['path'] for row in rows if (root / row['path']).resolve() not in selected]
        macro = macro_inventory(root)
        aliases = record_package_aliases(root)
        (output / 'package-layout.aliases.json').write_text(json.dumps(aliases, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
        (output / 'source-builtins.inventory.json').write_text(json.dumps(macro, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
        manifest = {'schema_version': 1, 'date': '2026-10-02', 'source_only': True,
                    'compiler_executed': False, 'archive_created_or_extracted': False,
                    'composer_inputs_lock_sha256': sha(lock_path), 'composer_lock_input_count': len(locked),
                    'required_files': rows, 'fixture_references': fixtures,
                    'package_selection_assumptions': {'engine_source': 'work/phase6/NetHack-5.0.0',
                        'rust_root': 'tools/semantic-text/phase6-immutable-catalog/rust-copy',
                        'web_root': PACKAGE_ALIASES['web'],
                        'stage_evidence': list(STAGE_EVIDENCE), 'rebuild_inputs': list(FOUNDATIONS)},
                    'stage_evidence_mapping': [{'path': name,
                        'current_selected_file_count': len(stage_files(root, name)),
                        'freeze_policy': stage_freeze_policy(name)} for name in STAGE_EVIDENCE],
                    'package_selection_missing_required_inputs': missing,
                    'additional_read_guards': [row for row in rows if row['path'] in EXTRA_INPUTS and row['path'] not in locked],
                    'source_builtins_inventory_sha256': sha(output / 'source-builtins.inventory.json'),
                    'package_layout_aliases_sha256': sha(output / 'package-layout.aliases.json'),
                    'offline_dependencies': {'lua': 'Bundled engine-source/lib/lua-5.4.8 and build/lua-source-manifest.json must match every file; otherwise setup may download.',
                        'rust': 'Vendored crates + Cargo.lock are included. Installed Rust 1.98, wasm32-unknown-emscripten target and compatible linker are external prerequisites.',
                        'sdk': 'Installed Emscripten 6.0.8 with Python 3.13.3_64bit and Node 24.19.0_64bit at the builder layout; task cache/system library cold builds remain necessary.',
                        'native': 'Original builder hardcodes the installed WinLibs UCRT gcc.exe path; no native helper executable is included or silently substituted.'},
                    'not_proven': ['Actual archive extraction', 'Optional source preparation replay from extraction',
                                  'Offline SDK/system-library compilation', 'Full engine/Rust rebuild',
                                  'Bit-identical rebuilt binaries or date-dependent data', 'Runtime/text/gameplay coverage']}
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    manifest = load(manifest_path)
    alias_path = output / 'package-layout.aliases.json'
    if not alias_path.is_file() or sha(alias_path) != manifest['package_layout_aliases_sha256']:
        errors.append('package alias source snapshot changed/missing')
    alias_result = {'requested': False, 'files_checked': 0,
                    'note': 'No archive extraction tested; add --package-layout only on a fresh extraction.'}
    if args.package_layout:
        alias_result = verify_package_aliases(root, load(alias_path), errors)
    builtin_path = output / 'source-builtins.inventory.json'
    if not builtin_path.is_file() or sha(builtin_path) != manifest['source_builtins_inventory_sha256']:
        errors.append('source builtin inventory changed')
    for row in manifest['required_files']:
        target = (root / row['path']).resolve(); relative(root, target)
        if not target.is_file(): errors.append('required input missing: ' + row['path'])
        elif target.stat().st_size != row['bytes'] or sha(target) != row['sha256']:
            errors.append('required input changed: ' + row['path'])
    lock_path = root / 'tools/semantic-text/phase6-integration/inputs.lock.json'
    lock = load(lock_path)
    if sha(lock_path) != manifest['composer_inputs_lock_sha256']:
        errors.append('composer input lock changed')
    if {row['path'] for row in lock['inputs']} != {relative(root, path) for path in composer_paths(root)}:
        errors.append('composer current input path set differs from frozen lock')
    for row in lock['inputs']:
        if not (root / row['path']).is_file() or sha(root / row['path']) != row['sha256']:
            errors.append('composer locked input changed: ' + row['path'])
    errors += ['proposed package omits required input: ' + path for path in manifest['package_selection_missing_required_inputs']]
    fixtures = fixture_records(root, root / 'tools/semantic-text/phase6-immutable-catalog/rust-copy')
    errors += ['selected Rust literal fixture missing: ' + row['path'] for row in fixtures if not row['exists']]
    bundled = root / 'engine-source/lib/lua-5.4.8'
    lua = load(root / 'build/lua-source-manifest.json')['files']
    lua_directory = bundled if bundled.is_dir() else root / 'work/phase4/NetHack-5.0.0/lib/lua-5.4.8'
    actual = {path.relative_to(lua_directory).as_posix(): sha(path) for path in lua_directory.rglob('*') if path.is_file()}
    if actual != lua: errors.append('bundled/foundation Lua file set or hashes differ from pinned manifest')
    packaged = verify_packaged_snapshot(root, errors)
    rust_proof = verify_rust_proof(root, errors)
    sdk_status = None
    if args.sdk:
        sdk = args.sdk.resolve()
        external = [sdk / 'python/3.13.3_64bit/python.exe', sdk / 'upstream/emscripten/emcc.py',
                    sdk / 'upstream/bin/clang.exe', sdk / 'node/24.19.0_64bit/node.exe', sdk / '.emscripten',
                    Path(r'C:\Users\kit\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin\gcc.exe')]
        sdk_status = [{'path': str(path), 'exists': path.is_file()} for path in external]
        errors += ['installed prerequisite missing: ' + str(path) for path in external if not path.is_file()]
    print(json.dumps({'status': 'source-prerequisites-verified' if not errors else 'blocked',
                      'source_only': True, 'required_files_checked': len(manifest['required_files']),
                      'composer_lock_inputs_checked': len(lock['inputs']), 'rust_fixture_references_checked': len(fixtures),
                      'lua_files_checked': len(actual), 'packaged_member_snapshot': packaged,
                      'package_layout_aliases': alias_result,
                      'existing_rust_proof': rust_proof,
                      'sdk_presence_only': sdk_status, 'error_count': len(errors), 'errors': errors}, ensure_ascii=False, indent=2))
    raise SystemExit(bool(errors))


if __name__ == '__main__':
    main()
