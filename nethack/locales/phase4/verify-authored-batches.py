#!/usr/bin/env python3
"""Normalize reviewed author metadata without mutating author/frozen inputs.

This checks source provenance and presentation contracts. It does not approve
native binding, execute the C/Lua core, or prove completeness of Japanese.
"""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def module(path, name):
    import sys
    spec = spec_from_file_location(name, path)
    value = module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value


def load(path):
    return json.loads(path.read_text("utf8"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def names_only(schema):
    return [v["name"] if isinstance(v, dict) else v for v in schema]


def field(value, *keys):
    return next((value[k] for k in keys if k in value), None)


def verify(batch, authored, official, core, scanner, helper):
    errors, notes, normalized = [], [], []
    expected = {e["id"]: e for e in batch["entries"]}
    entries = authored.get("entries", [])
    ids = [e.get("id") for e in entries]
    if len(set(ids)) != len(ids):
        errors.append("duplicate author IDs")
    if set(ids) != set(expected):
        errors.append(f"author identity union differs: missing={sorted(set(expected)-set(ids))}, extra={sorted(set(ids)-set(expected))}")
    if authored.get("runtime_integration", False) is not False or authored.get("runtime_binding_approved", False) is not False:
        errors.append("author claims runtime approval")
    for e in entries:
        ident = e.get("id")
        if ident not in expected:
            continue
        original = expected[ident]
        label = ident + ": "
        ja = e.get("whole_message_ja")
        structural_empty = (ja == "" and original["original_english_literal"] == ""
                            and original["english_whole_named_template"] == ""
                            and (e.get("localization_disposition") == "preserved-structural-spacer"
                                 or e.get("structural_spacer") is True))
        if not isinstance(ja, str) or (not ja and not structural_empty):
            errors.append(label + "missing actual whole Japanese template")
            continue
        if "%.0s" in ja:
            errors.append(label + "padding workaround is prohibited")
        en_template = original["english_whole_named_template"]
        if en_template.count("\n") != ja.count("\n"):
            errors.append(label + "original literal newline count changed")
        if en_template.startswith("\n") != ja.startswith("\n") or en_template.endswith("\n") != ja.endswith("\n"):
            errors.append(label + "original leading/trailing newline contract changed")
        if e.get("runtime_binding_approved") is not False or e.get("runtime_integration", False) is not False:
            errors.append(label + "runtime binding must remain false")
        source_names = {a["name"] for a in original["typed_arguments"]}
        try:
            ja_names = core.names(ja)
        except ValueError as error:
            errors.append(label + str(error))
            continue
        if not ja_names <= source_names:
            errors.append(label + f"Japanese introduces uncomputed slots: {ja_names-source_names}")
        schema = e.get("argument_schemas")
        if schema is None:
            schema = authored.get("argument_schemas", {}).get(ident)
        if schema is None:
            schema = e.get("source_argument_schema", original["typed_arguments"])
        schema_names = names_only(schema)
        if len(schema_names) != len(set(schema_names)) or set(schema_names) != source_names:
            errors.append(label + "declared schema is not the full exact original public union")
        omissions = e.get("omitted_grammar_arguments", [])
        omission_names = {field(o, "argument", "argument_name", "name") for o in omissions}
        if source_names-ja_names != omission_names:
            errors.append(label + f"unjustified omitted source slots: {source_names-ja_names-omission_names}; extra omission records={omission_names-(source_names-ja_names)}")
        if any(not isinstance(o.get("reason"), str) or not o["reason"].strip() for o in omissions):
            errors.append(label + "omission lacks explicit grammar reason")
        if omissions:
            notes.append(label + "English-only grammar omission needs semantic review; full source union retained")
        for c in original["printf_conversions"]:
            if c["argument"] not in ja_names:
                continue
            token = "{"+c["argument"]+":"+c["catalog_specifier"]+"}"
            # Source keeps %zu; the prepared target template may explicitly
            # lower wasm32 size_t to uint32 %u. This exception is target-bound
            # evidence, never permission to truncate a native 64-bit size_t.
            typed = next(a for a in original["typed_arguments"] if a["name"] == c["argument"])
            if c["source_specifier"] == "%zu" and typed.get("catalog_target_length_normalization") == "wasm32 size_t -> uint32":
                lowered = "{"+c["argument"]+":%u}"
                if lowered in original["english_whole_named_template"]:
                    token = lowered
                    notes.append(label + "Original %zu retained in C/source metadata; catalog %u is limited to explicit wasm32 uint32 size_t target, no native64 truncation permitted")
            if token not in ja:
                errors.append(label + "original printf conversion not preserved: " + token)
        if e.get("original_api", original["original_api"]) != original["original_api"]:
            errors.append(label + "native helper API changed")
        if original["original_api"] == "verbalize" and not (ja.startswith("「") and ja.endswith("」")):
            errors.append(label + "verbalize quotation missing")
        variants = e.get("helper_variant_templates_ja", e.get("whole_message_ja_variants", e.get("helper_variant_templates", {})))
        if isinstance(variants, list):
            variants = {v["helper_variant"]: v["whole_message_ja"] for v in variants}
        # Some authors record the base as 'normal'; native plain/quoted still
        # use the base ID. Other keys must be original captured helper variants.
        missing = set(original["required_helper_variants"]) - set(variants)
        if missing:
            errors.append(label + "missing source helper variants: " + repr(sorted(missing)))
        for key, template in variants.items():
            if key == "normal":
                continue
            if key not in original["required_helper_variants"] or not isinstance(template, str):
                errors.append(label + "unexpected helper variant")
                continue
            try:
                if not core.names(template) <= source_names:
                    errors.append(label + "variant adds unknown source slots")
            except ValueError as error:
                errors.append(label + str(error))
        verified_literals = []
        for literal in e.get("required_source_literal_translations", []):
            source = literal.get("source")
            line = literal.get("line")
            arg = field(literal, "argument", "argument_name", "original_argument_name")
            expression = literal.get("source_expression")
            call = literal.get("original_call_site", {"source": source, "line": line})
            consumer_expression = literal.get("consumer_source_expression", expression)
            sites = [c for c in original["official_source_contracts"] if c["source"] == call["source"] and c["line"] == call["line"]]
            contract = next((a for c in sites for a in c["arguments"] if a["id_candidate"] == arg and a["source_expression"] == consumer_expression), None)
            if contract is None:
                errors.append(label + "literal does not belong to the original site/argument/expression")
                continue
            if expression != consumer_expression or line != call["line"]:
                if literal.get("additional_source_producer_evidence") is not True:
                    errors.append(label + "a separate producer needs explicit source evidence")
                original_lines = (official/source).read_text("utf8").splitlines()
                declaration_line = literal.get("producer_declaration_start_line", line)
                region = "\n".join(original_lines[declaration_line-1:max(line, declaration_line)+24])
                producer_tokens = [t.text for t in scanner.c_tokens(expression)]
                region_tokens = [t.text for t in scanner.c_tokens(region)]
                if not any(region_tokens[i:i+len(producer_tokens)] == producer_tokens for i in range(len(region_tokens))):
                    errors.append(label + "separate producer expression is absent at its original source line")
                notes.append(label + "separate producer/consumer provenance verified; full branch/lifetime/overwrite dataflow remains pending")
            position = literal.get("source_literal_ordinal")
            values = helper.literals(scanner, expression)
            if not isinstance(position, int) or not 0 <= position < len(values):
                errors.append(label + "source literal ordinal unavailable")
                continue
            value, start, end = values[position]
            if value != literal.get("english_source_literal") or start != literal.get("source_expression_literal_start") or end != literal.get("source_expression_literal_end"):
                errors.append(label + "literal value/token offsets differ from original source")
            role = field(literal, "role", "literal_role")
            if role not in ("selected-output-literal", "producer-input-literal", "predicate-comparison-only"):
                errors.append(label + "literal role is not explicit")
            japanese = field(literal, "japanese", "japanese_literal")
            if not isinstance(japanese, str):
                errors.append(label + "literal has no actual Japanese text")
            if literal.get("runtime_binding_approved") is not False:
                errors.append(label + "literal claims runtime binding")
            blob = field(literal, "blob_sha256", "source_blob_sha256")
            if blob != sha(official/source):
                errors.append(label + "literal source hash differs")
            verified_literals.append({**literal, "argument_name": arg, "role": role, "japanese": japanese})
        table_records = e.get("required_source_table_translations", [])
        for t in table_records:
            source = t["source"]
            data = (official/source).read_text("utf8")
            start, end = t["source_file_literal_start"], t["source_file_literal_end"]
            token = data[start:end]
            if token != t["original_quoted_token"] or scanner.decode_c_string(token) != t["english_source_literal"]:
                errors.append(label + "supplementary source table token differs")
            if t.get("blob_sha256") != sha(official/source) or t.get("runtime_binding_approved") is not False:
                errors.append(label + "table provenance/runtime guard differs")
        sites = e.get("official_source_contracts", e.get("official_sites_reviewed", []))
        if {(s["source"], s["line"]) for s in sites} != {(s["source"], s["line"]) for s in original["official_source_contracts"]}:
            errors.append(label + "not all original sites were reviewed")
        normalized.append({"id": ident, "whole_message_en": original["english_whole_named_template"],
                           "whole_message_ja": ja, "argument_schema": sorted(source_names),
                           "typed_arguments": original["typed_arguments"], "printf_conversions": original["printf_conversions"],
                           "source_review_status": e.get("source_translation_review_status"),
                           "source_translation_approved_claim": e.get("source_translation_approved", False),
                           "requires_public_name_or_grammar_producer": bool(e.get("requires_public_name_or_grammar_producer")),
                           "omitted_grammar_arguments": omissions, "source_literal_translations": verified_literals,
                           "source_table_translations": table_records,
                           "helper_variants_ja": {k:v for k,v in variants.items() if k != "normal"},
                           "source_capture_constraints": e.get("source_capture_constraints", []),
                           "source_presentation_dependencies": e.get("source_presentation_dependencies", []),
                           "source_eligibility_notes": e.get("source_eligibility_notes", []),
                           "translation_notes": e.get("translation_notes", []),
                           "localization_disposition": e.get("localization_disposition", "translated-whole-source-frame"),
                           "original_source_contracts": original["official_source_contracts"],
                           "runtime_binding_approved": False, "runtime_integration": False})
    return errors, notes, normalized


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--official-source", type=Path, default=ROOT.parent / "official-source-audit/NetHack-5.0.0")
    parser.add_argument("--category", choices=("a", "b", "c", "d"), default="c")
    parser.add_argument("--batch", type=int)
    parser.add_argument("--input", type=Path, help="A specific prepared-English source-only author input")
    opts = parser.parse_args()
    core = module(ROOT/"locales/build-gameplay-catalog.py", "author_verify_core")
    scanner = module(ROOT/"tools/inventory_source.py", "author_verify_scanner")
    helper = module(HERE/"build-reviewed-translations.py", "author_verify_helper")
    summary = {"batches":[{"path":str(opts.input)}]} if opts.input else load(HERE/f"category-{opts.category}-batches.json")
    reports = []
    for b in summary["batches"]:
        input_path = Path(b["path"]) if opts.input else HERE/b["path"]
        batch = load(input_path)
        if opts.batch is not None and batch["batch"] != opts.batch:
            continue
        destination = input_path.parent if opts.input else HERE
        path = destination/batch["output_fragment_path"]
        if not path.exists():
            reports.append({"batch": batch["batch"], "status": "awaiting-authored-fragment"})
            continue
        initial_hash = sha(path)
        authored = load(path)
        errors, notes, normalized = verify(batch, authored, opts.official_source, core, scanner, helper)
        frozen_unchanged = all(sha(ROOT/p) == value for p,value in batch["frozen_phase3_sha256"].items())
        if not frozen_unchanged:
            errors.append("frozen inputs differ")
        if initial_hash != sha(path):
            errors.append("author file changed during read-only verification")
        category = batch.get("category", opts.category)
        report = {"schema_version":1, "category":category, "batch":batch["batch"],
                  "status":"source-schema-verified" if not errors else "source-schema-errors",
                  "authored_input":path.name, "authored_sha256":initial_hash, "errors":errors, "review_notes":notes,
                  "counts":{"authored_ids":len(normalized), "source_literal_records":sum(len(e["source_literal_translations"]) for e in normalized),
                             "source_table_records":sum(len(e["source_table_translations"]) for e in normalized),
                             "grammar_omission_entries":sum(bool(e["omitted_grammar_arguments"]) for e in normalized),
                             "helper_variant_templates":sum(len(e["helper_variants_ja"]) for e in normalized),
                             "requires_public_name_or_grammar_producer":sum(e["requires_public_name_or_grammar_producer"] for e in normalized),
                             "runtime_approved_ids":0},
                  "frozen_inputs_unchanged":frozen_unchanged,
                  "guard":"Schema/provenance validation does not prove Japanese meaning, selected-literal dataflow, native binding, C/Rust/Node/browser tests or complete localization.",
                  "runtime_integration":False}
        stem = input_path.stem if opts.input else f"category-{opts.category}-batch-{batch['batch']}"
        output = destination/f"{stem}.verification.json"
        output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
        if not errors:
            normalized_path=destination/f"{stem}.normalized.json"
            normalized_path.write_text(json.dumps({"schema_version":1,"category":category,"batch":batch["batch"],
                "provenance":authored.get("provenance",batch["provenance"]),"source_author_sha256":initial_hash,
                "runtime_integration":False,"runtime_binding_approved_count":0,"entries":normalized},ensure_ascii=False,indent=2)+"\n",encoding="utf8")
        reports.append({"batch":batch["batch"],"status":report["status"],"error_count":len(errors),"counts":report["counts"]})
    print(json.dumps(reports,ensure_ascii=False))


if __name__ == "__main__":
    main()
