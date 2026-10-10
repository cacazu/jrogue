"""Additive source-selected shape lore; stdlib only, no engine execution."""
import ast
import hashlib
import json
from pathlib import Path
import re

HERE=Path(__file__).resolve().parent
PORT=HERE.parents[1]
PREFIX='angband.knowledge.shape_lore.'
SOURCE=HERE/'producer-snapshots/ui-knowledge.c'
CURRENT=PORT/'logic/ui-knowledge.c'
EXPECTED='2c2e39752819a863ab586f7a2886044119868b205d28cbf91652da174cbc0886'

def balanced(text,start,opening,closing):
    depth=0; quote=None; i=start
    while i<len(text):
        c=text[i]
        if quote:
            if c=='\\': i+=2; continue
            if c==quote: quote=None
        elif c in '\"\'': quote=c
        elif text.startswith('/*',i):
            i=text.index('*/',i+2)+2;continue
        elif text.startswith('//',i):
            i=text.find('\n',i+2)
            if i<0: return len(text)
            continue
        elif c==opening: depth+=1
        elif c==closing:
            depth-=1
            if not depth:return i+1
        i+=1
    raise AssertionError('unbalanced source')

def function(text,name):
    m=re.search(r'\b'+re.escape(name)+r'\s*\([^;{}]*\)\s*\{',text)
    assert m,name
    start=text.rfind('\n',0,m.start())+1
    end=balanced(text,text.index('{',m.start()),'{','}')
    return start,end,text[start:end]

def calls(body):
    result=[]
    for m in re.finditer(r'\b(textblock_append|strnfmt|format)\s*\(',body):
        end=balanced(body,body.index('(',m.start()),'(',')')
        result.append((m.start(),body[m.start():end]))
    return result

def literal(call):
    return ''.join(ast.literal_eval(s) for s in re.findall(r'"(?:[^"\\]|\\.)*"',call))

def source_ref(text,name,needle):
    start,end,body=function(text,name)
    assert needle in body,(name,needle)
    offset=start+body.index(needle)
    return {'file':'migration/knowledge-text-data/producer-snapshots/ui-knowledge.c',
        'upstream_file':'src/ui-knowledge.c','line':text.count('\n',0,offset)+1,
        'exact_source':needle,'function':name}

