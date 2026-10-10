{$mode objfpc}{$H+}
program rng_fixture;
{ SOURCE ONLY: requires the vrandom owner seam; parent owns compile/execution.
  Tests actual original TRNG, not a replacement implementation. }
uses SysUtils, vrandom, drlstatewriter;

procedure Require(aCondition: Boolean; const aMessage: String);
begin if not aCondition then raise Exception.Create(aMessage); end;
procedure RequireCapture(const aCapture: TStateProbeResult);
begin
  Require(not aCapture.Failed and not aCapture.Complete
    and (Length(aCapture.Bytes) > 16), 'fixture requires a successful nonempty partial capture');
end;

function U16At(const aBytes: TStateProbeBytes; aOffset: SizeInt): Word;
begin
  Require((aOffset >= 0) and (aOffset + 2 <= Length(aBytes)), 'fixture decode bounds');
  Result := Word(aBytes[aOffset]) or (Word(aBytes[aOffset + 1]) shl 8);
end;
function U32At(const aBytes: TStateProbeBytes; aOffset: SizeInt): DWord;
begin
  Require((aOffset >= 0) and (aOffset + 4 <= Length(aBytes)), 'fixture decode bounds');
  Result := DWord(aBytes[aOffset]) or (DWord(aBytes[aOffset + 1]) shl 8)
    or (DWord(aBytes[aOffset + 2]) shl 16) or (DWord(aBytes[aOffset + 3]) shl 24);
end;
function FieldOffset(const aBytes: TStateProbeBytes; const aTag: RawByteString;
  aKind: Byte; aPayloadBytes: DWord): SizeInt;
var offset, tagSize, i: SizeInt;
    tag: RawByteString;
    payloadBytes: DWord;
begin
  Require((Length(aBytes) >= 16) and (U32At(aBytes, 0) = $50535244), 'fixture magic');
  Require((U16At(aBytes, 4) = 1) and (aBytes[12] = 0), 'fixture schema and partial marker');
  Result := -1;
  offset := 16;
  while offset < Length(aBytes) do
  begin
    tagSize := U16At(aBytes, offset); Inc(offset, 2);
    Require(offset + tagSize + 5 <= Length(aBytes), 'fixture field header');
    SetLength(tag, tagSize);
    for i := 1 to tagSize do tag[i] := AnsiChar(aBytes[offset + i - 1]);
    Inc(offset, tagSize);
    payloadBytes := U32At(aBytes, offset + 1);
    Require(QWord(offset) + 5 + payloadBytes <= QWord(Length(aBytes)), 'fixture payload bounds');
    if tag = aTag then
    begin
      Require(Result = -1, 'fixture duplicate tag');
      Require((aBytes[offset] = aKind) and (payloadBytes = aPayloadBytes), 'fixture kind/length');
      Result := offset + 5;
    end;
    Inc(offset, 5 + SizeInt(payloadBytes));
  end;
  Require((offset = Length(aBytes)) and (Result >= 0), 'fixture complete field traversal');
end;
function EqualBytes(const a, b: TStateProbeBytes): Boolean;
var i: SizeInt;
begin
  Result := False;
  if Length(a) <> Length(b) then Exit;
  for i := 0 to High(a) do if a[i] <> b[i] then Exit;
  Result := True;
end;
function Capture(aRNG: TRNG; aCapacity: SizeInt = 8192): TStateProbeResult;
var writer: TStateProbeWriter;
begin
  writer := TStateProbeWriter.Create(aCapacity, 1);
  try
    aRNG.EmitReadOnlyMT(writer, 'rng.game.mt19937');
    Result := writer.Finish;
  finally writer.Free; end;
end;

var rng, reference: TRNG;
    first, second, changed, overflow: TStateProbeResult;
    indexOffset, wordsOffset, i: Integer;
    expected: DWord;
begin
  rng := TRNG.Create(5489);
  reference := TRNG.Create(5489);
  try
    first := Capture(rng);
    second := Capture(rng);
    RequireCapture(first); RequireCapture(second);
    Require(EqualBytes(first.Bytes, second.Bytes), 'capture twice is stable');
    indexOffset := FieldOffset(first.Bytes, 'rng.game.mt19937.index', StateProbeU32, 4);
    wordsOffset := FieldOffset(first.Bytes, 'rng.game.mt19937.words', StateProbeU32Array, 2500);
    Require(U32At(first.Bytes, indexOffset) = 624, 'initial MT index is retained');
    Require(U32At(first.Bytes, wordsOffset) = 624, 'all MT words are retained');
    { Independent source-derived seeded-state oracle uses wide multiplication
      and explicit wrap, rather than production's narrow overflow arithmetic. }
    expected := 5489;
    for i := 0 to 623 do
    begin
      if i > 0 then expected := DWord((QWord(1812433253) *
        QWord(expected xor (expected shr 30)) + QWord(i)) and $FFFFFFFF);
      Require(U32At(first.Bytes, wordsOffset + 4 + i * 4) = expected, 'complete seeded word payload');
    end;
    { Cross two twists; repeated capture must not consume the original stream. }
    for i := 0 to 1299 do
    begin
      if i mod 31 = 0 then
      begin
        first := Capture(rng); second := Capture(rng);
        RequireCapture(first); RequireCapture(second);
        Require(EqualBytes(first.Bytes, second.Bytes), 'advanced state capture stable');
      end;
      Require(rng.RDWord = reference.RDWord, 'capture preserves future original RNG');
    end;
    first := Capture(rng);
    RequireCapture(first);
    Require(rng.RDWord = reference.RDWord, 'intentional draw preserves original reference alignment');
    changed := Capture(rng);
    RequireCapture(changed);
    Require(not EqualBytes(first.Bytes, changed.Bytes), 'a consumed RNG word changes witness');
    overflow := Capture(rng, 16);
    Require(overflow.Failed and (Length(overflow.Bytes) = 0), 'overflow cannot compare equal');
    Require(rng.RDWord = reference.RDWord, 'failed capture preserves future original RNG');
    WriteLn('source fixture passed: seeded words, two twists, purity, change detection, overflow');
  finally rng.Free; reference.Free; end;
end.
