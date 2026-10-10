"""Collector fidelity and source-binding tests against official parser modules."""
from collections import defaultdict
from dataclasses import asdict
import io
import json
from pathlib import Path
import tempfile
import unittest

import reconcile


class CollectorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.stream, cls.gaps = io.StringIO(), io.StringIO()
        cls.collector = reconcile.Collector(reconcile.DEFAULT_SOURCE, cls.stream, cls.gaps, {}, {})

    def setUp(self):
        self.stream.seek(0)
        self.stream.truncate()
        self.gaps.seek(0)
        self.gaps.truncate()
        self.collector.message_module.messages.clear()
        self.collector.message_module.occurrences.clear()

    def prepare(self, obj):
        self.collector.current = ("data/json/test.json", "/0", obj, reconcile.index_nodes(obj))

    def records(self):
        return [json.loads(s) for s in self.stream.getvalue().splitlines()]

    def test_original_write_text_metadata_fidelity(self):
        samples = [
            ("book", {"plural": True}),
            ({"str": "mouse", "str_pl": "mice", "ctxt": "animal", "//~": "Translator note"}, {"plural": True}),
            ({"str_sp": "deer"}, {"plural": True}),
            ("Damage: %d", {"c_format": True}),
            ("80% full", {"c_format": False}),
            ({"str": "ignored", "//~": "NO_I18N"}, {}),
            ("", {}),
        ]
        for value, kwargs in samples:
            with self.subTest(value=value):
                self.setUp()
                obj = {"type": "item", "id": "fixture", "name": value}
                self.prepare(obj)
                self.collector.original_write(value, "data/json/test.json", comment="Base comment", **kwargs)
                mm = self.collector.message_module
                baseline = asdict(mm.messages[mm.occurrences[-1]][-1]) if mm.occurrences else None
                mm.messages.clear()
                mm.occurrences.clear()
                self.collector.capture(value, "data/json/test.json", comment="Base comment", **kwargs)
                rows = self.records()
                self.assertEqual(len(rows), int(baseline is not None))
                if baseline:
                    self.assertEqual(rows[0]["context"], baseline["context"])
                    self.assertEqual(rows[0]["singular"], baseline["text"])
                    self.assertEqual(rows[0]["plural"], baseline["text_plural"] or None)
                    self.assertEqual(rows[0]["explicitPlural"], baseline["explicit_plural"])
                    self.assertEqual(rows[0]["formatTag"], baseline["format_tag"])
                    self.assertEqual(rows[0]["comments"], baseline["comments"])
                    self.assertFalse(mm.messages)
                    self.assertFalse(mm.occurrences)

    def test_official_item_parser_fields_and_structural_omission(self):
        # JSON decoding gives field values independent identities as in source.
        obj = json.loads('{"type":"item","id":"fixture","name":{"str":"sample mouse","str_pl":"sample mice"},"description":"Description of the fixture.","flags":["STRUCTURAL_FLAG"],"snippet_category":"STRUCTURAL_CATEGORY","variants":[{"id":"striped","name":{"str":"striped fixture"},"description":"Striped description."}]}')
        self.prepare(obj)
        self.collector.parse_module.parse_json_object(obj, "data/json/test.json")
        rows = self.records()
        self.assertEqual([r["singular"] for r in rows], ["sample mouse", "Description of the fixture.", "striped fixture", "Striped description."])
        self.assertEqual(rows[0]["jsonPointers"], ["/0/name"])
        self.assertEqual(rows[2]["jsonPointers"], ["/0/variants/0/name"])
        self.assertIn("id%3Dstriped", rows[2]["semanticId"])
        self.assertEqual(rows[2]["semanticStatus"], "definition-field")
        self.assertEqual(rows[0]["plural"], "sample mice")
        self.assertTrue(rows[0]["explicitPlural"])

    def test_official_gendered_dialogue_expands_all_contexts(self):
        obj = json.loads('{"type":"talk_topic","id":"TALK_FIXTURE","dynamic_line":{"gendered_line":"Hello, survivor!","relevant_genders":["u","npc"]}}')
        self.prepare(obj)
        self.collector.parse_module.parse_json_object(obj, "data/json/test.json")
        rows = self.records()
        self.assertEqual(len(rows), 9)
        self.assertEqual(len({r["context"] for r in rows}), 9)
        self.assertEqual(len({r["semanticId"] for r in rows}), 9)
        self.assertTrue(all(r["jsonPointers"] == ["/0/dynamic_line/gendered_line"] for r in rows))

    def test_generated_recipe_category_text_requires_review(self):
        obj = json.loads('{"type":"recipe_category","id":"CC_FIXTURE","recipe_subcategories":["CSC_FIXTURE_PARTS"]}')
        self.prepare(obj)
        self.collector.parse_module.parse_json_object(obj, "data/json/test.json")
        rows = self.records()
        self.assertEqual([r["singular"] for r in rows], ["FIXTURE", "PARTS"])
        self.assertTrue(all(r["bindingStatus"] == "generated-parser-text" for r in rows))
        self.assertTrue(all(r["semanticId"] is None for r in rows))

    def test_ambiguous_pointer_does_not_claim_binding(self):
        shared = "A deliberately shared string object."
        obj = {"type": "item", "id": "fixture", "name": shared, "description": shared}
        self.prepare(obj)
        self.collector.capture(shared, "data/json/test.json")
        row = self.records()[0]
        self.assertEqual(row["bindingStatus"], "ambiguous-pointer")
        self.assertEqual(row["jsonPointers"], ["/0/name", "/0/description"])
        self.assertIsNone(row["semanticId"])

    def test_official_argument_ast_disambiguates_cached_character_fields(self):
        obj = json.loads('{"type":"mission_definition","id":"MISSION_FIXTURE","name":"Fixture mission","dialogue":{"describe":"X","offer":"X","accepted":"X"}}')
        self.assertIs(obj["dialogue"]["describe"], obj["dialogue"]["offer"])
        self.prepare(obj)
        self.collector.parse_module.parse_json_object(obj, "data/json/test.json")
        rows = self.records()[1:]
        self.assertEqual([r["jsonPointers"] for r in rows], [["/0/dialogue/describe"], ["/0/dialogue/offer"], ["/0/dialogue/accepted"]])
        self.assertTrue(all(r["bindingStatus"] == "exact-pointer" for r in rows))
        self.assertEqual(len({r["semanticId"] for r in rows}), 3)

    def test_external_default_string_uses_exact_value_pointer(self):
        obj = json.loads('{"type":"talk_topic","id":"fixture","var":{"default_str":"Missing fallback."}}')
        self.prepare(obj)
        self.collector.write_module.write_translation_or_var(obj["var"], "data/json/test.json", comment="variable")
        row = self.records()[0]
        self.assertEqual(row["jsonPointers"], ["/0/var/default_str"])
        self.assertEqual(row["singular"], "Missing fallback.")


