{$mode objfpc}{$H+}{$modeswitch advancedrecords}{$coperaTORS on}{$codepage utf8}
program vtig_text_contract_probe;
uses SysUtils, Math;
type TIOColor = DWord;
     TIOPoint = record X,Y: Integer; end;
     TIORect = record X,Y,X2,Y2: Integer; Pos,Pos2,Dim: TIOPoint; end;
     TTIGDrawCommand = record CType: Integer; Clip,Area: TIORect; FG,BG,XC,TextEncoding: DWord; Text: TIOPoint; end;
const VTIG_CMD_TEXT = 0;
      Black=0;Blue=1;Green=2;Cyan=3;Red=4;Magenta=5;Brown=6;LightGray=7;
      DarkGray=8;LightBlue=9;LightGreen=10;LightCyan=11;LightRed=12;LightMagenta=13;Yellow=14;White=15;
      VTIG_BOLD_COLOR=0;
type TTIGDrawList = class
       FText: AnsiString;
       function PushText(aPart:PAnsiChar; aLength:Integer):TIOPoint;
       procedure Push(const aCmd:TTIGDrawCommand);
     end;
     TTIGWindow = class DrawList: TTIGDrawList; end;
     TTIGStyle = record Color: array[0..15] of TIOColor; end;
     PTIGStyle = ^TTIGStyle;
     TTIGSubCallback = function(const aID:AnsiString):AnsiString;
     TTIGContext = record Current:TTIGWindow; BGColor:TIOColor; Style:PTIGStyle;
       MaxCharacters:Integer; SubCallback:TTIGSubCallback; end;
var GCtx:TTIGContext;
    GRawMode:Boolean=False;
    VTIG_HighColor:Boolean=False;
    ProbeStyle:TTIGStyle;
procedure HostDraw(aHeader:Pointer;aHeaderLength:DWord;aText:Pointer;aTextLength:DWord);
  external 'drl_host' name 'draw_command';
function Point(x,y:Integer):TIOPoint;
begin Result.X:=x;Result.Y:=y;end;
function Rectangle(aPosition,aSize:TIOPoint):TIORect;
begin
  Result.Pos:=aPosition;Result.Dim:=aSize;Result.X:=aPosition.X;Result.Y:=aPosition.Y;
  Result.X2:=Result.X+aSize.X-1;Result.Y2:=Result.Y+aSize.Y-1;
  Result.Pos2:=Point(Result.X2,Result.Y2);
end;
function VTIG_BoldenColor(aColor:TIOColor):TIOColor;
begin
  case aColor of 0:Exit(0);1..7:Exit(aColor+8);8:Exit(7);end;Exit(15);
end;
function TTIGDrawList.PushText(aPart:PAnsiChar;aLength:Integer):TIOPoint;
var s:AnsiString;
begin
  Result.X:=Length(FText);SetString(s,aPart,aLength);FText+=s;Result.Y:=Length(FText);
end;
procedure TTIGDrawList.Push(const aCmd:TTIGDrawCommand);
var words:array[0..15] of DWord;s:AnsiString;
begin
  FillChar(words,SizeOf(words),0);words[0]:=1;words[1]:=0;
  words[2]:=aCmd.Area.X-1;words[3]:=aCmd.Area.Y-1;
  words[4]:=aCmd.Area.Dim.X;words[5]:=aCmd.Area.Dim.Y;
  words[6]:=aCmd.Clip.X-1;words[7]:=aCmd.Clip.Y-1;
  words[8]:=aCmd.Clip.Dim.X;words[9]:=aCmd.Clip.Dim.Y;
  words[10]:=aCmd.FG;words[11]:=aCmd.BG;words[13]:=aCmd.TextEncoding;
  s:=Copy(FText,aCmd.Text.X+1,aCmd.Text.Y-aCmd.Text.X);
  HostDraw(@words[0],SizeOf(words),PAnsiChar(s),Length(s));
end;

type TTIGStyleStack = object
private
  FColors  : array[0..15] of TIOColor; // Assuming a maximum depth of 16 nested styles
  FIndex   : Integer;
  FDefault : TIOColor;
public
  procedure Init( aDefault : TIOColor );
  procedure Push( aStyle: TIOColor );
  procedure Pop;
  function Current: TIOColor;
end;

procedure TTIGStyleStack.Init( aDefault : TIOColor );
begin
  FIndex   := -1;
  FDefault := aDefault;
  Push( aDefault );
end;

procedure TTIGStyleStack.Push( aStyle: TIOColor );
begin
  if FIndex < High(FColors) then
  begin
    Inc(FIndex);
    FColors[FIndex] := aStyle;
  end;
