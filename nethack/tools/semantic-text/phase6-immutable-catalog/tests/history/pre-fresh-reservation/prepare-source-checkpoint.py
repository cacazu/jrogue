"""Lightweight source guard only; never starts Node, Cargo, Wasm or a browser."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
PROOF_SHA = "d115a3d6b82dcba2233f15a70be052d2c1895fb931cde6f8edcee49dac667ff3"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    suite = HERE / "registered-catalog-wasm.mjs"
    source = suite.read_text(encoding="utf-8")
    proof_path = ROOT / "build/phase6-rust/actual-proof.json"
    assert digest(proof_path) == PROOF_SHA
    proof = json.loads(proof_path.read_text(encoding="utf-8"))
    assert proof["status"] == "native_rust_phase6_tests_passed"
    assert proof["tests_passed"] == 67 and proof["failed"] == 0
    inputs = []

    def bound(name: str, expected: str) -> None:
        path = (ROOT / name).resolve()
        assert path.is_relative_to(ROOT)
        assert digest(path) == expected, name
        inputs.append({"path": name, "sha256": expected, "bytes": path.stat().st_size})

    for row in proof["sourceFiles"]:
        bound(f'{proof["selectedRustRoot"]}/{row["path"]}', row["sha256"])
    for row in proof["projectProvenance"]:
        bound(row["path"], row["sha256"])
    for row in proof["tested_fixtureSha256"]:
        bound(row["project_path"], row["sha256"])
    bound(proof["rustLibrary"]["path"], proof["rustLibrary"]["sha256"])
    assert source.count("await check(") == 32
    assert source.count("await factory(") == 1
    assert source.index("stage.requireExecution();") < source.index("const factory=")
    assert "noInitialRun:true" in source
    assert "native_callback_semantics_verified:false" in source
    assert "compiled_pipeline_verified:false" in source
    assert "game_loop_started:false" in source
    assert "speedup_claimed:false" in source
    assert "module._free(pointer);assert.ok(handle>lastHandle)" in source
    assert "module.HEAPU8.fill(0x7f,poison" in source
    assert "module.HEAPU8.fill(0x7f,pointer" not in source
    assert "Array(args.length).fill('number')" in source
    assert "await stage.verifyUnchanged();await verifySourceInputs();" in source
    assert "`rust/${ref.path}`" in source and "`engine-source/${name}`" in source
    assert "runtime_sha256:runtimeSha" in source and "total_passed:results.length-failed" in source
    assert "[0,MAX_TEXT+1,0,-6]" in source and "[0,MAX_GAMEPLAY+1,1,-6]" in source
    loader = ROOT / "tests/browser-host-phase6-stage.mjs"
    loader_source = loader.read_text(encoding="utf-8")
    assert "'compiled'" in loader_source
    suite_name = suite.relative_to(ROOT).as_posix()
    assert suite_name in loader_source
    assert (HERE / "../../../../tests/browser-host-phase6-stage.mjs").resolve() == loader
    catalog_path = ROOT / "work/phase6/semantic-generated/catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    ids = [
        "nethack.entity.monster.orc.name_neutral",
        "nethack.message.eat.cpostfx.pline.yum_that_was_real_brain_food.ce60299dbd",
        "nethack.message.dbridge.destroy_drawbridge.you_hear.a_loud_crash.375d03f6b7",
        "nethack.message.eat.eatspecial.pline.yuck_c.dbe94b5155",
        "nethack.message.pager.dowhatdoes.pline.no_such_command_s_char_code_d.2fa35947a9",
        "nethack.quest.wiz.nemesis_wantsit.text",
        "nethack.name.object.public.sequence_25",
    ]
    for name in ids:
        assert name in catalog["en"] and name in catalog["ja"]
    assert len(catalog["argument_schemas"][ids[-1]]) == 26
    for variant in ["dream", "underwater"]:
        assert f"variant.{variant}.{ids[2]}" in catalog["en"]
        assert f"variant.{variant}.{ids[2]}" in catalog["ja"]
    records = {
        "schema_version": 1,
        "status": "source_prepared_not_runtime_executed",
        "suite": suite_name,
        "suite_sha256": digest(suite),
        "prepared_grouped_case_count": 32,
        "selected_rust_actual_proof_sha256": PROOF_SHA,
        "readonly_bound_inputs": inputs,
        "shared_loader": {"path": loader.relative_to(ROOT).as_posix(), "sha256": digest(loader)},
        "source_catalog_fixture": {
            "path": catalog_path.relative_to(ROOT).as_posix(),
            "sha256": digest(catalog_path),
            "en": len(catalog["en"]),
            "ja": len(catalog["ja"]),
            "argument_schemas": len(catalog["argument_schemas"]),
            "note": "Actual complete registration is intentionally deferred to the installed runtime test.",
        },
        "compiler_invoked": False,
        "node_invoked": False,
        "wasm_invoked": False,
        "browser_invoked": False,
        "runtime_tests_passed": None,
        "qualification": "Python verified source guards, selected frozen input bytes and named fixture availability. JavaScript syntax, compiled ABI calls and resulting canaries have not run.",
    }
    output = HERE / "source-checkpoint.json"
    output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": records["status"], "prepared_cases": 32, "suite_sha256": records["suite_sha256"], "checkpoint_sha256": digest(output)}))


if __name__ == "__main__":
    main()
