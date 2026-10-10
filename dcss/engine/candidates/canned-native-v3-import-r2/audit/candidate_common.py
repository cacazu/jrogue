"""Source guards for an inactive native V3 proposal. No compiler/game execution.

The executed V2 validator remains byte-for-byte in base/. This module composes
its full immutable-baseline and candidate validation, then adds message143.
GPL-3.0-or-later.
"""
from __future__ import annotations
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import immutable_baseline as base

HERE = Path(__file__).resolve().parent
V2_MANIFEST_SHA = 'e7b173f62083fe07bfa1dcd56d2b4ffb47d1a0646b28e38e44f8f0e439816c22'
V2_CONTRACT_SHA = '3c85c5e3fa78ca223823e822e4a6d8de0b57e47828d2ec306bb94d4cb25a788c'
FROZEN_INVENTORY_SHA = 'c902fb46769f95feb9c563a9095634103dd2eda7d4fae19443c7b85f85b10b6f'
FROZEN_MESSAGE_SHA = '1688b6e7360c9ba0dc2a63055c14c998e95633372181a7a66b00270ff070b54b'
MESSAGE_BASE_SHA = '9c41e9df70218c0c78eb1a038c74d36284632e345a74cc616e555961d5e9b443'
OLD_BOUNDARY_SHA = '4085de458f89f9a1e3471d6f0bb55519bb8464818afb7660fcc67d6a6d01c8e1'
ROOT_ACTUAL_RUST_SEAL_SHA = '7ac603c27d249c26e60de732d1916fe09afd8a83de342bf188b2b276354afd78'
ALLOWED_OVERRIDES = {143: ('message.cc', MESSAGE_BASE_SHA)}
V2_HELPERS = {
    'build-candidate.py':'eac4ce9b861931a685c36b2aa411250a4ab319665e153a7816d798ed3ea3d938',
    'candidate_common.py':'773a579b57647e3b920b9c0ce9c6f5961a8f5803761983a7dee373187f568dd2',
    'immutable_baseline.py':'2132f05eb99ab7d1b9431554636470d8349365b40298ffd440389f1f93ca851c',
    'package-font-free.py':'7804da27f7b47714e0e1c30c8390350fd2bc1d5e787960ed2bda0f066c621114',
}

for _name, _sha in V2_HELPERS.items():
    base.require_hash(HERE/'base'/_name, _sha)
_loader = importlib.util.spec_from_file_location('dcss_executed_v2_common', HERE/'base/candidate_common.py')
v2 = importlib.util.module_from_spec(_loader)
_loader.loader.exec_module(v2)
require_sha, load_json, require_keys = v2.require_sha, v2.load_json, v2.require_keys
regular, checked_file, inverse = v2.regular, v2.checked_file, v2.inverse


def helper_receipts():
    names = ['build-candidate.py','candidate_common.py','immutable_baseline.py','finalize-contract.py','native_import_source.py']
    names += ['base/'+name for name in V2_HELPERS]
    names += ['base/audit/'+name for name in v2.AUDITS]
    return {name:base.digest(HERE/name) for name in names}


def recipe_digest():
    return hashlib.sha256(json.dumps(helper_receipts(),sort_keys=True,separators=(',',':')).encode()).hexdigest()


def exact_outputs(directory, outputs):
    if (not isinstance(outputs,list) or len(outputs)!=3
        or [x.get('name') for x in outputs]!=list(base.BUNDLE_NAMES)
        or any(set(x)!=set(('name','bytes','sha256')) for x in outputs)):
        raise ValueError('Exactly three ordered unique JS/WASM/DATA receipts are required')
    base.verify_outputs(directory,outputs)


def bridge_pin(path):
    text=path.read_text(encoding='utf-8');marker='export const STARTUP_TEXT_PIN = '
    if text.count(marker)!=1:raise ValueError('Exactly one formatter source pin is required')
    return json.JSONDecoder().raw_decode(text[text.index(marker)+len(marker):])[0]


