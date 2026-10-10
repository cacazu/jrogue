"""Read-only Angband 4.2.6 source/text inventory; standard-library only.

The extractor inventories tokens, not a runtime localization solution. Visibility
and proposed identifiers are review aids, never claims of completed translation.
"""
from __future__ import annotations

import argparse
import bisect
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import xml.etree.ElementTree as ET

COMMIT = "f3082213b73f3e463e3d0d60bff4b00462beae6e"
DEFAULT_SOURCE = Path(r"C:\Users\kit\gameme\jnethack\jrouge\angband\upstream\angband-4.2.6")
C_EXTENSIONS = {".c", ".h", ".m", ".inc", ".rc"}
TOKEN = re.compile(r'(?P<comment>/\*[\s\S]*?\*/|//[^\n]*)|(?P<space>\s+)|(?P<string>(?:u8|[LuU])?"(?:[^"\\]|\\[\s\S])*")|(?P<char>(?:[LuU])?\'(?:[^\'\\]|\\[\s\S])*\')|(?P<identifier>[A-Za-z_][A-Za-z_0-9]*)|(?P<number>\d[\w.]*)|(?P<punct>.)')
FORMAT = re.compile(r'%(?:(\d+)\$)?([-+ #0]*)(\*|\d+)?(?:\.(\*|\d+))?(hh|ll|[hlLjzt])?([diuoxXfFeEgGaAcspn%])')
CONTROLS = {"if", "for", "while", "switch", "sizeof", "return", "_Static_assert"}
DIRECT_VISIBLE = {"msg", "msgt", "prt", "c_prt", "put_str", "c_put_str", "text_out", "text_out_c", "text_out_e", "text_out_to_screen", "textblock_append", "textblock_append_c", "textblock_append_pict", "plog", "plog_fmt", "quit", "quit_fmt", "get_check", "get_string", "get_char", "get_file", "get_name", "get_quantity", "get_com", "get_item", "Term_putstr", "Term_addstr", "menu_dynamic_add", "menu_dynamic_add_label", "string_make", "textui_textblock_show", "textui_textblock_place", "player_exp_gain", "note", "event_signal_string"}
FORMATTERS = {"format", "vformat", "strnfmt", "strnfcat", "snprintf", "sprintf", "printf", "fprintf", "file_putf", "file_put", "string_append", "my_strcpy", "my_strcat", "screen_save", "screen_load"}
INTERNAL_CALLS = {"parser_reg", "parser_getstr", "parser_getsym", "parser_getint", "parser_getuint", "parser_getchar", "parser_hasval", "path_build", "file_open", "file_exists", "file_delete", "strcmp", "strncmp", "streq", "prefix", "suffix", "strstr", "strchr", "strrchr", "fopen", "SDL_GetHint", "SDL_SetHint", "sound", "cmd_set_arg_string", "cmd_set_arg_item", "cmd_get_arg_item", "cmd_get_arg_string", "cmd_set_arg_number", "cmd_set_arg_direction", "cmd_get_arg_direction", "cmd_get_arg_number", "cmd_set_arg_choice", "cmd_get_arg_choice", "lookup_monster", "lookup_monster_base", "lookup_kind", "lookup_artifact_name", "lookup_sval", "tval_find_idx", "effect_lookup", "randname_make"}


