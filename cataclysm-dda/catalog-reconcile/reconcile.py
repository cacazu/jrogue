"""Reconcile exact 0.I-1 source extraction, without modifying upstream.

Runs official JSON parser modules and official GNU xgettext keywords. The
collector adds provenance/bindings; it does not reimplement extraction rules.
"""
from __future__ import annotations

import argparse
import ast
from collections import Counter, defaultdict
from dataclasses import asdict
import hashlib
import importlib
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import quote

COMMIT = "7b2efa5cea38e4d4d97dd0e63b28b9148623da59"
DEFAULT_SOURCE = Path(r"C:\Users\kit\gameme\jnethack\jrouge\cataclysm-dda\upstream\Cataclysm-DDA-" + COMMIT)
DEFAULT_XGETTEXT = Path(r"C:\Program Files\Git\usr\bin\xgettext.exe")
EXCLUDE_FILES = {
    "data/json/furniture_and_terrain/terrain-regional-pseudo.json",
    "data/json/furniture_and_terrain/furniture-regional-pseudo.json",
    "data/json/items/book/abstract.json", "data/json/npcs/TALK_TEST.json",
    "data/core/sentinels.json", "data/raw/color_templates/no_bright_background.json",
    "data/mods/Magiclysm/Spells/debug.json",
}
EXCLUDE_DIRS = ("data/mods/TEST_DATA",)
KEYWORDS = ("_", "pgettext:1c,2", "n_gettext:1,2", "npgettext:1c,2,3",
            "translate_marker", "translate_marker_context:1c,2",
            "to_translation:1,1t", "to_translation:1c,2,2t",
            "pl_translation:1,2,2t", "pl_translation:1c,2,3,3t")


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def emit(stream, record):
    stream.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")


def po_entries(path: Path):
    """Small streaming PO reader; preserves context, plural, flags and refs."""
    with path.open(encoding="utf-8-sig") as stream:
        yield from parse_po_stream(stream, path)


def parse_po_stream(stream, path):
    current = None
    active = None
    for number, raw in enumerate(stream, 1):
        line = raw.rstrip("\r\n")
        if not line.strip():
            if current and "singular" in current:
                yield current
            current, active = None, None
            continue
        if current is None:
            current = {"context": "", "plural": None, "translations": {},
                       "flags": [], "references": [], "comments": [],
                       "line": number, "obsolete": False}
        if line.startswith("#~"):
            current["obsolete"] = True
            line = line[2:].lstrip()
        if line.startswith("#:"):
            current["references"].extend(line[2:].split())
        elif line.startswith("#,"):
            current["flags"].extend(t.strip() for t in line[2:].split(","))
        elif line.startswith("#"):
            current["comments"].append(line[1:].strip())
        else:
            match = re.match(r'(msgctxt|msgid_plural|msgid|msgstr(?:\[\d+\])?)\s+(".*")$', line)
            if match:
                name, value = match.groups()
                field = {"msgctxt": "context", "msgid": "singular",
                         "msgid_plural": "plural"}.get(name)
                if field:
                    active = (field, None)
                    current[field] = ast.literal_eval(value)
                else:
                    index = name[7:-1] if name.startswith("msgstr[") else "0"
                    active = ("translations", index)
                    current["translations"][index] = ast.literal_eval(value)
            elif line.startswith('"') and active:
                value = ast.literal_eval(line)
                field, index = active
                if field == "translations":
                    current[field][index] += value
                else:
                    current[field] += value
            else:
                raise ValueError(f"Unsupported PO syntax at {path}:{number}: {line[:100]}")
    if current and "singular" in current:
        yield current


def key(record):
    return (record.get("context", ""), record["singular"])