def validate_formatter_repin(frozen, current, boundary):
    """Prove the complete UTF-8 bridge changes only its boundary JSON object."""
    before=frozen.read_bytes().decode('utf-8');after=current.read_bytes().decode('utf-8')
    marker='export const STARTUP_TEXT_PIN = '
    if before.count(marker)!=1:raise ValueError('Exactly one frozen formatter pin required')
    start=before.index(marker)+len(marker)
    pin,stop=json.JSONDecoder().raw_decode(before[start:])
    matches=list(re.finditer(r'"boundary"\s*:\s*(\{[^{}]*\})',before[start:start+stop]))
    if len(matches)!=1:raise ValueError('Exactly one explicit boundary object required')
    match=matches[0];old=match.group(1)
    if json.loads(old)!=pin['boundary']:raise ValueError('Frozen boundary span disagrees with source pin')
    if pin['boundary']['sha256']!=OLD_BOUNDARY_SHA:raise ValueError('Frozen V2-reference boundary changed')
    new,count=re.subn(r'("bytes"\s*:\s*)'+str(pin['boundary']['bytes'])+r'(?=\s*[,}])',lambda m:m.group(1)+str(boundary['bytes']),old)
    if count!=1:raise ValueError('Exact one boundary byte-count replacement required')
    new,count=re.subn(r'("sha256"\s*:\s*")'+pin['boundary']['sha256']+r'(")',lambda m:m.group(1)+boundary['sha256']+m.group(2),new)
    if count!=1 or json.loads(new)!={'path':'/build/boundary.wasm','bytes':boundary['bytes'],'sha256':boundary['sha256']}:
        raise ValueError('Exact one reviewed boundary SHA replacement required')
    begin=start+match.start(1);end=start+match.end(1)
    expected=before[:begin]+new+before[end:]
    if after!=expected:raise ValueError('Formatter body drift outside exact new-boundary repin')
    if after.count(new)!=1 or after.replace(new,old,1)!=before:
        raise ValueError('Whole formatter byte inverse failed')
    return [{'before':old,'after':new}]


def validate_parent(root, sdk, parent):
    if parent['manifest']['sha256']!=V2_MANIFEST_SHA or parent['contract_sha256']!=V2_CONTRACT_SHA:
        raise ValueError('The actual executed V2 parent is fixed')
    if parent['helpers']!=V2_HELPERS or parent['replacement_indices']!=[170,181]:
        raise ValueError('Executed V2 helper and native override lineage changed')
    candidate=root/'engine/candidates/startup-text-v2'
    checked_file(root,parent['manifest'])
    # This validates all 333 original sources, objects, cache fingerprints,
    # original/native data files, headers/compiler fingerprint and V2 inverses.
    manifest, lineage=v2.validate_candidate(root,Path(parent['patch_root']).resolve(),root,sdk,
        HERE/'base/source-contract.final.json',V2_CONTRACT_SHA,candidate,V2_HELPERS['build-candidate.py'])
    exact_outputs(candidate,manifest['outputs'])
    if (manifest['units']!=333 or manifest['replacement_indices']!=[170,181]
        or manifest['objects_reused']!=331 or manifest['objects_recompiled']!=2
        or manifest['compiler_fingerprint']!=base.FP):
        raise ValueError('Actual V2 native parent shape changed')
    if [x['index'] for x in parent['retained_objects']]!=[170,181]:
        raise ValueError('Retain exactly the two actual V2 replacement objects')
    for saved in parent['retained_objects']:
        row=manifest['link_objects'][saved['index']]
        if saved['path']!=row['object'] or saved['sha256']!=row['object_sha256']:
            raise ValueError('V2 inherited object path/hash mismatch')
        checked_file(root,{k:saved[k] for k in ('path','bytes','sha256')})
    if len(manifest['link_objects'])!=333 or [x['index'] for x in manifest['link_objects']]!=list(range(333)):
        raise ValueError('V2 parent must retain exact 333-unit order')
    return manifest,lineage


