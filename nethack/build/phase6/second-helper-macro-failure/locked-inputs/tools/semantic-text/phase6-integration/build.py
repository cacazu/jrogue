"""Added 2026-10-02, NGPL: isolated Phase6 serial builder.

Default invocation prepares Python/C source only. --build is reserved for the
parent's released heavy-job slot. Current/Phase4 source and runtimes are read-only.
"""
from __future__ import annotations
import argparse
import difflib
import hashlib
import json
from pathlib import Path
import sys
import types
import prepare
import provenance

HERE=Path(__file__).resolve().parent
ROOT=prepare.ROOT
NOTICE="/* Added 2026-10-02: isolated Phase6 target data regeneration; NGPL. */\n"


def once(source,old,new):
    if source.count(old)!=1:raise ValueError("stale original builder anchor: "+old[:100])
    return source.replace(old,new,1)


def builder_source():
    original=(ROOT/"tools/build-upstream.py").read_text("utf8")
    source=once(original,'ROOT = Path(__file__).resolve().parents[1]',
                'ROOT = Path('+repr(str(ROOT))+')')
    source=once(source,'WORK = ROOT / "work"\n','WORK = ROOT / "work" / "phase6"\n')
    source=once(source,'BUILD = ROOT / "build"\n','BUILD = ROOT / "build" / "phase6"\n')
    source=once(source,'WORK = ROOT / "work" / "phase4"','WORK = ROOT / "work" / "phase6"')
    source=once(source,'BUILD = ROOT / "build" / "phase4"','BUILD = ROOT / "build" / "phase6"')
    source=once(source,'generator = ROOT / "tools" / ("prepare-combined-semantic.py" if PHASE4_MODE else "instrument-semantic-text.py")',
                'generator = ROOT / "tools/semantic-text/phase6-integration/prepare.py"')
    source=once(source,'semantic_audit = module.prepare(AUDIT, WORK / "semantic-generated", SOURCE)',
                'semantic_audit = module.prepare(AUDIT, WORK / "semantic-generated", SOURCE, phase7=ENABLE_PHASE7)')
    source=once(source,'            paths.append(SOURCE / "src" / "nh-phase4-values.c")',
                '            paths.append(SOURCE / "src" / "nh-phase4-values.c")\n'
                '            paths += [SOURCE / "src" / "nh-phase6-helper.c", SOURCE / "src" / "nh-native-api.c"]\n'
                '            if ENABLE_PHASE7: paths.append(SOURCE / "src" / "nh-buffer-producer.c")')
    source=once(source,'            semantic_sources.add(SOURCE / "src" / "nh-phase4-values.c")',
                '            semantic_sources.update(SOURCE / "src" / name for name in '
                '("nh-phase4-values.c", "nh-phase6-helper.c", "nh-native-api.c"))\n'
                '            if ENABLE_PHASE7: semantic_sources.add(SOURCE / "src" / "nh-buffer-producer.c")')
    source=once(source,'shutil.copytree(ROOT / "web", local_web, dirs_exist_ok=True)',
                'shutil.copytree(WEB_SOURCE, local_web, dirs_exist_ok=True)')
    source=once(source,'    runtime = ["ccall", "cwrap", "callMain", "FS",',
                '    if REGISTERED_CATALOG and rust_lib:\n'
                '        exports += ["_nh_rust_catalog_register", "_nh_rust_catalog_release", "_nh_rust_format_registered"]\n'
                '    runtime = ["ccall", "cwrap", "callMain", "FS",')
    return source


