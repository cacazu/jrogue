/* Authored DRL Lua ABI probe. Original interpreter is linked without game data. */
#include <stdio.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include "lua.h"
#include "lauxlib.h"
#include "lualib.h"
_Static_assert(sizeof(void*) == 4, "wasm32 pointers");
_Static_assert(sizeof(lua_Integer) == 8, "Pascal Int64");
_Static_assert(sizeof(lua_Number) == 8, "Pascal Double");
_Static_assert(sizeof(lua_Debug) == 100, "Corrected Pascal debug layout");
_Static_assert(offsetof(lua_Debug,lastlinedefined) == 32, "debug last line offset");
_Static_assert(offsetof(lua_Debug,short_src) == 36, "debug short source offset");
_Static_assert(offsetof(lua_Debug,i_ci) == 96, "debug private field offset");
_Static_assert(LUAL_BUFFERSIZE == 1024, "Pascal buffer constant");
_Static_assert(sizeof(luaL_Buffer) == 1036, "Pascal auxiliary buffer layout");
static int calls;
static int host_double(lua_State *L) {
  lua_pushinteger(L,luaL_checkinteger(L,1)*2);
  calls++;
  return 1;
}
static int host_error(lua_State *L) { return luaL_error(L,"callback failure %d",17); }
static int eval(lua_State *L,const char *s) {
  if(luaL_loadstring(L,s) || lua_pcall(L,0,LUA_MULTRET,0)) {
    fprintf(stderr,"unexpected lua error: %s\n",lua_tostring(L,-1));return 1;
  }
  return 0;
}
int main(void) {
  lua_State *L=luaL_newstate(); if(!L)return 2;
  luaL_openlibs(L);
  lua_register(L,"host_double",host_double);
  lua_register(L,"host_error",host_error);
  if(eval(L,"assert(_VERSION=='Lua 5.1'); assert(host_double(3000000000)==6000000000); local r=0; for i=1,100 do r=r+i end; assert(r==5050); local t={x=17}; assert(t.x==17); assert(string.sub('日本語',1,3)=='日')"))return 3;
  lua_pushinteger(L,INT64_C(-6000000000));
  if(lua_tointeger(L,-1)!=INT64_C(-6000000000))return 4;
  lua_pop(L,1);
  if(eval(L,"local ok,msg=pcall(function() host_error() end); assert(not ok and string.find(msg,'callback failure 17',1,true)); local ok2=pcall(function() error('nested protected failure') end); assert(not ok2); assert(host_double(21)==42)"))return 5;
  /* Malformed source exercises lexer/parser SjLj recovery too. */
  if(luaL_loadstring(L,"local = broken")!=LUA_ERRSYNTAX)return 6;
  lua_pop(L,1);
  if(eval(L,"local co=coroutine.create(function() coroutine.yield(7); return 8 end); local ok,v=coroutine.resume(co); assert(ok and v==7); ok,v=coroutine.resume(co); assert(ok and v==8)"))return 7;
  luaL_Buffer b;luaL_buffinit(L,&b);for(int i=0;i<3000;i++)luaL_addchar(&b,'x');luaL_pushresult(&b);
  if(lua_objlen(L,-1)!=3000)return 8;lua_pop(L,1);
  lua_gc(L,LUA_GCCOLLECT,0);
  printf("{\"lua_version\":\"%s\",\"pointer_bytes\":%zu,\"integer_bytes\":%zu,\"number_bytes\":%zu,\"debug_bytes\":%zu,\"debug_lastlinedefined_offset\":%zu,\"debug_short_src_offset\":%zu,\"debug_i_ci_offset\":%zu,\"buffer_bytes\":%zu,\"buffer_constant\":%d,\"c_callbacks\":%d,\"protected_errors\":true,\"syntax_error_recovery\":true,\"coroutine_yield\":true,\"large_buffer\":true}\n",LUA_VERSION,sizeof(void*),sizeof(lua_Integer),sizeof(lua_Number),sizeof(lua_Debug),offsetof(lua_Debug,lastlinedefined),offsetof(lua_Debug,short_src),offsetof(lua_Debug,i_ci),sizeof(luaL_Buffer),LUAL_BUFFERSIZE,calls);
  lua_close(L);return 0;
}
