"""Strict reviewed-contract validation for DCSS text-v2 candidates.

This module never builds, packages or executes a game. GPL-3.0-or-later.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import re
import immutable_baseline as base

HERE = Path(__file__).resolve().parent
ALLOWED_OVERRIDES = {
    170: ('newgame.cc', base.NEWGAME_BASE_SHA),
    181: ('output.cc', '2c3c07fa6c7f4e49e9b959da50cc8cff8434b492b807318163a1ce4002fa8d09'),
}
FIXED_IDS = ['startup.weapon.prompt', *[
    'startup.weapon.'+name+'.'+kind
    for name in ('recommended','aptitudes','help','random','back')
    for kind in ('label','description')]]
DYNAMIC_IDS = ['startup.dynamic.species_name','startup.dynamic.job_name',
    'startup.dynamic.character.a','startup.dynamic.character.an', *[
    'startup.dynamic.welcome.'+name for name in ('empty','named_only','named_job',
    'named_species','named_species_job','unnamed_job','unnamed_species','unnamed_species_job')]]
HUD_IDS = ['hud.magic.drained_label','hud.magic.label','hud.health.drained_label','hud.health.label',
    'hud.noise.label','hud.noise.silenced','hud.gold.label','hud.doom.label','hud.contamination.label',
    'hud.experience.label','hud.next_level.label','hud.place.label','hud.armour.label','hud.evasion.label',
    'hud.shield.label','hud.strength.label','hud.intelligence.label','hud.dexterity.label','hud.time.label',
    'hud.turn.label','hud.equipment.compact_label','hud.equipment.label']
AUDITS = {
    'v1-reproduce-startup.py': 'ac80166cb5b0ef9cb66976840c57b9eb556005a2c7f10df5ff281591a6c8afc4',
    'v1-reproduce-font-free-package.py': 'fd1ab92947f9404f4690091d52b0450c4cc60ae81191850b85815cdd35986252',
    'executed-build-startup-v1.py': 'fed917abb533ec1eb62102b6a376fc7724643a6c3ac05ecdbf3a84dca90803f7',
    'executed-font-free-startup-package-v1.py': '52e44e62ea2ed5b8d13de2b862401b2899b3c13fa08df2074257d38b167ec921',
}
SHA = re.compile(r'^[0-9a-f]{64}$')

def require_sha(value):
    if not isinstance(value, str) or not SHA.fullmatch(value):
        raise ValueError('An explicit reviewed lowercase SHA256 is required')
    return value

def load_json(path):
    def pairs(items):
        result = {}
        for name, value in items:
            if name in result:
                raise ValueError('Duplicate JSON key: ' + name)
            result[name] = value
        return result
    return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=pairs,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Non-finite JSON')))

def require_keys(value, keys, context):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError('Unexpected ' + context + ' fields')

def regular(root, path):
    file = base.under(root, path)
    raw = root/path
    if (not file.is_file() or any(parent.is_symlink() for parent in
            (raw, *raw.parents) if parent != root and parent.is_relative_to(root))):
        raise ValueError('Reviewed input must be a regular file: ' + str(file))
    return file

def checked_file(root, record):
    require_keys(record, ('path', 'bytes', 'sha256'), 'file receipt')
    require_sha(record['sha256'])
    if type(record['bytes']) is not int or record['bytes'] <= 0:
        raise ValueError('Reviewed input byte count must be positive')
    file = regular(root, record['path'])
    if base.receipt(file) != {'bytes': record['bytes'], 'sha256': record['sha256']}:
        raise ValueError('Reviewed input receipt drift: ' + str(file))
    return file

def inverse(original, patched, actions):
    if not isinstance(actions, list) or not 1 <= len(actions) <= 96:
        raise ValueError('A bounded explicit source inverse is required')
    # The previous reviewed newgame migration normalizes CRLF to LF; the HUD
    # migration preserves CRLF. Pin raw file hashes separately, and compare the
    # complete canonical source after only this explicit line-ending mapping.
    original = original.replace('\r\n', '\n')
    restored = patched.replace('\r\n', '\n')
    for action in reversed(actions):
        require_keys(action, ('before', 'after'), 'inverse action')
        before, after = action['before'], action['after']
        if (not isinstance(before, str) or not isinstance(after, str) or not after
            or before == after):
            raise ValueError('Each inverse action must match exactly one reviewed changed region')
        before, after = before.replace('\r\n', '\n'), after.replace('\r\n', '\n')
        if not after or before == after or restored.count(after) != 1:
            raise ValueError('Each canonical inverse must match exactly one reviewed changed region')
        restored = restored.replace(after, before, 1)
    if restored != original:
        raise ValueError('Full source inverse does not restore the immutable original')
    includes = lambda text: re.findall(r'(?m)^\s*#\s*include\s*[<"]([^>"]+)[>"]', text)
    if includes(original) != includes(patched):
        raise ValueError('Source include dependencies changed; baseline reuse is invalid')

def helper_receipts():
    return {name: base.digest(HERE / name) for name in
            ('build-candidate.py', 'candidate_common.py', 'immutable_baseline.py', 'package-font-free.py')}

def recipe_digest():
    return hashlib.sha256(json.dumps(helper_receipts(),sort_keys=True,separators=(',',':')).encode()).hexdigest()

def validate_catalog_entry(id, language, entry, message, schema):
    """Accept only the exact source-reviewed shape for this finite native slice."""
    expected_shape='typed' if id in DYNAMIC_IDS and id!='startup.dynamic.welcome.empty' else 'string'
    if message.get('catalog_shape')!=expected_shape:
        raise ValueError('Per-message catalog shape differs from the reviewed native source: '+id)
    expected_text=message.get(language)
    expected_params=message.get('source_params')
    if not isinstance(expected_text,str) or not expected_text or not isinstance(expected_params,dict):
        raise ValueError('Missing reviewed text/parameter source receipt: '+id)
    if expected_shape=='typed':
        require_keys(entry,('text','params'),'typed catalog entry')
        text=entry['text']
        if not base.same_json(entry['params'],expected_params):
            raise ValueError('Typed catalog parameter schema differs from source receipt: '+id)
    else:
        if not isinstance(entry,str) or expected_params or schema['parameters']:
            raise ValueError('Primitive catalog entry must retain its empty parameter source boundary: '+id)
        text=entry
    if (text!=expected_text or not isinstance(text,str)
        or set(re.findall(r'\{([a-z][a-z0-9_]*)\}',text))!=set(schema['parameters'])):
        raise ValueError('Selected catalog text/placeholder coverage differs: '+id+'/'+language)
    parameters={}
    for name,parameter in schema['parameters'].items():
        if parameter['type']=='entity_label':
            parameters[name]={'kind':'entity_label','version':1,'domain':parameter['role'],'form':'name'}
        elif parameter['type']=='actor_label':
            parameters[name]={'kind':'actor_label','version':1,'visibility':'external','form':'name'}
        else:
            raise ValueError('This native dynamic slice accepts sealed entity/actor descriptors only')
    if not base.same_json(expected_params,parameters):
        raise ValueError('Source catalog schema differs from the reviewed typed descriptor roles: '+id)

def validate_contract(root, patch, assets, sdk, contract_path, contract_sha):
    require_sha(contract_sha)
    base.require_hash(contract_path, contract_sha)
    contract = load_json(contract_path)
    require_keys(contract, ('schema_version', 'source', 'upstream', 'recipe_version', 'recipe_sha256',
        'overrides', 'library', 'library_inverse_actions', 'formatter', 'source_receipts', 'assets', 'startup_text'), 'v2 contract')
    if (contract['schema_version'] != 2 or contract['recipe_version'] != 2
        or contract['source'] != 'startup-text-v2' or contract['upstream'] != base.PIN):
        raise ValueError('Only the reviewed pinned text-v2 contract is supported')
    if require_sha(contract['recipe_sha256']) != recipe_digest():
        raise ValueError('Reviewed v2 recipe source bundle changed; a new independent review is required')
    for name, digest in AUDITS.items():
        base.require_hash(HERE / 'audit' / name, digest)
    baseline = base.validate_native_baseline(root, sdk)
    if not isinstance(contract['overrides'], list) or not 1 <= len(contract['overrides']) <= 2:
        raise ValueError('Only one or two explicitly reviewed source overrides are supported')
    indices = []
    sources = []
    for override in contract['overrides']:
        require_keys(override, ('index', 'source', 'original_sha256', 'transformed',
                               'inverse_actions', 'ids', 'source_boundaries'), 'source override')
        index = override['index']
        if type(index) is not int or index not in ALLOWED_OVERRIDES or index in indices:
            raise ValueError('Only unique approved native source indices 170/181 may be replaced')
        filename, old_hash = ALLOWED_OVERRIDES[index]
        expected_source = base.NATIVE_SOURCE + '/' + filename
        item = baseline['objects'][index]
        if (override['source'] != expected_source or item['source'] != expected_source
            or override['original_sha256'] != old_hash or item['source_sha256'] != old_hash):
            raise ValueError('Override does not identify the pinned immutable source unit')
        transformed = checked_file(patch, override['transformed'])
        if transformed.name != filename:
            raise ValueError('Replacement source basename must preserve its baseline unit')
        inverse(regular(root, expected_source).read_text(encoding='utf-8'),
                transformed.read_text(encoding='utf-8'), override['inverse_actions'])
        if (not isinstance(override['ids'],list) or set(override['ids']) != set(FIXED_IDS+DYNAMIC_IDS if index==170 else HUD_IDS)
            or len(override['ids']) != len(set(override['ids']))
            or not isinstance(override['source_boundaries'], list) or not override['source_boundaries']):
            raise ValueError('Reviewed source-origin boundaries must be retained')
        covered=set()
        for boundary in override['source_boundaries']:
            if (not isinstance(boundary,dict) or boundary.get('source') != expected_source
                or boundary.get('original_sha256') != old_hash
                or boundary.get('transformed_sha256') != override['transformed']['sha256']
                or not isinstance(boundary.get('ids'),list) or not boundary['ids']
                or not set(boundary['ids']) <= set(override['ids'])):
                raise ValueError('Source boundary metadata does not identify its exact reviewed CPP input')
            covered.update(boundary['ids'])
        if covered != set(override['ids']):
            raise ValueError('Every emitted semantic ID must have an explicit source boundary')
        indices.append(index); sources.append(transformed)
    if indices != sorted(indices) or 170 not in indices:
        raise ValueError('Ordered text-v2 overrides must include newgame.cc index170')
    library = checked_file(patch, contract['library'])
    formatter = checked_file(patch, contract['formatter'])
    checked_file(patch, contract['source_receipts'])
    text = library.read_text(encoding='utf-8')
    inverse(regular(root,'engine/library.js').read_text(encoding='utf-8'), text,
            contract['library_inverse_actions'])
    if re.search(r'dcss_host_startup_text__async\s*:', text):
        raise ValueError('Text formatter import must remain synchronous')
    signature = 'extern "C" int dcss_host_startup_text(const char*, const char*, char*, int);'
    for source in sources:
        if signature not in source.read_text(encoding='utf-8'):
            raise ValueError('Reviewed four-argument synchronous ABI missing from replacement')
    if not isinstance(contract['assets'], list) or len(contract['assets']) < 4:
        raise ValueError('Explicit Rust boundary and catalog asset pins are required')
    paths = set()
    for entry in contract['assets']:
        file = checked_file(assets, entry)
        if entry['path'] in paths:
            raise ValueError('Duplicate reviewed asset path')
        paths.add(entry['path'])
    if 'build/boundary.wasm' not in paths:
        raise ValueError('The exact separate Rust boundary must be pinned')
    required_catalogs={'locales/startup/'+name for name in ('en.json','ja.json','source-map.json')}
    required_catalogs.update('locales/dynamic/'+name for name in ('en.json','ja.json','source-map.json'))
    required_catalogs.update('locales/entities/'+name for name in
        ('source-map.json','species.en.json','species.ja.json','jobs.en.json','jobs.ja.json'))
    if 181 in indices:
        required_catalogs.update('locales/hud/'+name for name in ('en.json','ja.json','source-map.json'))
    if not required_catalogs <= paths:
        raise ValueError('Both languages and source maps must be pinned for each selected source category')
    startup = contract['startup_text']
    require_keys(startup, ('schema_version', 'source', 'upstream', 'ids', 'message_schemas',
        'dynamic_contract', 'source_boundaries', 'bridge_sha256', 'library_sha256',
        'boundary_sha256', 'boundary_bytes', 'locale_mode'), 'startup_text metadata')
    ids = startup['ids']
    if (startup['schema_version'] != 2 or startup['source'] != 'startup-text-v2'
        or startup['upstream'] != base.PIN or startup['locale_mode'] != 'session'
        or not isinstance(ids, list) or len(set(ids)) != len(ids)
        or set(ids) != set(FIXED_IDS+DYNAMIC_IDS+(HUD_IDS if 181 in indices else []))
        or any(not isinstance(id, str) or not re.fullmatch(r'(startup|hud)\.[a-z0-9_.]+', id) for id in ids)):
        raise ValueError('Unexpected source/version/IDs in startup_text metadata')
    if startup['bridge_sha256'] != contract['formatter']['sha256'] or startup['library_sha256'] != contract['library']['sha256']:
        raise ValueError('Formatter/library metadata does not match explicit reviewed inputs')
    boundary = next(entry for entry in contract['assets'] if entry['path'] == 'build/boundary.wasm')
    if startup['boundary_sha256'] != boundary['sha256'] or startup['boundary_bytes'] != boundary['bytes']:
        raise ValueError('Rust boundary metadata does not match reviewed artifact')
    bridge_text=formatter.read_text(encoding='utf-8')
    marker='export const STARTUP_TEXT_PIN = '
    if bridge_text.count(marker)!=1:
        raise ValueError('Expected one reviewed version2 formatter pin declaration')
    bridge_pin,_=json.JSONDecoder().raw_decode(bridge_text[bridge_text.index(marker)+len(marker):])
    if (bridge_pin.get('schema_version')!=2 or bridge_pin.get('source')!='startup-text-v2'
        or bridge_pin.get('upstream')!=base.PIN or bridge_pin.get('ids')!=ids
        or bridge_pin.get('boundary')!={'path':'/build/boundary.wasm','bytes':boundary['bytes'],'sha256':boundary['sha256']}):
        raise ValueError('Formatter source pin disagrees with version/source/IDs or the new Rust artifact')
    for id,schema in startup['message_schemas'].items():
        message=bridge_pin.get('messages',{}).get(id,{})
        if message.get('category')!=schema.get('category') or message.get('parameters')!=schema.get('parameters'):
            raise ValueError('Formatter typed message metadata disagrees with native source contract')
    asset_map={entry['path']:entry['sha256'] for entry in contract['assets'] if entry['path']!='build/boundary.wasm'}
    bridge_assets=bridge_pin.get('catalogs')
    if (not isinstance(bridge_assets,list) or len(bridge_assets)!=len(asset_map)
        or any(entry.get('path','')[1:] not in asset_map or not entry.get('path','').startswith('/')
               or entry.get('sha256')!=asset_map[entry['path'][1:]] for entry in bridge_assets)
        or len({entry['path'] for entry in bridge_assets})!=len(bridge_assets)):
        raise ValueError('Formatter catalog pins disagree with exact reviewed asset receipts')
    if not isinstance(startup['message_schemas'], dict) or set(startup['message_schemas']) != set(ids):
        raise ValueError('Every source ID requires exactly one typed message schema')
    catalogs={namespace:{language:load_json(regular(assets,'locales/'+namespace+'/'+language+'.json'))
                         for language in ('en','ja')}
              for namespace in (('startup','dynamic','hud') if 181 in indices else ('startup','dynamic'))}
    for id, schema in startup['message_schemas'].items():
        require_keys(schema, ('category', 'parameters'), 'message schema')
        if schema['category'] not in ('fixed', 'dynamic', 'hud') or not isinstance(schema['parameters'], dict):
            raise ValueError('Unexpected message category or parameter schema')
        for name, parameter in schema['parameters'].items():
            if not re.fullmatch(r'[a-z][a-z0-9_]*', name):
                raise ValueError('Invalid semantic parameter name')
            require_keys(parameter, ('type', 'role'), 'typed parameter')
            if parameter['type'] not in ('string', 'integer', 'boolean', 'entity_label', 'actor_label') or not isinstance(parameter['role'], str) or not parameter['role']:
                raise ValueError('Parameter type and semantic role must be explicit')
            if (parameter['type'] == 'entity_label' and parameter['role'] not in ('species', 'job')
                or parameter['type'] == 'actor_label' and parameter['role'] != 'external_username'):
                raise ValueError('Nested label descriptor type/domain must match the reviewed contract')
        if schema['category'] in ('fixed', 'hud') and schema['parameters']:
            raise ValueError('Reviewed fixed/HUD slice accepts empty parameters only')
        namespace='hud' if id in HUD_IDS else 'dynamic' if id in DYNAMIC_IDS else 'startup'
        if schema['category'] != ('fixed' if namespace=='startup' else namespace):
            raise ValueError('Message category does not match its reviewed source namespace')
        for language in ('en','ja'):
            validate_catalog_entry(id,language,catalogs[namespace][language].get(id),
                                   bridge_pin['messages'][id],schema)
    emitted_ids = [id for entry in contract['overrides'] for id in entry['ids']]
    boundaries = [item for entry in contract['overrides'] for item in entry['source_boundaries']]
    if set(emitted_ids) != set(ids) or len(emitted_ids) != len(set(emitted_ids)) or not base.same_json(boundaries, startup['source_boundaries']):
        raise ValueError('Native source boundaries/IDs differ from the formatter contract')
    if not isinstance(startup['dynamic_contract'], dict):
        raise ValueError('Explicit dynamic validation contract is required, including an empty reviewed scope')
    nested = any(parameter['type'] in ('entity_label','actor_label')
                 for schema in startup['message_schemas'].values() for parameter in schema['parameters'].values())
    if nested:
        dynamic = startup['dynamic_contract']
        if (dynamic.get('schema_version') != 1 or dynamic.get('upstream') != base.PIN
            or not isinstance(dynamic.get('descriptor_schemas'), dict)
            or set(dynamic['descriptor_schemas']) != {'entity_label','actor_label'}):
            raise ValueError('Nested startup labels require the sealed version1 descriptor schemas')
        entity, actor = dynamic['descriptor_schemas']['entity_label'], dynamic['descriptor_schemas']['actor_label']
        if (entity.get('kind') != 'entity_label' or actor.get('kind') != 'actor_label'
            or entity.get('version') != 1 or actor.get('version') != 1
            or entity.get('upstream') != base.PIN or actor.get('upstream') != base.PIN
            or entity.get('form') != 'name' or actor.get('form') != 'name'
            or entity.get('domains') != ['species','job']
            or entity.get('exact_keys') != ['kind','version','upstream','domain','id','form']
            or actor.get('exact_keys') != ['kind','version','upstream','form','identity']
            or actor.get('identity') != {'exact_keys':['visibility','name'],'visibility':'external','name':'verbatim'}):
            raise ValueError('Nested descriptor schema differs from reviewed entity/actor identity boundaries')
    receipt = {'schema_version': 2, 'version': '0.34.1', 'upstream_commit': base.PIN,
        'runtime': 'jspi', 'exception_model': 'wasm', 'units': 333,
        'objects_reused': 333-len(indices), 'objects_recompiled': len(indices),
        'replacement_indices': indices, 'baseline_manifest_sha256': base.NATIVE_MANIFEST_SHA,
        'baseline_wasm_sha256': base.WASM_BASE_SHA, 'baseline_compiler_fingerprint': base.FP,
        'compiler_fingerprint': base.FP, 'baseline_objects': baseline['objects'],
        'baseline_cxx_flags': baseline['cxx_flags'],
        'same_compile_flags': base.relocated_flags(root, baseline, baseline['cxx_flags']),
        'source_contract_sha256': contract_sha, 'source_receipts_sha256': contract['source_receipts']['sha256'],
        'recipe_sha256': contract['recipe_sha256'],
        'source_overrides': contract['overrides'], 'link_library_sha256': contract['library']['sha256'],
        'asset_pins': contract['assets'], 'async_import_change': False, 'public_header_change': False,
        'data_package_files': 1449, 'startup_slice': 'startup-text-v2', 'startup_text': startup}
    base.require_hash(contract_path, contract_sha)
    return contract, baseline, receipt

def validate_candidate(root, patch, assets, sdk, contract_path, contract_sha, candidate, builder_sha):
    require_sha(builder_sha)
    base.require_hash(HERE / 'build-candidate.py', builder_sha)
    contract, baseline, receipt = validate_contract(root, patch, assets, sdk, contract_path, contract_sha)
    manifest_path = regular(candidate, 'manifest.json')
    manifest_hash = base.digest(manifest_path)
    manifest = load_json(manifest_path)
    expected = dict(receipt, output_candidate=candidate.relative_to(root).as_posix(),
        cxx_flags=receipt['same_compile_flags'], build_helper_sha256=builder_sha,
        helper_sources=helper_receipts(), compile_exit=0, link_exit=0,
        emcc_cores=1, binaryen_cores=1)
    if 'objects' in manifest or any(not base.same_json(manifest.get(key), value) for key, value in expected.items()):
        raise ValueError('Candidate is not the exact reviewed text-v2 incremental build')
    base.require_hash(regular(candidate,'source-contract.json'),contract_sha)
    for name,sha in helper_receipts().items():
        base.require_hash(regular(candidate,'audit/'+name),sha)
    names = [ALLOWED_OVERRIDES[entry['index']][0] for entry in contract['overrides']]
    source_dir = candidate / 'patch-source'
    files = list(source_dir.iterdir())
    if sorted(file.name for file in files) != sorted(names) or any(not file.is_file() or file.is_symlink() for file in files):
        raise ValueError('Candidate patch-source may contain only its reviewed CPP replacements')
    mappings, compile_commands = [], []
    ordered = [base.under(root, item['object']) for item in baseline['objects']]
    for override in contract['overrides']:
        index = override['index']; name = ALLOWED_OVERRIDES[index][0]
        source = regular(candidate, 'patch-source/' + name)
        base.require_hash(source, override['transformed']['sha256'])
        obj = regular(candidate, name.removesuffix('.cc')+'.o')
        ordered[index] = obj
        object_hash = base.digest(obj)
        mappings.append({'index': index, 'baseline_source': override['source'],
            'baseline_source_sha256': override['original_sha256'],
            'replacement_source': 'patch-source/'+name,
            'replacement_source_sha256': override['transformed']['sha256'],
            'baseline_object': baseline['objects'][index]['object'], 'replacement_object': obj.name,
            'replacement_object_sha256': object_hash,
            'replacement_cache_fingerprint': hashlib.sha256((base.FP+override['transformed']['sha256']).encode()).hexdigest()})
        compile_commands.append([str(sdk/'python/3.13.3_64bit/python.exe'), str(sdk/'upstream/emscripten/emcc.py'),
            '-c', str(source), '-o', str(obj), *receipt['same_compile_flags']])
    base.require_hash(regular(candidate, 'startup-library.js'), contract['library']['sha256'])
    link_objects = [{'index': index, 'object': file.relative_to(root).as_posix(),
        'object_sha256': base.digest(file) if index in receipt['replacement_indices'] else baseline['objects'][index]['object_sha256'],
        'replacement': index in receipt['replacement_indices']} for index, file in enumerate(ordered)]
    response = regular(candidate, 'link.rsp')
    if response.read_text() != '\n'.join('"'+str(file).replace('\\','/')+'"' for file in ordered):
        raise ValueError('Actual ordered response file differs beyond approved replacements')
    flags = base.relocated_flags(root, baseline, baseline['link_flags'])
    flags[flags.index('--js-library')+1] = str(candidate/'startup-library.js')
    flags[flags.index('-o')+1] = str(candidate/'dcss.js')
    details = {'source_mapping': mappings, 'link_objects': link_objects,
        'compile_commands': compile_commands, 'link_flags': flags,
        'link_response_sha256': base.digest(response)}
    if any(not base.same_json(manifest.get(key), value) for key, value in details.items()):
        raise ValueError('Candidate source/object/compile/link provenance drift')
    base.verify_outputs(candidate, manifest['outputs'])
    if base.receipt(candidate/'dcss.data') != {'bytes': base.BASE_DATA_BYTES, 'sha256': base.BASE_DATA_SHA}:
        raise ValueError('Candidate must retain the immutable 1,449-file payload before packaging')
    base.require_hash(manifest_path, manifest_hash)
    return manifest, {'candidate_manifest_sha256': manifest_hash, 'source_contract_sha256': contract_sha,
        'corresponding_source_candidate': candidate.relative_to(root).as_posix(),
        'immutable_baseline_objects': 333, 'objects_reused': receipt['objects_reused'],
        'objects_recompiled': receipt['objects_recompiled'], 'replacement_indices': receipt['replacement_indices'],
        'startup_text': contract['startup_text'], 'source_mapping': mappings,
        'ordered_link_objects_sha256': hashlib.sha256(json.dumps(link_objects, sort_keys=True).encode()).hexdigest()}
