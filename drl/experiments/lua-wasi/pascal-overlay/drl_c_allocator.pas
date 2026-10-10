unit drl_c_allocator;
{$mode objfpc}{$H+}{$pointermath on}
interface
function DrlCMalloc(size:PtrUInt):Pointer;cdecl;public name 'malloc';
procedure DrlCFree(p:Pointer);cdecl;public name 'free';
function DrlCRealloc(p:Pointer;size:PtrUInt):Pointer;cdecl;public name 'realloc';
function DrlCCalloc(count,size:PtrUInt):Pointer;cdecl;public name 'calloc';
implementation
procedure SetAllocErrno;cdecl;external name 'drl_set_alloc_errno';
type
  THeader=packed record raw:Pointer;size:PtrUInt;end;
  PHeader=^THeader;
function Header(p:Pointer):PHeader;inline;
begin Result:=PHeader(PByte(p)-SizeOf(THeader));end;
function DrlCMalloc(size:PtrUInt):Pointer;cdecl;
var raw:Pointer;previousFlag:Boolean;storageSize:PtrUInt;
begin
  if size=0 then size:=1;
  if size>High(PtrUInt)-(SizeOf(THeader)+15) then begin SetAllocErrno;Exit(nil);end;
  storageSize:=size+SizeOf(THeader)+15;
  previousFlag:=ReturnNilIfGrowHeapFails;ReturnNilIfGrowHeapFails:=True;
  try raw:=GetMem(storageSize);finally ReturnNilIfGrowHeapFails:=previousFlag;end;
  if raw=nil then begin SetAllocErrno;Exit(nil);end;
  Result:=Pointer((PtrUInt(raw)+SizeOf(THeader)+15) and not PtrUInt(15));
  Header(Result)^.raw:=raw;Header(Result)^.size:=size;
end;
procedure DrlCFree(p:Pointer);cdecl;
begin if p<>nil then FreeMem(Header(p)^.raw);end;
function DrlCRealloc(p:Pointer;size:PtrUInt):Pointer;cdecl;
var copySize:PtrUInt;
begin
  if p=nil then Exit(DrlCMalloc(size));
  if size=0 then begin DrlCFree(p);Exit(nil);end;
  Result:=DrlCMalloc(size);
  if Result=nil then Exit;
  copySize:=Header(p)^.size;if copySize>size then copySize:=size;
  Move(p^,Result^,copySize);DrlCFree(p);
end;
function DrlCCalloc(count,size:PtrUInt):Pointer;cdecl;
var total:PtrUInt;
begin
  if (size<>0) and (count>High(PtrUInt) div size) then begin SetAllocErrno;Exit(nil);end;
  total:=count*size;Result:=DrlCMalloc(total);
  if (Result<>nil) and (total<>0) then FillChar(Result^,total,0);
end;
function InternalMalloc(size:PtrUInt):Pointer;cdecl;public name '__libc_malloc';
begin Result:=DrlCMalloc(size);end;
function InternalCalloc(count,size:PtrUInt):Pointer;cdecl;public name '__libc_calloc';
begin Result:=DrlCCalloc(count,size);end;
procedure InternalFree(p:Pointer);cdecl;public name '__libc_free';
begin DrlCFree(p);end;
end.
