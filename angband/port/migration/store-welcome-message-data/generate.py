"""Source-backed welcome/hint catalog; stdlib only, no game execution."""
import ast,hashlib,json,re
from pathlib import Path
HERE=Path(__file__).resolve().parent
PORT=HERE.parents[1]
COMMIT="f3082213b73f3e463e3d0d60bff4b00462beae6e"
def load(name):return json.loads((HERE/name).read_text("utf8"))
def write(name,data):(HERE/name).write_text(data if isinstance(data,str)else json.dumps(data,ensure_ascii=False,indent=2)+"\n","utf8")
def assemble():
    pins=load("pinned-sources.json")
    for pin in pins["sources"]:
        b=(PORT/pin["file"]).read_bytes()
        assert len(b)==pin["bytes"]and hashlib.sha256(b).hexdigest()==pin["sha256"]
    source=(HERE/"producer-snapshots/ui-store.c").read_text("utf8")
    hints=[(n,line[2:])for n,line in enumerate((HERE/"producer-snapshots/hints.txt").read_text("utf8").splitlines(),1)if line.startswith("H:")]
    authored=load("ja-input.json")["hints"];assert len(hints)==len(authored)==99
    en={};ja={};entries={};bindings=[]
    def add(id,english,japanese,params,sources,identity):
        assert id not in en
        en[id]=english;ja[id]=japanese
        entries[id]={"parameters":[{"name":k,"type":v}for k,v in params.items()],"sources":sources,"identity":identity,"source_integrated":True,"runtime_integrated":False}
    for ordinal,((line,value),auth)in enumerate(zip(hints,authored)):
        id="store.welcome.hint."+auth["key"]
        # One reviewed command-key brace needs the supported literal escape.
        english=value.replace("{","{{").replace("}","}}")
        add(id,english,auth["japanese"],{},[{"file":"migration/store-welcome-message-data/producer-snapshots/hints.txt","upstream_file":"lib/gamedata/hints.txt","line":line,"directive":"H","exact_value":value,"raw_line":"H:"+value}],{"source_ordinal":ordinal,"directive":"H","semantic_role":auth["key"]})
        bindings.append({"source_ordinal":ordinal,"runtime_list_ordinal":98-ordinal,"id":id,"raw_english":value})
    m=re.search(r"static const char \*comment_welcome\[\]\s*=\s*\{(.*?)\};",source,re.S);assert m
    literals=list(re.finditer(r'"(?:[^"\\]|\\.)*"',m[1]));values=[ast.literal_eval(x[0])for x in literals];assert len(values)==10 and values[0]==""
    greetkeys=["nods","says_hello","adventurer_see_anything","offer_help","welcome_back","pleasure_again","good_customer_assistance","noble_store_honour","family_service"]
    greetja=["{owner}はこちらにうなずいた。","{owner}が挨拶した。","{owner}：「冒険者さん、何か気になる品はあるかい？」","{owner}：「{customer}、どのようなご用でしょうか？」","{owner}：「お帰りなさい、{customer}。」","{owner}：「{customer}、またお会いできて光栄です。」","{owner}：「立派な{customer}、どのようなお手伝いができますかな？」","{owner}：「高貴な{customer}、このささやかな店にお越しいただき光栄です。」","{owner}：「{customer}、私も家族も、喜んであなたのお役に立ちます。」"]
    greetbindings=[]
    for index,(key,japanese)in enumerate(zip(greetkeys,greetja),1):
        raw=values[index];parts=raw.split("%s");count=len(parts)-1
        assert count==(1 if index<4 else 2)
        english=parts[0]+"{owner}"+parts[1]
        params={"owner":"verbatim_user_text"}
        if count==2:english+="{customer}"+parts[2];params["customer"]="localized_text"
        id="store.welcome.greeting."+key;offset=m.start(1)+literals[index].start()
        add(id,english,japanese,params,[{"file":"migration/store-welcome-message-data/producer-snapshots/ui-store.c","upstream_file":"src/ui-store.c","line":source.count("\n",0,offset)+1,"exact_value":raw,"array":"comment_welcome","array_index":index}],{"array":"comment_welcome","index":index})
        greetbindings.append({"index":index,"id":id,"parameters":params,"raw_english":raw})
    def line(needle):assert needle in source;return source.count("\n",0,source.index(needle))+1
    src=lambda needle:[{"file":"migration/store-welcome-message-data/producer-snapshots/ui-store.c","upstream_file":"src/ui-store.c","line":line(needle),"exact_source":needle}]
    add("store.welcome.hint",'"{hint}"',"「{hint}」",{"hint":"localized_text"},src('static const char *comment_hint[]'),{"array":"comment_hint","index":0})
    add("store.welcome.customer.valued","valued customer","お得意様",{},src('player_name = "valued customer";'),{"selected_customer_role":"valued"})
    add("store.welcome.customer.player","{name}","{name}",{"name":"character_name"},src('player_name = player->full_name;'),{"selected_customer_role":"player_name"})
    assert len(en)==len(ja)==len(entries)==111
    init=(HERE/"producer-snapshots/init.c").read_text("utf8");assert "new->next = h;"in init and "hints = parser_priv(p);"in init
    schema={"schema_version":1,"upstream_commit":COMMIT,"entries":entries}
    manifest={"schema_version":1,"upstream_commit":COMMIT,"source_integrated":True,"runtime_integrated":False,"entries":entries,"coverage":{"hints":99,"active_greetings":9,"hint_wrapper":1,"customer_wrappers":2},"source_order":"parse_hint prepends; finish_parse_hints retains linked-list head; runtime ordinal=98-source ordinal","exclusions":{"welcome_index_0":"empty sentinel unreachable in lev>5 branch; no empty catalog template","comment_hint_commented_examples":3},"opaque_policy":"Owner short names verbatim_user_text; actual player names character_name; titles and valued customer localized refs.","literal_escape":"Only fixed literal braces use standard {{/}} template escapes; exact source English retains raw braces and trailing spaces.","rng_policy":"Original reservoir winner ordinal captured at original r=v assignment; no second walk, RNG draw, or English sentence comparison."}
    binding={"upstream_commit":COMMIT,"hints":bindings,"greetings":greetbindings,"native_hint_count":99,"runtime_integrated":False}
    header=["/* SPDX-License-Identifier: GPL-2.0-only */","/* Generated private source identities: "+COMMIT+" */","#ifndef ANGBAND_WEB_STORE_WELCOME_DATA_H","#define ANGBAND_WEB_STORE_WELCOME_DATA_H","static const char *const ab_sw_hint_ids[] = {"]
    header+=[" "+json.dumps(b["id"])+","for b in sorted(bindings,key=lambda b:b["runtime_list_ordinal"])]
    header+=["};","static const char *const ab_sw_greeting_ids[] = {"," NULL,"]+[" "+json.dumps(b["id"])+","for b in greetbindings]+["};","#endif",""]
    return {"en.json":en,"ja.json":ja,"schema.json":schema,"source-manifest.json":manifest,"source-bindings.json":binding,"web-store-welcome-data.h":"\n".join(header)}
if __name__=="__main__":
    import argparse
    ap=argparse.ArgumentParser();ap.add_argument("--check",action="store_true");args=ap.parse_args()
    for name,data in assemble().items():
        if args.check:
            actual=(HERE/name).read_text("utf8")if isinstance(data,str)else load(name)
            assert actual==data,"stale "+name
        else:write(name,data)
    print(json.dumps({"catalog_entries":111,"hints":99,"active_greetings":9,"generator_check":args.check}))
