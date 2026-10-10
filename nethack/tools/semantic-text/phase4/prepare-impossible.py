"""Added 2026-10-02, NGPL: prepare the native first diagnostic boundary.

This separate source contract does not alter the accepted broad phase-four
ledger/catalog, applied engine, native logs, filters, or compiler artifacts.
"""
from __future__ import annotations
import difflib
import importlib.util
import json
from pathlib import Path
import re
import sys
from collections import defaultdict
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("phase4_impossible_source_helpers",ROOT/"tools/instrument-semantic-phase4.py")
p4 = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = p4
spec.loader.exec_module(p4)
NOTICE = "/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */\n"


def transform(source):
    entry = "impossible(const char *s, ...)\n{\n"
    owner = "    struct nh_text_scope *nh_owner = nh_text_claim(NH_TEXT_MESSAGE);\n"
    changed = p4.sem.replace_once(source,entry,entry+owner,"impossible-original-logical-owner")
    truncation = "    pbuf[BUFSZ - 1] = '\\0'; /* sanity */"
    guard = "    if (strlen(pbuf) >= BUFSZ) nh_text_truncated(nh_owner);\n"
    changed = p4.sem.replace_once(changed,truncation,guard+truncation,"impossible-original-truncation")
    first = "    gp.pline_flags = URGENT_MESSAGE;\n    pline(\"%s\", pbuf);"
    forwarding = "    gp.pline_flags = URGENT_MESSAGE;\n    nh_text_forward(nh_owner);\n    pline(\"%s\", pbuf);"
    changed = p4.sem.replace_once(changed,first,forwarding,"impossible-only-first-public-pline")
    reverted = p4.sem.replace_once(changed,forwarding,first,"impossible-forward-proof")
    reverted = p4.sem.replace_once(reverted,guard+truncation,truncation,"impossible-truncation-proof")
    reverted = p4.sem.replace_once(reverted,entry+owner,entry,"impossible-owner-proof")
    if reverted != source:
        raise ValueError("original impossible expressions, formatting or control flow changed")
    return changed


def prepare(output):
    source_path = ROOT/"upstream/NetHack-5.0.0/src/pline.c"
    original = source_path.read_text(encoding="utf8")
    changed = NOTICE+transform(original)
    output.mkdir(parents=True,exist_ok=True)
    patch = "".join(difflib.unified_diff(original.splitlines(True),changed.splitlines(True),
        fromfile="upstream/src/pline.c",tofile="phase4-impossible/src/pline.c"))
    (output/"impossible-contract.patch").write_text(patch,encoding="utf8",newline="\n")
    rows = [row for row in p4.load(ROOT/"catalog/source-text-messages.json")["messages"]
            if row["source"].startswith("src/") and row["api"] == "impossible"]
    literals = [row for row in rows if row.get("english_id_candidate")]
    audit = {"schema_version":1,"date":"2026-10-02","source_only":True,"compiled":False,
             "runtime_integration":False,"producer_wrappers_generated":False,
             "source":"src/pline.c","original_sha256":p4.sha(original),"prepared_sha256":p4.sha(changed),
             "literal_candidate_sites":len(literals),"literal_candidate_ids":len({row['english_id_candidate'] for row in literals}),
             "dynamic_candidate_sites":len(rows)-len(literals),
             "composition_order":"before broad source-call substitutions and native core-hook application; nh-semantic.h supplied by existing bridge",
             "owner":"original impossible entry claims NH_TEXT_MESSAGE; only its first original pline receives the owner via nh_text_forward",
             "truncation":"read only original already-formatted pbuf before existing BUFSZ terminator; >=BUFSZ invalidates presentation capture",
             "preserved":["original va_start/vsnprintf/va_end once","original paniclog bytes","original fuzzer panic","original URGENT_MESSAGE flags",
                          "original first pline bytes/filter/history/sound/handler flow","all separate ancillary reporting plines","original crash reporting predicates and input","all original program_state changes"],
             "remaining":"requires separately reviewed typed original-call wrappers/catalog and integration/compiler/runtime checks; ancillary/config/fatal/history/data text remains in full visible coverage denominator",
             "source_calls":literals}
    (output/"impossible-audit.json").write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    return audit


