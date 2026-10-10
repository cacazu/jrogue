"""Source-only combat hook installation and byte reconstruction evidence.

Does not execute or compile C. Every inserted byte belongs to AB_COMBAT blocks;
removing those blocks restores the exact pre-hook file, including mixed CRLF.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re

HERE=Path(__file__).resolve().parent
LOGIC=HERE.parent.parent/"logic"
MARKER=re.compile(r"/\* AB_COMBAT_BEGIN \*/.*?/\* AB_COMBAT_END \*/",re.S)

def block(code,guard=True):
    inner=("#ifdef __EMSCRIPTEN__\n"+code+"\n#endif") if guard else code
    return "/* AB_COMBAT_BEGIN */\n"+inner+"\n/* AB_COMBAT_END */"

def function(source,name):
    match=re.search(r"(?:static\s+)?(?:void|char\s*\*)\s*"+re.escape(name)+r"\s*\([^;]*?\)\s*\{",source)
    if not match: raise ValueError("missing function "+name)
    cursor=match.end();depth=1;state="code"
    while depth:
        char=source[cursor];nextchar=source[cursor:cursor+2]
        if state=="code":
            if nextchar=="/*":state="comment";cursor+=2;continue
            if nextchar=="//":state="line";cursor+=2;continue
            if char=='"':state="string"
            elif char=="'":state="char"
            elif char=="{":depth+=1
            elif char=="}":depth-=1
        elif state=="comment" and nextchar=="*/":state="code";cursor+=2;continue
        elif state=="line" and char=="\n":state="code"
        elif state in ("string","char"):
            if char=="\\":cursor+=2;continue
            if (state=="string" and char=='"') or (state=="char" and char=="'"):state="code"
        cursor+=1
    return match.start(),cursor

def edit(source,name,editor):
    start,end=function(source,name)
    return source[:start]+editor(source[start:end])+source[end:]

def flexible(anchor):return re.escape(anchor).replace(chr(92)+chr(10),r"\r?\n")

def insert(source,anchor,code,before=False,guard=True):
    matches=list(re.finditer(flexible(anchor),source))
    if len(matches)!=1:raise ValueError(f"anchor count {len(matches)}: {anchor!r}")
    match=matches[0]
    pos=match.start() if before else match.end()
    return source[:pos]+block(code,guard)+source[pos:]

def include(source):return block('#include "web-combat.h"',False)+source

def mon_msg(source):
    source=include(source)
    def subject(s):
        s=insert(s,'\tif (invisible) {','ab_combat_subject_hidden();')
        s=insert(s,'\t\tif (rf_has(race->flags, RF_UNIQUE)) {','ab_combat_subject_visible(race,true,"singular");')
        s=insert(s,'\t\t} else if (count == 1) {','ab_combat_subject_visible(race,false,"singular");')
        s=insert(s,'\t\t\tif (race->plural != NULL) {','ab_combat_subject_visible(race,false,"explicit");')
        s=insert(s,'\t\t\t\tplural_aux(buf, buflen);','ab_combat_subject_visible(race,false,"regular");')
        s=insert(s,'\t\tif (rf_has(race->flags, RF_NAME_COMMA)) {','ab_combat_subject_comma();')
        return s
    source=edit(source,'get_subject',subject)
    source=edit(source,'get_message_text',lambda s:insert(s,'\tint state = MSG_PARSE_NORMAL;',
        'ab_combat_reaction_body(msg_code,source,do_plural);',before=True))
    def show(s):
        s=insert(s,'\tint msg_type = get_message_type(msg->msg_code, msg->race);',
            'struct ab_combat_reaction ab_reaction;\nab_combat_reaction_begin(&ab_reaction,msg->count,\n (msg->flags & MON_MSG_FLAG_OFFSCREEN)!=0,msg_type);')
        s=insert(s,'\t\tif (msg->count <= 1) {','ab_combat_reaction_format("damage");')
        s=insert(s,'\t\t} else {','ab_combat_reaction_format("average");')
        for expression in ['msg->damage','msg->damage / msg->count\n\t\t\t\t+ (msg->damage % msg->count\n\t\t\t\t>= (msg->count + 1) / 2 ? 1 : 0)']:
            if expression=='msg->damage':
                anchor='msgt(msg_type, "%s%s (%d)", subject, body, msg->damage);'
                replacement=anchor.replace(expression,'/* AB_COMBAT_BEGIN */AB_COMBAT_REACTION_DAMAGE(/* AB_COMBAT_END */'+expression+'/* AB_COMBAT_BEGIN */)/* AB_COMBAT_END */')
                s,count=re.subn(re.escape(anchor),lambda m:replacement,s)
            else:
                s,count=re.subn(flexible(expression),lambda m:'/* AB_COMBAT_BEGIN */AB_COMBAT_REACTION_DAMAGE(/* AB_COMBAT_END */'+m.group(0)+'/* AB_COMBAT_BEGIN */)/* AB_COMBAT_END */',s)
            if count!=1:raise ValueError('damage expression count')
        s=insert(s,'\t\tmsgt(msg_type, "%s%s", subject, body);','ab_combat_reaction_emit();',before=True)
        return s
    return edit(source,'show_message',show)

def mon_spell(source):
    source=include(source)
    def spell(s):
        s=insert(s,'\tbool is_leading;','struct ab_combat_template ab_spell;')
        s=insert(s,"\n\tnext = strchr(in_cursor, '{');",'ab_combat_spell_begin(&ab_spell,in_cursor,spell->msgt);',before=True)
        s=insert(s,'\t\t\t\t\tmonster_desc(m_name, sizeof(m_name),\n\t\t\t\t\t\tmon, mdesc_mode);',
            'ab_combat_template_monster(&ab_spell,"name",m_name,false);')
        s=insert(s,'\t\t\t\t\tmonster_desc(m_poss, sizeof(m_poss), mon, MDESC_PRO_VIS | MDESC_POSS);',
            'ab_combat_template_monster(&ab_spell,"pronoun",m_poss,false);')
        s=insert(s,'\t\t\t\t\t\tmonster_desc(m_name,\n\t\t\t\t\t\t\tsizeof(m_name), t_mon,\n\t\t\t\t\t\t\tmdesc_mode);',
            'ab_combat_template_monster(&ab_spell,"target",m_name,true);')
        s=insert(s,'\t\t\t\t\t\tstrnfcat(buf, sizeof(buf), &end, "you");',
            'ab_combat_template_player(&ab_spell,"target",false);')
        for tag,optional in [('SPELL_TAG_TYPE',False),('SPELL_TAG_OF_TYPE',True)]:
            start=s.index('case '+tag+':');end=s.index('\n\t\t\t\tdefault:',start) if optional else s.index('case SPELL_TAG_OF_TYPE:',start)
            section=s[start:end]
            section=insert(section,'char *type_name = projections[type].lash_desc;',
                f'ab_combat_template_lash(&ab_spell,"{"oftype" if optional else "type"}",type_name,{str(optional).lower()});')
            s=s[:start]+section+s[end:]
        s=insert(s,'\tmsgt(spell->msgt, "%s", buf);','ab_combat_spell_end(&ab_spell);',before=True)
        return s
    source=edit(source,'spell_message',spell)
    return edit(source,'do_mon_spell',lambda s:insert(s,'\t\t\tmsg("%s", level->save_message);',
        'ab_combat_save(level->save_message);',before=True))

def mon_blows(source):
    source=include(source)
    def action(s):
        s=insert(s,'\tstruct monster *t_mon = NULL;','struct ab_combat_template ab_action;')
        s=insert(s,'\tin_cursor = msg->act_msg;','ab_combat_blow_action_begin(&ab_action,in_cursor);')
        s=insert(s,'\t\t\t\t\t\tmonster_desc(m_name,\n\t\t\t\t\t\t\tsizeof(m_name), t_mon,\n\t\t\t\t\t\t\tmdesc_mode);',
            'ab_combat_template_monster(&ab_action,"target",m_name,true);')
        s=insert(s,'\t\t\t\t\t\tstrnfcat(buf, sizeof(buf), &end, "you");',
            'ab_combat_template_player(&ab_action,"target",false);')
        s=insert(s,'\t\t\t\t\t\tmonster_desc(m_name,\n\t\t\t\t\t\t\tsizeof(m_name), t_mon,\n\t\t\t\t\t\t\tMDESC_TARG | MDESC_POSS);',
            'ab_combat_template_monster(&ab_action,"oftarget",m_name,true);')
        s=insert(s,'\t\t\t\t\t\tstrnfcat(buf, sizeof(buf), &end, "your");',
            'ab_combat_template_player(&ab_action,"oftarget",true);')
        s=insert(s,'\t\t\t\t\t\tstrnfcat(buf, sizeof(buf), &end, "has");',
            'ab_combat_template_has(&ab_action,true);')
        s=insert(s,'\t\t\t\t\t\tstrnfcat(buf, sizeof(buf), &end, "have");',
            'ab_combat_template_has(&ab_action,false);')
        s=insert(s,'\treturn string_make(buf);','ab_combat_blow_action_end(&ab_action);',before=True)
        return s
    source=edit(source,'monster_blow_method_action',action)
    def display(s,player):
        s=insert(s,'\tchar *act = monster_blow_method_action(method, '+('-1' if player else 't_idx')+');',
            'struct ab_combat_blow ab_blow;\nab_combat_blow_begin(&ab_blow,m_name);',before=True)
        s=insert(s,'\t\t\tfullstop = "";','ab_combat_blow_stop(false);')
        if player:
            s=insert(s,'\t\t\tmsgt(method->msgt, "%s %s%s (%d)", m_name, act,',
                'ab_combat_blow_emit(&ab_blow,method->msgt,true,damage);',before=True)
            s=insert(s,'\t\t\tmsgt(method->msgt, "%s %s%s", m_name, act, fullstop);',
                'ab_combat_blow_emit(&ab_blow,method->msgt,false,0);',before=True)
        else:
            s=insert(s,'\t\tmsgt(method->msgt, "%s %s%s", m_name, act, fullstop);',
                'ab_combat_blow_emit(&ab_blow,method->msgt,false,0);',before=True)
        pos=s.rfind('}');return s[:pos]+block('ab_combat_blow_end(&ab_blow);')+s[pos:]
    source=edit(source,'display_blow_message_vs_player',lambda s:display(s,True))
    return edit(source,'display_blow_message_vs_monster',lambda s:display(s,False))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    evidence_path=HERE/'hook-baselines.json'
    evidence=json.loads(evidence_path.read_text(encoding='utf-8')) if evidence_path.exists() else {}
    results={}
    for file,editor in [('mon-msg.c',mon_msg),('mon-spell.c',mon_spell),('mon-blows.c',mon_blows)]:
        path=LOGIC/file;original=path.read_bytes();source=original.decode('utf-8')
        if 'AB_COMBAT_BEGIN' not in source:
            if args.check:raise ValueError('uninstalled hooks: '+file)
            updated=editor(source)
            if MARKER.sub('',updated)!=source:raise ValueError('byte reconstruction failed before write: '+file)
            evidence[file]={'before_sha256':hashlib.sha256(original).hexdigest(),'before_bytes':len(original)}
            path.write_bytes(updated.encode('utf-8'));source=updated
        stripped=MARKER.sub('',source).encode('utf-8')
        if hashlib.sha256(stripped).hexdigest()!=evidence[file]['before_sha256']:raise ValueError('pre-hook byte drift: '+file)
        results[file]={'blocks':len(MARKER.findall(source)),'before_bytes':len(stripped),'after_bytes':len(source.encode('utf-8')),'reconstructs_exactly':True}
        if not args.check:evidence_path.write_text(json.dumps(evidence,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(results))

if __name__=='__main__':main()

