"""Compile the unchanged upstream core as an explicit portability probe."""
import argparse
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parent
SOURCE = pathlib.Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
EMCC = pathlib.Path(r"C:\Users\kit\emsdk\upstream\emscripten\emcc.exe")
INCLUDES = ["src", "src/lua", "src/luasocket", "src/fov", "src/expat", "src/lxp", "src/libtcod_import", "src/physfs", "src/zlib", "src/bzip2"]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="*", default=["src/core_lua.c"])
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()
    ROOT.joinpath("objects").mkdir(exist_ok=True)
    ROOT.joinpath("logs").mkdir(exist_ok=True)
    results = []
    files = sorted(p.relative_to(SOURCE).as_posix() for p in (SOURCE / "src").glob("*.c")) if args.all else args.files
    for rel in files:
        name = rel.replace("/", "__")
        command = [str(EMCC), "-c", str(SOURCE / rel), "-o", str(ROOT / "objects" / (name + ".o")), "-O0", "-DGLEW_STATIC", "-DTE4CORE_VERSION=17", "-DTE4_LUA_ALLOW_GENERIC_IO", "-DSELFEXE_LINUX", "-D_GNU_SOURCE", '-DTENGINE_HOME_PATH=".t-engine"', "-sUSE_SDL=2", "-sUSE_SDL_IMAGE=2", "-sUSE_SDL_TTF=2", "-sUSE_LIBPNG=1", "-sUSE_VORBIS=1", "-Wno-implicit-function-declaration", "-Wno-incompatible-pointer-types", "-Wno-int-conversion"]
        command += ["-I" + str(SOURCE / directory) for directory in INCLUDES]
        start = time.time()
        run = subprocess.run(command, capture_output=True, text=True)
        log = run.stdout + run.stderr
        (ROOT / "logs" / (name + ".txt")).write_text(log, encoding="utf-8")
        results.append({"source":rel, "exit":run.returncode, "elapsed":round(time.time()-start,2), "command":command, "log":str(ROOT / "logs" / (name + ".txt"))})
        print(json.dumps(results[-1]), flush=True)
        print(log[-6000:], flush=True)
    (ROOT / "probe-results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
