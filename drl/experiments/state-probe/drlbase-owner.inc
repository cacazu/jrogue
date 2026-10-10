{ Include in drlbase implementation under DRL_STATE_PROBE.
  Required interface uses: drlstatewriter.
  TDRL public declaration:
    procedure EmitReadOnlyRun(aCapture: TStateProbeWriter);
  TTargeting public declaration:
    procedure EmitReadOnlyTargeting(aCapture: TStateProbeWriter);
  vrandom, vrltools and dfplayer must first provide their authored emitters.
  Only direct fields, nil/alias comparison and diagnostic writer calls. }

procedure StateProbeFlags(aCapture: TStateProbeWriter;
  const aTag: RawByteString; const aFlags: TFlags);
var bits: array[0..31] of Byte;
    i: Integer;
begin
  FillChar(bits, SizeOf(bits), 0); { Newly owned bytes only, not game memory. }
  for i := 0 to 255 do
    if i in aFlags then bits[i div 8] := bits[i div 8] or Byte(1 shl (i mod 8));
  aCapture.ByteArray(aTag, bits);
end;

procedure TTargeting.EmitReadOnlyTargeting(aCapture: TStateProbeWriter);
begin
  { TUID is QWord in vutil. Preserve every unsigned identity bit. }
  aCapture.U64('targeting.last_uid', FLastUID);
  aCapture.I32('targeting.last.x', FLastPos.X);
  aCapture.I32('targeting.last.y', FLastPos.Y);
  aCapture.I32('targeting.previous.x', FPrevPos.X);
  aCapture.I32('targeting.previous.y', FPrevPos.Y);
  aCapture.Bool('targeting.list_present', FList <> nil);
  if FList <> nil then FList.EmitReadOnlyTargets(aCapture);
end;

procedure TDRL.EmitReadOnlyRun(aCapture: TStateProbeWriter);
begin
  aCapture.U8('run.state', Ord(FState));
  aCapture.U64('run.last_input_time', FLastInputTime);
  aCapture.Bool('run.damaged_last_turn', FDamagedLastTurn);
  aCapture.Bool('run.pad_move_active', FPadMoveActive);
  aCapture.U64('run.pad_move_next', FPadMoveNext);
  aCapture.U64('run.last_frame_time', FLastFrameTime);
  aCapture.Bool('run.pad_moved', FPadMoved);
  StateProbeFlags(aCapture, 'run.core_hooks', FCoreHooks);
  StateProbeFlags(aCapture, 'run.challenge_hooks', FChallengeHooks);
  StateProbeFlags(aCapture, 'run.secondary_challenge_hooks', FSChallengeHooks);
  StateProbeFlags(aCapture, 'run.module_hooks', FModuleHooks);
  aCapture.U8('run.difficulty', FDifficulty);
  aCapture.OriginalBytes('run.challenge_id', FChallenge);
  aCapture.OriginalBytes('run.secondary_challenge_id', FSChallenge);
  aCapture.Bool('run.archangel', FArchAngel);
  aCapture.Bool('run.data_loaded', FDataLoaded);
  aCapture.Bool('run.game_won', FGameWon);
  aCapture.Bool('run.crash_save', FCrashSave);
  aCapture.U32('run.game_seed', FGameSeed);
  aCapture.Bool('run.seeded_game', FSeededGame);
  aCapture.Bool('rng.game.present', FGameRNG <> nil);
  if FGameRNG = nil then
  begin aCapture.Fail('probe.error.rng_absent', 'rng.game'); Exit; end;
  if FGameRNG <> nil then FGameRNG.EmitReadOnlyMT(aCapture, 'rng.game.mt19937');
  aCapture.Bool('rng.lua.present', LuaRNG <> nil);
  aCapture.Bool('rng.lua.aliases_game', LuaRNG = FGameRNG);
  if (LuaRNG <> nil) and (LuaRNG <> FGameRNG) then
    aCapture.Fail('probe.error.distinct_lua_rng', 'rng.lua');
  aCapture.Bool('run.targeting_present', FTargeting <> nil);
  if FTargeting <> nil then FTargeting.EmitReadOnlyTargeting(aCapture);
  aCapture.Bool('run.player_present', Player <> nil);
  if Player <> nil then Player.EmitReadOnlyControl(aCapture);
  aCapture.Bool('run.level_present', FLevel <> nil);
  aCapture.Bool('run.player_view_present', FPlayerView <> nil);
  aCapture.Bool('run.store_present', FStore <> nil);
  aCapture.Bool('run.modules_present', FModules <> nil);
  aCapture.Bool('run.particles_present', FParticles <> nil);
  aCapture.Missing('run.referenced_objects', 'module-store-layer-particle-level-and-identity-graphs-pending');
  aCapture.Missing('run.stack_locals', 'jspi-suspended-run-and-modal-action-continuations-not-captured');
end;
