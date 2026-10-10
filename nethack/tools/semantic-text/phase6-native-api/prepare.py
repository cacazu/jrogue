"""Added 2026-10-02, NGPL: isolated remaining native API proposals.

Pure original-source transforms; never apply, compile, run or change phase4.
Native English filtering, files, buffers, terminal exit and history stay core.
"""
from __future__ import annotations
from collections import Counter,defaultdict
import difflib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import sys
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("phase6_native_source_helpers",ROOT/"tools/instrument-semantic-phase4.py")
p4=importlib.util.module_from_spec(spec);sys.modules[spec.name]=p4;spec.loader.exec_module(p4)
NOTICE="/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */\n"
APIS={
    "panic":{"types":["const char *"],"format":0,"return":"void","kind":"NH_TEXT_RAW","direct":False},
    "panic1":{"types":["const char *"],"format":0,"return":"void","kind":"NH_TEXT_RAW","direct":False},
    "config_error_add":{"types":["const char *"],"format":0,"return":"void","kind":"NH_TEXT_MESSAGE","direct":False},
    "livelog_printf":{"types":["long","const char *"],"format":1,"return":"void","kind":"NH_TEXT_DEFERRED","direct":False},
    "dump_forward_putstr":{"types":["winid","int","const char *","int"],"format":2,"return":"void","kind":"NH_TEXT_PUTSTR","direct":False},
    "exit_nhwindows":{"types":["const char *"],"format":0,"return":"void","kind":"NH_TEXT_RAW","direct":True}}


def edit(source,operations):
    changed=source
    for original,replacement,label in operations:
        changed=p4.sem.replace_once(changed,original,replacement,label)
    restored=changed
    for original,replacement,label in reversed(operations):
        restored=p4.sem.replace_once(restored,replacement,original,label+" restore")
    if restored!=source: raise ValueError("unrelated original native tokens changed")
    return changed


def transform_panic(source):
    return edit(source,[("    VA_INIT(str, char *);\n","    VA_INIT(str, char *);\n    struct nh_text_scope *nh_native_owner = nh_text_native_claim(NH_TEXT_RAW, \"panic\", \"panic1\");\n    nh_text_emit(NULL); /* terminal instructions never inherit an outer observer */\n","panic original owner"),
        ('    (void) vsnprintf(buf, sizeof buf, str, VA_ARGS);\n    raw_print(buf);',
         '    (void) vsnprintf(buf, sizeof buf, str, VA_ARGS);\n'
         '    if (strlen(buf) >= sizeof buf - 1) nh_text_truncated(nh_native_owner);\n'
         '    {\n        struct nh_text_scope *nh_previous = nh_text_emit(nh_native_owner);\n'
         '        raw_print(buf);\n        nh_text_emit(nh_previous);\n    }',"panic final original raw message")])


def transform_dump(source):
    return edit(source,[('dump_forward_putstr(winid win, int attr, const char *str, int no_forward)\n{\n',
        'dump_forward_putstr(winid win, int attr, const char *str, int no_forward)\n{\n'
        '    struct nh_text_scope *nh_native_owner = nh_text_native_claim(NH_TEXT_PUTSTR, "dump_forward_putstr", NULL);\n',"dump accepted owner"),
        ('    if (!no_forward)\n        putstr(win, attr, str);',
         '    if (!no_forward) {\n        struct nh_text_scope *nh_previous = nh_text_emit(nh_native_owner);\n'
         '        putstr(win, attr, str);\n        nh_text_emit(nh_previous);\n    }',"dump original forwarding predicate")])


def value(original,identifier):
    event=json.dumps({"id":identifier,"args":{}},ensure_ascii=False,separators=(",",":"))
    return "nh_native_value("+original+", "+json.dumps(event)+")"


