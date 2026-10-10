"""Pure protocol/source regressions: no Cargo, Windows guard or child process."""
from pathlib import Path
import ast
import hashlib
import json
import types
import unittest

HERE = Path(__file__).resolve().parent
SOURCE = (HERE / "run-rust-window.py").read_bytes()
TREE = ast.parse(SOURCE)
OWNER = types.ModuleType("verified_native_bytes_owner_source_tests")
OWNER.__file__ = str(HERE / "run-rust-window.py")
exec(compile(SOURCE, OWNER.__file__, "exec", dont_inherit=True, optimize=0), OWNER.__dict__)
PLAN = json.loads((HERE / "rust-consumer-plan.json").read_bytes())
NAMES = PLAN["expectedOrderedTests"]


def transcript(names=NAMES):
    return "running 4 tests\n" + "\n".join("test " + name + " ... ok" for name in names) + (
        "\n\ntest result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s\n")


class OwnerSourceTests(unittest.TestCase):
    def test_exact_four_reports_are_accepted(self):
        self.assertEqual(OWNER.exact_test_reports(transcript(), NAMES),
                         [{"name": name, "passed": True} for name in NAMES])

    def test_missing_extra_duplicate_and_wrong_order_reports_fail(self):
        for names in [NAMES[:-1], NAMES + ["tests::unexpected"], NAMES[:-1] + [NAMES[0]], list(reversed(NAMES))]:
            with self.subTest(names=names), self.assertRaises(RuntimeError):
                OWNER.exact_test_reports(transcript(names), NAMES)

    def test_failed_or_ignored_test_fails(self):
        for outcome in ["FAILED", "ignored"]:
            with self.subTest(outcome=outcome), self.assertRaises(RuntimeError):
                OWNER.exact_test_reports(transcript().replace("... ok", "... " + outcome, 1), NAMES)

    def test_summary_count_and_duplicate_summary_fail(self):
        for text in [transcript().replace("4 passed", "3 passed"), transcript() + transcript().splitlines()[-1] + "\n"]:
            with self.subTest(text=text), self.assertRaises(RuntimeError):
                OWNER.exact_test_reports(text, NAMES)

    def test_buffer_hash_mismatch_fails_before_parse(self):
        with self.assertRaises(RuntimeError):
            OWNER.checked_bytes(HERE / "rust-consumer-plan.json", "0" * 64)

    def test_default_has_no_guard_or_runtime_call(self):
        main = next(node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name == "main")
        branch = next(node for node in ast.walk(main) if isinstance(node, ast.If) and
                      ast.unparse(node.test) == "not options.run")
        calls = [ast.unparse(node.func) for child in branch.body for node in ast.walk(child) if isinstance(node, ast.Call)]
        self.assertFalse(any(name.endswith("load_wrapper") or name.endswith("run_owned") or name == "execute" for name in calls))
        self.assertIsInstance(branch.body[-1], ast.Return)

    def test_job_owner_is_only_fixed_wrapper_call(self):
        calls = [ast.unparse(node.func) for node in ast.walk(TREE) if isinstance(node, ast.Call)]
        self.assertEqual(calls.count("wrapper.run_owned"), 1)
        self.assertFalse(any(name.endswith("run_stage") or name.endswith("Popen") for name in calls))
        self.assertFalse(any(name.endswith("metadata_tree") for name in calls))

    def test_no_fit_does_not_create_fixed_target(self):
        execute = next(node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name == "execute")
        calls = [ast.unparse(node) for node in ast.walk(execute) if isinstance(node, ast.Call)]
        self.assertTrue(any("os.path.lexists(HERE / 'target')" in call for call in calls))
        self.assertFalse(any("(HERE / 'target').mkdir" in call for call in calls))


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(OwnerSourceTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    proof = {"schemaVersion": 1, "runnerSha256": hashlib.sha256(SOURCE).hexdigest(),
             "planSha256": hashlib.sha256((HERE / "rust-consumer-plan.json").read_bytes()).hexdigest(),
             "sourceTestsRun": result.testsRun, "passed": result.wasSuccessful(),
             "CargoExecuted": False, "WindowsGuardLoaded": False}
    (HERE / "runner-source-tests.json").write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    raise SystemExit(0 if result.wasSuccessful() else 1)
