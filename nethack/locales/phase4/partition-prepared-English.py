#!/usr/bin/env python3
"""Queue remaining exact source-selected English IDs for Japanese authoring.

Excludes all frozen phase-3 messages, reviewed proposals and pair-review author
queues. Outputs source-only inputs, never approved translations or runtime keys.
"""
import hashlib
import json
import math
from copy import deepcopy
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OFFICIAL = ROOT.parent / "official-source-audit/NetHack-5.0.0"


def load(path):
    return json.loads(path.read_text("utf8"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, obj):
    text=json.dumps(obj,ensure_ascii=False,indent=2)+"\n"
    if not path.exists() or path.read_text("utf8") != text:
        path.write_text(text,encoding="utf8")


def main():
    import sys
    spec=spec_from_file_location("primary_scanner",ROOT/"tools/inventory_source.py")
    scanner=module_from_spec(spec);sys.modules[spec.name]=scanner;spec.loader.exec_module(scanner)
    snapshot=ROOT/"tools/semantic-text/phase4-generated/metadata.json"
    initial_hash=sha(snapshot)
    meta=load(snapshot)
    inventory_path=ROOT/"catalog/source-text-messages.json"
    inventory=load(inventory_path)
    core_sites={(e.get("english_id_candidate"),e["source"],e["line"]):e for e in inventory["messages"] if e["source"].startswith("src/") and e.get("english_id_candidate")}
    core_ids={v[0] for v in core_sites}
    frozen=load(ROOT/"locales/gameplay-core.metadata.json")
    frozen_ids={e["id"] for e in frozen["entries"] if e.get("category")=="message"}
    reviewed=load(HERE/"reviewed-translations.metadata.json")
    reviewed_ids={e["id"] for e in reviewed["entries"]}
    queued_inputs=sorted(HERE.glob("category-?-batch-?.json"))
    queued_ids=set()
    for path in queued_inputs:
        queued_ids.update(e["id"] for e in load(path)["entries"])
    excluded=frozen_ids|reviewed_ids|queued_ids
    groups={"zero-argument":[],"numeric-only":[],"text-or-mixed":[]}
    cache={}
    all_entries=[]
    for e in meta["entries"]:
        if e["id"] in excluded:
            continue
        if e["id"] not in core_ids:
            raise ValueError("Prepared ID is outside exact core literal inventory: "+e["id"])
        contracts=[]
        for site in e["source_call_sites"]:
            original=core_sites.get((e["id"],site["source"],site["line"]))
            if original is None:
                raise ValueError("Prepared call lacks inventory evidence: "+repr(site))
            source=site["source"]
            if source not in cache:
                path=OFFICIAL/source
                cache[source]=(path.read_text("utf8").splitlines(),sha(path))
            lines,blob=cache[source]
            arguments=[]
            for arg in original["argument_binding"]:
                values=[]
                for ordinal,t in enumerate([v for v in scanner.c_tokens(arg["source_expression"]) if v.kind=="string"]):
                    values.append({"ordinal":ordinal,"start":t.start,"end":t.end,"english_literal":scanner.decode_c_string(t.text),"role":"lexical-candidate-not-yet-proven-selected-output"})
                arguments.append({**arg,"source_literal_candidates":values})
            contracts.append({"source":source,"line":site["line"],"api":e["api"],"function_candidate":site["function_candidate"],"argument_expressions":original["argument_expressions"],"arguments":arguments,"blob_sha256":blob,"source_evidence":[{"line":i+1,"text":lines[i]} for i in range(max(0,site["line"]-11),min(len(lines),site["line"]+11))],"original_call_sha256":site["original_call_sha256"],"conditional_guards":site.get("conditional_guards",[]),"preprocessor_active_source_evidence":site.get("preprocessor_active_proven",False),"runtime_verified":False})
        variants=sorted({v.split(".")[1] for v in e["helper_variant_ids"]})
        conversions=deepcopy(e["printf_conversions"])
        for conversion in conversions:
            argument=next(a for a in e["arguments"] if a["name"]==conversion["argument"])
            if conversion["source_specifier"]=="%zu" and argument.get("catalog_target_length_normalization")=="wasm32 size_t -> uint32":
                assert "{"+conversion["argument"]+":%u}" in e["en"]
                conversion["catalog_specifier"]="%u"
                conversion["catalog_target_length_normalization"]="wasm32 size_t -> uint32"
                conversion["catalog_length_modifier"]=""
        item={"id":e["id"],"english_whole_named_template":e["en"],"original_api":e["api"],"original_english_literal":e["source_english_literal"],"typed_arguments":e["arguments"],"printf_conversions":conversions,"required_argument_union":e["required_argument_union"],"official_source_contracts":contracts,"required_helper_variants":variants,"source_translation_approved":False,"runtime_binding_approved":False,"runtime_integration":False}
        types=[a["type"] for a in e["arguments"]]
        category="zero-argument" if not types else "numeric-only" if all(t in ("integer","unsigned","boolean") for t in types) else "text-or-mixed"
        groups[category].append(item)
        all_entries.append(item)
    assert sha(snapshot)==initial_hash,"Engine source preparation changed during partition; retry the source-only snapshot."
    outputs=[]
    for category,items in groups.items():
        items.sort(key=lambda e:(e["official_source_contracts"][0]["source"],e["official_source_contracts"][0]["line"],e["id"]))
        chunks=max(1,math.ceil(len(items)/250))
        for n in range(chunks):
            part=items[n*len(items)//chunks:(n+1)*len(items)//chunks]
            if not part:
                continue
            name=f"english-primary-{category}-batch-{n+1}.json"
            output={"schema_version":1,"purpose":"Untranslated exact official source-selected English presentation authoring input; no Japanese or native approval.","category":category,"batch":n+1,"output_fragment_path":name.replace(".json",".authored.json"),"provenance":{"official":{"release":"5.0.0","pinned_commit":"16ff59115315917b93185d026aeefea06db9b0f4"}},"input_sha256":{"engine_metadata":initial_hash,"source_inventory":sha(inventory_path)},"excluded_id_sets":{"frozen_message_ids":len(frozen_ids),"reviewed_source_proposal_ids":len(reviewed_ids),"paired_author_queue_ids":len(queued_ids)},"frozen_phase3_sha256":reviewed["frozen_phase3_sha256"],"author_instructions":["Translate the actual official English sentence, preserving every meaningful fact and original helper context. No Japanese-fork state changes or extra queries.","Keep named source arguments and exact printf suffixes. Both languages may use a justified subset only with the full explicit source-declared argument union; no %.0s padding.","Record whole Japanese helper variants exactly for original captured dream/underwater/blind contexts. Verbalize retains quotations.","Lexical string candidates are not automatically output leaves. Predicate-only comparisons are excluded; helper inputs need the actual original public producer descriptor.","Name, tense, motion, hallucination and dynamic text are captured only once at their original native producer. Unproven fields remain explicit native English fallback.","All runtime_integration and runtime_binding_approved fields stay false. This queue is source authoring, not a compiled/browser test result."],"counts":{"ids":len(part),"sites":sum(len(e["official_source_contracts"]) for e in part)},"entries":part,"runtime_integration":False,"runtime_binding_approved_count":0}
            write(HERE/name,output)
            outputs.append({"path":name,"category":category,"batch":n+1,"ids":len(part),"sites":output["counts"]["sites"],"sha256":sha(HERE/name)})
    prepared_ids={e["id"] for e in meta["entries"]}
    ids=[e["id"] for e in all_entries]
    assert len(ids)==len(set(ids)) and not set(ids)&excluded
    summary={"schema_version":1,"source_only":True,"runtime_integration":False,"engine_metadata_sha256":initial_hash,"engine_metadata_entries":len(meta["entries"]),"all_frozen_and_queued_ids_excluded":True,"counts":{"remaining_prepared_authoring_ids":len(ids),"zero_argument":len(groups["zero-argument"]),"numeric_only":len(groups["numeric-only"]),"text_or_mixed":len(groups["text-or-mixed"]),"frozen_message_ids":len(frozen_ids),"reviewed_source_proposal_ids":len(reviewed_ids),"paired_author_queue_ids":len(queued_ids),"paired_queue_prepared_ids":len(queued_ids&prepared_ids),"reviewed_proposal_prepared_ids":len(reviewed_ids&prepared_ids),"core_literal_inventory_ids":len(core_ids),"prepared_plus_frozen_literal_ids":len(prepared_ids|frozen_ids),"core_literal_ids_still_without_native_source_preparation":len(core_ids-(prepared_ids|frozen_ids)),"runtime_approved_new_ids":0},"batch_outputs":outputs,"gap_contract":"Counts describe exact source inventory/preparation and author queues. Authored frames with public producer dependencies do not prove native Japanese coverage; no compilation or browser was executed here."}
    write(HERE/"english-primary-batches.json",summary)
    print(json.dumps(summary["counts"]))


if __name__=="__main__":
    main()
