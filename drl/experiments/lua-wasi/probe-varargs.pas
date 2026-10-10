program DrlLuaVarargsProbe;
{$mode objfpc}{$H+}
{$linklib lua5.1.a}{$linklib c}{$linklib setjmp}{$linklib wasi-emulated-process-clocks}{$linklib clang_rt.builtins}
function luaL_newstate:Pointer;cdecl;external;
function lua_pushfstring(L:Pointer;fmt:PChar):PChar;varargs;cdecl;external;
procedure lua_close(L:Pointer);cdecl;external;
var L:Pointer;
begin
  L:=luaL_newstate;
  WriteLn(lua_pushfstring(L,'varargs %d %s',29,PChar('bridge')));
  lua_close(L);
end.
