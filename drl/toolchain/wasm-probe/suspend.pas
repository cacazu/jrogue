program DRLWasiSuspend;
{$mode objfpc}{$H+}
uses SysUtils, Classes;
procedure HostSleep(Milliseconds: LongInt); cdecl; external 'drl_host' name 'sleep';
procedure NestedSuspend(Depth: LongInt; Expected: LongWord);
var Sentinel: array[0..31] of LongWord;
    HeapText: AnsiString;
    I: LongInt;
begin
  for I := 0 to High(Sentinel) do Sentinel[I] := Expected xor LongWord(I);
  HeapText := 'Pascal stack and heap survive browser suspension';
  if Depth > 0 then NestedSuspend(Depth - 1, Expected + 17)
  else HostSleep(5);
  for I := 0 to High(Sentinel) do
    if Sentinel[I] <> (Expected xor LongWord(I)) then Halt(31);
  if HeapText <> 'Pascal stack and heap survive browser suspension' then Halt(32);
end;
var Data: TMemoryStream;
    Value, Restored: LongWord;
    Caught: Boolean;
begin
  WriteLn('DRL Pascal suspension: before');
  Data := TMemoryStream.Create;
  try
    Value := $A6F96507;
    Data.WriteBuffer(Value, SizeOf(Value));
    NestedSuspend(3, Value);
    HostSleep(1);
    Data.Position := 0;
    Data.ReadBuffer(Restored, SizeOf(Restored));
    if Restored <> Value then Halt(33);
    Caught := False;
    try
      raise Exception.Create('post-resume protected error');
    except
      on E: Exception do Caught := E.Message = 'post-resume protected error';
    end;
    if not Caught then Halt(34);
  finally
    Data.Free;
  end;
  WriteLn('DRL Pascal suspension: locals, heap, stream, exception passed after');
end.
