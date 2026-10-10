"""Stage/check or explicitly build exactly one reviewed DCSS startup CPP unit.

Default --check never compiles, links, installs or imports another Python tool.
Defaults resolve solely inside the installed DCSS migration folder; --sdk
selects the official installed external toolchain. Root relocation only rebases
reviewed include/link paths, preserving the canonical header/flags fingerprint.
--build requires a parent-assigned heavy slot. Baseline source/cache/artifacts
are read-only. Corresponding source is the exact native baseline plus the
explicit patch-source/newgame.cc and link-only library.js receipts.
"""
from __future__ import annotations
import argparse
from datetime import datetime,timezone
import hashlib
import json
import os
from pathlib import Path,PurePosixPath
import re
import shutil
import subprocess
import time

HERE=Path(__file__).resolve().parent
GAME=HERE.parents[2]
PATCH=HERE/'inputs'
BASE=GAME/'engine/build-jspi-wasm-eh'
SOURCE=GAME/'engine/work-wasm-eh/crawl-ref/source'
OUT=GAME/'engine/candidates/startup-weapon-reproduced'
SDK=Path(r'C:\Users\kit\emsdk')
PYTHON=SDK/'python/3.13.3_64bit/python.exe'
EMCC=SDK/'upstream/emscripten/emcc.py'
PIN='1eebc1a2892e1c89776a0d7a10691f8dac8d9796'
FP='d2a8162d2fd3d9d760c9e509b6523d8eec022c884669a5b3e5353ce78fa1d0ba'
NEWGAME_BASE='b3186394e72e533d40fbf2e69d5b4b8a3b123f847a3a488ac49fb4252b92f10c'
NEWGAME_PATCH='ef20867b4f3af194368217864b076a17828492665480753dda9a2d722e46ef11'
LIB_BASE='ffdad020054a28f92e7030a9199cefcbee59dc332264091173b72e214647a6a5'
LIB_PATCH='a71cd6ff8ddcaaf479fd7c37c2eea7731c4ab9fd86944576eb634f8fd2c5137c'
WASM_BASE='432ba14e7903ff3678c2c19342917c240f3dc82ce62a121acd7bb9e127671c1e'
MANIFEST_BASE='984f8a0abb84db4b6ccea02219b9059b435e1ff96a7dcb818e9c1c0413cf1834'
RECEIPTS='52ad256fe2ddeedc605379e5a87a76e11815c164d700355c751c1516f8541592'

def utc():return datetime.now(timezone.utc).isoformat()
def digest(file):
    result=hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):result.update(block)
    return result.hexdigest()
def require_hash(file,expected):
    if digest(file)!=expected:raise ValueError('Reviewed hash drift: '+str(file))
def validate_patch_source(directory):
    files=list(directory.iterdir())
    if (len(files)!=1 or files[0].name!='newgame.cc' or not files[0].is_file()
        or files[0].is_symlink()):
        raise ValueError('Patch-source must contain only the reviewed newgame.cc, without shadowing headers')
    require_hash(files[0],NEWGAME_PATCH)
def fingerprint(flags):
    result=hashlib.sha256(json.dumps([flag.replace(str(GAME),'${DCSS_ROOT}') for flag in flags]).encode())
    for file in sorted(file for file in SOURCE.rglob('*') if file.is_file() and file.suffix in ('.h','.hpp','.inc')):
        result.update(file.relative_to(SOURCE).as_posix().encode());result.update(bytes.fromhex(digest(file)))
    result.update(bytes.fromhex(digest(EMCC)))
    return result.hexdigest()
def canonical_inverse(patched):
    start='// BEGIN jrogue startup-weapon-prompt adapter v1\n'
    end='// END jrogue startup-weapon-prompt adapter v1\n\n'
    if patched.count(start)!=1 or patched.count(end)!=1:raise ValueError('Unexpected private helper markers')
    first,last=patched.index(start),patched.index(end)+len(end)
    restored=patched[:first]+patched[last:]
    old='formatted_string("You have a choice of weapons.", CYAN)'
    new='formatted_string(_dcss_startup_weapon_prompt(), CYAN)'
    if restored.count(new)!=1:raise ValueError('Expected exactly one reviewed Text constructor')
    return restored.replace(new,old,1)
