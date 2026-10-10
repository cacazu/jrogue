"""Source-only contract checks; added 2026-10-02, NGPL.

These checks do not compile C/Rust, execute the game, edit its working copy,
or read the browser through automation. Runtime fidelity remains a later gate.
"""
from __future__ import annotations
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("semantic_source", ROOT / "tools/instrument-semantic-text.py")
semantic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(semantic)


class SourceContracts(unittest.TestCase):
    def test_c_call_lexer_preserves_nested_literals_and_expressions(self):
        source = 'f("one, \\\"two\\\"", next(x, y), (int[]){1,2}[0], x /*,*/ + y, \'\\\\\')'
        arguments, end = semantic.call_arguments(source, source.index("("))
        self.assertEqual(len(arguments), 5)
        self.assertEqual(arguments[1], "next(x, y)")
        self.assertEqual(arguments[2], "(int[]){1,2}[0]")
        self.assertEqual(semantic.tokens(arguments[3]), ("x", "+", "y"))
        self.assertEqual(end, len(source))

    def test_c_lexer_rejects_unterminated_expression_and_quotes(self):
        for source in ('f("bad)', 'f(x, /* bad)', 'f(g(x)'):
            with self.subTest(source=source), self.assertRaises(ValueError):
                semantic.call_arguments(source, 1)

    def test_unsupported_printf_abi_fails_closed(self):
        for argument in ({"type":"text", "c_length_modifier":"l"},
                         {"type":"integer", "c_length_modifier":"ll"},
                         {"type":"float"}):
            with self.subTest(argument=argument), self.assertRaises(ValueError):
                semantic.argument_type(argument)
        self.assertEqual(semantic.argument_type({"type":"integer", "c_length_modifier":"l"}),
                         ("long", "NH_TEXT_INTEGER"))
        self.assertEqual(semantic.argument_type({"type":"unsigned", "c_length_modifier":""}),
                         ("unsigned int", "NH_TEXT_UNSIGNED"))

    def test_hook_context_must_be_exactly_unique(self):
        for source in ("", "same same"):
            with self.subTest(source=source), self.assertRaises(ValueError):
                semantic.replace_once(source, "same", "new", "fixture")

    def test_all_exact_bindings_and_quest_selection_keep_source(self):
        metadata = ROOT / "locales/gameplay-core.metadata.json"
        document = json.loads(metadata.read_text("utf8"))
        entries = [e for e in document["entries"] if e["category"] == "message"]
        files = sorted((ROOT / "upstream/NetHack-5.0.0/src").glob("*.c"))
        before = {str(p): semantic.sha(p.read_bytes()) for p in files}
        artifacts = [ROOT / "web/engine/nethack.js", ROOT / "web/engine/nethack.wasm"]
        artifact_before = {str(p):semantic.sha(p.read_bytes()) for p in artifacts if p.exists()}
        with tempfile.TemporaryDirectory(prefix="semantic-source-", dir=ROOT / "build") as directory:
            output = Path(directory)
            audit = semantic.generate(metadata, ROOT / "upstream/NetHack-5.0.0", output)
            self.assertEqual(audit["base_message_ids"], len(entries))
            self.assertEqual(audit["producer_sites"], sum(len(e["source_call_sites"]) for e in entries))
            self.assertEqual(audit["unhandled_contracts"], [])
            self.assertFalse(audit["runtime_integration"])
            self.assertFalse(audit["compiled_or_browser_tested"])
            quest = audit["quest"]
            self.assertEqual(quest["catalog_ids"], quest["display_ids"] + quest["history_only_ids"])
            patch = (output / "semantic.patch").read_text("utf8")
            self.assertIn('         nelems = rn2(nelems) + 1;\n+        nh_item_index', patch)
            self.assertNotIn('+        nelems = rn2', patch)
            self.assertTrue(any(line[1:].strip() == 'pline("%s", out_line);' for line in patch.splitlines() if line.startswith("+")),
                            "original quest pline call must remain in its observed delivery block")
            self.assertTrue(any(line[1:].strip() == 'putstr(datawin, 0, out_line);' for line in patch.splitlines() if line.startswith("+")),
                            "original quest putstr call must remain in its observed delivery block")
            self.assertIn('nh_quest_base(nh_code, gc.cvt_buf)', patch)
            self.assertIn('core-history-only English fallback', json.dumps(quest))
            for site in audit["sites"]:
                self.assertEqual(len(site["original_argument_expressions"]), len(site["formal_c_types"]))
            self.assertIn("config_error_add", audit["deferred_producers"])
            self.assertGreater(len(audit["public_objects"]["hooks"]), 0)
            self.assertTrue(all("sha256" in item for item in audit["generated_files"]))
            original_object = (ROOT / "upstream/NetHack-5.0.0/src/objnam.c").read_text("utf8")
            objects = semantic.generator_module("instrument-semantic-objects.py")
            observed_object, _ = objects.instrument_text(original_object)
            original_monster = (ROOT / "upstream/NetHack-5.0.0/src/do_name.c").read_text("utf8")
            names = semantic.generator_module("instrument-semantic-names.py")
            observed_monster, _ = names.transform(original_monster)
            for original, observed in ((original_object, observed_object), (original_monster, observed_monster)):
                for native in ("rn2", "rnd", "rn1", "observe_object", "makeplural", "s_suffix", "name_from_experience"):
                    self.assertEqual(original.count(native + "("), observed.count(native + "("),
                                     "original name/RNG/knowledge call counts remain unchanged: " + native)
        self.assertEqual(before, {str(p):semantic.sha(p.read_bytes()) for p in files})
        self.assertEqual(artifact_before, {str(p):semantic.sha(p.read_bytes()) for p in artifacts if p.exists()})


if __name__ == "__main__":
    unittest.main(verbosity=2)