def make_input(text):
    rules=[]
    def add(key,en,ja,params,name,needle,role=None):
        rules.append({'id':PREFIX+key,'role':role or key,'english':en,'japanese':ja,
            'parameters':params,'source':source_ref(text,name,needle),
            'source_english':literal(needle),'notes':'Original selected branch/order/arguments only; no completed-English lookup. EN retains native punctuation; JA composes the reviewed full statement.'})
    root=function(text,'shape_lore')[2]
    intro=next(c for _,c in calls(root) if 'Like all shapes' in c)
    add('introduction',literal(intro),'\nどの変身形態でも、変身時に装備していたアイテムが基礎能力を決める。これには一撃あたりのダメージ、攻撃回数、耐性も含まれる。変身中は、拾う場合と食べる場合を除き、荷物や床のアイテムを扱えない。元の姿に戻るには、呪文を唱えるか、食べる以外のアイテム操作（例えば落とす）を行う。\n',{},'shape_lore',intro)
    wrappers=[('adds','Adds {items}.\n','{items}の修正が加わる。\n','shape_lore_append_basic_combat','Adds'),
        ('vulnerability','Makes you vulnerable to {items}.\n','{items}に対して弱くなる。\n','shape_lore_append_resistances','Makes you vulnerable to'),
        ('resistance','Makes you resistant to {items}.\n','{items}への耐性を得る。\n','shape_lore_append_resistances','Makes you resistant to'),
        ('immunity','Makes you immune to {items}.\n','{items}への免疫を得る。\n','shape_lore_append_resistances','Makes you immune to'),
        ('protection','Provides protection from {items}.\n','{items}を防ぐ。\n','shape_lore_append_protection_flags','Provides protection from'),
        ('sustains','Sustains {items}.\n','{items}の低下を防ぐ。\n','shape_lore_append_sustains','Sustains')]
    for key,en,ja,name,value in wrappers:
        needle=next(c for _,c in calls(function(text,name)[2]) if literal(c)==value)
        add(key,en,ja,{'items':'localized_text'},name,needle)
    listbody=function(text,'shape_lore_append_list')[2]
    final=next(c for _,c in calls(listbody) if ' and' in c)
    for key,en in [('list.comma','{left}, {right}'),('list.and','{left} and {right}')]:
        add(key,en,'{left}、{right}',{'left':'localized_text','right':'localized_text'},'shape_lore_append_list',final)
    for key,en,ja,member in [('modifier.armor','{amount} to AC','AC{amount}','s->to_a'),
            ('modifier.hit','{amount} to hit','命中{amount}','s->to_h'),
            ('modifier.damage','{amount} to damage','ダメージ{amount}','s->to_d')]:
        needle=next(c for _,c in calls(function(text,'shape_lore_append_basic_combat')[2]) if member in c)
        add(key,en,ja,{'amount':'signed_integer'},'shape_lore_append_basic_combat',needle)
    for key,slot,name in [('modifier.skill','skill','shape_lore_append_skills'),('modifier.property','property','shape_lore_append_non_stat_modifiers')]:
        needle=next(c for _,c in calls(function(text,name)[2]) if c.startswith('format('))
        add(key,'{amount} to {'+slot+'}','{'+slot+'}{amount}',{'amount':'signed_integer',slot:'localized_text'},name,needle)
    skills=[('DISARM_PHYS','physical disarming','物理的な罠の解除'),('DISARM_MAGIC','magical disarming','魔法の罠の解除'),
        ('DEVICE','magic devices','魔道具の使用'),('SAVE','saving throws','魔法防御'),('SEARCH','searching','探索'),
        ('TO_HIT_MELEE','melee to hit','近接攻撃の命中'),('TO_HIT_BOW','shooting to hit','射撃の命中'),
        ('TO_HIT_THROW','throwing to hit','投擲の命中'),('DIGGING','digging','採掘'),('UNKNOWN','unknown skill','不明な技能')]
    for code,en,ja in skills:
        add('skill.'+code.lower(),en,ja,{},'skill_index_to_name','name = "'+en+'";',role='skill.name')
    spellcall=next(c for _,c in calls(function(text,'shape_lore_append_triggering_spells')[2]) if 'triggers the shapechange' in c)
    add('triggering_spell','The {class} spell, {spell}, from {book} triggers the shapechange.',
        '{book}に載っている{class}の呪文「{spell}」で、この形態に変身する。',
        {'class':'localized_text','spell':'localized_text','book':'localized_text'},'shape_lore_append_triggering_spells',spellcall)
    names=['shape_lore_append_basic_combat','shape_lore_append_skills','shape_lore_append_non_stat_modifiers',
        'shape_lore_append_stat_modifiers','shape_lore_append_resistances','shape_lore_append_protection_flags',
        'shape_lore_append_sustains','shape_lore_append_triggering_spells']
    ledger=[]
    for name in names+['skill_index_to_name','shape_lore_append_list','shape_lore']:
        start,end,body=function(text,name)
        ledger.append({'function':name,'line_start':text.count('\n',0,start)+1,'line_end':text.count('\n',0,end)+1,
            'native_calls':[{'line':text.count('\n',0,start+offset)+1,'original_call':call} for offset,call in calls(body)],
            'status':'source_connected_unaccepted' if name in names or name=='shape_lore' else 'source_grammar_dependency'})
    character=json.loads((PORT/'migration/character-data/source-manifest.json').read_text('utf8'))['entries']
    class_ids={e['identity']['cidx']:e['id'] for e in character if e['role']=='class_name'}
    book_ids={(e['identity']['cidx'],e['identity']['bidx']):e['id'] for e in character if e['role']=='book_name'}
    bindings=[]
    for e in character:
        if e['role']!='spell_name':continue
        i=e['identity'];bindings.append({'cidx':i['cidx'],'bidx':i['bidx'],'book_spell_index':i['book_spell_index'],
            'class_id':class_ids[i['cidx']],'book_id':book_ids[i['cidx'],i['bidx']],'spell_id':e['id']})
    assert len(rules)==25 and len(bindings)==163
    return {'schema_version':1,'upstream_commit':'f3082213b73f3e463e3d0d60bff4b00462beae6e',
        'source_integrated':True,'runtime_integrated':False,'entries':rules,'source_functions':ledger,
        'skill_bindings':[{'code':k,'id':PREFIX+'skill.'+k.lower()} for k,_,_ in skills],
        'spell_bindings':bindings,'contract':{'descriptor':'localized_text','new_descriptor':False,'new_empty_ids':[],
            'list_max':64,'list_depth_max':8,'order':'original native append order; final separator and, other separators comma',
            'capture':'numeric native format arguments evaluated once; refs selected by original canonical skill/property/element/class/book/spell coordinates'}}

