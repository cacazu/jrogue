{ DRL browser presentation seam. Literal UTF-8 width/prefix decisions belong to
  Rust; Pascal retains VTIG tags, substitutions, styles and controller state. }
function VTIG_HostColumns(aText: Pointer; aLength: DWord): LongInt;
  external 'drl_host' name 'text_columns';
function VTIG_HostFit(aText: Pointer; aLength, aColumns: DWord): LongInt;
  external 'drl_host' name 'text_fit';

function VTIG_UTF8Columns(aText: PAnsiChar; aLength: Integer): Integer;
begin
  if aLength = 0 then Exit(0);
  Result := VTIG_HostColumns(aText, aLength);
  if Result < 0 then raise EConvertError.Create('Invalid UTF-8 VTIG literal');
end;

function VTIG_UTF8Fit(aText: PAnsiChar; aLength, aColumns: Integer): Integer;
begin
  if (aLength = 0) or (aColumns <= 0) then Exit(0);
  Result := VTIG_HostFit(aText, aLength, aColumns);
  if (Result < 0) or (Result > aLength) then
    raise EConvertError.Create('Invalid UTF-8 VTIG prefix');
end;

{ VTIG_Length historically sums visible columns (including one for a newline),
  rather than measuring the widest row. Keep that VTIG contract. }
function VTIG_UTF8Total(const aText: AnsiString): Integer;
var i, iStart: Integer;
begin
  Result := 0; iStart := 1;
  for i := 1 to Length(aText) do
    if aText[i] = #10 then begin
      Result += VTIG_UTF8Columns(PAnsiChar(aText) + iStart - 1, i - iStart);
      Inc(Result); iStart := i + 1;
    end;
  Result += VTIG_UTF8Columns(PAnsiChar(aText) + iStart - 1, Length(aText) - iStart + 1);
end;

