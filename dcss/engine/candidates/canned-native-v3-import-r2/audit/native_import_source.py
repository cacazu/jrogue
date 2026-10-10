"""Validate the Native90 import source and its actual VM source-test evidence.

This validates a synchronous JavaScript library in a VM. It is not a native,
Rust, WASM, game, browser, or installed-runtime acceptance claim.
GPL-3.0-or-later.
"""
from pathlib import Path
import hashlib
import json
import re

FROZEN = {'path': 'engine/library.js', 'bytes': 24506,
          'sha256': '9b574c923157f56caca0a6dc42cf87090f7a3c925bd3c8ed13f2b4e14f637fde'}
CORRECTED = {'path': 'engine/library.js', 'bytes': 30309,
             'sha256': '631d4d71d821030e66f4456fa7a2274da3edfe19ce443d20a61a4e6480323b8a'}
SOURCE_RECEIPT_SHA = '1edc20a7b1b2c60f906ce25423e48b5efba70c6dfa724877fd9bbdebdedfa536'
CPP_SHA = '6791d0d817cb0facdb2deb45c30f0a2fb904bebf573470a32f346a0ab8c0a2c4'


def reviewed(path):
    text = path.read_bytes().decode('utf-8')
    marker = 'const reviewed = '
    if text.count(marker) != 1:
        raise ValueError('Exactly one actual native import whitelist is required')
    result, _ = json.JSONDecoder().raw_decode(text[text.index(marker) + len(marker):])
    if set(result) != {'upstream', 'messages', 'entities'}:
        raise ValueError('Reviewed import metadata shape changed')
    return result


def validate_sources(patch, contract, common):
    compat = contract.get('native_import_compatibility')
    if not isinstance(compat, dict):
        raise ValueError('Pending: reviewed Native90 import source is missing')
    common.require_keys(compat, ('root', 'receipt', 'inventory', 'vm_gate', 'inverse_actions'), 'Native90 compatibility')
    root = Path(compat['root'])
    if not root.is_absolute() or root.resolve() != root:
        raise ValueError('Native90 source root must be an explicit absolute path')
    if contract.get('frozen_library') != FROZEN or contract.get('library') != CORRECTED:
        raise ValueError('Both exact frozen45 and corrected90 library receipts are required')
    frozen = common.checked_file(patch, contract['frozen_library'])
    current = common.checked_file(root, contract['library'])
    receipt_path = common.checked_file(root, compat['receipt'])
    common.base.require_hash(receipt_path, SOURCE_RECEIPT_SHA)
    source = common.load_json(receipt_path)
    if (source.get('kind') != 'source-only-native90-whitelist-correction'
            or source.get('inverse_actions') != compat['inverse_actions']
            or len(compat['inverse_actions']) != 2
            or any(source.get(key) is not True for key in (
                'whole_library_inverse_exact', 'original45_schemas_templates_entities_unchanged',
                'new45_parameters_empty', 'parameter_buffer_and_error_rule_body_unchanged'))
            or source.get('native_Cpp_compile_link_game_or_browser_executed') is not False):
        raise ValueError('Native90 exact source correction facts changed')
    if common.absolute_evidence(source['corrected_library']) != current:
        raise ValueError('Native90 receipt selects a different actual library')
    saved_frozen = common.absolute_evidence(source['frozen_library'])
    if saved_frozen.read_bytes() != frozen.read_bytes():
        raise ValueError('Native90 frozen preimage differs from reviewed frozen V3')
    common.inverse(frozen.read_bytes().decode('utf-8'), current.read_bytes().decode('utf-8'), compat['inverse_actions'])
    before, after = reviewed(frozen), reviewed(current)
    ids = contract['startup_text']['ids']
    old_ids, canned = list(before['messages']), contract['overrides'][0]['ids']
    if (len(old_ids) != 45 or len(canned) != 45 or len(set(ids)) != 90
            or ids != old_ids + canned or list(after['messages']) != ids
            or source['ids'] != ids or source['cpp_registry_ids'] != canned
            or after['upstream'] != before['upstream'] or after['entities'] != before['entities']):
        raise ValueError('Native90 must be exactly unchanged original45 plus source-bound canned45')
    for message_id in old_ids:
        if after['messages'][message_id] != before['messages'][message_id]:
            raise ValueError('Original45 native templates or typed parameter schemas changed')
    catalogs = {}
    for record in source['catalogs']:
        path = common.absolute_evidence(record)
        language = 'en' if path.name == 'canned.en.json' else 'ja' if path.name == 'canned.ja.json' else None
        if language is None or language in catalogs:
            raise ValueError('Exactly the reviewed EN/JA canned catalogs are required')
        catalogs[language] = common.load_json(path)
    if set(catalogs) != {'en', 'ja'} or any(set(catalogs[lang]) != set(canned) for lang in catalogs):
        raise ValueError('Canned catalogs must retain exactly the source registry IDs')
    for message_id in canned:
        expected = {'en': catalogs['en'][message_id]['text'],
                    'ja': catalogs['ja'][message_id]['text'], 'parameters': {}}
        if (after['messages'][message_id] != expected
                or any(catalogs[lang][message_id]['params'] != {} for lang in catalogs)
                or contract['startup_text']['message_schemas'][message_id] != {'category': 'canned', 'parameters': {}}
                or any(not isinstance(expected[lang], str) or not expected[lang] or '\0' in expected[lang]
                       or len(expected[lang].encode('utf-8')) >= 512 for lang in catalogs)):
            raise ValueError('Native canned45 must use reviewed catalog text and empty parameters')
    cpp = common.absolute_evidence(source['fixed_cpp_source'])
    common.base.require_hash(cpp, CPP_SHA)
    if contract['overrides'][0]['transformed']['sha256'] != CPP_SHA:
        raise ValueError('Keep the exact reviewed C++11 message143 constructor source')
    text = cpp.read_bytes().decode('utf-8')
    begin, end = text.index('_dcss_known_canned_id'), text.index('_dcss_render_segment')
    if re.findall(r'"(game\.canned\.[a-z0-9_.]+)"', text[begin:end]) != canned:
        raise ValueError('Actual CPP canned registry differs from the admitted source IDs')
    render = text[end:text.index('// END jrogue canned-native display v3', end)]
    compact = re.sub(r'\s+', '', render)
    if any(marker not in compact for marker in (
            'chartext[512]={};',
            '_dcss_known_canned_id(segment.id)?dcss_host_startup_text(segment.id.c_str(),"{}",text,sizeof(text)):-1;',
            "length<=0||length>=static_cast<int>(sizeof(text))||text[length]!='\\0'||string(text,length).find('\\0')!=string::npos",
            'fprintf(stderr,"Nativecannedlocalizationfailed.\\n");',
            'end(1,false,nullptr);')):
        raise ValueError('Preserve exact known-ID empty-parameter char512 formatter fatal-result contract')
    if re.search(r'dcss_(host_startup_text|native_history_[a-z_]+)__async\s*:', current.read_bytes().decode('utf-8')):
        raise ValueError('No asynchronous native import change is permitted')
    return root, current, source, after


