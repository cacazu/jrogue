"""Generate a source-only cooperative scheduler around pristine ToME particles.

Does not compile, import upstream code, launch a game, or change upstream.
Only worker scheduling/lifecycle and checked initialization are substituted.
"""
import argparse
import hashlib
import json
from pathlib import Path

def sha(data):
    return hashlib.sha256(data).hexdigest()

def generate(upstream: Path, output: Path):
    raw = (upstream / "src/particles.c").read_bytes()
    header = (upstream / "src/particles.h").read_bytes()
    text = raw.decode("utf-8")
    newline = "\r\n" if "\r\n" in text else "\n"
    normalized = text.replace("\r\n", "\n")
    worker = "int thread_particles(void *data)\n{"
    if normalized.count(worker) != 1:
        raise ValueError("official worker anchor must occur exactly once")
    prefix = text[:text.index("int thread_particles(void *data)")]
    worker_text = normalized[normalized.index(worker):]
    init_start = worker_text.index("\tlua_State *L = lua_open();")
    init_end = worker_text.index("\n\tplist *prev;", init_start)
    initializer_original = worker_text[init_start:init_end]
    allocation = "\tlua_State *L = lua_open();  /* create state */"
    if initializer_original.count(allocation) != 1:
        raise ValueError("official Lua allocation anchor is absent or ambiguous")
    initializer = initializer_original.replace(
        allocation,
        "\tlua_State *L = lua_open();  /* create state */\n"
        "\tif (!L) { initializing_lane = NULL; return particle_platform_error(\"engine.particles.vm_allocation_failed\"); }\n"
        "\tpt->L = L;\n"
        "\tlua_atpanic(L, initialization_panic);", 1)
    load = '\tif (!luaL_loadfile(L, "/loader/pre-init.lua")) docall(L, 0, 0);\n\telse lua_pop(L, 1);'
    if initializer.count(load) != 1:
        raise ValueError("official pre-init load anchor is absent or ambiguous")
    initializer = initializer.replace(load,
        '\tif (luaL_loadfile(L, "/loader/pre-init.lua") || docall(L, 0, 0)) {\n'
        '\t\tlua_settop(L, 0);\n'
        '\t\tinitializing_lane = NULL;\n'
        '\t\treturn particle_platform_error("engine.particles.pre_init_failed");\n'
        '\t}', 1)
    loop = worker_text.index("\twhile (pt->running)")
    frame_start = worker_text.index("\t\tSDL_mutexP(pt->lock);", loop)
    frame_end = worker_text.index("\t\tSDL_mutexV(pt->lock);", frame_start)
    frame_end += len("\t\tSDL_mutexV(pt->lock);")
    frame_body = worker_text[frame_start:frame_end]
    add_start = normalized.index("void thread_add(particles_type *ps)\n{")
    add_end = normalized.index("\n// Runs on main thread\nvoid free_particles_thread", add_start)
    add_original = normalized[add_start:add_end]
    thread_add = add_original.replace("\n{\n", "\n{\n"
        "\tif (!threads || platform_failed) {\n"
        "\t\tparticle_platform_error(\"engine.particles.lane_not_ready\");\n"
        "\t\treturn;\n\t}\n", 1)
    tail = (output / "cooperative_tail.inc").read_text(encoding="utf-8")
    for marker, replacement in {
        "/*__ORIGINAL_WORKER_INITIALIZER__*/": initializer,
        "/*__ORIGINAL_KEYFRAME_BODY__*/": frame_body,
        "/*__ORIGINAL_THREAD_ADD__*/": thread_add,
    }.items():
        if tail.count(marker) != 1:
            raise ValueError("missing or repeated generation marker " + marker)
        tail = tail.replace(marker, replacement)
    emitted = prefix.encode("utf-8") + tail.replace("\r\n", "\n").replace("\n", newline).encode("utf-8")
    original = output / "original"
    generated = output / "generated"
    original.mkdir(parents=True, exist_ok=True)
    generated.mkdir(parents=True, exist_ok=True)
    (original / "particles.c").write_bytes(raw)
    (original / "particles.h").write_bytes(header)
    target = generated / "particles_cooperative.c"
    target.write_bytes(emitted)
    if not emitted.startswith(prefix.encode("utf-8")):
        raise AssertionError("original effect/helper prefix changed")
    report = {
        "source_version": "ToME / T-Engine 4 1.7.6",
        "source": str((upstream / "src/particles.c").resolve()),
        "source_sha256": sha(raw), "header_sha256": sha(header),
        "generated_sha256": sha(emitted),
        "retained_effect_prefix_bytes": len(prefix.encode("utf-8")),
        "retained_effect_prefix_sha256": sha(prefix.encode("utf-8")),
        "retained_effect_prefix_byte_identical": True,
        "original_keyframe_body_byte_identical_after_newline_normalization": True,
        "original_keyframe_body_sha256_normalized": sha(frame_body.encode()),
        "original_initializer_sha256_normalized": sha(initializer_original.encode()),
        "initializer_changes": ["checked Lua allocation", "early pt->L ownership assignment", "live initialization panic guard before allocating registration", "checked genuine loader pre-init"],
        "scheduler_changes": ["single cooperative lane", "queued integer keyframes", "deferred visual-phase cleanup", "fresh panic guards for original emitter init/death", "faulted-lane cleanup path", "no SDL worker/semaphore", "main GL context assertion"],
        "required_original_vfs": ["/loader/pre-init.lua", "actual ps->name_def particle definitions in original gfx archives"],
        "rng_phase_components_bytes": {"sfmt": 2524, "normalFloat": 36, "musl_rand": 28},
        "validation": "SOURCE GENERATION ONLY; no compile or runtime test executed",
        "renderer_purity_claim": False,
    }
    (output / "provenance.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("upstream", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(json.dumps(generate(args.upstream, args.output)))
