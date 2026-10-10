"""Single-job trusted Emscripten build plus exact original-vs-overlay differential."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--upstream", type=Path, required=True)
    parser.add_argument("--emsdk", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--frozen-cache", action="store_true",
                        help="read existing prebuilt cache without locks, writes or regeneration")
    parser.add_argument("--node", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    build = root / "build"
    build.mkdir(exist_ok=True)
    evidence = root / "evidence"
    evidence.mkdir(exist_ok=True)
    subprocess.run([sys.executable, str(root / "tools/generate.py"), "--upstream", str(args.upstream)], check=True)
    # Use installed tools, read official config and pin a task-local config copy.
    config = args.emsdk / ".emscripten"
    config_text = config.read_text(encoding="utf-8").replace("$CFGDIR", str(args.emsdk).replace("\\", "/"))
    if args.frozen_cache:
        config_text += "\nFROZEN_CACHE = True\n"
    task_config = build / ".emscripten"
    task_config.write_text(config_text, encoding="utf-8", newline="\n")
    env = dict(os.environ, EM_CONFIG=str(task_config), EM_CACHE=str(args.cache),
               EMSDK_PYTHON=sys.executable, EMCC_CORES="1", EMCC_BATCH_BUILD="0",
               PATH=str(Path(sys.executable).parent) + os.pathsep + os.environ["PATH"])
    compiler = [sys.executable, str(args.emsdk / "upstream/emscripten/emcc.py")]
    sanity_before = sha(args.cache / "sanity.txt")
    version = subprocess.check_output(compiler + ["--version"], env=env, text=True)
    if "6.0.8" not in version.splitlines()[0]:
        raise ValueError("expected already-installed trusted Emscripten 6.0.8")
    commands = []
    flags = ["-std=c++17", "-O0", "-ffp-contract=off", "-fexceptions", "-Wall", "-Wextra", "-Werror",
             "-DCDDA_RNG_BUILD_FP_CONTRACT_OFF=1", "-sDEFAULT_TO_CXX=1",
             "-sENVIRONMENT=node", "-sEXIT_RUNTIME=1", "-sASSERTIONS=1",
             "-I", str(root / "fixtures/include"), "-I", str(root / "overlay/src")]
    variants = [
        ("original", [root / "reference/original_rng.cpp", root / "tests/sequence_driver.cpp"], []),
        ("adapted", [root / "overlay/src/rng.cpp", root / "overlay/src/rng_snapshot.cpp",
                     root / "tests/sequence_driver.cpp"], ["-DADAPTED=1"]),
        ("snapshot-tests", [root / "overlay/src/rng.cpp", root / "overlay/src/rng_snapshot.cpp",
                            root / "tests/snapshot_tests.cpp"], []),
        ("original-o2", [root / "reference/original_rng.cpp", root / "tests/sequence_driver.cpp"], ["-O2"]),
        ("adapted-o2", [root / "overlay/src/rng.cpp", root / "overlay/src/rng_snapshot.cpp",
                        root / "tests/sequence_driver.cpp"], ["-DADAPTED=1", "-O2"]),
        ("snapshot-tests-o2", [root / "overlay/src/rng.cpp", root / "overlay/src/rng_snapshot.cpp",
                               root / "tests/snapshot_tests.cpp"], ["-O2"]),
    ]
    for name, inputs, extra in variants:
        cmd = compiler + [str(path) for path in inputs] + flags + extra + ["-o", str(build / (name + ".cjs"))]
        commands.append(cmd)
        print("Building " + name, flush=True)
        subprocess.run(cmd, env=env, check=True)
    original = subprocess.check_output([str(args.node), str(build / "original.cjs")])
    adapted = subprocess.check_output([str(args.node), str(build / "adapted.cjs")])
    repeated = subprocess.check_output([str(args.node), str(build / "adapted.cjs")])
    for name, output in [("original", original), ("adapted", adapted), ("adapted-repeat", repeated)]:
        (evidence / (name + ".txt")).write_bytes(output)
    if original != adapted or adapted != repeated:
        original_lines, adapted_lines = original.splitlines(), adapted.splitlines()
        differences = [(i + 1, a.decode(), b.decode()) for i, (a, b) in enumerate(zip(original_lines, adapted_lines)) if a != b]
        raise AssertionError("original/adapted differential failed: " + repr(differences[:5]))
    test_run = subprocess.check_output([str(args.node), str(build / "snapshot-tests.cjs"),
                                       str(evidence / "sample-capsule.txt")])
    tests = json.loads(test_run)
    original_o2 = subprocess.check_output([str(args.node), str(build / "original-o2.cjs")])
    adapted_o2 = subprocess.check_output([str(args.node), str(build / "adapted-o2.cjs")])
    tests_o2 = json.loads(subprocess.check_output([str(args.node), str(build / "snapshot-tests-o2.cjs")]))
    assert original_o2 == adapted_o2 == original, "O2 original/adapted or O0/O2 behavior differs"
    comparable = lambda result: {key: value for key, value in result.items()
                                 if key not in ["capture_resource_failures", "restore_resource_failures"]}
    assert comparable(tests_o2) == comparable(tests), "O2 capture/restore semantics differ"
    (evidence / "original-o2.txt").write_bytes(original_o2)
    (evidence / "adapted-o2.txt").write_bytes(adapted_o2)
    wasm_hashes = {name: sha(build / (name + ".wasm")) for name, _, _ in variants}
    verification = {
        "upstream_commit": "7b2efa5cea38e4d4d97dd0e63b28b9148623da59",
        "emcc_version": version.splitlines()[0],
        "node_version": subprocess.check_output([str(args.node), "--version"], text=True).strip(),
        "source_storage_roundtrip_exact": True,
        "differential_output_identical": True, "differential_repeat_identical": True,
        "differential_lines": len(original.splitlines()),
        "differential_o0_o2_identical": True,
        "differential_output_sha256": hashlib.sha256(original).hexdigest(),
        "snapshot_tests": tests, "snapshot_tests_o2": tests_o2, "wasm_sha256": wasm_hashes,
        "compiler_commands": commands, "EMCC_CORES": 1,
        "shared_standard_library_cache": str(args.cache),
        "cache_is_read_only": args.frozen_cache,
        "cache_sanity_sha256_before": sanity_before,
        "cache_sanity_sha256_after": sha(args.cache / "sanity.txt"),
        "EMCC_BATCH_BUILD": 0,
        "remaining_integration": "real C++ engine command boundaries, Rust/browser FFI, full save boundary, browser flows",
    }
    if args.frozen_cache:
        assert verification["cache_sanity_sha256_after"] == sanity_before
    (evidence / "verification.json").write_text(json.dumps(verification, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({key: value for key, value in verification.items() if key not in ["compiler_commands"]}, indent=2))


if __name__ == "__main__":
    main()
