{ DRL semantic feeling presentation sidecar. SPDX-License-Identifier: GPL-2.0-only.
  The original level feeling and native save bytes remain English and untouched.
  Install the generated, exact-template catalog validator before remembering or
  loading records. A nil validator fails closed. Parameters contain ORIGINAL
  English values; resolve their presentation only through DRLText on replay.

  The JSON file uses ordinary Classes file I/O, including the browser /user VFS.
  The caller may report a metadata failure while still committing the valid
  original game save. Any written file is closed before the save witness.
  Failed load disables replay; no partially decoded candidate becomes visible.
  No simulation state, hooks, input, or random-number generator is accessed. }
unit drlsemanticfeelings;
{$mode objfpc}{$H+}{$B-}
interface
uses drlsemantictext;

const
  DRL_FEELING_SIDECAR_FILE = '/user/drl.presentation.json';
  DRL_FEELING_SCHEMA = 1;
  DRL_FEELING_MAX_RECORDS = 256;
  DRL_FEELING_MAX_PARAMS = 16;
  DRL_FEELING_MAX_TEXT_BYTES = 32768;
  DRL_FEELING_MAX_JSON_BYTES = 1048576;

type
  TDRLSemanticFeelingValidator = function(
    const aID, aEnglish: AnsiString;
    const aParams: array of TDRLTextParam
  ): Boolean;

var DRLSemanticFeelingValidator: TDRLSemanticFeelingValidator = nil;

procedure DRLClearSemanticFeelings;
function DRLRememberSemanticFeeling(const aID, aEnglish: AnsiString;
  const aParams: array of TDRLTextParam;
  const aJoinBefore, aFullEnglishGuard: AnsiString): Boolean;
function DRLRepeatSemanticFeeling(
  const aFullOriginalEnglishGuard: AnsiString): AnsiString;
function DRLSaveSemanticFeelings(
  const aFilename: AnsiString = DRL_FEELING_SIDECAR_FILE): Boolean;
function DRLLoadSemanticFeelings(const aFilename,
  aExpectedEnglishGuard: AnsiString): Boolean;
{ Shared strict data-boundary helpers for other presentation-only sidecars. }
function DRLSemanticValidUTF8(const aText: AnsiString; aLimit: SizeInt): Boolean;
function DRLSemanticPreflightJSON(const aData: RawByteString): Boolean;
function DRLSemanticByteString(const aText: RawByteString): AnsiString;

implementation
uses Classes, SysUtils, fpjson, jsonscanner, jsonparser;

const
  SIDECAR_FORMAT = 'drl.semantic-feelings';
  MAX_JSON_DEPTH = 8;
  MAX_JSON_TOKENS = 100000;

type
  TDRLFeelingParams = array of TDRLTextParam;
  TDRLFeelingRecord = record
    ID, English, JoinBefore: AnsiString;
    Params: TDRLFeelingParams;
  end;
  TDRLFeelingRecords = array of TDRLFeelingRecord;

var
  FRecords: TDRLFeelingRecords;
  FEnglishGuard: AnsiString = '';
  FTextBytes: SizeInt = 0;
  FUsable: Boolean = True;

{ AnsiString is the original game's byte-string boundary. Copy bytes explicitly
  instead of converting between UTF8String and a Windows ANSI code page. }
function ByteString(const aValue: RawByteString): AnsiString;
begin
  SetLength(Result, Length(aValue));
  if Length(aValue) > 0 then Move(aValue[1], Result[1], Length(aValue));
end;

function JSONString(const aValue: AnsiString): TJSONStringType;
begin
  SetLength(Result, Length(aValue));
  if Length(aValue) > 0 then Move(aValue[1], Result[1], Length(aValue));
end;

{ Strict Unicode scalar UTF-8: reject NUL, overlong encodings, surrogate code
  points, stray continuations, truncated sequences, and values above U+10FFFF. }
function ValidUTF8(const aValue: RawByteString; aLimit: SizeInt): Boolean;
var i, j, needed: SizeInt; first, next: Byte; scalar, minimum: LongWord;
begin
  Result := False;
  if Length(aValue) > aLimit then Exit;
  i := 1;
  while i <= Length(aValue) do begin
    first := Ord(aValue[i]);
    if first = 0 then Exit;
    if first < $80 then begin Inc(i); Continue; end;
    if (first >= $C2) and (first <= $DF) then begin
      needed := 1; scalar := first and $1F; minimum := $80;
    end else if (first >= $E0) and (first <= $EF) then begin
      needed := 2; scalar := first and $0F; minimum := $800;
    end else if (first >= $F0) and (first <= $F4) then begin
      needed := 3; scalar := first and $07; minimum := $10000;
    end else Exit;
    if needed > Length(aValue) - i then Exit;
    for j := 1 to needed do begin
      next := Ord(aValue[i+j]);
      if (next < $80) or (next > $BF) then Exit;
      scalar := (scalar shl 6) or (next and $3F);
    end;
    if (scalar < minimum) or (scalar > $10FFFF) or
      ((scalar >= $D800) and (scalar <= $DFFF)) then Exit;
    Inc(i, needed + 1);
  end;
  Result := True;
