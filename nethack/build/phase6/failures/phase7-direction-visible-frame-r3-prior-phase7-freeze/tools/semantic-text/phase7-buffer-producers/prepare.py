"""NGPL, 2026-10-02: bounded exact-source Phase7 prototype, never applied.

Seven original formatter branches feed six original accepted output sites.
No generic English-pattern rewrite, extra native query, alias inference,
precision-bound text or unknown name producer is enabled by this preparation.
"""
from __future__ import annotations
from collections import defaultdict
from copy import deepcopy
import difflib
import importlib.util
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("phase7_census", HERE / "census.py")
census = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = census
spec.loader.exec_module(census)
ROOT, SOURCE = census.ROOT, census.SOURCE

# These are explicit source-review contracts, not an automatically discovered
# publicness rule. Arbitrary names/table variables are not admitted as keys.
CONTRACTS = [
    {"source": "src/cmd.c", "function": "doc_extcmd_flagstr", "buffer": "qbuf", "capacity": "QBUFSZ", "consumer_line": 538, "consumer": "add_menu_str", "kind": "NH_TEXT_MENU_ROW",
     "producer_lines": [536], "types": [["const char *"]],
     "public_arguments": ["The original visctrl(cmd_from_func(do_reqmenu)) result is the complete already-public technical input key; not a monster/object/helper English label."],
     "ja": ["[m] コマンドは「{arg_1:%s}」の前置キーを受け付ける"]},
    {"source": "src/cmd.c", "function": "help_dir", "buffer": "buf", "capacity": "BUFSZ", "consumer_line": 4259, "consumer": "putstr", "kind": "NH_TEXT_PUTSTR",
     "producer_lines": [4258], "types": [["int"]],
     "public_arguments": ["Capture the original already-selected sym once as promoted int; %c remains the original C byte, not decimal formatting or another highc() call."],
     "ja": ["そして <{arg_1:%c}> キーを押す。"]},
    {"source": "src/restore.c", "function": "getlev", "buffer": "trickbuf", "capacity": "BUFSZ", "consumer_line": 1098, "consumer": "pline1", "kind": "NH_TEXT_MESSAGE",
     "producer_lines": [1093, 1096], "types": [["int", "int"], ["int", "int"]],
     "public_arguments": ["The original selected restore diagnostic prints only hpid/pid or dlvl/lev. Keep original pid/level mismatch branch, SFCTOOL exclusion, wizard display gate, trickery() and restore mutations unchanged."],
     "ja": ["PID（{arg_1:%d}）が保存された PID（{arg_2:%d}）と一致しない！", "ここは階 {arg_1:%d} であり、階 {arg_2:%d} ではない！"]},
    {"source": "src/timeout.c", "function": "wiz_timeout_queue", "buffer": "buf", "capacity": "BUFSZ", "consumer_line": 2054, "consumer": "putstr", "kind": "NH_TEXT_PUTSTR",
     "producer_lines": [2053], "types": [["long"]],
     "public_arguments": ["Only the original selected wizard diagnostic exposes svm.moves; no observer queries or broadens debug access. Original %ld and long value are retained."],
     "ja": ["現在の時刻 = {arg_1:%ld}。"]},
    {"source": "src/timeout.c", "function": "wiz_timeout_queue", "buffer": "buf", "capacity": "BUFSZ", "consumer_line": 2105, "consumer": "putstr", "kind": "NH_TEXT_PUTSTR",
     "producer_lines": [2104], "types": [["unsigned int"]],
     "public_arguments": ["include/you.h declares original uswldtim as unsigned. Capture the already-selected original wizard display argument once; preserve %u and original conditional access."],
     "ja": ["飲み込みのカウントダウンは {arg_1:%u}。"]},
    {"source": "src/timeout.c", "function": "wiz_timeout_queue", "buffer": "buf", "capacity": "BUFSZ", "consumer_line": 2110, "consumer": "putstr", "kind": "NH_TEXT_PUTSTR",
     "producer_lines": [2109], "types": [["int"]],
     "public_arguments": ["Only the original selected wizard display exposes u.uinvault. Keep original conditional and diagnostic audience; observer does not inspect the vault state."],
     "ja": ["金庫カウンターは {arg_1:%d}。"]},
]


