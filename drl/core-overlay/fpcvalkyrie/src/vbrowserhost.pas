{$INCLUDE valkyrie.inc}
unit vbrowserhost;
{ Host ABI v1: explicit little-endian words, no compiler record layout shared. }
interface
uses SysUtils;
const BrowserEventBytes = 128;
      BrowserFrameHeaderBytes = 32;
      BrowserCellBytes = 12;
type TBrowserEventBytes = array[0..BrowserEventBytes-1] of Byte;
     TBrowserBytes = array of Byte;
procedure PutU32(var aData: array of Byte; aOffset: SizeInt; aValue: DWord);
function GetU32(const aData: array of Byte; aOffset: SizeInt): DWord;
function HostPollEvent(aData: Pointer; aCapacity, aPeek: DWord): LongInt;
function HostEventPending: LongInt;
procedure HostSleep(aMilliseconds: DWord);
function HostNow: DWord;
procedure HostFrame(aData: Pointer; aLength: DWord);
procedure HostDrawCommand(aHeader: Pointer; aHeaderLength: DWord; aText: Pointer; aTextLength: DWord);
procedure HostTextInput(aEnabled: DWord);
procedure HostTitle(aData: Pointer; aLength: DWord);
function HostRumble(aLow, aHigh, aDuration: DWord): LongInt;
procedure BrowserSaveCompleted;
function BrowserSaveGeneration: DWord; cdecl;
procedure BrowserUserFilesCompleted;
function BrowserUserFilesGeneration: DWord; cdecl;
{$IFNDEF DRL_WASM}
// Authored native adapter probes can provide input and inspect emitted frames.
procedure ProbeSetEvent(const aData: TBrowserEventBytes);
function ProbeFrame: TBrowserBytes;
{$ENDIF}
implementation
var GSaveGeneration: DWord = 0;
    GUserFilesGeneration: DWord = 0;
procedure BrowserUserFilesCompleted;
begin Inc(GUserFilesGeneration); end;
function BrowserUserFilesGeneration: DWord; cdecl; public name 'drl_user_files_generation';
begin Result := GUserFilesGeneration; end;
procedure BrowserSaveCompleted;
begin Inc(GSaveGeneration); BrowserUserFilesCompleted; end;
function BrowserSaveGeneration: DWord; cdecl; public name 'drl_save_generation';
begin Result := GSaveGeneration; end;
{$IFDEF DRL_WASM}
function HostPollEvent(aData: Pointer; aCapacity, aPeek: DWord): LongInt; external 'drl_host' name 'poll_event';
function HostEventPending: LongInt; external 'drl_host' name 'event_pending';
procedure HostSleep(aMilliseconds: DWord); external 'drl_host' name 'drl_sleep';
function HostNow: DWord; external 'drl_host' name 'now_ms';
procedure HostFrame(aData: Pointer; aLength: DWord); external 'drl_host' name 'frame';
procedure HostDrawCommand(aHeader: Pointer; aHeaderLength: DWord; aText: Pointer; aTextLength: DWord); external 'drl_host' name 'draw_command';
procedure HostTextInput(aEnabled: DWord); external 'drl_host' name 'text_input';
procedure HostTitle(aData: Pointer; aLength: DWord); external 'drl_host' name 'title';
function HostRumble(aLow, aHigh, aDuration: DWord): LongInt; external 'drl_host' name 'rumble';
{$ELSE}
var GProbeEvent: TBrowserEventBytes;
    GProbePending: Boolean = False;
    GProbeFrame: TBrowserBytes;
procedure ProbeSetEvent(const aData: TBrowserEventBytes);
begin GProbeEvent := aData; GProbePending := True; end;
function ProbeFrame: TBrowserBytes;
begin Result := Copy(GProbeFrame); end;
function HostPollEvent(aData: Pointer; aCapacity, aPeek: DWord): LongInt;
begin
  if aCapacity <> BrowserEventBytes then Exit(-1);
  if not GProbePending then Exit(0);
  Move(GProbeEvent[0], aData^, BrowserEventBytes);
  if aPeek = 0 then GProbePending := False;
  Exit(1);
end;
function HostEventPending: LongInt;
begin Result := Ord(GProbePending); end;
procedure HostSleep(aMilliseconds: DWord);
begin SysUtils.Sleep(aMilliseconds); end;
function HostNow: DWord;
begin Result := DWord(GetTickCount64); end;
procedure HostFrame(aData: Pointer; aLength: DWord);
begin SetLength(GProbeFrame, aLength); if aLength > 0 then Move(aData^, GProbeFrame[0], aLength); end;
procedure HostDrawCommand(aHeader: Pointer; aHeaderLength: DWord; aText: Pointer; aTextLength: DWord); begin end;
procedure HostTextInput(aEnabled: DWord); begin end;
procedure HostTitle(aData: Pointer; aLength: DWord); begin end;
function HostRumble(aLow, aHigh, aDuration: DWord): LongInt; begin Result := 0; end;
{$ENDIF}
procedure PutU32(var aData: array of Byte; aOffset: SizeInt; aValue: DWord);
begin
  if (aOffset < 0) or (aOffset+4 > Length(aData)) then raise ERangeError.Create('Host ABI write outside buffer');
  aData[aOffset] := Byte(aValue); aData[aOffset+1] := Byte(aValue shr 8);
  aData[aOffset+2] := Byte(aValue shr 16); aData[aOffset+3] := Byte(aValue shr 24);
end;
function GetU32(const aData: array of Byte; aOffset: SizeInt): DWord;
begin
  if (aOffset < 0) or (aOffset+4 > Length(aData)) then raise ERangeError.Create('Host ABI read outside buffer');
  Result := DWord(aData[aOffset]) or (DWord(aData[aOffset+1]) shl 8)
    or (DWord(aData[aOffset+2]) shl 16) or (DWord(aData[aOffset+3]) shl 24);
end;
end.
