{ Include in dfplayer implementation under DRL_STATE_PROBE.
  Required interface uses: drlstatewriter.
  TPlayer public declaration:
    procedure EmitReadOnlyControl(aCapture: TStateProbeWriter);
  No MultiMove property, CalculateInput, GetMultiMoveInput or gameplay action. }

procedure TPlayer.EmitReadOnlyControl(aCapture: TStateProbeWriter);
begin
  EmitReadOnlyLastCommand(aCapture);
  aCapture.Bool('movement.present', FMultiMove <> nil);
  if FMultiMove <> nil then FMultiMove.EmitReadOnlyMovement(aCapture);
  aCapture.Missing('player.remaining_state', 'inventory-traits-statistics-entities-lua-and-world-ledger-pending');
end;
