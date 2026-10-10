{ Native tests for the actual DRL history store and generated whitelist/projector.
  SPDX-License-Identifier: GPL-2.0-only.
  Build/run belongs to the coordinating agent. This source executes no game code.
  ParamStr(1) must name an initially absent, isolated temporary JSON file. All
  writes and deletes use that exact path; the original history exists in memory. }
program DRLNativeHistoryProbe;
{$mode objfpc}{$H+}{$B-}
{$codepage utf8}
uses fpwidestring, Classes, SysUtils, fpjson, jsonscanner, jsonparser,
  drlsemantictext, drlsemanticfeelings, drlsemantichistory,
  drlsemantichistorycatalog;

const
  FROZEN_ID = 'history.event.frozen';
  FROZEN_EN = 'On level {{depth}}, hell froze over!';
  ASSEMBLY_ID = 'history.assembled.chainsword';
  ASSEMBLY_EN = 'On level {{depth}} he assembled a {{assembly}}!';
  FOUND_ID = 'history.found-item.pistol';
  FOUND_EN = 'On level {{depth}} he found the {{item}}!';
  OVERLOAD_ID = 'history.overloaded-item.pistol';
  OVERLOAD_EN = 'He overloaded a {{item}} on level {{depth}}!';
  COMPLEX_ID = 'history.monster-complex.imp';
  COMPLEX_EN = 'On level {{depth}} he stumbled into a complex full of {{beings}}!';
  CHAMPION_ID = 'history.arena.champion';
  CHAMPION_EN = 'He left the Arena as a champion!';
type
  TOriginalHistory = array of AnsiString;
var
  OriginalHistory, EnglishSnapshot: TOriginalHistory;
  CandidatePath: AnsiString;
  ValidJSON: RawByteString;
  Checks, RejectedLoads: Integer;
  Japanese, BrokenResolver: Boolean;

{ Preserve literal UTF8 bytes without an implicit Windows ANSI conversion. }
function B(const aText: RawByteString): AnsiString;
begin
  SetLength(Result, Length(aText));
  if Length(aText) > 0 then Move(aText[1], Result[1], Length(aText));
end;
function J(const aText: RawByteString): TJSONStringType;
begin
  SetLength(Result, Length(aText));
  if Length(aText) > 0 then Move(aText[1], Result[1], Length(aText));
end;
procedure Check(aCondition: Boolean; const aLabel: AnsiString);
begin
  if not aCondition then raise Exception.Create('History probe: ' + aLabel);
  Inc(Checks);
end;
procedure Equal(const aActual, aExpected, aLabel: AnsiString);
begin
  Check(aActual = aExpected, aLabel);
end;
function OriginalSource(aIndex: Int64; out aOriginalEnglish: AnsiString): Boolean;
begin
  aOriginalEnglish := '';
  Result := (aIndex >= 1) and (aIndex <= Length(OriginalHistory));
  if Result then aOriginalEnglish := OriginalHistory[SizeInt(aIndex)-1];
end;
function CurrentSource(out aIndex: Int64;
  out aOriginalEnglish: AnsiString): Boolean;
begin
  aIndex := Length(OriginalHistory);
  Result := OriginalSource(aIndex, aOriginalEnglish);
end;
function FixtureResolver(const aID, aEnglish: AnsiString;
  const aParams: array of TDRLTextParam): AnsiString;
