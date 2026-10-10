{$mode objfpc}{$H+}
unit drlstatewriter;

{ Authored diagnostic codec. This is never a native save writer. }
interface
uses SysUtils;

const
  StateProbeSchema = 1;
  StateProbeHeaderBytes = 16;
  StateProbeMaximumBytes = 16 * 1024 * 1024;
  StateProbeU8 = 1;
  StateProbeU16 = 2;
  StateProbeU32 = 3;
  StateProbeU64 = 4;
  StateProbeI32 = 5;
  StateProbeBoolean = 6;
  StateProbeOriginalBytes = 7;
  StateProbeByteArray = 8;
  StateProbeU32Array = 9;

type
  TStateProbeBytes = array of Byte;
  TStateProbeResult = record
    Schema: Word;
    Complete: Boolean; { Always False until the full native/Lua ledger closes. }
    Failed: Boolean;
    ErrorID, ErrorPath: RawByteString;
    Bytes: TStateProbeBytes; { Empty on any failure; never compare failed bytes. }
  end;

  TStateProbeWriter = class
  private
    FBytes: TStateProbeBytes;
    FUsed: SizeInt;
    FFailed, FSealed: Boolean;
    FErrorID, FErrorPath: RawByteString;
    function Reserve(aLength: QWord; const aPath: RawByteString): Boolean;
    procedure RawU8(aValue: Byte);
    procedure RawU16(aValue: Word);
    procedure RawU32(aValue: DWord);
    procedure RawU64(aValue: QWord);
    function Field(const aTag: RawByteString; aKind: Byte; aLength: QWord): Boolean;
  public
    constructor Create(aCapacity: SizeInt; aScopeFlags: DWord);
    procedure Fail(const aErrorID, aPath: RawByteString);
    procedure U8(const aTag: RawByteString; aValue: Byte);
    procedure U16(const aTag: RawByteString; aValue: Word);
    procedure U32(const aTag: RawByteString; aValue: DWord);
    procedure U64(const aTag: RawByteString; aValue: QWord);
    procedure I32(const aTag: RawByteString; aValue: LongInt);
    procedure Bool(const aTag: RawByteString; aValue: Boolean);
    procedure OriginalBytes(const aTag, aValue: RawByteString);
    procedure ByteArray(const aTag: RawByteString; const aValue: array of Byte);
    procedure U32Array(const aTag: RawByteString; const aValue: array of DWord);
    procedure Missing(const aTag, aReason: RawByteString);
    function Finish: TStateProbeResult;
  end;

implementation

constructor TStateProbeWriter.Create(aCapacity: SizeInt; aScopeFlags: DWord);
begin
  inherited Create;
  if (aCapacity < StateProbeHeaderBytes) or (aCapacity > StateProbeMaximumBytes) then
  begin
    Fail('probe.error.capacity', 'meta.capacity');
    Exit;
  end;
  SetLength(FBytes, aCapacity);
  RawU32($50535244); { Exact bytes D R S P. }
  RawU16(StateProbeSchema);
  RawU16(1); { Tagged fixed-width little-endian encoding. }
  RawU32(aScopeFlags);
  RawU8(0); { Complete=False, independently of section successes. }
  RawU8(0); RawU8(0); RawU8(0);
end;

procedure TStateProbeWriter.Fail(const aErrorID, aPath: RawByteString);
begin
  if FFailed then Exit;
  FFailed := True;
  FErrorID := aErrorID;
  FErrorPath := aPath;
end;

function TStateProbeWriter.Reserve(aLength: QWord; const aPath: RawByteString): Boolean;
begin
  Result := False;
  if FFailed then Exit;
  if FSealed then
  begin
    Fail('probe.error.sealed', aPath);
    Exit;
  end;
  if aLength > QWord(Length(FBytes) - FUsed) then
  begin
    Fail('probe.error.capacity', aPath);
    Exit;
  end;
  Result := True;
end;

procedure TStateProbeWriter.RawU8(aValue: Byte);
begin FBytes[FUsed] := aValue; Inc(FUsed); end;
procedure TStateProbeWriter.RawU16(aValue: Word);
begin RawU8(Byte(aValue and $FF)); RawU8(Byte(aValue shr 8)); end;
procedure TStateProbeWriter.RawU32(aValue: DWord);
begin
  RawU8(Byte(aValue and $FF)); RawU8(Byte((aValue shr 8) and $FF));
  RawU8(Byte((aValue shr 16) and $FF)); RawU8(Byte(aValue shr 24));
