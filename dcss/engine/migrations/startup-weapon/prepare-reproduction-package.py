"""Derive the repository-local packaging recipe without running packaging."""
from pathlib import Path
import hashlib

HERE=Path(__file__).resolve().parent
original=HERE/'audit/executed-font-free-startup-package.py'
if hashlib.sha256(original.read_bytes()).hexdigest()!='52e44e62ea2ed5b8d13de2b862401b2899b3c13fa08df2074257d38b167ec921':
    raise ValueError('Executed packaging audit changed')
text=original.read_text(encoding='utf-8')

def edit(before,after):
    global text
    if text.count(before)!=1:raise ValueError('Expected one source transformation: '+before)
    text=text.replace(before,after,1)

edit("BUILDER_SHA = 'fed917abb533ec1eb62102b6a376fc7724643a6c3ac05ecdbf3a84dca90803f7'", "BUILDER_SHA = 'fed917abb533ec1eb62102b6a376fc7724643a6c3ac05ecdbf3a84dca90803f7'\nREPRO_BUILDER_SHA = 'ac80166cb5b0ef9cb66976840c57b9eb556005a2c7f10df5ff281591a6c8afc4'")
edit("def validate_native_baseline(root, sdk):", '''def relocated_flags(root, baseline, flags):
    ending='engine\\\\work-wasm-eh\\\\crawl-ref\\\\source'
    matches=[flag[2:] for flag in baseline['cxx_flags'] if flag.startswith('-I') and flag.endswith(ending)]
    if len(matches)!=1:raise ValueError('Expected one baseline native source include')
    old_root=matches[0][:-len(ending)].rstrip('\\\\/')
    return [flag.replace(old_root,str(root)) for flag in flags]

def validate_native_baseline(root, sdk):''')
edit("flags = manifest['cxx_flags']", "flags = relocated_flags(root,manifest,manifest['cxx_flags'])")
edit("require_hash(manifest_path, CANDIDATE_MANIFEST_SHA)\n    manifest_hash = CANDIDATE_MANIFEST_SHA\n    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))", '''manifest_hash = digest(manifest_path)
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    reproduced=manifest.get('reproduction_schema_version')==1
    if reproduced:
        if candidate==under(root,CANDIDATE):raise ValueError('Preserve the exact original executed candidate')
        require_hash(Path(__file__).resolve().parent/'reproduce-startup.py',REPRO_BUILDER_SHA)
    else:
        if candidate!=under(root,CANDIDATE):raise ValueError('Only the exact original candidate or reviewed reproduction is accepted')
        require_hash(manifest_path,CANDIDATE_MANIFEST_SHA)''')
edit("'same_compile_flags': baseline['cxx_flags'],\n        'cxx_flags': baseline['cxx_flags'],", "'same_compile_flags': relocated_flags(root,baseline,baseline['cxx_flags']) if reproduced else baseline['cxx_flags'],\n        'cxx_flags': relocated_flags(root,baseline,baseline['cxx_flags']) if reproduced else baseline['cxx_flags'],")
edit("'startup_text': STARTUP_TEXT, 'build_helper_sha256': BUILDER_SHA,", "'startup_text': STARTUP_TEXT, 'build_helper_sha256': REPRO_BUILDER_SHA if reproduced else BUILDER_SHA,")
edit("if 'objects' in manifest or any(not same_json(manifest.get(key), value) for key, value in expected.items()):", '''if reproduced:
        expected.update({'reproduction_schema_version':1,'baseline_cxx_flags':baseline['cxx_flags'],
            'output_candidate':candidate.relative_to(root).as_posix(),'audit_executed_builder_sha256':BUILDER_SHA})
    if 'objects' in manifest or any(not same_json(manifest.get(key), value) for key, value in expected.items()):''')
edit("patch = Path(__file__).resolve().parent.parent / 'dcss-startup-work'", "patch = Path(__file__).resolve().parent / 'inputs'")
edit("require_hash(Path(__file__).resolve().parent / 'build-startup.py', BUILDER_SHA)", "require_hash(Path(__file__).resolve().parent / 'audit/executed-build-startup.py', BUILDER_SHA)\n    require_hash(Path(__file__).resolve().parent / 'audit/executed-font-free-startup-package.py', '52e44e62ea2ed5b8d13de2b862401b2899b3c13fa08df2074257d38b167ec921')")
edit("flags = list(baseline['link_flags'])", "flags = relocated_flags(root,baseline,baseline['link_flags']) if reproduced else list(baseline['link_flags'])")
edit("'-c', str(replacement_source), '-o', str(replacement_object), *baseline['cxx_flags']]", "'-c', str(replacement_source), '-o', str(replacement_object), *expected['cxx_flags']]")
edit("'outputs': CANDIDATE_OUTPUTS}", "'outputs': manifest.get('outputs') if reproduced else CANDIDATE_OUTPUTS}")
edit("'candidate_manifest_sha256': manifest_hash, 'corresponding_source_candidate': CANDIDATE}", "'candidate_manifest_sha256': manifest_hash, 'corresponding_source_candidate': candidate.relative_to(root).as_posix()}")
edit("parser.add_argument('--root', required=True, type=Path, help='Installed dcss directory')", "parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parent.parents[2],help='Installed DCSS folder')\n    parser.add_argument('--candidate',type=Path,default=Path('engine/candidates/startup-weapon-reproduced'),help='Exact original or reviewed reproduced candidate beneath engine/candidates')")
edit("candidate = under(root, CANDIDATE)", "candidate = (args.candidate if args.candidate.is_absolute() else root/args.candidate).resolve()\n    candidates=under(root,'engine/candidates')\n    if not candidate.is_relative_to(candidates) or candidate==candidates:raise ValueError('Candidate must be a distinct child of engine/candidates')")
edit("'corresponding_source_candidate': CANDIDATE, 'incremental_input_receipt': input_receipt,", "'corresponding_source_candidate': candidate.relative_to(root).as_posix(), 'incremental_input_receipt': input_receipt,")
edit("'corresponding_source_candidate': CANDIDATE,\n        'runtime_tests': report['runtime_tests']", "'corresponding_source_candidate': candidate.relative_to(root).as_posix(),\n        'runtime_tests': report['runtime_tests']")
edit("The fixed candidate is engine/candidates/startup-weapon. Its exact incremental", "The original candidate remains pinned; a reproduced candidate is accepted only\nwith the reviewed repository-local reproduction helper and exact incremental")
output=HERE/'reproduce-font-free-package.py'
output.write_text(text,encoding='utf-8')
print(output)
print(hashlib.sha256(output.read_bytes()).hexdigest())
