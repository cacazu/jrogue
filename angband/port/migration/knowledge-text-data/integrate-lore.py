"""Pinned callsite annotations: preserve every native argument and branch once."""
from pathlib import Path
import json,re,hashlib
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
P=ROOT/'logic/mon-lore.c'
raw=P.read_bytes();s=raw.decode()
block_pattern=r'\r?\n/\* AB_KNOWLEDGE_BEGIN \*/\r?\n.*?/\* AB_KNOWLEDGE_END \*/\r?\n'
s=re.sub(block_pattern,'',s,flags=re.S)
assert 'AB_KNOWLEDGE_INLINE_BEGIN' not in s,'already integrated'
baseline=s.encode()
assert baseline==(HERE/'integration-baseline/mon-lore.c').read_bytes()
data=json.loads((HERE/'lore-prose-input.json').read_text('utf-8'))
def annotation(code):return '/* AB_KNOWLEDGE_INLINE_BEGIN */'+code+'/* AB_KNOWLEDGE_INLINE_END */'
def capture(code):return annotation('AB_KNOWLEDGE_CAPTURE('+code+'), ')
def wrap(text,macro):return annotation(macro+'(')+text+annotation(')')
def block(code):return '\n/* AB_KNOWLEDGE_BEGIN */\n'+code+'\n/* AB_KNOWLEDGE_END */\n'
def replace(a,b):
 global s
 if '\n' in a and a.replace('\n','\r\n') in s:a,b=a.replace('\n','\r\n'),b.replace('\n','\r\n')
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
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
M='angband.knowledge.lore.lexeme.morphology.'
Q='angband.knowledge.lore.lexeme.projection.'
def ref(param,entry):
 expr=param['original_argument'];name=json.dumps(param['name'])
 if param['type']=='integer':return 'AB_KNOWLEDGE_INT('+name+','
 if expr.startswith('lore_pronoun_'):
  possessive='possessive' in expr;title='true' in expr
  return 'AB_KNOWLEDGE_TEXT('+name+',ab_knowledge_pronoun_id(msex,'+str(possessive).lower()+','+str(title).lower()+'),'
 if expr=='initial_pronoun':return 'AB_KNOWLEDGE_TEXT('+name+',ab_knowledge_pronoun_id(msex,false,true),'
 if expr.startswith('describe_race_flag('):return 'AB_KNOWLEDGE_TEXT('+name+',ab_knowledge_race_flag_id('+expr[19:-1]+'),'
 if expr.startswith('lore_describe_speed('):return 'AB_KNOWLEDGE_SELECTED('+name+','
 if expr=='aware':return 'AB_KNOWLEDGE_TEXT('+name+',ab_knowledge_last_lexeme(),'
 if expr=='race->text':return 'AB_KNOWLEDGE_TEXT('+name+',ab_knowledge_monster_description_id(race),'
 if expr in ['effect_str','race->blow[i].method->desc'] or expr.startswith('mon_spell_lore_description('):return 'AB_KNOWLEDGE_COMBAT('+name+','
 if expr=='buf':return 'AB_KNOWLEDGE_PREPARED('+name+',false,'
 if expr=='start':return 'AB_KNOWLEDGE_PREPARED('+name+',true,'
 if expr in ['ordinal','article']:return 'AB_KNOWLEDGE_TEXT('+name+',ab_knowledge_morphology_id('+str(expr=='article').lower()+'),'
 if expr.startswith('PLURAL('):
  n=expr[len('PLURAL('):-1];id='(('+n+')==1?"'+M+'singular":"'+M+'plural")'
 elif expr.startswith('VERB_AGREEMENT('):
  words=['remains','remain'] if '"remains"' in expr else ['has','have'];id='(lore->deaths==1?"'+M+words[0]+'":"'+M+words[1]+'")'
 elif expr=='conjunction':id='(ab_knowledge_caller_is_alternative()?"'+M+'or":"'+M+'and")'
 elif expr=='end':id='(ab_knowledge_caller_has_end()?"'+Q+'clause_sentence_end":"'+Q+'clause_continues")'
 else:raise AssertionError(('unreviewed argument',entry['id'],expr))
 return 'AB_KNOWLEDGE_TEXT('+name+','+id+','