def json_files(source):
    # Exact include/exclude scope from lang/update_pot.sh, avoiding duplicate
    # includes data, data/json and data/mods. Upstream walks files before dirs.
    includes = (source / "data", source / "data/json", source / "data/mods")
    def visit(directory):
        children = sorted(directory.iterdir(), key=lambda p: p.name)
        for p in children:
            relative = p.relative_to(source).as_posix()
            if p.is_file() and p.suffix == ".json" and relative not in EXCLUDE_FILES:
                if not any(relative.startswith(d) for d in EXCLUDE_DIRS):
                    yield p
        for p in children:
            if p.is_dir():
                if p in includes and p != directory:
                    continue
                relative = p.relative_to(source).as_posix()
                if not any(relative.startswith(d) for d in EXCLUDE_DIRS):
                    yield from visit(p)
    for directory in includes:
        if directory.exists():
            yield from visit(directory)


def pointer_token(token):
    return str(token).replace("~", "~0").replace("/", "~1")


def pointer(parts):
    return "".join("/" + pointer_token(p) for p in parts)


def index_nodes(node, parts=(), indices=None):
    if indices is None:
        indices = defaultdict(list)
    indices[id(node)].append(parts)
    if isinstance(node, dict):
        for k, v in node.items():
            index_nodes(v, parts + (k,), indices)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            index_nodes(v, parts + (i,), indices)
    return indices


def identifier(value):
    if isinstance(value, str) and value:
        return value
    if isinstance(value, list) and value and all(isinstance(s, str) for s in value):
        return "aliases=" + ",".join(value)
    return None


def owner_identity(obj):
    for name in ("id", "abstract", "nested_mapgen_id", "om_terrain",
                 "update_mapgen_id", "category", "ident"):
        value = identifier(obj.get(name))
        if value:
            return {"field": name, "value": value}, "definition-id"
    if obj.get("type", "").lower() == "recipe" and identifier(obj.get("result")):
        return {"field": "result+id_suffix", "value": obj["result"] + str(obj.get("id_suffix", ""))}, "recipe-result"
    # No IDs based on English display text or hashes. Such definitions require
    # reviewed semantic IDs and stay provisional in the manifest.
    return None, "unidentified-definition"


def semantic_field(obj, parts):
    current = obj
    tokens = []
    positional = False
    for part in parts:
        if isinstance(part, int):
            child = current[part]
            stable = None
            if isinstance(child, dict):
                for k in ("id", "variant_id", "level", "intensity"):
                    if isinstance(child.get(k), (str, int)):
                        stable = k + "=" + str(child[k])
                        break
            # Gun firing-mode arrays have a structural identifier at [0].
            if stable is None and isinstance(child, list) and child and isinstance(child[0], str) and re.fullmatch(r"[A-Z][A-Z0-9_]*", child[0]):
                stable = "key=" + child[0]
            tokens.append(stable if stable else str(part))
            positional |= stable is None
            current = child
        else:
            tokens.append(part)
            current = current[part]
    return tokens, positional