def slug(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", value).strip("_") or "unnamed"


def decode_string(token: str) -> str:
    body = token[token.index('"') + 1:-1]
    def unescape(m):
        s = m.group(1)
        if s.startswith("x"):
            return chr(int(s[1:], 16))
        if s[0] in "01234567":
            return chr(int(s, 8))
        if s[0] in "uU":
            return chr(int(s[1:], 16))
        return {"n":"\n", "r":"\r", "t":"\t", "a":"\a", "b":"\b", "f":"\f", "v":"\v", "\\":"\\", '"':'"', "'":"'", "?":"?", "\n":"", "\r\n":""}.get(s, "\\" + s)
    return re.sub(r"\\(x[0-9a-fA-F]+|[0-7]{1,3}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|\r?\n|.)", unescape, body)


def placeholders(text: str) -> dict:
    fmt = []
    for m in FORMAT.finditer(text):
        if m.group(6) == "%":
            continue
        fmt.append({"raw":m.group(), "position":m.group(1), "conversion":m.group(6), "length":m.group(5), "width_argument":m.group(3) == "*", "precision_argument":m.group(4) == "*"})
    return {"printf":fmt, "braced":re.findall(r"\{([a-zA-Z][a-zA-Z0-9_]*)\}", text), "monster_plural_forms":re.findall(r"\[[^\]\n]*\]", text), "object_name_markup": any(m in text for m in ("~", "& ", "|", "#"))}


def subsystem(path: str) -> str:
    if "/tests/" in path: return "test"
    if "/borg/" in path: return "borg_optional"
    if any(x in path for x in ("/cocoa/", "/win/", "/nds/", "/sdl2/")) or Path(path).name.startswith("main-"): return "native_frontend"
    stem = Path(path).stem
    if stem.startswith("ui-") or stem == "z-term": return "presentation"
    if stem.startswith("cmd-") or stem in {"cmds", "game-input", "game-world", "game-event"}: return "application_or_domain_boundary"
    if stem.startswith(("mon-", "obj-", "player-", "project-", "cave-", "gen-", "effect-handler-")) or stem in {"monster", "object", "player", "cave", "generate", "project", "effect-handler", "effects", "effects-info", "store", "trap"}: return "domain"
    return "infrastructure_or_shared"


def classify(path: str, call: str | None, text: str, prefix: str) -> str:
    if "/tests/" in path: return "test_fixture_or_diagnostic"
    if re.search(r"^\s*#\s*include\s*", prefix): return "include_path"
    if call in INTERNAL_CALLS: return "parser_or_identity_or_path"
    if call in DIRECT_VISIBLE: return "visible_sink_or_presentation_candidate"
    if call in FORMATTERS: return "formatted_or_composed_candidate"
    if not text.strip(): return "empty_or_spacing"
    if re.fullmatch(r"[%\d. +\-*#a-zA-Z]+", text) and FORMAT.search(text): return "format_only_candidate"
    return "unreviewed_literal"


def c_inventory(path: Path, root: Path):
    text = path.read_text(encoding="utf-8", errors="replace")
    rel = path.relative_to(root).as_posix()
    line_offsets = [0] + [m.end() for m in re.finditer("\n", text)]
    tokens = [(m.lastgroup,m.group(),m.start(),m.end()) for m in TOKEN.finditer(text) if m.lastgroup not in {"comment", "space"}]
    parens, braces = [], []
    function, function_line = None, None
    rows, functions = [], []
    index = 0
    while index < len(tokens):
        kind, value, start, end = tokens[index]
        if value == "(":
            prev = tokens[index - 1] if index else None
            name = prev[1] if prev and prev[0] == "identifier" else None
            parens.append({"index":index, "name":name, "argument":0})
        elif value == "," and parens:
            parens[-1]["argument"] += 1
        elif value == ")":
            if parens: parens.pop()
        elif value == "{":
            declared = None
            if not braces and index and tokens[index - 1][1] == ")":
                depth, cursor = 1, index - 2
                while cursor >= 0:
                    if tokens[cursor][1] == ")": depth += 1
                    if tokens[cursor][1] == "(":
                        depth -= 1
                        if not depth:
                            if cursor and tokens[cursor - 1][0] == "identifier": declared = tokens[cursor - 1][1]
                            break
                    cursor -= 1
                if declared and declared not in CONTROLS:
                    function = declared
                    function_line = bisect.bisect_right(line_offsets, tokens[cursor - 1][2])
                    functions.append({"path":rel, "line_start":function_line, "name":function, "subsystem":subsystem(rel)})
            braces.append(declared)
        elif value == "}":
            if braces: braces.pop()
            if not braces and function:
                functions[-1]["line_end"] = bisect.bisect_right(line_offsets, end)
                function, function_line = None, None
        elif kind == "string":
            literals = [value]
            fragments = [{"line":bisect.bisect_right(line_offsets,start), "column":start-line_offsets[bisect.bisect_right(line_offsets,start)-1]+1, "raw":value}]
            while index + 1 < len(tokens) and tokens[index + 1][0] == "string":
                index += 1
                _, nxt, nstart, end = tokens[index]
                literals.append(nxt)
                fragments.append({"line":bisect.bisect_right(line_offsets,nstart), "column":nstart-line_offsets[bisect.bisect_right(line_offsets,nstart)-1]+1, "raw":nxt})
            decoded = "".join(decode_string(x) for x in literals)
            line = bisect.bisect_right(line_offsets,start)
            immediate = next((p for p in reversed(parens) if p["name"] and p["name"] not in CONTROLS), None)
            call = immediate["name"] if immediate else None
            first_argument_symbol = None
            if immediate and immediate["index"] + 1 < len(tokens):
                firstarg = tokens[immediate["index"] + 1]
                if firstarg[0] == "identifier": first_argument_symbol = firstarg[1]
            line_start = line_offsets[line - 1]
            line_end = text.find("\n",end)
            if line_end < 0: line_end = len(text)
            classification = classify(rel,call,decoded,text[line_start:start])
            words = slug(FORMAT.sub("",decoded)).split("_")[:9]
            proposed = ".".join((subsystem(rel),slug(path.stem),slug(function or call or "table"),"_".join(words) or "format"))
            if path.name.startswith("list-") and first_argument_symbol:
                proposed="angband.enum."+slug(path.stem[5:])+"."+slug(first_argument_symbol)+".text_argument_"+str(immediate["argument"])
            macro_concat = bool((index+1<len(tokens) and tokens[index+1][0]=="identifier" and tokens[index+1][1].startswith(("PRI","SCN"))) or (index and tokens[index-1][0]=="identifier" and tokens[index-1][1].startswith(("PRI","SCN"))))
            rows.append({"path":rel, "line":line, "line_end":bisect.bisect_right(line_offsets,end), "column":start-line_start+1, "offset":start, "offset_end":end, "function":function, "call":call, "argument_index":immediate["argument"] if immediate else None, "first_argument_symbol":first_argument_symbol,"requires_preprocessor_format_resolution":macro_concat,"call_stack":[p["name"] for p in parens if p["name"] and p["name"] not in CONTROLS], "subsystem":subsystem(rel), "classification":classification, "raw_fragments":fragments, "text":decoded, "placeholders":placeholders(decoded), "source_context":text[line_start:line_end], "proposed_id_for_review":proposed, "id_status":"needs_semantic_review"})
        index += 1
    return rows, functions


TEXT_FIELDS = {
    "activation": {"desc","msg"}, "artifact":{"name","desc","msg"}, "blow_effects":{"desc"}, "blow_methods":{"act","desc"},
    "body":{"body"}, "brand":{"name","verb"}, "chest_trap":{"name","msg","msg-death"},
    "class":{"name","title","effect-msg","desc"}, "old_class":{"name","title","effect-msg","desc"},
    "curse":{"name","desc","msg"}, "ego_item":{"name","desc"}, "hints":{"H"}, "history":{"phrase"},
    "monster":{"name","plural","desc"}, "monster_base":{"name","desc"},
    "monster_spell":{"lore","message-vis","message-invis","message-miss","message-save"},
    "pain":{"message"},
    "object":{"name","desc","msg","vis-msg"}, "object_property":{"name","desc","msg","adjective","neg-adjective"},
    "player_property":{"name","desc"}, "p_race":{"name"},
    "player_timed":{"desc","on-end","on-increase","on-decrease","effect-msg"},
    "projection":{"name","desc","player-desc","blind-desc","lash-desc"}, "quest":{"name"},
    "realm":{"name","verb","spell-noun","book-noun"}, "shape":{"name","blow","effect-msg"},
    "slay":{"name","melee-verb","range-verb"}, "summon":{"desc"},
    "terrain":{"name","desc","walk-msg","run-msg","hurt-msg","die-msg","confused-msg","look-prefix","look-in-preposition"},
    "trap":{"desc","msg","msg-good","msg-bad","msg-xtra"},
    "ui_entry":{"label","label2","label5","desc"}, "ui_knowledge":{"monster-category"},
    "dungeon_profile":{"name"},"room_template":{"name"},"vault":{"name"},"pit":{"name"},"ui_entry_base":{"desc"}
}
PRIMARY = {"brand":"code", "slay":"code", "terrain":"code", "projection":"code", "store":"store", "body":"body", "history":"chart", "pain":"type", "player_property":"type", "flavor":"kind", "names":"section", "hints":"H", "ui_knowledge":"monster-category"}


def data_inventory(path: Path, root: Path):
    rel, stem = path.relative_to(root).as_posix(), path.stem
    raw, messages = [], []
    owner, book, spell, cutoff = "global", None, None, "base"
    occurrences = Counter()
    aggregate = {}
    record_index = 0
    for line, source in enumerate(path.read_text(encoding="utf-8",errors="replace").splitlines(),1):
        if not source.strip() or source.lstrip().startswith("#"): continue
        field, sep, payload = source.partition(":")
        parts = payload.split(":")
        if field == PRIMARY.get(stem,"name"):
            owner = payload
            if stem == "trap": owner = parts[0]
            record_index += 1
            book,spell,cutoff = None,None,"base"
        if stem == "player_property" and field in {"code","value"}:
            owner += "." + payload
        if stem in {"class","old_class"} and field == "book":
            book = parts[2] if len(parts)>2 else payload
            spell = None
        if stem in {"class","old_class"} and field == "spell": spell = parts[0]
        if stem == "monster_spell" and field == "power-cutoff": cutoff = payload
        context = {"owner":owner,"record_index":record_index,"book":book,"spell":spell,"power_cutoff":cutoff if stem=="monster_spell" else None}
        selected = []
        if field in TEXT_FIELDS.get(stem,set()): selected.append((field,payload))
        if stem in {"class","old_class"} and field == "book" and len(parts)>=3: selected.append(("book.name",parts[2]))
        if stem in {"class","old_class"} and field == "spell": selected.append(("spell.name",parts[0]))
        if stem == "object_base" and field == "name" and len(parts)>1: selected.append(("name.display",":".join(parts[1:])))
        if stem == "body" and field == "slot" and len(parts)>1: selected.append(("slot.name",parts[1]))
        if stem == "store" and field == "owner" and len(parts)>1: selected.append(("owner.name",":".join(parts[1:])))
        if stem == "trap" and field == "name" and len(parts)>1: selected.append(("name.display",":".join(parts[1:])))
        if stem == "world" and field == "level" and len(parts)>1: selected.append(("level.name",parts[1])); context["owner"] = parts[0]
        if stem == "flavor" and field in {"flavor","fixed"}:
            skip=2 if field=="flavor" else 3
            if len(parts)>skip: selected.append(("flavor.text",":".join(parts[skip:]))); context["owner"] = parts[0]
        if stem == "monster" and field in {"message-vis","message-invis","message-miss"} and len(parts)>1:
            selected.append((field+"."+slug(parts[0]),":".join(parts[1:])))
        if stem == "player_timed" and field == "grade":
            for idx,role in ((2,"grade.name"),(3,"grade.up_message"),(4,"grade.down_message")):
                if len(parts)>idx: selected.append((role,parts[idx]))
            context["grade_max"] = parts[1] if len(parts)>1 else None
        classification = "visible_text_candidate" if selected else "procedural_name_seed_keep_stable" if stem=="names" and field=="word" else "inactive_legacy_data" if stem=="old_class" else "internal_or_numeric_or_map"
        if stem in {"dungeon_profile","room_template","vault","pit","ui_entry_base"} and field in {"name","desc"}: classification="developer_label_candidate"
        raw.append({"path":rel,"line":line,"field":field,"payload":payload,"raw":source,"context":context,"classification":classification,"text_segments":[{"role":role,"text":txt} for role,txt in selected]})
        for role,txt in selected:
            identity = [stem,slug(context["owner"])]
            if book: identity += ["book",slug(book)]
            if spell: identity += ["spell",slug(spell)]
            if stem=="monster_spell": identity += ["power",slug(cutoff)]
            if stem=="player_timed" and field=="grade": identity += ["grade",str(context["grade_max"])]
            identity += [role.replace("-","_")]
            base_id="angband.data."+".".join(identity)
            # Consecutive desc fragments represent one logical paragraph. The
            # source locations retain every fragment and all boundary spacing.
            aggkey=(base_id,record_index) if field=="desc" else None
            if aggkey and aggkey in aggregate:
                current=aggregate[aggkey]
                current["text"] += txt
                current["fragments"].append({"line":line,"text":txt})
                current["placeholders"]=placeholders(current["text"])
            else:
                occurrences[base_id] += 1
                candidate_id=base_id if occurrences[base_id]==1 else base_id+".variant_"+str(occurrences[base_id])
                current={"path":rel,"line":line,"context":dict(context),"field":field,"role":role,"text":txt,"fragments":[{"line":line,"text":txt}],"placeholders":placeholders(txt),"proposed_id_for_review":candidate_id,"id_status":"needs_semantic_review", "active":stem!="old_class"}
                messages.append(current)
                if aggkey: aggregate[aggkey]=current
    return raw,messages


def block_inventory(path:Path,root:Path):
    lines=path.read_text(encoding="utf-8",errors="replace").splitlines()
    blocks=[]
    start=None
    for idx,line in enumerate(lines+[""],1):
        if line.strip() and start is None: start=idx
        if not line.strip() and start is not None:
            value="\n".join(lines[start-1:idx-1])
            blocks.append({"path":path.relative_to(root).as_posix(),"line":start,"line_end":idx-1,"text":value,"kind":"screen_art" if "/screens/" in path.as_posix() else "documentation_or_help","classification":"review_prose_vs_markup","placeholders":placeholders(value)})
            start=None
    return blocks


def jsonl(path,rows):
    with path.open("w",encoding="utf-8",newline="\n") as output:
        for row in rows: output.write(json.dumps(row,ensure_ascii=False)+"\n")


def resource_inventory(path:Path,root:Path):
    rows=[]
    try:
        doc=ET.fromstring(path.read_bytes())
    except (ET.ParseError,UnicodeDecodeError):
        return [{"path":path.relative_to(root).as_posix(),"classification":"non_xml_native_resource_requires_native_inspection"}]
    for element in doc.iter():
        tag=element.tag.rsplit("}",1)[-1]
        if element.text and element.text.strip():
            rows.append({"path":path.relative_to(root).as_posix(),"element":tag,"attributes":element.attrib,"text":element.text,"classification":"native_resource_value_review"})
        for key,value in element.attrib.items():
            if key.lower() in {"title","label","placeholder","toolTip","tooltip","text","caption","name"}:
                rows.append({"path":path.relative_to(root).as_posix(),"element":tag,"attribute":key,"text":value,"classification":"native_resource_attribute_review"})
    return rows


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",type=Path,default=DEFAULT_SOURCE)
    parser.add_argument("--output",type=Path,default=Path(__file__).parent)
    args=parser.parse_args()
    root=args.source.resolve()
    out=args.output.resolve()
    out.mkdir(parents=True,exist_ok=True)
    strings,functions,directives,data_text,blocks,files,resources=[],[],[],[],[],[],[]
    code_paths=sorted(p for p in (root/"src").rglob("*") if p.is_file() and p.suffix in C_EXTENSIONS)
    data_paths=sorted((root/"lib/gamedata").glob("*.txt"))
    document_paths=sorted(set(list((root/"docs").rglob("*.rst"))+list((root/"src/doc").rglob("*.rst"))+list((root/"src").rglob("*.md"))+list((root/"src").rglob("*.txt"))+list((root/"lib/help").glob("*.txt"))+list((root/"lib/screens").glob("*.txt"))+[root/"src/angband.man",root/"README.md",root/"changes.txt"]))
    resource_paths=sorted(p for p in (root/"src").rglob("*") if p.is_file() and p.suffix in {".xml",".plist",".xib"})
    for path in code_paths:
        row,func=c_inventory(path,root)
        strings.extend(row); functions.extend(func)
    for path in data_paths:
        row,msg=data_inventory(path,root)
        directives.extend(row); data_text.extend(msg)
    for path in document_paths: blocks.extend(block_inventory(path,root))
    for path in resource_paths: resources.extend(resource_inventory(path,root))
    for path in sorted(set(code_paths+data_paths+document_paths+resource_paths)):
        binary=path.read_bytes()
        files.append({"path":path.relative_to(root).as_posix(),"bytes":len(binary),"sha256":hashlib.sha256(binary).hexdigest()})
    collisions=Counter(row["proposed_id_for_review"] for row in strings)
    for row in strings: row["proposed_id_collision_count"]=collisions[row["proposed_id_for_review"]]
    categories=Counter(row["classification"] for row in strings)
    summary={"upstream":{"name":"Angband","version":"4.2.6","commit":COMMIT,"source_root":str(root)},"scope":{"code_files":len(code_paths),"gamedata_files":len(data_paths),"documentation_help_screen_files":len(document_paths),"native_resource_files":len(resource_paths),"source_file_extension_counts":dict(Counter(p.suffix for p in code_paths))},"counts":{"c_string_occurrences_after_adjacent_concatenation":len(strings),"raw_c_literal_tokens":sum(len(row["raw_fragments"]) for row in strings),"unique_decoded_c_strings":len(set(row["text"] for row in strings)),"c_classifications":dict(categories),"c_strings_by_subsystem":dict(Counter(row["subsystem"] for row in strings)),"top_level_function_definitions":len(functions),"gamedata_directives":len(directives),"gamedata_visible_fragments":sum(len(row["text_segments"]) for row in directives),"gamedata_logical_visible_text_candidates":len(data_text),"gamedata_active_visible_text_candidates":sum(row["active"] for row in data_text),"documentation_blocks":len(blocks),"native_resource_candidate_values":len(resources)},"data_counts_by_file":{p.name:dict(Counter(row["field"] for row in directives if row["path"]==p.relative_to(root).as_posix())) for p in data_paths},"limits":["Lexical inventory includes every C/Objective-C/RC string token in scope, including compiler-disabled branches, native frontends, borg and tests; it is not preprocessor-configuration-specific.","Visibility classification is conservative static triage, not proven reachability. All unreviewed literals remain in the inventory.","Data text-field map was reviewed against upstream parser grammars; all raw directives are retained so compound fields remain auditable.","Proposed IDs require human semantic review and freezing before insertion; hash IDs are not used.","This inventory is not completed translation or a completed Rust port.","Executable code, symbolic references, generated scroll-title seeds, file names and external player/user names must not be translated."]}
    jsonl(out/"source_strings.jsonl",strings)
    jsonl(out/"source_functions.jsonl",functions)
    jsonl(out/"xmacro_text_candidates.jsonl",[row for row in strings if Path(row["path"]).name.startswith("list-") and row["first_argument_symbol"]])
    jsonl(out/"gamedata_directives.jsonl",directives)
    jsonl(out/"gamedata_text_candidates.jsonl",data_text)
    jsonl(out/"documentation_blocks.jsonl",blocks)
    jsonl(out/"native_resource_text.jsonl",resources)
    (out/"source_file_manifest.json").write_text(json.dumps(files,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (out/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"scope":summary["scope"],"counts":summary["counts"]},ensure_ascii=False,indent=2))


if __name__=="__main__": main()
