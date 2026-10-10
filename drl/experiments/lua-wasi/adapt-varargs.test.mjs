import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rewriteLuaVarargs,adaptLuaLibrary} from './adapt-varargs.mjs';
test('preserves positional order and nested calls',()=>{const r=rewriteLuaVarargs("luaL_error(L, '%s %d', lua_tolstring(L, 1, nil), i);");assert.equal(r.rewritten_calls,1);assert.equal(r.source,"luaL_error(L, '%s %d', [lua_tolstring(L, 1, nil), i]);");});
test('skips comments, literal examples and declarations',()=>{const s="// luaL_error(L, 'x')\n(* lua_pushfstring(L,'y') *)\nfunction luaL_error(L:Pointer;fmt:PChar):Integer;varargs;cdecl;external;\ns:='luaL_error(L,''x'')';";assert.equal(rewriteLuaVarargs(s).source,s);});
test('zero arguments and existing packed call are idempotent',()=>{const r=rewriteLuaVarargs("luaL_error(L,'error');lua_pushfstring(L,'%d',[7]);");assert.equal(r.source,"luaL_error(L, 'error', []);lua_pushfstring(L,'%d',[7]);");assert.equal(rewriteLuaVarargs(r.source).rewritten_calls,0);});
test('nested target calls rewrite once each',()=>{const r=rewriteLuaVarargs("luaL_error(L,lua_pushfstring(L,'%s','x'));" );assert.equal(r.rewritten_calls,2);assert.equal(r.source,"luaL_error(L, lua_pushfstring(L, '%s', ['x']), []);");});
test('Pascal packed wrappers retain the Pascal open-array calling convention',()=>{
  const fixture='uses Classes, SysUtils, vlibrary;\nfunction luaL_error(L:Pointer;fmt:PChar):Integer;varargs;calldecl;external;\nfunction lua_pushfstring(L:Pointer;fmt:PChar):PChar;varargs;calldecl;external;\nfunction lua_close(L:Pointer):Integer;calldecl;external;\nimplementation';
  const adapted=adaptLuaLibrary(fixture);
  assert.equal((adapted.match(/const args : array of const/g)??[]).length,4);
  assert.doesNotMatch(adapted,/array of const\)[^\n]*calldecl/);
  assert.match(adapted,/lua_close\(L:Pointer\):Integer;calldecl;external/);
});