end;

procedure TTIGStyleStack.Pop;
begin
  if FIndex > 0 then
    Dec(FIndex);
end;

function TTIGStyleStack.Current: TIOColor;
begin
  if FIndex >= 0 then
    Result := FColors[FIndex]
  else
    Result := FDefault;
  if VTIG_HighColor and ( Result < 16 ) then
  case Result of
    1..7 : Result += 8;
    8    : Result := 7;
    9..14: Result := 15;
  end;
end;

const VTIG_MAX_SUBWIDTH = 99; // clamp for the {$name|N} / {N|N} width controller

var GPadBuffer : array[0..VTIG_MAX_SUBWIDTH-1] of AnsiChar; // static space buffer, filled once - avoids per-call padding allocations

function VTIG_PLength( const aText: PAnsiChar; aParameters: array of const ) : Integer; forward;

// Parses a width spec such as '10', '-10' (cut-only) or '+10' (pad-only) directly from a pointer range, no allocations.
function VTIG_ParseWidthSpec( aSpec : PAnsiChar; aSpecLen : Integer; out aWidth : Integer; out aAllowPad, aAllowCut : Boolean ) : Boolean;
var i : Integer;
begin
  aAllowPad := True;
  aAllowCut := True;
  aWidth    := 0;
  Result    := False;
  if aSpecLen <= 0 then Exit;
  i := 0;
  if aSpec[0] = '-' then begin aAllowPad := False; Inc(i); end
  else if aSpec[0] = '+' then begin aAllowCut := False; Inc(i); end;
  if i >= aSpecLen then Exit;
  while i < aSpecLen do
  begin
    if not ( aSpec[i] in ['0'..'9'] ) then Exit; // malformed spec, caller degrades to "no width"
    aWidth := aWidth * 10 + ( Ord(aSpec[i]) - Ord('0') );
    Inc(i);
  end;
  if aWidth > VTIG_MAX_SUBWIDTH then aWidth := VTIG_MAX_SUBWIDTH;
  Result := aWidth > 0;
end;

// Final visible length after applying cut then pad - shared by the render and measure paths so they always agree.
function VTIG_ApplyWidth( aLen, aWidth : Integer; aAllowPad, aAllowCut : Boolean ) : Integer;
begin
  Result := aLen;
  if aAllowCut and ( Result > aWidth ) then Result := aWidth;
  if aAllowPad and ( Result < aWidth ) then Result := aWidth;
end;

