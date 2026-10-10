program DRLWasiHello;
{$mode objfpc}{$H+}
uses SysUtils, Classes, Math;
type TCallback = function(Value: LongInt): LongInt; cdecl;
function AddSeven(Value: LongInt): LongInt; cdecl;
begin Result := Value + 7 end;
var Callback: TCallback;
    Data: TMemoryStream;
    Number, Restored: LongWord;
    Text: AnsiString;
    Caught: Boolean;
    RoundInput: Double;
begin
  if SizeOf(Pointer) <> 4 then Halt(10);
  Callback := @AddSeven;
  if Callback(35) <> 42 then Halt(11);
  Text := 'original Pascal core capability';
  if Length(Text) <> 31 then Halt(12);
  Data := TMemoryStream.Create;
  Number := $A6F96507;
  Data.WriteBuffer(Number, SizeOf(Number));
  Data.Position := 0;
  Data.ReadBuffer(Restored, SizeOf(Restored));
  Data.Free;
  if Restored <> Number then Halt(13);
  Caught := False;
  try
    raise Exception.Create('authored protected error');
  except
    on E: Exception do Caught := E.Message = 'authored protected error';
  end;
  if not Caught then Halt(14);
  RoundInput := (Double(Restored and $FF) - 2.0) / 2.0;
  if Round(RoundInput) <> 2 then Halt(15);
  RoundInput := RoundInput + 1.0;
  if Round(RoundInput) <> 4 then Halt(16);
  WriteLn('DRL official FPC WASI hello: callback, heap, streams, exceptions, round passed');
end.
