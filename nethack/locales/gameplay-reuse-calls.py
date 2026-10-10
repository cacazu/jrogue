#!/usr/bin/env python3
"""Extract JNetHack source-paired message translations without runtime matching.

Changed 2026-10-02: this extraction/adaptation program is new work. The Japanese
strings it reads are JNetHack-derived, with Japanization copyright belonging to
the original authors listed in READMEj1.txt, under the NetHack General Public
License. It reads the pinned Git blobs; the adjacent working tree is never an
input. This program does not execute either game, mutate Git, or claim runtime
translation coverage.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path


PIN = "25adee135c4bbd43ac8567664f600b565332435c"
ORIGIN = "https://github.com/jnethack/jnethack-alpha.git"
DEFAULT_CHECKOUT = Path(r"C:\Users\kit\gameme\jnethack\jnethack\source")
SINKS = frozenset(
    "pline pline_The You Your You_hear You_feel You_see You_cant There "
    "verbalize Norep raw_printf".split()
)
DIRECTIVE = re.compile(r"^\s*#\s*(if|ifdef|ifndef|elif|else|endif)\b(.*)$")
JP_ZERO = re.compile(r"^\s*0\s*/\*\s*JP(?::T)?\s*\*/(?:\s*/\*.*?\*/)*\s*$")
JAPANESE = re.compile(r"[\u3040-\u30ff\u3400-\u9fff]")
AUTHORS = [
    "Issei Numata", "HAMADA Naoki", "Shigehiro Miyashita",
    "Tomoyuki Shiraishi", "Kazuhiro FUjieda", "Kunedog",
    "Shinkou Awatsu", "Takeshi Nishimura", "高田幸治",
    "SHIRAKATA Kentaro", "板倉充洋", "樋口雄一", "Haruko Numata",
]
PRINTF = re.compile(
    r"%(?:(\d+)\$)?([-+ #0']*)(\*|\d+)?(?:\.(\*|\d+))?"
    r"(hh|ll|[hljztL])?([diuoxXfFeEgGaAcspn%])"
)


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def load_scanner():
    path = Path(__file__).resolve().parents[1] / "tools" / "inventory_source.py"
    spec = importlib.util.spec_from_file_location("nethack_inventory_reuse_scanner", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import preserved source scanner: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def pinned_blob(checkout: Path, path: str) -> bytes:
    """No HEAD alias and no working-file fallback are permitted."""
    return subprocess.run(
        ["git", "-C", str(checkout), "show", f"{PIN}:{path}"],
        check=True, capture_output=True,
    ).stdout


def normalized_source(raw: bytes) -> str:
    # Blob hashes below retain original bytes; line parsing normalizes CR only.
    return raw.decode("utf-8").replace("\r\n", "\n").replace("\r", "")


def paired_blocks(text: str) -> list[dict]:
    """Respect nested directives; accept only a JP-zero block with one else."""
    stack: list[dict] = []
    pairs: list[dict] = []
    offset = 0
    for number, line in enumerate(text.splitlines(keepends=True), 1):
        match = DIRECTIVE.match(line.rstrip("\n"))
        if match:
            kind, condition = match.groups()
            if kind in {"if", "ifdef", "ifndef"}:
                stack.append({
                    "eligible": kind == "if" and bool(JP_ZERO.fullmatch(condition)),
                    "opening_line": number,
                    "english_start": offset + len(line),
                    "english_line": number + 1,
                    "else_start": None, "japanese_start": None,
                    "has_elif": False,
                })
            elif kind == "elif" and stack:
                stack[-1]["has_elif"] = True
            elif kind == "else" and stack:
                node = stack[-1]
                if node["else_start"] is not None:
                    node["has_elif"] = True  # reject malformed multiple else
                node["else_start"] = offset
                node["japanese_start"] = offset + len(line)
                node["japanese_line"] = number + 1
            elif kind == "endif" and stack:
                node = stack.pop()
                if node["eligible"] and not node["has_elif"] and node["else_start"] is not None:
                    pairs.append({
                        "opening_line": node["opening_line"],
                        "english_line": node["english_line"],
                        "japanese_line": node["japanese_line"],
                        "english": text[node["english_start"]:node["else_start"]],
                        "japanese": text[node["japanese_start"]:offset],
                    })
        offset += len(line)
    if stack:
        raise ValueError("Unterminated preprocessor conditional in pinned source")
    return sorted(pairs, key=lambda row: row["opening_line"])


def canonical(tokens) -> tuple:
    return tuple((token.kind, token.text) for token in tokens)


def complete_single_call(text: str, scanner) -> dict | None:
    """Require one complete call with a compile-time literal format expression.

    Standard C adjacent string tokens are one literal expression. Their original
    tokens remain in exact source-call identity rather than being normalized.
    """
    tokens = scanner.c_tokens(text)
    if len(tokens) < 5 or tokens[0].kind != "identifier" or tokens[0].text not in SINKS:
        return None
    if tokens[1].text != "(" or tokens[-1].text != ";":
        return None
    pairs = scanner.delimiters(tokens)
    closing = pairs.get(1)
    if closing != len(tokens) - 2:
        return None
    args = scanner.call_arguments(tokens, 1, closing, text)
    if not args or not args[0]["tokens"] or not all(token.kind == "string" for token in args[0]["tokens"]):
        return None
    literal = "".join(scanner.decode_c_string(token.text) for token in args[0]["tokens"])
    return {
        "api": tokens[0].text,
        "literal": literal,
        "call": canonical(tokens[:-1]),
        "nonformat_args": tuple(canonical(arg["tokens"]) for arg in args[1:]),
        "argument_expressions": [arg["expression"] for arg in args[1:]],
        "format_specifiers": [m.group() for m in scanner.PRINTF_PATTERN.finditer(literal)],
        "call_line_offset": text.count("\n", 0, tokens[0].start),
    }


def official_calls(text: str, scanner, by_line: dict[int, list[dict]], sinks=None) -> dict[tuple, list[dict]]:
    sinks = SINKS if sinks is None else sinks
    tokens = scanner.c_tokens(text)
    pairs = scanner.delimiters(tokens)
    line_starts = scanner.lines_of(text)
    calls: dict[tuple, list[dict]] = {}
    for index, token in enumerate(tokens[:-1]):
        if token.kind != "identifier" or token.text not in sinks or tokens[index + 1].text != "(":
            continue
        closing = pairs.get(index + 1)
        if closing is None:
            continue
        line = scanner.at_line(token.start, line_starts)
        records = [
            record for record in by_line.get(line, [])
            if record["api"] == token.text and record["english_id_candidate"]
        ]
        if records:
            calls.setdefault(canonical(tokens[index:closing + 1]), []).extend(records)
    return calls


def literal_calls(text: str, scanner) -> list[dict]:
    """Lex individual source calls within a JP branch; import no branch logic."""
    tokens = scanner.c_tokens(text)
    pairs = scanner.delimiters(tokens)
    result = []
    for index, token in enumerate(tokens[:-1]):
        if token.kind != "identifier" or token.text not in scanner.MESSAGE_SINKS or tokens[index + 1].text != "(":
            continue
        closing = pairs.get(index + 1)
        if closing is None or (closing + 1 < len(tokens) and tokens[closing + 1].text == "{"):
            continue
        args = scanner.call_arguments(tokens, index + 1, closing, text)
        fmt_index = scanner.MESSAGE_SINKS[token.text]
        if fmt_index >= len(args):
            continue
        fmt_tokens = args[fmt_index]["tokens"]
        if not fmt_tokens or not all(part.kind == "string" for part in fmt_tokens):
            continue
        literal = "".join(scanner.decode_c_string(part.text) for part in fmt_tokens)
        printf_like = token.text not in scanner.PLAIN_TEXT_SINKS
        result.append({
            "api": token.text, "literal": literal,
            "call": canonical(tokens[index:closing + 1]),
            "format_argument_index": fmt_index,
            "format_semantics": "printf-like" if printf_like else "plain-display-text",
            "fixed_prefix_args": tuple(canonical(arg["tokens"]) for arg in args[:fmt_index]),
            "tail_args": tuple(canonical(arg["tokens"]) for arg in args[fmt_index + 1:]),
            "argument_expressions": [arg["expression"] for arg in args[fmt_index + 1:]],
            "all_argument_expressions": [arg["expression"] for arg in args],
            "format_specifiers": [m.group() for m in PRINTF.finditer(literal)] if printf_like else [],
            "call_line_offset": text.count("\n", 0, token.start),
        })
    return result


def printf_argument_contract(literal: str, count: int) -> list[dict] | None:
    """Known C variadic contracts, retaining each complete formatting token."""
    contract = []
    offset = 0
    while offset < len(literal):
        percent = literal.find("%", offset)
        if percent < 0:
            break
        match = PRINTF.match(literal, percent)
        if match is None:
            return None
        position, flags, width, precision, length, conversion = match.groups()
        offset = match.end()
        if position or conversion in {"p", "n"}:
            return None
        if conversion == "%":
            if match.group() != "%%":
                return None
            continue
        length = length or ""
        if conversion in "di":
            if length not in {"", "hh", "h", "l", "ll", "j", "z", "t"}:
                return None
            c_type = "signed-integer"
        elif conversion in "uoxX":
            if length not in {"", "hh", "h", "l", "ll", "j", "z", "t"}:
                return None
            c_type = "unsigned-integer"
        elif conversion in "fFeEgGaA":
            c_type = "floating-number"
            if length not in {"", "l", "L"}:
                return None
        elif conversion == "s":
            if length:
                return None  # wide-string binding is deliberately unsupported
            c_type = "string"
        elif conversion == "c":
            if length:
                return None
            c_type = "character-promoted-to-int"
        else:
            return None
        for role, setting in (("width", width), ("precision", precision)):
            if setting == "*":
                contract.append({
                    "role": role, "c_type": "signed-integer", "c_length_modifier": "",
                    "printf_token": match.group(), "format_offset": percent,
                })
        contract.append({
            "role": "value", "c_type": c_type, "c_length_modifier": length,
            "printf_token": match.group(), "format_offset": percent,
        })
    return contract if len(contract) == count else None


def compatible_calls(en: dict, ja: dict) -> dict | None:
    """Require exact slots or a unique, type-correct expression permutation."""
    if en["api"] != ja["api"] or en["format_semantics"] != ja["format_semantics"]:
        return None
    if en["fixed_prefix_args"] != ja["fixed_prefix_args"]:
        return None
    if en["format_semantics"] == "plain-display-text":
        if en["tail_args"] != ja["tail_args"]:
            return None
        return {"permuted": False, "japanese_to_official_arg_map": {}, "typed_arguments": []}
    en_schema = printf_argument_contract(en["literal"], len(en["tail_args"]))
    ja_schema = printf_argument_contract(ja["literal"], len(ja["tail_args"]))
    if en_schema is None or ja_schema is None or len(en_schema) != len(ja_schema):
        return None
    if en["tail_args"] == ja["tail_args"] and en["format_specifiers"] == ja["format_specifiers"]:
        order = list(range(len(en_schema)))
    else:
        # Repeated expressions cannot prove which position a translator moved.
        if len(set(en["tail_args"])) != len(en["tail_args"]) or len(set(ja["tail_args"])) != len(ja["tail_args"]):
            return None
        if set(en["tail_args"]) != set(ja["tail_args"]):
            return None
        if en["format_specifiers"].count("%%") != ja["format_specifiers"].count("%%"):
            return None
        order = [en["tail_args"].index(expression) for expression in ja["tail_args"]]
    compared = ("role", "c_type", "c_length_modifier", "printf_token")
    for ja_position, en_position in enumerate(order):
        if any(ja_schema[ja_position][key] != en_schema[en_position][key] for key in compared):
            return None
    return {
        "permuted": order != list(range(len(order))),
        "japanese_to_official_arg_map": {
            f"arg_{ja_position + 1}": f"arg_{en_position + 1}"
            for ja_position, en_position in enumerate(order)
        },
        "typed_arguments": [
            {"name": f"arg_{position + 1}", **schema,
             "source_expression": en["argument_expressions"][position]}
            for position, schema in enumerate(en_schema)
        ],
    }


def unique_branch_pairs(english: list[dict], japanese: list[dict]) -> tuple[list[tuple], dict]:
    """Accept only one-to-one edges; source order never resolves ambiguity."""
    edges: dict[int, list[tuple]] = {}
    reverse: Counter = Counter()
    for en_index, en in enumerate(english):
        for ja_index, ja in enumerate(japanese):
            if not JAPANESE.search(ja["literal"]):
                continue
            mapping = compatible_calls(en, ja)
            if mapping is not None:
                edges.setdefault(en_index, []).append((ja_index, mapping))
                reverse[ja_index] += 1
    accepted = []
    ambiguous = 0
    for en_index, matches in edges.items():
        if len(matches) != 1 or reverse[matches[0][0]] != 1:
            ambiguous += 1
            continue
        ja_index, mapping = matches[0]
        accepted.append((english[en_index], japanese[ja_index], mapping))
    return accepted, {"ambiguous_english_calls": ambiguous, "unpaired_english_calls": len(english) - len(edges)}


def broader_block_candidates(block: dict, relative: str, blob_hash: str, original_blob: bytes,
                             lookup: dict, scanner, broad_counts: Counter) -> list[dict]:
    english = literal_calls(block["english"], scanner)
    japanese = literal_calls(block["japanese"], scanner)
    broad_counts["literal_english_calls_in_paired_blocks"] += len(english)
    broad_counts["literal_japanese_calls_in_paired_blocks"] += len(japanese)
    pairs, rejected = unique_branch_pairs(english, japanese)
    broad_counts.update(rejected)
    rows = []
    for en, ja, mapping in pairs:
        matches = lookup.get(en["call"], [])
        if not matches:
            broad_counts["rejected_no_exact_official_source_call"] += 1
            continue
        sites = [
            {key: record[key] for key in (
                "source", "line", "function_candidate", "api", "format_argument_index",
                "argument_expressions", "argument_binding", "english_id_candidate",
            )}
            for record in matches
        ]
        ids = sorted({record["english_id_candidate"] for record in matches})
        broad_counts["accepted_unique_pairs_before_id_deduplication"] += 1
        broad_counts["accepted_pairs_with_argument_permutation"] += int(mapping["permuted"])
        rows.append({
            "en": en["literal"], "ja": ja["literal"], "api": en["api"], "source": relative,
            "english_line": block["english_line"] + en["call_line_offset"],
            "japanese_line": block["japanese_line"] + ja["call_line_offset"],
            "jp_block_line": block["opening_line"],
            "official_ids": ids,
            "official_call_sites": sorted(sites, key=lambda row: (row["line"], row["english_id_candidate"])),
            "format_argument_index": en["format_argument_index"],
            "format_semantics": en["format_semantics"],
            "format_specifiers": en["format_specifiers"],
            "japanese_format_specifiers": ja["format_specifiers"],
            "argument_expressions": en["argument_expressions"],
            "japanese_argument_expressions": ja["argument_expressions"],
            "official_signature_arguments": en["all_argument_expressions"],
            "japanese_signature_arguments": ja["all_argument_expressions"],
            "japanese_to_official_arg_map": mapping["japanese_to_official_arg_map"],
            "argument_permutation": mapping["permuted"],
            "typed_arguments": mapping["typed_arguments"],
            "canonical_argument_evidence": {
                "english": en["tail_args"], "japanese": ja["tail_args"],
            },
            "jnet_blob_sha256": blob_hash, "official_blob_sha256": sha256(original_blob),
            "evidence": "unique-paired-JP-branch-call-with-exact-English-call-in-official-source",
            "matching_scope": "offline-source-only",
            "japanese_authorship": "JNetHack Japanization authors",
            "runtime_integration": False,
            "helper_grammar_requires_review": en["api"] in {
                "pline_The", "You", "You1", "Your", "Your1", "You_hear", "You_hear1",
                "You_feel", "You_see", "You_cant", "There",
            },
            "control_flow_imported": False,
            "paired_branch_context_requires_review": True,
        })
    return rows


def extract(checkout: Path, official: Path, catalog: Path) -> dict:
    scanner = load_scanner()
    data = json.loads(catalog.read_text(encoding="utf-8"))
    catalog_by_file: dict[str, dict[int, list[dict]]] = {}
    for record in data["messages"]:
        if record["source"].startswith("src/") and record["api"] in scanner.MESSAGE_SINKS:
            catalog_by_file.setdefault(record["source"], {}).setdefault(record["line"], []).append(record)
    tracked = subprocess.run(
        ["git", "-C", str(checkout), "ls-tree", "-r", "--name-only", PIN, "src"],
        capture_output=True, check=True,
    ).stdout.decode("utf-8").splitlines()
    files = sorted(path for path in tracked if path.startswith("src/") and path.endswith(".c"))
    counts: Counter = Counter({"pinned_src_c_files": len(files)})
    broad_counts: Counter = Counter()
    inputs: dict[str, dict] = {}
    candidates: list[dict] = []
    broad_rows: list[dict] = []
    rejections: list[dict] = []
    for relative in files:
        blob = pinned_blob(checkout, relative)
        inputs[relative] = {"commit": PIN, "sha256": sha256(blob), "bytes": len(blob)}
        translated = normalized_source(blob)
        blocks = paired_blocks(translated)
        counts["jp_zero_else_blocks"] += len(blocks)
        official_file = official / relative
        lookup = None
        original_blob = official_file.read_bytes() if official_file.is_file() else None
        if original_blob is not None:
            lookup = official_calls(normalized_source(original_blob), scanner,
                                    catalog_by_file.get(relative, {}), scanner.MESSAGE_SINKS)
            for block in blocks:
                if JAPANESE.search(block["japanese"]):
                    broad_rows.extend(broader_block_candidates(
                        block, relative, inputs[relative]["sha256"], original_blob,
                        lookup, scanner, broad_counts,
                    ))
        for block in blocks:
            if not JAPANESE.search(block["japanese"]):
                continue
            counts["japanese_branch_blocks"] += 1
            en = complete_single_call(block["english"], scanner)
            ja = complete_single_call(block["japanese"], scanner)
            if en is None or ja is None or en["api"] != ja["api"]:
                continue
            counts["single_literal_same_sink_pairs"] += 1
            if en["nonformat_args"] != ja["nonformat_args"]:
                counts["rejected_changed_argument_expressions"] += 1
                continue
            if en["format_specifiers"] != ja["format_specifiers"]:
                counts["rejected_changed_printf_token_order"] += 1
                continue
            if original_blob is None:
                counts["rejected_missing_official_file"] += 1
                continue
            if lookup is None:
                lookup = official_calls(normalized_source(original_blob), scanner, catalog_by_file.get(relative, {}))
            matches = lookup.get(en["call"], [])
            if not matches:
                counts["rejected_no_exact_official_call"] += 1
                continue
            # Distinct source call sites remain explicit. A parent may produce
            # one catalog entry per semantic ID, rejecting translation conflicts.
            sites = [
                {key: record[key] for key in (
                    "source", "line", "function_candidate", "api", "format_argument_index",
                    "argument_expressions", "argument_binding", "english_id_candidate",
                )}
                for record in matches
            ]
            sites = sorted(sites, key=lambda row: (row["line"], row["english_id_candidate"]))
            ids = sorted({record["english_id_candidate"] for record in matches})
            row = {
                "en": en["literal"], "ja": ja["literal"],
                "api": en["api"], "source": relative,
                "english_line": block["english_line"] + en["call_line_offset"],
                "japanese_line": block["japanese_line"] + ja["call_line_offset"],
                "jp_block_line": block["opening_line"],
                "official_ids": ids, "official_call_sites": sites,
                "format_specifiers": en["format_specifiers"],
                "argument_expressions": en["argument_expressions"],
                "jnet_blob_sha256": inputs[relative]["sha256"],
                "official_blob_sha256": sha256(original_blob),
                "evidence": "complete-C-call-token-equality-in-same-official-file",
                "matching_scope": "offline-source-only",
                "japanese_authorship": "JNetHack Japanization authors",
                "runtime_integration": False,
                "helper_grammar_requires_review": en["api"] in {
                    "pline_The", "You", "Your", "You_hear", "You_feel", "You_see", "You_cant", "There",
                },
            }
            candidates.append(row)
            counts["exact_official_call_candidates"] += 1
            counts["formatted_candidates" if any(t != "%%" for t in row["format_specifiers"]) else "literal_only_candidates"] += 1
            if len(ids) > 1:
                counts["candidates_with_multiple_official_ids"] += 1
    counts["distinct_official_ids"] = len({id_ for row in candidates for id_ in row["official_ids"]})
    conflicts: dict[str, set[str]] = {}
    for row in candidates:
        for id_ in row["official_ids"]:
            conflicts.setdefault(id_, set()).add(row["ja"])
    counts["official_ids_with_conflicting_japanese_candidates"] = sum(len(values) > 1 for values in conflicts.values())
    counts["conservative_exact_official_call_candidates"] = counts["exact_official_call_candidates"]
    conservative_ids = {id_ for row in candidates for id_ in row["official_ids"]}
    broad_signatures: dict[str, set[tuple]] = {}
    for row in broad_rows:
        signature = (row["ja"], tuple(sorted(row["japanese_to_official_arg_map"].items())))
        for id_ in row["official_ids"]:
            broad_signatures.setdefault(id_, set()).add(signature)
    conflicting_ids = {id_ for id_, variants in broad_signatures.items() if len(variants) > 1}
    broader_candidates = []
    for row in broad_rows:
        kept_ids = sorted(set(row["official_ids"]) - conservative_ids - conflicting_ids)
        broad_counts["already_conservative_id_occurrences"] += len(set(row["official_ids"]) & conservative_ids)
        if kept_ids:
            row["official_ids"] = kept_ids
            row["official_call_sites"] = [
                site for site in row["official_call_sites"]
                if site["english_id_candidate"] in kept_ids
            ]
            broader_candidates.append(row)
    broad_counts["ids_rejected_for_conflicting_japanese_literal_or_argument_mapping"] = len(conflicting_ids - conservative_ids)
    broad_counts["additional_source_pair_rows"] = len(broader_candidates)
    additional_ids = {id_ for row in broader_candidates for id_ in row["official_ids"]}
    broad_counts["additional_unique_official_ids"] = len(additional_ids)
    broad_counts["total_unique_official_ids_with_conservative_core"] = len(conservative_ids | additional_ids)
    broad_counts["additional_rows_with_argument_permutation"] = sum(row["argument_permutation"] for row in broader_candidates)
    broad_counts["additional_formatted_rows"] = sum(
        row["format_semantics"] == "printf-like" and any(token != "%%" for token in row["format_specifiers"])
        for row in broader_candidates
    )
    notices = {}
    for relative in ("READMEj1.txt", "dat/license"):
        blob = pinned_blob(checkout, relative)
        inputs[relative] = {"commit": PIN, "sha256": sha256(blob), "bytes": len(blob)}
        notices[relative] = normalized_source(blob)
    return {
        "schema_version": 1,
        "pin": PIN, "origin": ORIGIN,
        "source_authors": AUTHORS,
        "license": "NetHack General Public License; Japanization follows original dat/license",
        "change_notice": "2026-10-02: Codex extracted source pairs and recorded provenance; Japanese strings retain JNetHack authorship.",
        "counts": dict(sorted(counts.items())),
        "broader_counts": dict(sorted(broad_counts.items())),
        "source_catalog_sha256": sha256(catalog.read_bytes()),
        "input_blobs": inputs, "notices": notices,
        "candidates": candidates, "rejections": rejections,
        "broader_candidates": broader_candidates,
        "all_candidates": candidates + broader_candidates,
        "broader_rejected_conflicting_ids": sorted(conflicting_ids - conservative_ids),
        "runtime_integration": False,
        "limitations": [
            "The conservative core accepts complete single-call JP/JP:T branches; the additive broader scope lexes uniquely compatible individual calls in the same paired branches.",
            "Adjacent C strings are one compile-time literal expression; inline JP comments are excluded.",
            "Nested directives are respected and alternatives with elif are rejected.",
            "Call identity is exact after removing C whitespace/comments; arguments and ordered printf tokens must agree.",
            "A broader argument permutation requires distinct identical expression tokens and an explicit one-to-one printf role/type/full-token mapping; ambiguous pairings or conflicting Japanese variants are rejected.",
            "Broader source-pair context still requires review; no Japanese control-flow or gameplay implementation is imported.",
            "Multiple official source occurrences are retained explicitly; catalog conflicts need parent resolution.",
            "Helper API prefixes, grammar and dynamic public entity names require presentation-boundary binding.",
            "This is an offline source pairing report, not runtime English reverse mapping or gameplay coverage.",
        ],
    }


def self_test() -> dict:
    import unittest
    scanner = load_scanner()

    class ParserTests(unittest.TestCase):
        def test_simple_pair(self):
            rows = paired_blocks('#if 0 /*JP:T*/\nYou("hungry.");\n#else\nYou("空腹だ．");\n#endif\n')
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["english_line"], 2)
            self.assertEqual(rows[0]["japanese_line"], 4)

        def test_elif_rejected(self):
            self.assertEqual(paired_blocks('#if 0 /*JP*/\na();\n#elif X\nb();\n#else\nc();\n#endif\n'), [])

        def test_trailing_comment_marker(self):
            rows = paired_blocks('#if 0 /*JP*//* translator explanation */\npline("x");\n#else\npline("日");\n#endif\n')
            self.assertEqual(len(rows), 1)
            self.assertEqual(paired_blocks('#if 0 /*JP:C*/\npline("x");\n#else\npline("日");\n#endif\n'), [])

        def test_nested_else_belongs_to_inner(self):
            rows = paired_blocks('#if 0 /*JP*/\n#if X\na();\n#else\nb();\n#endif\n#else\npline("日");\n#endif\n')
            self.assertEqual(len(rows), 1)
            self.assertIn('b();', rows[0]["english"])
            self.assertEqual(rows[0]["japanese_line"], 8)
            self.assertIsNone(complete_single_call(rows[0]["english"], scanner))

        def test_exact_call_preserves_string_and_arguments(self):
            left = complete_single_call('pline("%s: %03d", xname(o), n);', scanner)
            right = complete_single_call('pline /* c */ ("%s：%03d", xname ( o ), n);', scanner)
            self.assertEqual(left["nonformat_args"], right["nonformat_args"])
            self.assertEqual(left["format_specifiers"], ["%s", "%03d"])
            self.assertNotEqual(left["call"], right["call"])

        def test_second_statement_rejected_and_c_concatenation_supported(self):
            self.assertIsNone(complete_single_call('pline("x"); return;', scanner))
            self.assertEqual(complete_single_call('pline("x" "y");', scanner)["literal"], "xy")
            self.assertIsNone(complete_single_call('pline(PREFIX "x");', scanner))

        def test_nested_argument(self):
            row = complete_single_call('You("%s", condition ? foo(a,b) : bar(a));', scanner)
            self.assertEqual(len(row["argument_expressions"]), 1)

        def test_broader_multiple_calls_unique_by_expression(self):
            english = literal_calls('if (x) pline("%s hurts", name(a)); else pline("%s heals", name(b));', scanner)
            japanese = literal_calls('if (x) pline("%sが傷ついた", name(a)); else pline("%sが回復した", name(b));', scanner)
            rows, rejected = unique_branch_pairs(english, japanese)
            self.assertEqual(len(rows), 2)
            self.assertEqual(rejected["ambiguous_english_calls"], 0)

        def test_broader_same_sink_no_args_is_ambiguous(self):
            english = literal_calls('pline("hurts"); pline("heals");', scanner)
            japanese = literal_calls('pline("傷ついた"); pline("回復した");', scanner)
            rows, rejected = unique_branch_pairs(english, japanese)
            self.assertEqual(rows, [])
            self.assertEqual(rejected["ambiguous_english_calls"], 2)

        def test_broader_permutation_typed_mapping(self):
            en = literal_calls('pline("%s: %d", name, number);', scanner)[0]
            ja = literal_calls('pline("%d：%s", number, name);', scanner)[0]
            mapping = compatible_calls(en, ja)
            self.assertTrue(mapping["permuted"])
            self.assertEqual(mapping["japanese_to_official_arg_map"], {"arg_1": "arg_2", "arg_2": "arg_1"})

        def test_broader_permutation_duplicate_expressions_rejected(self):
            en = literal_calls('pline("%s %d %s", name, number, name);', scanner)[0]
            ja = literal_calls('pline("%s %s %d", name, name, number);', scanner)[0]
            self.assertIsNone(compatible_calls(en, ja))

        def test_broader_width_and_radix_are_not_erased(self):
            en = literal_calls('raw_printf("%03o", value);', scanner)[0]
            ja = literal_calls('raw_printf("八進数%o", value);', scanner)[0]
            self.assertIsNone(compatible_calls(en, ja))
            self.assertEqual(printf_argument_contract("%*.*s", 3)[0]["role"], "width")
            self.assertEqual(printf_argument_contract("%*.*s", 3)[1]["role"], "precision")
            self.assertEqual(printf_argument_contract("%*.*s", 3)[2]["c_type"], "string")

        def test_broader_plain_sink_fixed_arguments_are_checked(self):
            en = literal_calls('putstr(win, ATR_NONE, "Hello");', scanner)[0]
            ja = literal_calls('putstr(win, ATR_NONE, "こんにちは");', scanner)[0]
            changed = literal_calls('putstr(other, ATR_NONE, "こんにちは");', scanner)[0]
            self.assertIsNotNone(compatible_calls(en, ja))
            self.assertIsNone(compatible_calls(en, changed))

        def test_broader_known_contract_only(self):
            self.assertIsNone(printf_argument_contract("%p", 1))
            self.assertIsNone(printf_argument_contract("%n", 1))
            self.assertIsNone(printf_argument_contract("%1$s", 1))
            self.assertIsNone(printf_argument_contract("%ls", 1))
            self.assertIsNone(printf_argument_contract("%Ld", 1))
            self.assertIsNone(printf_argument_contract("%s", 0))

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ParserTests)
    result = unittest.TestResult()
    suite.run(result)
    if result.errors or result.failures:
        raise AssertionError(result.errors + result.failures)
    return {"tests": result.testsRun, "failures": len(result.failures), "errors": len(result.errors)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkout", type=Path, default=DEFAULT_CHECKOUT)
    parser.add_argument("--official-source", type=Path, default=Path("official-source-audit/NetHack-5.0.0"))
    parser.add_argument("--catalog", type=Path, default=Path("nethack/catalog/source-text-messages.json"))
    parser.add_argument("--output", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        print(json.dumps(self_test()))
    if args.output:
        report = extract(args.checkout, args.official_source, args.catalog)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
        print(json.dumps(report["counts"], sort_keys=True))
        print(json.dumps(report["broader_counts"], sort_keys=True))
    elif not args.self_test:
        report = extract(args.checkout, args.official_source, args.catalog)
        print(json.dumps(report["counts"], sort_keys=True))
        print(json.dumps(report["broader_counts"], sort_keys=True))


if __name__ == "__main__":
    main()
