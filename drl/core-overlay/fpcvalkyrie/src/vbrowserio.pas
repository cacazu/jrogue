{$INCLUDE valkyrie.inc}
unit vbrowserio;
interface
uses Classes, SysUtils, vutil, viotypes, vioevent, vbrowserhost;
type TBrowserIODriver = class(TIODriver)
  constructor Create(aWidth: DWord = 80; aHeight: DWord = 25);
  function PollEvent(out aEvent: TIOEvent): Boolean; override;
  function PeekEvent(out aEvent: TIOEvent): Boolean; override;
  function EventPending: Boolean; override;
  procedure SetEventMask(aMask: TIOEventType); override;
  procedure Sleep(Milliseconds: DWord); override;
  procedure PreUpdate; override;
  procedure PostUpdate; override;
  function GetMs: DWord; override;
  function GetSizeX: DWord; override;
  function GetSizeY: DWord; override;
  function GetMousePos(out aResult: TIOPoint): Boolean; override;
  function GetMouseButtonState(out aResult: TIOMouseButtonSet): Boolean; override;
  function GetModKeyState: TIOModKeySet; override;
  procedure SetTitle(const aLongTitle: AnsiString; const aShortTitle: AnsiString = ''); override;
  procedure StartTextInput; override;
  procedure StopTextInput; override;
  function Rumble(aLow, aHigh: Word; aDuration: DWord): Boolean; override;
private
  FWidth, FHeight: DWord;
  FMouse: TIOPoint;
  FButtons: TIOMouseButtonSet;
  FMods: TIOModKeySet;
  function ReadEvent(out aEvent: TIOEvent; aPeek: Boolean): Boolean;
end;
function DecodeBrowserEvent(const aData: TBrowserEventBytes; out aEvent: TIOEvent): Boolean;
implementation
function DecodeBrowserEvent(const aData: TBrowserEventBytes; out aEvent: TIOEvent): Boolean;
var kind, code, ascii, mods, flags, button, n, i: DWord;
begin
  Result := False;
  FillChar(aEvent, SizeOf(aEvent), 0);
  if GetU32(aData, 0) <> 1 then Exit;
  kind := GetU32(aData, 4); code := GetU32(aData, 8);
  ascii := GetU32(aData, 12); mods := GetU32(aData, 16); flags := GetU32(aData, 20);
  button := GetU32(aData, 40); n := GetU32(aData, 60);
  if (kind > Ord(High(TIOEventType))) or (code > 255) or (ascii > 127)
    or ((mods and not DWord(IOKeyCodeModMask)) <> 0) or (flags > 3) or (n > 63) then Exit;
  aEvent.EType := TIOEventType(kind);
  case aEvent.EType of
    VEVENT_KEYDOWN, VEVENT_KEYUP: begin
      aEvent.Key.Code := Byte(code); aEvent.Key.ASCII := Char(ascii);
      aEvent.Key.ModState := IOModState(TIOKeyCode(mods));
      aEvent.Key.Pressed := (flags and 1) <> 0; aEvent.Key.Repeated := (flags and 2) <> 0;
    end;
    VEVENT_MOUSEMOVE: begin
      if GetU32(aData, 44) > 63 then Exit;
      aEvent.MouseMove.Pos := Point(LongInt(GetU32(aData, 24)), LongInt(GetU32(aData, 28)));
      aEvent.MouseMove.RelPos := Point(LongInt(GetU32(aData, 32)), LongInt(GetU32(aData, 36)));
      for i := Ord(Low(TIOMouseButton)) to Ord(High(TIOMouseButton)) do
        if (GetU32(aData, 44) and (DWord(1) shl i)) <> 0 then Include(aEvent.MouseMove.ButtonState, TIOMouseButton(i));
    end;
    VEVENT_MOUSEDOWN, VEVENT_MOUSEUP: begin
      if button > Ord(High(TIOMouseButton)) then Exit;
      aEvent.Mouse.Button := TIOMouseButton(button);
      aEvent.Mouse.Pos := Point(LongInt(GetU32(aData, 24)), LongInt(GetU32(aData, 28)));
      aEvent.Mouse.Pressed := (flags and 1) <> 0;
    end;
    VEVENT_PADAXIS: begin
      if (LongInt(code) < Ord(Low(TIOPadAxis))) or (LongInt(code) > Ord(High(TIOPadAxis)))
        or (LongInt(GetU32(aData, 48)) < -32768) or (LongInt(GetU32(aData, 48)) > 32767) then Exit;
      aEvent.PadAxis.Axis := TIOPadAxis(code); aEvent.PadAxis.Value := Int16(GetU32(aData, 48));
      aEvent.PadAxis.Which := LongInt(GetU32(aData, 52));
    end;
    VEVENT_PADDOWN, VEVENT_PADUP: begin
      if button > Ord(High(TIOPadButton)) then Exit;
      aEvent.Pad.Button := TIOPadButton(button); aEvent.Pad.Pressed := (flags and 1) <> 0;
      aEvent.Pad.Which := LongInt(GetU32(aData, 52));
    end;
    VEVENT_PADDEVICE: begin
      if code > Ord(High(TIOPadDevice)) then Exit;
      aEvent.PadDevice.Event := TIOPadDevice(code); aEvent.PadDevice.Which := LongInt(GetU32(aData, 52));
    end;
    VEVENT_SYSTEM: begin
      if GetU32(aData, 56) > VIO_SYSEVENT_COUNT then Exit;
      aEvent.System.Code := GetU32(aData, 56); aEvent.System.Param1 := GetU32(aData, 24);
      aEvent.System.Param2 := GetU32(aData, 28);
    end;
    VEVENT_TEXT: begin
      for i := 0 to n do if (i < n) and (aData[64+i] = 0) then Exit;
      if n > 0 then Move(aData[64], aEvent.Text.Text[0], n);
      aEvent.Text.Text[n] := #0;
    end;
  end;
  Result := True;
