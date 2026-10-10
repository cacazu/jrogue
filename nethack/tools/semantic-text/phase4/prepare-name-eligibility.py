"""Added 2026-10-02, NGPL: isolated original-argument provenance gates.

Never interpret English bytes. A pooled literal or opaque local pointer is not
proof of a public name producer. Only a whole original direct name expression,
optionally wrapped by the original article helpers, permits registry capture.
"""
from __future__ import annotations
import json
import re

DIRECT_NAMES=frozenset({"mon_nam","Monnam","x_monnam","noit_mon_nam",
                       "l_monnam","a_monnam","Amonnam","m_monnam",
                       "y_monnam","distant_monnam","xname","cxname",
                       "doname","Doname2","doname_with_price","corpse_xname"})
ARTICLES=frozenset({"an","An","the","The"})


def qualifies(expression,sem):
    """Recognize original C syntax only; calls are never evaluated here."""
    value=expression.strip()
    while value.startswith("("):
        try:
            args,end=sem.call_arguments(value,0)
        except (ValueError,IndexError): return False
        if end!=len(value): break
        if len(args)!=1: return False
        value=args[0].strip()
    match=re.match(r"([A-Za-z_]\w*)\s*\(",value)
    if not match: return False
    try: args,end=sem.call_arguments(value,value.find("(",match.start()))
    except (ValueError,IndexError): return False
    if end!=len(value): return False
    name=match.group(1)
    if name in ARTICLES: return len(args)==1 and qualifies(args[0],sem)
    return name in DIRECT_NAMES


def bridge_header(source,sem):
    anchor='    const char *event_json; /* owned nested public-name event; text stays original English */\n'
    return sem.replace_once(source,anchor,anchor+
        '    int allow_name_capture; /* exact source-proven original name expression only; default zero */\n',
        "phase4 appended name provenance permission")


def bridge_source(source,sem):
    return sem.replace_once(source,
        '                if (!event) event=nh_text_name_event(a->text);',
        '                if (!event && arguments[i].allow_name_capture) event=nh_text_name_event(a->text);\n'
        '                if (!event && arguments[i].allow_name_capture) scope->invalid=1; /* whole native English until descriptor is proven */',
        "phase4 source-proven name lookup only")


def overlay_headers(folder,operations,frozen_sites,sem,inventory):
    """Append flags only in the isolated generated headers, with audit rows."""
    contracts={site["wrapper"]:site for site in frozen_sites}
    for operation in operations:
        match=re.match(r"([A-Za-z_]\w*)\(",operation["replacement"])
        if not match: raise ValueError("unrecognized generated wrapper replacement")
        site={**operation,"wrapper":match.group(1)}
        previous=contracts.get(site["wrapper"])
        if previous and previous["original_argument_expressions"]!=site["original_argument_expressions"]:
            raise ValueError("wrapper aliases conflicting source contracts")
        contracts[site["wrapper"]]=site
    rows=[];found=set()
    for path in sorted((folder/"include").rglob("sites-*.h")):
        original=path.read_text(encoding="utf8");changes=[]
        tokens=inventory.c_tokens(original)
        for index,token in enumerate(tokens):
            if token.kind!="identifier" or token.text not in contracts: continue
            if index+1>=len(tokens) or tokens[index+1].text!="(": continue
            _,signature_end=sem.call_arguments(original,tokens[index+1].start)
            brace=next((n for n in range(index+1,len(tokens)) if tokens[n].start>=signature_end),None)
            if brace is None or tokens[brace].text!="{": continue
            depth=0;end=None
            for n in range(brace,len(tokens)):
                if tokens[n].text=="{": depth+=1
                elif tokens[n].text=="}":
                    depth-=1
                    if depth==0: end=tokens[n].end;break
            if end is None: raise ValueError("unclosed generated wrapper")
            site=contracts[token.text];found.add(token.text)
            expressions=site["original_argument_expressions"]
            body=original[token.start:end]
            entries=[]
            for line in body.splitlines():
                match=re.match(r'\s*\{("arg_\d+"), NH_TEXT_TEXT, (.*)\},\s*$',line)
                if not match: continue
                argument=json.loads(match.group(1));slot=int(argument[4:])-1
                pointer=re.search(r"\bnh_p(\d+)(?:\.original)?",match.group(2))
                if not pointer: raise ValueError("unrecognized generated text argument")
                parameter=int(pointer.group(1))
                if parameter>=len(expressions): raise ValueError("source argument pointer outside contract")
                eligible=qualifies(expressions[parameter],sem)
                entries.append((slot,eligible))
                start=token.start+body.index(line)
                replacement=line.replace(match.group(2)+"}",match.group(2)+f", {int(eligible)}"+"}")
                changes.append((start,start+len(line),replacement))
                rows.append({"id":site.get("id"),"selected_message_ids":site.get("message_ids",site.get("selected_message_ids",[])),"source":site["source"],"line":site["line"],
                             "wrapper":token.text,"argument":argument,"source_expression":expressions[parameter],
                             "allow_name_capture":eligible,"runtime_verified":False,
                             "reason":"whole original direct public-name expression" if eligible else "raw/literal/table/opaque expression has no source-proven name provenance"})
            for slot,eligible in entries:
                if eligible: continue
                pattern=rf"const char \*nh_public_{slot} = nh_text_name_event\(nh_p\d+\);"
                for match in re.finditer(pattern,body):
                    changes.append((token.start+match.start(),token.start+match.end(),
                                    f"const char *nh_public_{slot} = NULL; /* source provenance does not permit registry lookup */"))
        changed=original
        for start,end,replacement in sorted(changes,reverse=True): changed=changed[:start]+replacement+changed[end:]
        if changes: path.write_text(changed,encoding="utf8",newline="\n")
    missing=set(contracts)-found
    if missing: raise ValueError("missing generated provenance wrappers: "+str(sorted(missing)[:5]))
    return {"schema_version":1,"source_only":True,"runtime_verified":False,
            "contract":"only original syntax establishes name capture; identical literal bytes/pointers never promote raw arguments",
            "direct_names":sorted(DIRECT_NAMES),"article_helpers":sorted(ARTICLES),
            "counts":{"text_slots":len(rows),"eligible":sum(row["allow_name_capture"] for row in rows),
                      "raw_without_lookup":sum(not row["allow_name_capture"] for row in rows)},"slots":rows}