class Collector:
    def __init__(self, source, stream, gap_stream, catalog, patches):
        self.source, self.stream, self.gap_stream = source, stream, gap_stream
        self.catalog, self.patches = catalog, patches
        self.stats = Counter()
        self.types = Counter()
        self.source_keys = set()
        self.plurals = defaultdict(set)
        self.semantic_seen = {}
        self.parser_ast = {}
        self.current = None
        sys.dont_write_bytecode = True
        sys.path.insert(0, str(source / "lang"))
        self.write_module = importlib.import_module("string_extractor.write_text")
        self.message_module = importlib.import_module("string_extractor.message")
        self.original_write = self.write_module.write_text
        self.write_module.write_text = self.capture
        # Import after installing capture: all official parser-bound functions
        # point to our collector, which calls original write_text unchanged.
        self.parser_module = importlib.import_module("string_extractor.parser")
        self.parse_module = importlib.import_module("string_extractor.parse")

    def capture(self, value, origin, context="", comment="", plural=False, c_format=True):
        mm = self.message_module
        before = len(mm.occurrences)
        self.original_write(value, origin, context, comment, plural, c_format)
        if len(mm.occurrences) == before:
            self.stats["suppressedOrEmptyWrites"] += 1
            return
        pair = mm.occurrences[-1]
        message = mm.messages[pair][-1]
        record = self.record(value, message, sys._getframe(1))
        emit(self.stream, record)
        self.source_keys.add(pair)
        self.plurals[pair].add(message.text_plural)
        self.stats["occurrences"] += 1
        self.types[record["ownerType"]] += 1
        self.stats["binding:" + record["bindingStatus"]] += 1
        self.stats["semantic:" + record["semanticStatus"]] += 1
        self.stats["catalog:" + record["catalogStatus"]] += 1
        if record["catalogStatus"] not in ("translated", "patched"):
            emit(self.gap_stream, {"kind": "actual-json-catalog-gap", **record})
        if record["bindingStatus"] != "exact-pointer" or record["semanticStatus"] != "definition-field":
            emit(self.gap_stream, {"kind": "semantic-binding-review", **record})
        if record["semanticId"]:
            previous = self.semantic_seen.setdefault(record["semanticId"], pair)
            if previous != pair:
                self.stats["semanticConflictingIds"] += 1
                emit(self.gap_stream, {"kind": "semantic-id-collision", "previousKey": previous, **record})
        # Bound memory to one official write; no giant POT/messages collection.
        mm.messages.clear()
        mm.occurrences.clear()

    def argument_paths(self, frame, indices):
        """Resolve official write_text's subscript expression, without eval.

        JSON caches single-character strings, so Python object identity alone
        cannot distinguish mission dialogue fields. Resolve the official
        argument AST using the live parser's local container and subscript keys.
        This affects provenance only, never what official write_text extracts.
        """
        file = Path(frame.f_code.co_filename)
        try:
            file.relative_to(self.source / "lang/string_extractor/parsers")
        except ValueError:
            return None
        nodes = self.parser_ast.get(str(file))
        if nodes is None:
            tree = ast.parse(file.read_text(encoding="utf-8"))
            nodes = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "write_text" and n.args]
            self.parser_ast[str(file)] = nodes
        calls = [n for n in nodes if n.lineno <= frame.f_lineno <= n.end_lineno]
        if not calls:
            return None
        node = min(calls, key=lambda n: n.end_lineno - n.lineno).args[0]
        def resolve(expr):
            if isinstance(expr, ast.Name) and expr.id in frame.f_locals:
                value = frame.f_locals[expr.id]
                return value, indices.get(id(value), [])
            if isinstance(expr, ast.Subscript):
                parent = resolve(expr.value)
                if parent is None:
                    return None
                selector = expr.slice
                if isinstance(selector, ast.Constant):
                    index = selector.value
                elif isinstance(selector, ast.Name):
                    index = frame.f_locals.get(selector.id)
                else:
                    return None
                if not isinstance(index, (str, int)):
                    return None
                value, paths = parent
                try:
                    return value[index], [p + (index,) for p in paths]
                except (KeyError, IndexError, TypeError):
                    return None
            return None
        resolved = resolve(node)
        return resolved[1] if resolved is not None else None

    def record(self, value, message, caller):
        relative, root_pointer, obj, indices = self.current
        object_paths = indices.get(id(value), [])
        exact_argument_paths = self.argument_paths(caller, indices)
        if exact_argument_paths is not None:
            object_paths = exact_argument_paths
        binding_status = "exact-pointer" if len(object_paths) == 1 else ("ambiguous-pointer" if object_paths else "generated-parser-text")
        paths = [root_pointer + pointer(parts) for parts in object_paths]
        identity, identity_basis = owner_identity(obj)
        namespace = "core"
        if relative.startswith("data/mods/"):
            namespace = "mod." + relative.split("/")[2]
        type_name = str(obj.get("type", "")).lower()
        semantic_id, semantic_status, field_tokens = None, "needs-review", None
        if len(object_paths) == 1 and identity:
            field_tokens, positional = semantic_field(obj, object_paths[0])
            components = ["data", namespace, type_name, identity["field"] + "=" + identity["value"], *field_tokens]
            if message.context:
                components += ["context=" + message.context]
            semantic_id = ".".join(quote(str(c), safe="_-") for c in components)
            semantic_status = "positional-field-review" if positional else "definition-field"
        entry = self.catalog.get((message.context, message.text))
        patch = self.patches.get((message.context, message.text))
        match, status, ja = catalog_match(message.text_plural, message.explicit_plural, entry, patch)
        return {"sourceFile": relative, "ownerPointer": root_pointer, "ownerType": type_name,
                "ownerIdentity": identity, "ownerIdentityBasis": identity_basis,
                "jsonPointers": paths, "bindingStatus": binding_status,
                "semanticId": semantic_id, "semanticStatus": semantic_status,
                "semanticField": field_tokens, "context": message.context,
                "singular": message.text, "plural": message.text_plural or None,
                "explicitPlural": message.explicit_plural,
                "formatTag": message.format_tag, "comments": message.comments,
                "catalogStatus": status, "pluralMatch": match,
                "ja": ja, "catalogLine": entry.get("line") if entry else None,
                "patchSemanticId": patch.get("semanticId") if patch else None}

    def extract(self):
        for file in json_files(self.source):
            relative = file.relative_to(self.source).as_posix()
            self.stats["files"] += 1
            try:
                data = json.loads(file.read_text(encoding="utf-8"))
            except Exception as exc:
                self.stats["fileErrors"] += 1
                emit(self.gap_stream, {"kind": "json-file-error", "file": relative, "error": str(exc)})
                continue
            objects = data if type(data) is list else [data]
            for i, obj in enumerate(objects):
                self.stats["topLevelObjects"] += 1
                root_pointer = "/" + str(i) if type(data) is list else ""
                if not isinstance(obj, dict) or not isinstance(obj.get("type"), str):
                    self.stats["ignoredUntypedObjects"] += 1
                    continue
                t = obj["type"].lower()
                self.stats["objects:" + t] += 1
                if t not in self.parser_module.parsers:
                    self.stats["unknownTypes"] += 1
                    emit(self.gap_stream, {"kind": "unknown-upstream-parser-type", "file": relative, "pointer": root_pointer, "type": t})
                    continue
                if self.parser_module.parsers[t] is self.parser_module.dummy_parser:
                    self.stats["officialDummyObjects"] += 1
                self.current = (relative, root_pointer, obj, index_nodes(obj))
                try:
                    self.parse_module.parse_json_object(obj, relative)
                except Exception as exc:
                    self.stats["parserErrors"] += 1
                    emit(self.gap_stream, {"kind": "upstream-parser-error", "file": relative, "pointer": root_pointer, "type": t, "error": str(exc)})
                self.current = None
            if self.stats["files"] % 1000 == 0:
                print(json.dumps({"jsonFiles": self.stats["files"], "jsonOccurrences": self.stats["occurrences"]}), flush=True)


