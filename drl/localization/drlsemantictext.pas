{ DRL semantic presentation boundary, GPL-2.0.
  No localization catalog, rendering, input, simulation state or RNG lives here.
  Browser integration installs a Rust-backed resolver before constructing views.
  An unconnected native build retains exact English fallback text. }
unit drlsemantictext;
{$mode objfpc}{$H+}
interface
type
  TDRLTextParamKind = (DRL_TEXT_STRING, DRL_TEXT_INTEGER);
  TDRLTextParam = record
    Name: AnsiString;
    Value: AnsiString;
    Kind: TDRLTextParamKind;
  end;
  TDRLSemanticTextResolver = function(
    const aID, aEnglish: AnsiString;
    const aParams: array of TDRLTextParam
  ): AnsiString;

var DRLSemanticTextResolver: TDRLSemanticTextResolver = nil;
function DRLStringParam(const aName, aValue: AnsiString): TDRLTextParam;
function DRLIntegerParam(const aName: AnsiString; aValue: Int64): TDRLTextParam;
function DRLText(const aID, aEnglish: AnsiString): AnsiString; overload;
function DRLText(const aID, aEnglish: AnsiString;
  const aParams: array of TDRLTextParam): AnsiString; overload;
function DRLEnglishText(const aID, aEnglish: AnsiString;
  const aParams: array of TDRLTextParam): AnsiString;
implementation
uses SysUtils;

function DRLStringParam(const aName, aValue: AnsiString): TDRLTextParam;
begin
  Result.Name := aName;
  Result.Value := aValue;
  Result.Kind := DRL_TEXT_STRING;
end;

function DRLIntegerParam(const aName: AnsiString; aValue: Int64): TDRLTextParam;
begin
  Result.Name := aName;
  Result.Value := IntToStr(aValue);
  Result.Kind := DRL_TEXT_INTEGER;
end;

function ValidName(const aName: AnsiString; aID: Boolean): Boolean;
var i: SizeInt;
begin
  if (Length(aName) = 0) or (Length(aName) > 160) then Exit(False);
  if not (aName[1] in ['a'..'z']) then Exit(False);
  for i := 2 to Length(aName) do
    if not ((aName[i] in ['a'..'z','0'..'9','_']) or
      (aID and (aName[i] in ['.','-']))) then Exit(False);
  Exit(True);
end;

function RenderSemanticText(const aID, aEnglish: AnsiString;
  const aParams: array of TDRLTextParam; aResolve: Boolean): AnsiString;
var
  i, j, k, finish, found: SizeInt;
  iName: AnsiString;
  iInteger: Int64;
  used: array of Boolean;
begin
  if not ValidName(aID, True) then
    raise EArgumentException.Create('Invalid DRL semantic text ID');
  if (Length(aEnglish) > 32768) or (Length(aParams) > 16) then
    raise EArgumentException.Create('DRL semantic text request exceeds bounds');
  SetLength(used, Length(aParams));
  for i := 0 to High(aParams) do begin
    if not ValidName(aParams[i].Name, False) or (Length(aParams[i].Name) > 64)
      or (Length(aParams[i].Value) > 32768) then
      raise EArgumentException.Create('Invalid DRL semantic text parameter');
    if aParams[i].Kind = DRL_TEXT_INTEGER then begin
      if not TryStrToInt64(aParams[i].Value, iInteger) then
        raise EArgumentException.Create('Invalid DRL integer text parameter');
      if IntToStr(iInteger) <> aParams[i].Value then
        raise EArgumentException.Create('Noncanonical DRL integer text parameter');
    end;
    for j := 0 to i-1 do
      if aParams[i].Name = aParams[j].Name then
        raise EArgumentException.Create('Duplicate DRL semantic text parameter');
  end;
  Result := '';
  i := 1;
  while i <= Length(aEnglish) do begin
    if (aEnglish[i] = '{') and (i < Length(aEnglish))
      and (aEnglish[i+1] = '{') then begin
      finish := i + 2;
      while (finish < Length(aEnglish)) and
        not ((aEnglish[finish] = '}') and (aEnglish[finish+1] = '}')) do
        Inc(finish);
      if finish >= Length(aEnglish) then
        raise EArgumentException.Create('Unterminated DRL semantic text placeholder');
      iName := Copy(aEnglish, i + 2, finish - i - 2);
      if not ValidName(iName, False) then
        raise EArgumentException.Create('Invalid DRL semantic text placeholder');
      found := -1;
      for k := 0 to High(aParams) do
        if aParams[k].Name = iName then found := k;
      if found < 0 then
        raise EArgumentException.Create('Missing DRL semantic text parameter');
      used[found] := True;
      { Values are appended verbatim; never interpreted as placeholders. }
      Result := Result + aParams[found].Value;
      i := finish + 2;
    end else begin
      Result := Result + aEnglish[i];
      Inc(i);
    end;
  end;
  for i := 0 to High(used) do
    if not used[i] then
      raise EArgumentException.Create('Unexpected DRL semantic text parameter');
  if aResolve and Assigned(DRLSemanticTextResolver) then
    Result := DRLSemanticTextResolver(aID, aEnglish, aParams);
end;
function DRLText(const aID, aEnglish: AnsiString): AnsiString;
begin
  Exit(RenderSemanticText(aID, aEnglish, [], True));
end;
function DRLText(const aID, aEnglish: AnsiString;
  const aParams: array of TDRLTextParam): AnsiString;
begin
  Exit(RenderSemanticText(aID, aEnglish, aParams, True));
end;
function DRLEnglishText(const aID, aEnglish: AnsiString;
  const aParams: array of TDRLTextParam): AnsiString;
begin
  Exit(RenderSemanticText(aID, aEnglish, aParams, False));
end;
end.
