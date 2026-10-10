"""Freeze parity commands and all source/tool/cache bytes; never start a build."""
from pathlib import Path
import argparse
import hashlib
import json
import sys
import types

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CPP2_SHA = "0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395"
SEM_SHA = "d9023bbce0f8a4b567c71fb630e0db8b3af29ca3a37c19122e7757c32cbf1379"
QUALITY_SHA = "e550a5d2674bd803e6804b6acd9b6077b607b9d3b5e1d4d822800255b5525faa"
SDK_NODE_SHA = "3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237"


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def digest(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def ordinary(path):
    path = Path(path).absolute()
    for parent in [*reversed(path.parents), path]:
        state = parent.lstat()
        require(not parent.is_symlink() and not getattr(state, "st_file_attributes", 0) & 0x400,
                "reparse/symlink ancestry: " + str(parent))
    return path


def checked_json(path, sha):
    path = ordinary(path)
    require(path.is_file() and digest(path) == sha, "source plan changed: " + str(path))
    return json.loads(path.read_bytes())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--node-executable", required=True)
    options = parser.parse_args()
    semantic_path = ROOT / "semantic-display-live-slice/COMPILE-WINDOW-PLAN.json"
    quality_path = ROOT / "input-context-live-slice/rust-build-plan/formatted-quality/quality-plan.json"
    semantic = checked_json(semantic_path, SEM_SHA)
    quality = checked_json(quality_path, QUALITY_SHA)
    preparation_path = HERE / "prepared/SOURCE-PREPARATION.json"
    preparation = json.loads(ordinary(preparation_path).read_bytes())
    helper_path = Path(semantic["cpp2Helper"]["path"])
    require(digest(helper_path) == CPP2_SHA, "fixed helper changed")
    helper = types.ModuleType("cdda_parity_prepare_fixed_cpp2")
    helper.__file__ = str(helper_path)
    exec(compile(helper_path.read_bytes(), str(helper_path), "exec", dont_inherit=True, optimize=0), helper.__dict__)
    records = {}

    def add(path):
        path = ordinary(path)
        require(path.is_file(), "not a source file: " + str(path))
        record = helper.pin(path)
        key = str(path.resolve()).casefold()
        if key in records:
            require(records[key] == record, "inconsistent duplicate pin")
        records[key] = record

    for original_plan in [semantic, quality]:
        require(isinstance(original_plan.get("pins"), list), "unknown protected pin schema")
        for record in original_plan["pins"]:
            if original_plan is semantic and helper.within(record["path"], ROOT / "semantic-display-live-slice/build/sources/src"):
                continue
            require(digest(record["path"]) == record["sha256"], "inherited protected bytes changed")
            add(record["path"])
    for record in preparation["outputs"]:
        require(digest(record["path"]) == record["sha256"], "prepared source changed")
        add(record["path"])
    for record in [preparation["frozenSourcePlan"], preparation["cppOriginal"], preparation["headerOriginal"], preparation["expectedOriginal"], *preparation["RustSourcePins"]]:
        require(digest(record["path"]) == record["sha256"], "original parity source changed")
        add(record["path"])
    for path in [semantic_path, quality_path, preparation_path, __file__, HERE / "run-window.py", HERE / "verify-streams.mjs", HERE / "README.md"]:
        add(path)
    roots = {"prepared": str(HERE / "prepared"), **{name: semantic["frozenSDK"][name] for name in ["cache", "ports"]}}
    trees = {name: helper.metadata_tree(path) for name, path in roots.items()}
    for root in roots.values():
        ordinary(root)
        for path in Path(root).rglob("*"):
            ordinary(path)
            if path.is_file():
                add(path)
    environment = dict(preparation["cppEnvironmentTemplate"])
    require(Path(environment["EM_CONFIG"]).read_text(encoding="utf-8").splitlines()[-1] == "FROZEN_CACHE = True", "cache must remain frozen")
    add(environment["EM_CONFIG"])
    node = ordinary(options.node_executable)
    require(str(node).casefold() == r"C:\Users\kit\emsdk\node\24.19.0_64bit\node.exe".casefold() and
            node.stat().st_size == 92_825_416 and digest(node) == SDK_NODE_SHA, "exact accepted official SDK Node")
    add(node)
    rust = quality["rustEnvironment"]
    rustc = ordinary(rust["RUSTC"])
    linker = ordinary(rust["CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER"])
    add(rustc)
    add(linker)
    build = HERE / "owned-build"
    cpp_js, cpp_wasm, rust_exe = build / "fixture.cjs", build / "fixture.wasm", build / "rust-parity.exe"
    template = preparation["cppFutureCompilerTemplate"]
    require(template[1:5] == ["-O0", "-std=c++17", "-fsigned-char", "-fexceptions"] and
            template[7:10] == ["-sENVIRONMENT=node", "-sALLOW_MEMORY_GROWTH", "-Wl,--threads=1"], "exact compiler template")
    cpp_argv = [template[0], *template[1:5], "-I" + str(HERE / "prepared/cpp"), str(HERE / "prepared/cpp/fixture.cpp"), *template[7:10], "-o", str(cpp_js)]
    stages = [
        ("compile-cpp", environment["EMSDK_PYTHON"], cpp_argv, environment, [cpp_js, cpp_wasm]),
        ("run-cpp", str(node), [str(cpp_js)], {}, []),
        ("compile-rust", str(rustc), ["--edition=2021", "--crate-name", "cdda_native_cosmetic_parity", str(HERE / "prepared/rust/src/main.rs"), "-C", "opt-level=0", "-C", "codegen-units=1", "-C", "debuginfo=0", "-C", "linker=" + str(linker), "-o", str(rust_exe)], {}, [rust_exe]),
        ("run-rust", str(rust_exe), [], {}, []),
    ]
    packet = {
        "schemaVersion": 1, "sourceCommit": preparation["sourceCommit"],
        "status": "source-only-unexecuted-parity-window", "expectedChecks": 23,
        "cpp2Helper": semantic["cpp2Helper"], "guard": semantic["guard"],
        "ownedResourceGuard": semantic["ownedResourceGuard"], "launchGate": semantic["launchGate"],
        "frozenSDK": semantic["frozenSDK"], "rustEnvironment": rust,
        "removeInheritedEnvironment": [*quality["removeInheritedEnvironment"], "NODE_OPTIONS", "NODE_PATH"],
        "parentExclusiveSlotReleaseRequired": True, "browserRecoveryHasPriority": True,
        "treeRoots": roots, "preparationContextTrees": trees,
        "treeBaselineRule": "All file bytes and membership are frozen. Metadata is additionally retained exactly across each owned execution window in its execution context.",
        "pins": sorted(records.values(), key=lambda row: row["path"].casefold()),
        "commands": [{"stage": stage, "executable": exe, "argv": argv, "cwd": str(build), "environment": env, "outputs": list(map(str, outputs))} for stage, exe, argv, env, outputs in stages],
        "expectedStdout": str(HERE / "prepared/expected-stdout.txt"), "outputFiles": list(map(str, [cpp_js, cpp_wasm, rust_exe])),
        "execution": {"compiler": False, "runtime": False, "originalCallers": False, "originalRng": False, "saveResume": False, "browser": False, "fullGame": False},
    }
    output = HERE / "WINDOW-PLAN.json"
    try:
        output.lstat()
    except FileNotFoundError:
        pass
    else:
        raise RuntimeError("source plan or dangling link already exists")
    with output.open("x", encoding="utf-8", newline="\n") as target:
        json.dump(packet, target, indent=2)
        target.write("\n")
    print(json.dumps({"status": packet["status"], "protectedFiles": len(records), "planSha256": digest(output)}))


if __name__ == "__main__":
    main()
