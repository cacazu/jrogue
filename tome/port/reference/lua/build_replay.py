"""Compile upstream Lua 5.1.5 to WASM and execute original ToME scalar methods.

This is a source-execution proof, not a campaign boot or a complete game port.
No upstream files or SDK configuration files are modified.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import zipfile


HERE = Path(__file__).resolve().parent
UPSTREAM = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
SDK = Path(r"C:\Users\kit\emsdk")
NODE = Path(r"C:\Program Files\nodejs\node.exe")
COMBAT_SHA256 = "0cfaba3995f19a0ddb9e716b2ae8ab68e916c1e1784bb753f72b159bfd17af13"
COMMIT = "624a67329fe2ad440c5b344785a9c73fcf22ae63"
METHOD_RANGES = {
    "checkHit": [337, 350],
    "rescaleDamage": [1467, 1471],
    "rescaleCombatStats": [1477, 1496],
    "combatDamagePower": [1708, 1715],
}


def acquire_source() -> dict:
    target = HERE / "source"
    target.mkdir(parents=True, exist_ok=True)
    archive = UPSTREAM / "game/modules/tome-1.7.6.team"
    with zipfile.ZipFile(archive) as z:
        data = z.read("mod/class/interface/Combat.lua")
    digest = hashlib.sha256(data).hexdigest()
    if digest != COMBAT_SHA256:
        raise RuntimeError(f"Unexpected Combat.lua source SHA256: {digest}")
    lines = data.decode("utf-8").splitlines()
    methods = {}
    for name, (first, last) in METHOD_RANGES.items():
        body = "\n".join(lines[first - 1:last]) + "\n"
        if not re.match(r"function _M:" + name + r"\b", body):
            raise RuntimeError(f"Method range changed for {name}")
        methods[name] = {
            "first_line": first,
            "last_line": last,
            "normalized_lf_sha256": hashlib.sha256(body.encode()).hexdigest(),
        }
    # Preserve and load the entire unmodified upstream module, including notices.
    (target / "Combat.lua").write_bytes(data)
    provenance = {
        "version": "1.7.6",
        "upstream_commit": COMMIT,
        "archive": str(archive),
        "member": "mod/class/interface/Combat.lua",
        "sha256": digest,
        "methods": methods,
        "license": "GPL-3.0-or-later; notices retained in source/Combat.lua",
        "loading": "Complete original module; controlled engine require/class stubs",
        "port_helper_alias": {"weaponDamagePower": "combatDamagePower"},
    }
    (HERE / "source-provenance.json").write_text(
        json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return provenance


def build(browser: bool = False) -> None:
    out = HERE / "build"
    out.mkdir(parents=True, exist_ok=True)
    cache = out / "em-cache"
    cache.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    env["EM_CACHE"] = str(cache)
    env["EM_CONFIG"] = str(SDK / ".emscripten")
    env["EMSDK_PYTHON"] = str(SDK / "python/3.13.3_64bit/python.exe")
    sources = sorted(
        p for p in (UPSTREAM / "src/lua").glob("*.c")
        if p.name not in {"luac.c", "print.c"}
    )
    output_name = "lua-core.mjs" if browser else "lua.js"
    runtime_options = (
        ["-sENVIRONMENT=web,node", "-sMODULARIZE=1", "-sEXPORT_ES6=1",
         "--embed-file", str(HERE / "source/Combat.lua") + "@/source/Combat.lua",
         "--embed-file", str(HERE / "replay.lua") + "@/replay.lua"]
        if browser else ["-sENVIRONMENT=node", "-sNODERAWFS=1"]
    )
    command = [
        str(SDK / "upstream/emscripten/emcc.exe"),
        *map(str, sources),
        str(HERE / "stdio_physfs_adapter.c"),
        str(HERE / "cli_main.c"),
        "-I" + str(UPSTREAM / "src/lua"),
        "-I" + str(UPSTREAM / "src/physfs"),
        "-O1", *runtime_options,
        "-sEXIT_RUNTIME=1", "-sALLOW_MEMORY_GROWTH=1",
        "-lm", "-o", str(out / output_name),
    ]
    prefix = "browser-" if browser else ""
    (out / (prefix + "build-command.json")).write_text(json.dumps(command, indent=2) + "\n", encoding="utf-8")
    result = subprocess.run(command, env=env, text=True, capture_output=True)
    (out / (prefix + "compile.stdout.txt")).write_text(result.stdout, encoding="utf-8")
    (out / (prefix + "compile.stderr.txt")).write_text(result.stderr, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(f"Lua WASM compilation failed ({result.returncode}):\n{result.stderr[-6000:]}")


def replay(provenance: dict) -> dict:
    command = [str(NODE), str(HERE / "build/lua.js"), str(HERE / "replay.lua")]
    result = subprocess.run(command, cwd=HERE, capture_output=True, text=True)
    (HERE / "build/replay.stdout.txt").write_text(result.stdout, encoding="utf-8")
    (HERE / "build/replay.stderr.txt").write_text(result.stderr, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(f"Original Combat.lua execution failed ({result.returncode}):\n{result.stderr[-6000:]}")
    sentinel = "TOME_GOLDEN_JSON="
    outputs = [line[len(sentinel):] for line in result.stdout.splitlines() if line.startswith(sentinel)]
    if len(outputs) != 1:
        raise RuntimeError("Replay did not emit exactly one golden JSON result")
    golden = json.loads(outputs[0])
    golden["provenance"] = provenance
    golden["runtime"] = {
        "implementation": "Official bundled Lua 5.1.5 compiled to WebAssembly by Emscripten",
        "execution_host": "Node.js CLI, using NODERAWFS for local source fixtures",
        "campaign_booted": False,
        "gameplay_rng_tested": False,
    }
    (HERE / "combat-golden.json").write_text(json.dumps(golden, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    summary = {
        "status": "passed",
        "lua_version": golden["lua_version"],
        "source_sha256": provenance["sha256"],
        "fixture_counts": {name: len(golden[name]) for name in ["check_hit", "rescale_combat_stats", "rescale_damage", "weapon_damage_power"]},
        "wasm_sha256": hashlib.sha256((HERE / "build/lua.wasm").read_bytes()).hexdigest(),
    }
    (HERE / "proof-result.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary


def browser_replay() -> dict:
    result = subprocess.run([str(NODE), str(HERE / "run-browser-proof.mjs")],
                            cwd=HERE, capture_output=True, text=True)
    (HERE / "build/browser-replay.stdout.txt").write_text(result.stdout, encoding="utf-8")
    (HERE / "build/browser-replay.stderr.txt").write_text(result.stderr, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(f"Browser ES6 module proof failed ({result.returncode}):\n{result.stderr[-6000:]}")
    sentinel = "TOME_GOLDEN_JSON="
    outputs = [line[len(sentinel):] for line in result.stdout.splitlines() if line.startswith(sentinel)]
    if len(outputs) != 1:
        raise RuntimeError("Browser module did not emit exactly one golden JSON result")
    actual = json.loads(outputs[0])
    original = json.loads((HERE / "combat-golden.json").read_text(encoding="utf-8"))
    for name in ["check_hit", "rescale_combat_stats", "rescale_damage", "weapon_damage_power"]:
        if actual[name] != original[name]:
            raise RuntimeError(f"Browser module and Node CLI differ in {name}")
    summary = {
        "status": "passed",
        "format": "ES6 modular WebAssembly; ENVIRONMENT=web,node",
        "module": "build/lua-core.mjs",
        "wasm": "build/lua-core.wasm",
        "embedded_files": ["/source/Combat.lua", "/replay.lua"],
        "execution_host_tested": "Node.js importing the browser-compatible ES6 module",
        "actual_browser_tested": False,
        "campaign_booted": False,
        "golden_fixture_comparison": "All 66 source-derived fixtures match Node CLI exactly",
        "wasm_sha256": hashlib.sha256((HERE / "build/lua-core.wasm").read_bytes()).hexdigest(),
    }
    (HERE / "browser-proof-result.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--browser", action="store_true", help="Also build and replay the embedded browser ES6 module")
    args = parser.parse_args()
    provenance = acquire_source()
    provenance["file_adapter"] = {
        "path": "stdio_physfs_adapter.c",
        "scope": "Four PhysicsFS file-read functions implemented with stdio for isolated proof; no ZIP/package loader",
        "sha256": hashlib.sha256((HERE / "stdio_physfs_adapter.c").read_bytes()).hexdigest(),
    }
    provenance["entrypoint"] = {
        "path": "cli_main.c",
        "scope": "Local CLI entry point; release bundles the Lua interpreter library without lua.c",
        "sha256": hashlib.sha256((HERE / "cli_main.c").read_bytes()).hexdigest(),
    }
    (HERE / "source-provenance.json").write_text(
        json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    if not args.skip_build:
        build()
    print(json.dumps(replay(provenance), indent=2))
    if args.browser:
        build(browser=True)
        print(json.dumps(browser_replay(), indent=2))


if __name__ == "__main__":
    main()
