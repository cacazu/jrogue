{ Native fixture for the actual frozen item-name sidecar and generated catalog.
  No Node/JS storage implementation is used. Writes only an initially absent
  caller-supplied isolated file; never the default /user sidecar. GPL-2.0. }
program NativeItemNameProbe;
{$mode objfpc}{$H+}{$B-}{$codepage utf8}
uses fpwidestring, Classes, SysUtils, fpjson, jsonparser,
  drlsemantictext, drlsemanticfeelings, drlsemanticregistry,
  drlsemanticitemnames, drlsemanticitemcatalog;
const
  AssemblyEvent = 'item.name.aspect.assembly.speedloader';
  OverchargeEvent = 'item.name.aspect.overcharge';
  SchematicEvent = 'item.name.aspect.schematic.armory.chainsword';
var Filename, Saved: AnsiString; Checks: Integer = 0;

function B(const Value: RawByteString): AnsiString;
begin
  SetLength(Result, Length(Value));
  if Length(Value) > 0 then Move(Value[1], Result[1], Length(Value));
end;
procedure Check(Value: Boolean; const LabelText: AnsiString);
begin
  if not Value then raise Exception.Create('FAIL: ' + LabelText);
  Inc(Checks);
end;
function Resolve(const ID, English: AnsiString;
  const Params: array of TDRLTextParam): AnsiString;
var Template: AnsiString;
begin
  { Tiny fixture locale only; IDs/templates match canonical 3675 catalogs.
    The generated production validator/transition/renderer are not replaced. }
  if ID = 'term.item.pistol.name' then Template := B('ピストル')
  else if ID = 'term.item.schematic-1.name' then Template := B('設計図')
  else if ID = 'term.mod_array.chainsword.name' then Template := B('チェーンソード')
  else if ID = 'item.name.assembly.speedloader' then Template := B('スピードローダーピストル')
  else if ID = 'item.name.overcharged' then Template := B('過充填した{{name}}')
  else if ID = 'item.name.schematic' then Template := B('{{assembly}}の設計図')
  else Template := English;
  Result := DRLEnglishText(ID, Template, Params);
end;
procedure WriteRaw(const Data: RawByteString);
var Stream: TFileStream;
begin
  Stream := TFileStream.Create(Filename, fmCreate);
  try if Length(Data) > 0 then Stream.WriteBuffer(Data[1], Length(Data));
  finally Stream.Free; end;
end;
function ReadRaw: RawByteString;
var Stream: TFileStream;
begin
  Stream := TFileStream.Create(Filename, fmOpenRead);
  try
    Check((Stream.Size >= 0) and (Stream.Size <= 1048576), 'bounded fixture read');
    SetLength(Result, SizeInt(Stream.Size));
    if Length(Result) > 0 then Stream.ReadBuffer(Result[1], Length(Result));
  finally Stream.Free; end;
end;
procedure Populate;
begin
  DRLClearSemanticItemNames;
  Check(DRLRememberItemNameAspect(High(QWord), 'pistol', AssemblyEvent,
    'pistol', 'speedloader pistol'), 'real assembly transition');
  Check(DRLRememberItemNameAspect(High(QWord), 'pistol', OverchargeEvent,
    'speedloader pistol', 'overcharged speedloader pistol'), 'real overcharge transition');
  Check(DRLRememberItemNameAspect(1, 'schematic_1', SchematicEvent,
    'schematics', 'chainsword schematics'), 'real prototype-scoped schematic');
end;
function ChangedFixture(Which: Integer): RawByteString;
var Data: TJSONData; Root, Entry, Step: TJSONObject; Rows, Steps: TJSONArray;
begin
  Data := GetJSON(Saved, True);
  try
    Root := TJSONObject(Data); Rows := TJSONArray(Root.Find('records'));
    Entry := TJSONObject(Rows.Items[0]); Steps := TJSONArray(Entry.Find('steps'));
    Step := TJSONObject(Steps.Items[0]);
    case Which of
      0: Root.Find('schema').AsInteger := 2;
      1: Root.Find('format').AsString := 'other';
      2: Root.Add('extra', True);
      3: Entry.Add('extra', True);
      4: Step.Add('extra', True);
      5: Entry.Find('uid').AsString := '0';
      6: Entry.Find('uid').AsString := '01';
      7: Entry.Find('uid').AsString := '+1';
      8: Entry.Find('uid').AsString := '18446744073709551616';
      9: Rows.Add(Entry.Clone);
      10: Entry.Find('prototypeId').AsString := 'custom_unknown';
      11: Entry.Find('baseEnglish').AsString := 'changed';
      12: Step.Find('aspectId').AsString := 'item.name.aspect.unknown';
      13: Step.Find('beforeEnglish').AsString := 'changed';
      14: Step.Find('afterEnglish').AsString := 'changed';
      15: TJSONObject(Steps.Items[1]).Find('beforeEnglish').AsString := 'pistol';
      16: Steps.Clear;
      17: while Steps.Count < 17 do Steps.Add(Step.Clone);
      18: Entry.Find('baseEnglish').AsString := 'pistol' + #0;
      19: Entry.Find('baseEnglish').AsString := StringOfChar('X', 32769);
      20: begin Entry.Delete('uid'); Entry.Add('uid', Int64(1)); end;
    else raise Exception.Create('Unknown native fixture mutation'); end;
    Result := Root.AsJSON;
  finally Data.Free; end;
end;
procedure Reject(const Data: RawByteString; const LabelText: AnsiString);
begin
  Check(Data <> Saved, LabelText + ' mutation must change fixture');
  WriteRaw(Saved);
  Check(DRLLoadSemanticItemNames(Filename), LabelText + ' establish real loaded baseline');
  WriteRaw(Data);
  Check(not DRLLoadSemanticItemNames(Filename), LabelText + ' rejected');
  Check(DRLItemNamePresentation(High(QWord), 'pistol', 'overcharged speedloader pistol') =
    'overcharged speedloader pistol', LabelText + ' stale aspect replay cleared');
