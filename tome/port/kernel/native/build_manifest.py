"""Build the explicit original Premake source inventory with the existing SDK.

This is a measured baseline, not yet a production browser platform adapter.
Original POSIX selectors preserve upstream branches for the compile/link probe.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parent
PLAN = ROOT.parent / "build-plan-work/output/sources-ready.json"
EMSDK = Path(r"C:\Users\kit\emsdk\upstream\emscripten")

def build(unit):
    output = ROOT / "full-build" / unit["objectRelative"]
    output.parent.mkdir(parents=True, exist_ok=True)
    name = unit["source"].replace("/", "__")
    log_path = ROOT / "logs" / (name + ".full.txt")
    compiler = EMSDK / ("em++.exe" if unit["compiler"] == "em++" else "emcc.exe")
    command = [str(compiler), "-c", unit["sourceAbsolute"], "-o", str(output), "-O1"]
    if unit["compiler"] != "em++": command += ["-fgnu89-inline"]
    else: command += ["-std=c++11"]
    command += ["-I"+p for p in unit["includes"]]
    command += ["-D"+p for p in unit["defines"]+unit["browserProbeDefines"]+unit["wasmPlatformDefines"]]
    command += ["-DTE4_LUA_ALLOW_GENERIC_IO"]
    command += unit["portFlags"]
    command += ["-Wno-implicit-function-declaration", "-Wno-incompatible-pointer-types", "-Wno-int-conversion", "-Wno-static-in-inline"]
    started = time.time()
    result = subprocess.run(command, capture_output=True, text=True)
    log_path.write_text(result.stdout+result.stderr, encoding="utf-8")
    record = {"source":unit["source"], "project":unit["project"], "sourceSHA256":hashlib.sha256(Path(unit["sourceAbsolute"]).read_bytes()).hexdigest(), "exit":result.returncode,"elapsed":round(time.time()-started,2),"object":str(output),"log":str(log_path),"command":command}
    print(json.dumps({k:record[k] for k in ("source","exit","elapsed")}), flush=True)
    if result.returncode: print((result.stdout+result.stderr)[-2400:], flush=True)
    return record

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--jobs", type=int, default=3)
    parser.add_argument("--link", action="store_true")
    args = parser.parse_args()
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    units = plan["objectPlan"]
    ROOT.joinpath("logs").mkdir(exist_ok=True)
    results = [build(units[0])] # Build any SDK port variants once before parallel compiles.
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = [pool.submit(build, unit) for unit in units[1:]]
        for future in as_completed(futures): results.append(future.result())
    results.sort(key=lambda r:r["source"])
    report = {"sourceCount":len(units),"compiled":sum(r["exit"]==0 for r in results),"units":results}
    (ROOT / "full-build-results.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps({"sourceCount":report["sourceCount"],"compiled":report["compiled"]}),flush=True)
    if args.link and report["compiled"]==len(units):
        command = [str(EMSDK / "em++.exe"), *[r["object"] for r in results], "-O1", "-sUSE_SDL=2", "-sUSE_SDL_IMAGE=2", '-sSDL2_IMAGE_FORMATS=["png"]', "-sUSE_SDL_TTF=2", "-sUSE_LIBPNG=1", "-sUSE_VORBIS=1", "-sLEGACY_GL_EMULATION=1", "-sALLOW_MEMORY_GROWTH=1", "-sFORCE_FILESYSTEM=1", "-sSTACK_SIZE=8388608", "-o", str(ROOT / "full-build/original-kernel.mjs")]
        start=time.time()
        result=subprocess.run(command,capture_output=True,text=True)
        (ROOT / "logs/full-link.txt").write_text(result.stdout+result.stderr,encoding="utf-8")
        (ROOT / "full-link-results.json").write_text(json.dumps({"exit":result.returncode,"elapsed":round(time.time()-start,2),"command":command},indent=2),encoding="utf-8")
        print("LINK_EXIT="+str(result.returncode),flush=True)
        print((result.stdout+result.stderr)[-7000:],flush=True)

if __name__ == "__main__": main()
