{ Actual shared Pascal UTF8/JSON lexical contract. Source review predicts current
  pinned FCL failures for raw controls 20..31 and backslash-apostrophe.
  This diagnostic fixture does not redefine the parser or change frozen units. }
program NativeJSONContractProbe;
{$mode objfpc}{$H+}{$B-}{$codepage utf8}
uses fpwidestring, SysUtils, drlsemanticfeelings;
var Checks, Failures, I: Integer; Bad: AnsiString;
function Bytes(const Values: array of Byte): AnsiString;
var J: SizeInt;
begin
  SetLength(Result, Length(Values));
  for J := 0 to High(Values) do Result[J+1] := AnsiChar(Values[J]);
end;
procedure Check(Actual, Expected: Boolean; const LabelText: AnsiString);
begin
  Inc(Checks);
  if Actual <> Expected then begin Inc(Failures); WriteLn('FAIL: ', LabelText); end;
end;
function PreflightAccepted(const Data: RawByteString): Boolean;
begin
  try Result := DRLSemanticPreflightJSON(Data);
  except Result := False; end;
end;
begin
  SetMultiByteConversionCodePage(CP_UTF8);
  Check(DRLSemanticValidUTF8(Bytes([$E6,$97,$A5]),3),True,'valid Japanese UTF8 bytes');
  Check(DRLSemanticValidUTF8(Bytes([$F4,$8F,$BF,$BF]),4),True,'maximum scalar UTF8');
  Check(DRLSemanticValidUTF8(Bytes([$FF]),1),False,'invalid UTF8 first byte');
  Check(DRLSemanticValidUTF8(Bytes([$C0,$80]),2),False,'overlong UTF8');
  Check(DRLSemanticValidUTF8(Bytes([$E6,$97]),2),False,'truncated UTF8');
  Check(DRLSemanticValidUTF8(Bytes([$ED,$A0,$80]),3),False,'UTF8 surrogate');
  Check(DRLSemanticValidUTF8(Bytes([$F4,$90,$80,$80]),4),False,'scalar above Unicode maximum');
  Check(DRLSemanticValidUTF8(Bytes([0]),1),False,'NUL text boundary');
  Check(DRLSemanticValidUTF8(Bytes([$E6,$97,$A5]),2),False,'text byte bound');
  Check(PreflightAccepted(' '+#9+#13+#10+'{"x":"text"}'+#10+#13+#9+' '),True,'legal JSON whitespace outside strings');
  Check(PreflightAccepted('{"x":"'+#39+'"}'),True,'literal apostrophe is legal inside JSON string');
  Check(PreflightAccepted('{"x":"\u0014\u001f"}'),True,'escaped non-NUL controls remain legal JSON');
  for I := 0 to 31 do begin
    Bad := '{"x":"'+AnsiChar(I)+'"}';
    Check(PreflightAccepted(Bad),False,'reject unescaped JSON control '+IntToStr(I));
  end;
  Check(PreflightAccepted('{"x":"'+#92+#39+'"}'),False,'reject illegal JSON backslash-apostrophe escape');
  Check(PreflightAccepted('{"x":"\q"}'),False,'reject illegal JSON escape q');
  WriteLn('Native JSON contract checks: ',Checks,'; failures: ',Failures);
  if Failures <> 0 then Halt(1);
end.
