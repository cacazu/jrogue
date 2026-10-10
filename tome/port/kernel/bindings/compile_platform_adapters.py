"""Compile retained platform seams with real upstream and SDK headers."""
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parent
SOURCE = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
EMCC = Path(r"C:\Users\kit\emsdk\upstream\emscripten\emcc.exe")


def main():
    includes = ["src", "src/lua", "src/luasocket", "src/fov", "src/expat", "src/lxp", "src/libtcod_import", "src/physfs", "src/zlib", "src/bzip2"]
    common = [str(EMCC), "-c", "-O0", "-DGLEW_STATIC", "-DTE4CORE_VERSION=17", "-DTE4_LUA_ALLOW_GENERIC_IO", "-DSELFEXE_LINUX", "-D_GNU_SOURCE", '-DTENGINE_HOME_PATH=".t-engine"', "-sUSE_SDL=2", "-sUSE_SDL_IMAGE=2", "-sUSE_SDL_TTF=2", "-sUSE_LIBPNG=1", "-sUSE_VORBIS=1", "-Wno-implicit-function-declaration", "-Wno-incompatible-pointer-types", "-Wno-int-conversion"]
    common += ["-I" + str(SOURCE / item) for item in includes] + ["-I" + str(ROOT)]
    results = []
    for relative, extra in (("generated/main_platform_state.c", ["-Dmain=tome_desktop_main"]), ("retained_platform_drain.c", ["-std=c99", "-Wall", "-Wextra", "-Werror"])):
        source = ROOT / relative
        command = common + extra + [str(source), "-o", str(source.with_suffix(".o"))]
        start = time.monotonic()
        run = subprocess.run(command, capture_output=True, text=True)
        log = ROOT / (source.stem + "-compile.log")
        log.write_text(run.stdout + run.stderr, encoding="utf-8")
        result = {"source": str(source), "exit_code": run.returncode, "elapsed_seconds": round(time.monotonic()-start, 2), "command": command, "log": str(log)}
        results.append(result)
        print(json.dumps(result), flush=True)
        if run.returncode:
            print((run.stdout + run.stderr)[-6000:], flush=True)
    (ROOT / "platform-compile-results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    if any(item["exit_code"] for item in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
