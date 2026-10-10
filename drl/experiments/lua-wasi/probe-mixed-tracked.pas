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
uses SysUtils,drl_lua_varargs;
type
  Plua_State=Pointer;
  lua_Integer=Int64;
  lua_CFunction=function(L:Plua_State):LongInt;cdecl;
function luaL_newstate:Plua_State;cdecl;external;
procedure luaL_openlibs(L:Plua_State);cdecl;external;
procedure lua_close(L:Plua_State);cdecl;external;
function luaL_loadstring(L:Plua_State;s:PChar):LongInt;cdecl;external;
function lua_pcall(L:Plua_State;nargs,nresults,errfunc:LongInt):LongInt;cdecl;external;
procedure lua_pushcclosure(L:Plua_State;func:lua_CFunction;n:LongInt);cdecl;external;
procedure lua_setfield(L:Plua_State;idx:LongInt;name:PChar);cdecl;external;
procedure lua_pushinteger(L:Plua_State;n:lua_Integer);cdecl;external;
function lua_tointeger(L:Plua_State;idx:LongInt):lua_Integer;cdecl;external;
function lua_tolstring(L:Plua_State;idx:LongInt;length:Pointer):PChar;cdecl;external;
function FixedLuaError(L:Plua_State;fmt:PChar;i:LongInt;s:PChar):LongInt;cdecl;external name 'drl_lua_error_is';
function FixedLuaFormat(L:Plua_State;fmt:PChar;i:LongInt;s:PChar):PChar;cdecl;external name 'drl_lua_pushfstring_is';
function AllocatorProbe:LongInt;cdecl;external name 'drl_allocator_probe';
function LinkerStackLow:Pointer;cdecl;external name 'drl_wasi_stack_low';
type TScratchCallback=procedure(round:LongInt);cdecl;
function InterleavedProbe(block:Pointer;count:LongWord;scratch:TScratchCallback):LongInt;cdecl;external name 'drl_interleaved_probe';
function FileIoProbe:LongInt;cdecl;external name 'drl_fileio_probe';
function AllocatorFailureProbe:LongInt;cdecl;external name 'drl_allocator_failure_probe';
procedure SetAllocErrno;cdecl;external name 'drl_set_alloc_errno';

var tracked:array[0..32767] of Pointer; spare:array[0..32767] of LongInt; allocations,spareCount:LongInt;
function FindTracked(p:Pointer):LongInt;
var i:LongInt;
begin for i:=0 to allocations-1 do if tracked[i]=p then Exit(i);Exit(-1);end;
{ One allocator authority for Pascal and libc. No independent libc sbrk heap. }
function SharedMalloc(n:PtrUInt):Pointer;cdecl;public name 'malloc';
var slot:LongInt;previousFlag:Boolean;
begin
  if n=0 then n:=1;previousFlag:=ReturnNilIfGrowHeapFails;ReturnNilIfGrowHeapFails:=True;
  try Result:=GetMem(n);finally ReturnNilIfGrowHeapFails:=previousFlag;end;
  if Result=nil then begin SetAllocErrno;Exit;end;
  if spareCount>0 then begin Dec(spareCount);slot:=spare[spareCount];tracked[slot]:=Result;Exit;end;
  if allocations>=Length(tracked) then Halt(90);
  tracked[allocations]:=Result;Inc(allocations);
end;
procedure SharedFree(p:Pointer);cdecl;public name 'free';
var slot:LongInt;
begin
  if p=nil then Exit;slot:=FindTracked(p);
  if slot<0 then begin WriteLn('INVALID_FREE ',PtrUInt(p));Halt(91);end;
  tracked[slot]:=nil;spare[spareCount]:=slot;Inc(spareCount);FreeMem(p);
end;
function SharedRealloc(p:Pointer;n:PtrUInt):Pointer;cdecl;public name 'realloc';
var slot:LongInt;previousFlag:Boolean;
begin
  if p=nil then Exit(SharedMalloc(n));
  if n=0 then begin SharedFree(p);Exit(nil);end;
  slot:=FindTracked(p);if slot<0 then begin WriteLn('INVALID_REALLOC ',PtrUInt(p));Halt(92);end;
  previousFlag:=ReturnNilIfGrowHeapFails;ReturnNilIfGrowHeapFails:=True;
  try Result:=ReallocMem(p,n);finally ReturnNilIfGrowHeapFails:=previousFlag;end;
  if Result<>nil then tracked[slot]:=p else SetAllocErrno;
