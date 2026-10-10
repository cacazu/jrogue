program DrlLuaMixedProbe;
{$mode objfpc}{$H+}
{$pointermath on}
{$codepage utf8}
{$linklib lua5.1.a}
{$linklib drl-lua-bridge.a}
{$linklib c}
{$linklib setjmp}
{$linklib wasi-emulated-process-clocks}
{$linklib clang_rt.builtins}
uses fpwidestring,SysUtils,drl_lua_varargs,drl_c_allocator;
const LUA_IDSIZE=60;LUAL_BUFFERSIZE=1024;
{$i pascal-overlay/vluatypes.inc}
function luaL_newstate:Plua_State;cdecl;external;
procedure luaL_openlibs(L:Plua_State);cdecl;external;
procedure lua_close(L:Plua_State);cdecl;external;
function luaL_loadstring(L:Plua_State;s:PChar):LongInt;cdecl;external;
function lua_pcall(L:Plua_State;nargs,nresults,errfunc:LongInt):LongInt;cdecl;external;
procedure lua_pushcclosure(L:Plua_State;func:lua_CFunction;n:LongInt);cdecl;external;
procedure lua_setfield(L:Plua_State;idx:LongInt;name:PChar);cdecl;external;
procedure lua_pushinteger(L:Plua_State;n:lua_Integer);cdecl;external;
procedure lua_pushlstring(L:Plua_State;s:PChar;length:LongWord);cdecl;external;
procedure lua_createtable(L:Plua_State;narr,nrec:LongInt);cdecl;external;
function lua_type(L:Plua_State;index:LongInt):LongInt;cdecl;external;
function lua_tointeger(L:Plua_State;idx:LongInt):lua_Integer;cdecl;external;
function lua_tolstring(L:Plua_State;idx:LongInt;length:Pointer):PChar;cdecl;external;
function lua_getinfo(L:Plua_State;what:PChar;ar:Plua_Debug):LongInt;cdecl;external;
procedure luaL_buffinit(L:Plua_State;buffer:PluaL_Buffer);cdecl;external;
procedure luaL_addlstring(buffer:PluaL_Buffer;s:PChar;length:LongWord);cdecl;external;
procedure luaL_pushresult(buffer:PluaL_Buffer);cdecl;external;
function FixedLuaError(L:Plua_State;fmt:PChar;i:LongInt;s:PChar):LongInt;cdecl;external name 'drl_lua_error_is';
function FixedLuaFormat(L:Plua_State;fmt:PChar;i:LongInt;s:PChar):PChar;cdecl;external name 'drl_lua_pushfstring_is';
function AllocatorProbe:LongInt;cdecl;external name 'drl_allocator_probe';
function LinkerStackLow:Pointer;cdecl;external name 'drl_wasi_stack_low';
type TScratchCallback=procedure(round:LongInt);cdecl;
function InterleavedProbe(block:Pointer;count:LongWord;scratch:TScratchCallback):LongInt;cdecl;external name 'drl_interleaved_probe';
function FileIoProbe:LongInt;cdecl;external name 'drl_fileio_probe';
function AllocatorFailureProbe:LongInt;cdecl;external name 'drl_allocator_failure_probe';
procedure SetAllocErrno;cdecl;external name 'drl_set_alloc_errno';
{$IFDEF DRL_PROBE_JSPI}
procedure ProbeSuspend(milliseconds:LongWord);cdecl;external name 'drl_probe_suspend';
{$ENDIF}

var calls,errorCalls,semanticCalls,finallyCount:LongInt;
function PascalDouble(L:Plua_State):LongInt;cdecl;
begin lua_pushinteger(L,lua_tointeger(L,1)*2);Inc(calls);Result:=1;end;
function PascalError(L:Plua_State):LongInt;cdecl;
begin
  Inc(errorCalls);
  try
    Result:=DrlLuaError(L,'Pascal callback failure %d %s',[17,ShortString('ABI')]);
  finally
    Inc(finallyCount);
  end;
