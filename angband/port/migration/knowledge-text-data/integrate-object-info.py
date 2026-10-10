"""Add pure selected-branch annotations while preserving native source bytes."""
from pathlib import Path
import re, hashlib, json
ROOT = Path(__file__).resolve().parents[2]
P = ROOT / 'logic/obj-info.c'
raw = P.read_bytes()
s = raw.decode('utf-8')
assert 'AB_KNOWLEDGE_' not in s, 'already integrated'
(ROOT/'migration/knowledge-text-data/integration-baseline/obj-info.c').write_bytes(raw)

def block(code):
    return '\n/* AB_KNOWLEDGE_BEGIN */\n#ifdef __EMSCRIPTEN__\n'+code+'\n#endif\n/* AB_KNOWLEDGE_END */\n'

def inline(code):
    return '/* AB_KNOWLEDGE_INLINE_BEGIN */AB_KNOWLEDGE_CAPTURE('+code+'), /* AB_KNOWLEDGE_INLINE_END */'

def changed(text, a, b):
    if '\n' in a and a.replace('\n','\r\n') in text:
        a, b = a.replace('\n','\r\n'), b.replace('\n','\r\n')
    assert text.count(a)==1, (a,text.count(a))
    return text.replace(a,b)

def replace(a,b):
    global s
    s=changed(s,a,b)

replace('#include "z-textblock.h"','#include "z-textblock.h"'+block('#include "web-knowledge-text.h"'))
replace('int i, count = 0;\n\n\tfor (i = 0; i < ELEM_MAX; i++) {','int i, count = 0;'+block('ab_knowledge_list_begin();')+'\n\n\tfor (i = 0; i < ELEM_MAX; i++) {')
replace('recepticle[count++] = projections[i].name;',inline('ab_knowledge_list_add(ab_knowledge_element_id(i))')+'recepticle[count++] = projections[i].name;')
replace('textblock_append_c(tb, attr, "%+i %s.\\n", val, desc);',inline('ab_knowledge_info_modifier((int)i,val,true)')+'textblock_append_c(tb, attr, "%+i %s.\\n", val, desc);')
replace('textblock_append(tb, "Affects your %s\\n", desc);',inline('ab_knowledge_info_modifier((int)i,val,false)')+'textblock_append(tb, "Affects your %s\\n", desc);')
for role,call in [('immunity','info_out_list(tb, i_descs, count);'),('resistance','info_out_list(tb, r_descs, count);'),('vulnerability','info_out_list(tb, v_descs, count);'),('protection','info_out_list(tb, p_descs, count);')]:
    replace(call,inline('ab_knowledge_list_emit("'+role+'")')+call)
replace('/* Protections */\n\tfor','/* Protections */'+block('ab_knowledge_list_begin();')+'\n\tfor')
replace('p_descs[count++] = prop->desc;',inline('ab_knowledge_list_add(ab_knowledge_property_id(OBJ_PROPERTY_FLAG,prop->index,AB_KNOWLEDGE_DESCRIPTION))')+'p_descs[count++] = prop->desc;')
for fn,role in [('describe_ignores','ignores'),('describe_hates','hates'),('describe_sustains','sustains')]:
    start=s.index('static bool '+fn+'(')
    end=start+re.search(r'\r?\n}\r?\n',s[start:]).end()
    part=s[start:end]
    part=changed(part,'info_out_list(tb, descs, count);',inline('ab_knowledge_list_emit("'+role+'")')+'info_out_list(tb, descs, count);')
    if role=='sustains':
        part=changed(part,'\n\tfor (i = 0; i < STAT_MAX;',block('ab_knowledge_list_begin();')+'\n\tfor (i = 0; i < STAT_MAX;')
        part=changed(part,'descs[count++] = prop->name;',inline('ab_knowledge_list_add(ab_knowledge_property_id(OBJ_PROPERTY_STAT,prop->index,AB_KNOWLEDGE_NAME))')+'descs[count++] = prop->name;')
    s=s[:start]+part+s[end:]
replace('textblock_append(tb, "%s.  ", prop->desc);',inline('ab_knowledge_info_property(OBJ_PROPERTY_FLAG,prop->index)')+'textblock_append(tb, "%s.  ", prop->desc);')
for fn,role,noun in [('describe_slays','slay','Slays '),('describe_brands','brand','Branded with ')]:
    start=s.index('static bool '+fn+'(')
    end=start+re.search(r'\r?\n}\r?\n',s[start:]).end()
    part=s[start:end]
    call='if (!'+('s' if role=='slay' else 'b')+') return false;'
    part=changed(part,call,call+block('ab_knowledge_list_begin();'))
    call='textblock_append(tb, "'+noun+'");'
    part=changed(part,call,inline('ab_knowledge_list_role("'+role+'.weapon")')+call)
    call='textblock_append(tb, "'+('It causes your melee attacks to slay ' if role=='slay' else 'It brands your melee attacks with ')+'");'
    part=changed(part,call,inline('ab_knowledge_list_role("'+role+'.melee")')+call)
    call='textblock_append(tb, "%s", '+('slays' if role=='slay' else 'brands')+'[i].name);'
    getter='ab_knowledge_slay_id(i,0)' if role=='slay' else 'ab_knowledge_brand_id(i,false)'
    part=changed(part,call,inline('ab_knowledge_list_add('+getter+')')+call)
    call='textblock_append(tb, " (powerfully)");' if role=='slay' else 'textblock_append(tb, "weak ");'
    part=changed(part,call,inline('ab_knowledge_list_'+('powerful' if role=='slay' else 'weak')+'()')+call)
    part=changed(part,'\n\treturn true;',block('ab_knowledge_list_emit(NULL);')+'\n\treturn true;')
    s=s[:start]+part+s[end:]
assert P.read_bytes()==raw,'concurrent mutation'
normalized=re.sub(r'\r?\n/\* AB_KNOWLEDGE_BEGIN \*/\r?\n.*?/\* AB_KNOWLEDGE_END \*/\r?\n','',s,flags=re.S)
normalized=re.sub(r'/\* AB_KNOWLEDGE_INLINE_BEGIN \*/.*?/\* AB_KNOWLEDGE_INLINE_END \*/','',normalized,flags=re.S)
if normalized.encode()!=raw:
    import difflib
    print(''.join(list(difflib.unified_diff(raw.decode().splitlines(keepends=True),normalized.splitlines(keepends=True)))[:40]))
    assert False,'native parity'
P.write_bytes(s.encode())
proof={'schema_version':1,'source':'logic/obj-info.c','baseline':'migration/knowledge-text-data/integration-baseline/obj-info.c',
    'before_sha256':hashlib.sha256(raw).hexdigest(),'after_sha256':hashlib.sha256(P.read_bytes()).hexdigest(),
    'reconstructed_sha256':hashlib.sha256(normalized.encode()).hexdigest(),'byte_exact':True,
    'block_count':s.count('/* AB_KNOWLEDGE_BEGIN */'),'inline_count':s.count('/* AB_KNOWLEDGE_INLINE_BEGIN */')}
(ROOT/'migration/knowledge-text-data/obj-info-native-parity.json').write_text(json.dumps(proof,indent=2)+'\n','utf-8')
print(json.dumps(proof))