def ordered_parent_objects(root, contract):
    manifest=load_json(regular(root,contract['v2_parent']['manifest']['path']))
    base.require_hash(root/contract['v2_parent']['manifest']['path'],V2_MANIFEST_SHA)
    return [regular(root,x['object']) for x in manifest['link_objects']]


def validate_union(startup, original, frozen_pin, canned_ids):
    ids=original['ids']+canned_ids
    if (len(original['ids'])!=45 or len(canned_ids)!=45 or len(set(ids))!=90
        or startup['schema_version']!=3 or startup['source']!='startup-canned-native-v3'
        or startup['upstream']!=base.PIN or startup['ids']!=ids or frozen_pin['ids']!=ids
        or set(startup['message_schemas'])!=set(ids)):
        raise ValueError('Exact45 V2 +45 canned schema3/source union is required')
    for name in ('dynamic_contract','locale_mode'):
        if startup[name]!=original[name]:raise ValueError('Inherited V2 typed contract changed')
    for id in original['ids']:
        if startup['message_schemas'][id]!=original['message_schemas'][id]:
            raise ValueError('Inherited V2 message schema changed')
    for id in canned_ids:
        if startup['message_schemas'][id]!={'category':'canned','parameters':{}}:
            raise ValueError('Canned45 source ID schema must remain empty-parameter')


def validate_pending_spec(spec):
    if (spec.get('schema_version')!=3 or spec.get('recipe_version')!=3
        or spec.get('source')!='startup-canned-native-v3' or spec.get('upstream')!=base.PIN
        or [x.get('index') for x in spec.get('overrides',[])]!=[143]):
        raise ValueError('Only message143/schema3 native V3 proposal is supported')
    if (spec.get('source_revision')!='native-import-r2'
        or not isinstance(spec.get('native_import_compatibility'),dict)
        or spec.get('frozen_library',{}).get('sha256')!='9b574c923157f56caca0a6dc42cf87090f7a3c925bd3c8ed13f2b4e14f637fde'
        or spec.get('library',{}).get('sha256')!='631d4d71d821030e66f4456fa7a2274da3edfe19ce443d20a61a4e6480323b8a'
        or spec.get('startup_text',{}).get('library_sha256')!=spec['library']['sha256']):
        raise ValueError('Distinct reviewed Native90 import-r2 library selection is required')
    if spec.get('observer',{}).get('source')!='canned-v1':
        raise ValueError('Existing observer source must remain canned-v1')
    if spec.get('native_history',{}).get('source')!='canned-native-v3':
        raise ValueError('Native history is separately canned-native-v3')
    if spec['pending_requirements']['actual_rust_tests']!=75:
        raise ValueError('New actual75-test Rust gate is required')


def absolute_evidence(record, *, allow_empty_log=False):
    require_keys(record,('path','bytes','sha256'),'absolute actual evidence receipt')
    path=Path(record['path'])
    if not path.is_absolute() or not path.is_file() or path.is_symlink():
        raise ValueError('Actual evidence must be an absolute regular file')
    require_sha(record['sha256'])
    if (type(record['bytes']) is not int or record['bytes']<0 or (record['bytes']==0 and not allow_empty_log)
        or base.receipt(path)!={k:record[k] for k in ('bytes','sha256')}):
        raise ValueError('Actual evidence bytes/hash changed')
    return path


def checked_snapshot_file(root, record):
    """Frozen snapshot logs may be empty; source/artifact receipts may not."""
    require_keys(record,('path','bytes','sha256'),'frozen snapshot file receipt')
    path=regular(root,record['path'])
    require_sha(record['sha256'])
    if (type(record['bytes']) is not int or record['bytes']<0
        or (record['bytes']==0 and path.suffix!='.log')
        or base.receipt(path)!={k:record[k] for k in ('bytes','sha256')}):
        raise ValueError('Frozen snapshot bytes/hash changed or empty non-log input')
    return path