end;
var I: Integer; Prior: RawByteString;
begin
  SetMultiByteConversionCodePage(CP_UTF8);
  Check(ParamCount = 1, 'one isolated initially absent JSON filename required');
  Filename := ParamStr(1);
  Check((Filename <> '') and not FileExists(Filename), 'refuse an existing file');
  DRLSemanticTextResolver := @Resolve;
  try
    Check(Assigned(DRLItemNameBaseValidator) and Assigned(DRLItemNameTransitionValidator)
      and Assigned(DRLItemNameAspectRenderer), 'actual generated catalog installed');
    Check(DRLItemNamePresentation(4, 'pistol', 'pistol') = B('ピストル'), 'actual registry base projection');
    Check(DRLItemNamePresentation(4, 'custom', 'external {!raw} {{id}}') =
      'external {!raw} {{id}}', 'custom prototype remains verbatim');
    Populate;
    Check(DRLItemNamePresentation(High(QWord), 'pistol', 'overcharged speedloader pistol') =
      B('過充填したスピードローダーピストル'), 'QWord maximum Japanese chained replay');
    Check(DRLItemNamePresentation(1, 'schematic_1', 'chainsword schematics') =
      B('チェーンソードの設計図'), 'real schematic registry parameter projection');
    Check(DRLItemNamePresentation(High(QWord), 'pistol', 'custom changed') =
      'custom changed', 'exact current English guard');
    Check(not DRLRememberItemNameAspect(2, 'pistol', SchematicEvent,
      'pistol', 'chainsword schematics'), 'schematic prototype restriction');
    Check(DRLSaveSemanticItemNames(Filename), 'actual save'); Saved := ReadRaw;
    Check(Pos('18446744073709551615', Saved) > 0, 'UID serialized as exact decimal');
    Check(DRLRememberItemNameAspect(High(QWord), 'pistol', OverchargeEvent,
      'speedloader pistol', 'overcharged speedloader pistol'), 'idempotent repeated event');
    Check(DRLSaveSemanticItemNames(Filename), 'repeat save'); Check(ReadRaw = Saved, 'repeat serialization unchanged');
    Check(not DRLRememberItemNameAspect(High(QWord), 'pistol', 'unknown',
      'overcharged speedloader pistol', 'changed'), 'reject unknown transition');
    Check(DRLSaveSemanticItemNames(Filename), 'save after rejected candidate');
    Check(ReadRaw = Saved, 'candidate rejection preserves original metadata');
    DRLClearSemanticItemNames;
    Check(DRLLoadSemanticItemNames(Filename), 'actual clear/load');
    Check(DRLItemNamePresentation(High(QWord), 'pistol', 'overcharged speedloader pistol') =
      B('過充填したスピードローダーピストル'), 'actual persisted resume');
    DRLSemanticTextResolver := nil;
    Check(DRLItemNamePresentation(High(QWord), 'pistol', 'overcharged speedloader pistol') =
      'overcharged speedloader pistol', 'native English replay without callback');
    DRLSemanticTextResolver := @Resolve;
    for I := 0 to 20 do Reject(ChangedFixture(I), 'JSON field ' + IntToStr(I));
    Reject(Saved + '{}', 'trailing root');
    Reject('{"schema":1,"schema":1,"format":"drl.semantic-item-names","records":[]}', 'duplicate root key');
    Reject('{"schema":1,"sch\u0065ma":1,"format":"drl.semantic-item-names","records":[]}', 'escaped duplicate key');
    Reject('{"schema":1.0,"format":"drl.semantic-item-names","records":[]}', 'fractional schema');
    Reject('{"schema":1,"format":"drl.semantic-item-names","records":[],}', 'trailing comma');
    Reject('[' + StringOfChar('[', 9) + '0' + StringOfChar(']', 9) + ']', 'depth bound');
    Reject(StringOfChar(' ', 1048577), 'file bound');
    Reject(#$FF, 'raw invalid UTF8');
    Reject(#$ED + #$A0 + #$80, 'raw UTF8 surrogate');
    Reject('{"schema":1,"format":"drl.semantic-item-names","records":["\ud800"]}', 'escaped unpaired surrogate');
    Reject('{' + #0 + '}', 'raw NUL');
    WriteRaw(Saved); Check(DRLLoadSemanticItemNames(Filename), 'restore baseline for prefix depth');
    Prior := 'overcharged speedloader pistol';
    for I := 3 to 16 do begin
      Check(DRLRememberItemNameAspect(High(QWord), 'pistol', OverchargeEvent, Prior,
        'overcharged ' + Prior), 'bounded chained transition ' + IntToStr(I));
      Prior := 'overcharged ' + Prior;
    end;
    Check(not DRLRememberItemNameAspect(High(QWord), 'pistol', OverchargeEvent,
      Prior, 'overcharged ' + Prior), '17th transition rejected');
    Check(DRLSaveSemanticItemNames(Filename), 'bounded chain save');
    Check(DeleteFile(Filename), 'remove owned isolated file');
    Check(not DRLLoadSemanticItemNames(Filename), 'missing sidecar fallback');
    Check(DRLItemNamePresentation(High(QWord), 'pistol', Prior) = Prior, 'missing clears stale records');
  finally
    DRLClearSemanticItemNames; DRLSemanticTextResolver := nil;
    if FileExists(Filename) then DeleteFile(Filename);
  end;
  WriteLn('Native item-name checks: ', Checks);
end.