def find_call(entries, source, line, api):
    results = [entry for entry in entries if entry["source"] == source and entry["line"] == line and entry["api"] == api]
    if len(results) != 1:
        raise ValueError(f"Ambiguous original site: {source}:{line} {api}")
    return results[0]


def apply_operations(text, operations):
    result = text
    last = len(text) + 1
    for operation in sorted(operations, key=lambda row: (row["start"], row["end"]), reverse=True):
        start, end = operation["start"], operation["end"]
        if end > last or text[start:end] != operation["original"]:
            raise ValueError("Overlapping or stale original source span")
        result = result[:start] + operation["replacement"] + result[end:]
        last = start
    return result


def restored_source(text, operations):
    cursor, chunks = 0, []
    delta = 0
    for operation in sorted(operations, key=lambda row: (row["start"], row["end"])):
        start = operation["start"] + delta
        end = start + len(operation["replacement"])
        if text[start:end] != operation["replacement"]:
            raise ValueError("Prepared source does not match exact operation")
        chunks.extend([text[cursor:start], operation["original"]])
        cursor = end
        delta += len(operation["replacement"]) - len(operation["original"])
    chunks.append(text[cursor:])
    return "".join(chunks)


def operation(start, end, original, replacement, reason):
    return {"start": start, "end": end, "original": original, "replacement": replacement, "reason": reason}