def validate_rust_gate(gate, boundary):
    if not isinstance(gate,dict):raise ValueError('Pending: actual new Rust75 gate is missing')
    require_keys(gate,('scope','status','tests_passed','tests_failed','fmt_exit','clippy_exit','release_exit','boundary','actual_seal','evidence','execution','input_pins','freeze_inventory','outer_stdout','outer_stderr','test_log'),'Rust75 gate')
    if (gate['scope']!='dcss-native-canned-v3-rust' or gate['status']!='accepted-actual'
        or type(gate['tests_passed']) is not int or gate['tests_passed']!=75
        or type(gate['tests_failed']) is not int or gate['tests_failed']!=0
        or any(type(gate[k]) is not int or gate[k]!=0 for k in ('fmt_exit','clippy_exit','release_exit'))
        or gate['boundary']!=boundary):
        raise ValueError('Rust gate must bind actual75/zero-failure fmt/Clippy/release and new artifact')
    if boundary['sha256']==OLD_BOUNDARY_SHA:raise ValueError('Old V2 Rust4085 is explicitly rejected')
    verifier_path=absolute_evidence(gate['evidence'])
    verifier=load_json(verifier_path);execution=load_json(absolute_evidence(gate['execution']))
    if (verifier.get('passed') is not True or verifier.get('cargo_test_count')!=75
        or any(verifier.get(k) is not True for k in ('fmt_check','clippy_all_targets_deny_warnings','offline_locked','source_and_frozen_inputs_unchanged'))
        or any(verifier.get(k) is not False for k in ('installed_writes','native_executed','browser_executed'))
        or execution.get('passed') is not True or type(execution.get('exit_code')) is not int or execution['exit_code']!=0
        or any(execution.get(k) is not True for k in ('fresh_verifier_receipt','source_and_frozen_inputs_unchanged'))
        or any(execution.get(k) is not False for k in ('installed_writes','native_executed','browser_executed'))):
        raise ValueError('Actual Rust verifier/outer execution facts disagree with gate')
    artifact=verifier.get('boundary')
    if not isinstance(artifact,dict) or any(artifact.get(k)!=boundary[k] for k in ('bytes','sha256')):
        raise ValueError('Actual verifier artifact disagrees with new asset receipt')
    absolute_evidence(artifact)
    seal=load_json(absolute_evidence(gate['actual_seal']))
    if (gate['actual_seal']['sha256']!=ROOT_ACTUAL_RUST_SEAL_SHA
        or seal.get('actual_root_tools_session')!=94979 or seal.get('actual_root_tools_exit')!=0
        or seal.get('actual_test_count')!=75 or seal.get('boundary')!=artifact
        or any(seal.get(k)!='pass' for k in ('fmt','clippy','release_wasm'))
        or seal.get('source_and_frozen_inputs_unchanged') is not True
        or seal.get('native_runtime_or_browser_executed') is not False or seal.get('installed') is not False):
        raise ValueError('Actual root Rust75 seal disagrees with raw verifier/artifact')
    stages=verifier.get('stages')
    if not isinstance(stages,list) or [x.get('stage') for x in stages]!=['fmt','test','clippy','release-wasm']:
        raise ValueError('Require actual ordered fmt/test/Clippy/release stages')
    if len({x.get('pid') for x in stages})!=4:raise ValueError('Actual stages require distinct owned process IDs')
    expected_argv={'fmt':['fmt','--all','--check'],'test':['test','--offline','--locked'],
        'clippy':['clippy','--offline','--locked','--all-targets','--','-D','warnings']}
    for stage in stages:
        if (type(stage.get('exit_code')) is not int or stage['exit_code']!=0
            or type(stage.get('pid')) is not int or stage['pid']<=0
            or not isinstance(stage.get('started_utc'),str) or not isinstance(stage.get('finished_utc'),str)):
            raise ValueError('Actual stage completion identity missing')
        if stage['stage'] in expected_argv and (stage.get('arguments')!=expected_argv[stage['stage']]
            or Path(stage.get('executable','')).name.casefold()!='cargo.exe'):
            raise ValueError('Actual Cargo arguments differ from reviewed checks')
        for stream in ('stdout','stderr'):
            base.require_hash(verifier_path.parent/(stage['stage']+'.'+stream+'.log'),require_sha(stage[stream+'_sha256']))
    for stream in ('stdout','stderr'):
        record=gate['outer_'+stream];absolute_evidence(record,allow_empty_log=True)
        if record['sha256']!=execution[stream+'_sha256']:raise ValueError('Outer execution log receipt mismatch')
    source_pins=load_json(absolute_evidence(gate['input_pins']));freeze=load_json(absolute_evidence(gate['freeze_inventory']))
    if seal.get('source_inventory_sha256')!=gate['freeze_inventory']['sha256']:
        raise ValueError('Actual root seal disagrees with frozen H inventory receipt')
    if source_pins.get('planned_test_count')!=75 or freeze.get('planned_rust_tests')!=75:
        raise ValueError('Actual source snapshots must identify the75-test V3 worktree')
    worktree=Path(source_pins['worktree']).resolve()
    if Path(artifact['path']).resolve()!=regular(worktree,'build/boundary.wasm'):
        raise ValueError('Actual release artifact must be the pinned worktree boundary')
    for record in source_pins['files']:checked_file(worktree,record)
    if len(source_pins['files'])!=42 or len({x['path'] for x in source_pins['files']})!=42:
        raise ValueError('Require all42 unique actual Rust/catalog source pins')
    frozen_root=Path(gate['freeze_inventory']['path']).parent.resolve()
    if len(freeze['files'])!=151 or len({x['path'] for x in freeze['files']})!=151:
        raise ValueError('Require all151 unique actual H frozen source pins')
    for record in freeze['files']:checked_snapshot_file(frozen_root,record)
    if freeze.get('source_inventory_sha256')!=source_pins.get('source_inventory_sha256'):
        raise ValueError('Actual source/freeze lineage disagrees')
    base.require_hash(regular(worktree,'build.ps1'),require_sha(source_pins['build_script_sha256']))
    release=stages[3]
    if (Path(release.get('executable','')).name.casefold()!='pwsh.exe'
        or release.get('arguments')!=['-NoProfile','-ExecutionPolicy','Bypass','-File','"'+str(worktree/'build.ps1')+'"']):
        raise ValueError('Actual release must use the pinned worktree build script')
    if (Path(gate['test_log']['path']).resolve()!=(verifier_path.parent/'test.stdout.log').resolve()
        or gate['test_log']['sha256']!=stages[1]['stdout_sha256']):
        raise ValueError('The inspected75/0 test log must be the exact recorded test-stage stdout')
    log=absolute_evidence(gate['test_log']).read_text(encoding='utf-8')
    if not re.search(r'test result: ok\.\s+75 passed;\s+0 failed;',log):
        raise ValueError('Actual Rust log does not report exactly75 passing tests')


