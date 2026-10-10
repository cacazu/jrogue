{ Presentation projections only. English Name/GetName/Description/Desc remain unchanged. }
function TItem.PresentationDescription(aSingle: Boolean): AnsiString;
var iEnglish: AnsiString;
begin
  iEnglish := Description(aSingle);
  if Copy(iEnglish, 1, Length(Name)) <> Name then Exit(iEnglish);
  Exit(DRLItemNamePresentation(UID, ID, Name) +
       Copy(iEnglish, Length(Name) + 1, Length(iEnglish)));
end;

function TItem.PresentationName(aKnown: Boolean; aSingle: Boolean): AnsiString;
begin
  Exit(PresentationNameValue(GetName(aKnown, aSingle), aKnown));
end;

function TItem.PresentationNameValue(const aEnglish: AnsiString; aKnown: Boolean): AnsiString;
var iEnglish, iPrefix, iLocalized, iID, iTemplate: AnsiString;
begin
  { Preserve the exact original GetName invocation and its descriptor/hook evaluations. }
  iEnglish := aEnglish;
  iPrefix := Name;
  iLocalized := DRLItemNamePresentation(UID, ID, Name);
  if (FAmount <= 1) and (not Flags[IF_UNIQUENAME]) then
  begin
    iID := '';
    if aKnown then
    begin
      iID := 'entity.name.known';
      iTemplate := 'the {{name}}';
      iPrefix := 'the ' + Name;
    end
    else if not (IF_PLURALNAME in FFlags) then
    begin
      iPrefix := Preposition(Name) + Name;
      if Preposition(Name) = 'an ' then
      begin
        iID := 'entity.name.indefinite-an';
        iTemplate := 'an {{name}}';
      end
      else
      begin
        iID := 'entity.name.indefinite-a';
        iTemplate := 'a {{name}}';
      end;
    end;
    if iID <> '' then
      iLocalized := DRLText(iID, iTemplate, [DRLStringParam('name', iLocalized)]);
  end;
  if Copy(iEnglish, 1, Length(iPrefix)) <> iPrefix then Exit(iEnglish);
  Exit(iLocalized + Copy(iEnglish, Length(iPrefix) + 1, Length(iEnglish)));
end;

function TItem.PresentationExtName(aLyingHere: Boolean): AnsiString;
var iName: AnsiString;
begin
  iName := '';
  if Hook_OnDescribe in FHooks then
    iName := LuaSystem.ProtectedRunHook(Self, HookNames[Hook_OnDescribe], []);
  if iName = '' then iName := PresentationName(False);
  if not aLyingHere then Exit(iName);
  if Flags[IF_FEATURENAME] then
    Exit(DRLText('message.ground-feature', 'There is a {{item}} here.',
      [DRLStringParam('item', iName)]));
  if Flags[IF_PLURALNAME] then
    Exit(DRLText('message.ground-items', 'There are {{item}} lying here.',
      [DRLStringParam('item', iName)]));
  Exit(DRLText('message.ground-item', 'There is {{item}} lying here.',
    [DRLStringParam('item', iName)]));
end;