end;
constructor TBrowserIODriver.Create(aWidth, aHeight: DWord);
begin inherited Create; FWidth := aWidth; FHeight := aHeight; FMouse := Point(-1, -1); FButtons := []; FMods := []; end;
function TBrowserIODriver.ReadEvent(out aEvent: TIOEvent; aPeek: Boolean): Boolean;
var data: TBrowserEventBytes; status: LongInt; idx: TIOKeyCode;
begin
  status := HostPollEvent(@data[0], SizeOf(data), Ord(aPeek));
  if status < 0 then raise EIOException.Create('Invalid browser event packet');
  Result := (status = 1) and DecodeBrowserEvent(data, aEvent);
  if (status = 1) and not Result then raise EIOException.Create('Invalid browser event payload');
  if not Result or aPeek then Exit;
  FMods := IOModState(TIOKeyCode(GetU32(data,16)));
  case aEvent.EType of
    VEVENT_KEYDOWN, VEVENT_KEYUP: FMods := aEvent.Key.ModState;
    VEVENT_MOUSEMOVE: begin FMouse := aEvent.MouseMove.Pos; FButtons := aEvent.MouseMove.ButtonState; end;
    VEVENT_MOUSEDOWN, VEVENT_MOUSEUP: begin
      FMouse := aEvent.Mouse.Pos;
      if aEvent.Mouse.Pressed then Include(FButtons, aEvent.Mouse.Button) else Exclude(FButtons, aEvent.Mouse.Button);
    end;
  end;
  if (aEvent.EType = VEVENT_SYSTEM) and (aEvent.System.Code = VIO_SYSEVENT_QUIT) and Assigned(FOnQuit) then
    if FOnQuit(aEvent) then Exit(False);
  if aEvent.EType = VEVENT_KEYDOWN then begin
    idx := IOKeyEventToIOKeyCode(aEvent.Key);
    if Assigned(FInterrupts[idx]) and FInterrupts[idx](aEvent) then Exit(False);
  end;
end;
function TBrowserIODriver.PollEvent(out aEvent: TIOEvent): Boolean; begin Result := ReadEvent(aEvent, False); end;
function TBrowserIODriver.PeekEvent(out aEvent: TIOEvent): Boolean; begin Result := ReadEvent(aEvent, True); end;
function TBrowserIODriver.EventPending: Boolean; begin Result := HostEventPending <> 0; end;
procedure TBrowserIODriver.SetEventMask(aMask: TIOEventType); begin end;
procedure TBrowserIODriver.Sleep(Milliseconds: DWord); begin HostSleep(Milliseconds); end;
procedure TBrowserIODriver.PreUpdate; begin end;
procedure TBrowserIODriver.PostUpdate; begin end;
function TBrowserIODriver.GetMs: DWord; begin Result := HostNow; end;
function TBrowserIODriver.GetSizeX: DWord; begin Result := FWidth; end;
function TBrowserIODriver.GetSizeY: DWord; begin Result := FHeight; end;
function TBrowserIODriver.GetMousePos(out aResult: TIOPoint): Boolean; begin aResult := FMouse; Result := True; end;
function TBrowserIODriver.GetMouseButtonState(out aResult: TIOMouseButtonSet): Boolean; begin aResult := FButtons; Result := True; end;
function TBrowserIODriver.GetModKeyState: TIOModKeySet; begin Result := FMods; end;
procedure TBrowserIODriver.SetTitle(const aLongTitle, aShortTitle: AnsiString);
begin HostTitle(Pointer(aLongTitle), Length(aLongTitle)); end;
procedure TBrowserIODriver.StartTextInput; begin HostTextInput(1); end;
procedure TBrowserIODriver.StopTextInput; begin HostTextInput(0); end;
function TBrowserIODriver.Rumble(aLow, aHigh: Word; aDuration: DWord): Boolean;
begin Result := HostRumble(aLow, aHigh, aDuration) <> 0; end;
end.