end;
function PascalSemanticText(L:Plua_State):LongInt;cdecl;
var id,translated:AnsiString;
begin
  id:=AnsiString(lua_tolstring(L,1,nil));
  if (Pos('error.lua.platform.',id)<>1) or (lua_type(L,3)<>5) then Halt(107);
  translated:='日本語 '+id;lua_pushlstring(L,PChar(translated),Length(translated));
  Inc(semanticCalls);Result:=1;
end;
{$IFDEF DRL_PROBE_JSPI}
function PascalSuspend(L:Plua_State):LongInt;cdecl;
var retained:Pointer;localText:AnsiString;value:lua_Integer;i:LongInt;
begin
  value:=lua_tointeger(L,1);localText:=StringOfChar('x',512);GetMem(retained,4096);
  for i:=0 to 4095 do PByte(retained)[i]:=Byte(i*5+9);
  ProbeSuspend(10);
  if (Length(localText)<>512) or (localText[512]<>'x') then Halt(104);
  for i:=0 to 4095 do if PByte(retained)[i]<>Byte(i*5+9) then Halt(105);
  FreeMem(retained);lua_pushinteger(L,value+1);Result:=1;
end;
{$ENDIF}
function Run(L:Plua_State;code:PChar):Boolean;
var status:LongInt;
begin
  status:=luaL_loadstring(L,code);
  if status=0 then status:=lua_pcall(L,0,-1,0);
  if status<>0 then WriteLn('Lua failure: ',lua_tolstring(L,-1,nil));
  Result:=status=0;
end;
procedure PascalScratch(round:LongInt);cdecl;
var block:Pointer;text:AnsiString;values:array of LongInt;i:LongInt;
begin
  GetMem(block,257+round*13);FillChar(block^,257+round*13,round);
  text:=StringOfChar('x',1100+round);SetLength(values,500+round);
  for i:=0 to High(values) do values[i]:=i+round;
  FreeMem(block);
end;
type TDebugGuard=packed record debug:lua_Debug;canary:LongWord;end;
var L:Plua_State;msg:PChar;allocatorStatus,ioStatus,i:LongInt;retained:Pointer;
  guard:TDebugGuard;buffer:luaL_Buffer;largeBuffer:AnsiString;bufferLength:LongWord;
  errorHeapFirst,errorHeapSecond:PtrUInt;