end;

function ValidName(const aName: AnsiString; aID: Boolean): Boolean;
var i, limit: SizeInt;
begin
  if aID then limit := 160 else limit := 64;
  if (Length(aName) = 0) or (Length(aName) > limit) then Exit(False);
  if not (aName[1] in ['a'..'z']) then Exit(False);
  for i := 2 to Length(aName) do
    if not ((aName[i] in ['a'..'z','0'..'9','_']) or
      (aID and (aName[i] in ['.','-']))) then Exit(False);
  Result := True;
end;

function AddTextBytes(var aTotal: SizeInt; aLength: SizeInt): Boolean;
begin
  Result := (aLength >= 0) and
    (aLength <= DRL_FEELING_MAX_TEXT_BYTES - aTotal);
  if Result then Inc(aTotal, aLength);
end;

function ValidateRecord(const aRecord: TDRLFeelingRecord;
  out aRenderedEnglish: AnsiString; out aTextBytes: SizeInt): Boolean;
var i, j: SizeInt; number: Int64;
begin
  Result := False;
  aRenderedEnglish := '';
  aTextBytes := 0;
  if not Assigned(DRLSemanticFeelingValidator) then Exit;
  if not ValidName(aRecord.ID, True) or
    not ValidUTF8(aRecord.English, DRL_FEELING_MAX_TEXT_BYTES) or
    not ValidUTF8(aRecord.JoinBefore, DRL_FEELING_MAX_TEXT_BYTES) or
    (Length(aRecord.Params) > DRL_FEELING_MAX_PARAMS) then Exit;
  if not AddTextBytes(aTextBytes, Length(aRecord.ID)) or
    not AddTextBytes(aTextBytes, Length(aRecord.English)) or
    not AddTextBytes(aTextBytes, Length(aRecord.JoinBefore)) then Exit;
  for i := 0 to High(aRecord.Params) do begin
    if not ValidName(aRecord.Params[i].Name, False) or
      not ValidUTF8(aRecord.Params[i].Value, DRL_FEELING_MAX_TEXT_BYTES) then Exit;
    case aRecord.Params[i].Kind of
      DRL_TEXT_STRING: ;
      DRL_TEXT_INTEGER:
        if not TryStrToInt64(aRecord.Params[i].Value, number) or
          (IntToStr(number) <> aRecord.Params[i].Value) then Exit;
      else Exit;
    end;
    for j := 0 to i-1 do
      if aRecord.Params[j].Name = aRecord.Params[i].Name then Exit;
    if not AddTextBytes(aTextBytes, Length(aRecord.Params[i].Name)) or
      not AddTextBytes(aTextBytes, Length(aRecord.Params[i].Value)) then Exit;
  end;
  { The whitelist checks known ID, exact original template, and named kinds.
    DRLEnglishText separately checks the full placeholder contract, without
    invoking the installed presentation resolver. Both may reject by exception. }
  if not DRLSemanticFeelingValidator(aRecord.ID, aRecord.English,
    aRecord.Params) then Exit;
  aRenderedEnglish := DRLEnglishText(aRecord.ID, aRecord.English, aRecord.Params);
  Result := ValidUTF8(aRenderedEnglish, DRL_FEELING_MAX_TEXT_BYTES);
end;

function ValidateRecords(const aRecords: TDRLFeelingRecords;
  const aGuard: AnsiString; out aTotal: SizeInt): Boolean;
var i, textBytes: SizeInt; english, cumulative: AnsiString;
begin
  Result := False;
  aTotal := 0;
  if not Assigned(DRLSemanticFeelingValidator) or
    (Length(aRecords) > DRL_FEELING_MAX_RECORDS) or
    not ValidUTF8(aGuard, DRL_FEELING_MAX_TEXT_BYTES) then Exit;
  cumulative := '';
  for i := 0 to High(aRecords) do begin
    if not ValidateRecord(aRecords[i], english, textBytes) or
      not AddTextBytes(aTotal, textBytes) then Exit;
    if (Length(aRecords[i].JoinBefore) > DRL_FEELING_MAX_TEXT_BYTES - Length(cumulative))
      or (Length(english) > DRL_FEELING_MAX_TEXT_BYTES - Length(cumulative) -
      Length(aRecords[i].JoinBefore)) then Exit;
    cumulative := cumulative + aRecords[i].JoinBefore + english;
  end;
  Result := cumulative = aGuard;