def relocate_flags(flags,old_root):
    return [flag.replace(old_root,str(GAME)) for flag in flags]
def manifest_root(manifest):
    ending='engine\\work-wasm-eh\\crawl-ref\\source'
    matches=[flag[2:] for flag in manifest['cxx_flags'] if flag.startswith('-I') and flag.endswith(ending)]
    if len(matches)!=1:raise ValueError('Expected exactly one original native source include')
    original=matches[0][:-len(ending)].rstrip('\\/')
    return original
def validate():
    require_hash(HERE/'audit/executed-build-startup.py','fed917abb533ec1eb62102b6a376fc7724643a6c3ac05ecdbf3a84dca90803f7')
    require_hash(HERE/'audit/executed-font-free-startup-package.py','52e44e62ea2ed5b8d13de2b862401b2899b3c13fa08df2074257d38b167ec921')
    require_hash(BASE/'manifest.json',MANIFEST_BASE)
    manifest=json.loads((BASE/'manifest.json').read_text())
    if (manifest.get('runtime')!='jspi' or manifest.get('exception_model')!='wasm'
        or manifest['upstream_commit']!=PIN or manifest['version']!='0.34.1'
        or manifest['compiler_fingerprint']!=FP or manifest['units']!=333):
        raise ValueError('Expected the immutable full native-EH baseline')
    if len(manifest['objects'])!=333 or manifest['cxx_flags'][-1]!='-std=c++11':raise ValueError('Native graph/flags drift')
    old_root=manifest_root(manifest)
    common=relocate_flags(manifest['cxx_flags'][:-1],old_root)
    if (common.count('-fwasm-exceptions')!=1 or '-fexceptions' in common or '-DWIZARD' not in common
        or fingerprint(common)!=FP):raise ValueError('Native compile flags/headers drift')
    for output in manifest['outputs']:
        file=BASE/output['name']
        require_hash(file,output['sha256'])
        if file.stat().st_size!=output['bytes']:raise ValueError('Baseline output size drift')
    require_hash(BASE/'dcss.wasm',WASM_BASE)
    matches=[]
    for index,item in enumerate(manifest['objects']):
        source,output=GAME/item['source'],GAME/item['object']
        require_hash(source,item['source_sha256']);require_hash(output,item['object_sha256'])
        expected=hashlib.sha256((FP+item['source_sha256']).encode()).hexdigest()
        if item['fingerprint']!=expected or output.with_suffix('.fingerprint').read_text()!=expected:
            raise ValueError('Baseline object cache drift: '+item['source'])
        if source==SOURCE/'newgame.cc':matches.append(index)
    if len(matches)!=1:raise ValueError('The333-unit graph must contain exactly one newgame.cc')
    require_hash(SOURCE/'newgame.cc',NEWGAME_BASE)
    require_hash(GAME/'engine/library.js',LIB_BASE)
    require_hash(PATCH/'base/newgame.cc',NEWGAME_BASE);require_hash(PATCH/'engine/newgame.cc',NEWGAME_PATCH)
    require_hash(PATCH/'base/library.js',LIB_BASE);require_hash(PATCH/'engine/library.js',LIB_PATCH)
    require_hash(PATCH/'source-receipts.json',RECEIPTS)
    receipt=json.loads((PATCH/'source-receipts.json').read_text())
    for name,old,new in [('engine/newgame.cc',NEWGAME_BASE,NEWGAME_PATCH),('engine/library.js',LIB_BASE,LIB_PATCH)]:
        entry=receipt['transformations'][name]
        if entry['base_sha256']!=old or entry['staged_sha256']!=new:raise ValueError('Patch receipt drift')
    if receipt['upstream']!=PIN:raise ValueError('Patch source version drift')
    patched=(PATCH/'engine/newgame.cc').read_text(encoding='utf-8')
    original=(SOURCE/'newgame.cc').read_text(encoding='utf-8')
    if canonical_inverse(patched)!=original:raise ValueError('Canonical CPP inverse mismatch')
    includes=lambda text:re.findall(r'(?m)^\s*#\s*include\s*[<"]([^>"]+)[>"]',text)
    if includes(patched)!=includes(original):raise ValueError('Patch include dependency list changed')
    library=(PATCH/'engine/library.js').read_text(encoding='utf-8')
    # The addition is synchronous. A future async import or header/ABI change
    # needs a separately reviewed mapping rather than implicit cached reuse.
    if re.search(r'dcss_host_startup_text__async\s*:',library):raise ValueError('Startup import must remain synchronous')
    if 'extern "C" int dcss_host_startup_text(const char*, const char*, char*, int);' not in patched:
        raise ValueError('Reviewed wasm32 startup ABI changed')
    data=GAME/'engine/build/data'
    javascript=(BASE/'dcss.js').read_text()
    marker='loadPackage({"files":'
    if javascript.count(marker)!=1:raise ValueError('Expected one pinned console data package')
    metadata,_=json.JSONDecoder().raw_decode(javascript[javascript.index(marker)+len('loadPackage('):])
    packaged=set()
    with (BASE/'dcss.data').open('rb') as stream:
        for entry in metadata['files']:
            relative=entry['filename'].removeprefix('/data/')
            path=PurePosixPath(relative)
            if (relative==entry['filename'] or not relative or path.is_absolute() or '\\' in relative
                or ':' in relative or any(part in ('','.','..') for part in relative.split('/'))
                or relative in packaged):raise ValueError('Unsafe or duplicate package path')
            packaged.add(relative)
            stream.seek(entry['start']);oldhash=hashlib.sha256(stream.read(entry['end']-entry['start'])).hexdigest()
            require_hash(data/relative,oldhash)
    actual={file.relative_to(data).as_posix() for file in data.rglob('*') if file.is_file()}
    if actual!=packaged:raise ValueError('Immutable console preload inventory drift')
    if len(metadata['files'])!=1449 or manifest['console_package']['official_vault_files']!=143:
        raise ValueError('Expected frozen1449-file development package')
    require_hash(PATCH/'web/startup-text.mjs','2bbbae4b169d62777409e897d22abee8d4493ca697e85a99c663efe39587d8f8')
    startup_text={'schema_version':1,'source':'startup-weapon-prompt-v1','upstream':PIN,
       'ids':['startup.weapon.prompt'],'source_sha256':NEWGAME_BASE,'transformed_source_sha256':NEWGAME_PATCH,
       'bridge_sha256':'2bbbae4b169d62777409e897d22abee8d4493ca697e85a99c663efe39587d8f8',
       'boundary_sha256':'b35e93f807923e5320ccb7d11d9edf84bc296d713a4cd6056c11306c31577f2c',
       'boundary_bytes':701559,'locale_mode':'session'}
    return manifest,matches[0],{'baseline_manifest_sha256':digest(BASE/'manifest.json'),
       'source_receipts_sha256':digest(PATCH/'source-receipts.json'),'baseline_wasm_sha256':WASM_BASE,
       'baseline_compiler_fingerprint':FP,'same_compile_flags':relocate_flags(manifest['cxx_flags'],old_root),
       'baseline_cxx_flags':manifest['cxx_flags'],'reproduction_schema_version':1,
       'units':333,'objects_reused':332,'objects_recompiled':1,'replacement_index':matches[0],
       'replacement_source_sha256':NEWGAME_PATCH,'link_library_sha256':LIB_PATCH,
       'async_import_change':False,'public_header_change':False,'data_package_files':1449,
       'runtime':'jspi','exception_model':'wasm','startup_slice':'startup.weapon.prompt','startup_text':startup_text}

