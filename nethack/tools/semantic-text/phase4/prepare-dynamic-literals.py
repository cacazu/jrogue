"""Added 2026-10-02, NGPL: isolated original selected-format preparations.

Original predicates/unused arguments remain C. Only exact full consumed unions
are eligible; precision-bound strings and opaque leaves fail closed. EN only.
No canonical/catalog/source apply, compiler, browser, RNG or game state query.
"""
from __future__ import annotations
from collections import Counter,defaultdict
import difflib
import importlib.util
import json
from pathlib import Path
import re
import sys
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("phase4_dynamic_literal_helpers",ROOT/"tools/instrument-semantic-phase4.py")
p4 = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = p4
spec.loader.exec_module(p4)
NOTICE = "/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */\n"
OUTPUT = ROOT/"tools/semantic-text/phase4-generated/dynamic-literals"


def literal_values(expression):
    leaves = p4.split_conditional(expression)
    if not all(len(p4.inventory.c_tokens(leaf)) == 1 and p4.inventory.c_tokens(leaf)[0].kind == "string" for leaf in leaves):
        raise ValueError("opaque/nonliteral value leaf or concatenated literal requires original producer review")
    literals = [token for token in p4.inventory.c_tokens(expression) if token.kind == "string"]
    if len(literals) != len(leaves): raise ValueError("literal occurs inside original predicate")
    return literals


def select_literal_formats(expression, descriptors):
    literals = literal_values(expression)
    if len(descriptors) != len(literals): raise ValueError("missing selected original format descriptor")
    changes = [(token.start,token.end,f"nh_phase4_format({token.text}, &{descriptor})") for token,descriptor in zip(literals,descriptors,strict=True)]
    result = expression
    for start,end,replacement in sorted(changes,reverse=True): result=result[:start]+replacement+result[end:]
    reverted = result
    for start,end,replacement in changes:
        reverted=p4.sem.replace_once(reverted,replacement,expression[start:end],"dynamic-literal-predicate-proof")
    if reverted != expression: raise ValueError("original literal/condition/evaluation tokens changed")
    return result


def choices(row):
    api = p4.API[row["api"]]
    literals = literal_values(row["format_expression"])
    choices = []
    namespace = "nethack.message.dynamic."+Path(row["source"]).stem.lower()+"."+row["function_candidate"].lower()+"."+row["api"].lower()
    for token in literals:
        original = p4.inventory.decode_c_string(token.text)
        identifier = p4.inventory.semantic_candidate(namespace,original)
        if len(identifier) > 160: raise ValueError("source ID exceeds interface bound")
        whole,_ = p4.catalog.whole_message("verbalize" if row["api"] == "verbalize1" else row["api"],original,"")
        english,arguments,conversions = p4.catalog.convert_printf(whole,row["format_semantics"] == "printf-like")
        if p4.text_precision(arguments): raise ValueError("precision-bound text requires exact original public-prefix producer")
        for argument in arguments: p4.arg_type(argument)
        if len(row["argument_expressions"]) != len(api["types"])+len(arguments):
            raise ValueError("selected original format leaves unconsumed or missing C arguments; computed is not public")
        choices.append({"id":identifier,"en":english,"arguments":arguments,"printf_conversions":conversions,
                        "source_english_literal":original,"source_literal_token":token.text,
                        "source_literal_start":token.start,"source_literal_end":token.end})
    unions = [[(argument["name"],p4.arg_type(argument),argument["purpose"]) for argument in choice["arguments"]] for choice in choices]
    if any(union != unions[0] for union in unions[1:]):
        raise ValueError("original selected formats do not share exact full promoted argument union")
    return choices