begin
  SetMultiByteConversionCodePage(CP_UTF8);
  System.StackBottom:=LinkerStackLow;
  allocatorStatus:=AllocatorProbe;if allocatorStatus<>0 then begin WriteLn('ALLOCATOR_STATUS ',allocatorStatus);Halt(93);end;
  allocatorStatus:=AllocatorFailureProbe;if allocatorStatus<>0 then begin WriteLn('ALLOCATOR_FAILURE_STATUS ',allocatorStatus);Halt(96);end;
  GetMem(retained,4096);for i:=0 to 4095 do PByte(retained)[i]:=Byte(i*3+5);
  allocatorStatus:=InterleavedProbe(retained,4096,@PascalScratch);FreeMem(retained);if allocatorStatus<>0 then begin WriteLn('INTERLEAVED_STATUS ',allocatorStatus);Halt(94);end;
  ioStatus:=FileIoProbe;if ioStatus<>0 then begin WriteLn('FILE_IO_STATUS ',ioStatus);Halt(95);end;
  L:=luaL_newstate;if L=nil then Halt(2);luaL_openlibs(L);
  if (SizeOf(lua_Debug)<>100) or (SizeOf(luaL_Buffer)<>1036) then Halt(97);
  FillChar(guard,SizeOf(guard),0);guard.canary:=$1234abcd;
  if not Run(L,'return function()'+#10+'return 42'+#10+'end') then Halt(98);
  if (lua_getinfo(L,'>S',@guard.debug)<>1) or (guard.debug.linedefined<>1) or
     (guard.debug.lastlinedefined<>3) or (guard.canary<>$1234abcd) then begin WriteLn('DEBUG_RECORD_MISMATCH');Halt(99);end;
  largeBuffer:=StringOfChar('a',4097);luaL_buffinit(L,@buffer);
  luaL_addlstring(@buffer,PChar(largeBuffer),Length(largeBuffer));luaL_pushresult(@buffer);
  msg:=lua_tolstring(L,-1,@bufferLength);
  if (bufferLength<>LongWord(Length(largeBuffer))) or (StrComp(msg,PChar(largeBuffer))<>0) then Halt(100);
  lua_pushcclosure(L,@PascalDouble,0);lua_setfield(L,-10002,'pascal_double');
  lua_pushcclosure(L,@PascalError,0);lua_setfield(L,-10002,'pascal_error');
  lua_createtable(L,0,1);lua_pushcclosure(L,@PascalSemanticText,0);lua_setfield(L,-2,'semantic_text');lua_setfield(L,-10002,'ui');
  if not Run(L,'local utf8=string.char(230,151,165,230,156,172,232,170,158); for _,entry in ipairs({{os.execute,"external-process"},{os.tmpname,"temporary-name"},{io.tmpfile,"temporary-file"}}) do local ok,msg=pcall(entry[1]); assert(not ok and string.find(msg,utf8.." error.lua.platform."..entry[2],1,true),entry[2].." => "..tostring(ok).." "..tostring(msg)) end') then Halt(108);
  {$IFDEF DRL_PROBE_JSPI}
  lua_pushcclosure(L,@PascalSuspend,0);lua_setfield(L,-10002,'pascal_suspend');
  if not Run(L,'assert(pascal_suspend(3000000000)==3000000001); local ok,msg=pcall(pascal_error); assert(not ok and string.find(msg,"Pascal callback failure 17 ABI",1,true))') then Halt(106);
  {$ENDIF}
  if not Run(L,'assert(pascal_double(3000000000)==6000000000)') then Halt(3);
  msg:=FixedLuaFormat(L,'varargs %d %s',29,PChar('bridge'));
  if StrComp(msg,'varargs 29 bridge')<>0 then Halt(4);
  msg:=DrlLuaFormat(L,'packed %s %d %f %c %% %q',[ShortString('日本語'),-123,Double(3.25),Char('Z')]);
  if StrComp(msg,'packed 日本語 -123 3.25 Z % %q')<>0 then begin WriteLn('PACKED_FORMAT_MISMATCH ',msg);Halt(6);end;
  if not Run(L,'local ok,msg=pcall(pascal_error); assert(not ok and string.find(msg,"Pascal callback failure 17 ABI",1,true)); assert(pascal_double(21)==42); for i=1,5000 do local t={}; for j=1,15 do t[j]=i*j end; if i%100==0 then collectgarbage() end end') then Halt(5);
  if not Run(L,'for i=1,1000 do local ok,msg=pcall(pascal_error); assert(not ok and string.find(msg,"Pascal callback failure 17 ABI",1,true)) end; collectgarbage("collect")') then Halt(101);
  errorHeapFirst:=GetFPCHeapStatus.CurrHeapUsed;
  if not Run(L,'for i=1,1000 do local ok,msg=pcall(pascal_error); assert(not ok and string.find(msg,"Pascal callback failure 17 ABI",1,true)) end; collectgarbage("collect")') then Halt(102);
  errorHeapSecond:=GetFPCHeapStatus.CurrHeapUsed;
  if errorHeapSecond>errorHeapFirst+4096 then begin WriteLn('ADAPTER_TEMP_LEAK ',errorHeapFirst,' ',errorHeapSecond);Halt(103);end;
  lua_close(L);
  {$IFDEF DRL_PROBE_JSPI}Write('{"suspended_pascal_callbacks":1,');
  {$ELSE}Write('{');{$ENDIF}
  WriteLn('"mixed_pascal_lua":true,"callbacks":',calls,',"platform_semantic_callbacks":',semanticCalls,',"fixed_format":true,"packed_format":true,"debug_record_bytes":',SizeOf(lua_Debug),',"buffer_record_bytes":',SizeOf(luaL_Buffer),',"pascal_buffer_bytes":',bufferLength,',"protected_callback_error":true,"error_callbacks":',errorCalls,',"error_heap_first":',errorHeapFirst,',"error_heap_second":',errorHeapSecond,',"pascal_finally_count":',finallyCount,',"allocator_patterns":true,"allocator_oom_retains_old_block":true,"interleaved_pascal_c_allocations":true,"stdio_file_io":true,"gc_iterations":5000}');
end.
