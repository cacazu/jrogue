"""Compile the complete pinned official DCSS console core with local Emscripten.

No upstream files are edited. Official generated headers run inside engine/work.
Usage: <emsdk-python> tools/engine-build.py [--jobs 2] [--prepare-only]
"""
from __future__ import annotations
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / 'engine'
SDK = Path(os.environ.get('DCSS_EMSDK', r'C:\Users\kit\emsdk'))
PYTHON = SDK / 'python/3.13.3_64bit/python.exe'
EMCC = SDK / 'upstream/emscripten/emcc.py'
PERL = Path(r'C:\Program Files\Git\usr\bin\perl.exe')
NODE = SDK / 'node/24.19.0_64bit/node.exe'
SOURCE = ENGINE / 'work/crawl-ref/source'
BUILD = ENGINE / 'build'
ENV = dict(os.environ, EM_CONFIG=str(SDK / '.emscripten'),
           EM_CACHE=str(ENGINE / 'em-cache'),
           PYTHONPATH=str(ENGINE / 'python'),
           BINARYEN_CORES='1',
           EMCC_CORES='1',
           PYTHONUTF8='1')

def run(args, cwd=SOURCE):
    result = subprocess.run([str(x) for x in args], cwd=cwd, env=ENV,
                            capture_output=True, text=True, encoding='utf-8', errors='replace')
    if result.returncode:
        print(result.stdout + result.stderr, flush=True)
        raise RuntimeError('Command failed: ' + str(args))
    if result.stdout.strip():
        print(result.stdout.strip(), flush=True)
    return result

def write_map_manifest(datadir):
    maps = sorted((datadir / 'dat/des').rglob('*.des'))
    (datadir / 'dat/dlua/loadmaps.lua').write_text('-- Generated from complete official vault set\n' +
        ''.join('dgn.load_des_file("' + x.relative_to(datadir / 'dat').as_posix() + '")\n' for x in maps))
    return len(maps)

