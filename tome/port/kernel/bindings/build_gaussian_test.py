"""Build/run actual original rnglib characterization; launch after memory hold.

The generated test overlay is separate from the production overlay. Link only
unchanged upstream Lua/PhysFS archives and the original SFMT snapshot wrapper.
Unreferenced display callbacks are removed by the ordinary wasm linker, never
replaced with gameplay or display mock symbols.
"""
import json
from pathlib import Path
import subprocess
import time
from make_core_state_overlay import generate

ROOT = Path(__file__).resolve().parent
SOURCE = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
SDK = Path(r"C:\Users\kit\emsdk\upstream\emscripten")
NATIVE = ROOT.parent / "native-core-work"
NODE = Path(r"C:\Program Files\nodejs\node.exe")


def main():
    output = ROOT / "gaussian-test"
    generate(SOURCE / "src/core_lua.c", output)
    includes = ["src", "src/lua", "src/luasocket", "src/fov", "src/expat", "src/lxp", "src/libtcod_import", "src/physfs", "src/zlib", "src/bzip2"]
    common = [str(SDK / "emcc.exe"), "-c", "-O0", "-DGLEW_STATIC", "-DTE4CORE_VERSION=17", "-DTE4_LUA_ALLOW_GENERIC_IO", "-DSELFEXE_LINUX", "-D_GNU_SOURCE", '-DTENGINE_HOME_PATH=".t-engine"', "-sUSE_SDL=2", "-sUSE_SDL_IMAGE=2", "-sUSE_SDL_TTF=2", "-sUSE_LIBPNG=1", "-sUSE_VORBIS=1", "-Wno-implicit-function-declaration", "-Wno-incompatible-pointer-types", "-Wno-int-conversion"]
    common += ["-I" + str(SOURCE / item) for item in includes] + ["-I" + str(ROOT), "-I" + str(NATIVE)]
    results = []
    def run(label, command):
        start = time.monotonic()
        process = subprocess.run(command, capture_output=True, text=True)
        log = output / (label + ".log")
        log.write_text(process.stdout + process.stderr, encoding="utf-8")
        result = {"stage": label, "exit_code": process.returncode, "elapsed_seconds": round(time.monotonic() - start, 2), "command": [str(value) for value in command], "log": str(log), "output_tail": (process.stdout + process.stderr)[-4000:]}
        results.append(result)
        (output / "results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result), flush=True)
        if process.returncode:
            raise SystemExit(process.returncode)
    core = output / "core_lua_rng_state.o"
    sfmt = output / "tome_rng_snapshot.o"
    libc = output / "musl_rand_state.o"
    combined = output / "tome_combined_rng_snapshot.o"
    test = output / "test_original_gaussian.o"
    run("compile-original-rnglib", common + ["-DTOME_RNG_CHARACTERIZATION", str(output / "core_lua_rng_state.c"), "-o", str(core)])
    run("compile-original-sfmt", common + [str(NATIVE / "tome_rng_snapshot.c"), "-o", str(sfmt)])
    run("compile-original-libc", common + [str(ROOT / "generated/musl_rand_state.c"), "-o", str(libc)])
    run("compile-combined-boundary", common + ["-std=c99", "-Wall", "-Wextra", "-Werror", str(ROOT / "tome_combined_rng_snapshot.c"), "-o", str(combined)])
    run("compile-test", common + ["-std=c99", "-Wall", "-Wextra", "-Werror", str(ROOT / "test_original_gaussian.c"), "-o", str(test)])
    module = output / "original_gaussian.mjs"
    run("link-test", [str(SDK / "emcc.exe"), str(test), str(core), str(sfmt), str(libc), str(combined), str(NATIVE / "full-build/libluadefault.a"), str(NATIVE / "full-build/libphysfs.a"), "-O0", "-sMODULARIZE=1", "-sEXPORT_ES6=1", "-sENVIRONMENT=node", "-sALLOW_MEMORY_GROWTH=1", "-sSTACK_SIZE=8388608", "-o", str(module)])
    runner = output / "run.mjs"
    runner.write_text("import createModule from './original_gaussian.mjs';\nawait createModule();\n", encoding="utf-8")
    run("execute-test", [str(NODE), str(runner)])


if __name__ == "__main__":
    main()
