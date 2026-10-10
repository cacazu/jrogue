program feeling_sidecar_harness;
{$mode objfpc}{$H+}{$B-}{$codepage utf8}
uses fpwidestring, Classes, SysUtils, drlsemantictext, drlsemanticfeelings;
var Checks: Integer = 0; Filename, Guard, Saved: AnsiString; Stream: TFileStream;
    Params: array[0..0] of TDRLTextParam;
function B(const Value: RawByteString): AnsiString;
begin SetLength(Result, Length(Value));
  if Length(Value) > 0 then Move(Value[1], Result[1], Length(Value)); end;
procedure Check(Value: Boolean; const LabelText: AnsiString);
begin if not Value then raise Exception.Create('FAIL: ' + LabelText); Inc(Checks); end;
function Validate(const ID, English: AnsiString;
  const P: array of TDRLTextParam): Boolean;
begin
  Result := ((ID = 'feeling.test.quiet') and (English = 'Quiet.') and (Length(P) = 0)) or
    ((ID = 'feeling.test.count') and (English = '{{count}} shadows.') and
      (Length(P) = 1) and (P[0].Name = 'count') and (P[0].Kind = DRL_TEXT_INTEGER)) or
    ((ID = 'feeling.test.name') and (English = '{{name}} waits.') and
      (Length(P) = 1) and (P[0].Name = 'name') and (P[0].Kind = DRL_TEXT_STRING));
end;
function Resolve(const ID, English: AnsiString;
  const P: array of TDRLTextParam): AnsiString;
begin
  if ID = 'feeling.test.quiet' then Result := B('静かだ。')
  else if ID = 'feeling.test.count' then Result := P[0].Value + B('体の影。')
  else if ID = 'feeling.test.name' then Result := P[0].Value + B('が待っている。')
  else Result := English;
end;
procedure WriteRaw(const Data: AnsiString);
begin
  Stream := TFileStream.Create(Filename, fmCreate);
  try if Length(Data) > 0 then Stream.WriteBuffer(Data[1], Length(Data));
  finally Stream.Free; end;
end;
function ReadRaw: AnsiString;
begin
  Stream := TFileStream.Create(Filename, fmOpenRead);
  try SetLength(Result, Stream.Size);
    if Length(Result) > 0 then Stream.ReadBuffer(Result[1], Length(Result));
  finally Stream.Free; end;
end;
procedure Reject(const Data, LabelText: AnsiString);
begin
  Check(Data <> Saved, LabelText + ' fixture changes saved JSON');
  Check(DRLLoadSemanticFeelings(Filename, Guard), 'reestablish baseline before rejection');
  WriteRaw(Data);
  Check(not DRLLoadSemanticFeelings(Filename, Guard), LabelText);
  Check(DRLRepeatSemanticFeeling(Guard) = Guard, LabelText + ' fallback');
  WriteRaw(Saved);
