{ Original Lua presentation API extension, GPL-2.0. It changes no Lua domain registry. }
type TDRLLuaSemanticParams = array of TDRLTextParam;
procedure ReadDRLLuaSemanticParams(var State: TDRLLuaState; aIndex: Integer;
  out iParams: TDRLLuaSemanticParams);
var iTable, iParameter: TLuaTable;
    i, iCount: Integer;
    iSize: DWord;
    iName, iKind, iValue: AnsiString;
    iInteger: Int64;
begin
  SetLength(iParams, 0);
  if State.StackSize >= aIndex then
  begin
    if not State.IsTable(aIndex) then
      State.Error(DRLText('error.text.lua.parameter-table', 'Semantic text parameters must be a table'));
    iTable := State.ToTable(aIndex);
    try
      iSize := iTable.GetSize;
      if iSize > 16 then
        State.Error(DRLText('error.text.lua.parameter-limit', 'Semantic text parameter limit exceeded'));
      iCount := Integer(iSize);
      SetLength(iParams, iCount);
      for i := 0 to iCount - 1 do
      begin
        iParameter := iTable.GetTable([i + 1]);
        try
          iName := iParameter.GetString('name');
          iKind := iParameter.GetString('kind');
          iValue := iParameter.GetString('value');
          if iKind = 'string' then
            iParams[i] := DRLStringParam(iName, iValue)
          else if iKind = 'integer' then
          begin
            if not TryStrToInt64(iValue, iInteger) then
              State.Error(DRLText('error.text.lua.integer', 'Semantic integer parameter must be a signed decimal Int64'));
            if IntToStr(iInteger) <> iValue then
              State.Error(DRLText('error.text.lua.integer', 'Semantic integer parameter must be a signed decimal Int64'));
            iParams[i] := DRLIntegerParam(iName, iInteger);
          end
          else
            State.Error(DRLText('error.text.lua.parameter-kind', 'Unknown semantic text parameter kind'));
        finally
          iParameter.Free;
        end;
      end;
    finally
      iTable.Free;
    end;
  end;
end;

function lua_ui_semantic_text(L: Plua_State): Integer; cdecl;
var State: TDRLLuaState;
    iParams: TDRLLuaSemanticParams;
begin
  State.Init(L);
  if State.StackSize < 2 then
    State.Error(DRLText('error.text.lua.request', 'Semantic text ID and English template are required'));
  ReadDRLLuaSemanticParams(State, 3, iParams);
  if State.ToBoolean(4) then
    State.Push(DRLEnglishText(State.ToString(1), State.ToString(2), iParams))
  else
    State.Push(DRLText(State.ToString(1), State.ToString(2), iParams));
  Result := 1;
end;

function lua_ui_remember_semantic_feeling(L: Plua_State): Integer; cdecl;
var State: TDRLLuaState;
    iParams: TDRLLuaSemanticParams;
begin
  State.Init(L);
  ReadDRLLuaSemanticParams(State, 3, iParams);
  State.Push(DRLRememberSemanticFeeling(State.ToString(1), State.ToString(2),
    iParams, State.ToString(4), State.ToString(5)));
  Result := 1;
end;

function lua_ui_repeat_semantic_feeling(L: Plua_State): Integer; cdecl;
var State: TDRLLuaState;
begin
  State.Init(L);
  State.Push(DRLRepeatSemanticFeeling(State.ToString(1)));
  Result := 1;
end;

function lua_ui_clear_semantic_feelings(L: Plua_State): Integer; cdecl;
begin
  DRLClearSemanticFeelings;
  Result := 0;
end;

function lua_ui_being_name(L: Plua_State): Integer; cdecl;
var State: TDRLLuaState;
    Being: TBeing;
begin
  State.Init(L);
  Being := State.ToObject(1) as TBeing;
  State.Push(Being.PresentationName(State.ToBoolean(2), State.ToBoolean(3)));
  Result := 1;
end;

function lua_ui_item_description(L: Plua_State): Integer; cdecl;
var State: TDRLLuaState;
    Item: TItem;
begin
  State.Init(L);
  Item := State.ToObject(1) as TItem;
  State.Push(Item.PresentationDescription);
  Result := 1;
end;

function lua_ui_registry_text(L: Plua_State): Integer; cdecl;
var State: TDRLLuaState;
begin
  State.Init(L);
  if State.StackSize <> 5 then
    State.Error(DRLText('error.text.lua.registry-request', 'Registry text requires category, ID, scope, field and English guard'));
  State.Push(DRLRegistryText(State.ToString(1), State.ToString(2),
    State.ToString(3), State.ToString(4), State.ToString(5)));
  Result := 1;
end;