def prepare(output=OUTPUT):
    output.mkdir(parents=True,exist_ok=True)
    (output/"include/nh-phase4-dynamic").mkdir(parents=True,exist_ok=True)
    document = p4.load(ROOT/"catalog/source-text-messages.json")
    rows = [row for row in document["messages"] if row["source"].startswith("src/") and not row.get("english_id_candidate")]
    compiled = {name.replace("\\","/") for name in p4.load(ROOT/"build/engine-manifest.json")["compiled_sources"]}
    grouped, ledger = defaultdict(list),[]
    for row in rows:
        evidence = {key:row.get(key) for key in ("source","line","function_candidate","api","format_expression","argument_expressions")}
        try:
            if row["source"] not in compiled: raise ValueError("translation unit not present in current target")
            if row["api"] in p4.DEFERRED or row["api"] not in p4.API: raise ValueError("native output contract deferred or unavailable")
            selected = choices(row)
            grouped[row["source"]].append((row,selected))
        except ValueError as error:
            ledger.append({**evidence,"status":"unprepared-origin","reason":str(error)})
    english,schemas,entries,operations,patches,files = {},{},{},[],[],[]
    for name,work in sorted(grouped.items()):
        original = (p4.UPSTREAM/name).read_text(encoding="utf8")
        offsets = [0]+[match.end() for match in re.finditer("\n",original)]
        guards = p4.guards(original)
        declarations,changes,claimed = [],[],set()
        for row,selected in work:
            line=row["line"]; start,end=offsets[line-1],offsets[line] if line<len(offsets) else len(original)
            matches=[]
            for match in re.finditer(r"\b"+re.escape(row["api"])+r"\s*\(",original[start:end]):
                offset=start+match.start()
                arguments,closing=p4.sem.call_arguments(original,original.find("(",offset))
                if offset not in claimed and [p4.sem.tokens(arg) for arg in arguments] == [p4.sem.tokens(arg) for arg in row["argument_expressions"]]:
                    matches.append((offset,closing,arguments))
            if not matches: raise ValueError(f"exact original dynamic call binding unavailable: {name}:{line}")
            offset,closing,arguments=matches[0];claimed.add(offset)
            function="nh_phase4_dynamic_site_"+p4.sha(name+"|"+str(offset))[:16]
            descriptors=[]
            for ordinal,choice in enumerate(selected):
                descriptor="nh_phase4_dynamic_format_"+p4.sha(function+"|"+str(ordinal))[:16]
                descriptors.append(descriptor)
                declarations.append("static const struct nh_text_descriptor "+descriptor+" = {"+", ".join((json.dumps(choice["id"]),json.dumps(row["api"]),p4.API[row["api"]]["kind"],p4.HELPERS.get(row["api"],"NH_TEXT_PLAIN")))+"};\n")
                if choice["id"] in english and english[choice["id"]] != choice["en"]: raise ValueError("source ID/template collision")
                english[choice["id"]]=choice["en"];schemas[choice["id"]]=[argument["name"] for argument in choice["arguments"]]
                for variant,(text,_) in p4.catalog.variants(row["api"],choice["source_english_literal"],"").items():
                    key="variant."+variant+"."+choice["id"]
                    english[key]=p4.catalog.convert_printf(text,row["format_semantics"] == "printf-like")[0];schemas[key]=schemas[choice["id"]]
                entries.setdefault(choice["id"],{**choice,"api":row["api"],"source_call_sites":[],"source_only":True,"runtime_integration":False,"japanese_translation_approved":False})["source_call_sites"].append({"source":name,"line":line,"function_candidate":row["function_candidate"],"original_argument_expressions":arguments,"conditional_guards":guards[line]})
            altered=list(arguments)
            index=p4.API[row["api"]]["format"]
            altered[index]=select_literal_formats(arguments[index],descriptors)
            wrapper,types=p4.wrapper(selected[0],row,function,set(),set(),True)
            declarations.append(wrapper)
            original_call=original[offset:closing]
            replacement=p4.rewrite_native_call(original_call,row["api"],function,arguments,altered)
            changes.append((offset,closing,replacement,original_call))
            operation={"source":name,"line":line,"api":row["api"],"original_start_offset":offset,"original_end_offset":closing,"original_argument_expressions":arguments,"original_call":original_call,"replacement":replacement}
            operations.append(operation)
            ledger.append({**{key:row.get(key) for key in ("source","line","function_candidate","api","format_expression","argument_expressions")},"status":"source-selected-literal-contract-prepared","selected_ids":[choice["id"] for choice in selected],"formal_c_types":types,"conditional_guards":guards[line],"runtime_verified":False,"consumed_union":"every selected format consumes exactly all original promoted variadic slots"})
        changed=original
        for start,end,replacement,_ in sorted(changes,reverse=True): changed=changed[:start]+replacement+changed[end:]
        reverted=changed
        for _,_,replacement,original_call in changes: reverted=p4.sem.replace_once(reverted,replacement,original_call,"dynamic-source-token-proof")
        if reverted != original: raise ValueError("dynamic source expression/literal tokens changed")
        header="sites-"+Path(name).stem+".h"
        (output/"include/nh-phase4-dynamic"/header).write_text(NOTICE+'#include "nh-phase4-values.h"\n'+"\n".join(declarations),encoding="utf8",newline="\n")
        changed=p4.sem.replace_once(changed,'#include "hack.h"\n','#include "hack.h"\n'+f'#include "nh-phase4-dynamic/{header}"\n',"dynamic-header")
        changed=NOTICE+changed
        patches.extend(difflib.unified_diff(original.splitlines(True),changed.splitlines(True),fromfile="upstream/"+name,tofile="phase4-dynamic/"+name))
        files.append({"source":name,"original_sha256":p4.sha(original),"prepared_sha256":p4.sha(changed),"origin_sites":len(changes)})
    result={"schema_version":1,"date":"2026-10-02","source_only":True,"compiled":False,"runtime_integration":False,"denominator_dynamic_origins":len(rows),
            "counts":{"prepared_origin_sites":len(operations),"prepared_distinct_message_ids":len(entries),"english_keys_with_variants":len(english),"japanese_keys":0,"source_files":len(files)},
            "unprepared_reason_counts":dict(Counter(row["reason"] for row in ledger if row["status"] == "unprepared-origin")),"ledger":ledger,"files":files,
            "public_contract":"all selected original literal formats consume the same exact full promoted union; precision-bound text, nonliteral and extra computed arguments rejected; original conditions/name/RNG expressions once",
            "composition":"combine call-operations.json.operations with broad operations after frozen renames and before core/name hooks; pure text only; all runtime and JA approvals pending"}
    for name,data in (("catalog.json",{"en":english,"ja":{},"argument_schemas":schemas}),("metadata.json",{"schema_version":1,"entries":list(entries.values()),"source_only":True,"runtime_integration":False}),
                      ("call-operations.json",{"schema_version":1,"operations":operations,"source_only":True}),("audit.json",result)):
        (output/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    (output/"dynamic-literals.patch").write_text("".join(patches),encoding="utf8",newline="\n")
    return result


if __name__ == "__main__":
    result=prepare()
    print(json.dumps({"status":"source-only-selected-dynamic-literals",**result["counts"],"unprepared_reasons":result["unprepared_reason_counts"]},indent=2))