cursor=0;connections=[]
for entry in data['entries']:
 call=entry['original_call'];pos=s.find(call,cursor)
 assert pos>=0,('missing exact call',entry['source']['line'],call)
 rr=ranges(call);changes=[]
 for param in entry['parameters']:
  expr=param['original_argument']
  candidates=[(a,b)for a,b in rr if call[a:b].strip()==expr]
  used={a for a,_,_ in changes};candidates=[(a,b)for a,b in candidates if a not in used]
  assert candidates,(entry['id'],expr)
  a,b=candidates[0];piece=call[a:b];leading=piece[:len(piece)-len(piece.lstrip())];trailing=piece[len(piece.rstrip()):]
  changes.append((a,b,leading+annotation(ref(param,entry))+expr+annotation(')')+trailing))
 if entry['original_call'].startswith('textblock_append_c('):
  a,b=rr[1];piece=call[a:b];leading=piece[:len(piece)-len(piece.lstrip())];trailing=piece[len(piece.rstrip()):]
  changes.append((a,b,leading+wrap(piece.strip(),'AB_KNOWLEDGE_COLOR')+trailing))
 changed=call
 for a,b,v in sorted(changes,reverse=True):changed=changed[:a]+v+changed[b:]
 code='ab_knowledge_part_begin('+','.join(json.dumps(entry[k])for k in ['section','role','id'])+')'
 changed=capture(code)+changed+annotation(', AB_KNOWLEDGE_CAPTURE(ab_knowledge_part_end())')
 s=s[:pos]+changed+s[pos+len(call):];cursor=pos+len(changed)
 connections.append({'id':entry['id'],'source':entry['source'],'original_call':call,'parameter_count':len(entry['parameters'])})
# Getter branch identity is selected at the original return, not reclassified.
for fn,kind in [('lore_describe_speed','speed'),('lore_describe_awareness','awareness')]:
 start=s.index('static const char *'+fn+'(');end=start+re.search(r'\r?\n}',s[start:]).end();part=s[start:end]
 lex=[r for r in data['lexemes'] if r['section']=='lexeme.'+kind]
 ids=[r['id']for r in lex if not r['identity']['fallback']]
 table='static const char *const ab_ids[]={'+','.join(json.dumps(i)for i in ids)+'};'
 part=part.replace('return current->description;', 'return '+wrap('current->description','AB_KNOWLEDGE_SELECT(ab_ids[current-'+('lore_speed_description' if kind=='speed' else 'lore_awareness_description')+'],')+';')
 # wrap helper macro already includes an opening parenthesis; this expression needs a comma tail.
 part=part.replace('AB_KNOWLEDGE_SELECT(ab_ids[current-'+('lore_speed_description' if kind=='speed' else 'lore_awareness_description')+'],(', 'AB_KNOWLEDGE_SELECT(ab_ids[current-'+('lore_speed_description' if kind=='speed' else 'lore_awareness_description')+'],')
 fallback=next(r for r in lex if r['identity']['fallback']);original='return '+json.dumps(fallback['english'])+';'
 part=part.replace(original,'return '+annotation('AB_KNOWLEDGE_SELECT('+json.dumps(fallback['id'])+',')+json.dumps(fallback['english'])+annotation(')')+';')
 # Private table is declared inside the function, before the native table.
 opening=part.index('{')+1;part=part[:opening]+block('#ifdef __EMSCRIPTEN__\n'+table+'\n#endif')+part[opening:]
 s=s[:start]+part+s[end:]
for rule in data['whole_statements']:
 if rule['section']!='clause_start':continue
 line=rule['source']['line'];native=(HERE/'producer-snapshots/mon-lore.c').read_text('utf-8').splitlines()[line-1].strip()
 # Native source assignment can span several lines; match its first function token and source printf.
 at=s.find(native)
 if at<0:continue
 s=s[:at]+capture('ab_knowledge_prepare_start('+json.dumps(rule['id'])+',msex,'+str(bool(rule['parameters'])).lower()+')')+s[at:]
