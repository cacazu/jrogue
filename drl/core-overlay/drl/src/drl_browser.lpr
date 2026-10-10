{$INCLUDE drl.inc}
program drl_browser;
{ Browser entry point. The original TDRL.Run/menu/modal/game rules remain Pascal/Lua.
  Rust owns input normalization, draw-command projection and virtual platform IO.
  Native Steam/audio are deliberately unavailable in the browser deployment. }
uses {$IFDEF DRL_WASM}drl_c_allocator,fpwidestring,{$ENDIF} SysUtils, vutil, vdebug, vlog, drlbase, dfdata, drlio, drlconfig,
     drlconfiguration, drlbrowsersemantic, drlbrowserprobe;
{$IFDEF DRL_WASM}
function DrlWasiStackLow:Pointer;cdecl;external name 'drl_wasi_stack_low';
{$ENDIF}
begin
  { Browser text and virtual paths use UTF-8, including Pascal concatenations. }
  SetMultiByteConversionCodePage(CP_UTF8);
  SetMultiByteFileSystemCodePage(CP_UTF8);
  SetMultiByteRTLFileSystemCodePage(CP_UTF8);
  {$IFDEF DRL_WASM}System.StackBottom := DrlWasiStackLow;{$ENDIF}
  InstallBrowserTextResolver;
  DataPath := '/data/';
  WritePath := '/user/';
  ScorePath := '/user/';
  ConfigurationPath := '/data/config-browser.lua';
  SettingsPath := '/user/settings.lua';
  ForceConsole := True;
  ForceGraphics := False;
  ForceNoAudio := True;
  try
    try
      Configuration := TDRLConfiguration.Create;
      if FileExists(SettingsPath) then Configuration.Read(SettingsPath)
        else Configuration.Write(SettingsPath);
      Config := TDRLConfig.Create(ConfigurationPath,False);
      CoreModuleID := Configuration.GetString('default_module');
      Logger.AddSink(TTextFileLogSink.Create(LOGDEBUG,WritePath+'runtime.log',False));
      ErrorLogFileName := WritePath+'error.log';
      drlbase.DRL := TDRL.Create;
      repeat
        if ForceRestart <> '' then begin drlbase.DRL.Modules.ScanModules; CoreModuleID := ForceRestart; end;
        ForceRestart := '';
        CoreModuleID := drlbase.DRL.Modules.Validate(CoreModuleID);
        if CoreModuleID = '' then drlbase.DRL.RunModuleChoice;
        if not DirectoryExists(WritePath+'user') then CreateDir(WritePath+'user');
        if not DirectoryExists(ScorePath+'backup') then CreateDir(ScorePath+'backup');
        ModuleUserPath := WritePath+'user'+PathDelim+CoreModuleID+PathDelim;
        if not DirectoryExists(ModuleUserPath) then CreateDir(ModuleUserPath);
        if not DirectoryExists(ModuleUserPath+'screenshot') then CreateDir(ModuleUserPath+'screenshot');
        if not DirectoryExists(ModuleUserPath+'mortem') then CreateDir(ModuleUserPath+'mortem');
        if not DirectoryExists(ModuleUserPath+'backup') then CreateDir(ModuleUserPath+'backup');
        drlbase.DRL.Initialize;
        drlbase.DRL.Run;
        drlbase.DRL.UnLoad;
        drlbase.DRL.Reset;
      until ForceRestart = '';
    finally
      FreeAndNil(Configuration);
      FreeAndNil(drlbase.DRL);
    end;
  except on e: Exception do begin Logger.Flush; EmitCrashInfo(e.Message,False); raise; end; end;
end.
