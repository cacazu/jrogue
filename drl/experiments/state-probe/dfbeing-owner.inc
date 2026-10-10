{ Include in dfbeing implementation under DRL_STATE_PROBE.
  Required interface uses: drlstatewriter.
  TBeing public declaration:
    procedure EmitReadOnlyLastCommand(aCapture: TStateProbeWriter);
  The retained command has only one audited active field. TCommand constructors
  leave other fields partly initialized, and its Item can be a stale pointer.
  Do not read Target/Item/Slot/Alt/ID merely because HandleCommand once read them.
  Those reads were of the dispatched argument, not of retained FLastCommand. }

procedure TBeing.EmitReadOnlyLastCommand(aCapture: TStateProbeWriter);
begin
  aCapture.U8('command.retained.code', FLastCommand.Command);
  aCapture.OriginalBytes('command.retained.schema', 'native-and-lua-reader-byte-only-v1');
end;
