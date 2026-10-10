"""NGPL, 2026-10-02: finite source-only preservation/rejection checks.

These checks never compile/run C, factory/WASM, Rust, browsers or servers.
They cannot prove C memory behavior, gameplay parity or runtime localization.
"""
from __future__ import annotations
from collections import Counter
import importlib.util
import json
from pathlib import Path
import re
import sys
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("phase7_prepare_checks", HERE / "prepare.py")
prepare = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = prepare
spec.loader.exec_module(prepare)
census = prepare.census
OUT = HERE / "generated"
CHECKS = []


def check(label, condition):
    if not condition: raise AssertionError(label)
    CHECKS.append({"name": label, "passed": True, "scope": "source-only"})


def reject(label, function):
    try: function()
    except ValueError: check(label, True)
    else: raise AssertionError(label + " accepted an invalid input")


def logical_line(text, position):
    line = 1
    cursor = 0
    for body in text.splitlines(keepends=True):
        if cursor <= position < cursor + len(body): return line
        marker = re.fullmatch(r"\s*#line\s+(\d+)\s*(?:/\*.*?\*/)?\r?\n?", body)
        line = int(marker.group(1)) if marker else line + 1
        cursor += len(body)
    return line


def main():
    summary = census.load(OUT / "census-summary.json")
    producers = census.load(OUT / "producer-census.json")["entries"]
    origins = census.load(OUT / "dynamic-origin-census.json")["entries"]
    builders = census.load(OUT / "builder-census.json")["entries"]
    flows = census.load(OUT / "flow-census.json")
    ops = census.load(OUT / "prototype/operations.json")["operations"]
    audit = census.load(OUT / "prototype/source-audit.json")
    catalog = census.load(OUT / "prototype/catalog-fragment.json")["entries"]
    check("exact1591formatter963dynamic63prepared900unresolved denominators", len(producers)==1591 and len(origins)==963 and sum(row["phase4_source_origin_prepared"] for row in origins)==63 and sum(not row["phase4_source_origin_prepared"] for row in origins)==900)
    check("original1484literal107dynamic formatter separation", sum(row["resolution"]=="literal-format-lexically-resolved" for row in producers)==1484 and sum(row["resolution"]!="literal-format-lexically-resolved" for row in producers)==107)
    check("all census inputs still match exact read-only original hashes", all(census.sha((census.ROOT / item["path"]).read_bytes())==item["sha256"] for item in summary["inputs"]))
    files = census.load(OUT / "source-files.json")["files"]
    check("all130pristine core source files hash invariant", len(files)==130 and all(census.sha((census.SOURCE / row["source"]).read_bytes())==row["sha256"] for row in files))
    text_cache = {}
    for row in producers + origins:
        if row["source"] not in text_cache:
            text_cache[row["source"]]=(census.SOURCE / row["source"]).read_bytes().decode("utf-8")
        text = text_cache[row["source"]]
        call = row["source_call"]
        assert census.sha(text[call["start"]:call["end"]].encode())==call["call_sha256"]
        assert census.signature(call["argument_expressions"])==census.signature(row["argument_expressions"])
        assert text.count("\n",0,call["start"])+1==row["line"]
        for expression, span in zip(call["argument_expressions"],call["argument_spans"],strict=True):
            if span: assert text[span["start"]:span["end"]]==expression
    check("all2554original producer/output call spans and argument bytes verified", True)
    check("every census candidate retains runtimefalse and unproven flow status", all(row["runtime_binding_approved"] is False and "not-approved" in row["dataflow_status"] for row in producers) and all(row["runtime_binding_approved"] is False and "no-alias" in row["dataflow_status"] for row in origins))
    shadow = [row for row in origins if row["source"]=="src/pickup.c" and row["line"]==854 and row["api"] in {"ynaq","ynNaq"}]
    check("actualpickup distinct qbuf scopes reject false766to854 formatter edge", len(shadow)==2 and all(row["format_declaration_candidate"]["line"]==850 and not row["source_scope_formatter_candidates"] and any(edge["line"]==766 for edge in row["rejected_same_symbol_candidates"]) for row in shadow))
    passed = [row for row in flows["callee_buffer_operands"] if row["source"]=="src/pickup.c" and row["line"]==768 and row["api"]=="query_objlist"]
    check("actualpickup count prompt captured as deferred interprocedural escape", len(passed)==1 and passed[0]["passed_buffer_candidates"][0]["declaration_candidate"]["line"]==764 and passed[0]["runtime_binding_approved"] is False)
    synthetic = 'void f(void) { char buf[256]; Sprintf(buf, "outer"); if (1) { char buf[32]; Sprintf(buf, "inner"); } putstr(1,0,buf); }'
    calls, declarations, *_ = census.scan_file("src/fixture.c", synthetic)
    formats = [row for row in calls if row["api"]=="Sprintf"]
    check("nested shadow fixture produces distinct source declaration identities", len(formats)==2 and formats[0]["destination_declaration_candidate"]["declaration_offset"]!=formats[1]["destination_declaration_candidate"]["declaration_offset"])
    literal = 'void f(void) { /* Sprintf(buf,"fake"); */ char buf[8]; Strcpy(buf, "Sprintf(no, call)"); putstr(1,0,buf); }'
    calls, *_ = census.scan_file("src/fixture.c", literal)
    check("comments/string text never invent formatter call or source event", all(row["api"]!="Sprintf" for row in calls) and next(row for row in calls if row["api"]=="Strcpy")["literal_copy_source"]["english"]=="Sprintf(no, call)")
    check("opaque aliases offsets fields do not acquire direct-local certificates", all(census.symbol(expression)[0] is None for expression in ("p + 1","obj->name","buf[0]","nb = eos(buf)","(char *)buf")))
    check("copy/return/assignment operands remain explicitly unapproved", all(row["runtime_binding_approved"] is False for key in ("callee_buffer_operands","returned_buffers","assignment_operands") for row in flows[key]) and all("no-overlap" in row["copy_source_candidate"]["status"] for row in builders if "copy_source_candidate" in row))
    for file in audit["files"]:
        relative = file["source"]
        original = (census.SOURCE / relative).read_bytes().decode("utf-8")
        prepared = (OUT / "prototype/src" / Path(relative).name).read_bytes().decode("utf-8")
        operations = [row for row in ops if row["source"]==relative]
        assert prepare.restored_source(prepared,operations)==original
        assert prepare.apply_operations(original,operations)==prepared
        for row in [p for p in producers if p["source"]==relative]:
            pos=row["source_call"]["start"]
            if any(op["start"]<=pos<op["end"] for op in operations):continue
            delta=sum(len(op["replacement"])-len(op["original"]) for op in operations if op["end"]<=pos)
            assert logical_line(prepared,pos+delta)==row["line"],(relative,row["line"])
    check("all3prototypefiles restore every original byte comment/directive/argument", True)
    check("original formatter logical source line values survive added headers/locals", True)
    check("all modified original C files carry dated NGPL presentation notice", all("Modified 2026-10-02: source-only Phase7 presentation snapshot proposal; NGPL." in (OUT / "prototype/src" / Path(file["source"]).name).read_text(encoding="utf-8") for file in audit["files"]))
    check("bounded7branches6consumer sites no runtime approval", audit["counts"]["formatter_branches"]==7 and audit["counts"]["consumer_sites"]==6 and len(catalog)==7 and audit["runtime_binding_approved"] is False and audit["compiled"] is False)
    spec=importlib.util.spec_from_file_location("phase7_catalog_checks",census.ROOT / "locales/build-gameplay-catalog.py")
    cm=importlib.util.module_from_spec(spec);sys.modules[spec.name]=cm;spec.loader.exec_module(cm)
    check("exact original EN/JA full typed placeholder unions and printf flags", all(cm.names(row["en"])==cm.names(row["ja"])==set(row["argument_schemas"]) and row["runtime_binding_approved"] is False for row in catalog))
    global_text=(census.SOURCE / "include/global.h").read_text(encoding="utf-8")
    check("original Sprintfvoid macro return semantics retained", "#define Sprintf (void) sprintf" in global_text and all("Sprintf is (void) sprintf" in row["original_formatting_return_semantics"] for row in audit["checks"]))
    wrappers="\n".join(path.read_text(encoding="utf-8") for path in (OUT / "prototype/include").glob("nh-buffer-prototype-*.h"))
    check("generated wrappers call original formatting exactly once perbranch", len(re.findall(r"\bSprintf\(",wrappers))==7 and "long value_1" in wrappers and "unsigned int value_1" in wrappers and 'NH_TEXT_UNSIGNED' in wrappers)
    bridge=(HERE / "nh-buffer-producer.c.in").read_text(encoding="utf-8")
    bridge_tokens=census.inv.c_tokens(bridge)
    bridge_calls={token.text for index,token in enumerate(bridge_tokens[:-1]) if bridge_tokens[index+1].text=="(" and token.kind=="identifier"}
    check("private bridge has no name/state/visibility/RNG helper call", not bridge_calls.intersection(census.inv.RNG_NAMES) and all(bad not in bridge for bad in ("u.","flags.","Hallucination","mon_nam(","objnam(","rn2(")))
    check("Phase6 six-field ABI explicitly disables unknown-buffer name lookup", bridge.count(".allow_name_capture=0")==2 and "unsigned_integer" not in bridge)
    check("once-only ticket invalidation and innerOOMpending barrier are explicit", 'nh_buf_invalidate(owner); /* once-only ticket' in bridge and 'if (!scope) nh_text_cancel_pending()' in bridge and 'owner->generation==UINT64_MAX' in bridge)
    check("bounded NUL snapshot overlap and source-integrity guards explicit", 'memchr(owner->buffer,0,owner->capacity)' in bridge and 'source<destination+owner->capacity' in bridge and '!memcmp(text,owner->original,owner->length+1)' in bridge and 'capacity>NH_BUF_BYTES' in bridge)
    reject("stale source span rejected before any output change", lambda:prepare.apply_operations("abc",[prepare.operation(0,1,"x","y","fixture")]))
    reject("overlapping source operations rejected", lambda:prepare.apply_operations("abc",[prepare.operation(0,2,"ab","x","fixture"),prepare.operation(1,3,"bc","y","fixture")]))
    reject("ambiguous original source site is not auto-selected",lambda:prepare.find_call([{"source":"a","line":1,"api":"Sprintf"}]*2,"a",1,"Sprintf"))
    report={"schema_version":1,"status":"source-only-checks-passed","checks_passed":len(CHECKS),"checks":CHECKS,
            "compiled":False,"native_runtime_verified":False,"browser_verified":False,"runtime_approved_ids":0,
            "scope":"source/hash/scope/rejection/preservation evidence only; C allocator/memory/ABI/Asyncify/native filtering and accepted callback rendering unverified",
            "artifacts":[{"path":str(path.relative_to(HERE)).replace('\\','/'),"sha256":census.sha(path.read_bytes())} for path in (HERE/'census.py',HERE/'prepare.py',HERE/'nh-buffer-producer.c.in',HERE/'nh-buffer-producer.h.in',OUT/'census-summary.json',OUT/'prototype/source-audit.json',OUT/'prototype/buffer-prototype.patch')]}
    census.write(OUT / "source-verification.json",report)
    print(json.dumps({key:report[key] for key in ('status','checks_passed','compiled','native_runtime_verified','runtime_approved_ids')}))


if __name__=="__main__":main()
