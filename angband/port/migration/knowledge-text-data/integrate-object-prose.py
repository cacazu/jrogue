"""CAS additive annotations for selected object-info prose, with byte proof."""
from pathlib import Path
import json,re,hashlib
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
P=ROOT/'logic/obj-info.c'
BLOCK=r'\r?\n/\* AB_KNOWLEDGE_BEGIN \*/\r?\n.*?/\* AB_KNOWLEDGE_END \*/\r?\n'
INLINE=r'/\* AB_KNOWLEDGE_INLINE_BEGIN \*/.*?/\* AB_KNOWLEDGE_INLINE_END \*/'
def native(value):return re.sub(INLINE,'',re.sub(BLOCK,'',value,flags=re.S),flags=re.S)
def annotation(code):return '/* AB_KNOWLEDGE_INLINE_BEGIN */'+code+'/* AB_KNOWLEDGE_INLINE_END */'
def capture(code):return annotation('AB_KNOWLEDGE_CAPTURE('+code+'), ')
def block(code):return '\n/* AB_KNOWLEDGE_BEGIN */\n'+code+'\n/* AB_KNOWLEDGE_END */\n'
def ranges(call):
 start=call.index('(')+1;out=[];depth=0;quoted=False;escape=False;last=start
 for i in range(start,len(call)-1):
  c=call[i]
  if quoted:
   if escape:escape=False
   elif c=='\\':escape=True
   elif c=='"':quoted=False
  elif c=='"':quoted=True
  elif c=='(':depth+=1
  elif c==')':depth-=1
  elif c==',' and depth==0:out.append((last,i));last=i+1
 out.append((last,len(call)-1));return out

