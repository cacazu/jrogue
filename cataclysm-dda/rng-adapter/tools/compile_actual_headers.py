"""Compile only the two overlaid RNG units against real game headers, no fixtures."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--upstream", type=Path, required=True)
    parser.add_argument("--engine-generated", type=Path, required=True)
    parser.add_argument("--emsdk", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    build = root / "build"
    build.mkdir(exist_ok=True)
    config = build / ".emscripten-actual-headers"
    text = (args.emsdk / ".emscripten").read_text(encoding="utf-8")
    text = text.replace("$CFGDIR", str(args.emsdk).replace("\\", "/"))
    config.write_text(text + "\nFROZEN_CACHE = True\n", encoding="utf-8", newline="\n")
    env = dict(os.environ, EM_CONFIG=str(config),
               EM_CACHE=str(args.emsdk / "upstream/emscripten/cache"),
               EMCC_CORES="1", EMCC_BATCH_BUILD="0", EMSDK_PYTHON=sys.executable,
               PATH=str(Path(sys.executable).parent) + os.pathsep + os.environ["PATH"])
    flags = ["-c", "-std=c++17", "-Os", "-fsigned-char", "-fexceptions", "-ffp-contract=off",
             "-DCDDA_RNG_BUILD_FP_CONTRACT_OFF=1", "-DRELEASE", "-DTILES", "-DLOCALIZE",
             "-DZSTD_STATIC_LINKING_ONLY", "-DZSTD_DISABLE_ASM", "-Wall", "-Wextra", "-Werror",
             # Actual unchanged src/enum_traits.h:122/133 has intentionally static
             # operator templates unused by these RNG-only translation units.
             "-Wno-unused-template", "-I", str(root / "overlay/src"),
             "-I", str(args.engine_generated), "-I", str(args.upstream / "src"),
             "-isystem", str(args.upstream / "src/third-party")]
    records = []
    for source in ["rng_snapshot.cpp", "rng.cpp"]:
        output = build / ("actual-header-" + source[:-4] + ".o")
        command = [sys.executable, str(args.emsdk / "upstream/emscripten/emcc.py"),
                   str(root / "overlay/src" / source)] + flags + ["-o", str(output)]
        print("Compiling actual headers: " + source, flush=True)
        subprocess.run(command, env=env, check=True)
        records.append({"source": source, "command": command,
                        "object_sha256": hashlib.sha256(output.read_bytes()).hexdigest()})
    evidence = {"actual_pristine_headers": str(args.upstream / "src"),
                "fixture_headers_used": False, "linked_full_engine": False,
                "cache_is_read_only": True, "EMCC_CORES": 1, "translation_units": records,
                "unchanged_upstream_warning_suppression": "unused static templates at src/enum_traits.h:122,133"}
    (root / "evidence/actual-headers.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"actual_header_translation_units_passed": 2, "fixture_headers_used": False}))


if __name__ == "__main__":
    main()
