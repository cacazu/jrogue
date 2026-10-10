"""Added 2026-10-02, NGPL: isolated Phase6 source composition only.

Preserved Phase4/5 is read-only. No compiler, runtime, hosting or Git action.
Exact input hashes, source spans and directive lines are mandatory.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import sys
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
TOOLS=ROOT/"tools/semantic-text"
FOUNDATION=ROOT/"work/phase4/NetHack-5.0.0"
FOUNDATION_META=ROOT/"work/phase4/semantic-generated"
WORK=ROOT/"work/phase6"
SOURCE=WORK/"NetHack-5.0.0"
OUTPUT=WORK/"semantic-generated"
BUILD=ROOT/"build/phase6"
NOTICE="/* Modified 2026-10-02: isolated Phase6 public presentation observations; NGPL; original engine retained. */\n"
LEX=re.compile(r'/\*.*?\*/|//[^\n]*|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[A-Za-z_]\w*|\d+|\S',re.S)


def sha(value):return hashlib.sha256(value if isinstance(value,bytes) else value.encode("utf8")).hexdigest()
def load(path):
    def pairs(items):
        result={}
        for key,value in items:
            if key in result:raise ValueError("duplicate JSON key: "+key)
            result[key]=value
        return result
    return json.loads(Path(path).read_text("utf8"),object_pairs_hook=pairs)
def module(path,name):
    spec=importlib.util.spec_from_file_location(name,path)
    result=importlib.util.module_from_spec(spec);sys.modules[name]=result;spec.loader.exec_module(result)
    return result
def write(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    if not path.resolve().is_relative_to(WORK) and not path.resolve().is_relative_to(HERE):
        raise ValueError("Phase6 output escapes owned roots")
    data=value if isinstance(value,str) else json.dumps(value,ensure_ascii=False,indent=2)+"\n"
    path.write_text(data,encoding="utf8",newline="\n")
    ownership=OUTPUT/"ownership.json"
    if path.resolve().is_relative_to(SOURCE) and ownership.exists():
        record=load(ownership);record["files"][str(path.relative_to(SOURCE)).replace("\\","/")]=sha(path.read_bytes())
        ownership.write_text(json.dumps(record,indent=2)+"\n",encoding="utf8",newline="\n")


def input_paths():
    result=[ROOT/"tools/build-upstream.py",ROOT/"tools/instrument-semantic-phase4.py",
            TOOLS/"phase4/catalog-loader.py",TOOLS/"phase4/prepare-name-eligibility.py",
            FOUNDATION_META/"source-manifest.json",FOUNDATION_META/"catalog.json",
            ROOT/"tools/build-upstream-abi.c"]
    for directory in ("phase6-helper-producers","phase6-monster-producers","phase6-object-producers","phase6-native-api"):
        result += [path for path in (TOOLS/directory).iterdir() if path.is_file() and path.suffix in (".py",".json",".in")]
    result += [TOOLS/"phase6-native-api/generated"/name for name in
               ("metadata.json","catalog.json","call-operations.json","source-manifest.json","audit.json")]
    result += sorted((ROOT/"locales/phase6").glob("remaining-native-batch-*.normalized.json"))
    result += [HERE/name for name in ("native-recipes.json","prepare.py","build.py","target-data.cjs","test_prepare.py","check.py","provenance.py","target-macros.c")]
    result += [TOOLS/"phase6-integration-review/compatibility-preparation.json"]
    performance=TOOLS/'phase6-immutable-catalog'
    result += [performance/name for name in ('preparation.json','host-preparation.json','registered-catalog.h')]
    result += [path for path in (performance/'rust-copy').rglob('*') if path.is_file() and 'vendor' not in path.relative_to(performance/'rust-copy').parts and path.suffix in ('.rs','.toml','.lock')]
    result += [path for path in (performance/'host-overlay').rglob('*') if path.is_file() and 'engine' not in path.relative_to(performance/'host-overlay').parts and path.suffix in ('.html','.css','.js','.mjs','.json')]
    result += [path for path in (performance/'locales').glob('*.json')]
    result += [ROOT/"locales/phase6/native-recipes.root-reviewed.json",ROOT/"build/phase6/native-recipes.root-review.json"]
    result += [TOOLS/"phase7-buffer-producers"/name for name in ("prepare.py","nh-buffer-producer.c.in","nh-buffer-producer.h.in")]
    result += [path for path in (TOOLS/"phase7-buffer-producers/generated/prototype").rglob('*') if path.is_file() and path.suffix in ('.json','.h')]
    return sorted(set(result))


def freeze_inputs():
    paths=input_paths()
    lock={"schema_version":1,"source_only":True,"official_commit":"16ff59115315917b93185d026aeefea06db9b0f4",
          "inputs":[{"path":str(path.relative_to(ROOT)).replace("\\","/"),"sha256":sha(path.read_bytes())} for path in paths]}
    write(HERE/"inputs.lock.json",lock)
    return lock


def verify_inputs():
    lock=load(HERE/"inputs.lock.json")
    if {row["path"] for row in lock["inputs"]}!={str(path.relative_to(ROOT)).replace("\\","/") for path in input_paths()}:
        raise ValueError("Phase6 input set changed; source review and explicit freeze are required")
    for row in lock["inputs"]:
        if sha((ROOT/row["path"]).read_bytes())!=row["sha256"]:
            raise ValueError("stale/conflicting frozen Phase6 input: "+row["path"])
    return lock


def verify_foundation():
    manifest=load(FOUNDATION_META/"source-manifest.json")
    for record in manifest["prepared_sources"]:
        if sha((FOUNDATION/record["source"]).read_bytes())!=record["patched_sha256"]:
            raise ValueError("Phase4 foundation changed: "+record["source"])
    for record in manifest["generated_files"]:
        if sha((FOUNDATION/record["path"]).read_bytes())!=record["sha256"]:
            raise ValueError("Phase4 generated foundation changed: "+record["path"])
    return manifest


def checked_clone():
    """Copy only into Phase6; reject unknown edits in an earlier candidate."""
    if SOURCE.exists():
        previous=OUTPUT/"ownership.json"
        if not previous.exists():raise ValueError("existing Phase6 source lacks ownership manifest")
        owned=load(previous)["files"]
        actual={str(path.relative_to(SOURCE)).replace("\\","/") for path in SOURCE.rglob("*") if path.is_file() and path.suffix in (".c",".h")}
        if actual!=set(owned):raise ValueError("unrecognized Phase6 source file set")
        adopted=[]
        for name,digest in owned.items():
            actual=sha((SOURCE/name).read_bytes())
            if actual==digest:continue
            # The original target utility intentionally regenerates date.h
            # after prepare. Only its exact certified output is replayable;
            # arbitrary edits or other source/header drift still reject.
            certificate=BUILD/'target-data-manifest.json'
            if name=='include/date.h' and certificate.is_file():
                report=load(certificate)
                matches=[row for row in report['files'] if row['path']==name and row['sha256']==actual]
                if len(matches)==1:
                    adopted.append({'source':name,'prepared_sha256':digest,'target_generated_sha256':actual,
                                    'certificate_sha256':sha(certificate.read_bytes())})
                    continue
            raise ValueError("unrecognized Phase6 source edit: "+name)
        write(OUTPUT/'replay-generated-header-audit.json',{'source_only':True,'headers':adopted})
        # Remove only verified files generated by our prior candidate. This
        # makes an optional-then-default replay byte-equivalent to a fresh
        # default source tree; no recursive deletion or other tree is touched.
        for name in owned:
            if (FOUNDATION/name).is_file():continue
            path=(SOURCE/name).resolve()
            if not path.is_relative_to(SOURCE.resolve()):raise ValueError('owned cleanup escapes Phase6')
            path.unlink()
    shutil.copytree(FOUNDATION,SOURCE,dirs_exist_ok=True)
    write(OUTPUT/"ownership.json",{"schema_version":1,"source_only":True,"files":{
        str(path.relative_to(SOURCE)).replace("\\","/"):sha(path.read_bytes()) for path in sorted(SOURCE.rglob("*"))
        if path.is_file() and path.suffix in (".c",".h")}})


def function_span(text,name):
    match=re.search(r"\bstatic inline[^\n]*\b"+re.escape(name)+r"\s*\(",text)
    if not match:raise ValueError("missing exact wrapper definition: "+name)
    opening=text.index("{",match.end());depth=0
    for token in LEX.finditer(text,opening):
        if token.group()=="{":depth+=1
        elif token.group()=="}":
            depth-=1
            if depth==0:return match.start(),token.end()
    raise ValueError("unbalanced wrapper definition: "+name)


def native_header_anchor(text,name,apis):
    """Inline wrappers must follow the original declaration owner.

    alloc.c intentionally suppresses extern.h for auxiliary programs. Keep
    its complete original panic prototype in place and include wrappers only
    after that declaration. Other custom/suppressed owners fail closed.
    """
    include=re.search(r'^#include "hack\.h"[^\n]*\n',text,re.M)
    suppressed=bool(re.search(r'^\s*#\s*define\s+EXTERN_H\b',text,re.M))
    if include and not suppressed:
        return include.group(),{'source':name,'apis':sorted(apis),'owner':'original hack.h -> extern.h','custom':False}
    if name=='src/alloc.c' and apis=={'panic'}:
        anchor='ATTRNORETURN extern void panic(const char *, ...) PRINTF_F(1, 2) NORETURN;\n'
        if text.count(anchor)!=1:raise ValueError('alloc original panic declaration changed')
        return anchor,{'source':name,'apis':['panic'],'owner':'original alloc.c panic extern declaration','custom':True,
                       'declaration_sha256':sha(anchor)}
    raise ValueError('unproven native wrapper declaration owner: '+name)


HELPERS={name:"nh_phase6_"+name+"_value" for name in
         ("body_part","mbodypart","hcolor","hliquid","locomotion","stagger","plur","P_NAME",
          "uhe","uhim","uhis","mhe","mhim","mhis","noit_mhe","noit_mhim","noit_mhis")}


def owned_expression(expression,p4):
    value=expression.strip()
    tokens=p4.inventory.c_tokens(value)
    if len(tokens)<3 or tokens[0].text not in HELPERS or tokens[1].text!="(":return None
    _,end=p4.sem.call_arguments(value,tokens[1].start)
    if end!=len(value):return None
    return HELPERS[tokens[0].text]+value[len(tokens[0].text):]


def adapt_wrapper(body,slots):
    """Owning formal survives until nh_text_begin copies its inline event."""
    opening=body.index("{");signature,rest=body[:opening],body[opening:]
    for index in sorted(slots):
        parameter="nh_p"+str(index)
        old="const char * "+parameter
        if signature.count(old)!=1:raise ValueError("helper formal has unsupported original type")
        signature=signature.replace(old,"struct nh_phase6_helper_value "+parameter,1)
        rest=re.sub(r"\b"+parameter+r"\b",parameter+".original",rest)
        pattern=r'(\{"arg_\d+", NH_TEXT_TEXT, '+parameter+r'\.original, 0, )[^\n]+?(, [01]\},)'
        rest,count=re.subn(pattern,lambda m:m.group(1)+parameter+".event_valid ? "+parameter+".event_json : NULL, 0},",rest)
        if count!=1:raise ValueError("helper formal is not one original public text slot")
    anchor=re.search(r"    struct nh_text_scope \*nh_scope = nh_text_begin\([^\n]+\);",rest)
    if not anchor:raise ValueError("precision/unowned wrapper cannot capture helper event")
    guards="".join("\n    if (!nh_p"+str(index)+".event_valid) nh_text_truncated(nh_scope);" for index in sorted(slots))
    rest=rest[:anchor.end()]+guards+rest[anchor.end():]
    return signature+rest


def integrate_helper_consumers(p4):
    definitions={}
    for path in sorted((SOURCE/"include").rglob("sites-*.h")):
        text=path.read_text("utf8")
        for match in re.finditer(r"\bstatic inline[^\n]*\b(nh_(?:text_site|phase4(?:_impossible|_dynamic)?_site|phase6_native_site)_[a-z0-9]+)\s*\(",text):
            name=match.group(1)
            if name in definitions:raise ValueError("duplicate wrapper definition: "+name)
            definitions[name]=path
    changes=[];headers={};claims={};fallback=[]
    for path in sorted((SOURCE/"src").glob("*.c")):
        text=path.read_text("utf8");edits=[]
        for token in p4.inventory.c_tokens(text):
            if token.text not in definitions:continue
            opening=token.end
            while opening<len(text) and text[opening].isspace():opening+=1
            if opening>=len(text) or text[opening]!="(":continue
            args,end=p4.sem.call_arguments(text,opening)
            header=definitions[token.text];header_text=headers.get(header,header.read_text("utf8"))
            a,b=function_span(header_text,token.text);body=header_text[a:b]
            altered=list(args);slots=set()
            for index,arg in enumerate(args):
                owned=owned_expression(arg,p4)
                if owned is None:continue
                parameter="nh_p"+str(index)
                if not re.search(r'NH_TEXT_TEXT, '+parameter+r', 0,',body):
                    fallback.append({"source":str(path.relative_to(SOURCE)),"wrapper":token.text,"argument":index,
                                     "reason":"precision/nontext/unreviewed transformed slot remains original English"});continue
                altered[index]=owned;slots.add(index)
            if not slots:continue
            if token.text in claims and claims[token.text]!=slots:raise ValueError("one wrapper has conflicting helper ownership")
            if token.text not in claims:
                changed=adapt_wrapper(body,slots)
                headers[header]=header_text[:a]+changed+header_text[b:];claims[token.text]=slots
            replacement=p4.rewrite_native_call(text[token.start:end],token.text,token.text,args,altered)
            edits.append((token.start,end,replacement))
            changes.append({"source":str(path.relative_to(SOURCE)).replace("\\","/"),"wrapper":token.text,
                            "original_arguments":args,"owned_slots":sorted(slots),"source_line":text.count("\n",0,token.start)+1})
        for a,b,replacement in reversed(edits):text=text[:a]+replacement+text[b:]
        if edits:write(path,NOTICE+text)
    for path,text in headers.items():write(path,NOTICE+'#include "nh-phase6-helper.h"\n'+text)
    return {"source_only":True,"owned_consumer_sites":len(changes),"owned_formal_slots":sum(len(c["owned_slots"]) for c in changes),
            "sites":changes,"fallback":fallback,"contract":"direct original public helper expressions only; owning formals copied immediately; no pooled-pointer registry"}


def native_exit_gate(source,p4):
    generic='    if (kind == NH_TEXT_RAW && raw && window == -1) return s->json;'
    exact='    if (kind == NH_TEXT_RAW && !strcmp(s->descriptor->api,"exit_nhwindows") &&\n        !strcmp(callback,"shim_exit_nhwindows") && window == -1) return s->json;'
    gate='    if (kind == NH_TEXT_RAW && !strcmp(s->descriptor->api,"exit_nhwindows"))\n        return !strcmp(callback,"shim_exit_nhwindows") && window == -1 ? s->json : NULL;\n'
    source=p4.sem.replace_once(source,exact,"","Phase6 exact terminal callback precedence")
    return p4.sem.replace_once(source,generic,gate+generic,"Phase6 terminal rejects every other RAW callback")


def native_question_gate(source,p4):
    """Alternate yn_menu has no source-owned window binding: keep English.

    Only the certified native yn callback uses sentinel -1. The separate
    source-owned getlin branch remains unchanged; no original yn logic changes.
    """
    original='    if (kind == NH_TEXT_QUESTION && ((!strcmp(callback,"shim_yn_function") && window == -1) || !strcmp(callback,"shim_end_menu"))) return s->json;'
    certified='    if (kind == NH_TEXT_QUESTION && !strcmp(callback,"shim_yn_function") && window == -1) return s->json;'
    return p4.sem.replace_once(source,original,certified,"Phase6 QUESTION rejects unbound alternate menu windows")


def public_appearance_overlay(catalog):
    """Only the original selected public description determines emitted ID.

    C's existing public_index/oc_descr pointer observation is unchanged. This
    edits its private generated label table, never the source object tables.
    Conflicting Japanese for one public phrase leaves its alias English-only.
    """
    path=SOURCE/"include/nh-semantic-object-labels.h"
    source=path.read_text("utf8")
    pattern=r'\[NH_NAME_OBJECT_APPEARANCE\] = "([a-z0-9._]+)"'
    originals=re.findall(pattern,source);groups={}
    for identifier in originals:
        phrase=catalog["en"][identifier]
        if catalog["argument_schemas"].get(identifier,[]):raise ValueError("appearance leaf unexpectedly has arguments")
        groups.setdefault(phrase,[]).append(identifier)
    aliases={};table={"en":{},"ja":{},"argument_schemas":{}};rows=[]
    for phrase,identifiers in sorted(groups.items()):
        translations={catalog["ja"].get(identifier) for identifier in identifiers}
        translations.discard(None)
        slug=re.sub(r"[^a-z0-9]+","_",phrase.lower()).strip("_")[:72] or "empty"
        alias="nethack.public.appearance."+slug+"."+sha(phrase)[:10]
        valid=len(translations)==1 and all(identifier in catalog["ja"] for identifier in identifiers)
        for identifier in identifiers:aliases[identifier]=alias
        table["en"][alias]=phrase;table["argument_schemas"][alias]=[]
        if valid:
            table["ja"][alias]=next(iter(translations))
        rows.append({"private_source_ids":identifiers,"public_phrase":phrase,"public_alias":alias,
                     "japanese_eligible":valid,"japanese_source_candidates":[{"private_source_id":identifier,"ja":catalog["ja"].get(identifier)} for identifier in identifiers],
                     "public_only_identity":True,"reason":None if valid else "missing/conflicting source-reviewed Japanese for one public phrase"})
    changed=re.sub(pattern,lambda match:'[NH_NAME_OBJECT_APPEARANCE] = '+(json.dumps(aliases[match.group(1)]) if aliases[match.group(1)] else '0'),source)
    if len(re.findall(pattern,changed))!=sum(bool(value) for value in aliases.values()):raise ValueError("appearance alias replacement count changed")
    write(path,NOTICE+changed)
    return table,{"source_only":True,"runtime_verified":False,"original_pointer_selection_unchanged":True,
                  "description_slots":len(originals),"public_aliases":len(table["en"]),"english_only_slots":sum(len(row["private_source_ids"]) for row in rows if not row["japanese_eligible"]),
                  "source_mapping":rows,"contract":"IDs derive solely from selected public description bytes; no real otyp/truth bucket/name/knowledge/RNG query"}


def remap_preserved_operation(original,current,operation):
    """Map an exact original span through unique unchanged byte context.

    Never trust old offsets in transformed source. An empty insertion additionally
    admits a unique unchanged left owner (needed after original hack.h, where
    earlier phases inserted headers). Ambiguous/stale contexts are rejected.
    """
    start,end=operation['start'],operation['end']
    if original[start:end]!=operation['original']:raise ValueError('stale pristine Phase7 operation')
    for radius in (2048,1024,512,256,128,64,32):
        a=max(0,start-radius);b=min(len(original),end+radius);anchor=original[a:b]
        if current.count(anchor)==1:
            mapped=current.index(anchor)+start-a
            return mapped,mapped+end-start
    # Earlier exact call rewrites can occur immediately on only one side.
    # A unique longer owner on the other side still proves the unchanged span.
    for left,right in ((128,16),(64,16),(32,16),(16,128),(16,64),(16,32)):
        a=max(0,start-left);b=min(len(original),end+right);anchor=original[a:b]
        if current.count(anchor)==1:
            mapped=current.index(anchor)+start-a
            return mapped,mapped+end-start
    if start==end:
        for radius in (1024,512,256,128,64):
            anchor=original[max(0,start-radius):start]
            if len(anchor)>=64 and current.count(anchor)==1:
                mapped=current.index(anchor)+len(anchor)
                return mapped,mapped
    raise ValueError('Phase7 original span lacks unique preserved context: '+operation['source']+':'+str(start))


def integrate_phase7(p4):
    directory=TOOLS/'phase7-buffer-producers'
    operations=load(directory/'generated/prototype/operations.json')['operations']
    mapped=[]
    for name in sorted({row['source'] for row in operations}):
        original=(ROOT/'upstream/NetHack-5.0.0'/name).read_text('utf8')
        path=SOURCE/name;current=path.read_text('utf8');edits=[]
        for row in operations:
            if row['source']!=name:continue
            a,b=remap_preserved_operation(original,current,row)
            if current[a:b]!=row['original']:raise ValueError('Phase7 mapped original span mismatch')
            edits.append((a,b,row['replacement']))
            mapped.append({**row,'mapped_start':a,'mapped_end':b,'input_sha256':sha(current)})
        previous=len(current)+1
        for a,b,replacement in sorted(edits,reverse=True):
            if b>previous:raise ValueError('Phase7 mapped operations overlap')
            current=current[:a]+replacement+current[b:];previous=a
        write(path,NOTICE+current)
    for path in sorted((directory/'generated/prototype/include').glob('*.h')):
        write(SOURCE/'include'/path.name,path.read_text('utf8'))
    write(SOURCE/'include/nh-buffer-producer.h',(directory/'nh-buffer-producer.h.in').read_text('utf8'))
    write(SOURCE/'src/nh-buffer-producer.c',(directory/'nh-buffer-producer.c.in').read_text('utf8'))
    entries=load(directory/'generated/prototype/catalog-fragment.json')['entries']
    table={'en':{},'ja':{},'argument_schemas':{}}
    for row in entries:
        table['en'][row['id']]=row['en'];table['ja'][row['id']]=row['ja'];table['argument_schemas'][row['id']]=row['argument_schemas']
    return table,{'source_only':True,'compiled':False,'runtime_verified':False,'operations':mapped,
                  'branches':len(entries),'consumers':6,'unresolved_dynamic_origins':900,
                  'contract':'exact source-owned technical/scalar buffers only; no aliases/copies/names/precision admission'}


def prepare(*_builder_context,phase7=False):
    lock=verify_inputs();foundation=verify_foundation();checked_clone()
    p4=module(ROOT/"tools/instrument-semantic-phase4.py","phase6_original_call_helpers")
    helper=module(TOOLS/"phase6-helper-producers/prepare.py","phase6_owned_helpers")
    monster=module(TOOLS/"phase6-monster-producers/prepare.py","phase6_owned_monsters")
    obj=module(TOOLS/"phase6-object-producers/prepare.py","phase6_owned_objects")
    native=module(TOOLS/"phase6-native-api/prepare.py","phase6_native_contracts")
    loader=module(TOOLS/"phase4/catalog-loader.py","phase6_catalog_contracts")
    artifacts=helper.build();operations=load(TOOLS/"phase6-native-api/generated/call-operations.json")["operations"]
    changed_sources=set();hooks=[];declaration_audit=[]
    foundation_sites=load(FOUNDATION_META/"audit.json")["sites"]
    effective=[]
    for operation in operations:
        candidates=[site for site in foundation_sites if site["source"]==operation["source"] and
                    site["api"]==operation["api"] and site["id"]==operation["id"] and
                    [p4.sem.tokens(arg) for arg in site["original_argument_expressions"]]==
                    [p4.sem.tokens(arg) for arg in operation["original_argument_expressions"]]]
        if len(candidates)>1:raise ValueError("ambiguous previously owned native source binding")
        effective.append({**operation,"api":candidates[0]["wrapper"]} if candidates else operation)
    operations=effective
    for name in sorted({operation["source"] for operation in operations}):
        path=SOURCE/name;text=path.read_text("utf8")
        changed=p4.compose_calls_before_core(text,name,operations)
        include='#include "nh-phase6-native/sites-'+Path(name).stem+'.h"\n'
        original_apis={operation['api'] for operation in load(TOOLS/'phase6-native-api/generated/call-operations.json')['operations'] if operation['source']==name}
        anchor,declaration=native_header_anchor(changed,name,original_apis)
        declaration_audit.append(declaration)
        changed=p4.sem.replace_once(changed,anchor,anchor+'#include "nh-native-api.h"\n'+include,"Phase6 native header")
        write(path,NOTICE+changed);changed_sources.add(name)
    write(OUTPUT/'native-declaration-audit.json',{'source_only':True,'compiled':False,'owners':declaration_audit})
    native_meta=load(TOOLS/"phase6-native-api/generated/metadata.json")["entries"]
    for path in sorted((TOOLS/"phase6-native-api/generated/include/nh-phase6-native").glob("*.h")):
        write(SOURCE/"include/nh-phase6-native"/path.name,path.read_text("utf8"))
    native_header=(TOOLS/"phase6-native-api/nh-native-api.h.in").read_text("utf8")
    write(SOURCE/"include/nh-native-api.h",native_header)
    write(SOURCE/"src/nh-native-api.c",(TOOLS/"phase6-native-api/nh-native-api.c.in").read_text("utf8"))
    # Definition hooks compose into the exact live Phase4 alias, never English.
    cfg_aliases=[]
    for operation in load(FOUNDATION_META/"phase4-inputs/call-operations.json")["operations"]:
        if operation["source"]=="src/cfgfiles.c" and operation["original_argument_expressions"][0] in ('"%s%s%s"','"%s %s%s%s"'):
            cfg_aliases.append((operation["original_argument_expressions"][0],operation["replacement"].split("(",1)[0]))
    aliases=dict(cfg_aliases)
    transforms={"src/end.c":native.transform_panic,"src/windows.c":native.transform_dump,
                "src/cfgfiles.c":lambda text:native.transform_config(text,aliases.get('"%s%s%s"',"pline"),aliases.get('"%s %s%s%s"',"pline")),
                "src/pline.c":native.transform_log,"src/insight.c":native.transform_chronicle,"src/save.c":native.transform_log_free}
    for name,transform in transforms.items():
        path=SOURCE/name;changed=transform(path.read_text("utf8"))
        if '#include "nh-native-api.h"' not in changed:
            changed=p4.sem.replace_once(changed,'#include "hack.h"\n','#include "hack.h"\n#include "nh-native-api.h"\n',"native definition header")
        write(path,NOTICE+changed);changed_sources.add(name)
    path=SOURCE/"src/do_name.c";before=path.read_text("utf8");after,ops=monster.transform(before)
    monster.verify(before,after,ops);write(path,NOTICE+after);hooks+=ops;changed_sources.add("src/do_name.c")
    path=SOURCE/"src/objnam.c";after,ops=obj.transform_objects(path.read_text("utf8"));write(path,NOTICE+after);hooks+=ops;changed_sources.add("src/objnam.c")
    authored=helper.strict_json(TOOLS/"phase6-helper-producers/labels.authored.json")
    for name in sorted(helper.TABLE_SPECS.keys()|{"include/hack.h","include/you.h"}):
        path=SOURCE/name;before=path.read_text("utf8");after,ops=helper.transform_source(before,name,artifacts["tables"],authored)
        if helper.restore_source(after,ops)!=before:raise ValueError("helper exact incoming restoration failed: "+name)
        write(path,NOTICE+after);hooks+=ops;changed_sources.add(name)
    for name in ("nh-phase6-helper.h","nh-phase6-helper-labels.h","nh-phase6-helper.c"):
        write(SOURCE/("src" if name.endswith(".c") else "include")/name,artifacts["generated"][name])
    for origin,name in (("phase6-monster-producers","nh-semantic-monster-composite.h"),("phase6-object-producers","nh-semantic-object-public.h")):
        write(SOURCE/"include"/name,(TOOLS/origin/"bridge-extension.h.in").read_text("utf8"))
    registry=obj.extend_registry((SOURCE/"src/nh-semantic-name.c").read_text("utf8"))
    registry+='\n'+(TOOLS/"phase6-monster-producers/bridge-extension.c.in").read_text("utf8")
    write(SOURCE/"src/nh-semantic-name.c",registry)
    bridge=native.extend_getter((SOURCE/"src/nh-semantic.c").read_text("utf8"))
    bridge=native_question_gate(native_exit_gate(bridge,p4),p4)+'\n'+(TOOLS/"phase6-native-api/bridge-extension.c.in").read_text("utf8")
    write(SOURCE/"src/nh-semantic.c",bridge)
    consumers=integrate_helper_consumers(p4);write(OUTPUT/"helper-consumer-audit.json",consumers)
    catalog=load(FOUNDATION_META/"catalog.json")
    appearance_table,appearance_audit=public_appearance_overlay(catalog)
    write(OUTPUT/"public-appearance-audit.json",appearance_audit)
    helper_table={"en":{},"ja":{},"argument_schemas":{}}
    for entry in artifacts["catalog"]["entries"]:
        if entry["descriptor_enabled"]:
            helper_table["en"][entry["id"]]=entry["en"];helper_table["ja"][entry["id"]]=entry["ja"];helper_table["argument_schemas"][entry["id"]]=[]
    recipe_proof=load(ROOT/'build/phase6/native-recipes.root-review.json')
    if recipe_proof['source_recipe_sha256']!=sha((HERE/'native-recipes.json').read_bytes()):raise ValueError('native recipe source changed')
    for name,digest in recipe_proof['original_source_sha256'].items():
        if sha((ROOT/'upstream/NetHack-5.0.0'/name).read_bytes())!=digest:raise ValueError('native recipe original owner changed')
    tables=[appearance_table,helper_table,load(TOOLS/"phase6-monster-producers/catalog-fragment.json"),obj.catalog(),
            load(TOOLS/"phase6-native-api/generated/catalog.json"),load(HERE/"native-recipes.json"),
            load(ROOT/'locales/phase6/native-recipes.root-reviewed.json')]
    phase7_audit={'enabled':False,'source_only':True}
    if phase7:
        phase7_table,phase7_audit=integrate_phase7(p4);phase7_audit['enabled']=True;tables.append(phase7_table)
    write(OUTPUT/'phase7-audit.json',phase7_audit)
    for table in tables:
        loader.merge_table(catalog,table,p4.catalog.names)
    authored_paths=sorted((ROOT/"locales/phase6").glob("remaining-native-batch-*.normalized.json"))
    # Existing loader faithfully queues every unproven producer-dependent frame.
    native_base=OUTPUT/"native-base-catalog.json";write(native_base,catalog)
    catalog,catalog_audit=loader.load_catalog([native_base],native_meta,authored_paths,p4.catalog.names,p4.sha)
    write(OUTPUT/"catalog.json",catalog);write(OUTPUT/"catalog-audit.json",catalog_audit)
    encoded=json.dumps(catalog,ensure_ascii=False,indent=2).encode("utf8")
    if len(encoded)>16*1024*1024:raise ValueError("Phase6 catalog exceeds current Rust bound")
    # All original and generated C/header ownership hashes are retained, including
    # source-conditional candidates. No resource/Phase7 coverage is invented.
    records=[{"source":str(path.relative_to(SOURCE)).replace("\\","/"),"sha256":sha(path.read_bytes()),"bytes":path.stat().st_size}
             for directory in (SOURCE/"src",SOURCE/"include",SOURCE/"sys",SOURCE/"win") for path in sorted(directory.rglob("*"))
             if path.is_file() and path.suffix in (".c",".h")]
    manifest={"schema_version":1,"date":"2026-10-02","source_only":True,"compiled":False,"runtime_verified":False,
              "official_commit":lock["official_commit"],"inputs_lock_sha256":sha((HERE/"inputs.lock.json").read_bytes()),
              "foundation_manifest_sha256":sha((FOUNDATION_META/"source-manifest.json").read_bytes()),
              "prepared_sources":records,"catalog":{"sha256":sha((OUTPUT/"catalog.json").read_bytes()),"bytes":len(encoded),"fetch_path":"gameplay-core.json"},
              "owned_helpers":consumers,"native_counts":load(TOOLS/"phase6-native-api/generated/audit.json")["counts"],
              "catalog_counts":{"en":len(catalog["en"]),"ja":len(catalog["ja"]),**catalog_audit["counts"]},
              "unresolved":["Phase7 mutable/composed buffer flows","resource/help/data producers","creator-certified custom/priest/rank names",
                            "helper preferences/unsupported transformations","precision-bound and unconsumed text","accepted-public save/history sidecar restoration",
                            "alternate yn_menu question semantic window ownership (original English retained)",
                            "compiler/linker/browser/native memory and complete Japanese coverage"],
              "phase7":phase7_audit,"planned_compile_units":176+int(phase7),"jobs":1,"compiler_limits":{"EMCC_CORES":"1","BINARYEN_CORES":"1","EMCC_BATCH_BUILD":"0","cargo_jobs":1,"CARGO_PROFILE_RELEASE_CODEGEN_UNITS":"1"}}
    write(OUTPUT/"source-manifest.json",manifest)
    # Compatibility shape for the unchanged original builder's object caches.
    audit=load(FOUNDATION_META/"audit.json")
    audit["files"]=[{"source":record["source"],"patched_sha256":record["sha256"]} for record in records if record["source"].startswith("src/")]
    audit["generated_files"]=[{"path":record["source"],"sha256":record["sha256"],"bytes":record["bytes"]} for record in records if record["source"].startswith("include/")]
    audit["phase6"]={"source_only":True,"compiled":False,"runtime_verified":False,"manifest_sha256":sha((OUTPUT/"source-manifest.json").read_bytes())}
    write(OUTPUT/"audit.json",audit)
    verify_inputs();verify_foundation()
    return audit if _builder_context else manifest


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--freeze-inputs",action="store_true",help="Explicitly record reviewed input hashes; no application/compiler")
    parser.add_argument("--prepare",action="store_true",help="Prepare only work/phase6; never compile")
    parser.add_argument('--phase7',action='store_true',help='Optional seven-branch technical buffer proposal; no broad dynamic coverage claim')
    args=parser.parse_args()
    if args.freeze_inputs:freeze_inputs()
    if args.prepare:
        manifest=prepare(phase7=args.phase7);print(json.dumps({"status":"source-only","catalog":manifest["catalog_counts"],"helpers":manifest["owned_helpers"]["owned_consumer_sites"]}))
    if not args.freeze_inputs and not args.prepare:parser.error("choose --prepare or --freeze-inputs")
if __name__=="__main__":main()
