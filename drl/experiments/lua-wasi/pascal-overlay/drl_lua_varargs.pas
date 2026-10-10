unit drl_lua_varargs;
{$mode objfpc}{$H+}
{$pointermath on}
interface
function DrlLuaError(L:Pointer;fmt:PChar;const args:array of const):LongInt;
function DrlLuaFormat(L:Pointer;fmt:PChar;const args:array of const):PChar;
implementation
uses SysUtils{$IFDEF DRL_BROWSER},drlsemantictext{$ENDIF};
function AdapterError(const id,english:AnsiString):Exception;
begin
  {$IFDEF DRL_BROWSER}Result:=Exception.Create(DRLText(id,english));
  {$ELSE}Result:=Exception.Create(english);{$ENDIF}
end;
function FormatProtected(L:Pointer;fmt:PChar;area:Pointer;withPrefix:LongInt;status:PLongInt):PChar;cdecl;external name 'drl_lua_format_protected';
procedure RaiseStatus(L:Pointer;status:LongInt);cdecl;external name 'drl_lua_raise_status';
function LuaError(L:Pointer):LongInt;cdecl;external name 'lua_error';
type
  TPackedArea=array[0..63] of QWord;
  TTemps=array[0..63] of AnsiString;
procedure Pack(fmt:PChar;const args:array of const;out area:TPackedArea;out temps:TTemps);
var p:PChar;offset,arg:LongInt;value32:LongInt;value64:Double;pointerValue:Pointer;spec:Char;
  procedure Put32(value:LongInt);
  begin offset:=(offset+3) and not 3;if offset+4>SizeOf(area) then raise AdapterError('error.lua.adapter.argument_limit','Lua packed argument limit');Move(value,PByte(@area)[offset],4);Inc(offset,4);end;
  procedure Put64(value:Double);
  begin offset:=(offset+7) and not 7;if offset+8>SizeOf(area) then raise AdapterError('error.lua.adapter.argument_limit','Lua packed argument limit');Move(value,PByte(@area)[offset],8);Inc(offset,8);end;
begin
  if Length(args)>Length(temps) then raise AdapterError('error.lua.adapter.argument_limit','Lua packed argument limit');
  FillChar(area,SizeOf(area),0);offset:=0;arg:=0;p:=fmt;
  while p^<>#0 do begin
    if p^<>'%' then begin Inc(p);Continue;end;
    Inc(p);spec:=p^;if spec=#0 then Break;Inc(p);
    { Lua leaves unknown %x sequences literal and consumes no argument. }
    if not (spec in ['s','d','c','f','p']) then Continue;
    if arg>High(args) then raise AdapterError('error.lua.adapter.argument_missing','Lua format argument missing');
    case spec of
      's':begin
        pointerValue:=nil;
        case args[arg].VType of
          vtPChar:pointerValue:=args[arg].VPChar;
          vtAnsiString:pointerValue:=args[arg].VAnsiString;
          vtString:begin temps[arg]:=AnsiString(args[arg].VString^);pointerValue:=PChar(temps[arg]);end;
          vtChar:begin temps[arg]:=args[arg].VChar;pointerValue:=PChar(temps[arg]);end;
          vtUnicodeString:begin temps[arg]:=UTF8Encode(UnicodeString(args[arg].VUnicodeString));pointerValue:=PChar(temps[arg]);end;
          vtPointer:pointerValue:=args[arg].VPointer;
          else raise AdapterError('error.lua.adapter.string_type','Lua %s argument type mismatch');
        end;
        Put32(LongInt(PtrUInt(pointerValue)));
      end;
      'd','c':begin
        case args[arg].VType of
          vtInteger:value32:=args[arg].VInteger;
          vtInt64:value32:=LongInt(args[arg].VInt64^);
          vtQWord:value32:=LongInt(args[arg].VQWord^);
          vtChar:value32:=Ord(args[arg].VChar);
          vtBoolean:value32:=Ord(args[arg].VBoolean);
          else raise AdapterError('error.lua.adapter.integer_type','Lua integer argument type mismatch');
        end;
        Put32(value32);
      end;
      'f':begin
        case args[arg].VType of
          vtExtended:value64:=args[arg].VExtended^;
          vtInteger:value64:=args[arg].VInteger;
          vtInt64:value64:=args[arg].VInt64^;
          else raise AdapterError('error.lua.adapter.float_type','Lua %f argument type mismatch');
        end;
        Put64(value64);
      end;
      'p':begin
        if args[arg].VType<>vtPointer then raise AdapterError('error.lua.adapter.pointer_type','Lua %p argument type mismatch');
        Put32(LongInt(PtrUInt(args[arg].VPointer)));
      end;
    end;
    Inc(arg);
  end;
  { Like C varargs, unconsumed arguments are ignored. Upstream has one such call. }
end;
function PrepareResult(L:Pointer;fmt:PChar;const args:array of const;withPrefix:LongInt;out status:LongInt):PChar;
var area:TPackedArea;temps:TTemps;
begin
  Pack(fmt,args,area,temps);Result:=FormatProtected(L,fmt,@area,withPrefix,@status);
  { Normal return releases temps before Lua's foreign longjmp crosses Pascal. }
end;
function DrlLuaError(L:Pointer;fmt:PChar;const args:array of const):LongInt;
var status:LongInt;
begin
  PrepareResult(L,fmt,args,1,status);
  if status<>0 then RaiseStatus(L,status);
  Result:=LuaError(L);
end;
function DrlLuaFormat(L:Pointer;fmt:PChar;const args:array of const):PChar;
var status:LongInt;
begin
  Result:=PrepareResult(L,fmt,args,0,status);
  if status<>0 then RaiseStatus(L,status);
end;
end.