def config_operations(source,plain_alias="pline",framed_alias="pline"):
    # Expected aliases must come from exact phase4 source-operation metadata,
    # never from rendered English. Pristine proposals use original pline.
    plain='    '+plain_alias+'("%s%s%s", !iflags.window_inited ? "config_error_add: " : "",\n              buf, punct);'
    # This original early call is inside an additional indentation level.
    if plain not in source:
        plain='        '+plain_alias+'("%s%s%s", !iflags.window_inited ? "config_error_add: " : "",\n              buf, punct);'
    framed='    '+framed_alias+'("%s %s%s%s", config_error_data->secure ? "Error:" : " *",\n          lineno, buf, punct);'
    no_prefix=value('""','nethack.native.config.label.empty')
    early=value('"config_error_add: "','nethack.native.config.label.early')
    secure=value('"Error:"','nethack.native.config.label.secure')
    marker=value('" *"','nethack.native.config.label.marker')
    none=value('""','nethack.native.config.punct.none')
    period=value('"."','nethack.native.config.punct.period')
    return [
      ('    char buf[BIGBUFSZ]; /* will be chopped down to BUFSZ-1 if longer */\n\n    vlen = vsnprintf(buf, sizeof buf, str, the_args);',
       '    char buf[BIGBUFSZ]; /* will be chopped down to BUFSZ-1 if longer */\n'
       '    struct nh_text_scope *nh_native_owner = nh_text_native_claim(NH_TEXT_MESSAGE, "config_error_add", NULL);\n\n'
       '    vlen = vsnprintf(buf, sizeof buf, str, the_args);',"config original formatter owner"),
      ("    buf[BUFSZ - 1] = '\\0';\n    config_erradd(buf);",
       "    if (strlen(buf) >= BUFSZ) nh_text_truncated(nh_native_owner);\n"
       "    buf[BUFSZ - 1] = '\\0';\n    nh_text_forward(nh_native_owner);\n    config_erradd(buf);","config original truncation and forwarding"),
      ('config_erradd(const char *buf)\n{\n    char lineno[QBUFSZ];\n    const char *punct;',
       'config_erradd(const char *buf)\n{\n    char lineno[QBUFSZ];\n    const char *punct;\n'
       '    struct nh_text_scope *nh_native_owner = nh_text_native_claim(NH_TEXT_MESSAGE, "config_error_add", NULL);\n'
       '    struct nh_native_text_value nh_native_punct;\n    int nh_native_line_number = 0;',"config original delivery owner"),
      ('    if (!buf || !*buf)\n        buf = "Unknown error";',
       '    if (!buf || !*buf) {\n        buf = "Unknown error";\n'
       '        nh_native_owner = NULL; /* original fallback differs from caller format */\n    }',"config unknown error fallback"),
      ('    punct = strchr(".!?", *punct) ? "" : ".";',
       '    punct = (nh_native_punct = strchr(".!?", *punct) ? '+none+' : '+period+').original;',"config original selected punctuation"),
      (plain,'        nh_native_config_plain(nh_native_owner, "%s%s%s", !iflags.window_inited ? '+early+' : '+no_prefix+',\n              buf, nh_native_punct);',"config actual early or interactive output"),
      ('        Sprintf(lineno, "Line %d: ", config_error_data->line_num);',
       '        Sprintf(lineno, "Line %d: ", (nh_native_line_number = config_error_data->line_num));',"config original public line number once"),
      (framed,'    nh_native_config_framed(nh_native_owner, "%s %s%s%s", config_error_data->secure ? '+secure+' : '+marker+',\n'
       '          lineno, nh_native_line_number, buf, nh_native_punct);',"config original accepted framed output")]


def transform_config(source,plain_alias="pline",framed_alias="pline"):
    return edit(source,config_operations(source,plain_alias,framed_alias))