def target_data(builder,sdk,env):
    """Recompute original offsets with target libc; never edit CRLF bytes."""
    emcc=[sdk/"python/3.13.3_64bit/python.exe",sdk/"upstream/emscripten/emcc.py"]
    utility=builder.BUILD/"target-makedefs.cjs"
    sources=[builder.utility_source("util/makedefs.c")]+[
        builder.utility_source("src/"+name+".c") for name in ("monst","objects","date","alloc","hacklib")]+[
        builder.utility_source("util/panic.c")]
    original_inputs=['dat/'+name for name in ('data.base','rumors.tru','rumors.fal','oracles.txt','epitaph.txt','engrave.txt','bogusmon.txt')]
    input_records=[]
    for name in original_inputs:
        actual=(builder.SOURCE/name).read_bytes();official=(builder.AUDIT/name).read_bytes()
        if actual!=official:raise ValueError('stale/nonofficial makedefs input: '+name)
        input_records.append({'path':name,'sha256':hashlib.sha256(actual).hexdigest(),'bytes':len(actual)})
    utility_sources=[{'path':path.relative_to(builder.AUDIT).as_posix(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
                     for path in sources]
    pre_headers=[{'path':path.relative_to(builder.SOURCE).as_posix(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
                 for path in sorted((builder.SOURCE/'include').rglob('*.h'))]
    macro_source=HERE/"target-macros.c"
    utility_command=emcc+builder.target_flags()+sources+[macro_source,"-sMODULARIZE","-sENVIRONMENT=node","-sEXIT_RUNTIME=0",
                '-sEXPORTED_FUNCTIONS=["_main","_nh_build_target_macros"]',
                '-sEXPORTED_RUNTIME_METHODS=["FS","callMain","UTF8ToString"]',"-o",utility]
    builder.run(utility_command,env=env,log=builder.BUILD/"target-makedefs-build.log")
    script=HERE/"target-data.cjs"
    payload_path=builder.BUILD/"target-data-payload.json"
    builder.run([env["EMSDK_NODE"],script,utility,builder.SOURCE,payload_path],cwd=ROOT,env=env,
                log=builder.BUILD/"target-data.log")
    payload=json.loads(payload_path.read_text("utf8"))
    import base64
    required={"dat/"+name for name in ("data","rumors","oracles","epitaph","engrave","bogusmon","options")}|{"include/date.h"}
    if set(payload["files"])!=required:raise ValueError("unexpected target makedefs output set")
    records=[]
    for name in sorted(required):
        data=base64.b64decode(payload["files"][name],validate=True)
        if b"\r" in data:raise ValueError("target makedefs generated CR bytes: "+name)
        (builder.SOURCE/name).write_bytes(data)
        records.append({"path":name,"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data),
                        "crlf_count":data.count(b"\r\n"),"lf_count":data.count(b"\n")})
    options=(builder.SOURCE/"dat/options").read_text("utf8")
    if '"shim"' not in options or "CNG" in options:raise ValueError("target configuration options mismatch")
    report={"source_only":False,"generator":"original target-WASM makedefs","options":"-drhs123v",
            "original_source_sha256":hashlib.sha256((builder.AUDIT/"util/makedefs.c").read_bytes()).hexdigest(),
            "target_flags":builder.target_flags(),"files":records,"original_inputs":input_records,
            "macro_evidence":{"values":payload["macroEvidence"],"observer_source_sha256":hashlib.sha256(macro_source.read_bytes()).hexdigest(),
                "actual_utility_argv":[str(value) for value in utility_command],
                "actual_utility_command_sha256":provenance.command_hash([str(value) for value in utility_command]),
                "observer_source_path":"tools/semantic-text/phase6-integration/target-macros.c"},
            "original_generator_sources":utility_sources,"pre_generation_headers":pre_headers,
            "compiled_utility_artifacts":[{'path':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size}
                                          for path in (utility,utility.with_suffix('.wasm'))],
            "original_sources":{row['path']:row['sha256'] for row in utility_sources},
            "original_data_inputs":{row['path']:row['sha256'] for row in input_records},
            "working_headers_before":{row['path']:row['sha256'] for row in pre_headers},
            "utility":{"js_sha256":hashlib.sha256(utility.read_bytes()).hexdigest(),
                       "wasm_sha256":hashlib.sha256(utility.with_suffix('.wasm').read_bytes()).hexdigest()},
            "consumer_runtime_verified":False,"note":"Fresh LF offsets/counts are not evidence that all data consumers work."}
    (builder.BUILD/"target-data-manifest.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf8",newline="\n")


def make_builder():
    module=types.ModuleType("nethack_isolated_phase6_builder")
    module.__file__=str(ROOT/"tools/build-upstream.py")
    exec(compile(builder_source(),module.__file__,"exec"),module.__dict__)
    original_setup=module.setup
    def scoped_setup(sdk):
        preserved=module.SOURCE
        module.SOURCE=module.WORK/"sdk-setup/NetHack-5.0.0"
        module.SOURCE.parent.mkdir(parents=True,exist_ok=True)
        try:return original_setup(sdk)
        finally:module.SOURCE=preserved
    module.setup=scoped_setup
    module.target_options=lambda sdk,env:target_data(module,sdk,env)
    module.WEB_SOURCE=ROOT/'web'
    module.REGISTERED_CATALOG=False
    module.ENABLE_PHASE7=False
    boundaries=provenance.Boundaries(module)
    module.run=boundaries.run
    original_engine=module.engine
    def observed_engine(sdk,env,data,jobs,rust_lib=None,semantic_text=False):
        boundaries.begin()
        paths,command=original_engine(sdk,env,data,jobs,rust_lib,semantic_text)
        boundaries.final(paths,data)
        return paths,command
    module.engine=observed_engine
    return module


def final_lineage(builder,manifest):
    """Hash the actual compiled sources and all distributed source changes."""
    changes=[];patch=[]
    for path in sorted(builder.SOURCE.rglob('*')):
        if not path.is_file() or 'lib' in path.relative_to(builder.SOURCE).parts:continue
        name=path.relative_to(builder.SOURCE).as_posix();original=builder.AUDIT/name
        data=path.read_bytes()
        if original.exists() and data==original.read_bytes():continue
        changes.append({'path':name,'sha256':hashlib.sha256(data).hexdigest(),
            'status':'modified' if original.exists() else 'generated','date':'2026-10-02',
            'upstream_sha256':hashlib.sha256(original.read_bytes()).hexdigest() if original.exists() else None,
            'package_path':'engine-source/'+name})
        if path.suffix in ('.c','.h'):
            before=original.read_text('utf8').splitlines(True) if original.exists() else []
            after=data.decode('utf8').splitlines(True)
            patch.extend(difflib.unified_diff(before,after,fromfile='upstream/NetHack-5.0.0/'+name,tofile='engine-source/'+name))
    (builder.BUILD/'source-changes.json').write_text(json.dumps(changes,indent=2)+'\n',encoding='utf8',newline='\n')
    (builder.BUILD/'upstream-adapter.patch').write_text(''.join(patch),encoding='utf8',newline='\n')
    manifest['compiled_input_hashes']=[{'path':name.replace('\\','/'),
        'sha256':hashlib.sha256((builder.SOURCE/name).read_bytes()).hexdigest()}
        for name in manifest['compiled_sources']]
    manifest['compiled_header_hashes']=[{'path':path.relative_to(builder.SOURCE).as_posix(),
        'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        for directory in ('include','sys','win','lib/lua-5.4.8/src')
        for path in sorted((builder.SOURCE/directory).rglob('*.h'))]
    manifest['source_lineage']={'source_changes_sha256':hashlib.sha256((builder.BUILD/'source-changes.json').read_bytes()).hexdigest(),
        'upstream_adapter_patch_sha256':hashlib.sha256((builder.BUILD/'upstream-adapter.patch').read_bytes()).hexdigest(),
        'actual_source_root':'work/phase6/NetHack-5.0.0','package_source_root':'engine-source',
        'lua_manifest_sha256':hashlib.sha256((builder.BUILD/'lua-source-manifest.json').read_bytes()).hexdigest()}
    return manifest


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare",action="store_true")
    parser.add_argument("--build",action="store_true")
    parser.add_argument("--sdk",type=Path,default=Path(r"C:\Users\kit\emsdk"))
    parser.add_argument("--rust-lib",type=Path)
    parser.add_argument("--web-source",type=Path,help="Reviewed complete isolated frontend source directory; default current web")
    parser.add_argument("--registered-catalog",action="store_true",help="Export reviewed immutable-catalog Rust API from selected isolated library")
    parser.add_argument('--phase7-buffers','--phase7',dest='phase7',action='store_true',help='Opt in to reviewed seven-branch technical buffer producer proposal')
    args=parser.parse_args()
    if args.prepare==args.build:parser.error("choose exactly one of --prepare or --build")
    if args.prepare:
        manifest=prepare.prepare(phase7=args.phase7);print(json.dumps({"source_only":True,"catalog":manifest["catalog_counts"]}));return
    # Hash guards run before SDK preparation or any compiler subprocess.
    prepare.verify_inputs();prepare.verify_foundation()
    builder=make_builder()
    builder.REGISTERED_CATALOG=args.registered_catalog
    builder.ENABLE_PHASE7=args.phase7
    if args.registered_catalog and not args.rust_lib:parser.error('--registered-catalog requires an explicitly selected isolated Rust library')
    if args.web_source:
        frontend=args.web_source.resolve()
        if not frontend.is_dir() or not (frontend/'index.html').is_file():
            parser.error('--web-source must contain the complete reviewed frontend including index.html')
        builder.WEB_SOURCE=frontend
    sys.argv=[str(HERE/"build.py"),"--phase4-semantic-text","--jobs","1","--sdk",str(args.sdk)]
    if args.rust_lib:sys.argv += ["--rust-lib",str(args.rust_lib)]
    builder.main()
    manifest=json.loads((builder.BUILD/"engine-manifest.json").read_text("utf8"))
    manifest=final_lineage(builder,manifest)
    manifest.update(json.loads((builder.BUILD/'compile-embed-evidence.json').read_text('utf8')))
    manifest["isolated_phase6"]={"source_manifest_sha256":hashlib.sha256((prepare.OUTPUT/"source-manifest.json").read_bytes()).hexdigest(),
        "input_lock_sha256":hashlib.sha256((HERE/"inputs.lock.json").read_bytes()).hexdigest(),
        "target_data_manifest_sha256":hashlib.sha256((builder.BUILD/"target-data-manifest.json").read_bytes()).hexdigest(),
        "runtime_verified":False}
    manifest['frontend']={'selected_source':str(builder.WEB_SOURCE),'files':[
        {'path':path.relative_to(builder.BUILD/'web').as_posix(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        for path in sorted((builder.BUILD/'web').rglob('*')) if path.is_file() and path.suffix in ('.html','.css','.js','.mjs','.json')
        and 'engine' not in path.relative_to(builder.BUILD/'web').parts]}
    manifest['frontend']['registered_catalog']=args.registered_catalog
    (builder.BUILD/"engine-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf8",newline="\n")


if __name__=="__main__":main()