def block(code):
    return '\n/* AB_KNOWLEDGE_BEGIN */\n#ifdef __EMSCRIPTEN__\n'+code+'\n#endif\n/* AB_KNOWLEDGE_END */\n'

def wrap(value,call):
    return '/* AB_KNOWLEDGE_INLINE_BEGIN */'+call+'/* AB_KNOWLEDGE_INLINE_END */'+value+'/* AB_KNOWLEDGE_INLINE_BEGIN */)/* AB_KNOWLEDGE_INLINE_END */'

def patch(text):
    original=text
    def edit(name,fn):
        nonlocal text
        start,end,body=function(text,name);new=fn(body)
        text=text[:start]+new+text[end:]
    def list_start(body):
        i=body.index('{')+1
        return body[:i]+block(' struct ab_knowledge_shape_list ab_shape = {0};')+body[i:]
    def list_finish(body,key):
        needle='textblock_append(tb, ".\\n");'
        assert body.count(needle)==1
        return body.replace(needle,needle+block(' ab_knowledge_shape_list_emit(&ab_shape,"'+PREFIX+key+'");'))
    def numeric(body,skill=False,property=False):
        body=list_start(body)
        if not skill and not property:
            for member,leaf in [('s->to_a','armor'),('s->to_h','hit'),('s->to_d','damage')]:
                needle=', '+member+');';assert body.count(needle)==1
                call='AB_KNOWLEDGE_SHAPE_NUMBER(&ab_shape,"'+PREFIX+'modifier.'+leaf+'",NULL,NULL,'
                body=body.replace(needle,', '+wrap(member,call)+');')
        else:
            value='s->skills[i]' if skill else 's->modifiers[i]'
            slot='skill' if skill else 'property'
            ref='ab_knowledge_shape_skill_id(i)' if skill else 'ab_knowledge_property_id(OBJ_PROPERTY_MOD,i,AB_KNOWLEDGE_NAME)'
            needle=value+',';assert body.count(needle)==1
            body=body.replace(needle,wrap(value,'AB_KNOWLEDGE_SHAPE_NUMBER(&ab_shape,"'+PREFIX+'modifier.'+slot+'","'+slot+'",'+ref+',')+',')
        return list_finish(body,'adds')
    edit('shape_lore_append_basic_combat',numeric)
    edit('shape_lore_append_skills',lambda b:numeric(b,skill=True))
    for name in ['shape_lore_append_non_stat_modifiers','shape_lore_append_stat_modifiers']:
        edit(name,lambda b:numeric(b,property=True))
    def resistance(body):
        i=body.index('{')+1
        body=body[:i]+block(' struct ab_knowledge_shape_list ab_shape_vul={0},ab_shape_res={0},ab_shape_imm={0};')+body[i:]
        for group in ['vul','res','imm']:
            needle=group+'[n'+group+'] = projections[i].name;'
            assert body.count(needle)==1
            body=body.replace(needle,needle+block(' ab_knowledge_shape_list_add(&ab_shape_'+group+',ab_knowledge_element_id(i));'))
        # Each final append follows the corresponding original list call.
        for group,role in [('vul','vulnerability'),('res','resistance'),('imm','immunity')]:
            needle='shape_lore_append_list(tb, '+group+', n'+group+');\n\t\ttextblock_append(tb, ".\\n");'
            if needle not in body:needle=needle.replace('\n','\r\n')
            assert body.count(needle)==1
            body=body.replace(needle,needle+block(' ab_knowledge_shape_list_emit(&ab_shape_'+group+',"'+PREFIX+role+'");'))
        return body
    edit('shape_lore_append_resistances',resistance)
    for name,field,role,kind in [('shape_lore_append_protection_flags','desc','protection','FLAG'),('shape_lore_append_sustains','name','sustains','STAT')]:
        def lexical(body,field=field,role=role,kind=kind):
            body=list_start(body)
            needle='prop->'+field+', &msgs, &nmax, &n);';assert body.count(needle)==1
            body=body.replace(needle,needle+block(' ab_knowledge_shape_list_add(&ab_shape,ab_knowledge_property_id(OBJ_PROPERTY_'+kind+',prop->index,AB_KNOWLEDGE_'+('DESCRIPTION' if field=='desc' else 'NAME')+'));'))
            return list_finish(body,role)
        edit(name,lexical)
    def trigger(body):
        m=next((offset,call) for offset,call in calls(body) if 'triggers the shapechange' in call)
        offset,call=m;end=offset+len(call);assert body[end]==';'
        return body[:end+1]+block(' ab_knowledge_shape_spell(c->cidx,ibook,ispell);')+body[end+1:]
    edit('shape_lore_append_triggering_spells',trigger)
    def introduction(body):
        offset,call=next((offset,call) for offset,call in calls(body) if 'Like all shapes' in call)
        end=offset+len(call);assert body[end]==';'
        return body[:end+1]+block(' ab_domain_info_emit("'+PREFIX+'introduction",NULL,0);')+body[end+1:]
    edit('shape_lore',introduction)
    # The same exact marker normalizer used by root proves independent native bytes.
    restored=re.sub(r'\r?\n/\* AB_KNOWLEDGE_BEGIN \*/\r?\n.*?/\* AB_KNOWLEDGE_END \*/\r?\n','',text,flags=re.S)
    restored=re.sub(r'/\* AB_KNOWLEDGE_INLINE_BEGIN \*/.*?/\* AB_KNOWLEDGE_INLINE_END \*/','',restored,flags=re.S)
    oldrestored=re.sub(r'\r?\n/\* AB_KNOWLEDGE_BEGIN \*/\r?\n.*?/\* AB_KNOWLEDGE_END \*/\r?\n','',original,flags=re.S)
    oldrestored=re.sub(r'/\* AB_KNOWLEDGE_INLINE_BEGIN \*/.*?/\* AB_KNOWLEDGE_INLINE_END \*/','',oldrestored,flags=re.S)
    assert restored==oldrestored
    return text

