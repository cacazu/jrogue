{ Include in drlmultimove implementation under DRL_STATE_PROBE.
  Required interface uses: drlstatewriter.
  TMultiMove public declaration:
    procedure EmitReadOnlyMovement(aCapture: TStateProbeWriter);
  vpath must first provide the authored EmitReadOnlyRunTail method. }

procedure TMultiMove.EmitReadOnlyMovement(aCapture: TStateProbeWriter);
begin
  aCapture.Bool('movement.active', FActive);
  aCapture.U16('movement.count', FCount);
  aCapture.U8('movement.direction', FDir.code);
  aCapture.Bool('movement.path_present', FPath <> nil);
  if FPath <> nil then FPath.EmitReadOnlyRunTail(aCapture);
end;
