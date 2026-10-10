"""Meaningful source-preservation checks; no C/native/WASM/browser execution."""
from collections import Counter
import importlib.util
from pathlib import Path
import re
import sys
import unittest

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("phase6_objects", HERE / "prepare.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SourceContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pristine = module.UPSTREAM.read_text("utf8")
        import runpy
        original_objects = runpy.run_path(str(module.ROOT / "tools/instrument-semantic-objects.py"))
        source, cls.existing = original_objects["instrument_text"](cls.pristine)
        cls.source, cls.articles = module.GRAMMAR["transform_articles"](source)
        cls.changed, cls.operations = module.transform_objects(cls.source)
        cls.bridge = (HERE / "bridge-extension.c.in").read_text("utf8")
        cls.header = (HERE / "bridge-extension.h.in").read_text("utf8")

    def test_exact_official_source_pin(self):
        self.assertEqual(module.sha(module.UPSTREAM.read_bytes()), module.PINNED_SOURCE)

    def test_all_existing_ordinary_object_hooks_retained(self):
        self.assertEqual(len(self.existing), 66)
        self.assertEqual(self.source.count("nh_object_recipe"), self.changed.count("nh_object_recipe"))

    def test_restore_incoming_source_byte_for_byte(self):
        self.assertEqual(module.restore(self.changed, self.operations), self.source)

    def test_native_argument_tokens_and_calls_are_preserved(self):
        result = module.verify(self.source, self.changed, self.operations)
        self.assertTrue(result["original_native_calls_and_argument_tokens_preserved"])

    def test_transform_is_deterministic(self):
        again, operations = module.transform_objects(self.source)
        self.assertEqual((again, operations), (self.changed, self.operations))

    def test_duplicate_instrumentation_rejected(self):
        with self.assertRaises(ValueError): module.transform_objects(self.changed)

    def test_missing_native_output_anchor_rejected(self):
        altered = self.source.replace('Strcat(prefix, "cursed ");', 'Strcat(prefix, "unproven ");')
        with self.assertRaises(ValueError): module.transform_objects(altered)

    def test_extra_native_output_occurrence_rejected(self):
        altered = self.source.replace('Strcat(prefix, "cursed ");', 'Strcat(prefix, "cursed "); Strcat(prefix, "cursed ");')
        with self.assertRaises(ValueError): module.transform_objects(altered)

    def test_requires_existing_article_and_object_foundation(self):
        with self.assertRaises(ValueError): module.transform_objects(self.pristine)
        with self.assertRaises(ValueError): module.transform_objects(self.source.replace("nh_object_recipe", "missing_recipe"))

    def test_preserves_peer_message_hooks_and_source_bytes(self):
        peer = self.source.replace('paniclog("doname", bp);', 'peer_public_log("doname", bp);')
        changed, operations = module.transform_objects(peer)
        self.assertIn('peer_public_log("doname", bp);', changed)
        self.assertEqual(module.restore(changed, operations), peer)
        self.assertTrue(module.verify(peer, changed, operations)["exact_incoming_source_restoration"])

    def test_base_capture_is_immediate_after_original_xname(self):
        _, _, body = module.body(self.changed)
        self.assertEqual(body.count("bp = xname(obj);"), 1)
        self.assertIn("bp = xname(obj);\n    nh_object_public_init(&nh_object_public, bp);\n    bp_end =", body)

    def test_stateful_original_helpers_not_replayed(self):
        _, _, before = module.body(self.source)
        _, _, after = module.body(self.changed)
        for wrapper in self.operations[0]["capture_wrappers"]:
            after = after.replace(wrapper["wrapped"], wrapper["original"])
        wanted = {"artifact_name", "count_contents", "peek_timer", "body_part", "makeplural",
                  "noit_mon_nam", "unpaid_cost", "currency", "record_price_quote",
                  "get_cost_of_shop_item", "just_an", "strprepend", "add_erosion_words",
                  "doffing", "donning", "artifact_light", "arti_light_description"}
        for name in wanted:
            old = Counter({key: n for key, n in module.native_calls(before).items() if key[0] == name})
            new = Counter({key: n for key, n in module.native_calls(after).items() if key[0] == name})
            self.assertEqual(old, new, name)

    def test_numeric_source_reads_and_printf_specs_once(self):
        _, _, body = module.body(self.changed)
        for wrapper in self.operations[0]["capture_wrappers"]:
            self.assertEqual(body.count(wrapper["wrapped"]), wrapper["occurrences"])
        self.assertIn('"%ld ", nh_object_public_long(&nh_object_public, obj->quan)', body)
        self.assertIn('"%+d ", nh_object_public_int(&nh_object_public, 0, obj->spe)', body)
        self.assertEqual(body.count("plur(itemcount)"), 1)

    def test_actual_prefix_and_body_capacities_are_supplied(self):
        self.assertIn("NH_OBJECT_PREFIX, sizeof prefix", self.changed)
        self.assertIn("NH_OBJECT_SUFFIX, (size_t) (bp_end - bp) + 1", self.changed)
        self.assertIn("nh_grammar_length(buffer, s->pending_capacity, &length)", self.bridge)
        self.assertIn("nh_grammar_length(prefix, s->prefix_capacity, &length)", self.bridge)

    def test_unknown_native_fragments_remain_and_fail_full_integrity(self):
        for original in ['add_erosion_words(obj, prefix);', 'append_price_quote(bp, &bp_eos, obj->otyp);',
                         'ConcatF1(bp, 0,"%s)", body_part(HAND));',
                         'ConcatF2(bp, 0, " (%s, %s)",']:
            self.assertEqual(self.source.count(original), self.changed.count(original))
        self.assertIn("memcmp(result, expected, length + 1)", self.bridge)
        self.assertIn("length != prefix + base + suffix", self.bridge)

    def test_registry_generation_owned_bytes_and_json_guards_exist(self):
        self.assertIn("struct nh_name_grammar_snapshot base", self.header)
        self.assertIn("char pieces[NH_OBJECT_PUBLIC_JSON]", self.header)
        self.assertIn("s->base.source_generation", self.bridge)
        self.assertIn("nh_name_generation == UINT64_MAX", self.bridge)
        self.assertIn("slot->generation = ++nh_name_generation", self.bridge)
        self.assertIn("length + 1 > sizeof s->pieces - s->used", self.bridge)
        self.assertIn("piece != s->count + 1", self.bridge)

    def test_recycled_identical_pool_bytes_are_not_fresh_provenance(self):
        self.assertIn("nh_object_public_pool_live(s)", self.bridge)
        self.assertIn("s->pool_generation == nh_object_public_pool_generation(s->base.source_pointer)", self.bridge)
        self.assertIn("pool->generation = ++nh_object_pool_generation", self.bridge)
        self.assertIn("nh_object_pool_generation == UINT64_MAX", self.bridge)
        self.assertIn("if (result) return 0", self.bridge)
        self.assertIn("empty == NH_OBJECT_PUBLIC_POOLS", self.bridge)

    def test_public_registry_composition_adds_epoch_hook_once(self):
        canonical = (module.BASE / "nh-semantic-name.c").read_text("utf8")
        foundation = module.GRAMMAR["extend_registry"](canonical)
        changed = module.extend_registry(foundation)
        self.assertEqual(changed.count("nh_object_public_pool_invalidate(pointer, length);"), 1)
        self.assertIn("nh_text_name_grammar_capture", changed)
        with self.assertRaises(ValueError): module.extend_registry(changed)

    def test_public_registry_composition_requires_owned_foundation(self):
        with self.assertRaises(ValueError): module.extend_registry((module.BASE / "nh-semantic-name.c").read_text("utf8"))

    def test_bridge_never_queries_object_or_gameplay(self):
        self.assertNotIn("obj->", self.bridge)
        calls = {key[0] for key in module.native_calls(self.bridge)}
        self.assertLessEqual(calls, {"strlen", "memcmp", "memcpy", "memset", "snprintf"})

    def test_flat_catalog_with_full_explicit_argument_unions(self):
        catalog = module.catalog()
        self.assertEqual(len(catalog["en"]), 48)
        self.assertEqual(set(catalog["en"]), set(catalog["ja"]))
        self.assertEqual(set(catalog["en"]), set(catalog["argument_schemas"]))
        for ident, japanese in catalog["ja"].items():
            used = set(re.findall(r"\{([a-z_0-9]+)(?::[^}]*)?\}", japanese))
            self.assertLessEqual(used, set(catalog["argument_schemas"][ident]))
            self.assertEqual(catalog["en"][ident], "{original}")
            self.assertNotIn("%.0s", japanese)
        ident = module.PREFIX + "sequence_25"
        self.assertEqual(len(catalog["argument_schemas"][ident]), 26)
        self.assertEqual(catalog["ja"][ident].count("{part_"), 25)

    def test_content_plural_omission_retains_source_union(self):
        item = next(x for x in module.NUMBERS if x["id"] == "content_count")
        self.assertIn("english_plural", item["union"])
        self.assertNotIn("english_plural", item["ja"])
        self.assertIn("plur(itemcount)", item["statement"])

    def test_generator_refuses_output_outside_owned_directory(self):
        with self.assertRaises(ValueError): module.generate(HERE.parent / "forbidden-phase6-output")


if __name__ == "__main__":
    unittest.main(verbosity=2)
