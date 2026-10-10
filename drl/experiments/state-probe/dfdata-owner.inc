{ Include in dfdata implementation under DRL_STATE_PROBE.
  Required interface uses: drlstatewriter.
  Unit interface declaration:
    procedure EmitReadOnlyRunGlobals(aCapture: TStateProbeWriter);
  Original domain/config bytes stay English/native; no translation lookup.
  Reads stored timestamps, never MSecNow or any statistics/save method. }

procedure StateProbeComp(aCapture: TStateProbeWriter;
  const aTag: RawByteString; const aValue: Comp);
var bits: QWord;
begin
  if SizeOf(aValue) <> 8 then
  begin aCapture.Fail('probe.error.scalar_abi', aTag); Exit; end;
  bits := 0;
  Move(aValue, bits, 8); { Exact scalar bits only; no object/record dump. }
  aCapture.U64(aTag + '.bits', bits);
  {$IFDEF FPC_COMP_IS_INT64}
  aCapture.OriginalBytes(aTag + '.representation', 'fpc-comp-int64');
  {$ELSE}
  aCapture.OriginalBytes(aTag + '.representation', 'fpc-comp-storage64-pinned-build');
  {$ENDIF}
end;

procedure EmitReadOnlyRunGlobals(aCapture: TStateProbeWriter);
begin
  aCapture.OriginalBytes('globals.core_module_id', CoreModuleID);
  aCapture.OriginalBytes('globals.force_restart_id', ForceRestart);
  aCapture.OriginalBytes('globals.engine_version', VersionEngine);
  aCapture.OriginalBytes('globals.engine_save_version', VersionEngineSave);
  aCapture.OriginalBytes('globals.engine_expected_version', VersionEngineExpected);
  aCapture.OriginalBytes('globals.module_version', VersionModule);
  aCapture.OriginalBytes('globals.module_save_version', VersionModuleSave);
  aCapture.OriginalBytes('globals.loaded_engine_version', SaveVersionEngine);
  aCapture.OriginalBytes('globals.loaded_module_version', SaveVersionModule);
  aCapture.OriginalBytes('globals.loaded_mod_string', SaveModString);
  aCapture.Bool('globals.memorial_written', MemorialWritten);
  aCapture.Bool('globals.debug', DEBUG);
  aCapture.Bool('globals.crash_mode', CRASHMODE);
  aCapture.Bool('globals.exception_emitted', EXCEPTEMMITED);
  aCapture.Bool('globals.demo_version', DemoVersion);
  aCapture.Bool('globals.force_shop', ForceShop);
  aCapture.Bool('globals.graphics_version', GraphicsVersion);
  aCapture.Bool('globals.sound_version', SoundVersion);
  aCapture.Bool('globals.force_no_audio', ForceNoAudio);
  aCapture.Bool('globals.force_console', ForceConsole);
  aCapture.Bool('globals.force_graphics', ForceGraphics);
  aCapture.Bool('globals.force_windowed', ForceWindowed);
  aCapture.Bool('globals.modded_game', ModdedGame);
  aCapture.U8('globals.vision_base', VisionBaseValue);
  aCapture.Bool('globals.no_player_record', NoPlayerRecord);
  aCapture.Bool('globals.no_score_record', NoScoreRecord);
  aCapture.Bool('globals.god_mode', GodMode);
  aCapture.U8('globals.status_effect', Ord(StatusEffect));
  StateProbeComp(aCapture, 'globals.game_real_time', GameRealTime);
  StateProbeComp(aCapture, 'globals.program_real_time', ProgramRealTime);
  aCapture.Bool('settings.always_random_name', Setting_AlwaysRandomName);
  aCapture.Bool('settings.no_intro', Setting_NoIntro);
  aCapture.Bool('settings.run_over_items', Setting_RunOverItems);
  aCapture.Bool('settings.hide_hints', Setting_HideHints);
  aCapture.Bool('settings.empty_confirm', Setting_EmptyConfirm);
  aCapture.Bool('settings.unlock_all', Setting_UnlockAll);
  aCapture.Bool('settings.menu_sound', Setting_MenuSound);
  aCapture.Bool('settings.wait_sound', Setting_WaitSound);
  aCapture.Bool('settings.mouse_edge_pan', Setting_MouseEdgePan);
  aCapture.Bool('settings.mouse', Setting_Mouse);
  aCapture.Bool('settings.gamepad_rumble', Setting_GamepadRumble);
  aCapture.Bool('settings.flash', Setting_Flash);
  aCapture.Bool('settings.glow', Setting_Glow);
  aCapture.Bool('settings.fade', Setting_Fade);
  aCapture.Bool('settings.screen_shake', Setting_ScreenShake);
  aCapture.Bool('settings.blood_pulse', Setting_BloodPulse);
  aCapture.Bool('settings.item_drop_animation', Setting_ItemDropAnimation);
  aCapture.Bool('settings.auto_target', Setting_AutoTarget);
  aCapture.Bool('settings.group_messages', Setting_GroupMessages);
  aCapture.U8('settings.music_volume', Setting_MusicVolume);
  aCapture.U8('settings.sound_volume', Setting_SoundVolume);
  aCapture.Bool('options.high_ascii', Option_HighASCII);
  aCapture.Bool('options.music', Option_Music);
  aCapture.Bool('options.sound', Option_Sound);
  aCapture.Bool('options.blind_mode', Option_BlindMode);
  aCapture.Bool('options.clear_messages', Option_ClearMessages);
  aCapture.Bool('options.more_prompt', Option_MorePrompt);
  aCapture.Bool('options.message_coloring', Option_MessageColoring);
  aCapture.Bool('options.inventory_full_drop', Option_InvFullDrop);
  aCapture.Bool('options.mortem_archive', Option_MortemArchive);
  aCapture.Bool('options.menu_return', Option_MenuReturn);
  aCapture.Bool('options.sound_equip_pickup', Option_SoundEquipPickup);
  aCapture.Bool('options.colored_inventory', Option_ColoredInventory);
  aCapture.Bool('options.lock_break', Option_LockBreak);
  aCapture.Bool('options.lock_close', Option_LockClose);
  aCapture.Bool('options.force_raw', Option_ForceRaw);
  aCapture.U32('options.message_buffer', Option_MessageBuffer);
  aCapture.U32('options.max_run', Option_MaxRun);
  aCapture.U32('options.max_wait', Option_MaxWait);
  aCapture.U8('options.run_delay', Option_RunDelay);
  aCapture.OriginalBytes('options.graphics_id', Option_Graphics);
  aCapture.Bool('options.blending', Option_Blending);
  aCapture.Bool('options.save_on_crash', Option_SaveOnCrash);
  aCapture.OriginalBytes('options.sound_engine_id', Option_SoundEngine);
  aCapture.OriginalBytes('options.always_name', Option_AlwaysName);
  aCapture.OriginalBytes('options.timestamp_format', Option_TimeStamp);
  aCapture.U32('options.player_backups', Option_PlayerBackups);
  aCapture.U32('options.score_backups', Option_ScoreBackups);
  aCapture.U8('options.intuition_color', Option_IntuitionColor);
  aCapture.U8('options.intuition_char', Ord(Option_IntuitionChar));
  aCapture.Bool('module.class_achievements', ModuleOption_KlassAchievements);
  aCapture.Bool('module.new_menu', ModuleOption_NewMenu);
  aCapture.Bool('module.melee_move_on_kill', ModuleOption_MeleeMoveOnKill);
  aCapture.Bool('module.full_being_description', ModuleOption_FullBeingDescription);
  aCapture.Bool('module.percent_health', ModuleOption_PercentHealth);
  aCapture.Bool('module.relic_slot', ModuleOption_RelicSlot);
  aCapture.Bool('module.new_floor_layout', ModuleOption_NewFloorLayout);
  aCapture.I32('module.resistance_cap', ModuleOption_ResistCap);
  aCapture.I32('module.default_explosion_knockback', ModuleOption_DefaultExplosionKnockback);
  aCapture.Bool('globals.sound_off', SoundOff);
  aCapture.Bool('globals.music_off', MusicOff);
  aCapture.Missing('globals.paths_and_objects', 'platform-paths-config-errors-colors-styles-and-sprite-ledger-pending');
end;