def transform_log(source):
    return edit(source,[('    else\n        lst->next = tmp;\n}\n\nvoid\nlivelog_printf',
        '    else\n        lst->next = tmp;\n    nh_native_log_bind(tmp, str);\n}\n\nvoid\nlivelog_printf',"original accepted journal node"),
       ('    char gamelogbuf[BUFSZ * 2];\n    va_list the_args;',
        '    char gamelogbuf[BUFSZ * 2];\n    va_list the_args;\n'
        '    struct nh_text_scope *nh_native_owner = nh_text_native_claim(NH_TEXT_DEFERRED, "livelog_printf", NULL);',"original journal formatter owner"),
       ('    gamelog_add(ll_type, svm.moves, gamelogbuf);',
        '    {\n        struct nh_native_log_capture_state nh_previous;\n'
        '        if (strlen(gamelogbuf) >= sizeof gamelogbuf - 1) nh_text_truncated(nh_native_owner);\n'
        '        nh_previous = nh_native_log_capture(nh_native_owner, gamelogbuf);\n'
        '        gamelog_add(ll_type, svm.moves, gamelogbuf);\n'
        '        nh_native_log_restore(nh_previous);\n    }',"original journal call-owned capture ticket")])


def transform_chronicle(source):
    return edit(source,[('        Snprintf(buf, sizeof buf, "%5ld: %s", llmsg->turn, llmsg->text);\n        putstr(win, 0, buf);',
        '        {\n            long nh_native_turn;\n            struct nh_text_scope *nh_scope, *nh_previous;\n'
        '            Snprintf(buf, sizeof buf, "%5ld: %s", (nh_native_turn = llmsg->turn), llmsg->text);\n'
        '            nh_scope = nh_native_log_line(llmsg, llmsg->text, nh_native_turn, win, buf);\n'
        '            nh_previous = nh_text_emit(nh_scope);\n            putstr(win, 0, buf);\n'
        '            nh_text_emit(nh_previous);\n            nh_text_end(nh_scope);\n        }',"original filtered chronicle leaf only")])


def transform_log_free(source):
    return edit(source,[('            free((genericptr_t) tmp->text);\n            free((genericptr_t) tmp);',
        '            nh_native_log_forget(tmp);\n            free((genericptr_t) tmp->text);\n            free((genericptr_t) tmp);',"original journal free invalidates sidecar first")])


def extend_getter(source):
    anchor='    if (kind == NH_TEXT_RAW && raw && window == -1) return s->json;'
    return edit(source,[(anchor,anchor+'\n    if (kind == NH_TEXT_RAW && !strcmp(s->descriptor->api,"exit_nhwindows") &&\n'
        '        !strcmp(callback,"shim_exit_nhwindows") && window == -1) return s->json;',"exact original terminal callback")])