// Single-pass scan of a self-contained {N...} / {$name...} tag body up to its closing '}', splitting
// off an optional trailing '|widthspec'. Shared by the digit and '$' branches of both the render and
// measure walkers, so the "{}"-adjustment-value extraction only exists once.
// aBodyLen = offset of the closing '}' relative to aBody. aNameLen = offset of '|' (or aBodyLen if none).
// Returns False if no closing '}' is found before the string ends (malformed tag).
function VTIG_ScanWidthTag( aBody : PAnsiChar; out aBodyLen, aNameLen, aWidth : Integer; out aAllowPad, aAllowCut : Boolean ) : Boolean;
var iBarPos : Integer;
begin
  aBodyLen := 0;
  iBarPos  := -1;
  while (aBody[aBodyLen] <> '}') and (aBody[aBodyLen] <> #0) do
  begin
    if (iBarPos < 0) and (aBody[aBodyLen] = '|') then iBarPos := aBodyLen;
    Inc(aBodyLen);
  end;
  Result := aBody[aBodyLen] = '}';
  if not Result then Exit;
  if iBarPos >= 0 then
  begin
    aNameLen := iBarPos;
    VTIG_ParseWidthSpec( aBody + iBarPos + 1, aBodyLen - iBarPos - 1, aWidth, aAllowPad, aAllowCut );
  end
  else
  begin
    aNameLen  := aBodyLen;
    aWidth    := 0;
    aAllowPad := True;
    aAllowCut := True;
  end;
end;


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
function VTIG_UTF8CutTagged(const aText: AnsiString; aColumns: Integer): AnsiString;
const PushColors: set of Char = ['^','r','R','b','B','g','G','v','V','c','C',
  'l','L','d','D','n','N','y','Y','!'];
var i, iEnd, iFit, iDepth: Integer;
    iRaw: PAnsiChar;
begin
  Result := ''; i := 0; iDepth := 0; iRaw := PAnsiChar(aText);
  if aColumns <= 0 then Exit;
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
  if iRaw[i] <> #0 then Result += StringOfChar('}', iDepth);
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

function VTIG_PLength(const aText:PAnsiChar;aParameters:array of const):Integer;
begin Result:=VTIG_UTF8Total(VTIG_UTF8Plain(aText,aParameters));end;
function Substitute(const aID:AnsiString):AnsiString;
begin if aID='name' then Result:='日本語' else Result:='';end;
procedure Check(aValue,aExpected:Integer;const aName:String);
begin
  if aValue<>aExpected then begin
    WriteLn('FAIL ',aName,' actual=',aValue,' expected=',aExpected);Halt(1);
  end;
  WriteLn('PASS ',aName);
end;
procedure CheckText(const aValue,aExpected:AnsiString;const aName:String);
begin
  if aValue<>aExpected then begin WriteLn('FAIL ',aName);Halt(1);end;
  WriteLn('PASS ',aName);
end;
procedure Draw(const s:AnsiString;x,y,w,h:Integer;aParams:array of const);
var stack:TTIGStyleStack;clip:TIORect;
begin
  stack.Init(7);clip:=Rectangle(Point(x,y),Point(w,h));
  VTIG_RenderTextSegment(PAnsiChar(s),x,y,clip,stack,aParams);
end;
begin
  FillChar(GPadBuffer,SizeOf(GPadBuffer),' ');
  GCtx.Current:=TTIGWindow.Create;GCtx.Current.DrawList:=TTIGDrawList.Create;
  GCtx.MaxCharacters:=-1;GCtx.Style:=@ProbeStyle;ProbeStyle.Color[0]:=15;
  GCtx.SubCallback:=@Substitute;
  Check(VTIG_PLength(PAnsiChar('日本語'),[]),6,'Japanese display columns');
  Check(VTIG_PLength(PAnsiChar('A{R日本}B'),[]),6,'native color tags');
  Check(VTIG_PLength(PAnsiChar('x{0}y'),['日本語']),8,'indexed UTF8 parameter');
  Check(VTIG_PLength(PAnsiChar('{0}'),[123]),3,'integer parameter');
  Check(VTIG_PLength(PAnsiChar('{0|3}'),['日本語']),3,'cut and pad odd width');
  Check(VTIG_PLength(PAnsiChar('{0|-3}'),['日本語']),2,'cut only preserves cluster');
  Check(VTIG_PLength(PAnsiChar('{0|+3}'),['日本語']),6,'pad only retains text');
  Check(VTIG_PLength(PAnsiChar('{$name|8}'),[]),8,'callback and padding');
  Check(VTIG_PLength(PAnsiChar('e'+#$CC#$81),[]),1,'combining cluster');
  Check(VTIG_PLength(PAnsiChar(#$F0#$9F#$91#$A9#$E2#$80#$8D#$F0#$9F#$94#$AC),[]),2,'emoji ZWJ cluster');
  Check(VTIG_PLength(PAnsiChar('{0|-2}'),['A'+#10+'日本']),2,'multiline local cut budget');
  Check(VTIG_PLength(PAnsiChar(#$CC#$81),[]),1,'leading combining mark dotted base');
  CheckText(VTIG_UTF8CutTagged('A{R日本}B',3),'A{R日}','markup prefix closes cut styles');
  CheckText(VTIG_UTF8Expand(PAnsiChar('{$name|3}'),[]),'日 ','expanded callback width');
  CheckText(VTIG_UTF8CutTagged(VTIG_UTF8Expand(PAnsiChar('x{0|3}y'),['日本語']),4),'x日 ','indexed prefix');
  CheckText(VTIG_UTF8CutTagged('e'+#$CC#$81+'Z',1),'e'+#$CC#$81,'prefix combining cluster');
  CheckText(VTIG_UTF8CutTagged('日本',0),'','zero column prefix');
  CheckText(VTIG_UTF8CutTagged('AB{R日本}Z',7),'AB{R日本}Z','uncut controls preserved');
  Draw('日本語ABC',1,1,5,3,[]);
  Draw('AB{R日本語}Z',1,5,6,3,[]);
  Draw('X{0|3}Y',1,9,8,2,['日本語']);
  Draw('X{0|-3}Y',1,12,8,2,['日本語']);
  Draw('one two three',1,15,7,3,[]);
  Draw('A'+#13#10+'日本',1,19,4,3,[]);
  Draw('X{0|-3}Y',1,21,8,1,['A{R日本}B']);
  Draw('日本語',1,23,1,1,[]);
  Draw('{0|-2}',31,2,8,3,['A'+#10+'日本']);
  Draw(VTIG_UTF8CutTagged('A{R日本}B',3),31,6,8,1,[]);
  GCtx.Current.DrawList.Free;GCtx.Current.Free;
  WriteLn('PASS CJK rendering completed');
end.
