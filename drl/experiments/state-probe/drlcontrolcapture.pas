{$mode objfpc}{$H+}
unit drlcontrolcapture;
{ Requires the explicitly documented owner seams. Not integrated or compiled. }
interface
uses drlstatewriter;
function CaptureNativeControl(aFrozen: Boolean;
  const aBuildID, aLedgerID: RawByteString; aCapacity: SizeInt): TStateProbeResult;
implementation
uses SysUtils, drlbase, dfdata, vrandom;

function CaptureNativeControl(aFrozen: Boolean;
  const aBuildID, aLedgerID: RawByteString; aCapacity: SizeInt): TStateProbeResult;
var capture: TStateProbeWriter;
begin
  capture := nil;
  try
    try
    capture := TStateProbeWriter.Create(aCapacity, $00000007);
    if not aFrozen then
    begin
      capture.Fail('probe.error.not_frozen', 'meta.safe_point');
      Result := capture.Finish; Exit;
    end;
    if (aBuildID = '') or (aLedgerID = '') then
    begin
      capture.Fail('probe.error.identity', 'meta.build_and_ledger');
      Result := capture.Finish; Exit;
    end;
    if (aCapacity < StateProbeHeaderBytes) or (aCapacity > StateProbeMaximumBytes) then
    begin Result := capture.Finish; Exit; end;
    if drlbase.DRL = nil then
    begin
      capture.Fail('probe.error.core_absent', 'run.present');
      Result := capture.Finish; Exit;
    end;
    capture.OriginalBytes('meta.scope', 'native-rng-run-and-command-v1');
    capture.OriginalBytes('meta.build_id', aBuildID);
    capture.OriginalBytes('meta.ledger_id', aLedgerID);
    capture.OriginalBytes('meta.drl_source_commit', 'a6f965072b3a25b768c91dbced00367f1b57d865');
    capture.OriginalBytes('meta.valkyrie_source_commit', 'f89735a741a968997656c2d48a003ec569db7f22');
    capture.Bool('run.present', drlbase.DRL <> nil);
    if drlbase.DRL <> nil then drlbase.DRL.EmitReadOnlyRun(capture);
    EmitReadOnlyRunGlobals(capture);
    EmitReadOnlyRandomGlobals(capture);
    capture.Missing('input.platform_fifo', 'capture-separately-inside-browser-queue-owner');
    capture.Missing('world', 'native-entity-map-scheduler-and-uid-ledger-pending');
    capture.Missing('lua', 'raw-alias-cycle-function-upvalue-graph-pending');
    capture.Missing('io', 'driver-key-pad-layer-and-visual-rng-fields-pending');
    Result := capture.Finish;
    except
      on e: EOutOfMemory do
      begin
        Result.Schema := StateProbeSchema; Result.Complete := False;
        Result.Failed := True; Result.ErrorID := 'probe.error.allocation';
        Result.ErrorPath := 'meta.native_capture'; Result.Bytes := nil;
      end;
      on e: Exception do
      begin
        Result.Schema := StateProbeSchema; Result.Complete := False;
        Result.Failed := True; Result.ErrorID := 'probe.error.exception';
        Result.ErrorPath := 'meta.native_capture'; Result.Bytes := nil;
      end;
    end;
  finally capture.Free; end;
end;
end.