def main():
 data=json.loads((HERE/'object-prose-input.json').read_text('utf-8'))
 raw=P.read_bytes();source=raw.decode();baseline=native(source)
 assert baseline.encode()==(HERE/'integration-baseline/obj-info.c').read_bytes(),'foreign annotation change: refresh coordinated baseline first'
 assert 'ab_knowledge_object_section_begin' not in source,'already applied'
 prefix='angband.knowledge.object_info.lexeme.'
 sections={'object_blows','object_damage','object_digging','object_recharge','object_origin'}
 skip={'object_effect.statement_end','object_light.line_end','object_layout.properties_section_end','object_layout.effect_section_end','object_layout.combat_section_end'}
 ops={};connections=[]
 def plan(line,call,rule,params,begin,end,part):
  assert line not in ops,('overlap',line)
  ops[line]=(call,rule,params,begin,end,part)
 for rule in data['whole_statements']:
  if not rule.get('direct_statement'):continue
  for i,call in enumerate(rule['original_calls']):
   params=[p for p in rule['parameters']if p.get('argument_call',0)==i]
   plan(call['line'],call['call'],rule,params,i==0,i==len(rule['original_calls'])-1,False)
 for rule in data['entries']:
  if rule['section']+'.'+rule['role'] in skip:continue
  part=rule['section']in sections and not(rule['section']=='object_recharge' and rule['role']=='success_chance')
  calls=[{'source':rule['source'],'original_call':rule['original_call']}]+rule.get('additional_sources',[])
  for call in calls:
   line=call['source']['line']
   if line in ops:continue
   plan(line,call['original_call'],rule,rule['parameters'],not part,not part,part)
 def ref(param,rule):
  name=json.dumps(param['name']);expr=param['original_argument'];kind=param['type']
  if kind=='integer':return 'AB_KNOWLEDGE_INT('+name+','
  if expr=='lastnm':id='ab_knowledge_object_target_id()'
  elif expr=='names[i]':id='ab_knowledge_digging_terrain_id(i)'
  elif expr=='(blow_info[0].centiblows > 100) ? "s" : ""':id='(blow_info[0].centiblows>100?"'+prefix+'plural.plural":"'+prefix+'plural.singular")'
  elif expr=='deciturns[i] == 10 ? "" : "s"':id='(deciturns[i]==10?"'+prefix+'plural.singular":"'+prefix+'plural.plural")'
  elif expr=='(i == 3) ? ".\\n" : ", "':id='(i==3?"'+prefix+'ending.period":"'+prefix+'ending.comma")'
  elif expr=='(nsort == 1) ? " and " : ", and "':id='(nsort==1?"'+prefix+'conjunction.and":"'+prefix+'conjunction.oxford_and")'
  elif expr=='origins[origin].desc':return 'AB_KNOWLEDGE_ORIGIN('+name+',origin,'+{'origin_without_place':'0','origin_with_place':'1','origin_with_dropper_and_place':'2'}[rule['role']]+',unique,comma,'
  else:raise AssertionError(('unreviewed text argument',rule['id'],expr))
  return 'AB_KNOWLEDGE_TEXT('+name+','+id+','
 cursor=0
 for line,(call,rule,params,begin,end,part)in sorted(ops.items()):
  if call not in source[cursor:]:call=call.replace('\r\n','\n')
  pos=source.find(call,cursor);assert pos>=0,('missing source call',line,call)
  rr=ranges(call);changes=[]
  for param in params:
   expr=param['original_argument'];candidates=[(a,b)for a,b in rr if call[a:b].strip()==expr]
   assert candidates,(line,expr);a,b=candidates[0];piece=call[a:b];leading=piece[:len(piece)-len(piece.lstrip())];trailing=piece[len(piece.rstrip()):]
   changes.append((a,b,leading+annotation(ref(param,rule))+expr+annotation(')')+trailing))
  if part and call.startswith('textblock_append_c('):
   a,b=rr[1];piece=call[a:b];leading=piece[:len(piece)-len(piece.lstrip())];trailing=piece[len(piece.rstrip()):]
   changes.append((a,b,leading+annotation('AB_KNOWLEDGE_COLOR(')+piece.strip()+annotation(')')+trailing))
  changed=call
  for a,b,value in sorted(changes,reverse=True):changed=changed[:a]+value+changed[b:]
  if part:
   changed=capture('ab_knowledge_part_begin('+','.join(json.dumps(rule[k])for k in ['section','role','id'])+')')+changed+annotation(', AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())')
  else:
   if begin:changed=capture('ab_knowledge_object_statement_begin('+json.dumps(rule['id'])+')')+changed
   if end:changed+=annotation(', AB_KNOWLEDGE_CAPTURE(ab_knowledge_object_statement_end())')
  if part and rule['section']=='object_origin' and rule['role']!='paragraph_end':changed=capture('ab_knowledge_object_section_begin(\"object_origin\")')+changed
  source=source[:pos]+changed+source[pos+len(call):];cursor=pos+len(changed)
  connections.append({'source_line':line,'id':rule['id'],'original_call':call,'mode':'section_part'if part else 'complete_statement','captured_parameters':params})
 def replace(a,b):
  nonlocal source
  if a not in source and '\n' in a:a,b=a.replace('\n','\r\n'),b.replace('\n','\r\n')
  assert source.count(a)==1,(a,source.count(a));source=source.replace(a,b)
 # Actual selected target producers, before any previous-lastnm printing.
 for native_call,code in [('tgt = brands[sortind[i]].name;','ab_knowledge_object_target_select(ab_knowledge_brand_id(sortind[i],false))'),('tgt = slays[sortind[i] -\n\t\t\t\t\tz_info->brand_max].name;','ab_knowledge_object_target_select(ab_knowledge_slay_id(sortind[i]-z_info->brand_max,0))'),('lastnm = tgt;','ab_knowledge_object_target_commit()')]:replace(native_call,capture(code)+native_call)
 # Origin values are copied in the original producers, not read from completed buffers.
 replace('strnfmt(loot_spot, sizeof(loot_spot), "at %d feet (level %d)",\n\t\t        obj->origin_depth * 50, obj->origin_depth);',capture('ab_knowledge_origin_place(true)')+'strnfmt(loot_spot, sizeof(loot_spot), "at %d feet (level %d)",\n\t\t        '+annotation('AB_KNOWLEDGE_ORIGIN_INT(false,')+'obj->origin_depth * 50'+annotation(')')+', '+annotation('AB_KNOWLEDGE_ORIGIN_INT(true,')+'obj->origin_depth'+annotation(')')+');')
 for call,code in [('my_strcpy(loot_spot, "in town", sizeof(loot_spot));','ab_knowledge_origin_place(false)'),('dropper = obj->origin_race->name;','ab_knowledge_origin_race(ab_naming_monster_name_id(obj->origin_race))'),('dropper = "monster lost to history";','ab_knowledge_origin_race("'+prefix+'origin_dropper.lost_to_history")')]:replace(call,capture(code)+call)
 replace('is_a_vowel(dropper[0])',annotation('AB_KNOWLEDGE_ORIGIN_ARTICLE(')+'is_a_vowel(dropper[0])'+annotation(')'))
 # Five sections are opened only after the original no-output gates/calculations.
 markers={'object_blows':'\t/* First entry is always current blows (+0, +0) */','object_damage':'\t/* Mention slays and brands from other items */','object_digging':'\tfor (i = DIGGING_RUBBLE; i < DIGGING_DOORS; i++) {','object_recharge':'\t\ttextblock_append(tb, "Takes ")','object_origin':'\t/* Print an appropriate description */'}
 for section,marker in markers.items():
  if section=='object_origin':continue
  if section=='object_recharge':
   # Its first call is already annotated: place section begin before the annotation.
   token='ab_knowledge_part_begin("object_recharge","duration_prefix"';idx=source.index(token);idx=source.rfind('/* AB_KNOWLEDGE_INLINE_BEGIN */',0,idx)
   source=source[:idx]+capture('ab_knowledge_object_section_begin("object_recharge")')+source[idx:]
  else:replace(marker,block('#ifdef __EMSCRIPTEN__\nab_knowledge_object_section_begin("'+section+'");\n#endif')+marker)
 # End after the native final append; other sections end before existing normal returns.
 for fn in ['describe_blows','describe_damage','describe_digger','describe_origin']:
  start=source.index('static bool '+fn+'(');end=start+re.search(r'\r?\n}',source[start:]).end();body=source[start:end]
  idx=body.rfind('\treturn true;');assert idx>=0
  body=body[:idx]+block('#ifdef __EMSCRIPTEN__\nab_knowledge_section_end();\n#endif')+body[idx:]
  source=source[:start]+body+source[end:]
 token='ab_knowledge_part_begin("object_recharge","statement_end"';idx=source.index(token);end=source.index('/* AB_KNOWLEDGE_INLINE_END */',source.index('ab_knowledge_part_end()',idx))+len('/* AB_KNOWLEDGE_INLINE_END */')
 source=source[:end]+annotation(', AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_end())')+source[end:]
 assert native(source)==baseline,'native byte restoration'
 assert P.read_bytes()==raw,'concurrent source mutation'
 P.write_bytes(source.encode())
 proof={'schema_version':1,'source':'logic/obj-info.c','source_connected':True,'runtime_integrated':False,'native_byte_exact':True,'original_append_count':119,'connected_remaining_append_count':len(connections),'unemitted_layout_roles':sorted(skip),'connections':connections,'native_sha256':hashlib.sha256(baseline.encode()).hexdigest(),'source_sha256':hashlib.sha256(source.encode()).hexdigest()}
 (HERE/'object-prose-integration-proof.json').write_text(json.dumps(proof,indent=2)+'\n','utf-8')
 print(json.dumps({'native_byte_exact':True,'selected_prose_calls':len(connections)}))
if __name__=='__main__':main()
