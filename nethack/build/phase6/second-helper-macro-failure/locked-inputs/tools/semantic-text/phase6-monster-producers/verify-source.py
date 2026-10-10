"""Finite source/provenance checks; no C/compiler/native/browser execution."""
from __future__ import annotations
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import unittest

sys.dont_write_bytecode = True
PHASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("phase6_monster_prepare", PHASE / "prepare.py")
prepare = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = prepare
spec.loader.exec_module(prepare)


def predicate_tokens(source: str) -> list[tuple[str, tuple[str, ...]]]:
    tokens = [m.group() for m in prepare.LEX.finditer(source)
              if not m.group().startswith(("/*", "//"))]
    output = []
    for i, token in enumerate(tokens[:-1]):
        if token not in {"if", "while", "for", "switch"} or tokens[i + 1] != "(": continue
        depth, end = 1, i + 2
        while end < len(tokens) and depth:
            if tokens[end] == "(": depth += 1
            elif tokens[end] == ")": depth -= 1
            end += 1
        output.append((token, tuple(tokens[i + 2:end - 1])))
    return output


def original_call_sequence(source: str) -> list[tuple[str, tuple[str, ...]]]:
    # Use the generator's exact transparent-capture normalization without
    # depending on Counter iteration order. One call per prefix is compared.
    normalized = source.replace('(nh_text_monster_begin(&nh_monster, adjective), nextmbuf())', 'nextmbuf()')
    normalized = normalized.replace('(nh_visible = &mons[mtmp->mappearance])', '&mons[mtmp->mappearance]')
    normalized = re.sub(r'nh_text_monster_leaf\(&nh_monster,\s*"[^"\n]+",\s*("[^"\n]+")\)', r'\1', normalized)
    for name, original in [("nh_shkname", "shkname(mtmp)"), ("nh_ghost_suffix", "s_suffix(name)"),
                           ("nh_random_name", "pmname(&mons[name], rn2_on_display_rng(2))")]:
        normalized = normalized.replace(f"({name} = {original})", original)
    tokens = [m.group() for m in prepare.LEX.finditer(normalized) if not m.group().startswith(("/*", "//"))]
    output = []
    for i, name in enumerate(tokens[:-1]):
        if not re.fullmatch(r"[A-Za-z_]\w*", name) or tokens[i + 1] != "(": continue
        if name.startswith("nh_") or name in {"if", "while", "for", "switch", "sizeof"}: continue
        depth, end = 1, i + 2
        while end < len(tokens) and depth:
            if tokens[end] == "(": depth += 1
            elif tokens[end] == ")": depth -= 1
            end += 1
        output.append((name, tuple(tokens[i + 2:end - 1])))
    return output


