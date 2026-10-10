{ Authored presentation-only methods inserted into original TBeing, GPL-2.0.
  Costs, player/observer selection, silence and visibility follow original methods.
  Final localized text uses Msg(text), bypassing printf processing of parameter values. }
function TBeing.PresentationName(aKnown: Boolean; aSentence: Boolean): AnsiString;
var iName, iID, iEnglish: AnsiString;
begin
  iName := DRLRegistryText('being', ID, 'base_game', 'name', Name);
  if BF_UNIQUENAME in FFlags then
  begin
    { Original Lua sentence names capitalize an ASCII initial. Never alter a UTF-8 lead byte. }
    if aSentence and (Length(iName) > 0) and (iName[1] in ['a'..'z']) then
      iName[1] := UpCase(iName[1]);
    Exit(iName);
  end;
  if aKnown then
  begin
    iID := 'entity.name.known';
    iEnglish := 'the {{name}}';
    if aSentence then
    begin
      iID := 'entity.name.known-sentence';
      iEnglish := 'The {{name}}';
    end;
  end
  else if Preposition(Name) = 'an ' then
  begin
    iID := 'entity.name.indefinite-an';
    iEnglish := 'an {{name}}';
    if aSentence then
    begin
      iID := 'entity.name.indefinite-an-sentence';
      iEnglish := 'An {{name}}';
    end;
  end
  else
  begin
    iID := 'entity.name.indefinite-a';
    iEnglish := 'a {{name}}';
    if aSentence then
    begin
      iID := 'entity.name.indefinite-a-sentence';
      iEnglish := 'A {{name}}';
    end;
  end;
  Exit(DRLText(iID, iEnglish, [DRLStringParam('name', iName)]));
end;

function TBeing.SemanticFail(const aID, aEnglish: AnsiString;
  const aParams: array of TDRLTextParam): Boolean;
begin
  if FSilentAction then Exit(False);
  if IsPlayer then IO.Msg(DRLText(aID, aEnglish, aParams));
  Exit(False);
end;

function TBeing.SemanticSuccess(const aID, aEnglish: AnsiString;
  const aParams: array of TDRLTextParam; aCost: DWord): Boolean;
begin
  if aCost <> 0 then Dec(FSpeedCount, aCost);
  if FSilentAction then Exit(True);
  if IsPlayer then IO.Msg(DRLText(aID, aEnglish, aParams));
  Exit(True);
end;

procedure TBeing.SemanticEmote(const aPlayerID, aPlayerEnglish,
  aBeingID, aBeingEnglish: AnsiString; const aParams: array of TDRLTextParam);
var iObserverParams: array of TDRLTextParam;
    i, iCount: Integer;
begin
  if FSilentAction then Exit;
  if IsPlayer then
    IO.Msg(DRLText(aPlayerID, aPlayerEnglish, aParams))
  else if isVisible then
  begin
    { The original format accepts unused parameters in an empty observer fragment.
      Keep evaluation at the caller once, but select only parameters in the full event. }
    SetLength(iObserverParams, Length(aParams) + 1);
    iObserverParams[0] := DRLStringParam('subject', PresentationName(True, True));
    iCount := 1;
    for i := 0 to High(aParams) do
      if Pos('{{' + aParams[i].Name + '}}', aBeingEnglish) > 0 then
      begin
        iObserverParams[iCount] := aParams[i];
        Inc(iCount);
      end;
    SetLength(iObserverParams, iCount);
    IO.Msg(DRLText(aBeingID, aBeingEnglish, iObserverParams));
  end;
end;

function TBeing.SemanticSuccessEmote(const aPlayerID, aPlayerEnglish,
  aBeingID, aBeingEnglish: AnsiString; const aParams: array of TDRLTextParam;
  aCost: DWord): Boolean;
begin
  if aCost <> 0 then Dec(FSpeedCount, aCost);
  SemanticEmote(aPlayerID, aPlayerEnglish, aBeingID, aBeingEnglish, aParams);
  Exit(True);
end;
