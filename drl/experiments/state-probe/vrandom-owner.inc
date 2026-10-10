{ Include in vrandom implementation, under DRL_STATE_PROBE.
  Required interface uses: drlstatewriter.
  TRNG public declaration:
    procedure EmitReadOnlyMT(aCapture: TStateProbeWriter; const aTag: RawByteString);
  Unit interface declaration:
    procedure EmitReadOnlyRandomGlobals(aCapture: TStateProbeWriter);
  Reads only; does not call WriteToStream, RDWord, Twist, Randomize or a clock. }

procedure TRNG.EmitReadOnlyMT(aCapture: TStateProbeWriter; const aTag: RawByteString);
begin
  if FIndex > 624 then
  begin aCapture.Fail('probe.error.rng_index', aTag + '.index'); Exit; end;
  aCapture.U32(aTag + '.index', FIndex);
  aCapture.U32Array(aTag + '.words', FState);
end;

procedure EmitReadOnlyRandomGlobals(aCapture: TStateProbeWriter);
begin
  aCapture.U64('rng.randomize_counter', GRandomizeCounter);
  aCapture.Missing('rng.unseeded_entropy', 'clock-tick-object-address-inputs-not-sampled');
  aCapture.Missing('rng.rtl_and_libc', 'opaque-independent-random-state-not-captured');
end;