var text: AnsiString;
begin
  if BrokenResolver then Exit(B(#$C0#$AF));
  if not Japanese then Exit(DRLEnglishText(aID, aEnglish, aParams));
  if aID = FROZEN_ID then text := B('{{depth}}階で地獄が凍りついた！')
  else if aID = ASSEMBLY_ID then text := B('{{depth}}階で{{assembly}}を組み立てた！')
  else if aID = FOUND_ID then text := B('{{depth}}階で{{item}}を見つけた！')
  else if aID = OVERLOAD_ID then text := B('{{depth}}階で{{item}}を過負荷にした！')
  else if aID = COMPLEX_ID then text := B('{{depth}}階で{{beings}}だらけの施設に迷い込んだ！')
  else if aID = CHAMPION_ID then text := B('王者として闘技場を後にした！')
  else if aID = 'term.mod_array.chainsword.name' then text := B('チェーンソード')
  else if aID = 'term.item.pistol.name' then text := B('ピストル')
  else if aID = 'term.being.imp.name-plural' then text := B('インプ')
  else if aID = 'item.name.overcharged' then text := B('過充填した{{name}}')
  else Exit(DRLEnglishText(aID, aEnglish, aParams));
  Result := DRLEnglishText(aID, text, aParams);
end;
procedure AppendOriginal(const aEnglish: AnsiString);
begin
  SetLength(OriginalHistory, Length(OriginalHistory)+1);
  OriginalHistory[High(OriginalHistory)] := aEnglish;
end;
procedure Remember(const aID, aEnglish: AnsiString;
  const aParams: array of TDRLTextParam);
begin
  AppendOriginal(DRLEnglishText(aID, aEnglish, aParams));
  Check(DRLRememberCurrentSemanticHistory(aID, aEnglish, aParams),
    'remember actual last original history: ' + aID);
end;
procedure CheckOriginals;
var i: SizeInt;
begin
  Check(Length(OriginalHistory) = Length(EnglishSnapshot), 'original history count');
  for i := 0 to High(OriginalHistory) do
    Equal(OriginalHistory[i], EnglishSnapshot[i], 'original history unchanged');
end;
procedure WriteCandidate(const aData: RawByteString);
var stream: TFileStream;
begin
  stream := TFileStream.Create(CandidatePath, fmCreate);
  try
    if Length(aData) > 0 then stream.WriteBuffer(aData[1], Length(aData));
  finally stream.Free; end;
end;
function ReadCandidate: RawByteString;
var stream: TFileStream;
begin
  { Exclusive reopen also witnesses that Save closed its write handle. }
  stream := TFileStream.Create(CandidatePath, fmOpenRead or fmShareExclusive);
  try
    SetLength(Result, SizeInt(stream.Size));
    if Length(Result) > 0 then stream.ReadBuffer(Result[1], Length(Result));
  finally stream.Free; end;
end;
procedure DeleteCandidate;
begin
  if FileExists(CandidatePath) then
    Check(DeleteFile(CandidatePath), 'delete exact temporary candidate file');
end;
function ReplaceOnce(const aData, aBefore, aAfter: RawByteString): RawByteString;
var index: SizeInt;
begin
  index := Pos(aBefore, aData);
  Check(index > 0, 'mutation anchor exists');
  Result := Copy(aData, 1, index-1) + aAfter +
    Copy(aData, index + Length(aBefore), MaxInt);
end;
function ParseCandidate: TJSONObject;
var parser: TJSONParser; value: TJSONData;
begin
  parser := TJSONParser.Create(ValidJSON, [joUTF8, joStrict]);
  try value := parser.Parse; finally parser.Free; end;
  Check(value.JSONType = jtObject, 'saved root is an object');
  Result := TJSONObject(value);
end;
function RecordAt(aRoot: TJSONObject; aIndex: Integer): TJSONObject;
begin
  Result := TJSONObject(TJSONArray(aRoot.Find('records')).Items[aIndex]);
end;
function ParamAt(aRecord: TJSONObject; aIndex: Integer): TJSONObject;
begin
  Result := TJSONObject(TJSONArray(aRecord.Find('params')).Items[aIndex]);
end;
procedure PutString(aObject: TJSONObject; const aKey: TJSONStringType;
  const aValue: RawByteString);
begin
  aObject.Delete(aKey); aObject.Add(aKey, J(aValue));
end;
function MutatedCandidate(aCase: Integer): RawByteString;
var root, entry, param, extra: TJSONObject; params: TJSONArray; i: Integer;
begin
  root := ParseCandidate;
  try
    entry := RecordAt(root, 0); param := ParamAt(entry, 0);
    case aCase of
      0: begin root.Delete('schema'); root.Add('schema', 2); end;
      1: PutString(root, 'schema', '1');
      2: PutString(root, 'format', 'another.history.format');
      3: root.Add('unexpected', True);
      4: root.Delete('format');
      5: PutString(entry, 'id', 'history.custom-unknown');
      6: PutString(entry, 'english', 'Changed level {{depth}}!');
      7: PutString(entry, 'originalEnglish', 'A changed original English guard');
      8: PutString(entry, 'index', '0');
      9: PutString(entry, 'index', '01');
      10: PutString(entry, 'index', '9223372036854775808');
      11: begin entry.Delete('index'); entry.Add('index', 1); end;
      12: PutString(param, 'kind', 'float');
      13: PutString(param, 'kind', 'string');
      14: PutString(param, 'value', '+42');
      15: PutString(param, 'value', '042');
      16: PutString(param, 'value', '-0');
      17: PutString(param, 'value', '9223372036854775808');
      18: PutString(param, 'value', '-9223372036854775809');
      19: begin param.Delete('value'); param.Add('value', 1); end;
      20: PutString(param, 'name', 'unknown');
      21: param.Add('unexpected', True);
      22: entry.Add('unexpected', True);
      23: entry.Delete('params');
      24: begin
        params := TJSONArray(entry.Find('params'));
        extra := TJSONObject.Create;
        extra.Add('name', J('depth')); extra.Add('kind', J('integer'));
        extra.Add('value', J('1')); params.Add(extra);
      end;
      25: begin
        params := TJSONArray(entry.Find('params')); params.Clear;
        for i := 1 to DRL_HISTORY_MAX_PARAMS+1 do begin
          extra := TJSONObject.Create; extra.Add('name', J('p'+IntToStr(i)));
          extra.Add('kind', J('string')); extra.Add('value', J('value'));
          params.Add(extra);
        end;
      end;
      26: PutString(param, 'value', StringOfChar('X', DRL_HISTORY_MAX_TEXT_BYTES+1));
      27: PutString(entry, 'originalEnglish', StringOfChar('X', DRL_HISTORY_MAX_TEXT_BYTES+1));
      28: PutString(RecordAt(root, 1), 'index', '1');
      29: PutString(RecordAt(root, 1), 'index', '0');
      30: PutString(RecordAt(root, 2), 'originalEnglish', 'Late invalid record');
    else raise Exception.Create('Unknown JSON mutation case');
    end;
    Result := root.AsJSON;
  finally root.Free; end;
end;
procedure RejectJSON(const aLabel: AnsiString; const aData: RawByteString);
begin
  WriteCandidate(ValidJSON);
  Check(DRLLoadSemanticHistory(CandidatePath), 'establish valid store before rejection');
  Check(DRLPresentationHistory(1, OriginalHistory[0]) <> OriginalHistory[0],
    'valid Japanese replay before rejection');
  WriteCandidate(aData);
  Check(not DRLLoadSemanticHistory(CandidatePath), 'reject ' + aLabel);
  Equal(DRLPresentationHistory(1, OriginalHistory[0]), OriginalHistory[0],
    'whole failed load falls back to English: ' + aLabel);
  Check(not DRLSaveSemanticHistory(CandidatePath), 'unusable metadata cannot save');
  Equal(B(ReadCandidate), B(aData), 'rejected load/save leaves candidate bytes');
  Inc(RejectedLoads);
end;
function AlterIntegerProjector(const aID: AnsiString;
  const aOriginalParams: array of TDRLTextParam;
  out aPresentationParams: TDRLHistoryParams): Boolean;
var i: SizeInt;
begin
  SetLength(aPresentationParams, Length(aOriginalParams));
  for i := 0 to High(aOriginalParams) do aPresentationParams[i] := aOriginalParams[i];
  if Length(aPresentationParams) > 0 then aPresentationParams[0].Value := '777';
  Result := True;
end;
procedure RunProbe;
var p: TDRLHistoryParams; i: Integer; raw, many: RawByteString;
    root: TJSONObject; savedProjector: TDRLSemanticHistoryProjector;
    savedValidator: TDRLSemanticHistoryValidator;
    opaque, expected: AnsiString;
begin
  Check(Assigned(DRLSemanticHistoryValidator), 'generated validator initialized');
  Check(Assigned(DRLSemanticHistoryProjector), 'generated projector initialized');
  DRLSemanticHistorySource := @OriginalSource;
  DRLSemanticHistoryCurrentSource := @CurrentSource;
  DRLSemanticTextResolver := @FixtureResolver;
  DRLClearSemanticHistory;
  Check(not DRLRememberCurrentSemanticHistory(CHAMPION_ID, CHAMPION_EN, []),
    'empty original history has no current event');
  Remember(FROZEN_ID, FROZEN_EN, [DRLIntegerParam('depth', High(Int64))]);
  SetLength(p, 2); p[0] := DRLIntegerParam('depth', Low(Int64));
  p[1] := DRLStringParam('assembly', 'chainsword');
  Remember(ASSEMBLY_ID, ASSEMBLY_EN, p);
  p[0].Value := '777'; p[1].Name := 'changed'; p[1].Value := 'mutated after append';
  Remember(CHAMPION_ID, CHAMPION_EN, []);
  opaque := B('外部名%{{depth}} {!raw} 😀');
  Remember(FOUND_ID, FOUND_EN,
    [DRLIntegerParam('depth', 42), DRLStringParam('item', opaque)]);
  Remember(FOUND_ID, FOUND_EN,
    [DRLIntegerParam('depth', 3), DRLStringParam('item', 'pistol')]);
  Remember(OVERLOAD_ID, OVERLOAD_EN,
    [DRLIntegerParam('depth', 4), DRLStringParam('item', 'overcharged pistol')]);
  Remember(COMPLEX_ID, COMPLEX_EN,
    [DRLIntegerParam('depth', 5), DRLStringParam('beings', 'imps')]);
  EnglishSnapshot := Copy(OriginalHistory, 0, Length(OriginalHistory));
  Japanese := False;
  for i := 1 to Length(OriginalHistory) do
    Equal(DRLPresentationHistory(i, OriginalHistory[i-1]), OriginalHistory[i-1],
      'English exact reconstruction');
  Japanese := True;
  Equal(DRLPresentationHistory(1, OriginalHistory[0]),
    B('9223372036854775807階で地獄が凍りついた！'), 'canonical Int64 maximum depth');
  Equal(DRLPresentationHistory(2, OriginalHistory[1]),
    B('-9223372036854775808階でチェーンソードを組み立てた！'),
    'canonical Int64 minimum and deep-copied original parameters');
  Equal(DRLPresentationHistory(3, OriginalHistory[2]),
    B('王者として闘技場を後にした！'), 'real canonical no-parameter Japanese ID');
  Equal(DRLPresentationHistory(4, OriginalHistory[3]),
    B('42階で')+opaque+B('を見つけた！'), 'opaque UTF8/name/template/percent parameter');
  Equal(DRLPresentationHistory(5, OriginalHistory[4]),
    B('3階でピストルを見つけた！'), 'actual generated item registry projection');
  Equal(DRLPresentationHistory(6, OriginalHistory[5]),
    B('4階で過充填したピストルを過負荷にした！'), 'finite original overcharge name projection');
  Equal(DRLPresentationHistory(7, OriginalHistory[6]),
    B('5階でインプだらけの施設に迷い込んだ！'), 'actual generated plural registry projection');
  Equal(DRLPresentationHistory(0, OriginalHistory[0]), OriginalHistory[0], 'invalid index fallback');
  Equal(DRLPresentationHistory(4096, OriginalHistory[0]), OriginalHistory[0], 'unknown index fallback');
  Equal(DRLPresentationHistory(1, 'modified original history'), 'modified original history',
    'actual English guard mismatch fallback');
  savedProjector := DRLSemanticHistoryProjector;
  DRLSemanticHistoryProjector := @AlterIntegerProjector;
  try Equal(DRLPresentationHistory(1, OriginalHistory[0]), OriginalHistory[0],
    'projector cannot alter integer domain snapshot');
  finally DRLSemanticHistoryProjector := savedProjector; end;
  BrokenResolver := True;
  try Equal(DRLPresentationHistory(1, OriginalHistory[0]), OriginalHistory[0],
    'malformed UTF8 resolver output fallback');
  finally BrokenResolver := False; end;
  Check(DRLSaveSemanticHistory(CandidatePath), 'save actual native semantic store');
  ValidJSON := ReadCandidate;
  Check(Pos('9223372036854775807', ValidJSON) > 0, 'maximum Int64 persisted as exact decimal');
  Check(Pos('-9223372036854775808', ValidJSON) > 0, 'minimum Int64 persisted as exact decimal');
  root := ParseCandidate;
  try
    Check(root.Count = 3, 'exact saved root schema');
    Equal(B(ParamAt(RecordAt(root, 1), 1).Get('value', '')), 'chainsword',
      'saved original parameter deep copy');
    Equal(B(RecordAt(root, 1).Get('originalEnglish', '')), OriginalHistory[1],
      'saved English full guard stays original');
  finally root.Free; end;
  DRLClearSemanticHistory;
  Equal(DRLPresentationHistory(1, OriginalHistory[0]), OriginalHistory[0], 'clear removes presentation records');
  Check(DRLLoadSemanticHistory(CandidatePath), 'native save clear load');
  Equal(DRLPresentationHistory(2, OriginalHistory[1]),
    B('-9223372036854775808階でチェーンソードを組み立てた！'), 'native load restores registry projection');
  OriginalHistory[0] := 'altered source history';
  try
    Check(not DRLSaveSemanticHistory(CandidatePath), 'save checks actual original history source');
    Equal(B(ReadCandidate), B(ValidJSON), 'source rejection happens before truncating save');
    Check(not DRLLoadSemanticHistory(CandidatePath), 'load checks actual original history source');
    Equal(DRLPresentationHistory(2, OriginalHistory[1]), OriginalHistory[1],
      'source mismatch invalidates whole loaded presentation');
  finally OriginalHistory[0] := EnglishSnapshot[0]; end;
  for i := 0 to 30 do RejectJSON('structured mutation '+IntToStr(i), MutatedCandidate(i));
  RejectJSON('duplicate root fields', ReplaceOnce(ValidJSON, '"schema"', '"schema":1,"schema"'));
  RejectJSON('duplicate nested fields', ReplaceOnce(ValidJSON, '"kind"', '"kind":"integer","kind"'));
  RejectJSON('trailing JSON document', ValidJSON+' {}');
  RejectJSON('trailing non-JSON bytes', ValidJSON+' trailing');
  RejectJSON('truncated JSON', Copy(ValidJSON, 1, Length(ValidJSON)-1));
  RejectJSON('empty file', '');
  raw := ReplaceOnce(ValidJSON, 'hell froze over!', 'hell '+#$C0#$AF+' froze over!');
  RejectJSON('overlong raw UTF8 sequence', raw);
  raw := ReplaceOnce(ValidJSON, 'hell froze over!', 'hell '+#$80+' froze over!');
  RejectJSON('stray UTF8 continuation byte', raw);
  raw := ReplaceOnce(ValidJSON, 'hell froze over!', 'hell '+#$ED#$A0#$80+' froze over!');
  RejectJSON('raw UTF8 surrogate encoding', raw);
  raw := StringOfChar('[', 9)+'1'+StringOfChar(']', 9);
  RejectJSON('shared JSON depth bound', raw);
  RejectJSON('file greater than one MiB', StringOfChar(' ', DRL_HISTORY_MAX_JSON_BYTES+1));
  many := '{"schema":1,"format":"drl.semantic-history","records":[';
  for i := 1 to DRL_HISTORY_MAX_RECORDS+1 do begin
    if i > 1 then many := many+',';
    many := many+'{"index":"'+IntToStr(i)+'","id":"'+CHAMPION_ID+
      '","english":"'+CHAMPION_EN+'","originalEnglish":"'+CHAMPION_EN+'","params":[]}';
  end;
  many := many+']}';
  Check(Length(many) < DRL_HISTORY_MAX_JSON_BYTES, 'record count fixture within byte limit');
  RejectJSON('more than 4096 records', many);
  WriteCandidate(ValidJSON);
  Check(DRLLoadSemanticHistory(CandidatePath), 'restore after all malformed candidates');
  savedValidator := DRLSemanticHistoryValidator;
  DRLSemanticHistoryValidator := nil;
  try Check(not DRLLoadSemanticHistory(CandidatePath), 'missing whitelist fails closed');
  finally DRLSemanticHistoryValidator := savedValidator; end;
  Check(DRLLoadSemanticHistory(CandidatePath), 'restore generated validator');
  DRLSemanticHistorySource := nil;
  try Check(not DRLLoadSemanticHistory(CandidatePath), 'missing original-source reader fails closed');
  finally DRLSemanticHistorySource := @OriginalSource; end;
  Check(DRLLoadSemanticHistory(CandidatePath), 'restore original-source reader');
  Check(not DRLRememberSemanticHistory(Length(OriginalHistory)+1, CHAMPION_EN,
    'history.custom-unknown', CHAMPION_EN, []), 'unwhitelisted append rejected');
  Check(not DRLRememberSemanticHistory(Length(OriginalHistory)+1, CHAMPION_EN,
    CHAMPION_ID, CHAMPION_EN, []), 'remember exact source index guard');
  SetLength(p, 1); p[0] := DRLStringParam('depth', '042');
  p[0].Kind := DRL_TEXT_INTEGER;
  Check(not DRLRememberSemanticHistory(Length(OriginalHistory)+1,
    'On level 42, hell froze over!', FROZEN_ID, FROZEN_EN, p),
    'remember rejects noncanonical integer parameter');
  Check(not DRLRememberSemanticHistory(Length(OriginalHistory)+1,
    'On level 42, hell froze over!', FROZEN_ID, FROZEN_EN,
    [DRLIntegerParam('depth', 42), DRLIntegerParam('depth', 42)]),
    'remember rejects duplicate named parameters');
  DRLSemanticHistoryCurrentSource := nil;
  try Check(not DRLRememberCurrentSemanticHistory(CHAMPION_ID, CHAMPION_EN, []),
    'missing current-source reader cannot remember');
  finally DRLSemanticHistoryCurrentSource := @CurrentSource; end;
  Check(not DRLRememberSemanticHistory(Length(OriginalHistory), OriginalHistory[High(OriginalHistory)],
    COMPLEX_ID, COMPLEX_EN,
    [DRLIntegerParam('depth', 5), DRLStringParam('beings', 'imps')]), 'duplicate index disables stale replay');
  Equal(DRLPresentationHistory(1, OriginalHistory[0]), OriginalHistory[0], 'duplicate append fallback');
  Check(DRLLoadSemanticHistory(CandidatePath), 'restore after duplicate append');
  DeleteCandidate;
  Check(not DRLLoadSemanticHistory(CandidatePath), 'missing sidecar rejected');
  Equal(DRLPresentationHistory(1, OriginalHistory[0]), OriginalHistory[0], 'missing sidecar English fallback');
  CheckOriginals;
  expected := B('9223372036854775807階で地獄が凍りついた！');
  Check(expected <> OriginalHistory[0], 'Japanese fixture differs from original English');
end;
begin
  SetMultiByteConversionCodePage(CP_UTF8);
  if ParamCount <> 1 then raise Exception.Create('Supply one initially absent isolated JSON path');
  CandidatePath := B(ParamStr(1));
  if (CandidatePath = '') or DirectoryExists(CandidatePath) or FileExists(CandidatePath) then
    raise Exception.Create('Probe candidate must be an initially absent isolated file');
  try
    RunProbe;
    Writeln('{"native_history_checks":',Checks,',"rejected_loads":',RejectedLoads,
      ',"actual_history_unit":true,"actual_generated_catalog":true,',
      '"original_english_unchanged":true,"utf8":true,"int64":true}');
  finally
    DRLSemanticTextResolver := nil;
    DRLClearSemanticHistory;
    DeleteCandidate;
  end;
end.
