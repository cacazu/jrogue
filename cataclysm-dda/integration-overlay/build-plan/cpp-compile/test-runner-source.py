"""Light pure source/selector/pin assertions; no Windows guard or process launch."""
from pathlib import Path
import ast
import hashlib
import json
import tempfile
import types
import unittest
from unittest import mock

HERE = Path(__file__).resolve().parent
RUNNER = HERE / "run-compile-window.py"
RUNNER_BYTES = RUNNER.read_bytes()
runner = types.ModuleType("cdda_cpp2_source_assertions")
runner.__file__ = str(RUNNER)
exec(compile(RUNNER_BYTES, str(RUNNER), "exec", dont_inherit=True, optimize=0), runner.__dict__)


class SourceAssertions(unittest.TestCase):
    def test_exact_4_6_launch_boundary_and_2_floor_policy(self):
        self.assertEqual(runner.choose_launch({"physicalFreeBytes": 4 * runner.GIB,
                                              "exactCommitHeadroomBytes": 6 * runner.GIB}), "launch")
        for physical, commit in [(4 * runner.GIB - 1, 6 * runner.GIB), (4 * runner.GIB, 6 * runner.GIB - 1)]:
            self.assertEqual(runner.choose_launch({"physicalFreeBytes": physical,
                                                  "exactCommitHeadroomBytes": commit}), "blocked-fresh-4-6-gate")

    def test_browser_7_9_priority_requires_both_exact_thresholds(self):
        self.assertEqual(runner.choose_launch({"physicalFreeBytes": 7 * runner.GIB,
                                              "exactCommitHeadroomBytes": 9 * runner.GIB}), "deferred-browser-priority")
        for physical, commit in [(7 * runner.GIB - 1, 9 * runner.GIB), (7 * runner.GIB, 9 * runner.GIB - 1)]:
            self.assertEqual(runner.choose_launch({"physicalFreeBytes": physical,
                                                  "exactCommitHeadroomBytes": commit}), "launch")

    def test_invalid_counters_fail_closed(self):
        for physical in [-1, True, 4.0 * runner.GIB]:
            with self.assertRaises(RuntimeError):
                runner.choose_launch({"physicalFreeBytes": physical, "exactCommitHeadroomBytes": 6 * runner.GIB})
        with self.assertRaises(KeyError):
            runner.choose_launch({})

    def test_pin_conflicts_fail_closed_without_process_launch(self):
        first = {"path": str(RUNNER), "bytes": 1, "sha256": "0" * 64}
        with self.assertRaises(RuntimeError):
            runner.collect_pins([first, {**first, "sha256": "1" * 64}])
        self.assertEqual(len(runner.collect_pins([first, first])), 1)

    def test_even_empty_sdk_override_is_rejected(self):
        for key in ["EM_FROZEN_CACHE", "EM_COMPILER_WRAPPER", "EM_LLVM_ROOT"]:
            with mock.patch.dict(runner.os.environ, {key: ""}, clear=True):
                with self.assertRaisesRegex(RuntimeError, "inherited SDK/Python override"):
                    runner.validate_inherited_environment()

    def test_wrong_plan_pin_blocks_before_any_guard_load(self):
        with mock.patch.object(Path, "read_bytes", return_value=b"wrong unreviewed buffer"), \
             mock.patch.object(runner, "load_wrapper", side_effect=AssertionError("guard must remain unloaded")):
            with self.assertRaisesRegex(RuntimeError, "compile plan hash mismatch"):
                runner.validate_plan()

    def test_plan_and_pin_json_parse_the_single_verified_read(self):
        original_read = Path.read_bytes
        expected = {path: original_read(path) for path in [runner.PLAN_PATH, runner.PINS_PATH]}
        reads = {path: 0 for path in expected}

        def read_once(path):
            if path in expected:
                reads[path] += 1
                if reads[path] != 1:
                    raise AssertionError("second read could supply different JSON bytes")
                return expected[path]
            return original_read(path)

        with mock.patch.object(Path, "read_bytes", read_once), \
             mock.patch.object(runner.json, "loads", wraps=json.loads) as parse:
            plan, records = runner.validate_plan()
        self.assertEqual(reads, {path: 1 for path in expected})
        self.assertIs(parse.call_args_list[0].args[0], expected[runner.PLAN_PATH])
        self.assertIs(parse.call_args_list[1].args[0], expected[runner.PINS_PATH])
        self.assertEqual(len(records), 207)
        self.assertEqual(len(plan["stagedFiles"]), 3)

    def test_run_path_calls_only_fixed_outer_primitive(self):
        tree = ast.parse(RUNNER.read_text(encoding="utf-8"))
        attribute_calls = [node.func.attr for node in ast.walk(tree)
                           if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)]
        self.assertIn("run_owned", attribute_calls)
        self.assertNotIn("run_stage", attribute_calls)
        self.assertNotIn("Popen", attribute_calls)
        self.assertNotIn("system", attribute_calls)
        self.assertNotIn("exec_module", attribute_calls)
        self.assertEqual(runner.STAGES, ["compile-overlay-input_context", "compile-overlay-browser_input_snapshot"])

    def test_validate_only_does_not_load_windows_guard(self):
        with mock.patch.object(runner, "load_wrapper", side_effect=AssertionError("source validation must not load guard")):
            plan, records = runner.validate_plan()
        self.assertEqual(len(plan["stagedFiles"]), 3)
        self.assertEqual(len(plan["baseline"]["originalDependencies"]), 144)
        self.assertEqual(len(records), 207)
        self.assertEqual(plan["ownedResourceGuard"]["sampleIntervalMilliseconds"], 250)
        self.assertEqual(plan["ownedResourceGuard"]["maximumStageSeconds"], 180)
        self.assertEqual(plan["rustEnvironment"], {})

    def test_real_owned_tree_retains_file_size_directory_mtime_and_entry_checks(self):
        fixture = tempfile.TemporaryDirectory(prefix="source-stat-regression-", dir=HERE)
        root = Path(fixture.name).resolve()
        self.assertTrue(root.is_relative_to(HERE.resolve()))
        try:
            folder = root / "folder"
            folder.mkdir()
            file = folder / "file.txt"
            file.write_bytes(b"a")
            before = runner.metadata_tree(root)
            self.assertIsNone(before["folder"][0])
            self.assertEqual(before["folder/file.txt"][0], 1)
            file.write_bytes(b"ab")
            self.assertEqual(runner.metadata_tree(root)["folder/file.txt"][0], 2)
            self.assertNotEqual(before, runner.metadata_tree(root))
            file.write_bytes(b"a")
            before_time = runner.metadata_tree(root)
            folder_state = folder.lstat()
            runner.os.utime(folder, ns=(folder_state.st_atime_ns, folder_state.st_mtime_ns + 2_000_000_000))
            after_time = runner.metadata_tree(root)
            self.assertNotEqual(before_time["folder"][1], after_time["folder"][1])
            self.assertNotEqual(before_time, after_time)
            before_entry = after_time
            (folder / "new.txt").write_bytes(b"new")
            self.assertIn("folder/new.txt", runner.metadata_tree(root).keys() - before_entry.keys())
        finally:
            # Only this freshly created fixture is recursively retired; validate
            # its resolved absolute target remains inside the owned workspace.
            self.assertTrue(root.is_relative_to(HERE.resolve()))
            fixture.cleanup()

    def test_archived_directory_size_only_diffs_normalize_without_hiding_other_fields(self):
        attempt = HERE / "execution/cpp2-initial"
        before, after = [json.loads((attempt / ("frozen-tree-metadata-" + moment + ".json")).read_bytes())
                         for moment in ["before", "after"]]

        def normalized(trees):
            return {group: {path: runner.metadata_record(types.SimpleNamespace(st_size=value[0],
                st_mtime_ns=value[1], st_mode=value[2], st_file_attributes=value[3]))
                for path, value in records.items()} for group, records in trees.items()}

        self.assertNotEqual(before, after)
        self.assertEqual(normalized(before), normalized(after))
        directory = next(path for path, value in before["cache"].items() if runner.stat.S_ISDIR(value[2]))
        for field in [1, 2, 3]:
            changed = json.loads(json.dumps(before))
            changed["cache"][directory][field] += 1
            self.assertNotEqual(normalized(before), normalized(changed))


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(SourceAssertions)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if RUNNER.read_bytes() != RUNNER_BYTES:
        raise RuntimeError("tested source bytes changed during light assertions")
    evidence = {"schemaVersion": 1, "testsRun": result.testsRun, "passed": result.wasSuccessful(),
                "testNames": unittest.defaultTestLoader.getTestCaseNames(SourceAssertions),
                "runnerSha256": hashlib.sha256(RUNNER_BYTES).hexdigest(),
                "testSourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                "planSha256": runner.PLAN_SHA256, "compilerExecuted": False, "WindowsGuardLoaded": False,
                "actualLaunchResourceBehaviorExecuted": False, "cppCompileValidityEstablished": False}
    (HERE / "runner-source-tests.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    raise SystemExit(0 if result.wasSuccessful() else 1)
