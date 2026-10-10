{ Presentation-only DRL history records. SPDX-License-Identifier: GPL-2.0-only.
  Original player.__props.history/native save text stays English. Source callbacks
  read that original array; this unit accesses no player, hooks, RNG or properties.
  JSON load is bounded and atomic. Missing/rejected metadata falls back to English. }
unit drlsemantichistory;
{$mode objfpc}{$H+}{$B-}
interface
uses drlsemantictext;
const
  DRL_HISTORY_SIDECAR_FILE = '/user/drl.presentation-history.json';
  DRL_HISTORY_SCHEMA = 1;
  DRL_HISTORY_MAX_RECORDS = 4096;
  DRL_HISTORY_MAX_PARAMS = 16;
  DRL_HISTORY_MAX_TEXT_BYTES = 32768;
  DRL_HISTORY_MAX_JSON_BYTES = 1048576;
type
  TDRLHistoryParams = array of TDRLTextParam;
  TDRLSemanticHistoryValidator = function(const aID, aEnglish: AnsiString;
    const aParams: array of TDRLTextParam): Boolean;
  TDRLSemanticHistorySource = function(aIndex: Int64;
    out aOriginalEnglish: AnsiString): Boolean;
  TDRLSemanticHistoryCurrentSource = function(out aIndex: Int64;
    out aOriginalEnglish: AnsiString): Boolean;
  TDRLSemanticHistoryProjector = function(const aID: AnsiString;
    const aOriginalParams: array of TDRLTextParam;
    out aPresentationParams: TDRLHistoryParams): Boolean;
var
  DRLSemanticHistoryValidator: TDRLSemanticHistoryValidator = nil;
  DRLSemanticHistorySource: TDRLSemanticHistorySource = nil;
  DRLSemanticHistoryCurrentSource: TDRLSemanticHistoryCurrentSource = nil;
  DRLSemanticHistoryProjector: TDRLSemanticHistoryProjector = nil;
procedure DRLClearSemanticHistory;
function DRLRememberSemanticHistory(aIndex: Int64;
  const aOriginalEnglishGuard, aID, aEnglishTemplate: AnsiString;
  const aParams: array of TDRLTextParam): Boolean;
function DRLRememberCurrentSemanticHistory(const aID, aEnglishTemplate: AnsiString;
  const aParams: array of TDRLTextParam): Boolean;
function DRLPresentationHistory(aIndex: Int64;
  const aActualOriginalEnglish: AnsiString): AnsiString;
function DRLSaveSemanticHistory(
  const aFilename: AnsiString = DRL_HISTORY_SIDECAR_FILE): Boolean;
function DRLLoadSemanticHistory(
  const aFilename: AnsiString = DRL_HISTORY_SIDECAR_FILE): Boolean;
implementation
uses Classes, SysUtils, fpjson, jsonscanner, jsonparser, drlsemanticfeelings;
const SIDECAR_FORMAT = 'drl.semantic-history';
type
  TDRLHistoryRecord = record
    Index: Int64;
    ID, EnglishTemplate, OriginalEnglishGuard: AnsiString;
    Params: TDRLHistoryParams;
  end;
  TDRLHistoryRecords = array of TDRLHistoryRecord;
var FRecords: TDRLHistoryRecords; FUsable: Boolean = True;

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

function ValidParams(const aParams: array of TDRLTextParam;
  out aBytes: SizeInt): Boolean;
var i, j: SizeInt; number: Int64;
begin
  Result := False; aBytes := 0;
  if Length(aParams) > DRL_HISTORY_MAX_PARAMS then Exit;
  for i := 0 to High(aParams) do begin
    if not ValidName(aParams[i].Name, False) or
      not DRLSemanticValidUTF8(aParams[i].Value, DRL_HISTORY_MAX_TEXT_BYTES) then Exit;
    case aParams[i].Kind of
      DRL_TEXT_STRING: ;
      DRL_TEXT_INTEGER:
        if not TryStrToInt64(aParams[i].Value, number) or
          (IntToStr(number) <> aParams[i].Value) then Exit;
      else Exit;
    end;
    for j := 0 to i-1 do if aParams[j].Name = aParams[i].Name then Exit;
    if Length(aParams[i].Name) > DRL_HISTORY_MAX_TEXT_BYTES - aBytes then Exit;
    Inc(aBytes, Length(aParams[i].Name));
    if Length(aParams[i].Value) > DRL_HISTORY_MAX_TEXT_BYTES - aBytes then Exit;
    Inc(aBytes, Length(aParams[i].Value));
  end;
  Result := True;
