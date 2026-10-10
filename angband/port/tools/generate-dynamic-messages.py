"""Bind reviewed producers; preserve the native original as the #else branch."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parent.parent
COMMIT='f3082213b73f3e463e3d0d60bff4b00462beae6e'
TAG=re.compile(r'/\* AB_GAME_DYNAMIC_BEGIN \*/[\s\S]*?/\* AB_GAME_DYNAMIC_END \*/')
spec=importlib.util.spec_from_file_location('ab_inventory',ROOT/'inventory/inventory.py')
inventory=importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)
TYPE={'int32':('I','d'),'canonical_key':('K','c'),'opaque_file_path':('F','s'),
      'MonsterDescription':('M','s'),'KnownObjectDescription':('O','s')}

def read(name): return json.loads((ROOT/name).read_text(encoding='utf-8'))
def original_positions(text):
 positions=[];cursor=0
 while cursor<len(text):
  positions.append(cursor);cursor+=2 if text.startswith('\r\n',cursor) else 1
 positions.append(len(text));return positions
def call_span(source,row):
 tokens=[(m.lastgroup,m.group(),m.start(),m.end()) for m in inventory.TOKEN.finditer(source)
         if m.lastgroup not in {'space','comment'}]
 for index,token in enumerate(tokens):
  if token[1]!=row['call'] or index+1>=len(tokens) or tokens[index+1][1]!='(': continue
  depth=0
  for end in range(index+1,len(tokens)):
   if tokens[end][1]=='(': depth+=1
   elif tokens[end][1]==')':
    depth-=1
    if not depth:
     if token[2]<=row['offset'] and tokens[end][3]>=row['offset_end']:
      if tokens[end+1][1]!=';': raise ValueError('message is not a standalone producer')
      return token[2],tokens[end+1][3]
     break
 raise ValueError('missing reviewed call '+repr(row))

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');parser.add_argument('--repair',action='store_true');args=parser.parse_args()
 original=read('migration/message-data/dynamic-arguments.json')
 reviewed=read('migration/message-data/dynamic-review.json')
 assert reviewed['reviewed'] and reviewed['upstream_commit']==COMMIT
 entries={}; bindings={};selected=set()
 for review in reviewed['entries']:
  index=review['source_index'];assert index not in selected;selected.add(index)
  row=original[index];parameters=[{'name':n,'type':t} for n,t in review['parameters']]
  formats=[m for m in inventory.FORMAT.finditer(row['text']) if m[6]!='%']
  assert len(formats)==len(parameters)==len(row['arguments'])-row['argument_index']-1
  schema='';english='';position=0
  for fmt,parameter in zip(formats,parameters):
   code,conversion=TYPE[parameter['type']]
   assert fmt.group()==('%'+conversion),row
   english+=row['text'][position:fmt.start()]+ '{'+parameter['name']+'}'
   position=fmt.end();schema+=parameter['name']+':'+code+';'
  english+=row['text'][position:];english=english.replace('%%','%')
  semantic='game.message.'+inventory.slug(Path(row['path']).stem)+'.'+inventory.slug(row['function'])+'.'+inventory.slug(english)
  assert len(semantic)<=127
  source={'file':'logic/'+Path(row['path']).name,'function':row['function'],'upstreamLine':row['line'],
          'call':row['call'],'source_index':index,'upstreamSha256':row['upstream_file_sha256'],
          'originalEnglish':row['text'],'originalArguments':row['arguments'],'descriptor_buffer_policy':'Immediately existing native descriptor buffer, reviewed producer only; missing cache is explicit.'}
  if semantic in entries:
   assert entries[semantic]['english']==english and entries[semantic]['japanese']==review['japanese'] and entries[semantic]['parameters']==parameters, (index,semantic,entries[semantic],english,review)
  else: entries[semantic]={'id':semantic,'english':english,'japanese':review['japanese'],'parameters':parameters,'role':'owned_dynamic_message','sources':[]}
  entries[semantic]['sources'].append(source)
  key=(Path(row['path']).name,row['function'],row['call'],row['text'])
  if key in bindings: assert bindings[key]==(semantic,schema)
  bindings[key]=(semantic,schema)
 changes=[]
 snapshot=ROOT/'tests/dynamic-message-source-snapshot';snapshot.mkdir(exist_ok=True)
 previous=read('migration/message-data/dynamic-manifest.json') if (ROOT/'migration/message-data/dynamic-manifest.json').exists() else None
 prior={r['file']:r for r in previous['integration']['applied']} if previous else {}
 for name in sorted({key[0] for key in bindings}):
  filename=ROOT/'logic'/name;native=filename.read_bytes();source=native.decode('utf-8')
  if TAG.search(source) and not args.repair:
   assert name in prior,'missing retained baseline';changes.append(prior[name]);continue
  if args.repair:source=TAG.sub('',source);native=source.encode('utf-8')
  normalized=source.replace('\r\n','\n');positions=original_positions(source)
  if args.repair:
   lexical_input=ROOT/'tests/dynamic-repair-input.c';lexical_input.write_bytes(native)
   rows,_=inventory.c_inventory(lexical_input,ROOT);lexical_input.unlink()
  else:rows,_=inventory.c_inventory(filename,ROOT)
  edits=[];matches=[]
  for row in rows:
   key=(name,row['function'],row['call'],row['text'])
   if key not in bindings or row['argument_index']!=(0 if row['call']=='msg' else 1):continue
   start,end=call_span(normalized,row)
   # Byte-preserving offsets also cover mixed CRLF/LF source additions.
   start,end=positions[start],positions[end]
   semantic,schema=bindings[key];call=source[start:end]
   rendered=re.sub(r'^'+row['call']+r'\s*\(',('ab_dynamic_msg' if row['call']=='msg' else 'ab_dynamic_msgt')+'("'+semantic+'", "'+schema+'", ',call,count=1)
   assert rendered!=call and re.match(r'msgt?\s*\(',call),(name,semantic)
   nl='\r\n' if '\r\n' in source else '\n'
   prefix='/* AB_GAME_DYNAMIC_BEGIN */'+nl+'#ifdef __EMSCRIPTEN__'+nl+rendered+nl+'#else'+nl+'/* AB_GAME_DYNAMIC_END */'
   suffix='/* AB_GAME_DYNAMIC_BEGIN */'+nl+'#endif'+nl+'/* AB_GAME_DYNAMIC_END */'
   edits.extend([(start,prefix),(end,suffix)])
   matches.append({'id':semantic,'schema':schema,'function':row['function'],'sourceLineBefore':row['line'],'call':row['call']})
  assert len(matches)==sum(Path(original[i]['path']).name==name for i in selected),(name,len(matches))
  for offset,addition in sorted(edits,reverse=True):source=source[:offset]+addition+source[offset:]
  nl='\r\n' if '\r\n' in source else '\n'
  source='/* AB_GAME_DYNAMIC_BEGIN */'+nl+'#include "web-dynamic-text.h"'+nl+'/* AB_GAME_DYNAMIC_END */'+source
  assert TAG.sub('',source).encode('utf-8')==native,name
  baseline=snapshot/name
  sha=hashlib.sha256(baseline.read_bytes() if args.repair and baseline.exists() else native).hexdigest()
  if args.apply:
   if not args.repair or not baseline.exists():baseline.write_bytes(native)
   filename.write_bytes(source.encode('utf-8'))
  changes.append({'file':name,'baselineSha256':sha,'bindings':matches,'sourceApplied':args.apply})
 manifest={'schema_version':1,'upstream_commit':COMMIT,'reviewed':True,'complete_game_translation':False,'status':'source_connected_unbuilt',
           'entries':sorted(entries.values(),key=lambda r:r['id']),
           'integration':{'applied':changes,'selectedCallsites':len(selected),'remainingLiteralCallsites':len(original)-len(selected),'engineBuilt':False}}
 (ROOT/'migration/message-data/dynamic-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'ids':len(entries),'calls':len(selected),'files':len(changes),'engineBuilt':False}))
if __name__=='__main__':main()