def generate(output):
    output=Path(output).resolve()
    if not output.is_relative_to(HERE): raise ValueError("proposal output must stay in isolated phase6-native-api")
    output.mkdir(parents=True,exist_ok=True)
    p4.API.update(APIS)
    rows=[row for row in p4.load(ROOT/"catalog/source-text-messages.json")["messages"]
          if row["source"].startswith("src/") and row["api"] in APIS]
    grouped=defaultdict(list)
    for row in rows:
        if row.get("english_id_candidate"): grouped[row["source"]].append(row)
    english,schemas,entries,operations,unhandled,headers={},{},{},[],[],[]
    for name,sites in sorted(grouped.items()):
        original=(p4.UPSTREAM/name).read_text(encoding="utf8")
        offsets=[0]+[match.end() for match in re.finditer("\n",original)]
        guards=p4.guards(original);claimed=set();declarations=[]
        for row in sites:
            try:
                template,args,conversions=p4.catalog.convert_printf(row["english_source_template"],row["format_semantics"]=="printf-like")
                entry={"id":row["english_id_candidate"],"category":"message","en":template,"arguments":args,
                       "source_english_literal":row["english_source_template"],"api":row["api"],"printf_conversions":conversions,
                       "semantic_capture_prepared":not p4.text_precision(args),"runtime_integration":False,"source_only":True,"source_call_sites":[]}
                line=row["line"];start,end=offsets[line-1],offsets[line] if line<len(offsets) else len(original)
                matches=[]
                for match in re.finditer(r"\b"+re.escape(row["api"])+r"\s*\(",original[start:end]):
                    offset=start+match.start();actual,closing=p4.sem.call_arguments(original,original.find("(",offset))
                    if offset not in claimed and [p4.sem.tokens(arg) for arg in actual]==[p4.sem.tokens(arg) for arg in row["argument_expressions"]]:
                        matches.append((offset,closing,actual))
                if not matches: raise ValueError("no exact original native source binding")
                offset,closing,actual=matches[0]
                function="nh_phase6_native_site_"+p4.sha(name+"|"+str(offset))[:16]
                declaration,types=p4.wrapper(entry,row,function,set(),set())
                # Proposal structs explicitly default all name permissions to
                # zero. Direct-name eligibility needs separate reviewed hooks.
                declaration=re.sub(r'(\{"arg_\d+", NH_TEXT_TEXT, [^\n]+)(\},)',r'\1, 0\2',declaration)
                claimed.add(offset);declarations.append(declaration)
                original_call=original[offset:closing]
                replacement=p4.rewrite_native_call(original_call,row["api"],function,actual,actual)
                operations.append({"id":entry["id"],"source":name,"line":line,"api":row["api"],"original_start_offset":offset,
                    "original_end_offset":closing,"original_argument_expressions":actual,"original_call":original[offset:closing],
                    "replacement":replacement,"preprocessor_directives_preserved":p4.call_directives(original_call)})
                english[entry["id"]]=template;schemas[entry["id"]]=[arg["name"] for arg in args]
                entries.setdefault(entry["id"],entry)["source_call_sites"].append({"source":name,"line":line,"api":row["api"],
                    "function_candidate":row["function_candidate"],"original_argument_expressions":actual,"formal_c_types":types,
                    "conditional_guards":guards[line],"runtime_verified":False})
            except ValueError as error:
                unhandled.append({"id":row["english_id_candidate"],"source":name,"line":row["line"],"api":row["api"],
                                  "reason":str(error),"original_call_unchanged":True,"runtime_verified":False})
        if declarations:
            path=output/"include/nh-phase6-native"/("sites-"+Path(name).stem+".h")
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(NOTICE+'#include "nh-phase4-values.h"\n'+"\n".join(declarations),encoding="utf8",newline="\n")
            headers.append({"source":name,"path":str(path.relative_to(output)).replace("\\","/"),"sites":len(declarations)})
    native_recipes={"nethack.native.config.plain":("{label}{message}{punct}",["label","message","punct"]),
                    "nethack.native.config.framed":("{label} {line}{message}{punct}",["label","line","message","punct"]),
                    "nethack.native.config.line":("Line {number:%d}: ",["number"]),
                    "nethack.native.config.label.empty":("",[]),"nethack.native.config.label.early":("config_error_add: ",[]),
                    "nethack.native.config.label.secure":("Error:",[]),"nethack.native.config.label.marker":(" *",[]),
                    "nethack.native.config.punct.none":("",[]),"nethack.native.config.punct.period":(".",[]),
                    "nethack.native.chronicle.line":("{turn:%5ld}: {message}",["turn","message"])}
    for identifier,(template,schema) in native_recipes.items(): english[identifier]=template;schemas[identifier]=schema
    transforms={"src/end.c":transform_panic,"src/windows.c":transform_dump,"src/cfgfiles.c":transform_config,
                "src/pline.c":transform_log,"src/insight.c":transform_chronicle,"src/save.c":transform_log_free}
    patch=[];files=[]
    for name,transform in transforms.items():
        original=(p4.UPSTREAM/name).read_text(encoding="utf8");changed=NOTICE+transform(original)
        target=output/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(changed,encoding="utf8",newline="\n")
        patch.append("".join(difflib.unified_diff(original.splitlines(True),changed.splitlines(True),fromfile="upstream/"+name,tofile="phase6-native/"+name)))
        files.append({"source":name,"original_sha256":p4.sha(original),"prepared_sha256":p4.sha(changed)})
    bridge=(ROOT/"work/phase4/semantic-generated/src/nh-semantic.c").read_text(encoding="utf8")
    extended=extend_getter(bridge)+"\n"+(HERE/"bridge-extension.c.in").read_text(encoding="utf8")
    (output/"src/nh-semantic.c").write_text(extended,encoding="utf8",newline="\n")
    for template,target in (("nh-native-api.h.in","include/nh-native-api.h"),("nh-native-api.c.in","src/nh-native-api.c")):
        destination=output/target;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(HERE/template,destination)
    audit={"schema_version":1,"date":"2026-10-02","source_only":True,"compiled":False,"runtime_verified":False,
           "original_commit":"16ff59115315917b93185d026aeefea06db9b0f4",
           "counts":{"literal_candidate_ids":len({row['english_id_candidate'] for row in rows if row.get('english_id_candidate')}),
                     "literal_candidate_sites":sum(bool(row.get('english_id_candidate')) for row in rows),
                     "prepared_literal_ids":len(entries),"prepared_literal_sites":len(operations),
                     "event_eligible_literal_ids":sum(entry['semantic_capture_prepared'] for entry in entries.values()),
                     "event_eligible_literal_sites":sum(entries[operation['id']]['semantic_capture_prepared'] for operation in operations),
                     "dynamic_or_null_origins":sum(not row.get('english_id_candidate') for row in rows),
                     "precision_fallback_ids":sum(not entry['semantic_capture_prepared'] for entry in entries.values()),
                     "native_recipe_ids":len(native_recipes)},
           "api_counts":dict(Counter(operation["api"] for operation in operations)),"unhandled":unhandled,"headers":headers,"files":files,
           "delivery_contracts":{
               "panic":"only final original raw_print(buf); conservative sizeof(buf)-1 truncation rejects whole event; shutdown/reports/abort untouched",
               "config_error_add":"only accepted original pline; source-selected qualifier/punctuation recipes; Lua queued errors stay English without delivery provenance",
               "livelog_printf":"private C-only original-node sidecars; exact call-owned buffer ticket; unchanged major/spoiler filters precede actual putstr; files untouched",
               "dump_forward_putstr":"semantic getter only inside original !no_forward branch; no file-only semantic publication",
               "exit_nhwindows":"exact original shim_exit_nhwindows/-1 callback; no new export or exit-state mutation",
               "panic1":"original macro invoked once; original panic entry consumes its owner"},
           "bounds":{"log_records":4096,"log_sidecar_bytes":8*1024*1024,"event_copy_bytes":65536},
           "remaining":["Japanese native recipes and frames require source author approval","restored journal records without source events remain English",
                        "Lua config-error queue delivery needs a source-owned record sidecar","opaque dynamic/null origins remain exact English",
                        "compiler/runtime/panic terminal tests require parent heavy gate","no file log/dump bytes are translated"],
           "composition":"separate native call wrappers and definition hooks; config internal pline aliases must be passed from exact phase4 operation metadata; no active pipeline integration",
           "preprocessing_contract":"all original physical directive lines and argument layout retained; source conditional guards do not prove callback activity"}
    outputs={"catalog.json":{"en":english,"ja":{},"argument_schemas":schemas},
             "metadata.json":{"schema_version":1,"entries":list(entries.values()),"source_only":True},
             "call-operations.json":{"schema_version":1,"operations":operations,"source_only":True},"audit.json":audit}
    for name,data in outputs.items(): (output/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf8",newline="\n")
    (output/"native-contracts.patch").write_text("".join(patch),encoding="utf8",newline="\n")
    return audit


if __name__=="__main__":
    audit=generate(HERE/"generated");print(json.dumps({"status":"proposal-only",**audit["counts"]}))
