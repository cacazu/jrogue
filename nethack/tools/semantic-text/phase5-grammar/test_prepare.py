"""Pure source-preservation tests; no C compiler, game, WASM or browser (NGPL)."""
from __future__ import annotations

import json
from pathlib import Path
import runpy
import sys
import unittest

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
p = runpy.run_path(str(HERE / "prepare.py"))


class ArticleSourceContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original = p["UPSTREAM"].read_text("utf-8")
        cls.changed, cls.operations = p["transform_articles"](cls.original)
        cls.registry = (p["BASE"] / "nh-semantic-name.c").read_text("utf-8")

    def body(self, text, name):
        return p["function"](text, name)[2]

    def test_all_original_native_calls_and_arguments_once(self):
        report = p["verify_native_tokens"](self.original, self.changed, self.operations)
        self.assertEqual(set(report), {"an", "An", "the", "The"})
        self.assertTrue(all(row["native_calls_and_argument_tokens_preserved"] for row in report.values()))

    def test_transform_reverses_to_exact_original_bytes(self):
        self.assertEqual(p["restore"](self.changed, self.operations), self.original)

    def test_existing_object_hooks_are_preserved(self):
        instrument = runpy.run_path(str(p["ROOT"] / "tools/instrument-semantic-objects.py"))["instrument_text"]
        composed, _ = instrument(self.original)
        changed, operations = p["transform_articles"](composed)
        self.assertEqual(p["restore"](changed, operations), composed)
        self.assertEqual(changed.count("nh_text_name_invalidate_range(obufs[obufidx]"), 2)
        p["verify_native_tokens"](composed, changed, operations)

    def test_peer_message_wrapper_argument_tokens_preserved(self):
        composed = self.original.replace('impossible("Alphabet soup:', 'nh_phase4_impossible("Alphabet soup:')
        changed, operations = p["transform_articles"](composed)
        self.assertEqual(p["restore"](changed, operations), composed)
        self.assertEqual(changed.count("nh_phase4_impossible("), composed.count("nh_phase4_impossible("))

    def test_null_error_paths_are_unchanged(self):
        for name, error in (("an", "an []"), ("the", "the []")):
            old, new = self.body(self.original, name), self.body(self.changed, name)
            error_return = f'return strcpy(buf, "{error}");'
            self.assertEqual(old.count(error_return), 1)
            self.assertEqual(new.count(error_return), 1)
            self.assertIn("if (!str || !*str)", new)

    def test_snapshot_precedes_original_allocation(self):
        for name in ("an", "the"):
            body = self.body(self.changed, name)
            self.assertLess(body.index("nh_text_name_grammar_capture("), body.index("buf = nextobuf();"))
            self.assertEqual(body.count("nextobuf()"), 1)

    def test_capitalized_snapshot_between_original_call_and_case(self):
        for name, called in (("An", "an"), ("The", "the")):
            body = self.body(self.changed, name)
            self.assertLess(body.index(f"{called}(str)"), body.index("nh_text_name_grammar_capture("))
            self.assertLess(body.index("nh_text_name_grammar_capture("), body.index("*tmp = highc(*tmp);"))
            self.assertEqual(body.count("highc(*tmp)"), 1)

    def test_capacity_expression_keeps_original_conversion_once(self):
        for name in ("an", "the"):
            body = self.body(self.changed, name)
            self.assertEqual(body.count("BUFSZ - 1 - Strlen(buf)"), 1)
            self.assertIn("size_t nh_grammar_capacity = BUFSZ - 1 - Strlen(buf);", body)
            self.assertEqual(body.count("strncat(buf, str, nh_grammar_capacity)"), 1)
            self.assertLess(body.index("strncat("), body.index("nh_text_name_grammar_append("))

    def test_original_fruit_artifact_grammar_queries_unchanged(self):
        old, new = self.body(self.original, "the"), self.body(self.changed, "the")
        for expression in ("fruit_from_name(str, TRUE, (int *) 0)",
                           "artifact_name(str, (short *) 0, FALSE)", "CapitalMon(str)",
                           "lowc(*str)", 'strstri(str, " of ")'):
            self.assertEqual(old.count(expression), new.count(expression))
            self.assertEqual(new.count(expression), 1)

    def test_existing_the_prefix_copy_and_lowercase_remain_once(self):
        body = self.body(self.changed, "the")
        self.assertEqual(body.count("Strcpy(&buf[1], str + 1);"), 1)
        self.assertLess(body.index("Strcpy(&buf[1], str + 1);"), body.index("NH_NAME_GRAMMAR_LOWER"))

    def test_missing_original_anchor_rejects(self):
        altered = self.original.replace("    char *buf = nextobuf();", "    char *buf = changed_allocator();")
        with self.assertRaises(ValueError): p["transform_articles"](altered)

    def test_duplicate_original_function_rejects(self):
        with self.assertRaises(ValueError):
            p["transform_articles"](self.original + "\n" + self.body(self.original, "an"))

    def test_duplicate_instrumentation_rejects(self):
        with self.assertRaises(ValueError): p["transform_articles"](self.changed)

    def test_native_argument_mutation_is_detected(self):
        corrupted = self.changed.replace("fruit_from_name(str, TRUE", "fruit_from_name(str, FALSE", 1)
        with self.assertRaises(ValueError):
            p["verify_native_tokens"](self.original, corrupted, self.operations)

    def test_original_body_boundaries_ignore_literal_and_comment_braces(self):
        sample = 'char *\nan(const char *str)\n{\n /* } */\n puts("{\\\"}"); return "}";\n}\n'
        start, end, body = p["function"](sample, "an")
        self.assertEqual(start, 0)
        self.assertEqual(sample[end:], "\n")
        self.assertTrue(body.endswith("\n}"))

    def test_catalog_keeps_exact_source_union(self):
        catalog = json.loads((HERE / "catalog-fragment.json").read_text("utf-8"))
        self.assertEqual(set(catalog["en"]), set(p["RECIPES"].values()))
        for recipe in p["RECIPES"].values():
            self.assertEqual(catalog["en"][recipe], "{original}")
            self.assertEqual(catalog["ja"][recipe], "{inner}")
            self.assertEqual(catalog["argument_schemas"][recipe], ["original", "inner"])

    def test_registry_generation_extension_is_separate_and_bounded(self):
        extended = p["extend_registry"](self.registry)
        self.assertEqual((p["BASE"] / "nh-semantic-name.c").read_text("utf-8"), self.registry)
        self.assertEqual(extended.count("#define NH_NAME_SLOTS 32"), 1)
        self.assertEqual(extended.count("#define NH_NAME_JSON 4096"), 1)
        self.assertIn("nh_name_generation == UINT64_MAX", extended)
        self.assertIn("slot->generation = ++nh_name_generation;", extended)

    def test_changed_registry_layout_rejects(self):
        with self.assertRaises(ValueError):
            p["extend_registry"](self.registry.replace("slot->pointer = buffer;", "changed_bind();", 1))

    def test_output_scope_rejects_other_directory_before_writing(self):
        with self.assertRaises(ValueError): p["generate"](HERE.parent / "unowned-output")


if __name__ == "__main__":
    unittest.main(verbosity=2)