def catalog_match(plural, explicit_plural, entry, patch):
    if entry is None:
        return "no-source-key", "missing-source-key", None
    source_plural = plural or None
    catalog_plural = entry.get("plural") or None
    if source_plural == catalog_plural:
        match = "exact"
    elif source_plural is None and catalog_plural:
        match = "catalog-shared-plural"
    elif source_plural and not explicit_plural:
        match = "implicit-plural-review"
    else:
        match = "explicit-plural-mismatch"
    translations = patch["translations"] if patch else entry["translations"]
    ja = translations.get("0")
    if match == "explicit-plural-mismatch":
        status = "plural-mismatch"
    elif "fuzzy" in entry.get("flags", []) and not patch:
        status = "fuzzy"
    elif not ja:
        status = "untranslated"
    else:
        status = "patched" if patch else "translated"
    return match, status, ja


def cpp_extract(source, out, executable):
    files = sorted([p.relative_to(source).as_posix() for p in (source / "src").iterdir() if p.suffix in (".cpp", ".h")])
    file_list = out / "cpp-files.txt"
    file_list.write_text("\n".join(files) + "\n", encoding="utf-8")
    pot = out / "actual-cpp.pot"
    cmd = [str(executable), "--default-domain=cataclysm-dda", "--add-comments=~", "--sort-by-file", "--output=" + str(pot.resolve()), "--from-code=UTF-8", "--files-from=" + str(file_list.resolve())]
    cmd += ["--keyword=" + kw for kw in KEYWORDS]
    completed = subprocess.run(cmd, cwd=source, capture_output=True, text=True, encoding="utf-8", errors="replace")
    (out / "xgettext-stderr.txt").write_text(completed.stderr, encoding="utf-8")
    if completed.returncode:
        raise RuntimeError(f"xgettext exited {completed.returncode}: {completed.stderr[:2000]}")
    version = subprocess.run([str(executable), "--version"], capture_output=True, text=True, encoding="utf-8").stdout.splitlines()[0]
    return {"tool": str(executable), "version": version, "keywords": list(KEYWORDS), "files": len(files), "fileListSha256": digest(file_list), "potSha256": digest(pot), "warnings": len(completed.stderr.splitlines()), "scope": "Exact src/*.cpp src/*.h scope and keywords from upstream lang/update_pot.sh"}