# Record numeric policy at each existing native formatting branch.
number_rules=[('%d.%dx','int_mul, dec_mul','normal_factor','dec_mul','"tenths"'),('%dx','int_mul','player_factor_integer','0','NULL'),('%d.%dx','int_mul, dec_mul / 10','player_factor_tenths','dec_mul / 10','"tenths"'),('%d.%02dx','int_mul, dec_mul','player_factor_hundredths','dec_mul','"hundredths"')]
for fmt,args,role,fraction,slot in number_rules:
 call='strnfmt(buf, sizeof(buf), "'+fmt+'", '+args+');'
 replace(call,capture('ab_knowledge_prepare_number("angband.knowledge.lore.statement.speed_multiplier.'+role+'",int_mul,'+fraction+','+slot+')')+call)
# XP's exact original fractional branch is captured separately from its printed buffer.
call='strnfmt(buf, sizeof(buf), "%ld", exp_integer);'
replace(call,capture('ab_knowledge_prepare_number("angband.knowledge.lore.statement.experience.integer_value",(int)exp_integer,0,NULL)')+call)
call='my_strcat(buf, format(".%02ld", exp_fraction), sizeof(buf));'
replace(call,capture('ab_knowledge_prepare_number("angband.knowledge.lore.statement.experience.hundredths_value",(int)exp_integer,(int)exp_fraction,"hundredths")')+call)
for kind,values in [('article',['a','an']),('ordinal',['th','st','nd','rd'])]:
 for value in values:
  call=kind+' = "'+value+'";';role=kind+'_'+value
  replace(call,capture('ab_knowledge_morphology_select('+str(kind=='article').lower()+',"'+M+role+'")')+call)
# Preserve actual native call count/order; disclose only selected caller grammar.
clause_roles=['alter','detection','vulnerability','resistance','nonresistance','effect_immunity']
spell_roles=['innate','breath','magic']
for fn,roles in [('lore_append_clause',clause_roles),('lore_append_spell_clause',spell_roles)]:
 matches=list(re.finditer(r'(?m)^\t'+fn+r'\(tb,',s))
 # Spell calls within branches are indented two tabs.
 if fn=='lore_append_spell_clause':matches=list(re.finditer(r'(?m)^\t\t'+fn+r'\(tb,',s))
 assert len(matches)==len(roles),(fn,len(matches))
 for match,role in reversed(list(zip(matches,roles))):
  at=match.end()-len(fn+'(tb,');s=s[:at]+capture('ab_knowledge_section_caller("'+role+'")')+s[at:]
functions={'kills':'lore_append_kills','flavor':'lore_append_flavor','movement':'lore_append_movement','toughness':'lore_append_toughness','experience':'lore_append_exp','drop':'lore_append_drop','abilities':'lore_append_abilities','awareness':'lore_append_awareness','friends':'lore_append_friends','spells':'lore_append_spells','attacks':'lore_append_attack'}
for section,fn in functions.items():
 start=s.index('void '+fn+'(');body=s.index('{',start);end=body+re.search(r'\r?\n}',s[body:]).end()-1
 part=s[body:end]
 part=re.sub(r'\breturn;',lambda m:annotation('{ AB_KNOWLEDGE_CAPTURE(ab_knowledge_section_end()); ')+m.group(0)+annotation(' }'),part)
 part=part[:1]+block('#ifdef __EMSCRIPTEN__\nab_knowledge_section_begin("'+section+'");\n#endif')+part[1:]
 part+=block('#ifdef __EMSCRIPTEN__\nab_knowledge_section_end();\n#endif')
 s=s[:body]+part+s[end:]
s=block('#include "web-knowledge-text.h"')+s
normalized=re.sub(block_pattern,'',s,flags=re.S)
normalized=re.sub(r'/\* AB_KNOWLEDGE_INLINE_BEGIN \*/.*?/\* AB_KNOWLEDGE_INLINE_END \*/','',normalized,flags=re.S)
assert normalized.encode()==baseline,'native byte proof'
assert P.read_bytes()==raw,'concurrent mutation'
P.write_bytes(s.encode())
proof={'schema_version':1,'source':'logic/mon-lore.c','native_byte_exact':True,'baseline_sha256':hashlib.sha256(baseline).hexdigest(),'source_sha256':hashlib.sha256(P.read_bytes()).hexdigest(),'append_connections':connections,'append_count':len(connections)}
(HERE/'lore-integration-proof.json').write_text(json.dumps(proof,indent=2)+'\n','utf-8')
print('lore native byte proof passed; '+str(len(connections))+' selected append sites')
