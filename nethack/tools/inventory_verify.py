#!/usr/bin/env python3
"""Verify source scan correctness and the generated upstream coverage evidence."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import tempfile
import unittest
from collections import Counter
from pathlib import Path

import inventory_source as scan


class ExtractionTests(unittest.TestCase):
    def test_messages_keep_dynamic_formats_and_exact_arguments(self):
        source = r'''
/* pline("not a call"); */
int do_test(int n) {
    char brace = '}';
    pline("You carry " "%d items.", n + calculate(1, 2));
    custompline(FLAG, "%s falls.", mon_name(m));
    pline(condition ? "Open" : "Closed");
    putstr(win, ATR_NONE, "100% plain text");
    add_menu(win, &glyph, &any, 'a', 0, ATR_NONE, NO_COLOR,
             "A ring", MENU_ITEMFLAGS_NONE);
    Sprintf(buffer, "Damage: %d", n);
    return 0;
}
'''
        literals, messages, formats, calls, functions = scan.scan_c("src/test.c", source)
        self.assertEqual([f["name"] for f in functions], ["do_test"])
        self.assertEqual(len(messages), 5)
        self.assertEqual(messages[0]["english_source_template"], "You carry %d items.")
        self.assertEqual(messages[0]["argument_binding"][0]["source_expression"], "n + calculate(1, 2)")
        self.assertEqual(messages[0]["format_specifiers"], ["%d"])
        self.assertIn("nethack.message.test.do_test.pline.you_carry", messages[0]["english_id_candidate"])
        self.assertIsNone(messages[2]["english_source_template"])
        self.assertIsNone(messages[2]["english_id_candidate"])
        self.assertEqual(messages[3]["argument_binding"], [])
        self.assertEqual(messages[3]["format_specifiers"], [])
        self.assertEqual(messages[4]["english_source_template"], "A ring")
        self.assertEqual(messages[4]["format_argument_index"], 7)
        self.assertEqual(formats[0]["english_source_template"], "Damage: %d")
        self.assertEqual(calls["calculate"], 1)
        self.assertFalse(any(l["english_source_literal"] == "not a call" for l in literals))

    def test_c_escaping_unicode_and_line_locations(self):
        literals, messages, _, _, _ = scan.scan_c("src/test.c", 'void f(void) {\n  You("\\\"snow\\\" \\x41\\101\\n\\u96ea");\n}\n')
        self.assertEqual(literals[0]["english_source_literal"], '"snow" AA\n\u96ea')
        self.assertEqual(messages[0]["line"], 2)
        self.assertEqual(messages[0]["function_candidate"], "f")

    def test_location_helpers_and_plain_wrappers(self):
        source = '''void f(void) {
    pline_dir(1, "A %s arrives.", name);
    pline_xy(x, y, "%d turns.", turns);
    pline_mon(mon, "The %s flees.", name);
    Your1("100% plain wording");
    add_menu_heading(win, "Choices");
    gamelog_add(type, turn, "An event");
    Sprintf1(buffer, "50% plain wording");
    The("object name");
}
'''
        _, messages, formats, _, _ = scan.scan_c("src/test.c", source)
        self.assertEqual(len(messages), 6)
        self.assertEqual([m["format_argument_index"] for m in messages[:3]], [1, 2, 1])
        self.assertEqual(messages[0]["english_source_template"], "A %s arrives.")
        self.assertEqual(messages[3]["format_semantics"], "plain-display-text")
        self.assertEqual(messages[3]["argument_binding"], [])
        self.assertEqual(messages[4]["english_source_template"], "Choices")
        self.assertEqual(messages[5]["english_source_template"], "An event")
        self.assertEqual(formats[0]["format_specifiers"], [])
        self.assertFalse(any(m["api"] == "The" for m in messages))

    def test_lua_long_strings_maps_and_comments_remain_distinct(self):
        source = '''-- ignored = "not text"
--[=[ ignored = "not text either" ]=]
quest = [==[
You have returned, %p.
]==]
map = [[
----
|..|
----
]]
name = "A -- literal"
'''
        result = scan.scan_lua("dat/quest.lua", source)
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]["context_key_candidate"], "quest")
        self.assertEqual(result[0]["english_source_literal"], "You have returned, %p.\n")
        self.assertEqual(result[1]["context_key_candidate"], "map")
        self.assertEqual(result[2]["english_source_literal"], "A -- literal")

    def test_cpp_raw_strings_and_compiler_pragmas(self):
        source = '''#pragma warning(disable: 4996)
void f(void) {
    const char *description = R"quest(A "quoted" message.
Do not treat // words as comments.)quest";
    raw_print(description);
    y_n("Continue?");
}
'''
        literals, messages, _, _, _ = scan.scan_c("win/Qt/example.cpp", source)
        self.assertEqual(literals[0]["english_source_literal"], 'A "quoted" message.\nDo not treat // words as comments.')
        self.assertEqual([m["api"] for m in messages], ["raw_print", "y_n"])
        self.assertEqual(messages[1]["format_semantics"], "plain-display-text")

    def test_output_cannot_modify_upstream(self):
        with tempfile.TemporaryDirectory(prefix="nethack-inventory-") as temporary:
            upstream = Path(temporary) / "upstream"
            upstream.mkdir()
            (upstream / "immutable.txt").write_text("immutable", encoding="utf-8")
            before = (upstream / "immutable.txt").read_bytes()
            with self.assertRaises(ValueError):
                scan.generate(upstream, upstream / "output")
            self.assertEqual((upstream / "immutable.txt").read_bytes(), before)

    def test_manifest_rejects_duplicate_and_stale_evidence(self):
        with tempfile.TemporaryDirectory(prefix="nethack-inventory-") as temporary:
            source = Path(temporary) / "upstream"
            (source / "src").mkdir(parents=True)
            (source / "src/allmain.c").write_text('void f(void) { pline("A message"); }\n', encoding="utf-8")
            output = Path(temporary) / "audit"
            scan.generate(source, output)
            self.assertTrue(verify_manifest(source, output)["catalog_counts_reconciled"])
            path = output / "catalog/source-files.json"
            original = path.read_text(encoding="utf-8")
            document = json.loads(original)
            document["files"].append(document["files"][0])
            path.write_text(json.dumps(document), encoding="utf-8")
            with self.assertRaisesRegex(AssertionError, "Duplicate upstream"):
                verify_manifest(source, output)
            document = json.loads(original)
            document["counts"]["source_bytes"] += 1
            path.write_text(json.dumps(document), encoding="utf-8")
            with self.assertRaisesRegex(AssertionError, "Inconsistent/stale counts"):
                verify_manifest(source, output)


def verify_manifest(source: Path, output: Path) -> dict:
    manifest = json.loads((output / "catalog/source-files.json").read_text(encoding="utf-8"))
    mechanics = json.loads((output / "catalog/source-mechanics.json").read_text(encoding="utf-8"))
    messages = json.loads((output / "catalog/source-text-messages.json").read_text(encoding="utf-8"))
    literals = json.loads((output / "catalog/source-text-literals.json").read_text(encoding="utf-8"))
    surfaces = json.loads((output / "catalog/source-text-surfaces.json").read_text(encoding="utf-8"))
    summary = json.loads((output / "catalog/source-summary.json").read_text(encoding="utf-8"))
    files = manifest["files"]
    observed = {p.relative_to(source).as_posix() for p in source.rglob("*") if p.is_file() and not any(part in {".git", "node_modules", "target", "__pycache__"} for part in p.relative_to(source).parts)}
    recorded = {f["source"] for f in files}
    if len(recorded) != len(files):
        raise AssertionError("Duplicate upstream manifest rows")
    if observed != recorded:
        raise AssertionError(f"Upstream file manifest mismatch: missing {observed-recorded}, extra {recorded-observed}")
    for file in files:
        raw = (source / file["source"]).read_bytes()
        if len(raw) != file["bytes"] or hashlib.sha256(raw).hexdigest() != file["sha256"]:
            raise AssertionError(f"Upstream content changed: {file['source']}")
    core = {f"src/{p.name}" for p in (source / "src").glob("*.c")}
    core_rows = mechanics["files"]
    if len({m["source"] for m in core_rows}) != len(core_rows):
        raise AssertionError("Duplicate core C file rows")
    if core != {m["source"] for m in core_rows}:
        raise AssertionError("Not every core C file is inventoried exactly")
    if any(m["subsystem"] == "unclassified-requires-review" for m in mechanics["files"]):
        raise AssertionError("Unclassified core C files remain")
    if any(m["rust_gameplay_parity"] != "not-evaluated" for m in mechanics["files"]):
        raise AssertionError("Inventory must not claim Rust parity")
    source_lengths = {f["source"]: f["lines"] for f in files}
    for message in messages["messages"]:
        if not 1 <= message["line"] <= source_lengths[message["source"]]:
            raise AssertionError(f"Invalid source line: {message}")
        if message["english_source_template"] is None:
            if message["english_id_candidate"] is not None:
                raise AssertionError("Unresolved source expressions cannot receive invented semantic IDs")
        elif not message["english_id_candidate"].startswith("nethack.message."):
            raise AssertionError("Missing English semantic candidate namespace")
        if message["translation_status"] != "not-translated" or message["runtime_catalog_status"] != "not-integrated":
            raise AssertionError("Inventory must not claim translation or runtime catalog integration")
    if messages["sink_argument_indexes"]["add_menu"] != 7:
        raise AssertionError("NetHack 5.0 menu string argument has moved to index 7")
    expected_counts = {"source_files": len(files), "source_bytes": sum(f["bytes"] for f in files), "source_text_files": sum(f["text_encoding"] is not None for f in files), "src_c_files": len(core_rows), "src_c_lines": sum(m["lines"] for m in core_rows), "src_function_definition_candidates": sum(len(m["function_definition_candidates"]) for m in core_rows), "src_unclassified_files": sum(m["subsystem"] == "unclassified-requires-review" for m in core_rows), "c_string_literal_occurrences_all_tree": len(literals["c_literals"]), "message_sink_call_candidates_all_tree": len(messages["messages"]), "message_literal_formats_resolved_all_tree": sum(m["english_source_template"] is not None for m in messages["messages"]), "message_dynamic_formats_unresolved_all_tree": sum(m["english_source_template"] is None for m in messages["messages"]), "formatting_call_candidates_all_tree": len(messages["intermediate_formatters"]), "dat_doc_surface_files": len(surfaces["surfaces"]), "dat_files": sum(s["source"].startswith("dat/") for s in surfaces["surfaces"]), "doc_files": sum(s["source"].startswith("doc/") for s in surfaces["surfaces"]), "dat_lua_files": sum(s["source"].startswith("dat/") and s["source"].endswith(".lua") for s in surfaces["surfaces"]), "dat_lua_string_occurrences": len(literals["lua_literals"]), "dat_noncomment_nonblank_line_candidates": len(surfaces["data_line_candidates"]), "japanese_translations_provided_by_inventory": 0, "rust_parity_claims": 0}
    for name, document in [("files", manifest), ("mechanics", mechanics), ("messages", messages), ("literals", literals), ("surfaces", surfaces), ("summary", summary)]:
        if document["counts"] != expected_counts:
            raise AssertionError(f"Inconsistent/stale counts in {name} catalog")
    for module in core_rows:
        if module["function_definition_candidate_count"] != len(module["function_definition_candidates"]):
            raise AssertionError(f"Stale function count in {module['source']}")
    if summary["subsystem_counts"] != dict(Counter(m["subsystem"] for m in core_rows)):
        raise AssertionError("Stale subsystem summary")
    for record in literals["lua_literals"] + surfaces["data_line_candidates"]:
        if record["translation_status"] != "not-translated" or record["runtime_catalog_status"] != "not-integrated":
            raise AssertionError("Source text extraction cannot claim actual translations/integration")
    return {"verified_source_files": len(files), "verified_core_c_files": len(core), "verified_message_call_candidates": len(messages["messages"]), "source_sha256_manifest_matches": True, "catalog_counts_reconciled": True, "core_c_file_coverage": "complete", "translation_or_rust_parity_claims": False}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--report", type=Path, help="Write successful scan/source verification evidence outside the upstream tree")
    args = parser.parse_args()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ExtractionTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
    if bool(args.source) != bool(args.output):
        parser.error("--source and --output must be supplied together")
    if args.source:
        source = args.source.resolve(strict=True)
        output = args.output.resolve(strict=True)
        evidence = verify_manifest(source, output)
        evidence.update({"result": "pass", "verified_at_utc": datetime.now(timezone.utc).isoformat(), "source_tree": source.name, "scanner_unit_tests_run": result.testsRun, "scanner_unit_test_failures": len(result.failures), "scanner_unit_test_errors": len(result.errors), "scanner_unit_tests_skipped": len(result.skipped), "tool_sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path(scan.__file__), Path(__file__)]}, "catalog_sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((output / "catalog").glob("source-*.json")) if p.name != "source-verification.json"}})
        if args.report:
            report = args.report.resolve()
            if report == source or source in report.parents:
                parser.error("--report must be outside the immutable upstream source tree")
            report.parent.mkdir(parents=True, exist_ok=True)
            report.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8", newline="\n")
        print(json.dumps(evidence, indent=2))
    elif args.report:
        parser.error("--report requires --source and --output")


if __name__ == "__main__":
    main()
