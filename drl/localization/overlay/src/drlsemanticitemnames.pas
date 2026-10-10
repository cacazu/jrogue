{ Presentation-only original item name transitions. SPDX-License-Identifier: GPL-2.0-only.
  Original Name/UID/prototype/save state is never changed. A generated whitelist
  validates each source event and its original-English transition before storage.
  Replay resolves typed display templates in the current language. }
unit drlsemanticitemnames;
{$mode objfpc}{$H+}{$B-}
interface
const
  DRL_ITEM_NAME_SIDECAR_FILE = '/user/drl.presentation-items.json';
  DRL_ITEM_NAME_MAX_RECORDS = 4096;
  DRL_ITEM_NAME_MAX_STEPS = 16;
  DRL_ITEM_NAME_MAX_JSON_BYTES = 1048576;
type
  TDRLItemNameBaseValidator = function(const aPrototypeID, aEnglish: AnsiString): Boolean;
  TDRLItemNameTransitionValidator = function(const aPrototypeID, aAspectID,
    aBeforeEnglish, aAfterEnglish: AnsiString): Boolean;
  TDRLItemNameAspectRenderer = function(const aPrototypeID, aAspectID,
    aPriorPresentation: AnsiString): AnsiString;
var
  DRLItemNameBaseValidator: TDRLItemNameBaseValidator = nil;
  DRLItemNameTransitionValidator: TDRLItemNameTransitionValidator = nil;
  DRLItemNameAspectRenderer: TDRLItemNameAspectRenderer = nil;
procedure DRLClearSemanticItemNames;
function DRLRememberItemNameAspect(aUID: QWord; const aPrototypeID, aAspectID,
  aBeforeEnglish, aAfterEnglish: AnsiString): Boolean;
function DRLItemNamePresentation(aUID: QWord; const aPrototypeID,
  aCurrentEnglish: AnsiString): AnsiString;
function DRLSaveSemanticItemNames(const aFilename: AnsiString = DRL_ITEM_NAME_SIDECAR_FILE): Boolean;
function DRLLoadSemanticItemNames(const aFilename: AnsiString = DRL_ITEM_NAME_SIDECAR_FILE): Boolean;
implementation
uses Classes, SysUtils, fpjson, jsonscanner, jsonparser, drlsemanticfeelings, drlsemanticregistry;
type
  TItemNameStep = record AspectID, BeforeEnglish, AfterEnglish: AnsiString; end;
  TItemNameSteps = array of TItemNameStep;
  TItemNameRecord = record
    UID: QWord;
    PrototypeID, BaseEnglish: AnsiString;
    Steps: TItemNameSteps;
  end;
  TItemNameRecords = array of TItemNameRecord;
var FItemNames: TItemNameRecords;
const FORMAT_NAME = 'drl.semantic-item-names';

function ValidText(const aText: AnsiString; aLimit: SizeInt = 32768): Boolean;
begin Exit(DRLSemanticValidUTF8(aText, aLimit)); end;

function ValidID(const aID: AnsiString): Boolean;
var i: SizeInt;
begin
  if (Length(aID) = 0) or (Length(aID) > 256) then Exit(False);
  for i := 1 to Length(aID) do
    if not (aID[i] in ['a'..'z','A'..'Z','0'..'9','_', '-', '.', ':', '!']) then Exit(False);
  Exit(True);
end;

procedure DRLClearSemanticItemNames;
begin SetLength(FItemNames, 0); end;

function ValidateRecords(const aRecords: TItemNameRecords): Boolean;
var i,j,k: SizeInt; previous: AnsiString; retained: Int64;
begin
  if not Assigned(DRLItemNameBaseValidator) or
    not Assigned(DRLItemNameTransitionValidator) or
    (Length(aRecords) > DRL_ITEM_NAME_MAX_RECORDS) then Exit(False);
  retained := 0;
  for i := 0 to High(aRecords) do with aRecords[i] do begin
    if (UID = 0) or not ValidID(PrototypeID) or not ValidText(BaseEnglish) or
      not DRLItemNameBaseValidator(PrototypeID, BaseEnglish) or
      (Length(Steps) = 0) or (Length(Steps) > DRL_ITEM_NAME_MAX_STEPS) then Exit(False);
    for k := 0 to i-1 do if aRecords[k].UID = UID then Exit(False);
    previous := BaseEnglish;
    retained += Length(BaseEnglish) + Length(PrototypeID) + 8;
    for j := 0 to High(Steps) do with Steps[j] do begin
      if not ValidID(AspectID) or not ValidText(BeforeEnglish) or not ValidText(AfterEnglish) or
        (BeforeEnglish <> previous) or
        not DRLItemNameTransitionValidator(PrototypeID, AspectID, BeforeEnglish, AfterEnglish) then Exit(False);
      retained += Length(AspectID) + Length(BeforeEnglish) + Length(AfterEnglish);
      if retained > DRL_ITEM_NAME_MAX_JSON_BYTES then Exit(False);
      previous := AfterEnglish;
    end;
  end;
  Exit(True);
