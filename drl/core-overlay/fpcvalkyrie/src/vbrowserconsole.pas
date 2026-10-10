{$INCLUDE valkyrie.inc}
unit vbrowserconsole;
interface
uses Classes, SysUtils, vutil, viotypes, vioconsole, vbrowserhost;
type TBrowserConsoleRenderer = class(TIOConsoleRenderer)
  constructor Create(aCols: Word = 80; aRows: Word = 25; aReqCapabilities: TIOConsoleCapSet = [VIO_CON_BGCOLOR, VIO_CON_CURSOR]);
  procedure OutputChar(x,y: Integer; aColor: TIOColor; aChar: Char); override;
  procedure OutputChar(x,y: Integer; aFrontColor,aBackColor: TIOColor; aChar: Char); override;
  function GetChar(x,y: Integer): Char; override;
  function GetColor(x,y: Integer): TIOColor; override;
  function GetBackColor(x,y: Integer): TIOColor; override;
  procedure MoveCursor(x,y: Integer); override;
  procedure ShowCursor; override;
  procedure HideCursor; override;
  procedure Update; override;
  procedure Clear; override;
  procedure ClearRect(x1,y1,x2,y2: Integer; aBackColor: TIOColor = 0); override;
  function GetDeviceArea: TIORect; override;
  function GetSupportedCapabilities: TIOConsoleCapSet; override;
private
  FCells: array of Word;
  FCX, FCY: LongInt;
  FCursorVisible: Boolean;
  function Index(x,y: Integer): SizeInt;
end;
implementation
constructor TBrowserConsoleRenderer.Create(aCols,aRows: Word; aReqCapabilities: TIOConsoleCapSet);
begin
  if (aCols <> 80) or (aRows <> 25) then raise EIOException.Create('Browser console geometry must be 80x25');
  inherited Create(aCols,aRows,aReqCapabilities);
  SetLength(FCells, aCols*aRows); FCX := -1; FCY := -1; FCursorVisible := False; Clear;
end;
function TBrowserConsoleRenderer.Index(x,y: Integer): SizeInt;
begin
  if (x < 1) or (x > FSizeX) or (y < 1) or (y > FSizeY) then Exit(-1);
  Result := (x-1)+(y-1)*FSizeX;
end;
procedure TBrowserConsoleRenderer.OutputChar(x,y: Integer; aColor: TIOColor; aChar: Char);
var i: SizeInt;
begin
  if aColor = ColorNone then Exit;
  if (aColor and $F0) <> 0 then begin OutputChar(x,y,aColor and $F,(aColor shr 4) and $F,aChar); Exit; end;
  i := Index(x,y); if i < 0 then Exit;
  FCells[i] := (FCells[i] and $F000) or ((aColor and $F) shl 8) or Ord(aChar);
end;
procedure TBrowserConsoleRenderer.OutputChar(x,y: Integer; aFrontColor,aBackColor: TIOColor; aChar: Char);
var i: SizeInt;
begin
  if aBackColor = ColorNone then begin OutputChar(x,y,aFrontColor,aChar); Exit; end;
  i := Index(x,y); if i < 0 then Exit;
  if aFrontColor = ColorNone then FCells[i] := ((aBackColor and $F) shl 12)
  else FCells[i] := Ord(aChar) or ((aFrontColor and $F) shl 8) or ((aBackColor and $F) shl 12);
end;
function TBrowserConsoleRenderer.GetChar(x,y: Integer): Char;
var i: SizeInt; begin i := Index(x,y); if i < 0 then Exit(' '); Result := Char(FCells[i] and $FF); end;
function TBrowserConsoleRenderer.GetColor(x,y: Integer): TIOColor;
var i: SizeInt; begin i := Index(x,y); if i < 0 then Exit(7); Result := (FCells[i] shr 8) and $F; end;
function TBrowserConsoleRenderer.GetBackColor(x,y: Integer): TIOColor;
var i: SizeInt; begin i := Index(x,y); if i < 0 then Exit(0); Result := FCells[i] shr 12; end;
procedure TBrowserConsoleRenderer.MoveCursor(x,y: Integer); begin FCX := x-1; FCY := y-1; end;
procedure TBrowserConsoleRenderer.ShowCursor; begin FCursorVisible := True; end;
procedure TBrowserConsoleRenderer.HideCursor; begin FCursorVisible := False; end;
procedure TBrowserConsoleRenderer.Update;
var data: TBrowserBytes; i,o: SizeInt;
begin
  SetLength(data,BrowserFrameHeaderBytes+Length(FCells)*BrowserCellBytes);
  PutU32(data,0,$464C5244); PutU32(data,4,1); PutU32(data,8,FSizeX); PutU32(data,12,FSizeY);
  PutU32(data,16,DWord(FCX)); PutU32(data,20,DWord(FCY));
  { Menus may show the cursor before assigning its first position. Native
    consoles cannot display an off-screen cursor; enforce that at the wire. }
  PutU32(data,24,Ord(FCursorVisible and (FCX >= 0) and (FCX < FSizeX)
    and (FCY >= 0) and (FCY < FSizeY)));
  // Flag 1 identifies original byte glyphs; Rust must map CP437 before drawing.
  PutU32(data,28,1);
  for i := 0 to High(FCells) do begin
    o := BrowserFrameHeaderBytes+i*BrowserCellBytes;
    PutU32(data,o,FCells[i] and $FF); PutU32(data,o+4,(FCells[i] shr 8) and $F); PutU32(data,o+8,FCells[i] shr 12);
  end;
  HostFrame(@data[0],Length(data));
end;
procedure TBrowserConsoleRenderer.Clear;
var i: SizeInt; begin for i := 0 to High(FCells) do FCells[i] := $0720; end;
procedure TBrowserConsoleRenderer.ClearRect(x1,y1,x2,y2: Integer; aBackColor: TIOColor);
var x,y,i: Integer;
begin
  for y := y1 to y2 do for x := x1 to x2 do begin
    i := Index(x,y); if i < 0 then Continue;
    if aBackColor = ColorNone then FCells[i] := FCells[i] and $FF00
    else FCells[i] := $0720 or ((aBackColor and $F) shl 12);
  end;
end;
function TBrowserConsoleRenderer.GetDeviceArea: TIORect;
begin Result.Pos := PointZero; Result.Dim := Point(FSizeX,FSizeY); end;
function TBrowserConsoleRenderer.GetSupportedCapabilities: TIOConsoleCapSet;
begin Result := [VIO_CON_BGCOLOR,VIO_CON_CURSOR]; end;
end.