def prepare(output=HERE / "generated"):
    producers = census.load(output / "producer-census.json")["entries"]
    origins = census.load(output / "dynamic-origin-census.json")["entries"]
    grouped = defaultdict(list)
    for contract in CONTRACTS: grouped[contract["source"]].append(contract)
    files, all_operations, catalog, checks = [], [], [], []
    include_output = output / "prototype/include"
    include_output.mkdir(parents=True, exist_ok=True)
    for relative, contracts in grouped.items():
        original = (SOURCE / relative).read_bytes().decode("utf-8")
        calls, declarations, regions, _, _, _ = census.scan_file(relative, original)
        changes, added_owners, wrappers = [], set(), []
        for contract in contracts:
            consumer = find_call(origins, relative, contract["consumer_line"], contract["consumer"])
            csite = consumer["source_call"]
            if consumer["function_candidate"] != contract["function"] or consumer["format_expression"] != contract["buffer"]:
                raise ValueError("Original consumer contract changed")
            binding = consumer["format_declaration_candidate"]
            if not binding or binding["capacity_expression"] != contract["capacity"]:
                raise ValueError("Original buffer capacity/scope is not certified")
            owner = "nh_buffer_owner_" + census.sha((relative + "|" + str(binding["declaration_offset"])).encode())[:16]
            if owner not in added_owners:
                declaration_end = original.index(";", binding["declaration_offset"]) + 1
                declaration_line = original.count("\n", 0, declaration_end) + 1
                line_end = original.find("\n", declaration_end)
                if census.inv.c_tokens(original[declaration_end:line_end]):
                    raise ValueError("Declaration insertion shares a line with another original statement")
                line_start = original.rfind("\n", 0, binding["declaration_offset"]) + 1
                indentation = original[line_start:binding["declaration_offset"]]
                indentation = indentation[:len(indentation) - len(indentation.lstrip())]
                changes.append(operation(declaration_end, declaration_end, "", "\n" + indentation + "struct nh_buf_owner " + owner + " = {0};\n#line " + str(declaration_line + 1), "private caller-owned snapshot; preserve subsequent original __LINE__ values"))
                added_owners.add(owner)
            for line, types, japanese in zip(contract["producer_lines"], contract["types"], contract["ja"], strict=True):
                producer = find_call(producers, relative, line, "Sprintf")
                psite = producer["source_call"]
                if producer["function_candidate"] != contract["function"] or psite["destination_symbol_candidate"] != contract["buffer"] or psite["destination_declaration_candidate"]["declaration_offset"] != binding["declaration_offset"]:
                    raise ValueError("Original producer/consumer refer to different buffer declaration")
                if producer["resolution"] != "literal-format-lexically-resolved" or len(types) != len(producer["typed_arguments"]):
                    raise ValueError("Unknown format/consumed union")
                if any(item.get("precision") is not None for item in producer["printf_conversions"]):
                    raise ValueError("Precision public-prefix contract not enabled")
                if any(item.get("purpose") != "value" for item in producer["typed_arguments"]):
                    raise ValueError("Dynamic width/precision contract not enabled")
                # Each allowed branch has no write/alias between selected
                # producer and consumer. restore's original else alternative
                # writes are explicitly source-reviewed as mutually exclusive.
                if contract["source"] != "src/restore.c":
                    between = original[psite["end"]:csite["start"]]
                    tokens = census.inv.c_tokens(between)
                    if any(token.text != ";" for token in tokens):
                        raise ValueError("Intervening statement/call/alias not proven safe")
                identifier = producer["english_id_candidate"]
                label = "nh_buffer_site_" + census.sha((relative + "|" + str(psite["start"])).encode())[:16]
                descriptor = label + "_descriptor"
                formals = ["struct nh_buf_owner *owner", "char *destination", "const char *format"] + [kind + " value_" + str(index + 1) for index, kind in enumerate(types)]
                body = ["static const struct nh_text_descriptor " + descriptor + " = {" + ", ".join((json.dumps(identifier), json.dumps(contract["consumer"]), contract["kind"], "NH_TEXT_PLAIN")) + "};",
                        "static void " + label + "(" + ", ".join(formals) + ") {",
                        "    uint64_t generation=nh_buf_before_write(owner,destination," + contract["capacity"] + ",&" + descriptor + ");"]
                for index, (kind, argument) in enumerate(zip(types, producer["typed_arguments"], strict=True)):
                    name, value = json.dumps(argument["name"]), "value_" + str(index + 1)
                    if kind == "const char *":
                        if argument["c_conversion"] != "s": raise ValueError("Original text format changed")
                        body.append(f"    (void)nh_buf_text_argument(owner,{index},{name},{value});")
                    else:
                        expected = "NH_TEXT_UNSIGNED" if kind == "unsigned int" else "NH_TEXT_INTEGER"
                        body.append(f"    nh_buf_scalar_argument(owner,{index},{name},{expected},(int64_t){value});")
                actual = ", ".join(["destination", "format"] + ["value_" + str(index + 1) for index in range(len(types))])
                body += ["    Sprintf(" + actual + "); /* exact original void formatting API */", "    nh_buf_after_write(owner,generation," + str(len(types)) + ");", "}"]
                wrappers.append("\n".join(body))
                # Replace API token and insert an inert owner formal. Every
                # original argument byte, comment, newline/directive remains.
                changes.append(operation(psite["start"], psite["api_end"], "Sprintf", label, "single original formatting call through same typed captured values"))
                changes.append(operation(psite["opening_end"], psite["opening_end"], "", "&" + owner + ", ", "inert caller-owned observer argument"))
                catalog.append({"id": identifier, "en": producer["english_named_template"], "ja": japanese,
                    "argument_schemas": deepcopy(producer["argument_schemas"]), "typed_arguments": deepcopy(producer["typed_arguments"]), "printf_conversions": deepcopy(producer["printf_conversions"]),
                    "source": relative, "producer_line": line, "consumer_line": contract["consumer_line"], "source_sha256": producer["source_sha256"],
                    "public_argument_contract": contract["public_arguments"], "runtime_binding_approved": False, "source_only": True})
                checks.append({"source": relative, "producer_line": line, "consumer_line": contract["consumer_line"], "same_original_declaration": True,
                    "original_printf_arguments_preserved_once": True, "original_formatting_return_semantics": "Sprintf is (void) sprintf in pinned include/global.h:285", "runtime_verified": False})
            wrapper = {"putstr": "nh_buf_putstr", "add_menu_str": "nh_buf_add_menu_str", "pline1": "nh_buf_pline1"}[contract["consumer"]]
            changes.append(operation(csite["start"], csite["api_end"], contract["consumer"], wrapper, "same original output values/attributes and native accepted-emission hook"))
            changes.append(operation(csite["opening_end"], csite["opening_end"], "", "&" + owner + ", ", "explicit one-use consumer ticket, not buffer lookup"))
        include = '#include "hack.h"'
        at = original.index(include) + len(include)
        header_name = "nh-buffer-prototype-" + Path(relative).stem + ".h"
        include_line = original.count("\n", 0, at) + 1
        changes.append(operation(at, at, "", '\n/* Modified 2026-10-02: source-only Phase7 presentation snapshot proposal; NGPL. */\n#include "nh-buffer-producer.h"\n#include "' + header_name + '"\n#line ' + str(include_line + 1), "dated modification notice and isolated proposal headers; preserve original __LINE__ values"))
        prepared = apply_operations(original, changes)
        if restored_source(prepared, changes) != original:
            raise ValueError("Full original source bytes not recoverable")
        target = output / "prototype/src" / Path(relative).name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(prepared.encode("utf-8"))
        header = "/* Added 2026-10-02: isolated Phase7 proposal, NGPL; not installed. */\n#ifndef JROGUE_NH_BUFFER_PROTOTYPE_" + Path(relative).stem.upper() + "_H\n#define JROGUE_NH_BUFFER_PROTOTYPE_" + Path(relative).stem.upper() + "_H\n" + "\n\n".join(wrappers) + "\n#endif\n"
        (include_output / header_name).write_bytes(header.encode("utf-8"))
        patches = list(difflib.unified_diff(original.splitlines(keepends=True), prepared.splitlines(keepends=True), "a/" + relative, "b/" + relative))
        files.append({"source": relative, "original_sha256": census.sha(original.encode()), "prepared_sha256": census.sha(prepared.encode()), "patch": "".join(patches)})
        all_operations.extend({"source": relative, **item} for item in changes)
    (include_output / "nh-buffer-producer.h").write_bytes((HERE / "nh-buffer-producer.h.in").read_bytes())
    (output / "prototype/src/nh-buffer-producer.c").write_bytes((HERE / "nh-buffer-producer.c.in").read_bytes())
    (output / "prototype/buffer-prototype.patch").write_bytes("".join(item["patch"] for item in files).encode("utf-8"))
    census.write(output / "prototype/catalog-fragment.json", {"schema_version": 1, "source_only": True, "runtime_binding_approved": False, "entries": catalog})
    census.write(output / "prototype/operations.json", {"schema_version": 1, "source_only": True, "operations": all_operations})
    result = {"schema_version": 1, "source_only": True, "compiled": False, "runtime_verified": False, "runtime_binding_approved": False,
              "counts": {"source_files": len(files), "formatter_branches": len(checks), "consumer_sites": len(CONTRACTS), "source_catalog_ids": len(catalog), "runtime_approved_ids": 0},
              "checks": checks, "files": [{key: value for key, value in item.items() if key != "patch"} for item in files],
              "remaining_limits": ["This initial prototype has no general copy/append/returned/interprocedural/precision or arbitrary-name producer support.",
                                   "The stock/additional native owner precedence, actual callback emission, Asyncify and Rust formatting require later isolated source composition and compiled/browser tests.",
                                   "No debug policy, original filter, history, sound, attribute, input, return or game state is changed or claimed runtime-tested."]}
    census.write(output / "prototype/source-audit.json", result)
    return result


if __name__ == "__main__":
    print(json.dumps(prepare()["counts"], ensure_ascii=False))