end;

function DRLRememberItemNameAspect(aUID: QWord; const aPrototypeID, aAspectID,
  aBeforeEnglish, aAfterEnglish: AnsiString): Boolean;
var i,j,index: SizeInt; candidate: TItemNameRecords;
begin
  Result := False;
  if (aUID = 0) or not Assigned(DRLItemNameTransitionValidator) then Exit;
  index := -1;
  for i := 0 to High(FItemNames) do if FItemNames[i].UID = aUID then begin
    index := i;
    with FItemNames[i] do if (PrototypeID = aPrototypeID) and (Length(Steps) > 0) then
      with Steps[High(Steps)] do if (AspectID = aAspectID) and
        (BeforeEnglish = aBeforeEnglish) and (AfterEnglish = aAfterEnglish) then Exit(True);
    Break;
  end;
  try
    candidate := Copy(FItemNames, 0, Length(FItemNames));
    { Deep-copy every nested step array; rejected candidates cannot alter prior state. }
    for i := 0 to High(candidate) do candidate[i].Steps := Copy(FItemNames[i].Steps, 0, Length(FItemNames[i].Steps));
    if index < 0 then begin
      if Length(candidate) >= DRL_ITEM_NAME_MAX_RECORDS then Exit;
      index := Length(candidate);SetLength(candidate, index+1);
      candidate[index].UID := aUID;candidate[index].PrototypeID := aPrototypeID;
      candidate[index].BaseEnglish := aBeforeEnglish;
    end;
    if candidate[index].PrototypeID <> aPrototypeID then Exit;
    j := Length(candidate[index].Steps);
    if j >= DRL_ITEM_NAME_MAX_STEPS then Exit;
    SetLength(candidate[index].Steps, j+1);
    with candidate[index].Steps[j] do begin
      AspectID := aAspectID;BeforeEnglish := aBeforeEnglish;AfterEnglish := aAfterEnglish;
    end;
    if not ValidateRecords(candidate) then Exit;
    FItemNames := candidate;Result := True;
  except Result := False; end;
end;

function DRLItemNamePresentation(aUID: QWord; const aPrototypeID,
  aCurrentEnglish: AnsiString): AnsiString;
var i,j: SizeInt; display: AnsiString;
begin
  Result := DRLRegistryText('item', aPrototypeID, 'base_game', 'name', aCurrentEnglish);
  if not Assigned(DRLItemNameAspectRenderer) then Exit;
  for i := 0 to High(FItemNames) do with FItemNames[i] do
    if (UID = aUID) and (PrototypeID = aPrototypeID) and (Length(Steps) > 0) then begin
      if Steps[High(Steps)].AfterEnglish <> aCurrentEnglish then Exit;
      try
        display := DRLRegistryText('item', PrototypeID, 'base_game', 'name', BaseEnglish);
        for j := 0 to High(Steps) do display := DRLItemNameAspectRenderer(PrototypeID, Steps[j].AspectID, display);
        if not ValidText(display) then Exit;
        Exit(display);
      except Exit(aCurrentEnglish); end;
    end;
end;

function JSONText(const aValue: AnsiString): TJSONStringType;
begin
  SetLength(Result, Length(aValue));
  if Length(aValue) > 0 then Move(aValue[1], Result[1], Length(aValue));
end;

function DRLSaveSemanticItemNames(const aFilename: AnsiString): Boolean;
var root,entry,step: TJSONObject; records,jsonSteps: TJSONArray;
    i,j: SizeInt; data: RawByteString; stream: TFileStream;
