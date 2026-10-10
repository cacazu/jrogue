{ Include in vrltools implementation under DRL_STATE_PROBE.
  Required interface uses: drlstatewriter.
  TAutoTarget public declaration:
    procedure EmitReadOnlyTargets(aCapture: TStateProbeWriter);
  Read existing owner ring only. No First/Current/Next/Prev/Reset calls.
  Precondition: valid live native owner entries, suspended between mutations. }

procedure TAutoTarget.EmitReadOnlyTargets(aCapture: TStateProbeWriter);
const MaximumTargets = 4096;
var entries: array[0..MaximumTargets-1] of PAutoTargetEntry;
    scan: PAutoTargetEntry;
    count, i, j, previousIndex, nextIndex, currentIndex: Integer;
    prefix: RawByteString;
begin
  count := 0;
  scan := FirstEntry;
  if scan <> nil then
  repeat
    if count = MaximumTargets then
    begin aCapture.Fail('probe.error.target_limit', 'targeting.list'); Exit; end;
    for j := 0 to count - 1 do
      if entries[j] = scan then
      begin aCapture.Fail('probe.error.target_cycle', 'targeting.list'); Exit; end;
    entries[count] := scan;
    Inc(count);
    scan := scan^.Next;
    if scan = nil then
    begin aCapture.Fail('probe.error.target_links', 'targeting.list'); Exit; end;
  until scan = FirstEntry;
  currentIndex := -1;
  for i := 0 to count - 1 do
    if entries[i] = CurrentEntry then currentIndex := i;
  if (CurrentEntry <> nil) and (currentIndex < 0) then
  begin aCapture.Fail('probe.error.target_reference', 'targeting.list.current'); Exit; end;
  aCapture.I32('targeting.list.source.x', Source.X);
  aCapture.I32('targeting.list.source.y', Source.Y);
  aCapture.U32('targeting.list.count', count);
  aCapture.I32('targeting.list.current', currentIndex);
  for i := 0 to count - 1 do
  begin
    previousIndex := -1; nextIndex := -1;
    for j := 0 to count - 1 do
    begin
      if entries[j] = entries[i]^.Prev then previousIndex := j;
      if entries[j] = entries[i]^.Next then nextIndex := j;
    end;
    if (previousIndex < 0) or (nextIndex < 0) then
    begin aCapture.Fail('probe.error.target_reference', 'targeting.list.links'); Exit; end;
    prefix := 'targeting.list.entry.' + IntToStr(i);
    aCapture.I32(prefix + '.x', entries[i]^.Target.X);
    aCapture.I32(prefix + '.y', entries[i]^.Target.Y);
    aCapture.I32(prefix + '.distance', entries[i]^.Distance);
    aCapture.U32(prefix + '.previous', previousIndex);
    aCapture.U32(prefix + '.next', nextIndex);
  end;
end;