def repack_data():
    """Use the SDK's official packager to update data without changing WASM."""
    maps = write_map_manifest(BUILD / 'data')
    pending = BUILD / 'pending'
    pending.mkdir(exist_ok=True)
    loader = pending / 'dcss-data.js'
    run([PYTHON, SDK / 'upstream/emscripten/tools/file_packager.py', pending / 'dcss.data',
         '--preload', str(BUILD / 'data') + '@/data', '--from-emcc', '--quiet',
         '--js-output=' + str(loader)])
    javascript = (BUILD / 'dcss.js').read_text(encoding='utf-8')
    # Emscripten marks every pre-js include. Replace only the unique generated
    # package loader, preserving all compiled runtime and console bridge code.
    includes = list(re.finditer(r'(?m)^// include: ([^\n]+)\n', javascript))
    matches = []
    for include in includes:
        ending = '// end include: ' + include.group(1)
        stop = javascript.find(ending, include.end())
        if stop < 0:
            continue
        section = javascript[include.end():stop]
        if "Module['expectedDataFileDownloads']++" in section[:500]:
            matches.append((include.end(), stop))
    if len(matches) != 1:
        raise RuntimeError('Expected exactly one Emscripten preload package section')
    first, last = matches[0]
    replacement = loader.read_text(encoding='utf-8')
    if '"/data/dat/des/00init.des"' not in replacement:
        raise RuntimeError('New package is missing official starting vault')
    (pending / 'dcss.js').write_text(javascript[:first] + '\n' + replacement + '\n' + javascript[last:], encoding='utf-8')
    for name in ('dcss.js', 'dcss.data'):
        os.replace(pending / name, BUILD / name)
    manifest = json.loads((BUILD / 'manifest.json').read_text())
    manifest['outputs'] = [{'name': name, 'bytes': (BUILD / name).stat().st_size,
        'sha256': hashlib.sha256((BUILD / name).read_bytes()).hexdigest()}
        for name in ('dcss.js','dcss.wasm','dcss.data')]
    manifest['official_vault_files'] = maps
    (BUILD / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    print(json.dumps(manifest['outputs'], indent=2), flush=True)

def prepare():
    upstream = ROOT / 'upstream/crawl-ref'
    ENGINE.mkdir(exist_ok=True)
    BUILD.mkdir(exist_ok=True)
    if not SOURCE.exists():
        shutil.copytree(upstream, SOURCE.parent,
                        ignore=shutil.ignore_patterns('.git', '*.png', '*.psd', '*.xcf', '*.jpg', '*.ogg', '*.wav'))
    # Refresh official dependencies after submodule initialization, if necessary.
    for name in ('lua', 'sqlite', 'zlib'):
        dest = SOURCE / 'contrib' / name
        shutil.copytree(upstream / 'source/contrib' / name, dest,
                        dirs_exist_ok=True, ignore=shutil.ignore_patterns('.git'))
    for name in ('levcomp.tab.cc', 'levcomp.tab.h', 'levcomp.lex.cc'):
        shutil.copy2(SOURCE / 'prebuilt' / name, SOURCE / 'util' / name)
    generators = [
        ['util/species-gen.py', 'dat/species/', 'util/species-gen/', 'species-data.h', 'aptitudes.h', 'species-groups.h', 'species-type.h'],
        ['util/job-gen.py', 'dat/jobs/', 'util/job-gen/', 'job-data.h', 'job-groups.h', 'job-type.h'],
        ['util/mon-gen.py', 'dat/mons/', 'util/mon-gen/', 'mon-data.h'],
        ['util/form-gen.py', 'dat/forms/', 'util/form-gen/', 'transformation.h', 'form-data.h'],
    ]
    for args in generators:
        run([PYTHON, '-c', 'import sys,runpy; sys.path[:0]=[' +
             repr(str(ENGINE / 'python')) + ',' + repr(str(SOURCE / 'util')) +
             ']; sys.argv=sys.argv[1:]; runpy.run_path(sys.argv[0],run_name="__main__")', *args])
    for name, args in [('art-data.pl', []), ('gen-mst.pl', []),
                       ('cmd-name.pl', ['command-type.h']),
                       ('gen-luatags.pl', ['tag-version.h']), ('gen-mi-enum', ['mon-info.h'])]:
        run([PERL, 'util/' + name, *args])
    run([PERL, 'util/gen-apt.pl', '../docs/aptitudes.txt', '../docs/template/apt-tmpl.txt', 'species-data.h', 'aptitudes.h'])
    run([PERL, 'util/gen-apt.pl', '../docs/aptitudes-wide.txt', '../docs/template/apt-tmpl-wide.txt', 'species-data.h', 'aptitudes.h'])
    run([PERL, 'util/FAQ2html.pl', 'dat/database/FAQ.txt', '../docs/FAQ.html'])
    with (SOURCE.parent / 'docs/crawl_manual.txt').open('wb') as output:
        subprocess.run([str(PERL), 'util/unrest.pl', '../docs/crawl_manual.rst'], cwd=SOURCE, env=ENV, stdout=output, check=True)
    shutil.copy2(SOURCE.parent / 'docs/quickstart.md', SOURCE.parent / 'docs/quickstart.txt')
    generate_tile_enums()
    (SOURCE / 'config.h').write_text('#pragma once\n#define CRAWL_HAVE_FDATASYNC\n#define CRAWL_HAVE_STRLCPY\n#define CRAWL_HAVE_MKSTEMP\n#define CRAWL_HAVE_USLEEP\n')
    (SOURCE / 'build.h').write_text('#define CRAWL_VERSION_MAJOR "0.34"\n#define CRAWL_VERSION_RELEASE VER_FINAL\n#define CRAWL_VERSION_SHORT "0.34.1"\n#define CRAWL_VERSION_LONG "0.34.1-jrogue-wasm"\n')
    (SOURCE / 'compflag.h').write_text('#pragma once\n#define CRAWL_CFLAGS "Emscripten -std=c++11 -O1 -fexceptions"\n#define CRAWL_LDFLAGS "Asyncify browser console"\n#define CRAWL_HOST "Windows build host"\n#define CRAWL_ARCH "wasm32"\n')
    # Do not install Unix crash signal handlers in a browser process.
    app = SOURCE / 'AppHdr.h'
    content = app.read_text(encoding='utf-8')
    needle = '    #define USE_UNIX_SIGNALS\n'
    if '    #ifndef __EMSCRIPTEN__\n' not in content:
        content = content.replace(needle, '    #ifndef __EMSCRIPTEN__\n' + needle + '    #endif\n', 1)
    app.write_text(content, encoding='utf-8')
    crash = SOURCE / 'crash.cc'
    content = crash.read_text(encoding='utf-8')
    content = content.replace('#ifndef __HAIKU__', '#if !defined(__HAIKU__) && !defined(__EMSCRIPTEN__)')
    content = content.replace('string crash_signal_info()\n{\n#if defined(UNIX)',
                              'string crash_signal_info()\n{\n#if defined(UNIX) && !defined(__EMSCRIPTEN__)')
    crash.write_text(content, encoding='utf-8')
    datadir = BUILD / 'data'
    datadir.mkdir(exist_ok=True)
    shutil.copytree(SOURCE / 'dat', datadir / 'dat', dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns('tiles', '*.png'))
    shutil.copytree(SOURCE.parent / 'docs', datadir / 'docs', dirs_exist_ok=True)
    shutil.copytree(SOURCE.parent / 'settings', datadir / 'settings', dirs_exist_ok=True)
    shutil.copy2(SOURCE.parent / 'CREDITS.txt', datadir / 'docs/CREDITS.txt')
    maps = write_map_manifest(datadir)
    print(f'Prepared full console source and {maps} official vault files.', flush=True)

def generate_tile_enums():
    # The official generator's console mode generates exact enums without PNG
    # dependencies, preserving upstream's console build behavior.
    output = BUILD / 'tilegen.js'
    # Console tilegen verifies PNG existence while generating enums, although it
    # never decodes or ships graphics. Keep the original files pristine; copy
    # only the build-time inputs into the separate work copy.
    image_root = ROOT / 'upstream/crawl-ref/source/rltiles'
    for image in image_root.rglob('*.png'):
        dest = SOURCE / 'rltiles' / image.relative_to(image_root)
        if not dest.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(image, dest)
    sources = sorted((SOURCE / 'rltiles/tool').glob('*.cc'))
    if not output.exists() or not output.with_suffix('.wasm').exists():
        run([PYTHON, EMCC, *sources, '-std=c++11', '-O1', '-sDEFAULT_TO_CXX=1', '-sNODERAWFS=1', '-sENVIRONMENT=node', '-o', output])
    for name in ('main','dngn','floor','wall','feat','player','gui','icons'):
        run([NODE, output, '-c', 'dc-' + name + '.txt'], cwd=SOURCE / 'rltiles')
    run([PYTHON, 'util/status-icon-sizes-gen.py', 'rltiles/icon-sizes.txt'])

def units():
    text = (SOURCE / 'Makefile.obj').read_text()
    block = text.split('OBJECTS =', 1)[1].split('TILES_OBJECTS', 1)[0]
    names = re.findall(r'([\w/-]+)\.o', block)
    sources = [(SOURCE / (n + '.cc'), BUILD / 'obj' / (n + '.o')) for n in names]
    for n in ('main', 'version', 'util/levcomp.tab', 'util/levcomp.lex'):
        sources.append((SOURCE / (n + '.cc'), BUILD / 'obj' / (n + '.o')))
    # Match Makefile TILEDEFS, including separately generated unrand mappings.
    for name in ('main','dngn','floor','wall','feat','player','gui','icons','unrand'):
        n = 'rltiles/tiledef-' + name
        sources.append((SOURCE / (n + '.cc'), BUILD / 'obj' / (n + '.o')))
    sources.append((ENGINE / 'platform_console.cc', BUILD / 'obj/platform_console.o'))
    for p in sorted((SOURCE / 'contrib/lua/src').glob('*.c')):
        if p.stem not in ('lua', 'luac'):
            sources.append((p, BUILD / 'obj/lua' / (p.stem + '.o')))
    sources.append((SOURCE / 'contrib/sqlite/sqlite3.c', BUILD / 'obj/sqlite3.o'))
    for name in ('adler32','compress','crc32','deflate','gzclose','gzlib','gzread','gzwrite',
                 'infback','inffast','inflate','inftrees','trees','uncompr','zutil'):
        sources.append((SOURCE / ('contrib/zlib/' + name + '.c'), BUILD / 'obj/zlib' / (name + '.o')))
    return sources

COMMON = ['-O1', '-fexceptions', '-fwrapv', '-fno-strict-aliasing', '-Wno-deprecated-declarations',
          '-I' + str(SOURCE), '-I' + str(SOURCE / 'contrib/lua/src'),
          '-I' + str(SOURCE / 'contrib/sqlite'), '-I' + str(SOURCE / 'contrib/zlib'),
          '-DCLUA_BINDINGS', '-DWIZARD', '-DDATA_DIR_PATH="/data/"', '-DSAVE_DIR_PATH="/persist/"',
          '-DSQLITE_THREADSAFE=0', '-DSQLITE_OMIT_LOAD_EXTENSION', '-DLUA_USE_POSIX']
BUILD_FINGERPRINT = ''

def compiler_fingerprint(canonical_paths=True):
    flags = [flag.replace(str(ROOT), '${DCSS_ROOT}') for flag in COMMON] if canonical_paths else COMMON
    fingerprint = hashlib.sha256(json.dumps(flags).encode())
    for header in sorted(p for p in SOURCE.rglob('*')
                         if p.is_file() and p.suffix in ('.h', '.hpp', '.inc')):
        fingerprint.update(header.relative_to(SOURCE).as_posix().encode())
        fingerprint.update(hashlib.sha256(header.read_bytes()).digest())
    fingerprint.update(hashlib.sha256(EMCC.read_bytes()).digest())
    return fingerprint.hexdigest()

def migrate_cache():
    """Retain proven objects when only the task workspace path changes."""
    legacy = compiler_fingerprint(canonical_paths=False)
    stable = compiler_fingerprint()
    migrated, existing, unmatched = 0, 0, []
    for src, dest in units():
        cache = dest.with_suffix('.fingerprint')
        if not dest.exists() or not cache.exists():
            continue
        source = hashlib.sha256(src.read_bytes()).hexdigest()
        old_key = hashlib.sha256((legacy + source).encode()).hexdigest()
        new_key = hashlib.sha256((stable + source).encode()).hexdigest()
        existing += 1
        if cache.read_text() == old_key:
            cache.write_text(new_key)
            migrated += 1
        elif cache.read_text() != new_key:
            unmatched.append(src.relative_to(ROOT).as_posix())
    report = {'legacy_fingerprint': legacy, 'canonical_fingerprint': stable,
              'existing': existing, 'migrated': migrated, 'unmatched': unmatched}
    (BUILD / 'cache-relocation.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2), flush=True)

def compile_unit(pair):
    src, dest = pair
    key = hashlib.sha256((BUILD_FINGERPRINT + hashlib.sha256(src.read_bytes()).hexdigest()).encode()).hexdigest()
    cache = dest.with_suffix('.fingerprint')
    if dest.exists() and cache.exists() and cache.read_text() == key:
        return src.name + ' (cached)'
    dest.parent.mkdir(parents=True, exist_ok=True)
    args = [PYTHON, EMCC, '-c', src, '-o', dest, *COMMON]
    if src.suffix == '.cc':
        args += ['-std=c++11']
    result = subprocess.run([str(x) for x in args], cwd=SOURCE, env=ENV,
                            capture_output=True, text=True, encoding='utf-8', errors='replace')
    (dest.with_suffix('.log')).write_text(result.stdout + result.stderr, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(src.name + '\n' + result.stderr)
    cache.write_text(key)
    return src.name

def main():
    global BUILD_FINGERPRINT
    parser = argparse.ArgumentParser()
    parser.add_argument('--jobs', type=int, default=2)
    parser.add_argument('--prepare-only', action='store_true')
    parser.add_argument('--skip-prepare', action='store_true')
    parser.add_argument('--compile-only', action='store_true')
    parser.add_argument('--tilegen-only', action='store_true')
    parser.add_argument('--repack-only', action='store_true')
    parser.add_argument('--migrate-cache', action='store_true')
    parser.add_argument('--hold-link', action='store_true',
                        help='Finish compilation but leave the heavy link for an authorized slot')
    args = parser.parse_args()
    if args.migrate_cache:
        migrate_cache()
        return
    if args.repack_only:
        repack_data()
        return
    if args.tilegen_only:
        generate_tile_enums()
        return
    if not args.skip_prepare:
        prepare()
    if args.prepare_only:
        return
    # Source-tagged localization changes only the separate, recognized work copy.
    subprocess.run([str(PYTHON), str(ROOT / 'tools/apply-semantic-patches.py'), '--apply'], check=True)
    source_units = units()
    BUILD_FINGERPRINT = compiler_fingerprint()
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
        future_map = {pool.submit(compile_unit, pair): pair for pair in source_units}
        for i, fut in enumerate(concurrent.futures.as_completed(future_map), 1):
            try:
                print(f'[{i}/{len(source_units)}] {fut.result()}', flush=True)
            except Exception as exc:
                failures.append(str(exc))
                print('FAILED ' + str(exc), flush=True)
    (BUILD / 'compile-result.json').write_text(json.dumps({'units': len(source_units),
        'compiler_fingerprint': BUILD_FINGERPRINT, 'cxx_flags': COMMON + ['-std=c++11'],
        'failures': failures}, indent=2), encoding='utf-8')
    if failures:
        raise RuntimeError(f'{len(failures)} compilation units failed; see engine/build/compile-result.json')
    if args.compile_only or args.hold_link or (ENGINE / '.hold-link').exists():
        print('Compilation complete; link deferred by requested memory hold.', flush=True)
        return
    response = BUILD / 'link.rsp'
    response.write_text('\n'.join('"' + str(dest).replace('\\', '/') + '"' for _, dest in source_units))
    pending = BUILD / 'pending'
    pending.mkdir(exist_ok=True)
    run([PYTHON, EMCC, '@' + str(response), '-O1', '-fexceptions', '-sDEFAULT_TO_CXX=1', '-Wl,--error-limit=0',
         '--js-library', ENGINE / 'library.js', '--preload-file', str(BUILD / 'data') + '@/data',
         '-sMODULARIZE=1', '-sEXPORT_NAME=createDcssEngine', '-sENVIRONMENT=web,worker,node',
         '-sALLOW_MEMORY_GROWTH=1', '-sINITIAL_MEMORY=134217728', '-sSTACK_SIZE=8388608',
         '-sASYNCIFY=1', '-sASYNCIFY_STACK_SIZE=8388608', '-sASSERTIONS=1', '-sINVOKE_RUN=0',
         '-sEXPORTED_FUNCTIONS=["_main","_dcss_snapshot_json","_dcss_clusters_json","_dcss_save","_dcss_repaint","_malloc","_free"]',
         '-sEXPORTED_RUNTIME_METHODS=["FS","callMain","UTF8ToString"]',
         '-o', pending / 'dcss.js'])
    # Keep the previous usable bundle intact throughout long Asyncify processing.
    for name in ('dcss.js','dcss.wasm','dcss.data'):
        os.replace(pending / name, BUILD / name)
    outputs = [{ 'name': p.name, 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest() }
               for p in [BUILD / 'dcss.js', BUILD / 'dcss.wasm', BUILD / 'dcss.data']]
    source_commit = subprocess.check_output(['git','-C',str(ROOT / 'upstream'),'rev-parse','HEAD'],text=True).strip()
    (BUILD / 'manifest.json').write_text(json.dumps({'version': '0.34.1', 'upstream_commit': source_commit,
        'units': len(source_units), 'core_source_list': [src.relative_to(SOURCE).as_posix() for src,_ in source_units if src.is_relative_to(SOURCE)],
        'cxx_flags': COMMON + ['-std=c++11'], 'compiler_fingerprint': BUILD_FINGERPRINT,
        'bridge': 'platform_console.cc', 'official_vault_files': 143, 'outputs': outputs}, indent=2))
    print(json.dumps(outputs, indent=2), flush=True)

if __name__ == '__main__':
    main()
