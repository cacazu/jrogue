{$mode objfpc}{$H+}
program writer_fixture;
{ SOURCE ONLY: standalone authored codec fixture; not executed here. }
uses SysUtils, drlstatewriter;
procedure Require(aCondition: Boolean; const aMessage: String);
begin if not aCondition then raise Exception.Create(aMessage); end;
var writer: TStateProbeWriter;
    first, second, failed: TStateProbeResult;
    i, payload: Integer;
    tag: RawByteString;
begin
  writer := TStateProbeWriter.Create(1024, 7);
  try
    writer.U32('fixture.number', $12345678);
    writer.I32('fixture.negative', -2147483648);
    writer.OriginalBytes('fixture.domain_id', 'cyberdemon');
    first := writer.Finish;
    Require(not first.Failed and not first.Complete, 'partial flag');
    Require((first.Bytes[0] = 68) and (first.Bytes[1] = 82)
      and (first.Bytes[2] = 83) and (first.Bytes[3] = 80), 'literal DRSP magic');
    Require((first.Bytes[4] = 1) and (first.Bytes[5] = 0) and (first.Bytes[12] = 0), 'schema/complete bytes');
    Require((first.Bytes[6] = 1) and (first.Bytes[7] = 0), 'literal encoding bytes');
    Require((first.Bytes[8] = 7) and (first.Bytes[9] = 0)
      and (first.Bytes[10] = 0) and (first.Bytes[11] = 0), 'literal scope bytes');
    Require((first.Bytes[13] = 0) and (first.Bytes[14] = 0)
      and (first.Bytes[15] = 0), 'literal reserved bytes');
    tag := 'fixture.number'; payload := 16 + 2 + Length(tag) + 1 + 4;
    Require((first.Bytes[payload] = $78) and (first.Bytes[payload + 1] = $56)
      and (first.Bytes[payload + 2] = $34) and (first.Bytes[payload + 3] = $12), 'literal LE32 bytes');
    payload := payload + 4 + 2 + Length('fixture.negative') + 1 + 4;
    Require((first.Bytes[payload] = 0) and (first.Bytes[payload + 1] = 0)
      and (first.Bytes[payload + 2] = 0) and (first.Bytes[payload + 3] = $80), 'literal signed minimum bytes');
    second := writer.Finish;
    for i := 0 to High(first.Bytes) do Require(first.Bytes[i] = second.Bytes[i], 'repeat finish');
    first.Bytes[0] := 0;
    Require(second.Bytes[0] = 68, 'detached output ownership');
    writer.U8('fixture.after_seal', 1);
    failed := writer.Finish;
    Require(failed.Failed and (Length(failed.Bytes) = 0), 'sealed writes fail closed');
  finally writer.Free; end;
  writer := TStateProbeWriter.Create(16, 0);
  try
    writer.U64('fixture.overflow', 1);
    failed := writer.Finish;
    Require(failed.Failed and (Length(failed.Bytes) = 0), 'bounded overflow');
  finally writer.Free; end;
  WriteLn('source fixture passed: framing, exact bytes, detached output, sealed/overflow failure');
end.