def validate_vm(root, contract, common, current, metadata):
    compat = contract['native_import_compatibility']
    if not isinstance(compat['inventory'], dict) or not isinstance(compat['vm_gate'], dict):
        raise ValueError('Pending: actual Native90 VM source-test inventory and gate are required')
    inventory = common.load_json(common.checked_file(root, compat['inventory']))
    rows = inventory.get('files')
    if (not isinstance(rows, list) or not rows
            or len({row.get('path') for row in rows}) != len(rows)):
        raise ValueError('Native90 VM/source inventory must contain unique actual files')
    for row in rows:
        common.checked_snapshot_file(root, row)
    bound = {row['path']: row for row in rows}
    for record in (contract['library'], compat['receipt']):
        if bound.get(record['path']) != record:
            raise ValueError('Native90 inventory does not bind the selected source and inverse receipt')
    gate = common.load_json(common.checked_file(root, compat['vm_gate']))
    if gate.get('kind') != 'actual-vm-native-import-source-gate' or gate.get('passed') is not True:
        raise ValueError('An actual successful Native90 VM source-test gate is required')
    proof_path = common.absolute_evidence(gate['proof'])
    execution_path = common.absolute_evidence(gate['execution'])
    proof, execution = common.load_json(proof_path), common.load_json(execution_path)
    for record in (gate['proof'], gate['execution']):
        rel = Path(record['path']).relative_to(root).as_posix()
        if bound.get(rel) != {'path': rel, **{key: record[key] for key in ('bytes', 'sha256')}}:
            raise ValueError('Actual VM stdout/execution is not bound by the source inventory')
    ids = contract['startup_text']['ids']
    if (proof.get('kind') != 'actual-vm-native-import-source-tests' or proof.get('status') != 'passed'
            or proof.get('passed') is not True
            or proof.get('actual_function') != 'LibraryManager.library.dcss_host_startup_text'
            or proof.get('native_ids') != ids or proof.get('original_ids') != ids[:45]
            or proof.get('canned_ids') != ids[45:]
            or common.absolute_evidence(proof['library']) != current
            or proof.get('formatter_dependency_mocked') is not True
            or proof.get('whitelist_or_import_function_mocked') is not False
            or any(proof.get(key) is not True for key in (
                'capacity_exactly_512', 'capacity_511_513_rejected', 'destination_bytes_unchanged_on_rejection'))
            or any(proof.get(key) is not False for key in (
                'native_cpp_compile_link_game_or_browser_executed', 'rust_or_wasm_executed', 'installed_writes'))):
        raise ValueError('Actual VM proof must call the selected native import and preserve its source-only scope')
    baseline = common.absolute_evidence(proof['baseline'])
    common.base.require_hash(baseline, FROZEN['sha256'])
    common.require_keys(proof['fixture'], ('path', 'sha256'), 'actual VM fixture hash receipt')
    fixture_record = dict(proof['fixture'], bytes=Path(proof['fixture']['path']).stat().st_size)
    fixture = common.absolute_evidence(fixture_record)
    fixture_data = common.load_json(fixture)
    if fixture_data.get('ids') != ids or fixture_data.get('reviewed') != metadata:
        raise ValueError('Actual VM fixture must agree with the parsed import whitelist')
    counts, results = proof.get('counts'), proof.get('results')
    if (not isinstance(counts, dict) or not isinstance(results, list)
            or type(counts.get('tests')) is not int or counts['tests'] != len(results)
            or counts.get('passed') != len(results) or counts.get('failed') != 0
            or counts.get('admitted_explicit') != 180 or counts.get('baseline_retention') != 90
            or counts.get('extra_parameter_rejections') != 90
            or len({row.get('label') for row in results}) != len(results)
            or any(row.get('passed') is not True for row in results)):
        raise ValueError('Actual VM test counts or successful case records disagree')
    admissions = proof.get('admissions')
    if (not isinstance(admissions, list) or len(admissions) != 180
            or {(row.get('id'), row.get('locale')) for row in admissions} != {(message_id, lang) for message_id in ids for lang in ('en', 'ja')}):
        raise ValueError('Actual VM admissions must cover exactly all90 IDs in both locales')
    for row in admissions:
        message = metadata['messages'][row['id']]
        params = row.get('params')
        if not isinstance(params, dict) or set(params) != set(message['parameters']):
            raise ValueError('Actual VM admission parameter keys differ from the reviewed schema')
        values = {}
        for key, schema in message['parameters'].items():
            value = params[key]
            if schema['type'] == 'entity_label':
                if (set(value) != {'kind', 'version', 'upstream', 'domain', 'id', 'form'}
                        or value['kind'] != 'entity_label' or value['version'] != 1
                        or value['upstream'] != common.base.PIN or value['domain'] != schema['role'] or value['form'] != 'name'):
                    raise ValueError('Actual VM entity admission shape changed')
                values[key] = metadata['entities'][schema['role']][value['id']][row['locale']]
            elif schema['type'] == 'actor_label':
                if (set(value) != {'kind', 'version', 'upstream', 'form', 'identity'}
                        or value['kind'] != 'actor_label' or value['version'] != 1
                        or value['upstream'] != common.base.PIN or value['form'] != 'name'
                        or set(value['identity']) != {'visibility', 'name'}
                        or value['identity']['visibility'] != 'external'):
                    raise ValueError('Actual VM actor admission shape changed')
                values[key] = value['identity']['name']
            else:
                raise ValueError('Unexpected actual VM admission schema')
        expected = re.sub(r'\{([a-z][a-z0-9_]*)\}', lambda match: values[match[1]], message[row['locale']])
        data = row.get('text', '').encode('utf-8')
        if (row.get('text') != expected or row.get('utf8_bytes') != len(data)
                or row.get('text_sha256') != hashlib.sha256(data).hexdigest() or not 0 < len(data) < 512):
            raise ValueError('Actual VM UTF8 admission disagrees with the reviewed native template')
    if (execution.get('kind') != 'owned-source-vm-execution' or execution.get('passed') is not True
            or type(execution.get('exit_code')) is not int or execution['exit_code'] != 0
            or type(execution.get('pid')) is not int or execution['pid'] <= 0
            or execution.get('stdout') != gate['proof']
            or any(execution.get(key) is not False for key in (
                'native_cpp_compile_link_game_or_browser_executed', 'rust_or_wasm_executed', 'installed_writes'))):
        raise ValueError('Actual VM execution must bind real process exit and raw stdout')
    common.absolute_evidence(execution['stderr'], allow_empty_log=True)
    common.absolute_evidence(execution['node'])
    common.absolute_evidence(execution['test_source'])
    return gate


def validate(patch, contract, common, *, require_vm=True):
    root, current, source, metadata = validate_sources(patch, contract, common)
    if require_vm:
        validate_vm(root, contract, common, current, metadata)
    return current