class SourceProof(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original = prepare.UPSTREAM.read_text("utf-8")
        stock = __import__("runpy").run_path(str(prepare.ROOT / "tools/instrument-semantic-names.py"))
        cls.incoming = stock["transform"](cls.original)[0]
        cls.changed, cls.operations = prepare.transform(cls.incoming)
        cls.bridge = (PHASE / "bridge-extension.c.in").read_text("utf-8")
        cls.generated_bridge = (PHASE / "generated/src/nh-semantic-name.c").read_text("utf-8")

    def test_official_pin(self):
        self.assertEqual(prepare.sha(prepare.UPSTREAM.read_bytes()), prepare.PIN)

    def test_exact_incoming_restoration(self):
        self.assertEqual(prepare.restore(self.changed, self.operations), self.incoming)

    def test_native_calls_full_arguments(self):
        self.assertEqual(len(prepare.verify(self.incoming, self.changed, self.operations)), 8)

    def test_native_call_sequence_not_just_counts(self):
        for name in ["x_monnam", *prepare.CAPITALIZED, "rndmonnam"]:
            old = prepare.function(self.incoming, name)[2]
            if name == "x_monnam": old = prepare.normalize_stock_body(old)
            new = prepare.function(self.changed, name)[2]
            self.assertEqual(original_call_sequence(old), original_call_sequence(new), name)

    def test_native_predicates_and_branch_order(self):
        for name in ["x_monnam", *prepare.CAPITALIZED, "rndmonnam"]:
            old = prepare.function(self.incoming, name)[2]
            if name == "x_monnam": old = prepare.normalize_stock_body(old)
            new = prepare.function(self.changed, name)[2]
            self.assertEqual(predicate_tokens(old), predicate_tokens(new), name)

    def test_no_additional_native_state_field_reads(self):
        old = prepare.normalize_stock_body(prepare.function(self.incoming, "x_monnam")[2])
        new = prepare.function(self.changed, "x_monnam")[2]
        fields = lambda s: Counter(re.findall(r"\b(?:mtmp|mdat|u|gy|program_state)\s*(?:->|\.)\s*\w+", s))
        self.assertEqual(fields(old), fields(new))
        code = "".join(m.group() for m in prepare.LEX.finditer(new)
                        if not m.group().startswith(("/*", "//")))
        self.assertEqual(len(re.findall(r"mtmp\s*->\s*mappearance", code)), 1)

    def test_original_rng_calls_and_display_calls_exact(self):
        for name in ["x_monnam", "rndmonnam"]:
            old = prepare.function(self.original, name)[2]
            new = prepare.function(self.changed, name)[2]
            a = {key: value for key, value in prepare.native_calls(old).items() if key[0].startswith("rn2")}
            b = {key: value for key, value in prepare.native_calls(new).items() if key[0].startswith("rn2")}
            self.assertEqual(a, b)

    def test_bridge_cannot_query_game_or_name_helpers(self):
        forbidden = r"\b(?:mtmp|gy|u|program_state|EHalluc_resistance|Hallucination|Blind)\b"
        code = " ".join(m.group() for m in prepare.LEX.finditer(self.bridge)
                        if not m.group().startswith(("/*", "//", '"')))
        self.assertIsNone(re.search(forbidden, code))
        names = {key[0] for key in prepare.native_calls(self.bridge)}
        self.assertLessEqual(names, {"memcpy", "memcmp", "strcmp", "snprintf"})

    def test_failed_final_or_copy_always_invalidates(self):
        self.assertIn("nh_text_name_invalidate(result);\n    if (!owner", self.bridge)
        self.assertLess(self.bridge.index("nh_text_name_grammar_capture(&selected, selected_public_result);", self.bridge.index("void nh_text_monster_copy")),
                        self.bridge.index("nh_text_name_invalidate(result);", self.bridge.index("void nh_text_monster_copy")))

    def test_bounded_originals_events_and_generation(self):
        self.assertIn("extra >= bound - length", self.bridge)
        self.assertIn("nh_name_generation == UINT64_MAX", self.bridge)
        self.assertIn("event_length", self.bridge)
        self.assertIn("(size_t)count >= sizeof event", self.bridge)
        self.assertIn("nh_grammar_length(source, BUFSZ", self.bridge)
        self.assertIn("slot->generation = ++nh_name_generation", self.bridge)
        self.assertIn("#define NH_NAME_SLOTS 32", self.generated_bridge)
        self.assertIn("#define NH_NAME_JSON 4096", self.generated_bridge)

    def test_saddle_and_invisibility_come_from_accepted_original_appends(self):
        body = prepare.function(self.changed, "x_monnam")[2]
        self.assertIn('{ Strcat(buf, "saddled "); nh_saddled = TRUE; }', body)
        self.assertIn('Strcat(buf, "invisible ");\n                    nh_shop_invisible = TRUE;', body)
        self.assertIn("nh_text_monster_prefix(&nh_monster, buf, do_invis, nh_saddled)", body)

    def test_random_static_buffer_cleared_before_any_original_rng(self):
        body = prepare.function(self.changed, "rndmonnam")[2]
        self.assertLess(body.index("nh_text_name_invalidate_range"), body.index("rn2_on_display_rng("))
        self.assertEqual(body.count("nh_text_monster_selected_random"), 1)
        self.assertIn("name >= SPECIAL_PM", body)

    def test_unsupported_rank_branches_produce_no_partial_id(self):
        body = prepare.function(self.changed, "x_monnam")[2]
        named = body[body.index("} else if (is_mplayer(mdat) && (bp"):body.index("} else {\n            Strcat(buf, name)")]
        rank = body[body.index("} else if (is_mplayer(mdat) && !In_endgame"):body.index("} else {\n        Strcat(buf, pm_name)")]
        self.assertNotIn("nh_text_monster_", named)
        self.assertNotIn("nh_text_monster_", rank)

    def test_unassigned_priest_gender_deity_native_body_untouched(self):
        body = prepare.function(self.changed, "x_monnam")[2]
        for statement in ["long save_prop = EHalluc_resistance;", "unsigned save_invis = mtmp->minvis;",
                          "name = priestname(mtmp, article, do_exact, buf2);",
                          "EHalluc_resistance = save_prop;", "mtmp->minvis = save_invis;",
                          'if (article == ARTICLE_NONE && !strncmp(name, "the ", 4))']:
            self.assertIn(statement, body)
        self.assertNotIn("nh_text_monster_copy(nh_result, name)", body)
        self.assertIn("nh_text_name_invalidate(nh_result)", body)

    def test_present_empty_adjective_not_silently_null(self):
        self.assertIn("owner->has_adjective = adjective != NULL", self.bridge)
        self.assertIn("owner->has_adjective\n        && (!owner->adjective.valid", self.bridge)

    def test_mgivenname_consumers_require_original_creator_provenance(self):
        body = prepare.function(self.changed, "x_monnam")[2]
        self.assertNotIn("nh_text_monster_proper(&nh_monster", body)
        self.assertIn("nh_text_monster_nested(&nh_monster, buf, name)", body)
        self.assertIn("nh_text_name_grammar_capture(&certified_name, name)", self.bridge)
        self.assertIn("|| !certified_name.valid", self.bridge)
        self.assertIn('"\\\"name\\\":{\\\"type\\\":\\\"event\\\",\\\"value\\\":%s},"', self.bridge)

    def test_source_selected_leaf_ids_not_english_match(self):
        body = prepare.function(self.changed, "x_monnam")[2]
        for label, english in [("it", "it"), ("someone", "someone"), ("something", "something")]:
            self.assertIn(f'"nethack.name.monster.phase6.{label}", "{english}"', body)
        self.assertNotIn('strcmp(result, "it")', self.bridge)

    def test_catalog_pair_full_union_no_runtime_approval(self):
        catalog = json.loads((PHASE / "catalog-fragment.json").read_text("utf-8"))
        self.assertFalse(catalog["runtime_binding_approved"])
        self.assertEqual(set(catalog["en"]), set(catalog["ja"]))
        for identifier in catalog["en"]:
            union = set(re.findall(r"\{([a-z_]+)\}", catalog["en"][identifier] + catalog["ja"][identifier]))
            self.assertEqual(union, set(catalog["argument_schemas"][identifier]))
        for label in ["proper", "composite", "ghost", "called", "shopkeeper", "shopkeeper_titled", "capitalized", "label"]:
            self.assertEqual(catalog["en"]["nethack.name.monster.phase6." + label], "{original}")

    def test_negative_extra_rng_query_detected(self):
        mutated = self.changed.replace("nh_text_monster_finish(&nh_monster, buf, article, nh_article);",
                                       "(void)rn2(7);\n    nh_text_monster_finish(&nh_monster, buf, article, nh_article);")
        old = prepare.normalize_stock_body(prepare.function(self.incoming, "x_monnam")[2])
        new = prepare.function(mutated, "x_monnam")[2]
        self.assertNotEqual(prepare.native_calls(old), prepare.native_calls(new))

    def test_negative_native_predicate_change_detected(self):
        mutated = self.changed.replace("if (do_it)", "if (!do_it)", 1)
        old = prepare.normalize_stock_body(prepare.function(self.incoming, "x_monnam")[2])
        self.assertNotEqual(predicate_tokens(old), predicate_tokens(prepare.function(mutated, "x_monnam")[2]))

    def test_negative_duplicate_state_read_detected(self):
        mutated = self.changed.replace("nh_visible = mdat;", "nh_visible = mtmp->data;", 1)
        old = prepare.normalize_stock_body(prepare.function(self.incoming, "x_monnam")[2])
        new = prepare.function(mutated, "x_monnam")[2]
        self.assertNotEqual(Counter(re.findall(r"mtmp->data", old)), Counter(re.findall(r"mtmp->data", new)))

    def test_reject_second_application(self):
        with self.assertRaisesRegex(ValueError, "already present"): prepare.transform(self.changed)

    def test_reject_changed_original_anchor(self):
        changed = self.incoming.replace('"%s ghost"', '"%s spirit"', 1)
        with self.assertRaisesRegex(ValueError, "anchor"): prepare.transform(changed)

    def test_generated_hashes_still_bind_inputs(self):
        audit = json.loads((PHASE / "generated/source-audit.json").read_text("utf-8"))
        for path, expected in audit["output_sha256"].items():
            self.assertEqual(prepare.sha((PHASE / "generated" / path).read_bytes()), expected)
        self.assertFalse(audit["compiled"])
        self.assertFalse(audit["runtime_verified"])


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(SourceProof)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    evidence = {
        "schema_version": 1, "status": "source-only-verification", "compiled": False,
        "native_execution": False, "browser_execution": False, "runtime_binding_approved": False,
        "passed": result.testsRun - len(result.failures) - len(result.errors),
        "failed": len(result.failures), "errors": len(result.errors), "total": result.testsRun,
        "scope": "Exact reversible source preservation, ordered native calls/arguments and predicates, no repeated original state fields/RNG, bounded ownership and negative mutation detection. C ABI/memory/native behavior is unexecuted.",
        "input_sha256": {str(path.relative_to(PHASE)): prepare.sha(path.read_bytes())
                         for path in [PHASE / "prepare.py", PHASE / "bridge-extension.c.in",
                                      PHASE / "bridge-extension.h.in", PHASE / "catalog-fragment.json",
                                      PHASE / "generated/monster-composition.patch", PHASE / "generated/source-audit.json"]},
    }
    (PHASE / "generated/source-verification.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    raise SystemExit(0 if result.wasSuccessful() else 1)