def validate_formatter_gate(gate, boundary, ids, bridge):
    if not isinstance(gate,dict):raise ValueError('Pending: actual real-Rust90-ID formatter gate is missing')
    require_keys(gate,('scope','status','boundary','bridge_sha256','ids','evidence'),'formatter90 gate')
    if (gate['scope']!='dcss-native-canned-v3-real-rust-formatter' or gate['status']!='accepted-actual'
        or gate['boundary']!=boundary or gate['bridge_sha256']!=bridge['sha256'] or gate['ids']!=ids):
        raise ValueError('Actual formatter gate must bind the new artifact, bridge and exact90 IDs')
    proof=load_json(absolute_evidence(gate['evidence']))
    if (proof.get('kind')!='actual-real-rust-wasm-formatter90' or proof.get('boundary')!=boundary
        or proof.get('bridge_sha256')!=bridge['sha256'] or proof.get('runtime_errors')!=[]
        or not isinstance(proof.get('runs'),list) or [x.get('locale') for x in proof['runs']]!=['ja','en']):
        raise ValueError('Actual new-WASM formatter proof is required for both locales')
    for run in proof['runs']:
        calls=run.get('calls')
        if (not isinstance(calls,list) or [x.get('id') for x in calls]!=ids
            or any(x.get('ok') is not True or not isinstance(x.get('text'),str) or not x['text'] for x in calls)):
            raise ValueError('Actual formatter proof must cover all90 IDs successfully per locale')


