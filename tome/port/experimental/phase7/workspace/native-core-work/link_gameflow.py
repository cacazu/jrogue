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
    parser.add_argument("--profile",choices=("retained", "physical-input", "physical-input-compat", "physical-input-compat-regression", "physical-input-compat-resize", "physical-input-compat-textbox", "physical-input-compat-game-flow", "prepared-map"),default="retained")
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
    profile=args.profile
    out=ROOT/("browser-build" if profile=="retained" else profile+"-build")
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
    if profile.startswith("physical-input"):
        physical=work/"rust-platform-input-work"
        generated=physical/"generated/main_physical_state.c"
        proof=json.loads(generated.with_suffix(".provenance.json").read_text(encoding="utf-8"))
        if not proof.get("original_switch_byte_identical") or hashlib.sha256(generated.read_bytes()).hexdigest()!=proof.get("generated_sha256"):
            raise SystemExit("Physical input requires the verified original switch extraction")
        flags += ["-I"+str(physical/"native")]
        seams[0]=(generated,["-Dmain=tome_desktop_main"])
        if profile in ("physical-input-compat-textbox", "physical-input-compat-game-flow"):
            candidate=physical/"audit-new/textbox-native-candidate"
            flags += ["-I"+str(candidate)]
            derivative=ROOT/"textbox-focus-generated/physical_input.c"
            focus_proof=json.loads((derivative.parent/"manifest.json").read_text())
            if not focus_proof["reverse_byte_equality"] or hashlib.sha256(derivative.read_bytes()).hexdigest()!=focus_proof["derivative_sha256"]: raise SystemExit("Textbox focus source guard failed")
            seams += [(derivative,[]),(candidate/"tome_nested_focus.c",[]),(candidate/"tome_textbox_native.c",[])]
        else:
            seams.append((physical/"native/physical_input.c",[]))
        if profile.startswith("physical-input-compat"):
            seams.append((physical/"audit-new/tome_planar_client_array_refresh.c",[]))
        if profile=="physical-input-compat-regression":
            seams.append((ROOT/"planar_client_array_regression.c",[]))
        if profile in ("physical-input-compat-resize","physical-input-compat-textbox","physical-input-compat-game-flow"):
            seams.append((physical/"audit-new/resize-candidate/tome_display_contract.c",[]))
        if profile=="physical-input-compat-game-flow":
            seams.append((physical/"audit-new/game-flow-native-candidate/tome_game_flow_native.c",[]))
        # The original authored checkpoint gate must also reject a live
        # physical transaction. Keep this derivative inside the variant only.
        gate_source=save/"checkpoint_gate.c"
        gate=gate_source.read_bytes()
        baseline_link=json.loads((ROOT/"browser-build/link-result.json").read_text(encoding="utf-8"))
        expected_gate=next(row["sha256"] for row in baseline_link["seam_sources"]
                           if Path(row["source"]).name=="checkpoint_gate.c")
        if hashlib.sha256(gate).hexdigest()!=expected_gate:
            raise SystemExit("Physical gate must derive from the verified baseline checkpoint source")
        anchor=b"static int acquire(lua_State *L) {"
        condition=b"int ok = !current_mode && valid_generation(generation) &&"
        if gate.count(anchor)!=1 or gate.count(condition)!=1:
            raise SystemExit("Physical checkpoint exclusion requires exact gate anchors")
        derived=gate.replace(anchor,b"extern int tome_physical_busy(void);\n"+anchor,1)
        derived=derived.replace(condition,b"int ok = !current_mode && !tome_physical_busy() && valid_generation(generation) &&",1)
        gate_target=physical/"generated/checkpoint_gate_physical.c"
        gate_target.write_bytes(derived)
        (physical/"generated/checkpoint-gate-provenance.json").write_text(json.dumps({
            "base_sha256":hashlib.sha256(gate).hexdigest(),"derived_sha256":hashlib.sha256(derived).hexdigest(),
            "scope":"Additive mutual exclusion only; shared/default source unchanged"},indent=2),encoding="utf-8")
        seams=[(gate_target,extra) if source==gate_source else (source,extra) for source,extra in seams]
    if profile=="prepared-map":
        capture=mechanics/"prepared-map"
        generated=capture/"generated/map_capture.c"
        proof=json.loads((capture/"map-capture-provenance.json").read_text(encoding="utf-8"))
        if not proof.get("reversal_recovers_input_bytes") or hashlib.sha256(generated.read_bytes()).hexdigest()!=proof.get("generated_sha256"):
            raise SystemExit("Prepared map requires the reversible original observer source")
        flags += ["-I"+str(capture)]
        seams += [(generated,[]),(capture/"tome_prepared_map_capture.c",[]),(capture/"native_prepared_map_exports.c",[])]
    if profile != "retained":
        # Read the original swallowed-error queue without consuming it. A draw
        # return value alone is not evidence that original Lua display passed.
        seams.append((mechanics/"prepared-map/integration-web/native_frame_error_observer.c",[]))
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
    replaced={"src/SFMT.c","src/core_lua.c","src/main.c","src/serial.c"}
    if profile=="prepared-map":replaced.add("src/map.c")
    original=[u["object"] for u in report["units"] if u["project"]=="TEngine" and u["source"] not in replaced]
    archives=sorted(str(p) for p in (args.baseline_work/"full-build").glob("lib*.a"))
    if len(archives)!=15: raise SystemExit("Build the 15 original project archives with link_original.py first")
    runtime=["ccall","cwrap","UTF8ToString","lengthBytesUTF8","stringToUTF8","FS","NODEFS","IDBFS"]
    if profile != "retained": runtime.append("HEAPU8")
    command=[str(sdk/"em++.exe"),*original,*compiled,*archives,"-O1","--no-entry","-Wl,--wrap=glewInit","-Wl,--wrap=glTexImage2D","-Wl,--wrap=glTexSubImage2D","-Wl,--threads=1","-sMODULARIZE=1","-sEXPORT_ES6=1","-sLEGACY_GL_EMULATION=1","-sALLOW_MEMORY_GROWTH=1","-sFORCE_FILESYSTEM=1","-sSTACK_SIZE=8388608","-sEXPORTED_RUNTIME_METHODS="+json.dumps(runtime,separators=(",",":")),"-lnodefs.js","-lidbfs.js","-sENVIRONMENT=web,node",*common["portFlags"],"-o",str(out/"tome-native.mjs")]
    result=subprocess.run(command,capture_output=True,text=True)
    (out/"link.log").write_text(result.stdout+result.stderr,encoding="utf-8")
    artifacts=[]
    if not result.returncode:
        for target in [out/"tome-native.mjs",out/"tome-native.wasm"]:
            data=target.read_bytes()
            artifacts.append({"file":str(target),"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()})
    (out/"link-result.json").write_text(json.dumps({"exit":result.returncode,"profile":profile,"command":command,"seam_sources":seam_sources,"artifacts":artifacts,"full_game_boot_verified":False},indent=2),encoding="utf-8")
    print("LINK_EXIT="+str(result.returncode),flush=True)
    if result.returncode: raise SystemExit(result.stderr)

if __name__=="__main__": main()