def main():
    global GAME,PATCH,BASE,SOURCE,OUT,SDK,PYTHON,EMCC
    parser=argparse.ArgumentParser(description=__doc__)
    mode=parser.add_mutually_exclusive_group();mode.add_argument('--check',action='store_true');mode.add_argument('--build',action='store_true')
    parser.add_argument('--root',type=Path,default=GAME,help='DCSS folder; default is three directories above this migration recipe')
    parser.add_argument('--patch',type=Path,default=PATCH,help='Reviewed migration inputs; default is the adjacent inputs folder')
    parser.add_argument('--out',type=Path,default=Path('engine/candidates/startup-weapon-reproduced'),help='New candidate directory, relative to --root or absolute beneath its engine/candidates')
    parser.add_argument('--sdk',type=Path,default=SDK,help='Installed official Emscripten 6.0.8 SDK root')
    args=parser.parse_args()
    GAME=args.root.resolve();PATCH=args.patch.resolve();SDK=args.sdk.resolve()
    BASE=GAME/'engine/build-jspi-wasm-eh';SOURCE=GAME/'engine/work-wasm-eh/crawl-ref/source'
    OUT=(args.out if args.out.is_absolute() else GAME/args.out).resolve()
    candidates=(GAME/'engine/candidates').resolve()
    if not OUT.is_relative_to(candidates) or OUT==candidates:raise ValueError('Output must be a distinct child of DCSS engine/candidates')
    if (SDK/'upstream/emscripten/emscripten-version.txt').read_text().strip().strip('"')!='6.0.8':
        raise ValueError('The reviewed official Emscripten 6.0.8 SDK is required')
    PYTHON=SDK/'python/3.13.3_64bit/python.exe';EMCC=SDK/'upstream/emscripten/emcc.py'
    base,index,receipt=validate()
    flags=receipt['same_compile_flags']
    receipt['output_candidate']=OUT.relative_to(GAME).as_posix()
    helper_hash=digest(Path(__file__))
    if not args.build:print(json.dumps(receipt,indent=2));return
    if (GAME/'engine/.hold-link').exists():raise RuntimeError('Explicit parent build hold present')
    if (OUT/'manifest.json').exists():raise RuntimeError('Completed startup candidate already exists; preserve or archive it before a separately authorized build')
    patch_source=OUT/'patch-source';patch_source.mkdir(parents=True,exist_ok=True)
    if any(file.name!='newgame.cc' for file in patch_source.iterdir()):raise ValueError('Patch-source must not contain shadowing headers or other files')
    replacement=patch_source/'newgame.cc'
    if replacement.exists():require_hash(replacement,NEWGAME_PATCH)
    else:shutil.copy2(PATCH/'engine/newgame.cc',replacement)
    validate_patch_source(patch_source)
    object_file=OUT/'newgame.o'
    link_library=OUT/'startup-library.js'
    if link_library.exists():require_hash(link_library,LIB_PATCH)
    else:shutil.copy2(PATCH/'engine/library.js',link_library)
    require_hash(link_library,LIB_PATCH)
    environment=dict(os.environ,EM_CONFIG=str(SDK/'.emscripten'),EM_CACHE=str(GAME/'engine/em-cache'),
        PYTHONPATH=str(GAME/'engine/python'),PYTHONUTF8='1',EMCC_CORES='1',BINARYEN_CORES='1')
    command=[str(PYTHON),str(EMCC),'-c',str(replacement),'-o',str(object_file),*flags]
    receipt['compile_started_utc']=utc()
    print('STARTUP_CPP_COMPILE_START '+receipt['compile_started_utc'],flush=True)
    started=time.monotonic();result=subprocess.run(command,cwd=SOURCE,env=environment,capture_output=True,text=True,encoding='utf-8',errors='replace')
    (OUT/'compile.stdout.log').write_text(result.stdout,encoding='utf-8');(OUT/'compile.stderr.log').write_text(result.stderr,encoding='utf-8')
    receipt.update({'compile_finished_utc':utc(),'compile_wall_seconds':time.monotonic()-started,'compile_command':command,'compile_exit':result.returncode})
    if result.returncode:raise RuntimeError('The one reviewed CPP replacement failed to compile')
    validate_patch_source(patch_source)
    object_hash=digest(object_file)
    if digest(Path(__file__))!=helper_hash:raise ValueError('Loaded startup builder changed during compilation')
    _,_,prelink=validate()
    if prelink!=dict((key,receipt[key]) for key in prelink):raise ValueError('Startup input receipt changed before link')
    validate_patch_source(patch_source)
    # Preserve exactly the baseline object order, replacing one path only.
    paths=[GAME/item['object'] for item in base['objects']];paths[index]=object_file
    response=OUT/'link.rsp';response.write_text('\n'.join('"'+str(file).replace('\\','/')+'"' for file in paths))
    response_hash=digest(response)
    require_hash(link_library,LIB_PATCH)
    flags=relocate_flags(base['link_flags'],manifest_root(base))
    library_index=flags.index('--js-library')+1;flags[library_index]=str(link_library)
    output_index=flags.index('-o')+1;flags[output_index]=str(OUT/'dcss.js')
    link=[str(PYTHON),str(EMCC),'@'+str(response),*flags]
    receipt['link_started_utc']=utc()
    print('STARTUP_CPP_LINK_START '+receipt['link_started_utc'],flush=True)
    started=time.monotonic();result=subprocess.run(link,cwd=SOURCE,env=environment,capture_output=True,text=True,encoding='utf-8',errors='replace')
    (OUT/'link.stdout.log').write_text(result.stdout,encoding='utf-8');(OUT/'link.stderr.log').write_text(result.stderr,encoding='utf-8')
    receipt.update({'link_finished_utc':utc(),'link_wall_seconds':time.monotonic()-started,'link_exit':result.returncode,'link_flags':flags})
    if result.returncode:raise RuntimeError('The incremental startup link failed')
    validate_patch_source(patch_source)
    _,_,after=validate()
    if after!=prelink:raise ValueError('Immutable native baseline or startup receipt changed during link')
    require_hash(object_file,object_hash)
    require_hash(Path(__file__),helper_hash)
    require_hash(replacement,NEWGAME_PATCH)
    require_hash(link_library,LIB_PATCH)
    require_hash(response,response_hash)
    outputs=[{'name':name,'bytes':(OUT/name).stat().st_size,'sha256':digest(OUT/name)} for name in ('dcss.js','dcss.wasm','dcss.data')]
    if outputs[2]['sha256']!=next(item['sha256'] for item in base['outputs'] if item['name']=='dcss.data'):
        raise ValueError('Incremental package differs from immutable baseline')
    receipt.update({'version':base['version'],'upstream_commit':PIN,'compiler_fingerprint':FP,'cxx_flags':receipt['same_compile_flags'],
        'source_mapping':{'baseline_source':base['objects'][index]['source'],'baseline_source_sha256':NEWGAME_BASE,
          'replacement_source':'patch-source/newgame.cc','replacement_source_sha256':NEWGAME_PATCH,
          'baseline_object':base['objects'][index]['object'],'replacement_object':'newgame.o','replacement_object_sha256':object_hash,
          'replacement_cache_fingerprint':hashlib.sha256((FP+NEWGAME_PATCH).encode()).hexdigest(),
          'link_library':'startup-library.js','link_library_sha256':LIB_PATCH},
        'baseline_objects':base['objects'],
        'link_objects':[{'index':position,'object':path.relative_to(GAME).as_posix(),
           'object_sha256':object_hash if position==index else base['objects'][position]['object_sha256'],
           'replacement':position==index} for position,path in enumerate(paths)],
        'link_response_sha256':response_hash,'outputs':outputs,'build_helper_sha256':helper_hash,
        'audit_executed_builder_sha256':'fed917abb533ec1eb62102b6a376fc7724643a6c3ac05ecdbf3a84dca90803f7',
        'runtime_tests':'pending; no native/browser runtime performed by builder','emcc_cores':1,'binaryen_cores':1})
    (OUT/'manifest.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    print(json.dumps({'objects_reused':332,'objects_recompiled':1,'outputs':outputs},indent=2))

if __name__=='__main__':main()
