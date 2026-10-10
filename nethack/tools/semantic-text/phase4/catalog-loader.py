"""Added 2026-10-02, NGPL: validate/queue authored source frames safely.

Missing original public producer bindings keep their whole native English.
Only explicitly producer-free reviewed frames can enter this prepared catalog.
"""
from __future__ import annotations
import json
from pathlib import Path


def merge_table(target, table, names):
    for identifier,schema in table.get("argument_schemas",{}).items():
        if len(schema)!=len(set(schema)): raise ValueError("duplicate source union: "+identifier)
        if identifier in target["argument_schemas"] and set(target["argument_schemas"][identifier])!=set(schema):
            raise ValueError("conflicting source union: "+identifier)
        target["argument_schemas"][identifier]=schema
    for locale in ("en","ja"):
        for identifier,template in table[locale].items():
            if not isinstance(template,str) or "\0" in template: raise ValueError("invalid template: "+identifier)
            template.encode("utf8",errors="strict")
            if identifier in target[locale] and target[locale][identifier]!=template:
                raise ValueError("conflicting source template: "+identifier)
            schema=target["argument_schemas"].get(identifier)
            if schema is None and identifier.startswith("variant."):
                parts=identifier.split(".",2)
                if len(parts)==3 and parts[1] in ("dream","underwater","blind"):
                    schema=target["argument_schemas"].get(parts[2])
                    if schema is not None: target["argument_schemas"][identifier]=schema
            # Fixed literal leaf catalogs have no arguments. This is not an
            # inferred public producer binding: any placeholder still fails.
            if schema is None and not names(template):
                schema=[];target["argument_schemas"][identifier]=schema
            if schema is None or names(template)-set(schema): raise ValueError("unknown template field: "+identifier)
            target[locale][identifier]=template


def load_catalog(base_paths, metadata_entries, authored_paths, names, sha):
    combined={"en":{},"ja":{},"argument_schemas":{}}
    # The frozen v1 catalog omits C schemas, including helper variants. Use
    # their exact native metadata unions, never the English placeholder set.
    for contract in metadata_entries:
        identifier=contract["id"]
        schema=[argument["name"] for argument in contract["arguments"]]
        previous=combined["argument_schemas"].get(identifier)
        if previous is not None and set(previous)!=set(schema):
            raise ValueError("conflicting prepared native source union: "+identifier)
        combined["argument_schemas"][identifier]=schema
    # Explicit pline recursion context contract, captured from its original
    # already-computed coord_desc result, as defined by the native bridge.
    combined["argument_schemas"]["context.location_prefix"]=["location","text"]
    provenance=[]
    for path in base_paths:
        path=Path(path);merge_table(combined,json.loads(path.read_text(encoding="utf8")),names)
        provenance.append({"path":str(path),"sha256":sha(path.read_bytes()),"role":"source-bound-catalog"})
    contracts={entry["id"]:entry for entry in metadata_entries}
    queued,activated=[],[];seen=set()
    for path in authored_paths:
        path=Path(path);document=json.loads(path.read_text(encoding="utf8"))
        provenance.append({"path":str(path),"sha256":sha(path.read_bytes()),"role":"reviewed-authoring-proposal"})
        for proposal in document["entries"]:
            identifier=proposal["id"]
            if identifier in seen: raise ValueError("duplicate authored ID: "+identifier)
            seen.add(identifier)
            contract=contracts.get(identifier)
            reason=[]
            if not contract: reason.append("no prepared exact native source producer")
            else:
                schema=[argument["name"] for argument in contract["arguments"]]
                authored_schema=proposal["argument_schema"]
                if len(authored_schema)!=len(set(authored_schema)) or set(authored_schema)!=set(schema):
                    raise ValueError("authored source union changed: "+identifier)
                if proposal["whole_message_en"]!=contract["en"]: raise ValueError("authored original English changed: "+identifier)
                if names(proposal["whole_message_ja"])-set(schema): raise ValueError("authored JA reveals unknown field: "+identifier)
                omitted=set(schema)-names(proposal["whole_message_ja"])
                explanations={item.get("argument",item.get("name")):item.get("reason") for item in proposal.get("omitted_grammar_arguments",[]) if isinstance(item,dict)}
                if omitted and any(not explanations.get(field) for field in omitted):
                    reason.append("omitted source fields require explicit reviewed grammar reasons")
                if not contract.get("semantic_capture_prepared",True): reason.append("original public-prefix producer pending")
            if not proposal.get("source_translation_approved_claim"): reason.append("source translation approval pending")
            if proposal.get("requires_public_name_or_grammar_producer"): reason.append("original public name/grammar producer dependencies pending")
            if proposal.get("source_literal_translations") or proposal.get("source_table_translations"):
                reason.append("original selected literal/table descriptor bindings pending")
            if reason:
                queued.append({"id":identifier,"reasons":reason,"proposal":proposal,"runtime_integration":False})
                continue
            # This explicitly safe case has no dependency on raw fragments or
            # unimplemented source composition. All other authoring stays queued.
            table={"en":{identifier:proposal["whole_message_en"]},"ja":{identifier:proposal["whole_message_ja"]},
                   "argument_schemas":{identifier:proposal["argument_schema"]}}
            for variant,template in proposal.get("helper_variants_ja",{}).items():
                key="variant."+variant+"."+identifier
                if key not in combined["en"]: raise ValueError("missing original helper variant: "+key)
                table["ja"][key]=template;table["argument_schemas"][key]=proposal["argument_schema"]
            merge_table(combined,table,names);activated.append(identifier)
    audit={"schema_version":1,"source_only":True,"runtime_verified":False,"input_provenance":provenance,
           "authored_frames_activated":activated,"authored_frames_queued":queued,
           "counts":{"activated":len(activated),"queued":len(queued),"english_keys":len(combined["en"]),"japanese_keys":len(combined["ja"])},
           "contract":"reviewed source schema alone is not a runtime binding; unbound dependencies retain complete original native English"}
    return combined,audit