def reconcile_cpp(out, inventory, catalog, patches, json_keys):
    source_keys, stats = set(), Counter()
    source_entries = {}
    with (out / "cpp-records.jsonl").open("w", encoding="utf-8") as records, (out / "cpp-gaps.jsonl").open("w", encoding="utf-8") as gaps:
        for entry in po_entries(out / "actual-cpp.pot"):
            if not entry["singular"]:
                continue
            pair = key(entry)
            source_keys.add(pair)
            source_entries[pair] = entry
            cat = catalog.get(pair)
            patch = patches.get(pair)
            match, status, ja = catalog_match(entry.get("plural"), True, cat, patch)
            record = {**entry, "catalogStatus": status, "pluralMatch": match, "ja": ja,
                      "catalogLine": cat.get("line") if cat else None,
                      "semanticStatus": "cpp-semantic-id-required", "semanticId": None}
            stats["keys"] += 1
            stats["catalog:" + status] += 1
            emit(records, record)
            if status not in ("translated", "patched"):
                emit(gaps, {"kind": "actual-cpp-catalog-gap", **record})
        with (out / "cpp-inventory-reconciliation.jsonl").open("w", encoding="utf-8") as rec:
            for line in (inventory / "source-texts.jsonl").open(encoding="utf-8"):
                item = json.loads(line)
                pair = key(item)
                cpp = source_entries.get(pair)
                if cpp:
                    status = "official-source-key"
                    if item.get("plural") and item.get("plural") != cpp.get("plural"):
                        status = "official-key-plural-conflict"
                elif pair in json_keys:
                    status = "json-only-key-review"
                else:
                    status = "not-in-official-extraction"
                stats["inventory:" + status] += 1
                emit(rec, {"status": status, "source": item,
                           "officialReferences": cpp.get("references") if cpp else None,
                           "officialPlural": cpp.get("plural") if cpp else None})
        with (out / "dynamic-cpp-unresolved.jsonl").open("w", encoding="utf-8") as dynamic:
            for line in (inventory / "dynamic-source-texts.jsonl").open(encoding="utf-8"):
                item = json.loads(line)
                stats["dynamicExpressionsUnresolved"] += 1
                emit(dynamic, {"status": "requires-definition-and-callsite-trace", **item})
    return source_keys, stats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--inventory", type=Path, default=Path(__file__).resolve().parent.parent / "inventory-tools/output")
    parser.add_argument("--patches", type=Path, default=Path(__file__).resolve().parent.parent / "ja-completion/ja-reviewed-patches.json")
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parent / "output")
    parser.add_argument("--xgettext", type=Path, default=DEFAULT_XGETTEXT)
    args = parser.parse_args()
    source, out = args.source.resolve(), args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    catalog = {key(e): e for e in po_entries(source / "lang/po/ja.po") if e.get("singular") and not e["obsolete"]}
    patch_data = json.loads(args.patches.read_text(encoding="utf-8"))
    patches = {key(e): e for e in patch_data["records"]}
    cpp_provenance = cpp_extract(source, out, args.xgettext)
    with (out / "json-records.jsonl").open("w", encoding="utf-8") as stream, (out / "json-gaps.jsonl").open("w", encoding="utf-8") as gaps:
        collector = Collector(source, stream, gaps, catalog, patches)
        collector.extract()
    cpp_keys, cpp_stats = reconcile_cpp(out, args.inventory, catalog, patches, collector.source_keys)
    all_keys = cpp_keys | collector.source_keys
    stale, stale_stats = set(catalog) - all_keys, Counter()
    with (out / "stale-ja-catalog-keys.jsonl").open("w", encoding="utf-8") as stream:
        for pair in sorted(stale):
            entry = catalog[pair]
            stale_stats["catalogOnlyKeys"] += 1
            stale_stats["patchedStaleKeys"] += pair in patches
            emit(stream, {"kind": "catalog-key-not-in-current-official-extraction", **entry,
                          "patchSemanticId": patches[pair]["semanticId"] if pair in patches else None})
    patch_stats = Counter()
    with (out / "patch-source-reconciliation.jsonl").open("w", encoding="utf-8") as stream:
        for pair, patch in patches.items():
            status = "current-json-and-cpp" if pair in cpp_keys & collector.source_keys else ("current-json" if pair in collector.source_keys else ("current-cpp" if pair in cpp_keys else "stale-source-key"))
            patch_stats[status] += 1
            emit(stream, {"status": status, "semanticId": patch["semanticId"], "context": pair[0], "singular": pair[1], "plural": patch.get("plural"), "claimedSourceBindings": patch.get("sourceBindings", [])})
    parser_files = sorted((source / "lang/string_extractor").rglob("*.py"))
    parser_manifest = [{"path": p.relative_to(source).as_posix(), "sha256": digest(p)} for p in parser_files]
    summary = {"schemaVersion": 1, "sourceCommit": COMMIT, "sourceVersion": "0.I-1",
               "sourceRoot": str(source), "sourceCatalogSha256": digest(source / "lang/po/ja.po"),
               "patchesSha256": digest(args.patches), "collectorSha256": digest(Path(__file__)),
               "extraction": {"json": "Unmodified official parse_json_object/parsers and original write_text; observer consumes one emitted Message at a time", "cpp": cpp_provenance,
                              "excludedFiles": sorted(EXCLUDE_FILES), "excludedDirectories": list(EXCLUDE_DIRS),
                              "parserModules": len(list((source / "lang/string_extractor/parsers").glob("*.py"))),
                              "parserManifest": parser_manifest},
               "json": dict(collector.stats), "jsonUniqueKeys": len(collector.source_keys),
               "jsonOccurrenceTypes": dict(collector.types), "cpp": dict(cpp_stats),
               "combinedUniqueSourceKeys": len(all_keys), "sourceKeyOverlap": len(cpp_keys & collector.source_keys),
               "activeJaCatalogKeys": len(catalog), "catalogOnly": dict(stale_stats), "patchSourceStatus": dict(patch_stats),
               "limitations": [
                   "Official extractor scope proves what upstream marks translatable; official dummy parsers and unmarked runtime strings remain outside this proof.",
                   "IDs derived from definition identity and field are candidates; positional fields, anonymous definitions, generated text, ambiguous pointer bindings, and collisions are explicit review gaps.",
                   "C++ gettext keys are authoritative but descriptive semantic IDs and parameter schema migration still require source edits; no text-hash IDs are claimed.",
                   "Dynamic C++ expressions are not proven covered merely because other extracted literals/catalog keys exist.",
                   "Raw JSON plurals precede upstream POT sanitize/msguniq merging; explicit mismatches block exact source fidelity, implicit conflicts are flagged separately.",
                   "Translations and source bindings do not prove runtime integration, gameplay correctness, Japanese layout, or complete browser flows."
               ]}
    (out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: summary[k] for k in ("jsonUniqueKeys", "cpp", "combinedUniqueSourceKeys", "activeJaCatalogKeys", "catalogOnly", "patchSourceStatus")}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