end;

function ValidateRecord(const aRecord: TDRLHistoryRecord;
  aCheckSource: Boolean; out aBytes: SizeInt): Boolean;
var original, rendered: AnsiString; paramsBytes: SizeInt;
begin
  Result := False; aBytes := 0;
  if not Assigned(DRLSemanticHistoryValidator) or (aRecord.Index < 1) or
    not ValidName(aRecord.ID, True) or
    not DRLSemanticValidUTF8(aRecord.EnglishTemplate, DRL_HISTORY_MAX_TEXT_BYTES) or
    not DRLSemanticValidUTF8(aRecord.OriginalEnglishGuard, DRL_HISTORY_MAX_TEXT_BYTES) or
    not ValidParams(aRecord.Params, paramsBytes) then Exit;
  if not DRLSemanticHistoryValidator(aRecord.ID, aRecord.EnglishTemplate,
    aRecord.Params) then Exit;
  rendered := DRLEnglishText(aRecord.ID, aRecord.EnglishTemplate, aRecord.Params);
  if rendered <> aRecord.OriginalEnglishGuard then Exit;
  if aCheckSource then begin
    if not Assigned(DRLSemanticHistorySource) or
      not DRLSemanticHistorySource(aRecord.Index, original) or
      (original <> aRecord.OriginalEnglishGuard) then Exit;
  end;
  aBytes := Length(aRecord.ID) + Length(aRecord.EnglishTemplate) +
    Length(aRecord.OriginalEnglishGuard) + paramsBytes;
  Result := aBytes <= DRL_HISTORY_MAX_TEXT_BYTES;
end;

function ValidateRecords(const aRecords: TDRLHistoryRecords;
  aCheckSource: Boolean): Boolean;
var i, bytes, total: SizeInt; previous: Int64;
begin
  Result := False; total := 0; previous := 0;
  if Length(aRecords) > DRL_HISTORY_MAX_RECORDS then Exit;
  if not Assigned(DRLSemanticHistoryValidator) then Exit;
  for i := 0 to High(aRecords) do begin
    if (aRecords[i].Index <= previous) or
      not ValidateRecord(aRecords[i], aCheckSource, bytes) or
      (bytes > DRL_HISTORY_MAX_JSON_BYTES - total) then Exit;
    previous := aRecords[i].Index; Inc(total, bytes);
  end;
  Result := True;
end;

procedure DRLClearSemanticHistory;
begin
  SetLength(FRecords, 0); FUsable := True;
end;

function DRLRememberSemanticHistory(aIndex: Int64;
  const aOriginalEnglishGuard, aID, aEnglishTemplate: AnsiString;
  const aParams: array of TDRLTextParam): Boolean;
var candidate: TDRLHistoryRecord; proposed: TDRLHistoryRecords; i, bytes: SizeInt;
begin
  Result := False;
  try
    if not FUsable or (Length(FRecords) >= DRL_HISTORY_MAX_RECORDS) or
      (Length(aParams) > DRL_HISTORY_MAX_PARAMS) then Exit;
    { A repeated/backwards index can indicate a new run or altered original
      history. Disable stale replay; callers establish a fresh store by Clear. }
    if (Length(FRecords) > 0) and (aIndex <= FRecords[High(FRecords)].Index) then begin
      FUsable := False; Exit;
    end;
    candidate.Index := aIndex;
    candidate.ID := DRLSemanticByteString(aID);
    candidate.EnglishTemplate := DRLSemanticByteString(aEnglishTemplate);
    candidate.OriginalEnglishGuard := DRLSemanticByteString(aOriginalEnglishGuard);
    SetLength(candidate.Params, Length(aParams));
    for i := 0 to High(aParams) do begin
      candidate.Params[i].Name := DRLSemanticByteString(aParams[i].Name);
      candidate.Params[i].Value := DRLSemanticByteString(aParams[i].Value);
      candidate.Params[i].Kind := aParams[i].Kind;
    end;
    if not ValidateRecord(candidate, True, bytes) then Exit;
    SetLength(proposed, Length(FRecords) + 1);
    for i := 0 to High(FRecords) do proposed[i] := FRecords[i];
    proposed[High(proposed)] := candidate;
    if not ValidateRecords(proposed, True) then Exit;
    FRecords := proposed; Result := True;
  except
    Result := False;
  end;
end;

function DRLRememberCurrentSemanticHistory(const aID, aEnglishTemplate: AnsiString;
  const aParams: array of TDRLTextParam): Boolean;