function VTIG_UTF8Cut(const aText: AnsiString; aColumns: Integer): AnsiString;
var i, iStart, iBytes, iCols: Integer;
begin
  Result := ''; iStart := 1; i := 1;
  while i <= Length(aText) + 1 do begin
    if (i > Length(aText)) or (aText[i] = #10) then begin
      iBytes := VTIG_UTF8Fit(PAnsiChar(aText) + iStart - 1, i - iStart, aColumns);
      iCols := VTIG_UTF8Columns(PAnsiChar(aText) + iStart - 1, iBytes);
      Result += Copy(aText, iStart, iBytes); Dec(aColumns, iCols);
      if (iBytes < i - iStart) or (aColumns = 0) then Exit;
      if i <= Length(aText) then begin Result += #10; Dec(aColumns); end;
      iStart := i + 1;
    end;
    Inc(i);
  end;
end;

function VTIG_UTF8Sized(const aText: AnsiString; aWidth: Integer;
  aAllowPad, aAllowCut: Boolean): AnsiString;
var iColumns: Integer;
begin
  Result := aText;
  if aWidth <= 0 then Exit;
  iColumns := VTIG_UTF8Total(Result);
  if aAllowCut and (iColumns > aWidth) then begin
    Result := VTIG_UTF8Cut(Result, aWidth);
    iColumns := VTIG_UTF8Total(Result);
  end;
  if aAllowPad and (iColumns < aWidth) then
    Result += StringOfChar(' ', aWidth - iColumns);
end;

{ Measuring uses the same native control grammar as rendering. Flattening here
  removes only presentation controls; it never changes the runtime source text. }
function VTIG_UTF8Plain(aText: PAnsiChar; aParameters: array of const;
  aDepth: Integer = 0): AnsiString;
var i, iIndex, iBody, iName, iWidth: Integer;
    iPad, iCut: Boolean;
    iValue: AnsiString;
begin
  if aDepth > 64 then raise EConvertError.Create('Recursive VTIG substitution');
  Result := ''; i := 0;
  while aText[i] <> #0 do begin
    if aText[i] = '{' then begin
      Inc(i);
      if aText[i] = #0 then Exit;
      if aText[i] in ['0'..'9'] then begin
        iIndex := Ord(aText[i]) - Ord('0'); Inc(i); iValue := '';
        if iIndex < Length(aParameters) then
          case aParameters[iIndex].VType of
            vtChar: iValue := aParameters[iIndex].VChar;
            vtAnsiString: iValue := VTIG_UTF8Plain(PAnsiChar(AnsiString(aParameters[iIndex].VAnsiString)), aParameters, aDepth + 1);
            vtInteger: iValue := IntToStr(aParameters[iIndex].VInteger);
          end;
        if VTIG_ScanWidthTag(@aText[i], iBody, iName, iWidth, iPad, iCut) then begin
          Result += VTIG_UTF8Sized(iValue, iWidth, iPad, iCut); Inc(i, iBody);
        end else Result += iValue;
      end else if aText[i] = '$' then begin
        if VTIG_ScanWidthTag(@aText[i+1], iBody, iName, iWidth, iPad, iCut) then begin
          if Assigned(GCtx.SubCallback) then begin
            SetString(iValue, @aText[i+1], iName);
            iValue := VTIG_UTF8Plain(PAnsiChar(GCtx.SubCallback(iValue)), aParameters, aDepth + 1);
            Result += VTIG_UTF8Sized(iValue, iWidth, iPad, iCut);
          end;
          Inc(i, iBody + 1);
        end else Inc(i);
      end;
      if aText[i] <> #0 then Inc(i);
    end else if aText[i] in ['}', #13] then Inc(i)
    else begin Result += aText[i]; Inc(i); end;
  end;
end;

{ Cut already-expanded native markup. The UTF-8 literal bytes and two-byte color
  controls remain intact; closing controls are added only when a cut is needed. }
function VTIG_UTF8CutTagged(const aText: AnsiString; aColumns: Integer;
  aPreserveOpenScope: Boolean = False): AnsiString;
const PushColors: set of Char = ['^','r','R','b','B','g','G','v','V','c','C',
  'l','L','d','D','n','N','y','Y','!'];
var i, iEnd, iFit, iDepth, iOriginalDepth, iScan: Integer;
    iRaw: PAnsiChar;
begin
  Result := ''; i := 0; iDepth := 0; iOriginalDepth := 0; iRaw := PAnsiChar(aText);
  if aColumns <= 0 then Exit;
  { Reports may open a color scope before padding and close it in a suffix.
    Preserve those intentionally open scopes while closing balanced scopes
    whose trailing brace was clipped. }
  if aPreserveOpenScope then begin
    iScan := 0;
    while iRaw[iScan] <> #0 do begin
      if iRaw[iScan] = '{' then begin
        if iRaw[iScan+1] = #0 then Break;
        if (iRaw[iScan+1] in PushColors) and (iOriginalDepth < 15) then Inc(iOriginalDepth);
        Inc(iScan,2);
      end else begin
        if (iRaw[iScan] = '}') and (iOriginalDepth > 0) then Dec(iOriginalDepth);
        Inc(iScan);
      end;
    end;
  end;
  while (iRaw[i] <> #0) and (aColumns > 0) do begin
    if iRaw[i] = '{' then begin
      if iRaw[i+1] = #0 then Break;
      Result += Copy(aText,i+1,2);
      if (iRaw[i+1] in PushColors) and (iDepth < 15) then Inc(iDepth);
      Inc(i,2);
    end else if iRaw[i] = '}' then begin
      Result += '}'; if iDepth > 0 then Dec(iDepth); Inc(i);
    end else if iRaw[i] = #13 then Inc(i)
    else if iRaw[i] = #10 then begin
      Result += #10; Dec(aColumns); Inc(i);
    end else begin
      iEnd := i;
      while not (iRaw[iEnd] in [#0, #10, #13, '{', '}']) do Inc(iEnd);
      iFit := VTIG_UTF8Fit(@iRaw[i], iEnd-i, aColumns);
      Result += Copy(aText, i+1, iFit);
      Dec(aColumns, VTIG_UTF8Columns(@iRaw[i], iFit));
      Inc(i, iFit);
      if i < iEnd then Break;
    end;
  end;
  if (iRaw[i] <> #0) and (iDepth > iOriginalDepth) then
    Result += StringOfChar('}', iDepth-iOriginalDepth);
end;

function VTIG_UTF8SizedTagged(const aText: AnsiString; aWidth: Integer;
  aAllowPad, aAllowCut: Boolean): AnsiString;
var iColumns: Integer;
begin
  Result := aText;
  if aWidth <= 0 then Exit;
  iColumns := VTIG_UTF8Total(VTIG_UTF8Plain(PAnsiChar(Result), []));
  if aAllowCut and (iColumns > aWidth) then begin
    Result := VTIG_UTF8CutTagged(Result, aWidth);
    iColumns := VTIG_UTF8Total(VTIG_UTF8Plain(PAnsiChar(Result), []));
  end;
  if aAllowPad and (iColumns < aWidth) then Result += StringOfChar(' ', aWidth-iColumns);
end;

{ Resolve only VTIG substitutions and width controllers, preserving color tags.
  This is used at display-only truncation call sites; semantic IDs stay upstream. }
function VTIG_UTF8Expand(aText: PAnsiChar; aParameters: array of const;
  aDepth: Integer = 0): AnsiString;
var i, iIndex, iBody, iName, iWidth: Integer;
    iPad, iCut: Boolean;
    iValue: AnsiString;
begin
  if aDepth > 64 then raise EConvertError.Create('Recursive VTIG substitution');
  Result := ''; i := 0;
  while aText[i] <> #0 do begin
    if aText[i] = '{' then begin
      Inc(i);
      if aText[i] = #0 then Exit;
      if aText[i] in ['0'..'9'] then begin
        iIndex := Ord(aText[i])-Ord('0'); Inc(i); iValue := '';
        if iIndex < Length(aParameters) then
          case aParameters[iIndex].VType of
            vtChar: iValue := aParameters[iIndex].VChar;
            vtAnsiString: iValue := VTIG_UTF8Expand(PAnsiChar(AnsiString(aParameters[iIndex].VAnsiString)), aParameters, aDepth+1);
            vtInteger: iValue := IntToStr(aParameters[iIndex].VInteger);
          end;
        if VTIG_ScanWidthTag(@aText[i], iBody, iName, iWidth, iPad, iCut) then begin
          Result += VTIG_UTF8SizedTagged(iValue, iWidth, iPad, iCut); Inc(i,iBody);
        end else Result += iValue;
      end else if aText[i] = '$' then begin
        if VTIG_ScanWidthTag(@aText[i+1], iBody, iName, iWidth, iPad, iCut) then begin
          if Assigned(GCtx.SubCallback) then begin
            SetString(iValue,@aText[i+1],iName);
            iValue := VTIG_UTF8Expand(PAnsiChar(GCtx.SubCallback(iValue)),aParameters,aDepth+1);
            Result += VTIG_UTF8SizedTagged(iValue,iWidth,iPad,iCut);
          end;
          Inc(i,iBody+1);
        end else Inc(i);
      end else Result += AnsiString('{')+aText[i];
      if aText[i] <> #0 then Inc(i);
    end else begin Result += aText[i]; Inc(i); end;
  end;
end;

function VTIG_RenderUTF8Segment(aText: PAnsiChar; var aCurrentX, aCurrentY: Integer;
  aClip: TIORect; var aStyleStack: TTIGStyleStack; aParameters: array of const;
  var aBudget: Integer; aDepth: Integer): Integer;
var iWindow: TTIGWindow;
    i, iEnd, iBytes, iLastSpace, iSpaceLeft, iIndex: Integer;
    iBody, iName, iWidth: Integer;
    iPad, iCut, iHasNonASCII, iLineContent: Boolean;
    iValue: AnsiString;
    iSpecial: set of Char;

  procedure Render(aPart: PAnsiChar; aLength: Integer);
  var iCmd: TTIGDrawCommand;
      iKept, iDraw, iAdvance, iVisible: Integer;
  begin
    iKept := aLength;
    if aBudget >= 0 then iKept := VTIG_UTF8Fit(aPart, iKept, aBudget);
    iAdvance := VTIG_UTF8Columns(aPart, iKept);
    if aBudget >= 0 then begin
      Dec(aBudget, iAdvance);
      if iKept < aLength then aBudget := 0;
    end;
    Inc(Result, iAdvance);
    iDraw := iKept;
    if GCtx.MaxCharacters >= 0 then begin
      iDraw := VTIG_UTF8Fit(aPart, iDraw, GCtx.MaxCharacters);
      iVisible := VTIG_UTF8Columns(aPart, iDraw);
      Dec(GCtx.MaxCharacters, iVisible);
      if iDraw < iKept then GCtx.MaxCharacters := 0;
    end;
    if iDraw > 0 then begin
      Initialize(iCmd);
      iCmd.CType := VTIG_CMD_TEXT; iCmd.Clip := aClip;
      {$IFDEF DRL_BROWSER}iCmd.TextEncoding := 0; iCmd.XC := 0;{$ENDIF}
      iCmd.FG := aStyleStack.Current; iCmd.BG := GCtx.BGColor;
      iCmd.Area := Rectangle(Point(aCurrentX, aCurrentY), aClip.Pos2);
      iCmd.Text := iWindow.DrawList.PushText(aPart, iDraw);
      iWindow.DrawList.Push(iCmd);
    end;
    Inc(aCurrentX, iAdvance);
  end;

  procedure RenderValue(const aValue: AnsiString; aWidth: Integer;
    aAllowPad, aAllowCut: Boolean);
  var iLimit, iUsed, iLength, iPadCount: Integer;
      iPlain: AnsiString;
  begin
    iLimit := aBudget;
    iLength := 0;
    if aWidth > 0 then begin
      iPlain := VTIG_UTF8Plain(PAnsiChar(aValue), aParameters, aDepth + 1);
      iLength := VTIG_UTF8Total(iPlain);
    end;
    if aAllowCut and (aWidth > 0) and (iLength > aWidth) then begin
      iPlain := VTIG_UTF8Cut(iPlain, aWidth);
      iLength := VTIG_UTF8Total(iPlain);
      if (iLimit < 0) or (iLimit > iLength) then iLimit := iLength;
    end;
    iUsed := VTIG_RenderUTF8Segment(PAnsiChar(aValue), aCurrentX, aCurrentY,
      aClip, aStyleStack, aParameters, iLimit, aDepth + 1);
    Inc(Result, iUsed);
    if aBudget >= 0 then begin
      Dec(aBudget, iUsed);
      if iLimit = 0 then aBudget := Max(0, aBudget);
    end;
    iPadCount := 0;
    if aAllowPad and (aWidth > 0) and (iLength < aWidth) then iPadCount := aWidth - iLength;
    if iPadCount > 0 then Render(@GPadBuffer[0], iPadCount);
  end;

  procedure NewLine;
  begin aCurrentX := aClip.X; Inc(aCurrentY); iLineContent := False; end;

begin
  Result := 0;
  if aDepth > 64 then raise EConvertError.Create('Recursive VTIG substitution');
  if aCurrentY > aClip.Y2 then Exit;
  iWindow := GCtx.Current; i := 0;
  iLineContent := aCurrentX > aClip.X;
  iSpecial := [#10, #13, '{', '}'];
  if GRawMode then iSpecial := [#10, #13];
  while (aText[i] <> #0) and (aCurrentY <= aClip.Y2) do begin
    if aText[i] in iSpecial then begin
      if aText[i] = '{' then begin
        Inc(i);
        if aText[i] = #0 then Exit;
        case aText[i] of
          '^': aStyleStack.Push(VTIG_BoldenColor(aStyleStack.Current));
          'r': aStyleStack.Push(Red); 'R': aStyleStack.Push(LightRed);
          'b': aStyleStack.Push(Blue); 'B': aStyleStack.Push(LightBlue);
          'g': aStyleStack.Push(Green); 'G': aStyleStack.Push(LightGreen);
          'v': aStyleStack.Push(Magenta); 'V': aStyleStack.Push(LightMagenta);
          'c': aStyleStack.Push(Cyan); 'C': aStyleStack.Push(LightCyan);
          'l': aStyleStack.Push(LightGray); 'L': aStyleStack.Push(White);
          'd': aStyleStack.Push(DarkGray); 'D': aStyleStack.Push(Black);
          'n','N': aStyleStack.Push(Brown); 'y','Y': aStyleStack.Push(Yellow);
          '!': aStyleStack.Push(GCtx.Style^.Color[VTIG_BOLD_COLOR]);
          '0'..'9': begin
            iIndex := Ord(aText[i]) - Ord('0'); Inc(i); iValue := '';
            if iIndex < Length(aParameters) then
              case aParameters[iIndex].VType of
                vtChar: iValue := aParameters[iIndex].VChar;
                vtAnsiString: iValue := AnsiString(aParameters[iIndex].VAnsiString);
                vtInteger: iValue := IntToStr(aParameters[iIndex].VInteger);
              end;
            if VTIG_ScanWidthTag(@aText[i], iBody, iName, iWidth, iPad, iCut) then begin
              RenderValue(iValue, iWidth, iPad, iCut); Inc(i, iBody);
            end else RenderValue(iValue, 0, True, True);
            iLineContent := aCurrentX > aClip.X;
          end;
          '$': begin
            if VTIG_ScanWidthTag(@aText[i+1], iBody, iName, iWidth, iPad, iCut) then begin
              if Assigned(GCtx.SubCallback) then begin
                SetString(iValue, @aText[i+1], iName);
                iValue := GCtx.SubCallback(iValue);
                RenderValue(iValue, iWidth, iPad, iCut);
                iLineContent := aCurrentX > aClip.X;
              end;
              Inc(i, iBody + 1);
            end else Inc(i);
          end;
        end;
        if aText[i] <> #0 then Inc(i);
      end else if aText[i] = '}' then begin aStyleStack.Pop; Inc(i); end
      else if aText[i] = #13 then Inc(i)
      else begin
        if aBudget <> 0 then begin
          NewLine;
          { Explicit LF has one column in native VTIG_Length. Soft wraps do not. }
          Inc(Result);
          if aBudget > 0 then Dec(aBudget);
        end;
        Inc(i);
      end;
    end else begin
      iEnd := i; iHasNonASCII := False;
      while (aText[iEnd] <> #0) and not (aText[iEnd] in iSpecial) do begin
        if Ord(aText[iEnd]) >= 128 then iHasNonASCII := True;
        Inc(iEnd);
      end;
      { A local width cut still scans closing style controls. Otherwise a color
        opened inside a truncated parameter leaks into the following label. }
      if aBudget = 0 then begin i := iEnd; Continue; end;
      iSpaceLeft := aClip.X2 - aCurrentX + 1;
      iBytes := VTIG_UTF8Fit(@aText[i], iEnd - i, iSpaceLeft);
      if iBytes = iEnd - i then begin
        Render(@aText[i], iBytes); i := iEnd; iLineContent := aCurrentX > aClip.X;
      end else begin
        iLastSpace := -1;
        for iIndex := 0 to iBytes do
          if (i + iIndex < iEnd) and (aText[i + iIndex] = ' ') then iLastSpace := iIndex;
        if iLastSpace >= 0 then begin
          Render(@aText[i], iLastSpace); Inc(i, iLastSpace + 1);
        end else if (not iLineContent) or iHasNonASCII then begin
          if iBytes = 0 then begin
            { A cluster wider than the entire clipping row cannot be shown. }
            if aCurrentX = aClip.X then Exit;
          end else begin Render(@aText[i], iBytes); Inc(i, iBytes); end;
        end;
        NewLine;
      end;
    end;
  end;
end;

procedure VTIG_RenderTextSegment(const aText: PAnsiChar; var aCurrentX, aCurrentY: Integer;
  aClip: TIORect; var aStyleStack: TTIGStyleStack; aParameters: array of const;
  aMaxVisible: Integer = -1);
begin
  VTIG_RenderUTF8Segment(aText, aCurrentX, aCurrentY, aClip, aStyleStack,
    aParameters, aMaxVisible, 0);
end;
