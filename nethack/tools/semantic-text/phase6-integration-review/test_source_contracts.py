"""Lightweight source/JSON checks, not C/Rust execution or runtime approval."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("phase6_review_prepare", HERE / "prepare.py")
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)
ROOT = prepare.ROOT


class SourceContracts(unittest.TestCase):
    def test_all_current_rust_copies_equal_protected_sources(self):
        report = prepare.read_json(HERE / "compatibility-preparation.json")
        for relative, expected in report["protected_input_sha256"].items():
            self.assertEqual(prepare.digest(ROOT / relative), expected, relative)
        for relative, expected in report["copied_source_sha256"].items():
            self.assertEqual(prepare.digest(HERE / "rust-copy" / relative), expected, relative)

    def test_all_catalog_fixtures_use_only_runtime_schema(self):
        for path in (HERE / "rust-copy/fixtures").glob("*.json"):
            if path.name == "monster-source-metadata.json":
                continue
            prepare.check_catalog(prepare.read_json(path))

    def test_frozen_helper_gill_is_not_certified_or_projected(self):
        raw = prepare.read_json(ROOT / prepare.SOURCE_PATHS["helper"])
        disabled = [row for row in raw["entries"] if not row["descriptor_enabled"]]
        self.assertEqual(len(disabled), 1)
        self.assertIn("gill", disabled[0]["id"])
        self.assertNotIn(disabled[0]["id"], prepare.project("helper", raw)["en"])

    def test_two_identical_source_overlaps_preserve_baseline_japanese(self):
        report = prepare.read_json(HERE / "compatibility-preparation.json")
        baseline = prepare.read_json(ROOT / prepare.SOURCE_PATHS["baseline"])
        combined = prepare.read_json(HERE / "rust-copy/fixtures/combined.json")
        self.assertEqual(len(report["identical_source_overlaps"]), 2)
        for row in report["identical_source_overlaps"]:
            key = row["id"]
            self.assertEqual(combined["en"][key], baseline["en"][key])
            self.assertEqual(combined["ja"][key], baseline["ja"][key])

    def test_object_sequence_retains_26_argument_union_below_64(self):
        data = prepare.read_json(HERE / "rust-copy/fixtures/object.json")
        key = "nethack.name.object.public.sequence_25"
        self.assertEqual(data["argument_schemas"][key], ["original"] + [f"part_{n}" for n in range(1, 26)])
        self.assertEqual(data["en"][key], "{original}")
        self.assertEqual(prepare.placeholder_names(data["ja"][key]), set(data["argument_schemas"][key]) - {"original"})

    def test_helper_inline_leaf_events_fit_192_byte_owned_json(self):
        data = prepare.read_json(HERE / "rust-copy/fixtures/helper.json")
        for key in data["en"]:
            wire = json.dumps({"id": key, "args": {}}, separators=(",", ":"), ensure_ascii=False).encode()
            self.assertLess(len(wire), 192, key)

    def test_source_review_metadata_is_explicitly_projected(self):
        raw = prepare.read_json(ROOT / prepare.SOURCE_PATHS["monster"])
        self.assertIn("runtime_binding_approved", raw)
        projected = prepare.project("monster", raw)
        self.assertEqual(set(projected), {"en", "ja", "argument_schemas"})
        self.assertEqual(projected["en"], raw["en"])

    def test_current_plain_context_has_no_closed_api_enum(self):
        source = (ROOT / "rust/src/domain.rs").read_text(encoding="utf-8")
        self.assertIn("(_, HelperVariant::Plain) => return Ok(original.clone())", source)
        self.assertIn("self.api.len() > 64", source)
        self.assertIn("byte.is_ascii_alphanumeric() || byte == b'_'", source)

    def test_native_struct_initializer_requires_phase4_six_field_header(self):
        header = (ROOT / "work/phase4/semantic-generated/include/nh-semantic.h").read_text(encoding="utf-8")
        self.assertIn("int allow_name_capture;", header)
        original = (ROOT / "tools/semantic-text/nh-semantic.h").read_text(encoding="utf-8")
        self.assertNotIn("int allow_name_capture;", original)

    def test_original_native_getter_proposal_contains_identified_exit_routing_gap(self):
        source = (ROOT / "tools/semantic-text/phase6-native-api/prepare.py").read_text(encoding="utf-8")
        body = source[source.index("def extend_getter"):source.index("def generate", source.index("def extend_getter"))]
        self.assertIn("anchor='    if (kind == NH_TEXT_RAW && raw && window == -1) return s->json;'", body)
        self.assertIn("anchor+'\\n    if (kind == NH_TEXT_RAW", body)
        self.assertIn("shim_exit_nhwindows", body)
        # This binds the reviewed defect, not approval of that ordering.

    def test_write_scope_rejects_parent_and_sibling_directories(self):
        for outside in [HERE.parent, ROOT / "rust", ROOT / "web"]:
            with self.assertRaises(ValueError):
                prepare.safe_output(outside / "unexpected.json")

    def test_future_rust_cases_remain_source_only(self):
        report = prepare.read_json(HERE / "compatibility-preparation.json")
        self.assertFalse(report["compiler_executed"])
        self.assertFalse(report["rust_tests_executed"])
        self.assertFalse(report["runtime_binding_approved"])
        self.assertEqual(report["rust_test_source_count"], 10)


if __name__ == "__main__":
    unittest.main(verbosity=2)
