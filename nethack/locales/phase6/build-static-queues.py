#!/usr/bin/env python3
"""Partition unprepared/error diagnostics without changing any native inputs."""
import hashlib
import json
import math
from collections import Counter,defaultdict
from pathlib import Path
from importlib.util import spec_from_file_location,module_from_spec

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OFFICIAL=ROOT.parent/"official-source-audit/NetHack-5.0.0"


def load(path):return json.loads(path.read_text("utf8"))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+"\n",encoding="utf8")


def module(path,name):
    import sys
    spec=spec_from_file_location(name,path);value=module_from_spec(spec)
    sys.modules[name]=value;spec.loader.exec_module(value);return value


def main():
    core=module(ROOT/"locales/build-gameplay-catalog.py","phase6_core")
    scanner=module(ROOT/"tools/inventory_source.py","phase6_scanner")
    inv_path=ROOT/"catalog/source-text-messages.json";inventory=load(inv_path)
    broad_path=ROOT/"tools/semantic-text/phase4-generated/metadata.json";broad=load(broad_path)
    diag_path=ROOT/"tools/semantic-text/phase4-generated/diagnostic-wrappers/metadata.json";diag=load(diag_path)
    frozen=load(ROOT/"locales/gameplay-core.metadata.json")
    frozen_ids={e["id"] for e in frozen["entries"] if e["category"]=="message"}
    broad_ids={e["id"] for e in broad["entries"]}|frozen_ids
    diag_ids={e["id"] for e in diag["entries"]}
    already_queued=set()
    for path in (ROOT/"locales/phase4").glob("category-?-batch-?.json"):
        already_queued.update(e["id"] for e in load(path)["entries"])
    grouped=defaultdict(list)
    for item in inventory["messages"]:
        ident=item.get("english_id_candidate")
        if ident and item["source"].startswith("src/"):grouped[ident].append(item)
    protected=load(ROOT/"locales/phase4/reviewed-translations.metadata.json")["frozen_phase3_sha256"]
    cache={};scopes={"remaining-native":[],"impossible-diagnostic":[]};blocked=[]
    for ident,sites in sorted(grouped.items()):
        if ident in broad_ids:continue
        category="impossible-diagnostic" if ident in diag_ids else "remaining-native"
        if ident in already_queued:continue
        first=sites[0]
        try:
            en,args,conversions=core.convert_printf(first["english_source_template"],first["format_semantics"]=="printf-like")
        except ValueError as error:
            blocked.append({"id":ident,"source_calls":sites,"reason":str(error),"runtime_binding_approved":False});continue
        whole,_=core.whole_message(first["api"],en,en)
        names={a["name"] for a in args}
        if any(names!={a["id_candidate"] for a in s["argument_binding"]} for s in sites):
            blocked.append({"id":ident,"source_calls":sites,"reason":"Actual consumed printf union differs from lexical source binding; requires original contract review.","runtime_binding_approved":False});continue
        contracts=[]
        for site in sites:
            source=site["source"]
            if source not in cache:
                data=(OFFICIAL/source).read_text("utf8")
                cache[source]=(data.splitlines(),sha(OFFICIAL/source))
            lines,blob=cache[source]
            arguments=[]
            for binding in site["argument_binding"]:
                literals=[t for t in scanner.c_tokens(binding["source_expression"]) if t.kind=="string"]
                arguments.append({**binding,"source_literal_candidates":[{"ordinal":n,"start":t.start,"end":t.end,"english_literal":scanner.decode_c_string(t.text),"role":"lexical-candidate-needs-consumer-proof"} for n,t in enumerate(literals)]})
            contracts.append({"source":source,"line":site["line"],"api":site["api"],"function_candidate":site["function_candidate"],"arguments":arguments,"argument_expressions":site["argument_expressions"],"blob_sha256":blob,"source_evidence":[{"line":i+1,"text":lines[i]} for i in range(max(0,site["line"]-11),min(len(lines),site["line"]+11))],"preprocessor_active_proven":False,"preprocessor_review_status":"Not evaluated by this lexical inventory; preserve native conditional compilation.","runtime_verified":False})
        scopes[category].append({"id":ident,"english_whole_named_template":whole,"original_api":first["api"],"original_english_literal":first["english_source_template"],"typed_arguments":args,"printf_conversions":conversions,"required_argument_union":[a["name"] for a in args],"required_helper_variants":[],"official_source_contracts":contracts,"source_translation_approved":False,"runtime_binding_approved":False,"runtime_integration":False,"native_source_prepared":category=="impossible-diagnostic","channel_guard":"Preserve original panic/configuration/log/dump/exit/impossible channel and control flow; translating an error must not hide it, mutate recovery, suppress logging or create a callback where its branch is inactive."})
    outputs=[]
    for category,entries in scopes.items():
        entries.sort(key=lambda e:(e["original_api"],e["official_source_contracts"][0]["source"],e["official_source_contracts"][0]["line"],e["id"]))
        count=math.ceil(len(entries)/150)
        for n in range(count):
            part=entries[n*len(entries)//count:(n+1)*len(entries)//count]
            name=f"{category}-batch-{n+1}.json"
            record={"schema_version":1,"category":category,"batch":n+1,"purpose":"Exact official-source Japanese authoring input; diagnostics are visible text obligations, not exemptions.","output_fragment_path":name.replace(".json",".authored.json"),"provenance":{"official":{"release":"5.0.0","pinned_commit":"16ff59115315917b93185d026aeefea06db9b0f4"}},"input_sha256":{"inventory":sha(inv_path),"broad_metadata":sha(broad_path),"diagnostic_metadata":sha(diag_path)},"frozen_phase3_sha256":protected,"counts":{"ids":len(part),"sites":sum(len(e["official_source_contracts"]) for e in part)},"author_instructions":["Translate actual official English source with exact ID, source argument names and printf widths/precision/types/order. Preserve original newline and structural bytes.","Keep original native channel/control flow. Do not suppress errors or call diagnostics/repair/state/RNG/naming again during presentation.","Declared source union is exact. Japanese may omit only justified English grammar slots while retaining the entire consumed event union.","Filepaths/user inputs/technical variable/config identifiers remain literal only when their actual source contract proves that disposition; this is not a blanket untranslated-error exemption.","Public names/compound buffer/table/constant outputs require original source producer evidence. Predicate strings and grammar helper inputs are not direct selected output leaves.","Record every runtime_integration/runtime_binding_approved as false. Native C/Rust/Node/browser checks are separate."],"entries":part,"runtime_integration":False,"runtime_binding_approved_count":0}
            write(HERE/name,record);outputs.append({"path":name,"ids":len(part),"sites":record["counts"]["sites"],"sha256":sha(HERE/name)})
    remaining_ids=set(grouped)-broad_ids-diag_ids
    summary={"schema_version":1,"source_only":True,"runtime_integration":False,"provenance":{"official":{"release":"5.0.0","pinned_commit":"16ff59115315917b93185d026aeefea06db9b0f4"}},"counts":{"core_literal_ids":len(grouped),"prepared_plus_frozen_ids":len(broad_ids),"impossible_diagnostic_ids":len(diag_ids),"remaining_native_ids":len(remaining_ids),"remaining_native_sites":sum(len(grouped[i]) for i in remaining_ids),"remaining_already_authored_phase4_ids":len(remaining_ids&already_queued),"new_remaining_author_queue_ids":len(scopes['remaining-native']),"diagnostic_author_queue_ids":len(scopes['impossible-diagnostic']),"unsupported_contract_ids":len(blocked),"new_runtime_approved_ids":0},"remaining_api_sites":dict(Counter(s['api'] for i in remaining_ids for s in grouped[i])),"already_authored_remaining_ids":sorted(remaining_ids&already_queued),"batches":outputs,"blocked_contracts":blocked,"guard":"The 5,000 prepared and 559 diagnostic records are lexical source scopes, not active callback/runtime/Japanese counts. Data/help/labels/producers have separate inventories."}
    write(HERE/"static-batches.json",summary)
    print(json.dumps(summary["counts"]))


if __name__=="__main__":main()