class ReconciliationTests(unittest.TestCase):
    def test_po_stream_context_plural_multiline_obsolete(self):
        content = '#: src/sample.cpp:10\nmsgctxt "context"\nmsgid "one %d"\nmsgid_plural "many %d"\nmsgstr[0] "日本語"\n"続き"\n\n#~ msgid "old"\n#~ msgstr "旧"\n'
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / "fixture.po"
            p.write_text(content, encoding="utf-8")
            rows = list(reconcile.po_entries(p))
        self.assertEqual(rows[0]["context"], "context")
        self.assertEqual(rows[0]["plural"], "many %d")
        self.assertEqual(rows[0]["translations"], {"0": "日本語続き"})
        self.assertTrue(rows[1]["obsolete"])

    def test_plural_and_stale_keys_are_distinguished(self):
        entry = {"plural": "mice", "translations": {"0": "ネズミ"}, "flags": []}
        self.assertEqual(reconcile.catalog_match("mice", True, entry, None)[:2], ("exact", "translated"))
        self.assertEqual(reconcile.catalog_match("mouses", False, entry, None)[:2], ("implicit-plural-review", "translated"))
        self.assertEqual(reconcile.catalog_match("rats", True, entry, None)[:2], ("explicit-plural-mismatch", "plural-mismatch"))
        self.assertEqual(reconcile.catalog_match(None, False, None, None)[:2], ("no-source-key", "missing-source-key"))

    def test_ids_use_definitions_and_do_not_use_display_text(self):
        a = {"type": "item", "id": "item_fixture", "name": "English name"}
        b = {"type": "item", "id": "item_fixture", "name": "Changed English name"}
        self.assertEqual(reconcile.owner_identity(a), reconcile.owner_identity(b))
        self.assertEqual(reconcile.owner_identity({"type": "help", "name": "English name"}), (None, "unidentified-definition"))

    def test_official_scope_exclusions(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)
            included = source / "data/json/fixture.json"
            excluded = source / "data/mods/TEST_DATA/fixture.json"
            explicit = source / "data/json/npcs/TALK_TEST.json"
            for p in (included, excluded, explicit):
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text("[]", encoding="utf-8")
            self.assertEqual(list(reconcile.json_files(source)), [included])


if __name__ == "__main__":
    unittest.main()
