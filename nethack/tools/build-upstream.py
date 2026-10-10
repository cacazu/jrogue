#!/usr/bin/env python3
"""Reproduce the full official NetHack 5.0.0 Emscripten engine on Windows.

The audit tree is never modified. Native utilities, generated headers, every
core C module, and all shipped dungeon/quest Lua data are built in work/.
No installer, global SDK activation, or network executable is used.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import difflib
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "upstream" / "NetHack-5.0.0"
if not AUDIT.exists():
    AUDIT = ROOT.parent / "official-source-audit" / "NetHack-5.0.0"
WORK = ROOT / "work"
SOURCE = WORK / "NetHack-5.0.0"
BUILD = ROOT / "build"
PHASE4_MODE = False  # Added 2026-10-02: opt-in isolated source/artifact scope.
LUA_SHA256 = "4f18ddae154e793e46eeab727c59ef1c0c0c2b744e7b94219710d76f530629ae"
COMMIT = "16ff59115315917b93185d026aeefea06db9b0f4"


def run(command, *, cwd=None, env=None, log=None):
    if cwd is None:
        cwd = SOURCE
    proc = subprocess.run([str(x) for x in command], cwd=cwd, env=env,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    output = proc.stdout.decode("utf-8", errors="replace")
    if log:
        Path(log).write_text(output, encoding="utf-8")
    if proc.returncode:
        print(output[-16000:], flush=True)
        raise RuntimeError(f"Command failed ({proc.returncode}): {command}")
    return output


def native_env():
    vcvars = Path(r"C:\BuildTools\VC\Auxiliary\Build\vcvars64.bat")
    output = run(["cmd.exe", "/d", "/s", "/c", f'"{vcvars}" >nul && set'], cwd=ROOT)
    env = dict(os.environ)
    for line in output.splitlines():
        if "=" in line and not line.startswith("="):
            name, value = line.split("=", 1)
            env[name] = value
    return env


def setup(sdk):
    WORK.mkdir(parents=True, exist_ok=True)
    BUILD.mkdir(parents=True, exist_ok=True)
    if not SOURCE.exists():
        shutil.copytree(AUDIT, SOURCE)
    lua_tar = WORK / "lua-5.4.8.tar.gz"
    if PHASE4_MODE and not lua_tar.exists():
        pinned_tar = ROOT / "work" / "lua-5.4.8.tar.gz"
        if pinned_tar.exists():
            if hashlib.sha256(pinned_tar.read_bytes()).hexdigest() != LUA_SHA256:
                raise RuntimeError("Existing local official Lua archive failed checksum verification")
            shutil.copy2(pinned_tar, lua_tar)
    lua_root = SOURCE / "lib" / "lua-5.4.8"
    lua_manifest_file = BUILD / "lua-source-manifest.json"
    if PHASE4_MODE and not lua_manifest_file.exists() and (ROOT / "build" / "lua-source-manifest.json").exists():
        shutil.copy2(ROOT / "build" / "lua-source-manifest.json", lua_manifest_file)
    bundled_lua = ROOT / "engine-source" / "lib" / "lua-5.4.8"
    if not lua_root.exists() and not lua_tar.exists() and bundled_lua.exists() and lua_manifest_file.exists():
        manifest = json.loads(lua_manifest_file.read_text(encoding="utf-8"))
        if {p.relative_to(bundled_lua).as_posix() for p in bundled_lua.rglob("*") if p.is_file()} != set(manifest["files"]):
            raise RuntimeError("Bundled Lua source file set differs from the verified official archive")
        for name, expected in manifest["files"].items():
            path = (bundled_lua / name).resolve()
            if not path.is_relative_to(bundled_lua.resolve()) or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
                raise RuntimeError(f"Bundled Lua source verification failed: {name}")
        print("Using checksum-verified bundled Lua 5.4.8 source", flush=True)
        (SOURCE / "lib").mkdir(exist_ok=True)
        shutil.copytree(bundled_lua, lua_root)
    if not lua_root.exists() and not lua_tar.exists():
        print("Downloading official Lua 5.4.8 source", flush=True)
        urllib.request.urlretrieve("https://www.lua.org/ftp/lua-5.4.8.tar.gz", lua_tar)
    if lua_tar.exists() and hashlib.sha256(lua_tar.read_bytes()).hexdigest() != LUA_SHA256:
        raise RuntimeError("Lua source checksum does not match upstream CHKSUMS")
    if not lua_root.exists():
        (SOURCE / "lib").mkdir(exist_ok=True)
        with tarfile.open(lua_tar) as archive:
            archive.extractall(SOURCE / "lib", filter="data")
    actual_lua_files = {p.relative_to(lua_root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                        for p in sorted(lua_root.rglob("*")) if p.is_file()}
    if lua_tar.exists():
        with tarfile.open(lua_tar) as archive:
            expected_lua_files = {str(Path(member.name).relative_to("lua-5.4.8")).replace("\\", "/"):
                                  hashlib.sha256(archive.extractfile(member).read()).hexdigest()
                                  for member in archive.getmembers() if member.isfile()}
    elif lua_manifest_file.exists():
        expected_lua_files = json.loads(lua_manifest_file.read_text(encoding="utf-8"))["files"]
    else:
        raise RuntimeError("Pinned Lua source requires the verified archive or bundled source manifest")
    if actual_lua_files != expected_lua_files:
        raise RuntimeError("Lua source differs from the checksum-verified official dependency")
    lua_manifest_file.write_text(json.dumps({"version": "5.4.8", "archive_sha256": LUA_SHA256,
        "files": actual_lua_files}, indent=2), encoding="utf-8")
    lua_header = lua_root / "src" / "lua.h"
    error_decl = next(line for line in lua_header.read_text().splitlines() if "(lua_error)" in line)
    error_decl = error_decl.replace("LUA_API", "ATTRNORETURN LUA_API", 1).replace(";", " NORETURN;")
    (SOURCE / "include" / "nhlua.h").write_text(
        '/* Generated 2026-10-02 by build-upstream.py; equivalent to upstream Makefile.top. */\n'
        '#include "../lib/lua-5.4.8/src/lua.h"\n' + error_decl + '\n'
        '#include "../lib/lua-5.4.8/src/lualib.h"\n'
        '#include "../lib/lua-5.4.8/src/lauxlib.h"\n', encoding="utf-8")
    # Fix the upstream WASM callback's char* return marshalling. Its generic
    # setter is also used for writable C arrays, so adjust only callback returns.
    shim = SOURCE / "win" / "shim" / "winshim.c"
    original = (AUDIT / "win" / "shim" / "winshim.c").read_text()
    patched = original.replace('"vipi00iisi"', '"vipp00iisi"').replace('"2is"', '"1is"')
    patched = patched.replace("setPointerValue(name, ret_ptr, retType, retVal);", '''if (retType === "s") {
                const bridge = globalThis.nethackGlobal;
                if (bridge.returnStringPtr) { _free(bridge.returnStringPtr); bridge.returnStringPtr = 0; }
                if (typeof retVal === "number") { setValue(ret_ptr, retVal, "*"); }
                else if (!retVal) { setValue(ret_ptr, 0, "*"); }
                else {
                    const bytes = lengthBytesUTF8(retVal) + 1;
                    bridge.returnStringPtr = _malloc(bytes);
                    stringToUTF8(retVal, bridge.returnStringPtr, bytes);
                    setValue(ret_ptr, bridge.returnStringPtr, "*");
                }
            } else { setPointerValue(name, ret_ptr, retType, retVal); }''')
    patched = '/* Modified 2026-10-02: preserve menu anything*, short and char* returns; preserve upstream below. */\n' + patched
    shim.write_text(patched, encoding="utf-8")
    (BUILD / "upstream-adapter.patch").write_text(''.join(difflib.unified_diff(original.splitlines(True), patched.splitlines(True),
        fromfile="upstream/win/shim/winshim.c", tofile="work/win/shim/winshim.c")), encoding="utf-8")
    rnd = SOURCE / "src" / "rnd.c"
    rnd_original = (AUDIT / "src" / "rnd.c").read_text()
    rnd_adapter = '''
/* Added 2026-10-02: read-only RNG checksum for browser integration tests. */
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
EMSCRIPTEN_KEEPALIVE unsigned nh_abi_rng_checksum(void) {
    unsigned hash = 2166136261U;
#ifdef USE_ISAAC64
    const unsigned char *p = (const unsigned char *)rnglist;
    size_t count = sizeof(rnglist);
    while (count--) { hash ^= *p++; hash *= 16777619U; }
#endif
    return hash;
}
#endif
'''
    rnd_patched = '/* Modified 2026-10-02: add read-only RNG checksum; preserve upstream below. */\n' + rnd_original + rnd_adapter
    rnd.write_text(rnd_patched, encoding="utf-8")
    with (BUILD / "upstream-adapter.patch").open("a", encoding="utf-8") as patch:
        patch.write(''.join(difflib.unified_diff(rnd_original.splitlines(True), rnd_patched.splitlines(True),
                    fromfile="upstream/src/rnd.c", tofile="work/src/rnd.c")))
    libmain = SOURCE / "sys" / "libnh" / "libnhmain.c"
    libmain_original = (AUDIT / "sys" / "libnh" / "libnhmain.c").read_text()
    libmain_patched = libmain_original.replace("after_opt_showpaths(const char *dir)", "libnh_legacy_after_opt_showpaths(const char *dir)")
    libmain_patched = libmain_patched.replace('typeof value !== "number" || value < 0 || value > 128',
                                             '!Number.isInteger(value) || value < 0 || value > 255')
    libmain_patched = libmain_patched.replace('integer representing an ASCII character', 'integer representing a C character byte')
    libmain_patched = libmain_patched.replace("    unsigned long seed = 0L;", '''    /* Added 2026-10-02: deterministic initial seed only when the test
     * harness explicitly supplies this environment variable. Normal play
     * keeps the complete upstream entropy path below. */
    const char *test_seed = getenv("NETHACK_TEST_SEED");
    unsigned long seed = 0L;
    if (test_seed && *test_seed) {
        char *end;
        seed = strtoul(test_seed, &end, 10);
        if (!*end) { has_strong_rngseed = FALSE; return seed; }
    }''', 1)
    libmain_patched = '/* Modified 2026-10-02: resolve stale showpaths, preserve C byte input and add explicit test seed. */\n' + libmain_patched
    libmain.write_text(libmain_patched, encoding="utf-8")
    with (BUILD / "upstream-adapter.patch").open("a", encoding="utf-8") as patch:
        patch.write(''.join(difflib.unified_diff(libmain_original.splitlines(True), libmain_patched.splitlines(True),
                    fromfile="upstream/sys/libnh/libnhmain.c", tofile="work/sys/libnh/libnhmain.c")))
    (BUILD / "dependencies.json").write_text(json.dumps({"lua": {"version": "5.4.8", "url": "https://www.lua.org/ftp/lua-5.4.8.tar.gz",
        "sha256": LUA_SHA256, "license": "MIT", "license_file": "work/NetHack-5.0.0/lib/lua-5.4.8/doc/readme.html"},
        "emscripten": {"version": "6.0.8", "url": "https://github.com/emscripten-core/emscripten", "license": "MIT/NCSA"}}, indent=2), encoding="utf-8")
    env = dict(os.environ)
    env["EM_CONFIG"] = str(sdk / ".emscripten")
    env["EMSDK"] = str(sdk)
    env["EMSDK_NODE"] = str(sdk / "node" / "24.19.0_64bit" / "node.exe")
    env["EM_CACHE"] = str(WORK / "emscripten-cache")
    return env


def utility_source(relative):
    # Modified phase4 presentation sources depend on the full engine. Native
    # and target metadata utilities use the exact original utility C with the
    # generated working include headers. Default source selection is unchanged.
    return (AUDIT if PHASE4_MODE else SOURCE) / relative


def native_utilities():
    native = WORK / "native"
    native.mkdir(exist_ok=True)
    gcc = Path(r"C:\Users\kit\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin\gcc.exe")
    env = dict(os.environ)
    env["PATH"] = str(gcc.parent) + os.pathsep + env.get("PATH", "")
    common = [gcc, "-O2", "-std=gnu11", "-DCROSSCOMPILE", "-D_CRT_SECURE_NO_WARNINGS",
              "-I" + str(SOURCE / "include"), "-I" + str(SOURCE / "sys" / "windows"),
              "-I" + str(SOURCE / "sys" / "winnt")]
    defs = native / "makedefs.exe"
    sources = [utility_source("util/makedefs.c")] + [utility_source("src/" + x + ".c")
               for x in ["monst", "objects", "date", "alloc", "hacklib"]] + [utility_source("util/panic.c")]
    print("Compiling native makedefs", flush=True)
    run(common + sources + ["-o", defs], cwd=native, env=env, log=BUILD / "native-makedefs.log")
    for option in ["d", "r", "h", "s", "1", "2", "3", "v"]:
        run([defs, "-" + option], cwd=SOURCE / "util", env=env)
    dlb = native / "dlb.exe"
    print("Compiling native data librarian", flush=True)
    run(common + ["-DDLB", utility_source("util/dlb_main.c"), utility_source("src/dlb.c"),
                  utility_source("src/alloc.c"), utility_source("src/hacklib.c"), utility_source("util/panic.c"), "-o", dlb],
        cwd=native, env=env, log=BUILD / "native-dlb.log")
    return dlb, env


def target_flags():
    return ["-O2", "-I" + str(SOURCE / "include"), "-I" + str(SOURCE / "lib" / "lua-5.4.8" / "src"),
             "-DNO_SIGNAL", "-DNOTPARMDECL", "-DSYSCF", '-DSYSCF_FILE="/sysconf"', "-DSECURE", "-DDLB",
             '-DHACKDIR="/"', '-DDEFAULT_WINDOW_SYS="shim"', "-DNOMAIL", "-DNOTTYGRAPHICS", "-DSHIM_GRAPHICS",
             "-DLIBNH", "-DCROSSCOMPILE", "-DCROSSCOMPILE_TARGET", "-DCROSS_TO_WASM"]


def target_options(sdk, env):
    """Generate version reference data using the actual WASM target configuration."""
    emcc = [sdk / "python" / "3.13.3_64bit" / "python.exe", sdk / "upstream" / "emscripten" / "emcc.py"]
    utility = BUILD / "target-makedefs.cjs"
    sources = [utility_source("util/makedefs.c")] + [utility_source("src/" + name + ".c") for name in ["monst", "objects", "date", "alloc", "hacklib"]] + [utility_source("util/panic.c")]
    run(emcc + target_flags() + sources + ["-sMODULARIZE", "-sENVIRONMENT=node", "-sEXIT_RUNTIME=0",
        '-sEXPORTED_RUNTIME_METHODS=["FS","callMain"]', "-o", utility], env=env, log=BUILD / "target-makedefs-build.log")
    script = '''const create = require(process.argv[1]);
create({noInitialRun:true, print:()=>{}}).then(m=>{
    for(const p of ['/include','/dat','/util'])m.FS.mkdir(p);
    m.FS.chdir('/util');m.callMain(['-v']);
    process.stdout.write(m.FS.readFile('/dat/options',{encoding:'utf8'}));
});'''
    output = run([env["EMSDK_NODE"], "-e", script, utility], cwd=ROOT, env=env, log=BUILD / "target-options.log")
    if '"shim"' not in output or "CNG" in output:
        raise RuntimeError("Target options data does not describe the actual shim/WASM configuration")
    (SOURCE / "dat" / "options").write_text(output, encoding="utf-8")


def package_data(dlb, env):
    data = WORK / "wasm-data"
    data.mkdir(exist_ok=True)
    dat = SOURCE / "dat"
    files = sorted(p.name for p in dat.glob("*.lua"))
    files += "help hh cmdhelp keyhelp history opthelp optmenu usagehlp wizhelp tribute bogusmon data engrave epitaph oracles rumors options".split()
    listfile = dat / "dlb.lst"
    listfile.write_text("\n".join(files) + "\n", encoding="ascii")
    run([dlb, "cIf", listfile, data / "nhdat"], cwd=dat, env=env, log=BUILD / "package-data.log")
    # The native Windows librarian adds its version suffix. The unchanged
    # UNIX/WASM reader expects nhdat, as verified by data-probe below.
    windows_archive = data / "nhdat500"
    if windows_archive.exists():
        windows_archive.replace(data / "nhdat")
    for filename in ["license", "symbols"]:
        shutil.copy2(dat / filename, data / filename)
    shutil.copy2(SOURCE / "sys" / "libnh" / "sysconf", data / "sysconf")
    for filename in "perm record logfile xlogfile livelog".split():
        (data / filename).touch()
    return data, files


def engine(sdk, env, data, jobs, rust_lib=None, semantic_text=False):
    python = sdk / "python" / "3.13.3_64bit" / "python.exe"
    emcc = [python, sdk / "upstream" / "emscripten" / "emcc.py"]
    manifest = (SOURCE / "sys" / "unix" / "Makefile.src").read_text()
    hobj = re.search(r"^HOBJ\s*=\s*(.*?)(?=\n\n)", manifest, re.M | re.S).group(1)
    core = list(dict.fromkeys(re.findall(r"\$\(TARGETPFX\)(\w+)\.o", hobj)))
    core += ["date", "hacklib"]
    paths = [SOURCE / "src" / (name + ".c") for name in core]
    paths += [SOURCE / x for x in ["sys/libnh/libnhmain.c", "sys/share/ioctl.c", "sys/share/unixtty.c",
               "sys/unix/unixunix.c", "sys/unix/unixres.c", "win/shim/winshim.c", "sys/share/posixregex.c"]]
    paths += [p for p in (SOURCE / "lib" / "lua-5.4.8" / "src").glob("*.c") if p.name not in ["lua.c", "luac.c"]]
    adapter = SOURCE / "sys" / "libnh" / "jrogue-abi.c"
    shutil.copy2(ROOT / "tools" / "build-upstream-abi.c", adapter)
    paths.append(adapter)
    if semantic_text:
        paths.append(SOURCE / "src" / "nh-semantic.c")
        paths.append(SOURCE / "src" / "nh-quest-semantic.c")
        paths.append(SOURCE / "src" / "nh-semantic-name.c")
        if PHASE4_MODE:
            paths.append(SOURCE / "src" / "nh-phase4-values.c")
    objdir = WORK / "objects"
    objdir.mkdir(exist_ok=True)
    flags = target_flags()
    semantic_sources, semantic_header_changed = set(), False
    semantic_header_cache = objdir / "semantic-headers.sha256"
    semantic_header_digest = None
    if semantic_text:
        semantic_audit = json.loads((WORK / "semantic-generated" / "audit.json").read_text(encoding="utf-8"))
        semantic_sources = {SOURCE / item["source"] for item in semantic_audit["files"]}
        semantic_sources.update(SOURCE / "src" / name for name in
                                ("nh-semantic.c", "nh-quest-semantic.c", "nh-semantic-name.c"))
        if PHASE4_MODE:
            semantic_sources.add(SOURCE / "src" / "nh-phase4-values.c")
        digest = hashlib.sha256()
        for item in sorted(semantic_audit["generated_files"], key=lambda item: item["path"]):
            if not item["path"].startswith("include/"):
                continue
            header = SOURCE / item["path"]
            content = header.read_bytes()
            digest.update(item["path"].encode("utf-8") + b"\0")
            digest.update(len(content).to_bytes(8, "little"))
            digest.update(content)
        semantic_header_digest = digest.hexdigest()
        previous = semantic_header_cache.read_text().strip() if semantic_header_cache.exists() else None
        semantic_header_changed = previous != semantic_header_digest
    objects = []
    def compile_one(index_path):
        i, path = index_path
        obj = objdir / (str(i).zfill(3) + "-" + path.stem + ".o")
        objects.append(obj)
        if not obj.exists() or obj.stat().st_mtime < path.stat().st_mtime or (semantic_header_changed and path in semantic_sources):
            run(emcc + flags + ["-c", path, "-o", obj], env=env, log=obj.with_suffix(".log"))
        print(f"Compiled {i + 1}/{len(paths)} {path.name}", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as pool:
        list(pool.map(compile_one, enumerate(paths)))
    if semantic_header_digest:
        semantic_header_cache.write_text(semantic_header_digest + "\n", encoding="ascii")
    exports = ["_main", "_shim_graphics_set_callback", "_repopulate_perminvent", "_malloc", "_free"]
    exports.append("_nh_input_layout")
    if semantic_text:
        exports.append("_nh_abi_semantic_event")
    exports += ["_nh_abi_" + name for name in ["anything_size", "menu_item_size", "menu_item_offset", "menu_count_offset", "menu_flags_offset",
                "getlin_buffer_size", "glyph_value", "glyph_utf8", "extcmd_count", "extcmd_name", "extcmd_description", "extcmd_flags", "state_json",
                "layout_json", "readfile", "set_yn_number", "state_checksum", "world_checksum", "rng_checksum", "input_layout", "input_state", "setenv"]]
    if rust_lib:
        objects.append(rust_lib)
        exports += ["_nh_rust_" + name for name in ["abi_version", "default_locale", "keycode", "direction", "direction_pad", "text_insert", "format", "format_fallback", "save_wrap", "save_unwrap"]]
        if semantic_text:
            exports += ["_nh_rust_format_gameplay", "_nh_rust_format_gameplay_fallback"]
    runtime = ["ccall", "cwrap", "callMain", "FS", "IDBFS", "ENV", "UTF8ToString", "stringToUTF8", "lengthBytesUTF8", "getValue", "setValue", "addFunction", "removeFunction", "HEAPU8", "HEAP8", "HEAP32", "HEAPU32"]
    out = BUILD / "nethack.js"
    command = emcc + sorted(objects) + ["-O2", "-sASYNCIFY", '-sASYNCIFY_IMPORTS=["local_callback"]',
              "-sERROR_ON_UNDEFINED_SYMBOLS=0",
              "-sASYNCIFY_STACK_SIZE=1048576", "-sSTACK_SIZE=4194304", "-sINITIAL_MEMORY=67108864",
              "-sALLOW_MEMORY_GROWTH", "-sALLOW_TABLE_GROWTH", "-sMODULARIZE", "-sEXPORT_ES6", "-sEXPORT_NAME=createNetHackModule",
              "-sEXPORTED_FUNCTIONS=" + json.dumps(exports), "-sEXPORTED_RUNTIME_METHODS=" + json.dumps(runtime),
              "-sENVIRONMENT=web,node", "-sEXIT_RUNTIME=1", "-lidbfs.js", "--embed-file", str(data) + "@/", "-o", out]
    print("Linking full official engine", flush=True)
    output = run(command, env=env, log=BUILD / "link.log")
    if "undefined symbol:" in output:
        raise RuntimeError("Engine link has unresolved runtime symbols; artifacts are not validated")
    return paths, command


def verify_data(sdk, env, data, files):
    """Read every embedded asset through the unchanged official WASM DLB reader."""
    emcc = [sdk / "python" / "3.13.3_64bit" / "python.exe", sdk / "upstream" / "emscripten" / "emcc.py"]
    probe = BUILD / "data-probe.cjs"
    flags = ["-O2", "-DDLB", "-DCROSSCOMPILE", "-DCROSSCOMPILE_TARGET", "-DCROSS_TO_WASM", "-I" + str(SOURCE / "include")]
    sources = [ROOT / "tools" / "build-upstream-data-probe.c"] + [utility_source("src/" + name + ".c") for name in ["dlb", "alloc", "hacklib"]] + [utility_source("util/panic.c")]
    run(emcc + flags + sources + ["--embed-file", str(data) + "@/", "-sENVIRONMENT=node", "-o", probe],
        env=env, log=BUILD / "data-probe-build.log")
    output = run([env["EMSDK_NODE"], probe] + files, cwd=ROOT, env=env, log=BUILD / "data-probe.log")
    if not output.startswith("DLB init=1 filename=nhdat\n"):
        raise RuntimeError("WASM data probe did not initialize the official UNIX DLB archive")
    results = {}
    for line in output.splitlines()[1:]:
        name, size, checksum = line.split("\t")
        expected = (SOURCE / "dat" / name).read_bytes()
        hash_value = 2166136261
        for byte in expected:
            hash_value = ((hash_value ^ byte) * 16777619) & 0xffffffff
        if int(size) != len(expected) or int(checksum) != hash_value:
            raise RuntimeError(f"Official WASM DLB read differs from source data: {name}")
        results[name] = {"bytes": int(size), "fnv1a32": int(checksum)}
    if set(results) != set(files):
        raise RuntimeError("WASM data probe did not verify all packaged assets")
    (BUILD / "data-probe.json").write_text(json.dumps({"status": "passed", "archive": "/nhdat", "assets": results}, indent=2), encoding="utf-8")
    print(f"Verified {len(files)} complete assets through official WASM DLB reader", flush=True)


def main():
    global WORK, SOURCE, BUILD, PHASE4_MODE
    parser = argparse.ArgumentParser()
    parser.add_argument("--sdk", type=Path, default=Path(r"C:\Users\kit\emsdk"))
    parser.add_argument("--jobs", type=int, default=4)
    parser.add_argument("--rust-lib", type=Path)
    parser.add_argument("--skip-native", action="store_true")
    parser.add_argument("--prepare-only", action="store_true", help="Verify and prepare preserved upstream/Lua sources without compiling")
    parser.add_argument("--semantic-text", action="store_true", help="Opt in to source-selected typed semantic producers and additive Rust formatter")
    parser.add_argument("--phase4-semantic-text", action="store_true", help="Prepare/build phase4/5 in isolated work/phase4 and build/phase4; current runtime stays untouched")
    args = parser.parse_args()
    if args.jobs < 1:
        parser.error("--jobs must be at least 1")
    if args.phase4_semantic_text:
        PHASE4_MODE = True
        args.semantic_text = True
        WORK = ROOT / "work" / "phase4"
        SOURCE = WORK / "NetHack-5.0.0"
        BUILD = ROOT / "build" / "phase4"
    started = time.time()
    env = setup(args.sdk)
    # Task-local compiler limits; do not edit the SDK or global environment.
    env["EMCC_CORES"] = str(args.jobs)
    env["BINARYEN_CORES"] = str(args.jobs)
    if PHASE4_MODE and os.name == "nt":
        # Emscripten 6.0.8 batches libc inputs by 2 * EMCC_CORES. With one
        # core the child emcc expands a large response file, then sends all
        # sources directly to Clang/CreateProcess, exceeding Windows' limit.
        # Build SDK sources individually, still serially and task-locally.
        env["EMCC_BATCH_BUILD"] = "0"
    if args.jobs == 1:
        env["CARGO_PROFILE_RELEASE_CODEGEN_UNITS"] = "1"
    semantic_audit = None
    if args.semantic_text:
        generator = ROOT / "tools" / ("prepare-combined-semantic.py" if PHASE4_MODE else "instrument-semantic-text.py")
        spec = importlib.util.spec_from_file_location("nethack_semantic_instrumentation", generator)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if PHASE4_MODE:
            semantic_audit = module.prepare(AUDIT, WORK / "semantic-generated", SOURCE)
        else:
            semantic_audit = module.generate(ROOT / "locales" / "gameplay-core.metadata.json", AUDIT,
                                             WORK / "semantic-generated", SOURCE)
    elif (SOURCE / "src" / "nh-semantic.c").exists():
        raise RuntimeError("Working source contains semantic instrumentation; use --semantic-text or a fresh working copy")
    if args.prepare_only:
        print("Prepared checksum-verified upstream/Lua working source", flush=True)
        return
    if args.skip_native:
        dlb, host_env = WORK / "native" / "dlb.exe", dict(os.environ)
    else:
        dlb, host_env = native_utilities()
    target_options(args.sdk.resolve(), env)
    data, data_files = package_data(dlb, host_env)
    verify_data(args.sdk.resolve(), env, data, data_files)
    rust_lib = args.rust_lib.resolve() if args.rust_lib else ROOT / "rust" / "target" / "wasm32-unknown-emscripten" / "release" / "libnethack_layers.a"
    if not rust_lib.exists() or (args.semantic_text and not args.rust_lib):
        cargo = Path.home() / ".cargo" / "bin" / "cargo.exe"
        run([cargo, "build", "--offline", "--locked", "--release", "--jobs", str(args.jobs), "--target", "wasm32-unknown-emscripten"], cwd=ROOT / "rust", env=env,
            log=BUILD / "rust-build.log")
    paths, command = engine(args.sdk.resolve(), env, data, args.jobs, rust_lib, args.semantic_text)
    provenance = {"version": "5.0.0", "commit": COMMIT, "lua_version": "5.4.8", "lua_sha256": LUA_SHA256,
                  "data_files": data_files, "data_archive": "/nhdat", "compiled_sources": [str(p.relative_to(SOURCE)) for p in paths],
                  "duration_seconds": round(time.time() - started, 2), "compile_jobs": args.jobs,
                  "compiler_limits": {"EMCC_CORES": env["EMCC_CORES"], "BINARYEN_CORES": env["BINARYEN_CORES"], "cargo_jobs": args.jobs},
                  "rust_library": {"sha256": hashlib.sha256(rust_lib.read_bytes()).hexdigest(), "bytes": rust_lib.stat().st_size},
                  "link_command": [str(x) for x in command],
                  "artifacts": {p.name: {"bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
                                for p in BUILD.glob("nethack.*")}}
    if semantic_audit:
        provenance["semantic_producer"] = {"compiled": True, "runtime_tested": False,
            "base_message_ids": semantic_audit["base_message_ids"], "producer_sites": semantic_audit["producer_sites"],
            "quest_display_ids": semantic_audit["quest"]["display_ids"],
            "quest_history_only_ids": semantic_audit["quest"]["history_only_ids"],
            "public_name_hooks": semantic_audit["public_names"]["producer"],
            "public_object_hooks": len(semantic_audit["public_objects"]["hooks"]),
            "metadata_sha256": semantic_audit["metadata_sha256"], "unhandled_contracts": semantic_audit["unhandled_contracts"]}
        if PHASE4_MODE:
            prepared_catalog = WORK / "semantic-generated" / "catalog.json"
            provenance["semantic_producer"]["phase4"] = {**semantic_audit["phase4"], "compiled": True, "runtime_verified": False,
                "catalog_sha256": hashlib.sha256(prepared_catalog.read_bytes()).hexdigest(), "catalog_bytes": prepared_catalog.stat().st_size,
                "fetch_path": "gameplay-core.json", "source_manifest_sha256": hashlib.sha256((WORK / "semantic-generated" / "source-manifest.json").read_bytes()).hexdigest()}
    if args.jobs == 1:
        provenance["compiler_limits"]["CARGO_PROFILE_RELEASE_CODEGEN_UNITS"] = "1"
    if PHASE4_MODE and os.name == "nt":
        provenance["compiler_limits"]["EMCC_BATCH_BUILD"] = "0"
    (BUILD / "engine-provenance.json").write_text(json.dumps(provenance, indent=2), encoding="utf-8")
    (BUILD / "engine-manifest.json").write_text(json.dumps(provenance, indent=2), encoding="utf-8")
    changes = []
    for p in SOURCE.rglob("*"):
        if not p.is_file() or "lib" in p.relative_to(SOURCE).parts:
            continue
        upstream = AUDIT / p.relative_to(SOURCE)
        if not upstream.exists() or p.read_bytes() != upstream.read_bytes():
            changes.append({"path": str(p.relative_to(SOURCE)).replace("\\", "/"), "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                            "status": "modified" if upstream.exists() else "generated", "date": "2026-10-02"})
    (BUILD / "source-changes.json").write_text(json.dumps(changes, indent=2), encoding="utf-8")
    # Install the local HTML runtime only after all real engine/data/link checks.
    # No hosting, deployment or shared repository operation is performed.
    local_web = BUILD / "web" if PHASE4_MODE else ROOT / "web"
    if PHASE4_MODE:
        shutil.copytree(ROOT / "web", local_web, dirs_exist_ok=True)
    runtime = local_web / "engine"
    runtime.mkdir(parents=True, exist_ok=True)
    for filename in ("nethack.js", "nethack.wasm"):
        shutil.copyfile(BUILD / filename, runtime / filename)
        if hashlib.sha256((runtime / filename).read_bytes()).hexdigest() != provenance["artifacts"][filename]["sha256"]:
            raise RuntimeError(f"Local runtime copy differs: {filename}")
    if args.semantic_text:
        catalog = WORK / "semantic-generated" / "catalog.json" if PHASE4_MODE else ROOT / "locales" / "gameplay-core.json"
        shutil.copyfile(catalog, local_web / "gameplay-core.json")
        if (local_web / "gameplay-core.json").read_bytes() != catalog.read_bytes():
            raise RuntimeError("Local gameplay catalog differs from the compiled producer catalog")
    print(json.dumps(provenance["artifacts"], indent=2), flush=True)


if __name__ == "__main__":
    main()