var index: Int64; original: AnsiString;
begin
  Result := False;
  try
    if not Assigned(DRLSemanticHistoryCurrentSource) or
      not DRLSemanticHistoryCurrentSource(index, original) then Exit;
    Result := DRLRememberSemanticHistory(index, original, aID, aEnglishTemplate, aParams);
  except
    Result := False;
  end;
end;

function DRLPresentationHistory(aIndex: Int64;
  const aActualOriginalEnglish: AnsiString): AnsiString;
var i, j, bytes, projectedBytes: SizeInt; projected: TDRLHistoryParams;
begin
  Result := aActualOriginalEnglish;
  try
    if not FUsable or (aIndex < 1) or
      not DRLSemanticValidUTF8(aActualOriginalEnglish, DRL_HISTORY_MAX_TEXT_BYTES) then Exit;
    for i := 0 to High(FRecords) do if FRecords[i].Index = aIndex then begin
      if (FRecords[i].OriginalEnglishGuard <> aActualOriginalEnglish) or
        not ValidateRecord(FRecords[i], False, bytes) then Exit;
      SetLength(projected, Length(FRecords[i].Params));
      for j := 0 to High(projected) do projected[j] := FRecords[i].Params[j];
      if Assigned(DRLSemanticHistoryProjector) and
        not DRLSemanticHistoryProjector(FRecords[i].ID, FRecords[i].Params, projected) then Exit;
      if not ValidParams(projected, projectedBytes) or
        (Length(projected) <> Length(FRecords[i].Params)) then Exit;
      for j := 0 to High(projected) do
        if (projected[j].Name <> FRecords[i].Params[j].Name) or
          (projected[j].Kind <> FRecords[i].Params[j].Kind) or
          ((projected[j].Kind = DRL_TEXT_INTEGER) and
           (projected[j].Value <> FRecords[i].Params[j].Value)) then Exit;
      Result := DRLText(FRecords[i].ID, FRecords[i].EnglishTemplate, projected);
      if not DRLSemanticValidUTF8(Result, DRL_HISTORY_MAX_TEXT_BYTES) then
        Result := aActualOriginalEnglish;
      Exit;
    end;
  except
    Result := aActualOriginalEnglish;
  end;
end;

function JSONString(const aValue: AnsiString): TJSONStringType;
begin
  SetLength(Result, Length(aValue));
  if Length(aValue) > 0 then Move(aValue[1], Result[1], Length(aValue));
end;

function SerializeRecords: RawByteString;
var root, entry, param: TJSONObject; records, params: TJSONArray; i, j: SizeInt;
begin
  root := TJSONObject.Create;
  try
    root.Add('schema', Integer(DRL_HISTORY_SCHEMA));
    root.Add('format', JSONString(SIDECAR_FORMAT));
    records := TJSONArray.Create; root.Add('records', records);
    for i := 0 to High(FRecords) do begin
      entry := TJSONObject.Create; records.Add(entry);
      { All potentially large indices/integers are canonical decimal strings. }
      entry.Add('index', JSONString(IntToStr(FRecords[i].Index)));
      entry.Add('id', JSONString(FRecords[i].ID));
      entry.Add('english', JSONString(FRecords[i].EnglishTemplate));
      entry.Add('originalEnglish', JSONString(FRecords[i].OriginalEnglishGuard));
      params := TJSONArray.Create; entry.Add('params', params);
      for j := 0 to High(FRecords[i].Params) do begin
        param := TJSONObject.Create; params.Add(param);
        param.Add('name', JSONString(FRecords[i].Params[j].Name));
        if FRecords[i].Params[j].Kind = DRL_TEXT_INTEGER then param.Add('kind', JSONString('integer'))
          else param.Add('kind', JSONString('string'));
        param.Add('value', JSONString(FRecords[i].Params[j].Value));
      end;
    end;
    Result := root.AsJSON;
  finally root.Free; end;
end;

function DRLSaveSemanticHistory(const aFilename: AnsiString): Boolean;
var data: RawByteString; stream: TFileStream;
begin
  Result := False;
  try
    if not FUsable or not DRLSemanticValidUTF8(aFilename, DRL_HISTORY_MAX_TEXT_BYTES) or
      (aFilename = '') or not ValidateRecords(FRecords, True) then Exit;
    data := SerializeRecords;
    if not DRLSemanticPreflightJSON(data) then Exit;
    stream := TFileStream.Create(aFilename, fmCreate);
    try if Length(data) > 0 then stream.WriteBuffer(data[1], Length(data));
    finally stream.Free; end;
    Result := True;
  except Result := False; end;