def main():
    source=SOURCE.read_text('utf8')
    authored=make_input(source)
    (HERE/'shape-prose-input.json').write_text(json.dumps(authored,ensure_ascii=False,indent=2)+'\n','utf8')
    before=CURRENT.read_bytes();assert hashlib.sha256(before).hexdigest()==EXPECTED,'CAS changed; reread and coordinate'
    # Preserve the current line-ending convention and every other owner's bytes.
    after=patch(before.decode('utf8')).encode('utf8')
    assert CURRENT.read_bytes()==before,'CAS changed during preparation'
    CURRENT.write_bytes(after)
    proof={'schema_version':1,'upstream_commit':authored['upstream_commit'],'runtime_integrated':False,
        'source_integrated':True,'before_sha256':hashlib.sha256(before).hexdigest(),'after_sha256':hashlib.sha256(after).hexdigest(),
        'native_byte_reconstruction':True,'entries':25,'source_functions':authored['source_functions'],
        'notes':'Removing only new AB_KNOWLEDGE blocks/inline markers exactly restores the supplied multi-owner source. Eight list/trigger functions and introduction; change-effects and misc-flag owners unchanged.'}
    (HERE/'shape-prose-integration-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n','utf8')
    print(json.dumps({'shape_entries':25,'spell_bindings':163,'native_bytes_exact':True,'after_sha256':proof['after_sha256']}))

if __name__=='__main__':main()
