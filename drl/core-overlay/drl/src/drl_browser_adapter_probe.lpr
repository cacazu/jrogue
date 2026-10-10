{$INCLUDE drl.inc}
program drl_browser_adapter_probe;
uses SysUtils, viotypes, vioevent, vbrowserhost, vbrowserio, vbrowserconsole;
procedure Check(aCondition: Boolean; const aMessage: AnsiString);
begin if not aCondition then raise Exception.Create(aMessage); end;
var input: TBrowserEventBytes; event: TIOEvent; driver: TBrowserIODriver;
    renderer: TBrowserConsoleRenderer; frame: TBrowserBytes; utf8: UTF8String; i: Integer;
begin
  try
  driver := TBrowserIODriver.Create;
  renderer := TBrowserConsoleRenderer.Create;
  try
    Check((BrowserSaveGeneration=0) and (BrowserUserFilesGeneration=0),'Persistence counters not initially zero');
    BrowserUserFilesCompleted;
    Check((BrowserSaveGeneration=0) and (BrowserUserFilesGeneration=1),'Profile/file completion incorrectly marks a game save');
    BrowserSaveCompleted;
    Check((BrowserSaveGeneration=1) and (BrowserUserFilesGeneration=2),'Completed game save missing user-files witness');
    FillChar(input,SizeOf(input),0);
    PutU32(input,0,1); PutU32(input,4,Ord(VEVENT_KEYDOWN)); PutU32(input,8,VKEY_UP);
    PutU32(input,16,IOKeyCodeShiftMask); PutU32(input,20,1);
    ProbeSetEvent(input);
    Check(driver.PeekEvent(event) and driver.EventPending,'Peek consumed event');
    Check(driver.PollEvent(event) and not driver.EventPending,'Poll did not consume event');
    Check((event.Key.Code=VKEY_UP) and (VKMOD_SHIFT in event.Key.ModState) and event.Key.Pressed,'Key/modifier wire mismatch');
    FillChar(input,SizeOf(input),0);
    PutU32(input,0,1); PutU32(input,4,Ord(VEVENT_MOUSEDOWN));
    PutU32(input,16,IOKeyCodeAltMask); PutU32(input,20,1);
    PutU32(input,24,2); PutU32(input,28,3); PutU32(input,40,Ord(VMB_BUTTON_LEFT));
    ProbeSetEvent(input);
    Check(driver.PeekEvent(event) and (VKMOD_SHIFT in driver.GetModKeyState),'Pointer peek changed consumed modifier state');
    Check(driver.PollEvent(event) and (VKMOD_ALT in driver.GetModKeyState),'Pointer modifier state not updated by poll');
    Check((event.Mouse.Pos.X=2) and (event.Mouse.Pos.Y=3),'Console pointer position changed from 1-based wire');
    utf8 := UTF8String(#$E6#$97#$A5#$E6#$9C#$AC); // 日本, UTF8 bytes remain text.
    FillChar(input,SizeOf(input),0);
    PutU32(input,0,1); PutU32(input,4,Ord(VEVENT_TEXT)); PutU32(input,60,Length(utf8));
    Move(utf8[1],input[64],Length(utf8));
    Check(DecodeBrowserEvent(input,event),'UTF8 text packet rejected');
    for i := 1 to Length(utf8) do Check(event.Text.Text[i-1]=utf8[i],'UTF8 text byte altered');
    Check(event.Text.Text[Length(utf8)]=#0,'UTF8 text packet lacks terminator');
    PutU32(input,60,64); Check(not DecodeBrowserEvent(input,event),'Oversize text packet accepted');
    PutU32(input,60,0); PutU32(input,12,128); Check(not DecodeBrowserEvent(input,event),'UTF8 byte accepted as key ASCII');
    renderer.OutputChar(80,25,14,2,'@'); renderer.OutputChar(81,25,4,'X');
    Check(renderer.GetChar(80,25)='@','Console bounds/write mismatch');
    renderer.MoveCursor(80,25); renderer.ShowCursor; renderer.Update;
    frame := ProbeFrame;
    Check(Length(frame)=24032,'Frame length mismatch');
    Check((GetU32(frame,0)=$464C5244) and (GetU32(frame,4)=1),'Frame identity mismatch');
    Check((GetU32(frame,16)=79) and (GetU32(frame,20)=24) and (GetU32(frame,24)=1),'Cursor not zero based');
    Check((GetU32(frame,32+1999*12)=Ord('@')) and (GetU32(frame,36+1999*12)=14)
      and (GetU32(frame,40+1999*12)=2),'Cell glyph/colors wire mismatch');
    Check(GetU32(frame,28)=1,'Legacy-byte glyph flag missing');
    renderer.MoveCursor(0,0); renderer.ShowCursor; renderer.Update;
    frame := ProbeFrame;
    Check(GetU32(frame,24)=0,'Transient off-screen native cursor must not be visible on the wire');
    renderer.MoveCursor(1,1); renderer.Update;
    frame := ProbeFrame;
    Check((GetU32(frame,24)=1) and (GetU32(frame,16)=0) and (GetU32(frame,20)=0),
      'Cursor must become visible when the original UI assigns a valid position');
    Writeln('PASS original engine host adapter wire, peek/poll, UTF8 text, bounds, frame/cursor/colors');
  finally renderer.Free; driver.Free; end;
  except on e: Exception do begin Writeln(StdErr,e.ClassName, ': ', e.Message); Halt(1); end; end;
end.