def prepare_wrappers(output):
    """Additional isolated diagnostic wrappers; original first-line owner only."""
    output.mkdir(parents=True,exist_ok=True)
    (output/"include/nh-phase4-impossible").mkdir(parents=True,exist_ok=True)
    p4.API["impossible"]={"types":["const char *"],"format":0,"return":"void","kind":"NH_TEXT_MESSAGE","direct":False}
    rows=[row for row in p4.load(ROOT/"catalog/source-text-messages.json")["messages"]
          if row["source"].startswith("src/") and row["api"]=="impossible" and row.get("english_id_candidate")]
    grouped=defaultdict(list)
    for row in rows: grouped[row["source"]].append(row)
    english,schemas,entries,operations,files={}, {}, {}, [], []
    for name,sites in sorted(grouped.items()):
        original=(p4.UPSTREAM/name).read_text(encoding="utf8")
        offsets=[0]+[match.end() for match in re.finditer("\n",original)]
        guards=p4.guards(original);declarations=[];claimed=set()
        for row in sites:
            template,args,conversions=p4.catalog.convert_printf(row["english_source_template"],True)
            entry={"id":row["english_id_candidate"],"category":"message","en":template,"arguments":args,
                   "source_english_literal":row["english_source_template"],"api":"impossible","printf_conversions":conversions,
                   "runtime_integration":False,"source_only":True,"source_call_sites":[],
                   "semantic_capture_prepared":not p4.text_precision(args)}
            line=row["line"];start,end=offsets[line-1],offsets[line] if line<len(offsets) else len(original)
            matches=[]
            for match in re.finditer(r"\bimpossible\s*\(",original[start:end]):
                offset=start+match.start();actual,closing=p4.sem.call_arguments(original,original.find("(",offset))
                if offset not in claimed and [p4.sem.tokens(arg) for arg in actual]==[p4.sem.tokens(arg) for arg in row["argument_expressions"]]:
                    matches.append((offset,closing,actual))
            if not matches: raise ValueError(f"original diagnostic binding unavailable: {name}:{line}")
            offset,closing,actual=matches[0];claimed.add(offset)
            function="nh_phase4_impossible_site_"+p4.sha(name+"|"+str(offset))[:16]
            wrapper,types=p4.wrapper(entry,row,function,set(),set());declarations.append(wrapper)
            replacement=p4.rewrite_native_call(original[offset:closing],"impossible",function,actual,actual)
            operations.append({"id":entry["id"],"source":name,"line":line,"api":"impossible","original_start_offset":offset,
                               "original_end_offset":closing,"original_call":original[offset:closing],"original_argument_expressions":actual,"replacement":replacement})
            english[entry["id"]]=template;schemas[entry["id"]]=[arg["name"] for arg in args]
            entries.setdefault(entry["id"],entry)["source_call_sites"].append({"source":name,"line":line,"api":"impossible",
                "function_candidate":row["function_candidate"],"original_argument_expressions":actual,"formal_c_types":types,
                "conditional_guards":guards[line]})
        header="sites-"+Path(name).stem+".h"
        (output/"include/nh-phase4-impossible"/header).write_text(NOTICE+'#include "nh-phase4-values.h"\n'+"\n".join(declarations),encoding="utf8",newline="\n")
        files.append({"source":name,"header":"nh-phase4-impossible/"+header,"sites":len(sites),"original_sha256":p4.sha(original)})
    result={"schema_version":1,"source_only":True,"compiled":False,"runtime_integration":False,
            "counts":{"literal_ids":len(entries),"literal_sites":len(operations),"source_files":len(files),
                      "precision_fallback_ids":sum(not entry['semantic_capture_prepared'] for entry in entries.values())},"files":files,
            "public_contract":"exact consumed original literal union; first original impossible message only; native truncation invalidates capture; no diagnostic log/history substitution"}
    for name,data in (("catalog.json",{"en":english,"ja":{},"argument_schemas":schemas}),
                      ("metadata.json",{"schema_version":1,"entries":list(entries.values()),"source_only":True}),
                      ("call-operations.json",{"schema_version":1,"operations":operations,"source_only":True}),("audit.json",result)):
        (output/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    return result


if __name__ == "__main__":
    result = prepare(ROOT/"tools/semantic-text/phase4-generated/diagnostic-contract")
    print(json.dumps({"status":"source-only-first-diagnostic-contract",**{key:result[key] for key in
        ("literal_candidate_sites","literal_candidate_ids","dynamic_candidate_sites","original_sha256","prepared_sha256")}}))
