"""Added 2026-10-02, NGPL: immutable Phase6 source-check/resource certificate.
This Python-only check never compiles, preprocesses C, or starts Node/browser.
"""
from __future__ import annotations
import hashlib
import io
import json
from pathlib import Path
import re
import unittest
import prepare as p
import build as b
import test_prepare


def main():
    lock=p.verify_inputs();p.verify_foundation()
    manifest=p.load(p.OUTPUT/'source-manifest.json')
    for row in manifest['prepared_sources']:
        if p.sha((p.SOURCE/row['source']).read_bytes())!=row['sha256']:raise ValueError('prepared C/header hash changed: '+row['source'])
    # Only source/check/selected-host inputs changed since the source prepare.
    # Rebind their lock after every prepared C/header has passed its old digest.
    manifest['inputs_lock_sha256']=p.sha((p.HERE/'inputs.lock.json').read_bytes())
    p.write(p.OUTPUT/'source-manifest.json',manifest)
    audit=p.load(p.OUTPUT/'audit.json');audit['phase6']['manifest_sha256']=p.sha((p.OUTPUT/'source-manifest.json').read_bytes());p.write(p.OUTPUT/'audit.json',audit)
    stream=io.StringIO()
    result=unittest.TextTestRunner(stream=stream,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(test_prepare))
    p.write(p.HERE/'source-tests.log',stream.getvalue())
    if not result.wasSuccessful():raise SystemExit(stream.getvalue())
    # Derive actual C/Lua engine paths from the same original Makefile contract.
    text=(p.SOURCE/'sys/unix/Makefile.src').read_text('utf8')
    hobj=re.search(r'^HOBJ\s*=\s*(.*?)(?=\n\n)',text,re.M|re.S).group(1)
    core=list(dict.fromkeys(re.findall(r'\$\(TARGETPFX\)(\w+)\.o',hobj)))+['date','hacklib']
    paths=['src/'+name+'.c' for name in core]
    paths+=['sys/libnh/libnhmain.c','sys/share/ioctl.c','sys/share/unixtty.c','sys/unix/unixunix.c','sys/unix/unixres.c','win/shim/winshim.c','sys/share/posixregex.c']
    paths += [path.relative_to(p.SOURCE).as_posix() for path in sorted((p.SOURCE/'lib/lua-5.4.8/src').glob('*.c')) if path.name not in ('lua.c','luac.c')]
    paths += ['sys/libnh/jrogue-abi.c','src/nh-semantic.c','src/nh-quest-semantic.c','src/nh-semantic-name.c','src/nh-phase4-values.c','src/nh-phase6-helper.c','src/nh-native-api.c']
    if manifest['phase7']['enabled']:paths+=['src/nh-buffer-producer.c']
    if len(paths)!=manifest['planned_compile_units']:raise ValueError('planned/actual source compilation unit count differs')
    catalog=p.load(p.OUTPUT/'catalog.json')
    proof={'schema_version':1,'date':'2026-10-02','status':'source-only-ready-for-parent-gates','compiler_executed':False,'runtime_executed':False,
        'tests':{'run':result.testsRun,'failures':len(result.failures),'errors':len(result.errors)},
        'source_manifest_sha256':p.sha((p.OUTPUT/'source-manifest.json').read_bytes()),'inputs_lock_sha256':p.sha((p.HERE/'inputs.lock.json').read_bytes()),
        'builder_sha256':p.sha((p.HERE/'build.py').read_bytes()),'catalog_sha256':p.sha((p.OUTPUT/'catalog.json').read_bytes()),
        'catalog_bytes':(p.OUTPUT/'catalog.json').stat().st_size,'catalog_counts':manifest['catalog_counts'],
        'catalog_max_id_bytes':max(len(k.encode('utf8')) for k in catalog['en']),
        'catalog_max_union':max(map(len,catalog['argument_schemas'].values())),
        'appearance_audit_sha256':p.sha((p.OUTPUT/'public-appearance-audit.json').read_bytes()),
        'resource_plan':{'engine_units':len(paths),'paths':paths,'outer_jobs':1,'compiler_limits':manifest['compiler_limits'],
            'utility_jobs':'sequential native makedefs/dlb, original target-WASM makedefs7 inputs, original data probe; Node gate separately',
            'cold_sdk_cache_inputs':{'libc':1075,'compiler_builtins':184},'measured_peak_memory':None,
            'gate':'Parent permits one heavy job only after >=2 GiB physical/commit headroom; existing memory measurement remains authoritative.'},
        'unchanged_foundation':{'manifest_sha256':p.sha((p.FOUNDATION_META/'source-manifest.json').read_bytes()),
            'catalog_sha256':p.sha((p.FOUNDATION_META/'catalog.json').read_bytes()),'all_manifest_source_hashes_verified':True},
        'gates_remaining':['root native/clippy/fmt/WASM tests for isolated immutable-catalog Rust','original target-WASM generator and fresh LF archive',
            'exact original native data-consumer gate on regenerated offsets/plaintexts','177-unit serial C/Lua build/link','actual native/browser source-owned emission, input, save/load and render/RNG invariance'],
        'unresolved':manifest['unresolved'],'resource_producer_observers_included':False,'broad_phase7_dynamic_origins_closed':False}
    p.write(p.HERE/'source-checks.json',proof)
    print(json.dumps({'tests':proof['tests'],'source_manifest_sha256':proof['source_manifest_sha256'],'catalog_sha256':proof['catalog_sha256'],'units':len(paths)}))


if __name__=='__main__':main()
