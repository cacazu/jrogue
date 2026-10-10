program SemanticProbe;
{$mode objfpc}{$H+}{$codepage utf8}
uses fpwidestring, SysUtils, drlsemantictext;
var Checks: Integer = 0;
function B(const Value: RawByteString): AnsiString;
begin SetLength(Result, Length(Value));
  if Length(Value) > 0 then Move(Value[1], Result[1], Length(Value)); end;
procedure Check(const actual, expected: AnsiString);
begin
  if actual <> expected then raise Exception.Create('Semantic probe mismatch');
  Inc(Checks);
end;
procedure RejectCase(aCase: Integer);
var rejected: Boolean; p: TDRLTextParam;
begin
  rejected := False;
  try
    case aCase of
      0: DRLText('test.id', '{{missing}}');
      1: DRLText('test.id', '{{name}}', [DRLStringParam('name','A'),DRLStringParam('name','B')]);
      2: DRLText('test.id', 'text', [DRLStringParam('extra','A')]);
      3: DRLText('test.id', '{{broken');
      4: DRLText('UPPER', 'text');
      5: DRLText('test.id', '{{not-an-identifier}}');
      6: DRLText('test.id', '{{name}}', [DRLStringParam('name',StringOfChar('X',32769))]);
      7: begin p := DRLStringParam('count','042'); p.Kind := DRL_TEXT_INTEGER; DRLText('test.id','{{count}}',[p]); end;
      8: begin p := DRLStringParam('count','9223372036854775808'); p.Kind := DRL_TEXT_INTEGER; DRLText('test.id','{{count}}',[p]); end;
      9: begin p := DRLStringParam('count','not a number'); p.Kind := DRL_TEXT_INTEGER; DRLText('test.id','{{count}}',[p]); end;
    end;
  except on E: EArgumentException do rejected := True; end;
  if not rejected then raise Exception.Create('Invalid semantic request was accepted');
  Inc(Checks);
end;
function Resolver(const aID,aEnglish:AnsiString; const aParams:array of TDRLTextParam):AnsiString;
begin
  if (aID <> 'test.callback') or (aEnglish <> '{{count}}') or
    (Length(aParams) <> 1) or (aParams[0].Kind <> DRL_TEXT_INTEGER) or
    (aParams[0].Name <> 'count') or (aParams[0].Value <> '42') then
    raise Exception.Create('Callback contract mismatch');
  Exit('localized');
end;
var i: Integer;
begin
  SetMultiByteConversionCodePage(CP_UTF8);
  Check(DRLText('test.id','{RWarning} {$input_ok} {^3}'),'{RWarning} {$input_ok} {^3}');
  Check(DRLText('test.id','A'#10#10'B'),'A'#10#10'B');
  Check(DRLText('test.id','Name: {{name}}',[DRLStringParam('name','Alice {{other}} {!raw}')]),'Name: Alice {{other}} {!raw}');
  Check(DRLText('test.id','{!{{version}}}',[DRLStringParam('version','0.10.11')]),'{!0.10.11}');
  Check(DRLText('test.id','{{second}} / {{first}} / {{first}}',[DRLStringParam('first','A'),DRLStringParam('second','B')]),'B / A / A');
  Check(DRLText('test.id','{{number}}',[DRLIntegerParam('number',-9223372036854775807)]),'-9223372036854775807');
  for i := 0 to 9 do RejectCase(i);
  DRLSemanticTextResolver := @Resolver;
  Check(DRLText('test.callback','{{count}}',[DRLIntegerParam('count',42)]),'localized');
  Check(DRLEnglishText('test.utf8','{{name}}',[DRLStringParam('name',B('日本語'))]),B('日本語'));
  if Length(DRLEnglishText('test.utf8','{{name}}',[DRLStringParam('name',B('日本語'))])) <> 9 then
    raise Exception.Create('UTF8 byte length mismatch');
  Inc(Checks);
  DRLSemanticTextResolver := nil;
  Check(DRLText('test.utf8','{{name}}',[DRLStringParam('name',B('漢字 {!raw} {{opaque}}'))]),B('漢字 {!raw} {{opaque}}'));
  Check(DRLEnglishText('test.extreme','{{number}}',[DRLIntegerParam('number',Low(Int64))]),'-9223372036854775808');
  Check(DRLEnglishText('test.extreme','{{number}}',[DRLIntegerParam('number',High(Int64))]),'9223372036854775807');
  Writeln('Semantic Pascal checks: ',Checks);
end.
