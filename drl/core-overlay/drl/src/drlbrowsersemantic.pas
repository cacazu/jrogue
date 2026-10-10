{$INCLUDE drl.inc}
unit drlbrowsersemantic;
interface
procedure InstallBrowserTextResolver;
implementation
uses SysUtils, drlsemantictext;
{$IFDEF DRL_WASM}
function HostResolveText(aRequest: Pointer; aRequestBytes: DWord; aOutput: Pointer; aCapacity: DWord): LongInt;
  external 'drl_host' name 'resolve_text';
function JSONString(const aValue: AnsiString): AnsiString;
const Hex = '0123456789abcdef';
var i: SizeInt; c: Byte;
begin
  Result := '"';
  for i := 1 to Length(aValue) do begin
    c := Ord(aValue[i]);
    case c of
      34: Result += '\"';
      92: Result += '\\';
      0..31: Result += '\u00'+Hex[(c shr 4)+1]+Hex[(c and $F)+1];
    else Result += aValue[i];
    end;
  end;
  Result += '"';
end;
function ResolveBrowserText(const aID,aEnglish: AnsiString; const aParams: array of TDRLTextParam): AnsiString;
var request, kind: AnsiString; i: SizeInt; bytes, actual: LongInt;
begin
  request := '{"kind":"native_text","id":'+JSONString(aID)+',"english":false,"parameters":{';
  for i := 0 to High(aParams) do begin
    if i > 0 then request += ',';
    if aParams[i].Kind = DRL_TEXT_INTEGER then kind := 'integer' else kind := 'string';
    request += JSONString(aParams[i].Name)+':{"kind":'+JSONString(kind)+',"value":'+JSONString(aParams[i].Value)+'}';
  end;
  request += '}}';
  if Length(request) > 32768 then raise EArgumentException.Create('Semantic host request exceeds bounds');
  bytes := HostResolveText(Pointer(request),Length(request),nil,0);
  if (bytes < 0) or (bytes > 32768) then raise EArgumentException.Create('Semantic host rejected text request');
  SetLength(Result,bytes);
  actual := HostResolveText(Pointer(request),Length(request),Pointer(Result),bytes);
  if actual <> bytes then raise EArgumentException.Create('Semantic host response length changed');
end;
{$ENDIF}
procedure InstallBrowserTextResolver;
begin
  {$IFDEF DRL_WASM}DRLSemanticTextResolver := @ResolveBrowserText;{$ENDIF}
end;
end.