end;
function SharedCalloc(count,n:PtrUInt):Pointer;cdecl;public name 'calloc';
var total:PtrUInt;
begin
  if (n<>0) and (count>High(PtrUInt) div n) then Exit(nil);
  total:=count*n;Result:=SharedMalloc(total);if (Result<>nil) and (total<>0) then FillChar(Result^,total,0);
end;
function SharedLibcMalloc(n:PtrUInt):Pointer;cdecl;public name '__libc_malloc';
begin Result:=SharedMalloc(n);end;
function SharedLibcCalloc(count,n:PtrUInt):Pointer;cdecl;public name '__libc_calloc';
begin Result:=SharedCalloc(count,n);end;
procedure SharedLibcFree(p:Pointer);cdecl;public name '__libc_free';
begin SharedFree(p);end;
var calls,finallyCount:LongInt;
function PascalDouble(L:Plua_State):LongInt;cdecl;
begin lua_pushinteger(L,lua_tointeger(L,1)*2);Inc(calls);Result:=1;end;
function PascalError(L:Plua_State):LongInt;cdecl;
begin
  try
    Result:=DrlLuaError(L,'Pascal callback failure %d %s',[17,ShortString('ABI')]);
  finally
    Inc(finallyCount);
  end;
end;
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
var L:Plua_State;msg:PChar;allocatorStatus,ioStatus,i:LongInt;retained:Pointer;
begin
  System.StackBottom:=LinkerStackLow;
  allocatorStatus:=AllocatorProbe;if allocatorStatus<>0 then begin WriteLn('ALLOCATOR_STATUS ',allocatorStatus);Halt(93);end;
  allocatorStatus:=AllocatorFailureProbe;if allocatorStatus<>0 then begin WriteLn('ALLOCATOR_FAILURE_STATUS ',allocatorStatus);Halt(96);end;
  GetMem(retained,4096);for i:=0 to 4095 do PByte(retained)[i]:=Byte(i*3+5);
  allocatorStatus:=InterleavedProbe(retained,4096,@PascalScratch);FreeMem(retained);if allocatorStatus<>0 then begin WriteLn('INTERLEAVED_STATUS ',allocatorStatus);Halt(94);end;
  ioStatus:=FileIoProbe;if ioStatus<>0 then begin WriteLn('FILE_IO_STATUS ',ioStatus);Halt(95);end;
  L:=luaL_newstate;if L=nil then Halt(2);luaL_openlibs(L);
  lua_pushcclosure(L,@PascalDouble,0);lua_setfield(L,-10002,'pascal_double');
  lua_pushcclosure(L,@PascalError,0);lua_setfield(L,-10002,'pascal_error');
  if not Run(L,'assert(pascal_double(3000000000)==6000000000)') then Halt(3);
  msg:=FixedLuaFormat(L,'varargs %d %s',29,PChar('bridge'));
  if StrComp(msg,'varargs 29 bridge')<>0 then Halt(4);
  msg:=DrlLuaFormat(L,'packed %s %d %f %c %% %q',[ShortString('日本語'),-123,Double(3.25),Char('Z')]);
  if StrComp(msg,'packed 日本語 -123 3.25 Z % %q')<>0 then begin WriteLn('PACKED_FORMAT_MISMATCH ',msg);Halt(6);end;
  if not Run(L,'local ok,msg=pcall(pascal_error); assert(not ok and string.find(msg,"Pascal callback failure 17 ABI",1,true)); assert(pascal_double(21)==42); for i=1,5000 do local t={}; for j=1,15 do t[j]=i*j end; if i%100==0 then collectgarbage() end end') then Halt(5);
  lua_close(L);
  WriteLn('{"mixed_pascal_lua":true,"callbacks":',calls,',"fixed_format":true,"packed_format":true,"protected_callback_error":true,"pascal_finally_count":',finallyCount,',"allocator_patterns":true,"allocator_oom_retains_old_block":true,"interleaved_pascal_c_allocations":true,"stdio_file_io":true,"gc_iterations":5000}');
end.
