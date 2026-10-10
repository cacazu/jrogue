/** Source-backed Lua stack oracle for the original-history callback bridge.
 * No Pascal/Lua compiler, native binary, or game is executed by these checks.
 * The old expression is a negative control for the observed integration defect.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const sha=p=>createHash('sha256').update(readFileSync(new URL(p,root))).digest('hex');
const reader=read('localization/lua-semantic-adapter.pas');
const helper=read('upstream/fpcvalkyrie/src/vluaext.pas');
const table=read('upstream/fpcvalkyrie/src/vluatable.pas');
const expected='He started his journey on the surface of Phobos.';
const old=reader.replace('Value := History.GetValue(Variant(aIndex));',
  'Value := History.GetValue([DWord(aIndex)]);');
function block(source,start,end){
 const a=source.indexOf(start);assert.ok(a>=0,start);
 const b=source.indexOf(end,a+start.length);assert.ok(b>a,end);
 return source.slice(a,b);
}
const raw=block(table,'function TLuaTable.GetValue ( const aKey : Variant )',
 'function TLuaTable.GetValue ( const aPath : Ansistring )');
const path=block(table,'function TLuaTable.GetValue ( const aPath : array of const )',
 'procedure TLuaTable.SetValue ( const aKey : Variant');
const numeric=block(helper,'function vlua_getvarrecfield ( L : PLua_State;',
 'function vlua_tabletovararray');
const getpath=block(helper,'function vlua_getpath ( L : Plua_State; const path : array of const;',
 'procedure vlua_gettableorcreate');
const numericOffset=Number(/lua_gettable\(\s*L,\s*idx(-\d+)\s*\)/.exec(numeric)?.[1]);
const rawIndex=Number(/lua_rawget\(\s*FState,\s*(-\d+)\s*\)/.exec(raw)?.[1]);
assert.equal(numericOffset,-1);assert.equal(rawIndex,-2);
assert.match(getpath,/idx := lua_absindex\( L, idx \)/);
assert.match(getpath,/if lua_isnil\( L, -1 \)[\s\S]*Exit\( False \)/);
assert.match(path,/if not vlua_getpath[\s\S]*raise ELuaException/);
assert.match(raw,/Reset;/);
function lookup(source,args,history,index,size=history.size){
 const body=block(source,'function DRLReadOriginalHistory(',
  'function DRLReadCurrentOriginalHistory(');
 assert.match(body,/aIndex <= 0/);assert.match(body,/aIndex > Int64\(Count\)/);
 assert.match(body,/finally\s+History.Free/);
 const expression=/Value := History.GetValue\(([^;\n]+)\);/.exec(body)?.[1];
 assert.ok(expression==='Variant(aIndex)'||expression==='[DWord(aIndex)]');
 const stack=[...args],clear=stack.length;
 if(index<=0||index>size)return {ok:false,value:'',stack};
 // These are Lua C API stack operations, with their indices extracted above.
 // TLuaTable.Push adds the registered history; numeric path indices become absolute.
 stack.push(history);const absoluteHistory=stack.length;
 stack.push(index);
 const selected=expression==='Variant(aIndex)'?
  stack.length+rawIndex+1:absoluteHistory+numericOffset;
 const candidate=stack[selected-1],key=stack.pop();
 let value,ok=false;
 try{
  assert.ok(candidate instanceof Map,'lookup selected a non-table');
  value=candidate.get(key);
  if(expression==='[DWord(aIndex)]'&&value===undefined)
   throw Error('vlua_getpath returned False; GetValue raised');
  ok=typeof value==='string';
 }catch{value='';}
 finally{stack.length=clear;}
 return {ok,value:ok?value:'',stack};
}
test('history bridge forces scalar raw-key lookup against pinned actual helper contracts',()=>{
 assert.equal(sha('upstream/fpcvalkyrie/src/vluaext.pas'),
  '2889cc6d7bcae827ad5fdb82346644642545d5f5bd99b50c04683f88ce572927');
 assert.equal(sha('upstream/fpcvalkyrie/src/vluatable.pas'),
  'fe6af4c808f3392ce46d08d9426bc71d117c68a89c346676114620c6df3e0205');
 assert.ok(reader.includes('Value := History.GetValue(Variant(aIndex));'));
 assert.ok(!reader.includes('Value := History.GetValue([DWord(aIndex)]);'));
 const m=JSON.parse(read('localization/manifest.json'));
 const p=m.patches.filter(p=>p.file==='src/drlio.pas'&&
  p.original==='function lua_ui_msg(L: Plua_State): Integer; cdecl;');
 assert.equal(p.length,1);
 assert.equal(p[0].replacement,reader+'\n'+p[0].original);
 assert.ok(read('localization/overlay/src/drlio.pas').includes(reader));
});
test('three-argument remember callback reads history, with old empty-param lookup as failing control',()=>{
 const params=new Map(),args=['history.intro.journey',expected,params];
 const history=new Map([[1,expected]]);
 const fixed=lookup(reader,args,history,1),broken=lookup(old,args,history,1);
 assert.equal(fixed.ok,true);assert.equal(fixed.value,expected);
 assert.equal(broken.ok,false);assert.equal(broken.value,'');
 assert.deepEqual(fixed.stack,args);assert.deepEqual(broken.stack,args);
 assert.deepEqual([...history],[[1,expected]]);assert.equal(params.size,0);
});
test('a preceding parameter-table decoy cannot impersonate original history',()=>{
 const params=new Map([[1,'different preceding argument']]);
 const args=['history.intro.journey',expected,params],history=new Map([[1,expected]]);
 assert.equal(lookup(old,args,history,1).value,'different preceding argument');
 assert.equal(lookup(reader,args,history,1).value,expected);
 assert.deepEqual([...params],[[1,'different preceding argument']]);
});
test('zero-argument native save/load validation reads the history and restores the empty stack',()=>{
 const history=new Map([[1,expected]]);
 const fixed=lookup(reader,[],history,1),broken=lookup(old,[],history,1);
 assert.equal(fixed.ok,true);assert.equal(fixed.value,expected);
 assert.equal(broken.ok,false);assert.deepEqual(fixed.stack,[]);
});
test('positive DWord-bounded history indices remain exact and out-of-range reads do not touch stack',()=>{
 const last=0xffffffff,history=new Map([[last,expected]]),args=['sentinel'];
 assert.equal(Number(BigInt(last)),last);
 assert.equal(lookup(reader,args,history,last,last).value,expected);
 for(const index of [0,-1,last+1]){
  const result=lookup(reader,args,history,index,last);
  assert.equal(result.ok,false);assert.deepEqual(result.stack,args);
 }
});