function lua_ui_presentation_pad(L: Plua_State): Integer; cdecl;
var State: TDRLLuaState; Text: AnsiString; Columns, Width: Integer;
    Requested: Single;
begin
  State.Init(L);
  if (State.StackSize <> 2) or not State.IsString(1) or not State.IsNumber(2) then
    State.Error(DRLText('error.text.lua.presentation-pad', 'Presentation padding requires text and an integer width from 0 to 512'));
  Requested := State.ToFloat(2);
  if not ((Requested >= 0) and (Requested <= 512)) then
    State.Error(DRLText('error.text.lua.presentation-pad', 'Presentation padding requires text and an integer width from 0 to 512'));
  Columns := State.ToInteger(2);
  if Requested <> Columns then
    State.Error(DRLText('error.text.lua.presentation-pad', 'Presentation padding requires text and an integer width from 0 to 512'));
  Text := State.ToString(1);
  if (Length(Text) > 32768) or (Pos(#0, Text) > 0) then
    State.Error(DRLText('error.text.lua.presentation-pad', 'Presentation padding requires text and an integer width from 0 to 512'));
  Width := VTIG_Length(Text);
  if (Width >= 0) and (Width < Columns) then Text := Text + StringOfChar(' ', Columns - Width);
  State.Push(Text);
  Result := 1;
end;

function lua_ui_remember_item_name_aspect(L: Plua_State): Integer; cdecl;
var State: TDRLLuaState; Item: TItem; ObjectValue: TObject; Accepted: Boolean;
begin
  State.Init(L);
  Accepted := False;
  if (State.StackSize = 4) and State.IsObject(1) and State.IsString(2) and
    State.IsString(3) and State.IsString(4) then
  begin
    ObjectValue := State.ToObject(1);
    if ObjectValue is TItem then
    begin
      Item := TItem(ObjectValue);
      Accepted := DRLRememberItemNameAspect(Item.UID, Item.ID,
        State.ToString(2), State.ToString(3), State.ToString(4));
    end;
  end;
  State.Push(Accepted);
  Result := 1;
end;

function DRLReadOriginalHistory(aIndex: Int64; out aEnglish: AnsiString): Boolean;
var History: TLuaTable; Count: DWord; Value: Variant;
begin
  Result := False;
  aEnglish := '';
  if (Player = nil) or (LuaSystem = nil) or (aIndex <= 0) then Exit;
  try
    History := LuaSystem.GetTable(['player','__props','history']);
    try
      Count := History.GetSize;
      if aIndex > Int64(Count) then Exit;
      Value := History.GetValue(Variant(aIndex));
      if not VarIsStr(Value) then Exit;
      aEnglish := AnsiString(Value);
      Result := DRLSemanticValidUTF8(aEnglish, 32768);
    finally
      History.Free;
    end;
  except
    Result := False;
    aEnglish := '';
  end;
end;

function DRLReadCurrentOriginalHistory(out aIndex: Int64;
  out aEnglish: AnsiString): Boolean;
var History: TLuaTable; Count: DWord;
begin
  Result := False;
  aIndex := 0;
  aEnglish := '';
  if (Player = nil) or (LuaSystem = nil) then Exit;
  try
    History := LuaSystem.GetTable(['player','__props','history']);
    try
      Count := History.GetSize;
    finally
      History.Free;
    end;
    aIndex := Int64(Count);
    Result := DRLReadOriginalHistory(aIndex, aEnglish);
  except
    aIndex := 0;
    aEnglish := '';
  end;
end;

function lua_ui_remember_semantic_history(L: Plua_State): Integer; cdecl;
var State: TDRLLuaState; Params: TDRLLuaSemanticParams; Accepted: Boolean;
begin
  State.Init(L);
  Accepted := False;
  if (State.StackSize = 3) and State.IsString(1) and State.IsString(2) and
    State.IsTable(3) then
  begin
    ReadDRLLuaSemanticParams(State, 3, Params);
    Accepted := DRLRememberCurrentSemanticHistory(State.ToString(1),
      State.ToString(2), Params);
  end;
  State.Push(Accepted);
  Result := 1;
end;

function lua_ui_presentation_history(L: Plua_State): Integer; cdecl;
var State: TDRLLuaState; Number: Single; Index: LongInt; Text: AnsiString;
begin
  State.Init(L);
  Text := State.ToString(2);
  if (State.StackSize = 2) and State.IsNumber(1) and State.IsString(2) then
  begin
    Number := State.ToFloat(1);
    if (Number >= 1) and (Number <= DRL_HISTORY_MAX_RECORDS) then
    begin
      Index := State.ToInteger(1);
      if Number = Index then Text := DRLPresentationHistory(Index, Text);
    end;
  end;
  State.Push(Text);
  Result := 1;
end;