def validate_native_import(patch, contract, *, require_vm=True):
    import native_import_source
    from types import SimpleNamespace
    return native_import_source.validate(patch,contract,SimpleNamespace(**globals()),require_vm=require_vm)


def library_file(patch, contract):
    return validate_native_import(patch,contract,require_vm=True)


def override_file(patch, contract, entry):
    compat=contract.get('cxx11_compatibility')
    if not isinstance(compat,dict):raise ValueError('Pending: reviewed C++11 constructor compatibility source is missing')
    return checked_file(Path(compat['root']).resolve(),entry['transformed'])


def validate_contract(root, patch, assets, sdk, contract_path, contract_sha):
    base.require_hash(contract_path,require_sha(contract_sha));c=load_json(contract_path)
    validate_pending_spec(c)
    if c.get('rust_gate') is None or c.get('formatter_gate') is None:
        raise ValueError('Pending actual Rust75/new artifact and real-Rust formatter90: no build is authorized by this proposal')
    if require_sha(c.get('recipe_sha256'))!=recipe_digest():raise ValueError('Reviewed V3 recipe source bundle drift')
    parent,lineage=validate_parent(root,sdk,c['v2_parent'])
    frozen=checked_file(patch,c['frozen_inventory']);base.require_hash(frozen,FROZEN_INVENTORY_SHA)
    fi=load_json(frozen)
    for record in fi['files']:checked_file(patch,record)
    source=load_json(checked_file(patch,c['source_receipts']))
    formatter_source=load_json(checked_file(patch,c['formatter_source_receipts']))
    integration=load_json(checked_file(patch,c['integration_contract']))
    original=load_json(HERE/'base/source-contract.final.json')['startup_text']
    frozen_pin=load_json(checked_file(patch,c['frozen_formatter_pin']))
    validate_union(c['startup_text'],original,frozen_pin,source['reviewed_ids'])
    if c['native_history']!=integration['native_history'] or c['observer']!={'schema_version':1,'source':'canned-v1','upstream':base.PIN}:
        raise ValueError('Observer/native-history identity or bounded row contract changed')
    override=c['overrides'][0]
    if (override['source']!=base.NATIVE_SOURCE+'/message.cc' or override['original_sha256']!=MESSAGE_BASE_SHA
        or override['ids']!=source['reviewed_ids'] or override['inverse_actions']!=source['transformations']['engine/message.cc']['patches']):
        raise ValueError('Message143 original/inverse/45-ID provenance changed')
    frozen_message=regular(patch,'engine/message.cc');base.require_hash(frozen_message,FROZEN_MESSAGE_SHA)
    inverse(regular(root,override['source']).read_text(encoding='utf-8'),frozen_message.read_text(encoding='utf-8'),override['inverse_actions'])
    transformed=override_file(patch,c,override);compat=c['cxx11_compatibility']
    proof=load_json(checked_file(Path(compat['root']).resolve(),compat['receipt']))
    compatibility_inventory=load_json(checked_file(Path(compat['root']).resolve(),compat['inventory']))
    for record in compatibility_inventory['files']:checked_file(Path(compat['root']).resolve(),record)
    if (proof.get('frozen_source',{}).get('sha256')!=FROZEN_MESSAGE_SHA or proof.get('transformed',{}).get('sha256')!=override['transformed']['sha256'] or proof.get('inverse_actions')!=compat['inverse_actions']):
        raise ValueError('C++11 source correction must retain exact frozen lineage')
    inverse(frozen_message.read_text(encoding='utf-8'),transformed.read_text(encoding='utf-8'),compat['inverse_actions'])
    if 'extern "C" int dcss_host_startup_text(const char*, const char*, char*, int);' not in transformed.read_text(encoding='utf-8'):
        raise ValueError('Preserve reviewed synchronous four-argument formatter ABI')
    frozen_library=checked_file(patch,c['frozen_library'])
    if c['library_inverse_actions']!=formatter_source['transformations']['engine/library.js']['patches']:
        raise ValueError('Library inverse lineage changed')
    inverse(regular(patch,'base/engine/library.js').read_text(encoding='utf-8'),frozen_library.read_text(encoding='utf-8'),c['library_inverse_actions'])
    library=library_file(patch,c)
    if re.search(r'dcss_(host_startup_text|native_history_[a-z_]+)__async\s*:',library.read_text(encoding='utf-8')):
        raise ValueError('No asynchronous native import change is permitted')
    records=c['assets'];paths=[x['path'] for x in records]
    if len(paths)!=len(set(paths)) or paths.count('build/boundary.wasm')!=1:raise ValueError('Unique new boundary/catalog asset receipts required')
    for record in records:checked_file(assets,record)
    boundary=next(x for x in records if x['path']=='build/boundary.wasm')
    validate_rust_gate(c['rust_gate'],boundary)
    bridge=checked_file(assets,c['formatter']);pin=bridge_pin(bridge)
    repin=validate_formatter_repin(checked_file(patch,c['frozen_formatter']),bridge,boundary)
    if c.get('formatter_repin_inverse')!=repin:raise ValueError('Explicit full-byte formatter repin inverse required')
    expected=json.loads(json.dumps(frozen_pin));expected['boundary']={'path':'/build/boundary.wasm','bytes':boundary['bytes'],'sha256':boundary['sha256']}
    if pin!=expected:raise ValueError('Only explicit new-boundary formatter repin is allowed; source90 contract stays frozen')
    asset_map={x['path']:x['sha256'] for x in records if x['path']!='build/boundary.wasm'}
    if asset_map!={x['path'][1:]:x['sha256'] for x in pin['catalogs']}:raise ValueError('Exact pinned union catalogs required')
    startup=c['startup_text']
    if startup['boundary_sha256']!=boundary['sha256'] or startup['boundary_bytes']!=boundary['bytes'] or startup['bridge_sha256']!=c['formatter']['sha256'] or startup['library_sha256']!=c['library']['sha256']:
        raise ValueError('Startup metadata must bind actual new formatter/boundary/library')
    validate_formatter_gate(c['formatter_gate'],boundary,startup['ids'],c['formatter'])
    if (sdk/'upstream/emscripten/emscripten-version.txt').read_text().strip().strip('"')!='6.0.8':raise ValueError('SDK6.0.8 is fixed')
    baseline=load_json(regular(root,base.NATIVE_BASE+'/manifest.json'))
    if baseline['objects'][143]['source']!=override['source'] or baseline['objects'][143]['source_sha256']!=MESSAGE_BASE_SHA:
        raise ValueError('Immutable333 index143 source changed')
    flags=base.relocated_flags(root,baseline,baseline['cxx_flags'])
    if flags[-1]!='-std=c++11':raise ValueError('C++11 cannot be changed to hide compatibility issues')
    receipt={'schema_version':3,'version':'0.34.1','upstream_commit':base.PIN,'runtime':'jspi','exception_model':'wasm','units':333,
        'objects_reused':332,'objects_recompiled':1,'replacement_indices':[143],'inherited_replacement_indices':[170,181],
        'baseline_manifest_sha256':base.NATIVE_MANIFEST_SHA,'baseline_compiler_fingerprint':base.FP,'compiler_fingerprint':base.FP,
        'same_compile_flags':flags,'source_contract_sha256':contract_sha,'recipe_sha256':c['recipe_sha256'],
        'source_receipts_sha256':c['source_receipts']['sha256'],'link_library_sha256':c['library']['sha256'],
        'startup_slice':'startup-canned-native-v3','startup_text':startup,'observer':c['observer'],'native_history':c['native_history'],
        'v2_parent':lineage,'inherited_source_mapping':parent['source_mapping'],'asset_pins':records,'async_import_change':False,
        'public_header_change':False,'data_package_files':1449,'rust_gate':c['rust_gate'],'formatter_gate':c['formatter_gate'],
        'cxx11_compatibility':compat,'native_import_compatibility':c['native_import_compatibility'],
        'source_revision':'native-import-r2'}
    base.require_hash(contract_path,contract_sha)
    return c,baseline,receipt