begin
  Result := False;
  try
    if not ValidText(aFilename) or (aFilename = '') or not ValidateRecords(FItemNames) then Exit;
    root := TJSONObject.Create;
    try
      root.Add('schema', Int64(1));root.Add('format', FORMAT_NAME);
      records := TJSONArray.Create;root.Add('records', records);
      for i := 0 to High(FItemNames) do with FItemNames[i] do begin
        entry := TJSONObject.Create;records.Add(entry);
        entry.Add('uid', JSONText(UIntToStr(UID)));entry.Add('prototypeId', JSONText(PrototypeID));
        entry.Add('baseEnglish', JSONText(BaseEnglish));jsonSteps := TJSONArray.Create;entry.Add('steps', jsonSteps);
        for j := 0 to High(Steps) do with Steps[j] do begin
          step := TJSONObject.Create;jsonSteps.Add(step);
          step.Add('aspectId', JSONText(AspectID));step.Add('beforeEnglish', JSONText(BeforeEnglish));step.Add('afterEnglish', JSONText(AfterEnglish));
        end;
      end;
      data := root.AsJSON;
    finally root.Free; end;
    if (Length(data) > DRL_ITEM_NAME_MAX_JSON_BYTES) or not DRLSemanticPreflightJSON(data) then Exit;
    stream := TFileStream.Create(aFilename, fmCreate);
    try if Length(data) > 0 then stream.WriteBuffer(data[1], Length(data));
    finally stream.Free; end;
    Result := True;
  except Result := False; end;
end;

function ReadText(aObject: TJSONObject; const aKey: TJSONStringType; out aValue: AnsiString): Boolean;
var value: TJSONData;
begin
  value := aObject.Find(aKey);
  if (value = nil) or (value.JSONType <> jtString) then Exit(False);
  aValue := DRLSemanticByteString(value.AsString);
  Exit(ValidText(aValue));
end;

function DRLLoadSemanticItemNames(const aFilename: AnsiString): Boolean;
var stream: TFileStream; data: RawByteString; size: Int64;
    parser: TJSONParser; parsed: TJSONData; root,entry,step: TJSONObject;
    rows,steps: TJSONArray; value: TJSONData; candidate: TItemNameRecords;
    i,j: SizeInt; format,uid: AnsiString;
begin
  Result := False;DRLClearSemanticItemNames;
  try
    if not ValidText(aFilename) or (aFilename = '') then Exit;
    stream := TFileStream.Create(aFilename, fmOpenRead or fmShareDenyNone);
    try
      size := stream.Size;
      if (size <= 0) or (size > DRL_ITEM_NAME_MAX_JSON_BYTES) then Exit;
      SetLength(data, SizeInt(size));stream.ReadBuffer(data[1], Length(data));
      if stream.Size <> size then Exit;
    finally stream.Free; end;
    if not DRLSemanticPreflightJSON(data) then Exit;
    parser := TJSONParser.Create(data, [joUTF8, joStrict]);
    try
      parsed := parser.Parse;
      try
        if (parsed = nil) or (parsed.JSONType <> jtObject) then Exit;
        root := TJSONObject(parsed);if root.Count <> 3 then Exit;
        value := root.Find('schema');if (value = nil) or (value.JSONType <> jtNumber) then Exit;
        if (TJSONNumber(value).NumberType = ntFloat) or (value.AsJSON <> '1') then Exit;
        if not ReadText(root, 'format', format) or (format <> FORMAT_NAME) then Exit;
        value := root.Find('records');if (value = nil) or (value.JSONType <> jtArray) then Exit;
        rows := TJSONArray(value);if rows.Count > DRL_ITEM_NAME_MAX_RECORDS then Exit;
        SetLength(candidate, rows.Count);
        for i := 0 to rows.Count-1 do begin
          if rows.Items[i].JSONType <> jtObject then Exit;
          entry := TJSONObject(rows.Items[i]);if entry.Count <> 4 then Exit;
          if not ReadText(entry, 'uid', uid) or not TryStrToQWord(uid, candidate[i].UID) or
            (UIntToStr(candidate[i].UID) <> uid) or
            not ReadText(entry, 'prototypeId', candidate[i].PrototypeID) or
            not ReadText(entry, 'baseEnglish', candidate[i].BaseEnglish) then Exit;
          value := entry.Find('steps');if (value = nil) or (value.JSONType <> jtArray) then Exit;
          steps := TJSONArray(value);if steps.Count > DRL_ITEM_NAME_MAX_STEPS then Exit;
          SetLength(candidate[i].Steps, steps.Count);
          for j := 0 to steps.Count-1 do begin
            if steps.Items[j].JSONType <> jtObject then Exit;
            step := TJSONObject(steps.Items[j]);if step.Count <> 3 then Exit;
            if not ReadText(step, 'aspectId', candidate[i].Steps[j].AspectID) or
              not ReadText(step, 'beforeEnglish', candidate[i].Steps[j].BeforeEnglish) or
              not ReadText(step, 'afterEnglish', candidate[i].Steps[j].AfterEnglish) then Exit;
          end;
        end;
        if not ValidateRecords(candidate) then Exit;
      finally parsed.Free; end;
    finally parser.Free; end;
    FItemNames := candidate;Result := True;
  except DRLClearSemanticItemNames;Result := False; end;
end;
end.
