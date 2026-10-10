{$INCLUDE drl.inc}
unit drlbrowserprobe;
interface

{ Read-only diagnostic exports. Call only while the original loop is paused in
  the browser host, never concurrently with a resumed command. This is not a
  save format and deliberately does not call destructive WriteSaveFile. }
function DRLProbeBuffer: Pointer; cdecl;
function DRLProbeCapacity: LongInt; cdecl;
function DRLProbeCapture: LongInt; cdecl;
function DRLProbeRunDelay: LongInt; cdecl;
function DRLProbeMultiMoveActive: LongInt; cdecl;

implementation
uses Classes, SysUtils, vbrowserhost, drlbase, dfdata, dfplayer, dflevel;

const ProbeHeaderBytes = 128;
      ProbeBufferBytes = 8192;
var ProbeBytes: array[0..ProbeBufferBytes-1] of Byte;

function DRLProbeBuffer: Pointer; cdecl; public name 'drl_probe_buffer';
begin Result := @ProbeBytes[0]; end;

function DRLProbeCapacity: LongInt; cdecl; public name 'drl_probe_capacity';
begin Result := ProbeBufferBytes; end;

function DRLProbeRunDelay: LongInt; cdecl; public name 'drl_probe_run_delay';
begin Result := Ord(dfdata.Option_RunDelay); end;

function DRLProbeMultiMoveActive: LongInt; cdecl; public name 'drl_probe_multimove_active';
begin
  Result := -1;
  if Player <> nil then
    if Player.MultiMove <> nil then Result := Ord(Player.MultiMove.Active);
end;

function DRLProbeCapture: LongInt; cdecl; public name 'drl_probe_capture';
var Stream: TMemoryStream;
begin
  Result := -1;
  FillChar(ProbeBytes, SizeOf(ProbeBytes), 0);
  PutU32(ProbeBytes,0,$504C5244); { DRLP }
  PutU32(ProbeBytes,4,1);
  PutU32(ProbeBytes,8,ProbeHeaderBytes);
  if drlbase.DRL = nil then Exit;
  PutU32(ProbeBytes,16,Ord(drlbase.DRL.State));
  PutU32(ProbeBytes,20,drlbase.DRL.GameSeed);
  PutU32(ProbeBytes,24,drlbase.DRL.Difficulty);
  PutU32(ProbeBytes,28,Ord(drlbase.DRL.SeededGame));
  if Player <> nil then begin
    PutU32(ProbeBytes,32,1);
    PutU32(ProbeBytes,36,DWord(Player.Position.X));
    PutU32(ProbeBytes,40,DWord(Player.Position.Y));
    PutU32(ProbeBytes,44,DWord(Player.HP));
    PutU32(ProbeBytes,48,Player.HPMax);
    PutU32(ProbeBytes,52,DWord(Player.Exp));
    PutU32(ProbeBytes,56,Player.ExpLevel);
    PutU32(ProbeBytes,60,DWord(Player.Score));
    PutU32(ProbeBytes,64,DWord(Player.Level_Index));
    PutU32(ProbeBytes,68,Player.Klass);
    PutU32(ProbeBytes,72,Player.Inv.Size);
  end;
  if drlbase.DRL.Level <> nil then begin
    PutU32(ProbeBytes,76,1);
    PutU32(ProbeBytes,80,drlbase.DRL.Level.LTime);
    PutU32(ProbeBytes,84,DWord(drlbase.DRL.Level.Boss));
    PutU32(ProbeBytes,88,Ord(drlbase.DRL.Level.Empty));
    PutU32(ProbeBytes,92,DWord(drlbase.DRL.Level.Boss shr 32));
  end;
  if drlbase.DRL.GameRNG = nil then Exit;
  Stream := TMemoryStream.Create;
  try
    { Original exact MT state serialization: reads FIndex and all 624 words.
      No sample is drawn, no hook runs, no file or original save is written. }
    drlbase.DRL.GameRNG.WriteToStream(Stream);
    if Stream.Size > ProbeBufferBytes-ProbeHeaderBytes then Exit;
    PutU32(ProbeBytes,12,DWord(Stream.Size));
    if Stream.Size > 0 then
      Move(Stream.Memory^,ProbeBytes[ProbeHeaderBytes],Stream.Size);
    Result := ProbeHeaderBytes + LongInt(Stream.Size);
  finally
    Stream.Free;
  end;
end;
end.
