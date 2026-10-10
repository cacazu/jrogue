"""2026-10-02, NGPL: source-only intermediate buffer census.

The original C lexer supplies token identity, offsets and lexical scopes.
No lexical edge is asserted to prove C control flow, aliasing or visibility.
Only this isolated directory receives outputs; no source or catalog is applied.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = ROOT.parent / "official-source-audit/NetHack-5.0.0"
INPUTS = {
    "native_producers": ROOT / "locales/phase6/native-producer-ledger.json",
    "dynamic_origins": ROOT / "locales/phase4/dynamic-origin-review.json",
    "selected_formats": ROOT / "tools/semantic-text/phase4-generated/dynamic-literals/audit.json",
    "selected_aliases": ROOT / "locales/phase4/reviewed-dynamic-translations.metadata.json",
}
BUILDERS = {
    "Strcpy", "Strcat", "Strncpy", "strcpy", "strcat", "strncpy",
    "strncat", "strlcpy", "strlcat", "memcpy", "memmove", "memset",
    "eos", "eos2", "strkitten", "strcasecpy", "strsubst", "strNsubst",
}
spec = importlib.util.spec_from_file_location("phase7_original_inventory", ROOT / "tools/inventory_source.py")
inv = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = inv
spec.loader.exec_module(inv)


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def signature(expressions):
    return tuple(tuple(token.text for token in inv.c_tokens(expr)) for expr in expressions)


def symbol(expression: str):
    """Recognize only an exact local name or eos(local), not C alias analysis."""
    parts = inv.c_tokens(expression)
    if len(parts) == 1 and parts[0].kind == "identifier":
        return parts[0].text, "direct-local-symbol"
    if len(parts) == 4 and parts[0].text in {"eos", "eos2"} and parts[1].text == "(" and parts[2].kind == "identifier" and parts[3].text == ")":
        return parts[2].text, "original-selected-append-address"
    return None, "opaque-field-pointer-offset-or-assignment"


def scan_file(relative: str, text: str):
    tokens = inv.c_tokens(text)
    starts = inv.lines_of(text)
    pairs = inv.delimiters(tokens)
    functions = inv.function_regions(tokens, pairs, starts)
    scopes, stack = [], []
    for index, token in enumerate(tokens):
        scopes.append(tuple(stack))
        if token.kind not in {"char", "string"}:
            if token.text == "{" and index in pairs:
                stack.append(token.start)
            elif token.text == "}" and stack and tokens[pairs.get(index, index)].start == stack[-1]:
                stack.pop()
    declarations = []
    for index, token in enumerate(tokens):
        if token.text != "char":
            continue
        # Deliberately bounded lexical declaration candidates. Casts,
        # parameters, pointer arrays and declarations with initializer calls
        # stay unbound; they do not acquire automatic producer certificates.
        previous = index - 1
        while previous >= 0 and tokens[previous].text not in {";", "{", "}"}:
            previous -= 1
        prefix = [item.text for item in tokens[previous + 1:index]]
        if any(word not in {"static", "const", "unsigned", "signed", "volatile", "register", "extern"} for word in prefix):
            continue
        end = index + 1
        while end < min(len(tokens), index + 256) and tokens[end].text not in {";", "{"}:
            end += 1
        if end >= len(tokens) or tokens[end].text != ";":
            continue
        segment = index + 1
        depth = 0
        for cursor in range(index + 1, end + 1):
            item = tokens[cursor]
            boundary = cursor == end or (item.text == "," and depth == 0)
            if boundary:
                part = tokens[segment:cursor]
                for pos, candidate in enumerate(part[:-1]):
                    if candidate.kind != "identifier" or part[pos + 1].text != "[":
                        continue
                    if any(t.text not in {"const", "volatile", "restrict"} for t in part[:pos]):
                        continue
                    opening = segment + pos + 1
                    closing = pairs.get(opening)
                    if closing is None or closing >= cursor:
                        continue
                    declarations.append({
                        "symbol": candidate.text, "declaration_offset": candidate.start,
                        "line": inv.at_line(candidate.start, starts),
                        "capacity_expression": text[tokens[opening].end:tokens[closing].start],
                        "lexical_scope": list(scopes[index]),
                        "original_storage_qualifiers": prefix,
                        "scope_status": "char-array-lexical-candidate-not-type-or-control-flow-proof",
                    })
                    break
                segment = cursor + 1
            elif item.kind not in {"char", "string"}:
                if item.text in {"(", "[", "{"}: depth += 1
                elif item.text in {")", "]", "}"}: depth -= 1

    def binding_for(name, offset, scope):
        matches = [decl for decl in declarations if decl["symbol"] == name and decl["declaration_offset"] < offset and tuple(decl["lexical_scope"]) == scope[:len(decl["lexical_scope"])]]
        return max(matches, key=lambda decl: decl["declaration_offset"]) if matches else None

    calls, escapes, returned, aliases = [], [], [], []
    for index, token in enumerate(tokens[:-1]):
        if token.kind != "identifier" or tokens[index + 1].text != "(":
            continue
        closing = pairs.get(index + 1)
        if closing is None or (closing + 1 < len(tokens) and tokens[closing + 1].text == "{"):
            continue
        if token.text in {"if", "while", "for", "switch", "sizeof", "_Alignof"}:
            continue
        arguments = inv.call_arguments(tokens, index + 1, closing, text)
        expressions = [argument["expression"] for argument in arguments]
        fn = inv.context_function(token.start, functions)
        scope = scopes[index]
        passed_buffers = []
        for ordinal, expression in enumerate(expressions):
            name, kind = symbol(expression)
            declaration = binding_for(name, token.start, scope)
            if declaration:
                passed_buffers.append({"argument_index": ordinal, "expression": expression,
                    "address_kind": kind, "declaration_candidate": declaration})
        if passed_buffers:
            escapes.append({"source": relative, "line": inv.at_line(token.start, starts),
                "start": token.start, "end": tokens[closing].end,
                "function_candidate": fn, "api": token.text,
                "passed_buffer_candidates": passed_buffers,
                "effect": "callee-read-write-escape-contract-required-not-inferred-from-name",
                "runtime_binding_approved": False})
        if token.text not in inv.FORMATTERS and token.text not in inv.MESSAGE_SINKS and token.text not in BUILDERS:
            continue
        record = {
            "source": relative, "line": inv.at_line(token.start, starts),
            "function_candidate": fn, "api": token.text,
            "start": token.start, "end": tokens[closing].end,
            "api_end": token.end, "opening_end": tokens[index + 1].end,
            "argument_expressions": expressions,
            "argument_spans": [{"start": arg["tokens"][0].start, "end": arg["tokens"][-1].end} if arg["tokens"] else None for arg in arguments],
            "lexical_scope": list(scope),
            "call_sha256": sha(text[token.start:tokens[closing].end].encode("utf-8")),
            "runtime_binding_approved": False,
        }
        if expressions:
            name, kind = symbol(expressions[0])
            record["destination_symbol_candidate"] = name
            record["destination_kind"] = kind
            record["destination_declaration_candidate"] = binding_for(name, token.start, scope)
        if token.text in {"Strcpy", "Strcat", "Strncpy", "strcpy", "strcat", "strncpy", "strncat", "strlcpy", "strlcat", "memcpy", "memmove"} and len(expressions)>1:
            source_name, source_kind = symbol(expressions[1])
            record["copy_source_candidate"] = {"expression": expressions[1], "address_kind": source_kind,
                "declaration_candidate": binding_for(source_name, token.start, scope),
                "status": "exact-source-operands-only-no-overlap-size-result-lifetime-or-publicness-proof"}
            literal_tokens = inv.c_tokens(expressions[1])
            if literal_tokens and all(item.kind == "string" for item in literal_tokens):
                value = "".join(inv.decode_c_string(item.text) for item in literal_tokens)
                record["literal_copy_source"] = {"english": value,
                    "source_id_candidate": inv.semantic_candidate("nethack.buffer.literal." + Path(relative).stem + "." + fn.lower() + "." + token.text.lower(), value),
                    "argument_schemas": [], "visibility_status": "exact-original-literal-only-consumer-and-input-invariant-review-required"}
        calls.append(record)
    for index, token in enumerate(tokens[:-1]):
        if token.text == "return":
            end=index+1
            while end<len(tokens) and tokens[end].text not in {";", "}"}: end+=1
            if end<=index+1: continue
            expression=text[tokens[index+1].start:tokens[end-1].end]
            name, kind = symbol(expression)
            declaration = binding_for(name, token.start, scopes[index])
            if declaration:
                returned.append({"source": relative, "line": inv.at_line(token.start, starts),
                    "start": token.start, "expression": expression, "address_kind": kind,
                    "function_candidate": inv.context_function(token.start, functions),
                    "declaration_candidate": declaration,
                    "status": "returned-buffer-needs-original-storage-duration-caller-owned-copy-ticket", "runtime_binding_approved": False})
        if token.text == "=" and index>0 and tokens[index-1].text not in {"=", "!", "<", ">"} and tokens[index+1].text != "=":
            right=tokens[index+1]
            if right.kind != "identifier": continue
            declaration=binding_for(right.text, token.start, scopes[index])
            if declaration:
                aliases.append({"source": relative, "line": inv.at_line(token.start, starts),
                    "start": token.start, "source_symbol": right.text,
                    "function_candidate": inv.context_function(token.start, functions),
                    "declaration_candidate": declaration,
                    "status": "assignment-operand-candidate-not-proven-pointer-alias-invalidate-on-unproven-use",
                    "runtime_binding_approved": False})
    # Separate source evidence collections; none implies native flow approval.
    return calls, declarations, functions, escapes, returned, aliases


def exact_call(row, calls, used):
    matches = [call for call in calls if call["start"] not in used and call["api"] == row["api"] and call["line"] == row["line"] and signature(call["argument_expressions"]) == signature(row["argument_expressions"])]
    if not matches:
        raise ValueError(f"Original token binding missing: {row['source']}:{row['line']} {row['api']}")
    result = matches[0]
    used.add(result["start"])
    return result


def origin_key(row):
    return row["source"], row["line"], row["api"]


def census(output=HERE / "generated"):
    documents = {key: load(path) for key, path in INPUTS.items()}
    producers = documents["native_producers"]["entries"]
    origins = documents["dynamic_origins"]["rows"]
    if len(producers) != 1591 or len(origins) != 963:
        raise ValueError("Frozen denominator changed; explicit review required")
    prepared = {origin_key(row) for row in documents["selected_formats"]["ledger"] if row["status"] == "source-selected-literal-contract-prepared"}
    prepared.update((evidence["source"], evidence["line"], entry["original_api"]) for entry in documents["selected_aliases"]["entries"] for evidence in entry["source_evidence"])
    if len(prepared) != 63:
        raise ValueError(f"Expected exactly 63 source-prepared dynamic origins, got {len(prepared)}")
    grouped_producers, grouped_origins = defaultdict(list), defaultdict(list)
    for row in producers: grouped_producers[row["source"]].append(row)
    for row in origins: grouped_origins[row["source"]].append(row)
    # All original core translation-unit files, not only files with a formatter.
    files = sorted(path.relative_to(SOURCE).as_posix() for path in (SOURCE / "src").glob("*.c"))
    all_producers, all_origins, builders, declarations, source_files = [], [], [], [], []
    escapes, returns, aliases = [], [], []
    for relative in files:
        raw = (SOURCE / relative).read_bytes()
        text, encoding = inv.read_text(SOURCE / relative)
        if text is None: raise ValueError("Unexpected binary core source")
        calls, decls, functions, file_escapes, file_returns, file_aliases = scan_file(relative, text)
        escapes.extend({"source_sha256": sha(raw), **row} for row in file_escapes)
        returns.extend({"source_sha256": sha(raw), **row} for row in file_returns)
        aliases.extend({"source_sha256": sha(raw), **row} for row in file_aliases)
        by_offset = {call["start"]: call for call in calls}
        source_files.append({"source": relative, "sha256": sha(raw), "bytes": len(raw), "encoding": encoding, "functions": len(functions), "lexical_buffer_declarations": len(decls)})
        declarations.extend({"source": relative, **decl} for decl in decls)
        used = set()
        bound_producers = []
        for row in grouped_producers[relative]:
            call = exact_call(row, calls, used)
            bound = {**deepcopy(row), "source_sha256": sha(raw), "source_call": call,
                     "dataflow_status": "exact-source-producer-only-consumer-control-flow-not-approved"}
            all_producers.append(bound)
            bound_producers.append(bound)
        used = set()
        for row in grouped_origins[relative]:
            call = exact_call(row, calls, used)
            expression = row["format_expression"] or ""
            name, kind = symbol(expression)
            scope = tuple(call["lexical_scope"])
            decl_matches = [decl for decl in decls if decl["symbol"] == name and decl["declaration_offset"] < call["start"] and tuple(decl["lexical_scope"]) == scope[:len(decl["lexical_scope"])]]
            decl = max(decl_matches, key=lambda item: item["declaration_offset"]) if decl_matches else None
            candidates = []
            rejected = []
            for producer in bound_producers:
                site = producer["source_call"]
                if producer["function_candidate"] != row["function_candidate"] or site.get("destination_symbol_candidate") != name or name is None:
                    continue
                destination = site.get("destination_declaration_candidate")
                same = decl is not None and destination is not None and decl["declaration_offset"] == destination["declaration_offset"]
                evidence = {"line": producer["line"], "source_call_start": site["start"], "id": producer.get("english_id_candidate"), "destination_declaration_offset": destination["declaration_offset"] if destination else None}
                if same and site["start"] < call["start"]:
                    candidates.append(evidence)
                else:
                    rejected.append({**evidence, "reason": "different-or-unproven-buffer-declaration-or-producer-after-consumer"})
            bound = {**deepcopy(row), "source_sha256": sha(raw), "source_call": call,
                     "format_symbol_kind": kind, "format_declaration_candidate": decl,
                     "phase4_source_origin_prepared": origin_key(row) in prepared,
                     "source_scope_formatter_candidates": candidates,
                     "rejected_same_symbol_candidates": rejected,
                     "dataflow_status": "lexical-scope-and-order-candidates-only-no-alias-control-flow-visibility-proof",
                     "runtime_binding_approved": False}
            all_origins.append(bound)
        builders.extend({**call, "source_sha256": sha(raw), "observation_status": "original-builder-or-address-call-only-not-visible-text-proof"} for call in calls if call["api"] in BUILDERS)
    if len(all_producers) != 1591 or len(all_origins) != 963:
        raise ValueError("Some frozen core origin lacked its original source file")
    unresolved = [row for row in all_origins if not row["phase4_source_origin_prepared"]]
    if len(unresolved) != 900:
        raise ValueError("Unresolved origin denominator mismatch")
    summary = {
        "schema_version": 1, "source_commit": documents["native_producers"]["source_commit"],
        "source_only": True, "runtime_binding_approved": False, "compiled": False,
        "inputs": [{"path": path.relative_to(ROOT).as_posix(), "sha256": sha(path.read_bytes())} for path in INPUTS.values()],
        "counts": {"core_source_files_scanned": len(source_files), "formatter_producers": len(all_producers),
                   "literal_format_producers": sum(row["resolution"] == "literal-format-lexically-resolved" for row in all_producers),
                   "dynamic_format_producers": sum(row["resolution"] != "literal-format-lexically-resolved" for row in all_producers),
                   "dynamic_output_origins": len(all_origins), "phase4_source_prepared_origins": len(prepared),
                   "unresolved_dynamic_output_origins": len(unresolved), "builder_or_address_calls": len(builders),
                   "char_array_declaration_candidates": len(declarations),
                   "calls_passing_scope_bound_buffer_candidates": len(escapes),
                   "returned_local_buffer_candidates": len(returns),
                   "assignment_buffer_operand_candidates": len(aliases),
                   "origins_with_scope_bound_formatter_candidates": sum(bool(row["source_scope_formatter_candidates"]) for row in unresolved),
                   "rejected_same_symbol_candidate_edges": sum(len(row["rejected_same_symbol_candidates"]) for row in all_origins),
                   "runtime_approved_added_ids": 0},
        "grouping": {"producer_api": dict(Counter(row["api"] for row in all_producers)),
                     "builder_api": dict(Counter(row["api"] for row in builders)),
                     "producer_destination": dict(Counter(row["source_call"]["destination_kind"] for row in all_producers)),
                     "unresolved_output_api": dict(Counter(row["api"] for row in unresolved)),
                     "unresolved_source_function": dict(sorted(Counter(row["source"] + "::" + row["function_candidate"] for row in unresolved).items()))},
        "limits": ["The denominator includes lexical declarations and null or inactive interfaces until source-reviewed; it is not 900 proven visible messages.",
                   "Scope/order exclusions fix lexical shadowing mistakes but are not a C alias, CFG, preprocessor, read/write or public-state analysis.",
                   "Every unproven write, call escape, alias, overlap, clipping, lifetime or returned/copied buffer requires an explicit owned producer contract or whole native English fallback.",
                   "No arbitrary English byte sequence selects an ID or translation; byte checks only validate a source-issued owned event.",
                   "Do not sum formatter, builder, source-label and direct-output denominators: one public message may use several producer stages."],
    }
    write(output / "producer-census.json", {"schema_version": 1, "source_only": True, "entries": all_producers})
    write(output / "dynamic-origin-census.json", {"schema_version": 1, "source_only": True, "entries": all_origins})
    write(output / "builder-census.json", {"schema_version": 1, "source_only": True, "entries": builders, "declarations": declarations})
    write(output / "flow-census.json", {"schema_version": 1, "source_only": True, "runtime_binding_approved": False,
        "callee_buffer_operands": escapes, "returned_buffers": returns, "assignment_operands": aliases,
        "limits": "Source/scoped operands only. Indirect function pointers, arbitrary casts/arithmetic/fields, generic C types, points-to sets, path conditions and actual capacities remain unproven; no automatic semantic binding."})
    write(output / "source-files.json", {"source_commit": summary["source_commit"], "files": source_files})
    for name in ("producer-census.json", "dynamic-origin-census.json", "builder-census.json", "flow-census.json", "source-files.json"):
        path = output / name
        summary.setdefault("artifacts", []).append({"path": name, "bytes": path.stat().st_size, "sha256": sha(path.read_bytes())})
    write(output / "census-summary.json", summary)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=HERE / "generated")
    args = parser.parse_args()
    destination = args.output.resolve()
    if not destination.is_relative_to(HERE.resolve()):
        raise ValueError("Only the owned Phase7 directory may receive outputs")
    print(json.dumps(census(destination)["counts"], ensure_ascii=False))
