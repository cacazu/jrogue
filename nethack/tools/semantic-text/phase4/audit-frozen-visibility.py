"""Added 2026-10-02, NGPL: read-only frozen C text visibility audit.

No source/catalog mutation, compilation, runtime name/state query or browser.
Computed argument values are not presumed publicly visible.
"""
from __future__ import annotations
import importlib.util
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("phase4_frozen_visibility_helpers",ROOT/"tools/instrument-semantic-phase4.py")
p4 = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = p4
spec.loader.exec_module(p4)


def audit():
    path = ROOT/"locales/gameplay-core.metadata.json"
    document = p4.load(path)
    entries = [entry for entry in document["entries"] if entry["category"] == "message"]
    precision, extras, unions, contracts = [],[],[],[]
    sites = 0
    for entry in entries:
        _,consumed,_ = p4.catalog.convert_printf(entry["source_english_literal"],entry.get("format_semantics","printf-like") == "printf-like")
        names = [argument["name"] for argument in consumed]
        if names != [argument["name"] for argument in entry["arguments"]]:
            contracts.append({"id":entry["id"],"reason":"metadata union differs from original literal printf slots"})
        if p4.catalog.names(entry["ja"]) - set(names):
            unions.append({"id":entry["id"],"japanese_fields":sorted(p4.catalog.names(entry["ja"])),"source_union":names})
        for argument in consumed:
            if argument["type"] == "text" and "." in argument.get("source_format_specifier",""):
                precision.append({"id":entry["id"],"argument":argument,"sites":entry["source_call_sites"]})
        for site in entry["source_call_sites"]:
            sites += 1
            api = p4.API.get(site["api"])
            if not api:
                contracts.append({"id":entry["id"],"source":site["source"],"line":site["line"],"reason":"API prototype unavailable"})
                continue
            actual = len(site["argument_expressions"])-len(api["types"])
            if actual != len(consumed):
                extras.append({"id":entry["id"],"source":site["source"],"line":site["line"],"api":site["api"],
                               "original_variadic_argument_count":actual,"original_consumed_slot_count":len(consumed),
                               "argument_expressions":site["argument_expressions"]})
    result = {"schema_version":1,"date":"2026-10-02","source_only":True,"canonical_modified":False,
              "metadata_sha256":p4.sha(path.read_bytes()),"base_message_ids":len(entries),"exact_source_sites":sites,
              "precision_bound_text_slots":len(precision),"precision_bound_text_ids":len({record['id'] for record in precision}),
              "precision":precision,"extra_or_missing_variadic_slots":extras,
              "japanese_union_fields_absent_from_source":unions,"unresolved_contracts":contracts,
              "passed":not(precision or extras or unions or contracts),
              "scope":"literal C771 original printf contracts; source-controlled helper prefix has no added argument slots",
              "remaining_scope":["quest/name/grammar/data descriptors require their own original public producer review",
                                 "all dynamic selected formats must consume exact union before serialization",
                                 "a future text-precision producer must capture only the original visible bytes, never entire computed hidden suffix"]}
    (ROOT/"tools/semantic-text/phase4-generated/frozen-visibility-audit.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    return result


if __name__ == "__main__":
    result = audit()
    print(json.dumps(result,ensure_ascii=False,indent=2))
    sys.exit(0 if result["passed"] else 1)
