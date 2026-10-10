"""Synthetic parser/rejection checks only. Never create an actual-pass report."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("phase6_proof_recorder", HERE / "record-actual-proof.py")
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)


def group(count):
    return f"running {count} tests\ntest result: ok. {count} passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s\n"


class RecorderRejections(unittest.TestCase):
    def test_split_unit_and_integration_groups_sum_exactly_67(self):
        self.assertEqual(proof.validate_native_log(group(57) + group(10), 67), [57, 10])

    def test_relative_command_paths_resolve_from_recorded_cwd(self):
        crate = HERE / "rust-copy"
        self.assertEqual(proof.command_path("Cargo.toml", str(crate)), crate / "Cargo.toml")
        self.assertEqual(proof.command_path("target", str(crate)), crate / "target")

    def test_old_49_pass_status_cannot_be_reused(self):
        with self.assertRaises(ValueError): proof.validate_native_log(group(49), 67)

    def test_truncated_unstarted_or_unfinished_groups_reject(self):
        for log in ["", "running 57 tests\n", group(57), group(57) + "running 10 tests\n", group(57).split("running 57 tests\n")[1] + group(10)]:
            with self.assertRaises(ValueError): proof.validate_native_log(log, 67)

    def test_any_ignored_failed_filtered_or_count_mismatch_rejects(self):
        for text in [
            group(67).replace("0 ignored", "1 ignored"),
            group(67).replace("0 failed", "1 failed"),
            group(67).replace("0 measured", "1 measured"),
            group(67).replace("0 filtered out", "1 filtered out"),
            group(67).replace("67 passed", "66 passed"),
        ]:
            with self.assertRaises(ValueError): proof.validate_native_log(text, 67)

    def test_actual_failed_resource_is_rejected_even_with_synthetic_pass_log(self):
        resource = proof.ROOT / "build/phase6-rust/native-test-resource.json"
        with tempfile.TemporaryDirectory(dir=HERE) as temporary:
            directory = Path(temporary).resolve()
            self.assertTrue(directory.is_relative_to(HERE))
            log = directory / "synthetic.log"
            log.write_text(group(57) + group(10), encoding="utf-8")
            with self.assertRaises(ValueError): proof.evidence("native", resource, log, HERE / "rust-copy", 67)

    def test_approved_fixtures_are_explicit_and_current(self):
        rows = proof.approved_fixtures(HERE / "rust-copy", HERE / "approved-fixtures.json")
        self.assertEqual(len(rows), 7)
        self.assertIn("nethack/locales/gameplay-core.json", [row["source_package_path"] for row in rows])
        self.assertTrue(all(row["included_by"] for row in rows))

    def test_unknown_or_changed_fixture_manifest_rejects(self):
        original = json.loads((HERE / "approved-fixtures.json").read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory(dir=HERE) as temporary:
            directory = Path(temporary).resolve()
            self.assertTrue(directory.is_relative_to(HERE))
            manifest = directory / "synthetic-fixture-manifest.json"
            missing = dict(original); missing["fixtures"] = original["fixtures"][:-1]
            manifest.write_text(json.dumps(missing), encoding="utf-8")
            with self.assertRaises(ValueError): proof.approved_fixtures(HERE / "rust-copy", manifest)
            changed = json.loads(json.dumps(original)); changed["fixtures"][0]["sha256"] = "0" * 64
            manifest.write_text(json.dumps(changed), encoding="utf-8")
            with self.assertRaises(ValueError): proof.approved_fixtures(HERE / "rust-copy", manifest)

    def test_checkpoint_has_only_crate_relative_source_leaf_paths(self):
        rows = proof.source_files(HERE / "rust-copy")
        self.assertEqual(len(rows), 11)
        for row in rows:
            self.assertNotIn("..", Path(row["path"]).parts)
            self.assertFalse(Path(row["path"]).is_absolute())
        self.assertIn("src/registered_catalog.rs", [row["path"] for row in rows])


if __name__ == "__main__":
    unittest.main(verbosity=2)