end;
procedure TStateProbeWriter.RawU64(aValue: QWord);
begin RawU32(DWord(aValue and $FFFFFFFF)); RawU32(DWord(aValue shr 32)); end;

function TStateProbeWriter.Field(const aTag: RawByteString; aKind: Byte; aLength: QWord): Boolean;
var i: SizeInt;
begin
  Result := False;
  if (Length(aTag) = 0) or (Length(aTag) > 255) then
  begin Fail('probe.error.tag', aTag); Exit; end;
  for i := 1 to Length(aTag) do
    if not (aTag[i] in ['a'..'z', '0'..'9', '.', '_', '-']) then
    begin Fail('probe.error.tag', aTag); Exit; end;
  if aLength > High(DWord) then
  begin Fail('probe.error.capacity', aTag); Exit; end;
  if not Reserve(QWord(7 + Length(aTag)) + aLength, aTag) then Exit;
  RawU16(Length(aTag));
  for i := 1 to Length(aTag) do RawU8(Ord(aTag[i]));
  RawU8(aKind);
  RawU32(DWord(aLength));
  Result := True;
end;

procedure TStateProbeWriter.U8(const aTag: RawByteString; aValue: Byte);
begin if Field(aTag, StateProbeU8, 1) then RawU8(aValue); end;
procedure TStateProbeWriter.U16(const aTag: RawByteString; aValue: Word);
begin if Field(aTag, StateProbeU16, 2) then RawU16(aValue); end;
procedure TStateProbeWriter.U32(const aTag: RawByteString; aValue: DWord);
begin if Field(aTag, StateProbeU32, 4) then RawU32(aValue); end;
procedure TStateProbeWriter.U64(const aTag: RawByteString; aValue: QWord);
begin if Field(aTag, StateProbeU64, 8) then RawU64(aValue); end;
procedure TStateProbeWriter.I32(const aTag: RawByteString; aValue: LongInt);
var bits: DWord;
begin
  { Numeric two's-complement encoding, without range-sensitive signed casts. }
  if aValue < 0 then bits := DWord(Int64(aValue) + Int64(4294967296))
    else bits := DWord(aValue);
  if Field(aTag, StateProbeI32, 4) then RawU32(bits);
end;
procedure TStateProbeWriter.Bool(const aTag: RawByteString; aValue: Boolean);
begin if Field(aTag, StateProbeBoolean, 1) then RawU8(Ord(aValue)); end;
procedure TStateProbeWriter.OriginalBytes(const aTag, aValue: RawByteString);
var i: SizeInt;
begin
  if not Field(aTag, StateProbeOriginalBytes, Length(aValue)) then Exit;
  for i := 1 to Length(aValue) do RawU8(Ord(aValue[i]));
end;
procedure TStateProbeWriter.ByteArray(const aTag: RawByteString; const aValue: array of Byte);
var i: SizeInt;
begin
  if not Field(aTag, StateProbeByteArray, QWord(4) + QWord(Length(aValue))) then Exit;
  RawU32(Length(aValue));
  for i := 0 to High(aValue) do RawU8(aValue[i]);
end;
procedure TStateProbeWriter.U32Array(const aTag: RawByteString; const aValue: array of DWord);
var i: SizeInt;
begin
  if not Field(aTag, StateProbeU32Array, QWord(4) + QWord(Length(aValue)) * 4) then Exit;
  RawU32(Length(aValue));
  for i := 0 to High(aValue) do RawU32(aValue[i]);
end;
procedure TStateProbeWriter.Missing(const aTag, aReason: RawByteString);
begin
  Bool(aTag + '.covered', False);
  OriginalBytes(aTag + '.reason', aReason);
end;

function TStateProbeWriter.Finish: TStateProbeResult;
begin
  Result.Schema := StateProbeSchema;
  Result.Complete := False;
  Result.Failed := FFailed;
  Result.ErrorID := FErrorID;
  Result.ErrorPath := FErrorPath;
  Result.Bytes := nil;
  if not FFailed then Result.Bytes := Copy(FBytes, 0, FUsed);
  FSealed := True;
end;
end.
