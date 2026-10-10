"""Prepare broad source-selected English text plus reviewed phase-four JA.

Added 2026-10-02, NGPL. Source generation only: no apply, compiler, browser,
runtime query, Git operation, or change to the frozen phase-three catalog.
English-only entries intentionally omit JA; lexical source IDs are not a
claim of Japanese translation or executed/preprocessor-active coverage.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import difflib
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import sys
sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = ROOT / "upstream/NetHack-5.0.0"
PHASE4 = ROOT / "locales/phase4"
DEFAULT_OUTPUT = ROOT / "tools/semantic-text/phase4-generated"
DATE = "2026-10-02"
NOTICE = f"/* Modified {DATE}: additive phase-four source observations; NGPL; upstream retained. */\n"


def load(path):
    return json.loads(path.read_text(encoding="utf8"))


def sha(data):
    return hashlib.sha256(data.encode("utf8") if isinstance(data, str) else data).hexdigest()


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result


sem = module(ROOT / "tools/instrument-semantic-text.py", "phase4_frozen_source_helpers")
catalog = module(ROOT / "locales/build-gameplay-catalog.py", "phase4_frozen_catalog_helpers")
inventory = module(ROOT / "tools/inventory_source.py", "phase4_inventory_helpers")
API = {key: dict(value) for key, value in sem.API.items()}
API["custompline"] = {"types":["unsigned", "const char *"], "format":1, "return":"void", "kind":"NH_TEXT_MESSAGE", "direct":False}
for alias in ("pline1", "You1", "Your1", "verbalize1", "You_hear1"):
    API[alias] = {"types":["const char *"], "format":0, "return":"void", "kind":"NH_TEXT_MESSAGE", "direct":False}
for alias in ("ynq", "nyaq", "nyNaq", "YN", "ynNaq", "ynaq"):
    API[alias] = dict(API["y_n"])
API["raw_print_bold"] = dict(API["raw_print"])
API["getlin"] = {"types":["const char *", "char *"], "format":0,
                 "return":"void", "kind":"NH_TEXT_QUESTION", "direct":False}
HELPERS = dict(sem.HELPERS, verbalize1="NH_TEXT_QUOTED", You_hear1="NH_TEXT_HEAR")
DEFERRED = {
    "impossible":"developer diagnostic with own formatting/truncation/reporting path; original English retained",
    "panic":"fatal developer/platform diagnostic; original English retained",
    "panic1":"fatal developer/platform diagnostic; original English retained",
    "config_error_add":"deferred configuration-error buffer; later visible delivery needs its own producer ownership",
    "livelog_printf":"live-log file output; not a shim window callback",
    "livelog_add":"live-log file output; not a shim window callback",
    "gamelog_add":"game-log record; not a synchronous shim window callback",
    "putmsghistory":"native message history must retain exact English; no accepted-display event here",
    "dumplogmsg":"dump-log record; not accepted window display",
    "dump_forward_putstr":"dump/mirror path needs explicit accepted shim ownership",
    "exit_nhwindows":"shutdown text callback needs an explicit dedicated ownership contract",
    "suspend_nhwindows":"suspend callback needs an explicit dedicated ownership contract",
    "putmixed":"mixed glyph/text decoding requires final decoded-text ownership",
    "message_menu":"message-menu adapter needs dedicated ownership",
}


def guards(source):
    """Record, never guess, original conditional-preprocessor branches."""
    result, stack = {}, []
    for number, line in enumerate(source.splitlines(), 1):
        directive = re.match(r"^\s*#\s*(if|ifdef|ifndef|elif|else|endif)\b(.*)", line)
        if directive:
            kind, expression = directive.groups()
            expression = expression.strip()
            if kind in ("if", "ifdef", "ifndef"):
                stack.append({"kind":kind,"expression":expression,"branch":"initial"})
            elif kind == "endif":
                if stack: stack.pop()
            elif stack:
                stack[-1] = {**stack[-1],"branch":kind,"branch_expression":expression}
        result[number] = [dict(item) for item in stack]
    return result


def split_conditional(expression):
    """Return value leaves only; conditions remain opaque original C tokens."""
    tokens = inventory.c_tokens(expression)
    pairs = inventory.delimiters(tokens)
    if not tokens: raise ValueError("empty selected-literal expression")
    if tokens[0].text == "(" and pairs.get(0) == len(tokens)-1:
        return split_conditional(expression[tokens[0].end:tokens[-1].start])
    depth, question, nested = 0, None, 0
    for token in tokens:
        if token.kind in ("string", "char"): continue
        if token.text in ("(", "[", "{"): depth += 1
        elif token.text in (")", "]", "}"): depth -= 1
        elif depth == 0 and token.text == "?":
            if question is None: question = token
            else: nested += 1
        elif depth == 0 and token.text == ":" and question:
            if nested: nested -= 1
            else:
                return split_conditional(expression[question.end:token.start]) + split_conditional(expression[token.end:])
    if question: raise ValueError("unbalanced original conditional expression")
    return [expression.strip()]


def selected_literals(expression, fragments):
    """Construct typed value leaves; reverse transformation proves originals."""
    leaves = split_conditional(expression)
    if not all(inventory.c_tokens(leaf) and all(token.kind == "string" for token in inventory.c_tokens(leaf)) for leaf in leaves):
        raise ValueError("selected-literal expression has a nonliteral value leaf")
    source_literals = [token for token in inventory.c_tokens(expression) if token.kind == "string"]
    if len(source_literals) != len(leaves):
        raise ValueError("predicate strings or concatenated value literals need a separate reviewed contract")
    if len(fragments) != len(source_literals):
        raise ValueError("not every original selected leaf has a reviewed descriptor")
    by_ordinal = {fragment["source_literal_ordinal"]:fragment for fragment in fragments}
    if set(by_ordinal) != set(range(len(source_literals))): raise ValueError("duplicate/missing selected leaf ordinals")
    transformed, changes = expression, []
    for ordinal, token in enumerate(source_literals):
        fragment = by_ordinal[ordinal]
        if (token.start,token.end) != (fragment["source_expression_literal_start"],fragment["source_expression_literal_end"]):
            raise ValueError("source-selected literal span changed")
        if inventory.decode_c_string(token.text) != fragment["english_source_literal"]:
            raise ValueError("source-selected literal bytes changed")
        nested = json.dumps({"id":fragment["id"],"args":{}},separators=(",",":"))
        replacement = f"nh_phase4_text({token.text}, {json.dumps(nested)})"
        changes.append((token.start,token.end,replacement))
    for start,end,replacement in sorted(changes,reverse=True):
        transformed = transformed[:start] + replacement + transformed[end:]
    reverted = transformed
    for start,end,replacement in changes:
        reverted = sem.replace_once(reverted,replacement,expression[start:end],"selected-leaf-single-evaluation")
    if reverted != expression: raise ValueError("selected literal expression tokens changed")
    return transformed


def selected_format(expression, choices):
    leaves = split_conditional(expression)
    if any(not re.fullmatch(r"[A-Za-z_]\w*", leaf) or leaf not in choices for leaf in leaves):
        raise ValueError("dynamic format has a non-reviewed value leaf")
    tokens = inventory.c_tokens(expression)
    changes = []
    for token in tokens:
        if token.kind == "identifier" and token.text in choices:
            changes.append((token.start,token.end,f"nh_phase4_format({token.text}, &{choices[token.text]})"))
    if len(changes) != len(leaves): raise ValueError("format symbol occurs inside its condition")
    transformed = expression
    for start,end,replacement in sorted(changes,reverse=True): transformed = transformed[:start]+replacement+transformed[end:]
    reverted = transformed
    for start,end,replacement in changes: reverted = sem.replace_once(reverted,replacement,expression[start:end],"selected-format-single-evaluation")
    if reverted != expression: raise ValueError("original dynamic format expression changed")
    return transformed


def arg_type(argument):
    if argument.get("c_length_modifier") == "z" and argument["type"] == "unsigned":
        return "size_t", "NH_TEXT_UNSIGNED"
    return sem.argument_type(argument)


def text_precision(arguments):
    return any(argument["type"] == "text" and "." in argument.get("source_format_specifier","") for argument in arguments)


def getlin_delivery(source):
    """Claim at original entry; bracket only the original public prompt call.

    Queued keys echo through original pline and consume the pending owner
    without claiming the whole composed echo as a localized getlin prompt.
    No predicate, command queue, input buffer, or engine state is replayed.
    """
    entry = "getlin(const char *query, char *bufp)\n{\n"
    owner = "    struct nh_text_scope *nh_owner = nh_text_claim(NH_TEXT_QUESTION);\n"
    result = sem.replace_once(source, entry, entry+owner, "phase4-getlin-logical-claim")
    dispatch = "    (*windowprocs.win_getlin)(query, bufp);"
    bracket = ("    {\n"
               "        struct nh_text_scope *nh_previous = nh_text_emit(nh_owner);\n"
               "        (*windowprocs.win_getlin)(query, bufp);\n"
               "        nh_text_emit(nh_previous);\n"
               "    }")
    result = sem.replace_once(result, dispatch, bracket, "phase4-getlin-accepted-callback")
    reverted = sem.replace_once(result, bracket, dispatch, "phase4-getlin-dispatch-proof")
    reverted = sem.replace_once(reverted, entry+owner, entry, "phase4-getlin-entry-proof")
    if reverted != source:
        raise ValueError("original getlin tokens or delivery logic changed")
    return result


def getlin_getter(source):
    """Separate bridge delta: exact API, callback and sentinel association."""
    anchor = '    if (kind == NH_TEXT_RAW && raw && window == -1) return s->json;\n'
    addition = ('    if (kind == NH_TEXT_QUESTION && !strcmp(s->descriptor->api,"getlin") &&\n'
                '        !strcmp(callback,"shim_getlin") && window == -1) return s->json;\n')
    result = sem.replace_once(source, anchor, anchor+addition, "phase4-getlin-getter")
    if sem.replace_once(result, addition, "", "phase4-getlin-getter-proof") != source:
        raise ValueError("getlin getter delta changed the frozen bridge")
    return result


def call_directives(call):
    """Physical original preprocessing lines, excluding quoted/comment '#'.

    C preprocessing depends on physical line boundaries. Token equivalence
    alone cannot prove an #ifdef survives a whole-call replacement.
    """
    result=[]
    for token in inventory.c_tokens(call):
        if token.text != "#": continue
        start=call.rfind("\n",0,token.start)+1
        if call[start:token.start].strip(): continue
        end=call.find("\n",token.start)
        if end<0: end=len(call)
        result.append((call.count("\n",0,start),call[start:end]))
    return result


def rewrite_native_call(original, api, function, arguments, changed_arguments):
    """Rename the callee and changed argument spans, preserving native layout.

    Keep every original comma, space, comment, newline and directive boundary.
    Every argument expression still occurs once in its original branch.
    """
    if not re.match(r"^"+re.escape(api)+r"\s*\(",original):
        raise ValueError("original native API boundary changed")
    opening=original.find("(")
    parsed,closing=sem.call_arguments(original,opening)
    if closing!=len(original) or parsed!=arguments or len(arguments)!=len(changed_arguments):
        raise ValueError("original exact argument spans changed")
    cursor=opening+1;changes=[]
    for argument,changed in zip(arguments,changed_arguments,strict=True):
        start=original.find(argument,cursor)
        if start<0 or not argument: raise ValueError("original argument span unavailable")
        end=start+len(argument);cursor=end
        if changed!=argument: changes.append((start,end,changed))
    result=original
    for start,end,changed in reversed(changes): result=result[:start]+changed+result[end:]
    result=function+result[len(api):]
    if call_directives(result)!=call_directives(original):
        raise ValueError("preprocessor-spanning call requires exact original directive boundaries")
    return result


def compose_calls_before_core(source, name, operations):
    """Compose after frozen call renames, before core/name/quest hooks.

    The caller owns the reviewed combined generation. This pure function does
    not write sources. It requires exactly the remaining original C calls,
    pairs equal contracts in original source order, and fails on uncertainty.
    Later helper/body rewrites must never be guessed or reverse-matched.
    """
    wanted = [operation for operation in operations if operation["source"] == name]
    grouped = defaultdict(list)
    for operation in wanted:
        key = (operation["api"],tuple(tuple(sem.tokens(arg)) for arg in operation["original_argument_expressions"]))
        grouped[key].append(operation)
    matches = defaultdict(list)
    wanted_apis = {key[0] for key in grouped}
    source_tokens = inventory.c_tokens(source)
    for index,token in enumerate(source_tokens[:-1]):
        if token.kind != "identifier" or source_tokens[index+1].text != "(": continue
        if token.text not in wanted_apis: continue
        arguments,closing = sem.call_arguments(source,source_tokens[index+1].start)
        key = (token.text,tuple(tuple(sem.tokens(arg)) for arg in arguments))
        if key in grouped: matches[key].append((token.start,closing))
    changes = []
    for key,expected in grouped.items():
        found = matches[key]
        expected = sorted(expected,key=lambda operation:operation["original_start_offset"])
        if len(found) != len(expected):
            raise ValueError(f"phase4 compose requires exact pre-core calls: {name}/{key[0]} expected {len(expected)}, found {len(found)}")
        for (start,end),operation in zip(found,expected,strict=True):
            if call_directives(source[start:end])!=call_directives(operation["replacement"]):
                raise ValueError(f"native directive layout changed: {name}:{operation.get('line')}")
            changes.append((start,end,operation["replacement"],source[start:end]))
    result = source
    for start,end,replacement,_ in sorted(changes,reverse=True): result = result[:start]+replacement+result[end:]
    reverted = result
    for _,_,replacement,original in changes:
        reverted = sem.replace_once(reverted,replacement,original,"phase4-pure-composition-proof")
    if reverted != source: raise ValueError("phase4 composition changed other frozen source tokens")
    return result


def wrapper(entry, site, function, tagged, raw_slots, dynamic=False):
    api, contract = site["api"], API[site["api"]]
    arguments = entry["arguments"]
    types = list(contract["types"])
    if site["format_argument_index"] != contract["format"]: raise ValueError("original format slot changed")
    if len(site["argument_expressions"]) != len(types)+len(arguments): raise ValueError("original typed printf arity is unresolved")
    captured = [arg_type(argument) for argument in arguments]
    c_types = types + [kind for kind,_ in captured]
    if dynamic: c_types[contract["format"]] = "struct nh_phase4_format_value"
    for index in tagged: c_types[len(types)+index] = "struct nh_phase4_text_value"
    formal = ", ".join(f"{kind} nh_p{i}" for i,kind in enumerate(c_types))
    descriptor = "nh_p"+str(contract["format"])+".descriptor" if dynamic else "&nh_descriptor"
    body = [f"static inline {contract['return']} {function}({formal}) {{"]
    if text_precision(arguments):
        # Original printf can expose only a prefix. Until a reviewed producer
        # copies exactly that visible prefix, do not serialize/name-tag the
        # complete computed argument, even for an English-only source frame.
        actual = [f"nh_p{i}" for i in range(len(c_types))]
        if dynamic: actual[contract["format"]] += ".original"
        for index in tagged: actual[len(types)+index] += ".original"
        call = f"{api}({', '.join(actual)})"
        body += ["    /* Native-English fallback: precision-bound text has no approved public-prefix producer. */",
                 "    nh_text_cancel_pending(); /* presentation-only owner must not leak from an outer wrapper */",
                 "    "+call+";" if contract["return"] == "void" else "    return "+call+";", "}"]
        return "\n".join(body)+"\n", c_types
    if not dynamic:
        body += ["    static const struct nh_text_descriptor nh_descriptor = {",
                 f"        {json.dumps(entry['id'])}, {json.dumps(api)}, {contract['kind']}, {HELPERS.get(api,'NH_TEXT_PLAIN')}", "    };"]
    for index in raw_slots:
        p = len(types)+index
        body.append(f"    const char *nh_public_{index} = nh_text_name_event(nh_p{p});")
        body.append(f"    char *nh_raw_{index} = nh_public_{index} ? NULL : nh_phase4_public_raw(nh_p{p});")
    if arguments:
        body.append("    const struct nh_text_argument nh_arguments[] = {")
        for index,(argument,(_,kind)) in enumerate(zip(arguments,captured,strict=True)):
            p = len(types)+index
            original = f"nh_p{p}.original" if index in tagged else f"nh_p{p}"
            event = f"nh_p{p}.event_json" if index in tagged else f"(nh_public_{index} ? nh_public_{index} : nh_raw_{index})" if index in raw_slots else "NULL"
            value = original+", 0, "+event if kind == "NH_TEXT_TEXT" else "NULL, (int64_t)"+original+", NULL"
            body.append(f"        {{{json.dumps(argument['name'])}, {kind}, {value}}},")
        body.append("    };")
    window = "nh_p0" if types[0] == "winid" else "-1"
    body.append(f"    struct nh_text_scope *nh_scope = nh_text_begin({descriptor}, {'nh_arguments' if arguments else 'NULL'}, {len(arguments)}, {window});")
    for index in tagged:
        body.append(f"    if (!nh_p{len(types)+index}.event_json) nh_text_truncated(nh_scope);")
    for index in raw_slots:
        body.append(f"    if (!nh_public_{index} && !nh_raw_{index}) nh_text_truncated(nh_scope);")
        body.append(f"    free(nh_raw_{index}); /* nh_text_begin owns its validated copy now */")
    if contract["direct"]: body.append("    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);")
    actual = [f"nh_p{i}" for i in range(len(c_types))]
    if dynamic: actual[contract["format"]] += ".original"
    for index,(_,kind) in enumerate(captured):
        if kind == "NH_TEXT_TEXT":
            p = len(types)+index
            original = f"nh_p{p}.original" if index in tagged else f"nh_p{p}"
            actual[p] = f"nh_text_captured_text(nh_scope, {index}, {original})"
    call = f"{api}({', '.join(actual)})"
    body.append("    "+call+";" if contract["return"] == "void" else f"    {contract['return']} nh_result = {call};")
    if contract["direct"]: body.append("    nh_text_emit(nh_previous);")
    body.append("    nh_text_end(nh_scope);")
    if contract["return"] != "void": body.append("    return nh_result;")
    body.append("}")
    return "\n".join(body)+"\n", c_types


def generate(output, include_reviewed=True):
    output.mkdir(parents=True,exist_ok=True)
    (output/"include/nh-phase4").mkdir(parents=True,exist_ok=True)
    (output/"src").mkdir(exist_ok=True)
    for name in ("nh-phase4-values.h", "nh-phase4-values.c"):
        shutil.copy2(ROOT/"tools/semantic-text/phase4"/name,
                     output/("include" if name.endswith(".h") else "src")/name)
    bridge_path = ROOT/"tools/semantic-text/nh-semantic.c"
    original_bridge = bridge_path.read_text(encoding="utf8")
    changed_bridge = getlin_getter(original_bridge)
    bridge_patch = "".join(difflib.unified_diff(original_bridge.splitlines(True),changed_bridge.splitlines(True),
        fromfile="phase3/nh-semantic.c",tofile="phase4/nh-semantic.c"))
    (output/"bridge-delta.patch").write_text(bridge_patch,encoding="utf8",newline="\n")
    raw_inventory = ROOT/"catalog/source-text-messages.json"
    document = load(raw_inventory)
    frozen = load(ROOT/"locales/gameplay-core.metadata.json")
    frozen_entries = {entry["id"]:entry for entry in frozen["entries"] if entry["category"] == "message"}
    frozen_ids = set(frozen_entries)
    frozen_sites = {(site["source"],site["line"],site["api"],entry["id"]) for entry in frozen_entries.values() for site in entry["source_call_sites"]}
    baseline_snapshots = {str(p.relative_to(ROOT)):sha(p.read_bytes()) for p in
        (ROOT/"locales/gameplay-core.json",ROOT/"locales/gameplay-core.metadata.json",ROOT/"tools/semantic-text/generated/semantic.patch")}
    compiled = {name.replace("\\","/") for name in load(ROOT/"build/engine-manifest.json")["compiled_sources"]}
    literal = [row for row in document["messages"] if row["source"].startswith("src/") and row.get("english_id_candidate")]
    dynamic = [row for row in document["messages"] if row["source"].startswith("src/") and not row.get("english_id_candidate")]
    reviewed = load(PHASE4/"reviewed-translations.metadata.json")
    dynamic_reviewed = load(PHASE4/"reviewed-dynamic-translations.metadata.json")
    reviewed_entries = {entry["id"]:entry for entry in reviewed["entries"]} if include_reviewed else {}
    translated = {"en":{},"ja":{}}
    if include_reviewed:
        for path in (PHASE4/"reviewed-translations.json",PHASE4/"reviewed-dynamic-translations.json"):
            data = load(path)
            for locale in ("en","ja"): translated[locale].update(data[locale])
    fragments = defaultdict(lambda:defaultdict(list))
    for fragment in reviewed["source_literal_fragments"]:
        fragments[fragment["message_id"]][fragment["argument_name"]].append(fragment)
    english, japanese, schemas, entries, ledger, sites = {}, {}, {}, {}, [], []
    english.update(translated["en"]);japanese.update(translated["ja"])
    english["nethack.public_text.original"] = "{original}"
    schemas["nethack.public_text.original"] = ["original"]
    grouped = defaultdict(list)
    for row in literal:
        identifier, api = row["english_id_candidate"], row["api"]
        disposition = None
        if (row["source"],row["line"],api,identifier) in frozen_sites: disposition = "frozen-phase3"
        elif row["source"] not in compiled: disposition = "translation-unit-not-in-current-engine"
        elif api in DEFERRED: disposition = "deferred-output-contract"
        elif api not in API: disposition = "unsupported-output-api"
        record = {"id":identifier,"source":row["source"],"line":row["line"],"api":api}
        if disposition:
            ledger.append({**record,"status":disposition,"reason":DEFERRED.get(api)})
            continue
        try:
            whole,_ = catalog.whole_message("verbalize" if api == "verbalize1" else api,row["english_source_template"],"")
            template,args,conversions = catalog.convert_printf(whole,row["format_semantics"] == "printf-like")
            # size_t is uint32 in the pinned wasm32 target. Keep original %zu
            # in C/provenance; the pure formatter consumes its equivalent %u.
            for argument in args:
                arg_type(argument)
                if argument.get("c_length_modifier") == "z":
                    template = template.replace(argument["name"]+":%zu",argument["name"]+":%u")
                    argument["catalog_target_length_normalization"] = "wasm32 size_t -> uint32"
            entry = {"id":identifier,"category":"message","en":template,"arguments":args,
                     "source_english_literal":row["english_source_template"],"api":api,
                     "format_semantics":row["format_semantics"],"printf_conversions":conversions}
            if identifier in frozen_ids:
                entry["extends_frozen_id"] = True
                if frozen_entries[identifier]["en"] != template: raise ValueError("frozen ID template changed at additional site")
                japanese.setdefault(identifier,frozen_entries[identifier]["ja"])
            if identifier in entries and entries[identifier]["en"] != template: raise ValueError("same ID has conflicting source templates")
            entries[identifier] = entry
            english.setdefault(identifier,template)
            schemas[identifier] = [argument["name"] for argument in args]
            variants = catalog.variants(api,row["english_source_template"],"")
            for variant,(variant_en,_) in variants.items():
                variant_id = "variant."+variant+"."+identifier
                english.setdefault(variant_id,catalog.convert_printf(variant_en,row["format_semantics"] == "printf-like")[0])
                schemas[variant_id] = schemas[identifier]
            grouped[row["source"]].append((row,entry))
        except ValueError as error:
            ledger.append({**record,"status":"unresolved-static-contract","reason":str(error)})
    if include_reviewed:
        dynamic_groups = defaultdict(list)
        for entry in dynamic_reviewed["entries"]:
            for evidence in entry["source_evidence"]:
                dynamic_groups[(evidence["source"],evidence["line"],entry["original_api"])].append(entry)
        for (name,line,api),choices in dynamic_groups.items():
            original_rows = [row for row in dynamic if (row["source"],row["line"],row["api"]) == (name,line,api)]
            if len(original_rows) != 1: raise ValueError("reviewed dynamic origin did not resolve one original call")
            row = dict(original_rows[0])
            if name not in compiled or api not in API: raise ValueError("reviewed dynamic origin is outside supported compiled UI")
            arguments = choices[0]["arguments"]
            if any(choice["arguments"] != arguments for choice in choices): raise ValueError("dynamic selected formats change typed argument union")
            entry = {"id":choices[0]["id"],"en":choices[0]["whole_message_en"],"arguments":arguments,"dynamic_choices":choices}
            grouped[name].append((row,entry))
            for choice in choices: schemas[choice["id"]] = [argument["name"] for argument in arguments]
    # Native core hook is isolated from the frozen phase-three patch. It is
    # required even when windows.c has no new literal producer call sites.
    grouped.setdefault("src/windows.c",[])
    patches, hooks, operations = [], [], []
    for name,rows in sorted(grouped.items()):
        original = (UPSTREAM/name).read_text(encoding="utf8")
        conditionals = guards(original)
        line_offsets = [0]+[match.end() for match in re.finditer("\n",original)]
        changes, wrappers, claimed = [], [], set()
        for row,entry in rows:
            record = {"id":entry["id"],"source":name,"line":row["line"],"api":row["api"]}
            try:
                line = row["line"]
                start,end = line_offsets[line-1],line_offsets[line] if line < len(line_offsets) else len(original)
                candidates = []
                for match in re.finditer(r"\b"+re.escape(row["api"])+r"\s*\(",original[start:end]):
                    offset = start+match.start()
                    args,closing = sem.call_arguments(original,original.find("(",offset))
                    if offset not in claimed and len(args) == len(row["argument_expressions"]) and all(sem.tokens(a) == sem.tokens(b) for a,b in zip(args,row["argument_expressions"],strict=True)):
                        candidates.append((offset,args,closing))
                if not candidates: raise ValueError("exact original call binding unavailable")
                offset,args,closing = candidates[0]
                function = "nh_phase4_site_"+sha(f"{entry['id']}|{name}|{offset}")[:16]
                changed_args, tagged = list(args), set()
                base_count = len(API[row["api"]]["types"])
                is_dynamic = bool(entry.get("dynamic_choices"))
                if is_dynamic:
                    format_choices = {}
                    for choice in entry["dynamic_choices"]:
                        definition = choice["definition"]
                        symbol = definition["symbol"]
                        format_literal = original[definition["literal_start_offset"]:definition["literal_end_offset"]]
                        if inventory.decode_c_string(format_literal) != definition["english_literal"]: raise ValueError("immutable dynamic format definition changed")
                        descriptor = "nh_phase4_format_"+sha(choice["id"]+"|"+function)[:16]
                        format_choices[symbol] = descriptor
                        wrappers.append("static const struct nh_text_descriptor "+descriptor+" = {"+
                            ", ".join((json.dumps(choice["id"]),json.dumps(row["api"]),API[row["api"]]["kind"],HELPERS.get(row["api"],"NH_TEXT_PLAIN")))+"};\n")
                    changed_args[API[row["api"]]["format"]] = selected_format(args[API[row["api"]]["format"]],format_choices)
                for index,argument in enumerate(entry["arguments"]):
                    selected = fragments[entry["id"]].get(argument["name"],[]) if entry["id"] in reviewed_entries else []
                    if is_dynamic:
                        selected = [fragment for fragment in dynamic_reviewed["source_literal_fragments"] if fragment["source"] == name and line in fragment["native_call_lines"] and sem.tokens(fragment["source_expression"]) == sem.tokens(args[base_count+index])]
                    if selected:
                        expression = args[base_count+index]
                        if any(sem.tokens(expression) != sem.tokens(fragment["source_expression"]) for fragment in selected): raise ValueError("reviewed selected-leaf argument changed")
                        changed_args[base_count+index] = selected_literals(expression,selected)
                        tagged.add(index)
                approved = reviewed_entries.get(entry["id"],{})
                raw_slots = {index for index,argument in enumerate(entry["arguments"]) if argument["name"] in approved.get("raw_visible_fallback_arguments",[])}
                generated,c_types = wrapper(entry,row,function,tagged,raw_slots,is_dynamic)
                original_call = original[offset:closing]
                new_call = rewrite_native_call(original_call,row["api"],function,args,changed_args)
                if sem.tokens(row["api"]+"("+", ".join(args)+")") != sem.tokens(original_call): raise ValueError("original call token proof failed")
                claimed.add(offset);changes.append((offset,closing,new_call,original_call));wrappers.append(generated)
                operations.append({**record,"original_start_offset":offset,"original_end_offset":closing,
                                   "original_call":original_call,"original_argument_expressions":args,"replacement":new_call,
                                   "preprocessor_directives_preserved":call_directives(original_call)})
                sites.append({**record,"wrapper":function,"formal_c_types":c_types,"original_call_sha256":sha(original_call),
                    "function_candidate":row.get("function_candidate"),"format_argument_index":row["format_argument_index"],
                    "original_argument_expressions":args,"original_argument_token_sha256":[sha(json.dumps(sem.tokens(arg))) for arg in args],
                    "selected_literal_slots":[entry["arguments"][index]["name"] for index in sorted(tagged)],
                    "raw_public_fallback_slots":[entry["arguments"][index]["name"] for index in sorted(raw_slots)],
                    "conditional_guards":conditionals[line],"preprocessor_active_proven":not conditionals[line],
                    "dynamic_origin":is_dynamic,"selected_message_ids":[choice["id"] for choice in entry.get("dynamic_choices",[])],
                    "semantic_capture_prepared":not text_precision(entry["arguments"]),
                    "public_visibility_status":"native-English-fallback-until-precision-prefix-producer" if text_precision(entry["arguments"]) else "exact-consumed-promoted-union",
                    "compiled_translation_unit":True,"japanese_source_approved":is_dynamic or entry["id"] in reviewed_entries or entry["id"] in frozen_ids,"runtime_verified":False})
                ledger.append({**record,"status":"source-only-dynamic-producer-prepared" if is_dynamic else "source-only-producer-prepared"})
            except ValueError as error:
                ledger.append({**record,"status":"unresolved-static-contract","reason":str(error)})
        changed = original
        for start,end,replacement,_ in sorted(changes,reverse=True): changed = changed[:start]+replacement+changed[end:]
        reverted = changed
        for _,_,replacement,original_call in changes: reverted = sem.replace_once(reverted,replacement,original_call,"phase4-source-token-preservation")
        if reverted != original: raise ValueError("source expressions or literal tokens changed")
        getlin_core = name == "src/windows.c"
        if getlin_core:
            changed = getlin_delivery(changed)
        if wrappers or getlin_core:
            header_name = "sites-"+Path(name).stem+".h"
            header = NOTICE+'#include "nh-phase4-values.h"\n'+"\n".join(wrappers)
            (output/"include/nh-phase4"/header_name).write_text(header,encoding="utf8",newline="\n")
            changed = sem.replace_once(changed,'#include "hack.h"\n','#include "hack.h"\n'+f'#include "nh-phase4/{header_name}"\n',"phase4-header-inclusion")
            changed = NOTICE+changed
            patches.extend(difflib.unified_diff(original.splitlines(True),changed.splitlines(True),fromfile="upstream/"+name,tofile="phase4/"+name))
            hooks.append({"source":name,"sites":len(changes),"original_sha256":sha(original),"phase4_sha256":sha(changed),
                          "core_getlin_delivery_hook":getlin_core})
    static_sites = [site for site in sites if not site["dynamic_origin"]]
    prepared_ids = {site["id"] for site in static_sites}
    dynamic_ids = {identifier for site in sites for identifier in site["selected_message_ids"]}
    # Keep resource entries/variants for reviewed fragments; no JA is invented.
    schemas.update({identifier:sorted(catalog.names(template)) for identifier,template in english.items() if identifier not in schemas})
    data = {"en":english,"ja":japanese,"argument_schemas":schemas}
    (output/"catalog.json").write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    (output/"phase4.patch").write_text("".join(patches),encoding="utf8",newline="\n")
    (output/"call-operations.json").write_text(json.dumps({"schema_version":1,"date":DATE,"source_only":True,
        "composition_stage":"after frozen literal API renames; before native core/quest/name/object hooks; no filesystem apply",
        "operations":operations},ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    source_metadata = []
    for identifier in sorted(prepared_ids):
        record = dict(entries[identifier])
        record.update({"source_call_sites":[site for site in static_sites if site["id"] == identifier],
                       "source_only":True,"runtime_integration":False,"runtime_verified":False,
                       "source_translation_approved":identifier in japanese,
                       "translation_status":"reviewed-template-source-only" if identifier in japanese else "English-only-awaiting-Japanese-authoring",
                       "required_argument_union":[argument["name"] for argument in record["arguments"]]})
        record["semantic_capture_prepared"] = not text_precision(record["arguments"])
        record["public_visibility_status"] = "native-English-fallback-until-precision-prefix-producer" if text_precision(record["arguments"]) else "exact-consumed-promoted-union"
        if identifier in japanese: record["ja"] = japanese[identifier]
        record["helper_variant_ids"] = [variant for variant in english if variant.startswith("variant.") and variant.endswith("."+identifier)]
        source_metadata.append(record)
    metadata = {"schema_version":1,"date":DATE,"source_only":True,"runtime_integration":False,
                "runtime_catalog":"catalog.json","native_site_ledger":"audit.json",
                "entries":source_metadata,"dynamic_reviewed_entries":dynamic_reviewed["entries"] if include_reviewed else [],
                "source_contract":"original literal IDs, fixed native prototypes, promoted printf types, exact expressions, helper variants and recorded conditional branches; no runtime English matching",
                "denominator_contract":"prepared public-C candidates in actual compiled translation units; conditional activity and accepted-output runtime coverage remain unverified"}
    (output/"metadata.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    untranslated = defaultdict(list)
    for record in source_metadata:
        if record["source_translation_approved"]: continue
        arguments = record["arguments"]
        category = "zero-argument" if not arguments else "numeric-only" if all(argument["type"] in ("integer","unsigned") for argument in arguments) else "text-or-mixed-source-producer-contract"
        untranslated[category].append(record["id"])
    partition = {"schema_version":1,"date":DATE,"source_only":True,"metadata":"metadata.json",
                 "purpose":"disjoint source-ID authoring priorities; not executable binding or completed JA coverage",
                 "counts":{key:len(value) for key,value in untranslated.items()},"ids":dict(untranslated),
                 "rule":"exact source IDs only; no English-content lookup; dynamic/data/menu-table fields outside these literal call IDs remain separate"}
    (output/"untranslated-primary-ids.json").write_text(json.dumps(partition,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    audit = {"schema_version":1,"date":DATE,"runtime_integration":False,"compiled":False,"source_only":True,
        "runtime_catalog":"catalog.json","source_patch":"phase4.patch","bridge_delta":"bridge-delta.patch",
        "source_metadata":"metadata.json","untranslated_id_partition":"untranslated-primary-ids.json",
        "composable_call_operations":"call-operations.json",
        "bridge_delta_source_sha256":sha(original_bridge),"bridge_delta_result_sha256":sha(changed_bridge),
        "source_inventory_sha256":sha(raw_inventory.read_bytes()),"frozen_inputs":baseline_snapshots,
        "denominator":{"core_literal_call_sites":len(literal),"core_distinct_literal_ids":len({row['english_id_candidate'] for row in literal}),"core_dynamic_origin_sites":len(dynamic),
            "all_tree_literal_call_sites":sum(bool(row.get('english_id_candidate')) for row in document['messages']),"all_tree_dynamic_origin_sites":sum(not row.get('english_id_candidate') for row in document['messages']),
            "formatter_origins":len(document['intermediate_formatters']),"scope":"C lexical source occurrences; resource fields, data prose and actual preprocessor activity are separate denominators"},
        "counts":{"frozen_message_ids":len(frozen_ids),"new_static_ids_prepared":len(prepared_ids-frozen_ids),"new_static_call_sites_prepared":len(static_sites),"candidate_ids_with_english_catalog":len(entries),
            "frozen_id_additional_sites_prepared":sum(site['id'] in frozen_ids for site in static_sites),"new_dynamic_ids_prepared":len(dynamic_ids),"new_dynamic_origin_sites_prepared":sum(site['dynamic_origin'] for site in sites),
            "reviewed_static_ids_with_prepared_wrappers":len(prepared_ids & set(reviewed_entries)),"japanese_catalog_keys":len(japanese),"english_catalog_keys":len(english),
            "conditional_guarded_prepared_sites":sum(bool(site['conditional_guards']) for site in sites),"source_files":len(hooks),
            "precision_fallback_static_ids":len({site['id'] for site in static_sites if not site['semantic_capture_prepared']}),
            "precision_fallback_static_sites":sum(not site['semantic_capture_prepared'] for site in static_sites),
            "semantic_capture_prepared_static_sites":sum(site['semantic_capture_prepared'] for site in static_sites)},
        "status_site_counts":dict(Counter(row['status'] for row in ledger)),"api_prepared_counts":dict(Counter(site['api'] for site in sites)),
        "api_unresolved_counts":dict(Counter(row['api'] for row in ledger if row['status'] not in ('frozen-phase3','source-only-producer-prepared','source-only-dynamic-producer-prepared'))),
        "sites":sites,"files":hooks,"ledger":ledger,"dynamic_source_proposals":dynamic_reviewed,
        "dynamic_status":"four reviewed immutable selected-format IDs prepared; other dynamic origins remain explicit native English",
        "call_contract":"all original predicates, literals, format expressions, names and RNG expressions evaluated once; C argument order stays unspecified",
        "japanese_contract":"no JA copied from EN; unreviewed IDs have English only; absent required descriptors retain exact native English",
        "precision_visibility_contract":"precision-bound text wrappers retain original C calls but never construct semantic scopes/JSON until an exact public-prefix producer exists",
        "getlin_contract":"claim at native entry; bracket only original win_getlin; queued-key pline echo remains exact English; shim_getlin/-1 getter additionally requires descriptor.api=getlin",
        "remaining_classes":["unreviewed dynamic/macro formats and local composed buffers","deferred configuration/history/logging and diagnostic channels","compiled-file conditional preprocessor branches not yet proven active","data/static table fields and full help/rumor/quest/name grammar outside message-call denominator"]}
    for path,expected in baseline_snapshots.items():
        if sha((ROOT/path).read_bytes()) != expected: raise ValueError("frozen baseline changed during source-only generation")
    (output/"audit.json").write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    return audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,default=DEFAULT_OUTPUT)
    parser.add_argument("--english-only",action="store_true",help="Disable the separate reviewed JA additions")
    args = parser.parse_args()
    audit = generate(args.output.resolve(),not args.english_only)
    print(json.dumps({"status":"phase4-source-only",**audit["counts"],"denominator":audit["denominator"],"output":str(args.output)}))


if __name__ == "__main__":
    sys.dont_write_bytecode = True
    main()