def link_object_receipts(root, contract, ordered, mappings):
    parent=load_json(regular(root,contract['v2_parent']['manifest']['path']))
    replacement={x['index']:x['replacement_object_sha256'] for x in mappings}
    return [{'index':i,'object':p.relative_to(root).as_posix(),
        'object_sha256':replacement[i] if i in replacement else parent['link_objects'][i]['object_sha256'],
        'replacement':i==143,'origin':'new-message143' if i==143 else 'retained-v2-override' if i in (170,181) else 'immutable-baseline'}
        for i,p in enumerate(ordered)]


def validate_candidate(root, patch, assets, sdk, contract_path, contract_sha, candidate, builder_sha):
    c,baseline,receipt=validate_contract(root,patch,assets,sdk,contract_path,contract_sha)
    manifest=load_json(regular(candidate,'manifest.json'))
    expected=dict(receipt,output_candidate=candidate.relative_to(root).as_posix(),cxx_flags=receipt['same_compile_flags'],
        build_helper_sha256=builder_sha,helper_sources=helper_receipts(),compile_exit=0,link_exit=0,emcc_cores=1,binaryen_cores=1)
    if any(manifest.get(k)!=v for k,v in expected.items()):raise ValueError('Actual candidate differs from reviewed143-only recipe')
    base.require_hash(regular(candidate,'source-contract.json'),contract_sha)
    for name,sha in helper_receipts().items():base.require_hash(regular(candidate,'audit/'+name),sha)
    if sorted(p.name for p in (candidate/'patch-source').iterdir())!=['message.cc']:raise ValueError('Compile only reviewed message.cc')
    entry=c['overrides'][0];base.require_hash(regular(candidate,'patch-source/message.cc'),entry['transformed']['sha256'])
    obj=regular(candidate,'message.o');base.require_hash(obj,manifest['source_mapping'][0]['replacement_object_sha256'])
    mappings=[{'index':143,'baseline_source':entry['source'],'baseline_source_sha256':entry['original_sha256'],
        'replacement_source':'patch-source/message.cc','replacement_source_sha256':entry['transformed']['sha256'],
        'baseline_object':baseline['objects'][143]['object'],'replacement_object':'message.o','replacement_object_sha256':base.digest(obj),
        'replacement_cache_fingerprint':hashlib.sha256((base.FP+entry['transformed']['sha256']).encode()).hexdigest()}]
    ordered=ordered_parent_objects(root,c);ordered[143]=obj
    response=regular(candidate,'link.rsp')
    if response.read_text()!='\n'.join('"'+str(p).replace('\\','/')+'"' for p in ordered):raise ValueError('Exact333 ordered response file required')
    command=[str(sdk/'python/3.13.3_64bit/python.exe'),str(sdk/'upstream/emscripten/emcc.py'),'-c',str(candidate/'patch-source/message.cc'),'-o',str(obj),*receipt['same_compile_flags']]
    flags=base.relocated_flags(root,baseline,baseline['link_flags']);flags[flags.index('--js-library')+1]=str(candidate/'startup-library.js');flags[flags.index('-o')+1]=str(candidate/'dcss.js')
    if (manifest['source_mapping']!=mappings or manifest['link_objects']!=link_object_receipts(root,c,ordered,mappings)
        or manifest['compile_commands']!=[command] or manifest['link_flags']!=flags or manifest['link_response_sha256']!=base.digest(response)):
        raise ValueError('Actual source/object/compiler/link provenance mismatch')
    base.require_hash(regular(candidate,'startup-library.js'),c['library']['sha256'])
    exact_outputs(candidate,manifest['outputs'])
    if base.receipt(candidate/'dcss.data')!={'bytes':base.BASE_DATA_BYTES,'sha256':base.BASE_DATA_SHA}:raise ValueError('Immutable baseline data package changed')
    return manifest,receipt