end;
begin
  SetMultiByteConversionCodePage(CP_UTF8);
  Check(ParamCount = 1, 'pass one temporary JSON filename'); Filename := ParamStr(1);
  Check(not FileExists(Filename), 'refuse an existing nonisolated file');
  DRLSemanticFeelingValidator := @Validate; DRLSemanticTextResolver := @Resolve;
  DRLClearSemanticFeelings;
  Check(DRLRememberSemanticFeeling('feeling.test.quiet', 'Quiet.', [], '', 'Quiet.'), 'quiet remember');
  Params[0] := DRLIntegerParam('count', 3); Guard := 'Quiet. 3 shadows.';
  Check(DRLRememberSemanticFeeling('feeling.test.count', '{{count}} shadows.', Params, ' ', Guard), 'typed remember');
  Params[0].Value := '9';
  Check(DRLRepeatSemanticFeeling(Guard) = B('静かだ。 3体の影。'), 'deep copy and Japanese repeat');
  Check(DRLRepeatSemanticFeeling('another level') = 'another level', 'guard fallback');
  Check(DRLSaveSemanticFeelings(Filename), 'save'); Saved := ReadRaw;
  DRLClearSemanticFeelings;
  Check(DRLLoadSemanticFeelings(Filename, Guard), 'load');
  Check(DRLRepeatSemanticFeeling(Guard) = B('静かだ。 3体の影。'), 'resume repeat');
  WriteRaw(' ' + #9 + #13 + #10 + Saved + #10 + #13 + #9 + ' ');
  Check(DRLLoadSemanticFeelings(Filename, Guard), 'valid leading/trailing JSON whitespace');
  WriteRaw(Saved);
  DRLSemanticTextResolver := nil;
  Check(DRLRepeatSemanticFeeling(Guard) = Guard, 'English resolver fallback');
  DRLSemanticTextResolver := @Resolve;
  Reject(Saved + '{}', 'trailing root');
  Reject(StringReplace(Saved, '"schema" : 1', '"schema" : 2', []), 'unknown schema');
  Reject(StringReplace(Saved, '"schema" : 1', '"schema" : 1.0', []), 'floating schema');
  Reject(StringReplace(Saved, '"schema" : 1', '"schema" : 1, "schema" : 1', []), 'duplicate schema');
  Reject(StringReplace(Saved, '"schema" : 1', '"schema" : 1, "sch\u0065ma" : 1', []), 'escaped duplicate schema');
  Reject(StringReplace(Saved, '"schema" : 1', '"schema" : 1, "extra" : null', []), 'unexpected root field');
  Reject(StringReplace(Saved, 'feeling.test.count', 'feeling.test.unknown', []), 'unknown ID');
  Reject(StringReplace(Saved, '"integer"', '"string"', []), 'kind mismatch');
  Reject(StringReplace(Saved, '"3"', '"03"', []), 'noncanonical integer');
  Reject(StringReplace(Saved, '"3"', '"9223372036854775808"', []), 'integer overflow');
  Reject(StringReplace(Saved, '"3"', '"\u0000"', []), 'escaped NUL');
  Reject(StringReplace(Saved, '"3"', '"\ud800"', []), 'unpaired surrogate');
  Reject(StringOfChar('[', 9) + '0' + StringOfChar(']', 9), 'nesting bound');
  Reject(StringOfChar(' ', 1048577), 'file bound');
  Reject('{' + #0 + '}', 'raw NUL');
  Reject(#$ED + #$A0 + #$80, 'raw surrogate UTF8');
  Check(not DRLLoadSemanticFeelings(Filename, 'wrong level'), 'expected guard rejection');
  Check(DRLRepeatSemanticFeeling(Guard) = Guard, 'failed-load stale fallback');
  DRLClearSemanticFeelings;
  Check(DRLRememberSemanticFeeling('feeling.test.quiet', 'Quiet.', [], '', 'Quiet.'), 'new baseline');
  Check(not DRLRememberSemanticFeeling('feeling.test.quiet', 'Quiet.', [], ' ', 'wrong'), 'remember mismatch');
  Check(DRLRepeatSemanticFeeling('Quiet.') = 'Quiet.', 'early-exit failure disables replay');
  DRLClearSemanticFeelings; DRLSemanticFeelingValidator := nil;
  Check(not DRLRememberSemanticFeeling('feeling.test.quiet', 'Quiet.', [], '', 'Quiet.'), 'nil validator');
  DRLSemanticFeelingValidator := @Validate;
  DRLClearSemanticFeelings;
  Params[0] := DRLIntegerParam('count', Low(Int64)); Guard := '-9223372036854775808 shadows.';
  Check(DRLRememberSemanticFeeling('feeling.test.count', '{{count}} shadows.', Params, '', Guard), 'Int64 minimum');
  Check(DRLSaveSemanticFeelings(Filename), 'minimum save'); DRLClearSemanticFeelings;
  Check(DRLLoadSemanticFeelings(Filename, Guard), 'minimum load');
  Check(DRLRepeatSemanticFeeling(Guard) = B('-9223372036854775808体の影。'), 'minimum exactness');
  DRLClearSemanticFeelings;
  Params[0] := DRLStringParam('name', B('Cacazu "quoted"\path') + #10 + B('日本語 🐉 {{count}}'));
  Guard := Params[0].Value + ' waits.';
  Check(DRLRememberSemanticFeeling('feeling.test.name', '{{name}} waits.', Params, '', Guard), 'UTF8 remember');
  Check(DRLSaveSemanticFeelings(Filename), 'UTF8 save'); DRLClearSemanticFeelings;
  Check(DRLLoadSemanticFeelings(Filename, Guard), 'UTF8 load');
  Check(DRLRepeatSemanticFeeling(Guard) = Params[0].Value + B('が待っている。'), 'UTF8 exact roundtrip');
  Check(DeleteFile(Filename), 'temporary file cleanup');
  WriteLn('PASS: actual Pascal feeling sidecar persistence, guards, typed parameters, parser rejection fixtures, UTF8 and fallback');
  WriteLn('Native feeling checks: ', Checks);
end.
