"""Compile the retained source seams and link the actual browser bootstrap.

Run through monitor_native_job.py after a fresh measured resource admission.
This recipe intentionally fails on unresolved symbols; a successful link must
still pass real original-game browser boot.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parent

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--emsdk",default=r"C:\Users\kit\emsdk\upstream\emscripten")
    parser.add_argument("--baseline-work",type=Path,default=ROOT)
    args=parser.parse_args()
    sdk=Path(args.emsdk)
    # Keep the official pylauncher from activating a WindowsApps alias outside
    # the owned process job. This affects this recipe's descendants only.
    os.environ.setdefault("EMSDK_PYTHON",sys.executable)
    work=ROOT.parent
    bindings=work/("kernel-bindings-work" if (work/"kernel-bindings-work").exists() else "bindings")
    build_plan=work/("build-plan-work" if (work/"build-plan-work").exists() else "build-plan")
    graphics=build_plan/"graphics-adapter"
    serial=work/("serial-platform-work" if (work/"serial-platform-work").exists() else "serial")
    particles=work/("particle-platform-work" if (work/"particle-platform-work").exists() else "particles")
    save=work/("save-resume-work" if (work/"save-resume-work").exists() else "save")
    mechanics=work/("mechanics-audit-work" if (work/"mechanics-audit-work").exists() else "mechanics")
    rust=work/"rust-kernel-adapter-work" if (work/"rust-kernel-adapter-work").exists() else work.parent/"retained"
    semantic=work/"localization-wasm-work" if (work/"localization-wasm-work").exists() else work.parent/"localization/wasm"
    plan=json.loads((build_plan/"output/sources-ready.json").read_text(encoding="utf-8"))
    report=json.loads((args.baseline_work/"full-build-results.json").read_text(encoding="utf-8"))
    if report["compiled"]!=127: raise SystemExit("Expected all 127 unchanged units compiled first")
    out=ROOT/"browser-build"
    out.mkdir(exist_ok=True)
    common=next(p for p in plan["objectPlan"] if p["project"]=="TEngine")
    flags=["-O1","-fgnu89-inline","-Wno-static-in-inline","-Wno-implicit-function-declaration","-Wno-incompatible-pointer-types","-Wno-int-conversion"]
    flags += ["-I"+p for p in common["includes"]]
    flags += ["-I"+str(bindings),"-I"+str(bindings/"generated"),"-I"+str(ROOT),"-I"+str(save),"-I"+str(particles)]
    flags += ["-D"+p for p in common["defines"]+common["browserProbeDefines"]]
    flags += ["-DTE4_LUA_ALLOW_GENERIC_IO"] + common["portFlags"]
    seams=[
        (bindings/"generated/main_platform_state.c",["-Dmain=tome_desktop_main"]),
        (bindings/"generated/core_lua_rng_state.c",[]),
        (ROOT/"tome_rng_snapshot.c",[]),
        (bindings/"generated/musl_rand_state.c",[]),
        (bindings/"tome_combined_rng_snapshot.c",[]),
        (bindings/"retained_registry.c",[]),
        (bindings/"retained_platform_drain.c",[]),
        (ROOT/"native_browser_init.c",[]),
        (serial/"serial_browser.c",[]),
        (semantic/"native/native_semantic_resolver.c",[]),
        (particles/"tome_rng_phases.c",[]),
        (save/"checkpoint_gate.c",[]),
        (save/"rng_sidecar.c",[]),
        (rust/"lua/native_ui_exports.c",[]),
        (mechanics/"ui-roundtrip/native_yesno_roundtrip.c",[]),
        (graphics/"tome_graphics_adapter.c",[]),
        (graphics/"tome_glu_quadric.c",[]),
    ]
    compiled=[]
    seam_sources=[]
    for source,extra in seams:
        if not source.is_file(): raise SystemExit("Missing reviewed adapter: "+str(source))
        target=out/(source.stem+".o")
        command=[str(sdk/"emcc.exe"),"-c",str(source),"-o",str(target),*flags,*extra]
        result=subprocess.run(command,capture_output=True,text=True)
        (out/(source.stem+".log")).write_text(result.stdout+result.stderr,encoding="utf-8")
        print(json.dumps({"source":str(source),"exit":result.returncode}),flush=True)
        if result.returncode: raise SystemExit(result.stderr)
        compiled.append(str(target))
        seam_sources.append({"source":str(source),"sha256":hashlib.sha256(source.read_bytes()).hexdigest(),"object":str(target)})
    original=[u["object"] for u in report["units"] if u["project"]=="TEngine" and u["source"] not in {"src/SFMT.c","src/core_lua.c","src/main.c","src/serial.c"}]
    archives=sorted(str(p) for p in (args.baseline_work/"full-build").glob("lib*.a"))
    if len(archives)!=15: raise SystemExit("Build the 15 original project archives with link_original.py first")
    command=[str(sdk/"em++.exe"),*original,*compiled,*archives,"-O1","--no-entry","-Wl,--wrap=glewInit","-Wl,--wrap=glTexImage2D","-Wl,--wrap=glTexSubImage2D","-Wl,--threads=1","-sMODULARIZE=1","-sEXPORT_ES6=1","-sLEGACY_GL_EMULATION=1","-sALLOW_MEMORY_GROWTH=1","-sFORCE_FILESYSTEM=1","-sSTACK_SIZE=8388608",'-sEXPORTED_RUNTIME_METHODS=["ccall","cwrap","UTF8ToString","lengthBytesUTF8","stringToUTF8","FS","NODEFS","IDBFS"]',"-lnodefs.js","-lidbfs.js","-sENVIRONMENT=web,node",*common["portFlags"],"-o",str(out/"tome-native.mjs")]
    result=subprocess.run(command,capture_output=True,text=True)
    (out/"link.log").write_text(result.stdout+result.stderr,encoding="utf-8")
    artifacts=[]
    if not result.returncode:
        for target in [out/"tome-native.mjs",out/"tome-native.wasm"]:
            data=target.read_bytes()
            artifacts.append({"file":str(target),"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()})
    (out/"link-result.json").write_text(json.dumps({"exit":result.returncode,"command":command,"seam_sources":seam_sources,"artifacts":artifacts,"full_game_boot_verified":False},indent=2),encoding="utf-8")
    print("LINK_EXIT="+str(result.returncode),flush=True)
    if result.returncode: raise SystemExit(result.stderr)

if __name__=="__main__": main()