end;

procedure DRLClearSemanticFeelings;
begin
  SetLength(FRecords, 0);
  FEnglishGuard := '';
  FTextBytes := 0;
  FUsable := True;
end;

function DRLRememberSemanticFeeling(const aID, aEnglish: AnsiString;
  const aParams: array of TDRLTextParam;
  const aJoinBefore, aFullEnglishGuard: AnsiString): Boolean;
var candidate: TDRLFeelingRecord; i, bytes, total: SizeInt;
    rendered, cumulative: AnsiString;
begin
  Result := False;
  if not FUsable then Exit;
  { Disable first so every early Exit/exception remains fail-closed. }
  FUsable := False;
  try
    if (Length(FRecords) >= DRL_FEELING_MAX_RECORDS) or
      not ValidUTF8(aFullEnglishGuard, DRL_FEELING_MAX_TEXT_BYTES) or
      (Length(aParams) > DRL_FEELING_MAX_PARAMS) then Exit;
    candidate.ID := ByteString(aID);
    candidate.English := ByteString(aEnglish);
    candidate.JoinBefore := ByteString(aJoinBefore);
    SetLength(candidate.Params, Length(aParams));
    for i := 0 to High(aParams) do begin
      candidate.Params[i].Name := ByteString(aParams[i].Name);
      candidate.Params[i].Value := ByteString(aParams[i].Value);
      candidate.Params[i].Kind := aParams[i].Kind;
    end;
    if not ValidateRecord(candidate, rendered, bytes) then Exit;
    total := FTextBytes;
    if not AddTextBytes(total, bytes) then Exit;
    if (Length(aJoinBefore) > DRL_FEELING_MAX_TEXT_BYTES - Length(FEnglishGuard)) or
      (Length(rendered) > DRL_FEELING_MAX_TEXT_BYTES - Length(FEnglishGuard) -
      Length(aJoinBefore)) then Exit;
    cumulative := FEnglishGuard + candidate.JoinBefore + rendered;
    if cumulative <> aFullEnglishGuard then Exit;
    SetLength(FRecords, Length(FRecords) + 1);
    FRecords[High(FRecords)] := candidate;
    FEnglishGuard := cumulative;
    FTextBytes := total;
    FUsable := True;
    Result := True;
  except
    Result := False;
  end;
  { Failure cannot re-enable a prefix after an unrecorded original message.
    The caller's next reset or successful complete load establishes a new store. }
end;

function DRLRepeatSemanticFeeling(
  const aFullOriginalEnglishGuard: AnsiString): AnsiString;
var i, bytes: SizeInt; translated, replay: AnsiString;
begin
  Result := aFullOriginalEnglishGuard;
  try
    if not FUsable or (FEnglishGuard <> aFullOriginalEnglishGuard) or
      not ValidateRecords(FRecords, aFullOriginalEnglishGuard, bytes) then Exit;
    replay := '';
    for i := 0 to High(FRecords) do begin
      translated := DRLText(FRecords[i].ID, FRecords[i].English, FRecords[i].Params);
      if not ValidUTF8(translated, DRL_FEELING_MAX_TEXT_BYTES) or
        (Length(FRecords[i].JoinBefore) > DRL_FEELING_MAX_TEXT_BYTES - Length(replay)) or
        (Length(translated) > DRL_FEELING_MAX_TEXT_BYTES - Length(replay) -
        Length(FRecords[i].JoinBefore)) then Exit;
      replay := replay + FRecords[i].JoinBefore + translated;
    end;
    Result := replay;
  except
    Result := aFullOriginalEnglishGuard;
  end;
end;

function SerializeRecords: RawByteString;
var root, entry, param: TJSONObject; records, params: TJSONArray;
    i, j: SizeInt;
begin
  root := TJSONObject.Create;
  try
    root.Add('schema', Integer(DRL_FEELING_SCHEMA));
    root.Add('format', JSONString(SIDECAR_FORMAT));
    root.Add('englishGuard', JSONString(FEnglishGuard));
    records := TJSONArray.Create;
    root.Add('records', records);
    for i := 0 to High(FRecords) do begin
      entry := TJSONObject.Create;
      records.Add(entry);
      entry.Add('id', JSONString(FRecords[i].ID));
      entry.Add('english', JSONString(FRecords[i].English));
      entry.Add('joinBefore', JSONString(FRecords[i].JoinBefore));
      params := TJSONArray.Create;
      entry.Add('params', params);
      for j := 0 to High(FRecords[i].Params) do begin
        param := TJSONObject.Create;
        params.Add(param);
        param.Add('name', JSONString(FRecords[i].Params[j].Name));
        case FRecords[i].Params[j].Kind of
          DRL_TEXT_STRING: param.Add('kind', JSONString('string'));
          DRL_TEXT_INTEGER: param.Add('kind', JSONString('integer'));
        end;
        { Decimal integers are strings, never lossy JSON floating point. }
        param.Add('value', JSONString(FRecords[i].Params[j].Value));
      end;
    end;
    Result := root.AsJSON;
  finally
    root.Free;
  end;
end;

function DRLSaveSemanticFeelings(const aFilename: AnsiString): Boolean;
var stream: TFileStream; data: RawByteString; bytes: SizeInt;
begin
  Result := False;
  try
    if not FUsable or (aFilename = '') or (Pos(#0, aFilename) > 0) or
      not ValidateRecords(FRecords, FEnglishGuard, bytes) then Exit;
    data := SerializeRecords;
    if not ValidUTF8(data, DRL_FEELING_MAX_JSON_BYTES) then Exit;
    { Serialize and validate before truncating; closing this ordinary VFS file
      lets the browser wrap it in its versioned, SHA-256 checkpoint envelope. }
    stream := TFileStream.Create(aFilename, fmCreate);
    try
      if Length(data) > 0 then stream.WriteBuffer(data[1], Length(data));
    finally
      stream.Free;
    end;
    Result := True;
  except
    Result := False;
  end;
end;

{ Bound lexical nesting before the standard recursive parser. Its strict mode
  rejects comments, trailing commas, unquoted names, invalid escapes, duplicate
  object keys, and trailing content (joSingle/joIgnoreDuplicates are absent). }
function PreflightJSON(const aData: RawByteString): Boolean;
var scanner: TJSONScanner; token: TJSONToken; depth, tokens: SizeInt;
    nesting: array[1..MAX_JSON_DEPTH] of TJSONToken;
begin
  Result := False;
  if not ValidUTF8(aData, DRL_FEELING_MAX_JSON_BYTES) then Exit;
  scanner := TJSONScanner.Create(aData, [joUTF8, joStrict]);
  try
    depth := 0;
    tokens := 0;
    repeat
      token := scanner.FetchToken;
      Inc(tokens);
      if tokens > MAX_JSON_TOKENS then Exit;
      case token of
        tkCurlyBraceOpen, tkSquaredBraceOpen: begin
          if depth >= MAX_JSON_DEPTH then Exit;
          Inc(depth);
          nesting[depth] := token;
        end;
        tkCurlyBraceClose, tkSquaredBraceClose: begin
          if depth = 0 then Exit;
          if ((token = tkCurlyBraceClose) and (nesting[depth] <> tkCurlyBraceOpen)) or
            ((token = tkSquaredBraceClose) and (nesting[depth] <> tkSquaredBraceOpen)) then Exit;
          Dec(depth);
        end;
        tkString:
          if not ValidUTF8(scanner.CurTokenString, DRL_FEELING_MAX_TEXT_BYTES) then Exit;
        { The only numeric JSON value in schema 1 is the version itself.
          Integer parameter values are quoted decimal strings. Reject other
          numeric lexemes before the parser tries unbounded numeric conversion. }
        tkNumber:
          if scanner.CurTokenString <> '1' then Exit;
        tkIdentifier, tkComment, tkUnknown: Exit;
      end;
    until token = tkEOF;
    Result := depth = 0;
  finally
    scanner.Free;
  end;
end;

function ReadString(aObject: TJSONObject; const aName: TJSONStringType;
  out aValue: AnsiString): Boolean;
var data: TJSONData;
begin
  data := aObject.Find(aName);
  if (data = nil) or (data.JSONType <> jtString) then Exit(False);
  aValue := ByteString(data.AsString);
  Result := ValidUTF8(aValue, DRL_FEELING_MAX_TEXT_BYTES);
end;

function DecodeRecords(aRoot: TJSONData; const aExpectedEnglishGuard: AnsiString;
  out aRecords: TDRLFeelingRecords; out aGuard: AnsiString;
  out aBytes: SizeInt): Boolean;
var root, entry, param: TJSONObject; data, schema: TJSONData;
    records, params: TJSONArray; i, j: SizeInt; formatName, kind: AnsiString;
begin
  Result := False;
  if (aRoot = nil) or (aRoot.JSONType <> jtObject) then Exit;
  root := TJSONObject(aRoot);
  if root.Count <> 4 then Exit;
  schema := root.Find('schema');
  if (schema = nil) or (schema.JSONType <> jtNumber) then Exit;
  if (TJSONNumber(schema).NumberType = ntFloat) or
    (schema.AsJSON <> '1') then Exit;
  if not ReadString(root, 'format', formatName) or (formatName <> SIDECAR_FORMAT) or
    not ReadString(root, 'englishGuard', aGuard) or
    (aGuard <> aExpectedEnglishGuard) then Exit;
  data := root.Find('records');
  if (data = nil) or (data.JSONType <> jtArray) then Exit;
  records := TJSONArray(data);
  if records.Count > DRL_FEELING_MAX_RECORDS then Exit;
  SetLength(aRecords, records.Count);
  for i := 0 to records.Count - 1 do begin
    if records.Items[i].JSONType <> jtObject then Exit;
    entry := TJSONObject(records.Items[i]);
    if (entry.Count <> 4) or
      not ReadString(entry, 'id', aRecords[i].ID) or
      not ReadString(entry, 'english', aRecords[i].English) or
      not ReadString(entry, 'joinBefore', aRecords[i].JoinBefore) then Exit;
    data := entry.Find('params');
    if (data = nil) or (data.JSONType <> jtArray) then Exit;
    params := TJSONArray(data);
    if params.Count > DRL_FEELING_MAX_PARAMS then Exit;
    SetLength(aRecords[i].Params, params.Count);
    for j := 0 to params.Count - 1 do begin
      if params.Items[j].JSONType <> jtObject then Exit;
      param := TJSONObject(params.Items[j]);
      if (param.Count <> 3) or
        not ReadString(param, 'name', aRecords[i].Params[j].Name) or
        not ReadString(param, 'kind', kind) or
        not ReadString(param, 'value', aRecords[i].Params[j].Value) then Exit;
      if kind = 'string' then aRecords[i].Params[j].Kind := DRL_TEXT_STRING
      else if kind = 'integer' then aRecords[i].Params[j].Kind := DRL_TEXT_INTEGER
      else Exit;
    end;
  end;
  Result := ValidateRecords(aRecords, aGuard, aBytes);
end;

function DRLLoadSemanticFeelings(const aFilename,
  aExpectedEnglishGuard: AnsiString): Boolean;
var stream: TFileStream; data: RawByteString; size: Int64;
    parser: TJSONParser; root: TJSONData; candidate: TDRLFeelingRecords;
    guard: AnsiString; bytes: SizeInt;
begin
  Result := False;
  { A rejected/missing sidecar must use the native English fallback, even if a
    previous record store happened to have the same original-English guard. }
  FUsable := False;
  try
    if not Assigned(DRLSemanticFeelingValidator) or (aFilename = '') or
      (Pos(#0, aFilename) > 0) or
      not ValidUTF8(aExpectedEnglishGuard, DRL_FEELING_MAX_TEXT_BYTES) then Exit;
    stream := TFileStream.Create(aFilename, fmOpenRead or fmShareDenyNone);
    try
      size := stream.Size;
      if (size <= 0) or (size > DRL_FEELING_MAX_JSON_BYTES) then Exit;
      SetLength(data, SizeInt(size));
      stream.ReadBuffer(data[1], Length(data));
      { Reject growth during the read instead of accepting an unchecked suffix. }
      if stream.Size <> size then Exit;
    finally
      stream.Free;
    end;
    if not PreflightJSON(data) then Exit;
    parser := TJSONParser.Create(data, [joUTF8, joStrict]);
    try
      root := parser.Parse;
      try
        if not DecodeRecords(root, aExpectedEnglishGuard, candidate, guard, bytes) then Exit;
      finally
        root.Free;
      end;
    finally
      parser.Free;
    end;
    { Commit the complete validated candidate. No candidate aliases the prior
      arrays, and failures above do not expose partially constructed records. }
    FRecords := candidate;
    FEnglishGuard := guard;
    FTextBytes := bytes;
    FUsable := True;
    Result := True;
  except
    FUsable := False;
    Result := False;
  end;
end;

function DRLSemanticValidUTF8(const aText: AnsiString; aLimit: SizeInt): Boolean;
begin
  Exit(ValidUTF8(aText, aLimit));
end;

function DRLSemanticPreflightJSON(const aData: RawByteString): Boolean;
begin
  Exit(PreflightJSON(aData));
end;

function DRLSemanticByteString(const aText: RawByteString): AnsiString;
begin
  Exit(ByteString(aText));
end;

end.
