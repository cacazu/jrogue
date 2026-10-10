"""Exercise named RNG banks with the real retained Lua/SFMT/musl callbacks.

The callback helpers are copied from the reviewed original characterization
fixture. No game, particle, random algorithm, or native callback is mocked.
Run this single sequential recipe through monitor_native_job.py.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent
WORK = ROOT.parent
BINDINGS = WORK / "kernel-bindings-work"
PHASES = WORK / "particle-platform-work"
SOURCE = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
SDK = Path(r"C:\Users\kit\emsdk\upstream\emscripten")
NODE = Path(r"C:\Program Files\nodejs\node.exe")

TEST_MAIN = r'''
static uint64_t mixed_draw(lua_State *state, unsigned int index) {
    return index % 4 == 0 ? original_math_draw(state,index) : original_draw(state,index);
}
static void phase_draws(lua_State *state, unsigned int index, unsigned int count) {
    CHECK(tome_rng_phase_enter_visual_at_barrier());
    CHECK(tome_rng_phase_activity_begin(TOME_RNG_VISUAL));
    for (unsigned int n=0;n<count;n++) (void)mixed_draw(state,index+n);
    CHECK(tome_rng_phase_activity_end(TOME_RNG_VISUAL));
    CHECK(tome_rng_phase_leave_visual_at_barrier());
}
int main(void) {
    lua_State *state=luaL_newstate();
    CHECK(state != NULL);
    CHECK(tome_test_open_original_rng(state));
    CHECK(luaopen_math(state)==1);
    lua_settop(state,0);
    seed_original(state,176);
    seed_original_math(state,176);
    /* Keep an odd Box-Muller spare at the initial bank split. */
    (void)original_draw(state,0);
    CHECK(tome_rng_phases_initialize_at_barrier());
    CHECK(!tome_rng_phases_initialize_at_barrier());
    CHECK(tome_rng_phase_snapshot_size()==5208);
    uint8_t checkpoint[5208], after[5208], corrupt[5208];
    CHECK(tome_rng_phase_snapshot_write_at_barrier(checkpoint,sizeof checkpoint));
    CHECK(tome_rng_phase_snapshot_validate(checkpoint,sizeof checkpoint));
    CHECK(tome_rng_phase_snapshot_write_at_barrier(after,sizeof after));
    CHECK(memcmp(checkpoint,after,sizeof after)==0);

    uint64_t expected[1000], expected_visual[1000];
    CHECK(tome_rng_phase_activity_begin(TOME_RNG_GAMEPLAY));
    for (unsigned int n=0;n<1000;n++) expected[n]=mixed_draw(state,n);
    CHECK(tome_rng_phase_activity_end(TOME_RNG_GAMEPLAY));
    CHECK(tome_rng_phase_snapshot_restore_at_barrier(checkpoint,sizeof checkpoint));
    for (unsigned int n=0;n<1000;n++) {
        /* Variable visual work exercises cached Gaussian and libc state too. */
        phase_draws(state,n*31,(n*13)%19);
        CHECK(tome_rng_phase_activity_begin(TOME_RNG_GAMEPLAY));
        CHECK(mixed_draw(state,n)==expected[n]);
        CHECK(tome_rng_phase_activity_end(TOME_RNG_GAMEPLAY));
    }
    CHECK(tome_rng_phase_snapshot_write_at_barrier(after,sizeof after));
    CHECK(memcmp(checkpoint+32+2588,after+32+2588,2588)!=0);
    memcpy(checkpoint,after,sizeof checkpoint);
    /* Both banks must continue exactly after complete serialized restore. */
    CHECK(tome_rng_phase_activity_begin(TOME_RNG_GAMEPLAY));
    for (unsigned int n=0;n<1000;n++) expected[n]=mixed_draw(state,n+7000);
    CHECK(tome_rng_phase_activity_end(TOME_RNG_GAMEPLAY));
    CHECK(tome_rng_phase_enter_visual_at_barrier());
    CHECK(tome_rng_phase_activity_begin(TOME_RNG_VISUAL));
    for (unsigned int n=0;n<1000;n++) expected_visual[n]=mixed_draw(state,n+9000);
    CHECK(tome_rng_phase_activity_end(TOME_RNG_VISUAL));
    CHECK(tome_rng_phase_leave_visual_at_barrier());
    CHECK(tome_rng_phase_snapshot_restore_at_barrier(checkpoint,sizeof checkpoint));
    for (unsigned int n=0;n<1000;n++) {
        CHECK(tome_rng_phase_activity_begin(TOME_RNG_GAMEPLAY));
        CHECK(mixed_draw(state,n+7000)==expected[n]);
        CHECK(tome_rng_phase_activity_end(TOME_RNG_GAMEPLAY));
        CHECK(tome_rng_phase_enter_visual_at_barrier());
        CHECK(tome_rng_phase_activity_begin(TOME_RNG_VISUAL));
        CHECK(mixed_draw(state,n+9000)==expected_visual[n]);
        CHECK(tome_rng_phase_activity_end(TOME_RNG_VISUAL));
        CHECK(tome_rng_phase_leave_visual_at_barrier());
    }
    CHECK(tome_rng_phase_snapshot_write_at_barrier(checkpoint,sizeof checkpoint));
    for (size_t n=0;n<sizeof checkpoint;n++) {
        memcpy(corrupt,checkpoint,sizeof corrupt);
        corrupt[n]^=0x80;
        CHECK(!tome_rng_phase_snapshot_restore_at_barrier(corrupt,sizeof corrupt));
        CHECK(tome_rng_phase_snapshot_write_at_barrier(after,sizeof after));
        CHECK(memcmp(checkpoint,after,sizeof after)==0);
    }
    CHECK(!tome_rng_phase_snapshot_restore_at_barrier(NULL,sizeof checkpoint));
    CHECK(!tome_rng_phase_snapshot_restore_at_barrier(checkpoint,sizeof checkpoint-1));
    CHECK(!tome_rng_phase_snapshot_restore_at_barrier(checkpoint,sizeof checkpoint+1));
    CHECK(tome_rng_phase_activity_begin(TOME_RNG_GAMEPLAY));
    CHECK(!tome_rng_phase_activity_begin(TOME_RNG_GAMEPLAY));
    CHECK(!tome_rng_phase_enter_visual_at_barrier());
    CHECK(!tome_rng_phase_snapshot_write_at_barrier(after,sizeof after));
    CHECK(!tome_rng_phase_activity_end(TOME_RNG_VISUAL));
    CHECK(tome_rng_phase_activity_end(TOME_RNG_GAMEPLAY));
    CHECK(tome_rng_phase_current()==TOME_RNG_GAMEPLAY);
    CHECK(tome_rng_phase_activity_count()==0);
    CHECK(tome_rng_phase_snapshot_write_at_barrier(after,sizeof after));
    CHECK(memcmp(checkpoint,after,sizeof after)==0);
    lua_close(state);
    printf("actual original named RNG bank tests passed: %u assertions; irregular visual independence, both-bank continuation, 5208 atomic corruptions, reentry guards\n",assertions);
    return 0;
}
'''

def main():
    os.environ.setdefault("EMSDK_PYTHON",sys.executable)
    out=ROOT/"named-rng-test"
    out.mkdir(exist_ok=True)
    helpers=(BINDINGS/"test_original_gaussian.c").read_text(encoding="utf-8").split("static void save_components",1)[0]
    test=out/"test_named_rng_phases.c"
    test.write_text(helpers+'\n#include "tome_rng_phases.h"\n'+TEST_MAIN,encoding="utf-8")
    common=[str(SDK/"emcc.exe"),"-c","-O1","-std=c99","-Wall","-Wextra","-Werror"]
    common += ["-I"+str(SOURCE/"src/lua"),"-I"+str(BINDINGS),"-I"+str(ROOT),"-I"+str(PHASES)]
    results=[]
    def run(label,command):
        start=time.monotonic()
        result=subprocess.run(command,capture_output=True,text=True)
        (out/(label+".log")).write_text(result.stdout+result.stderr,encoding="utf-8")
        entry={"stage":label,"exit":result.returncode,"seconds":round(time.monotonic()-start,3),"tail":(result.stdout+result.stderr)[-3000:]}
        results.append(entry)
        (out/"results.json").write_text(json.dumps({"stages":results,"phase_source_sha256":hashlib.sha256((PHASES/"tome_rng_phases.c").read_bytes()).hexdigest()},indent=2),encoding="utf-8")
        print(json.dumps(entry),flush=True)
        if result.returncode: raise SystemExit(result.returncode)
    run("compile-phases",common+[str(PHASES/"tome_rng_phases.c"),"-o",str(out/"phases.o")])
    run("compile-test",common+[str(test),"-o",str(out/"test.o")])
    original=BINDINGS/"gaussian-test"
    objects=[out/"test.o",out/"phases.o"]+[original/p for p in ["core_lua_rng_state.o","tome_rng_snapshot.o","musl_rand_state.o","tome_combined_rng_snapshot.o"]]
    archives=[ROOT/"full-build/libluadefault.a",ROOT/"full-build/libphysfs.a"]
    module=out/"original_named_rng.mjs"
    run("link",[str(SDK/"emcc.exe"),*[str(p) for p in objects+archives],"-O1","-sMODULARIZE=1","-sEXPORT_ES6=1","-sENVIRONMENT=node","-sALLOW_MEMORY_GROWTH=1","-sSTACK_SIZE=8388608","-o",str(module)])
    runner=out/"run.mjs"
    runner.write_text("import createModule from './original_named_rng.mjs';\nawait createModule();\n",encoding="utf-8")
    run("actual-original-execution",[str(NODE),str(runner)])

if __name__=="__main__": main()
