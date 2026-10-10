"""Pure source/protocol regressions. No Windows guard, subprocess or WASM execution."""
from pathlib import Path
import ast
import hashlib
import json
import types
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
OWNER_PATH = HERE / "run-fixture-window.py"
owner_data = OWNER_PATH.read_bytes()
owner = types.ModuleType("cdda_fixture_source_tests")
owner.__file__ = str(OWNER_PATH)
exec(compile(owner_data, str(OWNER_PATH), "exec", dont_inherit=True, optimize=0), owner.__dict__)


class SourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan, cls.guard_plan, cls.records, cls.helper, *_ = owner.load_sources()
        cls.host = (HERE / "test-wasm.mjs").read_text(encoding="utf-8")

    def test_pins_and_flat_policy_are_source_validated_without_windows(self):
        self.assertEqual(len(self.records), 235)
        self.assertFalse(hasattr(self.helper, "KERNEL"))
        base = next(item for item in self.records if Path(item["path"]).resolve() ==
                    (owner.CPP2 / "compile-plan.json").resolve())
        self.assertEqual(base["sha256"], owner.CPP2_PLAN_SHA)
        self.assertEqual(self.guard_plan["ownedResourceGuard"]["maximumStageSeconds"], 180)

    def test_checked_buffer_is_read_once_and_pinned_without_reread(self):
        data = b'{"single-read":"buffer"}'
        with patch.object(Path, "read_bytes", return_value=data) as reader:
            actual = owner.checked_bytes(HERE / "never-created.json", hashlib.sha256(data).hexdigest())
            record = owner.buffer_pin(HERE / "never-created.json", actual)
        self.assertEqual(reader.call_count, 1)
        self.assertEqual(record["sha256"], hashlib.sha256(data).hexdigest())
        self.assertEqual(json.loads(actual)["single-read"], "buffer")

    def test_changed_buffer_is_rejected(self):
        with patch.object(Path, "read_bytes", return_value=b"changed"):
            with self.assertRaises(RuntimeError):
                owner.checked_bytes(HERE / "never-created.json", "0" * 64)

    def test_names_are_exact_ordered_unique_source_derivations(self):
        names = owner.expected_wasm_names(self.host)
        self.assertEqual(len(names), 29)
        self.assertEqual(len(set(names)), 29)
        self.assertEqual(names, self.plan["expectedWasmCheckNames"])

    def test_unknown_interpolation_and_changed_loop_id_are_rejected(self):
        with self.assertRaises(RuntimeError):
            owner.expected_wasm_names(self.host.replace(
                "actual encoder accepts boundary case ${id}", "unsupported case ${id}"))
        with self.assertRaises(RuntimeError):
            owner.expected_wasm_names(self.host.replace(
                "[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 19]", "[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 20]"))

    def test_duplicate_named_check_is_rejected(self):
        with self.assertRaises(RuntimeError):
            owner.expected_wasm_names(self.host.replace(
                "publication has no synchronous observer reentry", "out-of-scope and unknown handles are unavailable"))

    def test_exit_zero_cannot_substitute_wrong_named_reports(self):
        # Negative protocol fixture only; no accepted/model native proof is written.
        invalid = {"status": "actual-snapshot-module-wasm-synthetic-callback-fixture-passed",
                   "actualModuleExecuted": True, "genuineWasmExportTests": 29,
                   "reports": [{"name": "wrong", "passed": True}] * 29}
        with patch.object(Path, "read_bytes", return_value=json.dumps(invalid).encode()):
            with self.assertRaises(RuntimeError):
                owner.verify(self.plan["commands"][2], self.records, {},
                             self.plan["expectedWasmCheckNames"], self.helper)

    def test_pure_launch_selector_prioritizes_browser_and_rejects_bad_counters(self):
        gib = self.helper.GIB
        for physical, commit, expected in [(4, 6, "launch"), (5, 7, "launch"),
                (7, 9, "deferred-browser-priority"), (3, 8, "blocked-fresh-4-6-gate"),
                (5, 5, "blocked-fresh-4-6-gate")]:
            self.assertEqual(self.helper.choose_launch({"physicalFreeBytes": physical * gib,
                             "exactCommitHeadroomBytes": commit * gib}), expected)
        for value in [True, -1]:
            with self.assertRaises(RuntimeError):
                self.helper.choose_launch({"physicalFreeBytes": value, "exactCommitHeadroomBytes": 6 * gib})

    def test_build_creation_remains_after_nonlaunch_break_in_stage_loop(self):
        tree = ast.parse(owner_data)
        execute = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "execute")
        parents = {child: node for node in ast.walk(execute) for child in ast.iter_child_nodes(node)}
        calls = [node for node in ast.walk(execute) if isinstance(node, ast.Call)
                 and isinstance(node.func, ast.Attribute) and node.func.attr == "mkdir"
                 and isinstance(node.func.value, ast.BinOp)
                 and isinstance(node.func.value.left, ast.Name) and node.func.value.left.id == "HERE"
                 and isinstance(node.func.value.right, ast.Constant) and node.func.value.right.value == "build"]
        self.assertEqual(len(calls), 1)
        build_if = parents[parents[calls[0]]]
        self.assertIsInstance(build_if, ast.If)
        loop = parents[build_if]
        self.assertIsInstance(loop, ast.For)
        preceding = loop.body[:loop.body.index(build_if)]
        self.assertTrue(any(isinstance(node, ast.If) and
            any(isinstance(child, ast.Break) for child in ast.walk(node)) for node in preceding))
        self.assertIn('"accepted-cpp2-base-plan.json").write_bytes(base_data)', owner_data.decode())


if __name__ == "__main__":
    result = unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(SourceTests))
    evidence = {"schemaVersion": 1, "status": "source-protocol-tests-passed" if result.wasSuccessful() else "failed",
                "tests": result.testsRun, "ownerSha256": hashlib.sha256(owner_data).hexdigest(),
                "testSourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                "WindowsGuardLoaded": False, "fixtureCompileExecuted": False,
                "fixtureLinkExecuted": False, "WasmExecuted": False, "RustExecuted": False,
                "sourceProtocolTestsAreNotRuntimeProof": True}
    (HERE / "runner-source-tests.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(evidence))
    raise SystemExit(0 if result.wasSuccessful() else 1)
