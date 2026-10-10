{$INCLUDE drl.inc}
{ Presentation adapter for pinned original DRL perk metadata. GPL-2.0. }
unit drlsemanticperks;
interface
uses dfthing;
function DRLViewPerkField(aNID: Integer; const aField, aEnglish: AnsiString): AnsiString;
function DRLViewPerkName(aNID: Integer; const aEnglish, aOriginalName: AnsiString): AnsiString;
function DRLViewItemPerkText(aThing: TThing; aHook: Byte; const aField, aEnglish: AnsiString): AnsiString;
function DRLViewFirstPerkText(aThing: TThing; const aField, aEnglish: AnsiString): AnsiString;
function DRLViewTraitString(aThing: TThing; aInvMode: Boolean = False): AnsiString;
implementation
uses vluasystem, vtig, drlperk, drlhooks, drlsemanticregistry;

function DRLViewPerkField(aNID: Integer; const aField, aEnglish: AnsiString): AnsiString;
var iID: AnsiString;
begin
  if (aNID < 0) or (aNID > High(PerkData)) then Exit(aEnglish);
  if not LuaSystem.Defined(['perks', aNID, 'id']) then Exit(aEnglish);
  iID := AnsiString(LuaSystem.Get(['perks', aNID, 'id']));
  Exit(DRLRegistryText('perk', iID, 'base_game', aField, aEnglish));
end;

function DRLViewPerkName(aNID: Integer; const aEnglish, aOriginalName: AnsiString): AnsiString;
begin
  if (aNID < 0) or (aNID > High(PerkData)) then Exit(aEnglish);
  { The existing fallback may be a custom OnShort callback result. Keep it opaque. }
  if (aOriginalName = '') and (Hook_OnShort in PerkData[aNID].Hooks) then Exit(aEnglish);
  if aOriginalName = ''
    then Exit(DRLViewPerkField(aNID, 'short', aEnglish))
    else Exit(DRLViewPerkField(aNID, 'name', aEnglish));
end;

function DRLViewItemPerkText(aThing: TThing; aHook: Byte; const aField, aEnglish: AnsiString): AnsiString;
var iPerks: TPerkList;
    i, iNID: Integer;
begin
  Result := aEnglish;
  if (aThing = nil) or (aEnglish = '') then Exit;
  iPerks := aThing.GetPerkList;
  if (iPerks = nil) or (iPerks.Size = 0) then Exit;
  for i := 0 to iPerks.Size - 1 do
  begin
    iNID := iPerks[i].ID;
    if (iNID < 0) or (iNID > High(PerkData)) then Continue;
    if aHook in PerkData[iNID].Hooks then
      Exit(DRLViewPerkField(iNID, aField, aEnglish));
  end;
end;

function DRLViewFirstPerkText(aThing: TThing; const aField, aEnglish: AnsiString): AnsiString;
var iPerks: TPerkList;
begin
  Result := aEnglish;
  if (aThing = nil) or (aEnglish = '') then Exit;
  iPerks := aThing.GetPerkList;
  if (iPerks = nil) or (iPerks.Size = 0) then Exit;
  Exit(DRLViewPerkField(iPerks[0].ID, aField, aEnglish));
end;

function DRLViewTraitString(aThing: TThing; aInvMode: Boolean): AnsiString;
var iPerks: TPerkList;
    i, iNID: Integer;
    iColor: Byte;
    iText, iField: AnsiString;
begin
  Result := '';
  if aThing = nil then Exit;
  iPerks := aThing.GetPerkList;
  if (iPerks = nil) or (iPerks.Size = 0) then Exit;
  for i := 0 to iPerks.Size - 1 do
  begin
    iNID := iPerks[i].ID;
    with PerkData[iNID] do
    begin
      iField := '';
      if Hook_OnDescribe in Hooks then
        iText := LuaSystem.ProtectedCall(['perks', iNID, HookNames[Hook_OnDescribe]], [aThing])
      else if aInvMode then
      begin
        iText := Name;
        iField := 'name';
      end
      else
      begin
        iText := aThing.GetPerkShort(iNID);
        if not (Hook_OnShort in Hooks) then iField := 'short';
      end;
      { Preserve the original empty test before localization. }
      if iText = '' then Continue;
      if iField <> '' then iText := DRLViewPerkField(iNID, iField, iText);
      if (iPerks[i].Time > 0) and (iPerks[i].Time <= 50)
        then iColor := ColorExp
        else iColor := Color;
      Result += '{' + VTIG_ColorChar(iColor) + iText + '}';
      if aInvMode then Result += ', ' else Result += ' ';
    end;
  end;
  if Result <> '' then
    if aInvMode
      then SetLength(Result, Length(Result) - 2)
      else SetLength(Result, Length(Result) - 1);
end;
end.