end;

function ReadString(aObject: TJSONObject; const aName: TJSONStringType;
  out aValue: AnsiString): Boolean;
var data: TJSONData;
begin
  data := aObject.Find(aName);
  if (data = nil) or (data.JSONType <> jtString) then Exit(False);
  aValue := DRLSemanticByteString(data.AsString);
  Result := DRLSemanticValidUTF8(aValue, DRL_HISTORY_MAX_TEXT_BYTES);
end;

function DecodeRecords(aRoot: TJSONData; out aRecords: TDRLHistoryRecords): Boolean;
var root, entry, param: TJSONObject; records, params: TJSONArray;
    schema, data: TJSONData; i, j: SizeInt; formatName, index, kind: AnsiString;
begin
  Result := False;
  if (aRoot = nil) or (aRoot.JSONType <> jtObject) then Exit;
  root := TJSONObject(aRoot); if root.Count <> 3 then Exit;
  schema := root.Find('schema');
  if (schema = nil) or (schema.JSONType <> jtNumber) or
    (TJSONNumber(schema).NumberType = ntFloat) or (schema.AsJSON <> '1') then Exit;
  if not ReadString(root, 'format', formatName) or (formatName <> SIDECAR_FORMAT) then Exit;
  data := root.Find('records'); if (data = nil) or (data.JSONType <> jtArray) then Exit;
  records := TJSONArray(data); if records.Count > DRL_HISTORY_MAX_RECORDS then Exit;
  SetLength(aRecords, records.Count);
  for i := 0 to records.Count - 1 do begin
    if records.Items[i].JSONType <> jtObject then Exit;
    entry := TJSONObject(records.Items[i]);
    if (entry.Count <> 5) or not ReadString(entry, 'index', index) or
      not TryStrToInt64(index, aRecords[i].Index) or
      (IntToStr(aRecords[i].Index) <> index) or (aRecords[i].Index < 1) or
      not ReadString(entry, 'id', aRecords[i].ID) or
      not ReadString(entry, 'english', aRecords[i].EnglishTemplate) or
      not ReadString(entry, 'originalEnglish', aRecords[i].OriginalEnglishGuard) then Exit;
    data := entry.Find('params'); if (data = nil) or (data.JSONType <> jtArray) then Exit;
    params := TJSONArray(data); if params.Count > DRL_HISTORY_MAX_PARAMS then Exit;
    SetLength(aRecords[i].Params, params.Count);
    for j := 0 to params.Count - 1 do begin
      if params.Items[j].JSONType <> jtObject then Exit;
      param := TJSONObject(params.Items[j]);
      if (param.Count <> 3) or not ReadString(param, 'name', aRecords[i].Params[j].Name) or
        not ReadString(param, 'kind', kind) or
        not ReadString(param, 'value', aRecords[i].Params[j].Value) then Exit;
      if kind = 'string' then aRecords[i].Params[j].Kind := DRL_TEXT_STRING
      else if kind = 'integer' then aRecords[i].Params[j].Kind := DRL_TEXT_INTEGER
      else Exit;
    end;
  end;
  Result := ValidateRecords(aRecords, True);
end;

function DRLLoadSemanticHistory(const aFilename: AnsiString): Boolean;
var stream: TFileStream; data: RawByteString; size: Int64;
    parser: TJSONParser; root: TJSONData; candidate: TDRLHistoryRecords;
begin
  Result := False; FUsable := False;
  try
    if not Assigned(DRLSemanticHistoryValidator) or
      not Assigned(DRLSemanticHistorySource) or (aFilename = '') or
      not DRLSemanticValidUTF8(aFilename, DRL_HISTORY_MAX_TEXT_BYTES) then Exit;
    stream := TFileStream.Create(aFilename, fmOpenRead or fmShareDenyNone);
    try
      size := stream.Size;
      if (size <= 0) or (size > DRL_HISTORY_MAX_JSON_BYTES) then Exit;
      SetLength(data, SizeInt(size)); stream.ReadBuffer(data[1], Length(data));
      if stream.Size <> size then Exit;
    finally stream.Free; end;
    if not DRLSemanticPreflightJSON(data) then Exit;
    parser := TJSONParser.Create(data, [joUTF8, joStrict]);
    try root := parser.Parse;
      try if not DecodeRecords(root, candidate) then Exit;
      finally root.Free; end;
    finally parser.Free; end;
    FRecords := candidate; FUsable := True; Result := True;
  except FUsable := False; Result := False; end;
end;
end.
