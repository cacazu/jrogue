{ Include in vpath implementation under DRL_STATE_PROBE.
  Required interface uses: drlstatewriter.
  TPathfinder public declaration:
    procedure EmitReadOnlyRunTail(aCapture: TStateProbeWriter);
  Witnesses exactly the direct path fields read by TMultiMove.CalculateInput:
  FStop nil-ness (Found), remaining FStart/Child order and each Coord.
  Does not call Found, Start getters, Run, Clear, or any map-query function.
  Precondition: valid live original path nodes, suspended between mutations.
  This does not close the general pathfinding working-graph ledger. }

procedure TPathfinder.EmitReadOnlyRunTail(aCapture: TStateProbeWriter);
const MaximumRunNodes = 4096;
var nodes: array[0..MaximumRunNodes-1] of TAStarNode;
    node: TAStarNode;
    count, i, j: Integer;
    prefix: RawByteString;
begin
  count := 0;
  node := FStart;
  while node <> nil do
  begin
    if count = MaximumRunNodes then
    begin aCapture.Fail('probe.error.path_limit', 'movement.path.nodes'); Exit; end;
    for j := 0 to count - 1 do
      if nodes[j] = node then
      begin aCapture.Fail('probe.error.path_cycle', 'movement.path.nodes'); Exit; end;
    nodes[count] := node;
    Inc(count);
    node := node.Child;
  end;
  aCapture.Bool('movement.path.found', FStop <> nil);
  aCapture.U32('movement.path.count', count);
  for i := 0 to count - 1 do
  begin
    prefix := 'movement.path.node.' + IntToStr(i);
    aCapture.I32(prefix + '.x', nodes[i].Coord.X);
    aCapture.I32(prefix + '.y', nodes[i].Coord.Y);
  end;
  aCapture.Missing('pathfinder.working_graph', 'open-closed-costs-map-and-general-alias-ledger-pending');
end;
