import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { generateOverlay } from '../localization/generate.mjs';
import { rewriteLuaVarargs, adaptLuaLibrary } from '../experiments/lua-wasi/adapt-varargs.mjs';

// Reproducible platform overlay. Never write to native/ or pristine upstream/.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'core-adapted');
const overlay = path.join(root, 'core-overlay');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const manifest = { schema: 1, source: 'native', changes: [], files: [], original_gameplay_rewritten: false };
const excludedSdkBindings = new Set(['vfmodconst.inc','vfmodtypes.inc','vfmodlibrary.pas',
  'vsteamconst.inc','vsteamtypes.inc','vsteamlibrary.pas']);
manifest.excluded_sdk_bindings = [...excludedSdkBindings].sort();
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  }).sort();
}
fs.mkdirSync(out, { recursive: true });
for (const file of walk(path.join(root, 'native'))) {
  const relative = path.relative(path.join(root, 'native'), file);
  const dest = path.join(out, relative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
}
// Restore permitted source-only library bindings omitted by the native selection.
// The browser graph excludes the six SDK-derived FMOD/Steam bindings entirely;
// a published source rebuild must not need private-only acquisition files.
for (const name of excludedSdkBindings) {
  const stale = path.join(out, 'fpcvalkyrie', 'libs', name);
  if (!fs.existsSync(stale)) continue;
  const relative = path.relative(out, fs.realpathSync(stale)).replaceAll('\\', '/');
  if (relative !== 'fpcvalkyrie/libs/' + name || fs.lstatSync(stale).isSymbolicLink())
    throw Error('Refuse to remove an unconstrained generated SDK binding');
  fs.unlinkSync(stale);
}
for (const file of walk(path.join(root, 'upstream', 'fpcvalkyrie', 'libs'))) {
  if (!/\.(pas|inc)$/i.test(file) || excludedSdkBindings.has(path.basename(file).toLowerCase())) continue;
  const relative = path.join('fpcvalkyrie', 'libs', path.relative(path.join(root, 'upstream', 'fpcvalkyrie', 'libs'), file));
  const dest = path.join(out, relative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
  manifest.changes.push({ path: relative.replaceAll('\\', '/'), original_sha256: sha(fs.readFileSync(file)),
    adapted_sha256: sha(fs.readFileSync(file)), kind: 'unchanged upstream binding source' });
}
for (const name of ['dkey.inc', 'version.txt', 'version_api.txt']) {
  const file = path.join(root, 'upstream', 'drl', 'bin', name);
  const dest = path.join(out, 'drl', 'bin', name);
  fs.copyFileSync(file, dest);
  manifest.changes.push({ path: `drl/bin/${name}`, original_sha256: sha(fs.readFileSync(file)),
    adapted_sha256: sha(fs.readFileSync(file)), kind: 'unchanged upstream build data' });
}
// generateOverlay emits src/<unit>, so its root must be the project directory.
// Remove only the accidental nested output from the earlier integration shape.
const oldNested = path.join(out,'drl','src','src');
if(fs.existsSync(oldNested)) {
  const resolvedOutput=fs.realpathSync(out),resolvedNested=fs.realpathSync(oldNested);
  if(!resolvedNested.toLowerCase().startsWith(resolvedOutput.toLowerCase()+path.sep)||
     path.relative(resolvedOutput,resolvedNested).replaceAll('\\','/')!=='drl/src/src')
    throw Error('Refuse to remove an unconstrained generated nested directory');
  fs.rmSync(resolvedNested,{recursive:true});
}
const oldReport=path.join(out,'drl','src','generation.json');
if(fs.existsSync(oldReport))fs.unlinkSync(oldReport);
generateOverlay({ sourceRoot: path.join(root, 'upstream', 'drl'), outputRoot: path.join(out, 'drl') });
const vtigManifest = JSON.parse(fs.readFileSync(path.join(root, 'experiments/vtig-cjk/patch-manifest.json'), 'utf8'));
if (sha(fs.readFileSync(path.join(root, 'native', vtigManifest.path))) !== vtigManifest.original_sha256 ||
    sha(fs.readFileSync(path.join(overlay, vtigManifest.path))) !== vtigManifest.adapted_sha256 ||
    sha(fs.readFileSync(path.join(root,'experiments/vtig-cjk/utf8-adapter.inc'))) !== vtigManifest.adapter_sha256)
  throw new Error('VTIG source or CJK overlay does not match its guarded manifest');
if (fs.existsSync(overlay)) for (const file of walk(overlay)) {
  const relative = path.relative(overlay, file);
  const dest = path.join(out, relative);
  const before = fs.existsSync(dest) ? sha(fs.readFileSync(dest)) : null;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
  manifest.changes.push({ path: relative.replaceAll('\\', '/'), original_sha256: before,
    adapted_sha256: sha(fs.readFileSync(dest)), kind: before ? 'platform overlay' : 'host adapter' });
}
function patch(relative, before, after, reason) {
  const file = path.join(out, relative);
  let source = fs.readFileSync(file, 'utf8');
  if (source.split(before).length !== 2) throw new Error(`Expected one exact patch anchor in ${relative}: ${reason}`);
  const original = sha(Buffer.from(source));
  source = source.replace(before, after);
  fs.writeFileSync(file, source);
  manifest.changes.push({ path: relative, original_sha256: original, adapted_sha256: sha(Buffer.from(source)),
    kind: reason, patch_before: before, patch_after: after });
}
patch('fpcvalkyrie/src/vlog.pas',
  '{$IFDEF WINDOWS}, Windows {$ELSE}, BaseUnix {$ENDIF}',
  '{$IFNDEF DRL_WASM}{$IFDEF WINDOWS}, Windows {$ELSE}, BaseUnix {$ENDIF}{$ENDIF}',
  'exclude native logging API imports');
patch('fpcvalkyrie/src/vlog.pas', '{$IFNDEF WINDOWS}uses Unix;{$ENDIF}',
  '{$IFNDEF DRL_WASM}{$IFNDEF WINDOWS}uses Unix;{$ENDIF}{$ENDIF}', 'exclude native Unix logger imports');
patch('fpcvalkyrie/src/vlog.pas', '    FpFsync( FStream.Handle );',
  '    {$IFNDEF DRL_WASM}FpFsync( FStream.Handle );{$ENDIF}', 'WASI fd sync delegated to persistence host');
patch('drl/src/drlbase.pas', '{$IFDEF WINDOWS}Windows,{$ELSE}Unix,{$ENDIF}',
  '{$IFNDEF DRL_WASM}{$IFDEF WINDOWS}Windows,{$ELSE}Unix,{$ENDIF}{$ENDIF}', 'exclude native shell API imports');
patch('drl/src/drlbase.pas', '     Classes, SysUtils,',
  '     {$IFDEF DRL_BROWSER}vbrowserhost, drlsemanticfeelings, drlsemanticitemnames, drlsemantichistory,{$ENDIF} Classes, SysUtils,', 'completed persistence witness and presentation sidecar dependencies');
patch('fpcvalkyrie/src/vconfiguration.pas', 'uses classes, sysutils, vutil;',
  'uses classes, sysutils, vutil{$IFDEF DRL_BROWSER}, vbrowserhost{$ENDIF};', 'completed settings write witness dependency');
patch('fpcvalkyrie/src/vconfiguration.pas', '  FreeAndNil( iLines );\nend;\n\nend.',
  "  FreeAndNil( iLines );\n  {$IFDEF DRL_BROWSER}if Result and (Copy(aFileName,1,6) = '/user/') then BrowserUserFilesCompleted;{$ENDIF}\nend;\n\nend.",
  'settings witness follows successful closed SaveToFile');
patch('fpcvalkyrie/src/vxmldata.pas', 'uses zstream, vutil, vdebug;',
  'uses zstream, vutil, vdebug{$IFDEF DRL_BROWSER}, vbrowserhost{$ENDIF};', 'completed score and player profile witness dependency');
patch('fpcvalkyrie/src/vxmldata.pas', '    if RenameFile( iTmpPath, FFilePath ) then Exit;',
  "    {$IFDEF DRL_BROWSER}\n    if RenameFile( iTmpPath, FFilePath ) then begin\n      if (FHandle = 0) and (Copy(FFilePath,1,6) = '/user/') then BrowserUserFilesCompleted;\n      Exit;\n    end;\n    {$ELSE}\n    if RenameFile( iTmpPath, FFilePath ) then Exit;\n    {$ENDIF}",
  'unlocked profile witness follows closed compressed file and atomic replacement');
patch('fpcvalkyrie/src/vxmldata.pas', "  DeleteFile( FFilePath + '.lock' );\nend;",
  "  DeleteFile( FFilePath + '.lock' );\n  {$IFDEF DRL_BROWSER}if Copy(FFilePath,1,6) = '/user/' then BrowserUserFilesCompleted;{$ENDIF}\nend;",
  'locked score witness follows original file close and lock removal');
patch('fpcvalkyrie/src/vxmldata.pas', '  FileCopy( FFilePath, FBackupPath+iRawName+\'.backup-\'+iStamp );\n  FindClose( iInfo );',
  "  FileCopy( FFilePath, FBackupPath+iRawName+'.backup-'+iStamp );\n  FindClose( iInfo );\n  {$IFDEF DRL_BROWSER}if Copy(FFilePath,1,6) = '/user/' then BrowserUserFilesCompleted;{$ENDIF}",
  'completed original backup maintenance witness');
patch('fpcvalkyrie/src/vxmldata.pas', '  else\n    CreateNew;\nend;\n\nprocedure TVXMLDataFile.Lock;',
  "  else\n    CreateNew;\n  {$IFDEF DRL_BROWSER}if Copy(FFilePath,1,6) = '/user/' then BrowserUserFilesCompleted;{$ENDIF}\nend;\n\nprocedure TVXMLDataFile.Lock;",
  'profile recovery maintenance completes after all load streams close');
patch('drl/src/dfdata.pas', 'uses typinfo, strutils, math, vmath, vdebug, vluasystem, drlbase;',
  'uses typinfo, strutils, math, vmath, vdebug, vluasystem, drlbase{$IFDEF DRL_BROWSER}, vbrowserhost{$ENDIF};',
  'completed original first-run marker file witness dependency');
patch('drl/src/dfdata.pas', '      iStream.WriteBuffer( iLine[1], Length( iLine ) );\n      Result := True;\n    finally\n      iStream.Free;',
  "      iStream.WriteBuffer( iLine[1], Length( iLine ) );\n      Result := True;\n    finally\n      iStream.Free;\n      {$IFDEF DRL_BROWSER}if Result and (Copy(aFileName,1,6) = '/user/') then BrowserUserFilesCompleted;{$ENDIF}",
  'first-run file witness follows completed original stream closure');
patch('drl/src/dfplayer.pas', '  FScore := -1000;\n\n  if Option_MortemArchive then',
  '  {$IFDEF DRL_BROWSER}BrowserUserFilesCompleted;{$ENDIF}\n  FScore := -1000;\n\n  if Option_MortemArchive then',
  'mortem witness follows successful SaveToFile and freed string list');
patch('drl/src/dfplayer.pas', '        iMortemList.SaveToFile( iString );\n      finally\n        FreeAndNil( iMortemList );\n      end;',
  '        iMortemList.SaveToFile( iString );\n      finally\n        FreeAndNil( iMortemList );\n      end;\n      {$IFDEF DRL_BROWSER}BrowserUserFilesCompleted;{$ENDIF}',
  'mortem archive witness follows successful closed original file');
patch('drl/src/dfplayer.pas', '     dfmap, dflevel,',
  '     {$IFDEF DRL_BROWSER}vbrowserhost,{$ENDIF} dfmap, dflevel,', 'completed mortem file witness dependency');
for (const indentation of ['    ','      ']) {
  const original='\n'+indentation+"DeleteFile( ModuleUserPath + 'save' );";
  patch('drl/src/drlbase.pas', original,
    '\n'+indentation+"{$IFDEF DRL_BROWSER}if DeleteFile( ModuleUserPath + 'save' ) then BrowserUserFilesCompleted;{$ELSE}"+original+'\n'+indentation+'{$ENDIF}',
    'consumed or corrupted original save deletion witness after stream closure');
}
patch('drl/src/drlmainmenuview.pas', '     vutil, vtig, vtigio, vgltypes, vluasystem, vluavalue,',
  '     {$IFDEF DRL_BROWSER}vbrowserhost,{$ENDIF} vutil, vtig, vtigio, vgltypes, vluasystem, vluavalue,',
  'completed original save management witness dependency');
patch('drl/src/drlmainmenuview.pas', "    DeleteFile( ModuleUserPath + 'save' );",
  "    {$IFDEF DRL_BROWSER}if DeleteFile( ModuleUserPath + 'save' ) then BrowserUserFilesCompleted;{$ELSE}\n    DeleteFile( ModuleUserPath + 'save' );\n    {$ENDIF}",
  'explicit incompatible-save deletion witness');
// Selectable labels reserve one cell on each side inside the menu padding.
// Japanese labels must keep all seven original actions within the native rows.
patch('drl/src/drlmainmenuview.pas',
  'procedure TMainMenuView.UpdateMenu;\nvar iSize  : TIOPoint;\n    iCount : Byte;\nbegin',
  'procedure TMainMenuView.UpdateMenu;\nvar iSize  : TIOPoint;\n    iCount : Byte;\n    {$IFDEF DRL_WASM}iMenuPos : TIOPoint;\n  procedure FitMenuLabel(const aID, aEnglish: AnsiString);\n  begin\n    iSize.X := Max(iSize.X, VTIG_Length(DRLText(aID, aEnglish)) + 2 * FMenuStyle.Padding[VTIG_WINDOW_PADDING].X + 2);\n  end;\n  {$ENDIF}\nbegin',
  'CJK main-menu width measures semantic labels and selectable padding');
patch('drl/src/drlmainmenuview.pas',
  '  VTIG_Begin( MAINMENU_ID, iSize, Point( 24, 14 ) );',
  `  {$IFDEF DRL_WASM}
  FitMenuLabel('menu.main.continue', TextContinueGame);
  FitMenuLabel('menu.main.new', TextNewGame);
  FitMenuLabel('menu.main.highscores', TextShowHighscore);
  FitMenuLabel('menu.main.player', TextShowPlayer);
  FitMenuLabel('menu.main.help', TextHelp);
  FitMenuLabel('menu.main.settings', TextSettings);
  if FJHCLink then FitMenuLabel('menu.main.jhc', TextJHC);
  FitMenuLabel('menu.main.exit', TextExit);
  iMenuPos := Point((FSize.X - iSize.X) div 2 + 1, 14);
  VTIG_Begin(MAINMENU_ID, iSize, iMenuPos);
  {$ELSE}
  VTIG_Begin( MAINMENU_ID, iSize, Point( 24, 14 ) );
  {$ENDIF}`,
  'CJK menu labels remain one line; preserve original native geometry');
patch('drl/src/drlio.pas', '  procedure Focus( aCoord: TCoord2D ); virtual;',
  '  function PointerMapCoord( aPoint: TIOPoint ): TCoord2D; virtual;\n  procedure Focus( aCoord: TCoord2D ); virtual;',
  'browser console pointer-to-map coordinate adapter');
patch('drl/src/drlio.pas', 'procedure TDRLIO.Focus(aCoord: TCoord2D);',
  `function TDRLIO.PointerMapCoord(aPoint: TIOPoint): TCoord2D;
begin
  {$IFDEF DRL_BROWSER}
  Result := NewCoord2D(aPoint.X-1,aPoint.Y-2);
  {$ELSE}
  Result := SpriteMap.DevicePointToCoord(aPoint);
  {$ENDIF}
end;

procedure TDRLIO.Focus(aCoord: TCoord2D);`, 'preserve original pointer actions without native sprite map');
patch('drl/src/drlio.pas', '    IO.FullUpdate;\n    IO.HandleEvents;\n  until TChoiceView.Done;',
  '    IO.FullUpdate;\n    IO.HandleEvents;\n    {$IFDEF DRL_BROWSER}if not TChoiceView.Done then IO.Driver.Sleep(10);{$ENDIF}\n  until TChoiceView.Done;',
  'preserve nested Lua choice continuation while yielding browser input');
patch('drl/src/drlbase.pas', 'IO.MTarget := SpriteMap.DevicePointToCoord( aEvent.Mouse.Pos );',
  'IO.MTarget := IO.PointerMapCoord( aEvent.Mouse.Pos );', 'browser game pointer coordinates');
patch('drl/src/drlio.pas', 'FMTarget := SpriteMap.DevicePointToCoord( aEvent.MouseMove.Pos );',
  'FMTarget := PointerMapCoord( aEvent.MouseMove.Pos );', 'browser targeting pointer coordinates');
patch('drl/src/drlio.pas', 'FMTarget := SpriteMap.DevicePointToCoord( aEvent.Mouse.Pos );',
  'FMTarget := PointerMapCoord( aEvent.Mouse.Pos );', 'browser modal pointer coordinates');
patch('fpcvalkyrie/src/vlibrary.pas',
  '  {$IFDEF UNIX} unix, dl, {$ENDIF}\n  sysutils, dynlibs;',
  '  {$IFNDEF DRL_WASM}{$IFDEF UNIX} unix, dl, {$ENDIF}{$ENDIF}\n  sysutils{$IFNDEF DRL_WASM}, dynlibs{$ENDIF};\n{$IFDEF DRL_WASM}\ntype TLibHandle = PtrUInt;\nconst NilHandle = 0;\n{$ENDIF}', 'no dynamic native libraries in WASI');
patch('fpcvalkyrie/src/vlibrary.pas', '  iName := aName;\n  {$IFDEF UNIX}',
  '  iName := aName;\n  {$IFDEF DRL_WASM}\n  iHandle := NilHandle;\n  {$ELSE}\n  {$IFDEF UNIX}', 'dynamic native loading disabled on WASI');
patch('fpcvalkyrie/src/vlibrary.pas', '    iHandle := LoadLibrary( iName );\n  {$ENDIF}',
  '    iHandle := LoadLibrary( iName );\n  {$ENDIF}\n  {$ENDIF}', 'dynamic native loading disabled guard');
patch('fpcvalkyrie/src/vlibrary.pas', '  Get := GetProcedureAddress( FHandle, PChar( aSymbol ) );',
  '  {$IFDEF DRL_WASM}Get := nil;{$ELSE}Get := GetProcedureAddress( FHandle, PChar( aSymbol ) );{$ENDIF}', 'no native symbol resolver');
patch('fpcvalkyrie/src/vlibrary.pas', '  UnloadLibrary( FHandle );',
  '  {$IFNDEF DRL_WASM}UnloadLibrary( FHandle );{$ENDIF}', 'no native library unload');
patch('fpcvalkyrie/src/vlibrary.pas', "{$IFDEF UNIX} + ': ' + dlerror {$endif}",
  "{$IFNDEF DRL_WASM}{$IFDEF UNIX} + ': ' + dlerror {$endif}{$ENDIF}", 'native loader error excludes absent WASI dlerror');
patch('fpcvalkyrie/src/vstoreinterface.pas', 'uses sysutils, vsteam, vdebug;',
  'uses sysutils, {$IFNDEF DRL_BROWSER}vsteam,{$ENDIF} vdebug;', 'browser uses upstream no-store adapter');
patch('fpcvalkyrie/src/vstoreinterface.pas', '  if TSteam.TryLoadLibrary then\n    GStoreInterface := TSteam.Create\n  else',
  '  {$IFNDEF DRL_BROWSER}\n  if TSteam.TryLoadLibrary then\n    GStoreInterface := TSteam.Create\n  else\n  {$ENDIF}', 'browser selects existing no-store behavior');
patch('drl/src/drlaudio.pas', 'uses sysutils, math, vdebug, vutil, vmath, vvector, vsdlaudio, vfmodaudio,',
  'uses sysutils, math, vdebug, vutil, vmath, vvector, {$IFNDEF DRL_BROWSER}vsdlaudio, vfmodaudio,{$ENDIF}',
  'silent browser build excludes native audio SDK dependencies');
patch('fpcvalkyrie/libs/vsdl3library.pas', 'uses Classes, SysUtils, vlibrary,',
  'uses Classes, SysUtils, vlibrary{$IFDEF DRL_WASM};{$ELSE},{$ENDIF}',
  'WASI declaration-only SDL binding has no native platform uses suffix');
patch('fpcvalkyrie/libs/vsdl3library.pas', 'const\n{$IFDEF WINDOWS}\n  SDL3DefaultPath',
  '{$IFDEF DRL_WASM}type size_t = PtrUInt;{$ENDIF}\nconst\n{$IFDEF WINDOWS}\n  SDL3DefaultPath',
  'WASI SDL stream callbacks use the target pointer-sized C size_t');
patch('drl/src/drlio.pas', 'math, video, dateutils, variants,',
  'math, {$IFNDEF DRL_BROWSER}video,{$ENDIF} dateutils, variants,',
  'browser console excludes unsupported native Video unit');
patch('drl/src/drlio.pas', '  DoneVideo;',
  '  {$IFNDEF DRL_BROWSER}DoneVideo;{$ENDIF}',
  'browser crash report retains native save/output without native Video shutdown');
patch('drl/src/drlaudio.pas', "    if Option_SoundEngine = 'FMOD' then FAudio := TFMODAudio.Create\n                                    else FAudio := TSDLAudio.Create;",
  "    {$IFDEF DRL_BROWSER}\n    raise EInvalidOp.Create('Native audio backend unavailable in browser');\n    {$ELSE}\n    if Option_SoundEngine = 'FMOD' then FAudio := TFMODAudio.Create\n                                    else FAudio := TSDLAudio.Create;\n    {$ENDIF}",
  'browser silent platform selection cannot instantiate native audio');
patch('fpcvalkyrie/src/vtigio.pas', 'uses SysUtils, vutil;',
  'uses SysUtils, vutil{$IFDEF DRL_BROWSER}, vbrowserhost{$ENDIF};', 'immutable browser draw-command service');
patch('fpcvalkyrie/src/vtigio.pas', 'type TTIGDrawCommand = record\n    CType : TTIGDrawCommandType;',
  'type TTIGDrawCommand = record\n    {$IFDEF DRL_BROWSER}TextEncoding : DWord;{$ENDIF}\n    CType : TTIGDrawCommandType;',
  'explicit UTF8 text versus original byte-glyph distinction');
patch('fpcvalkyrie/src/vtigio.pas', '    iGlyph  : Char;\nbegin',
  `    iGlyph  : Char;
    {$IFDEF DRL_BROWSER}
    iHeader : array[0..63] of Byte;
    iTextPointer : Pointer;
    iTextLength : DWord;
    {$ENDIF}
begin`, 'browser draw-command wire buffer');
patch('fpcvalkyrie/src/vtigio.pas', '    for iCmd in iList.FCommands do\n      case iCmd.CType of',
  `    for iCmd in iList.FCommands do
    begin
      {$IFDEF DRL_BROWSER}
      FillChar(iHeader,SizeOf(iHeader),0);
      PutU32(iHeader,0,1); PutU32(iHeader,4,Ord(iCmd.CType));
      PutU32(iHeader,8,DWord(iCmd.Area.X-1)); PutU32(iHeader,12,DWord(iCmd.Area.Y-1));
      PutU32(iHeader,16,iCmd.Area.W); PutU32(iHeader,20,iCmd.Area.H);
      if iCmd.CType = VTIG_CMD_TEXT then begin
        PutU32(iHeader,24,DWord(iCmd.Clip.X-1)); PutU32(iHeader,28,DWord(iCmd.Clip.Y-1));
        PutU32(iHeader,32,iCmd.Clip.W); PutU32(iHeader,36,iCmd.Clip.H);
        PutU32(iHeader,52,iCmd.TextEncoding);
      end else begin
        PutU32(iHeader,24,0); PutU32(iHeader,28,0); PutU32(iHeader,32,80); PutU32(iHeader,36,25);
        PutU32(iHeader,52,1);
      end;
      if iCmd.CType = VTIG_CMD_CLEAR then PutU32(iHeader,40,ColorNone) else PutU32(iHeader,40,iCmd.FG);
      PutU32(iHeader,44,iCmd.BG);
      if iCmd.CType = VTIG_CMD_BAR then PutU32(iHeader,48,iCmd.XC) else PutU32(iHeader,48,ColorNone);
      iTextPointer := nil; iTextLength := 0;
      if iCmd.CType <> VTIG_CMD_CLEAR then begin
        iTextLength := iCmd.Text.Y-iCmd.Text.X;
        if (iCmd.CType = VTIG_CMD_BAR) and (iTextLength >= 3) then iTextLength := 3;
        if iTextLength > 0 then iTextPointer := @(iList.FText.Data^[iCmd.Text.X]);
      end;
      HostDrawCommand(@iHeader[0],SizeOf(iHeader),iTextPointer,iTextLength);
      {$ENDIF}
      case iCmd.CType of`, 'export ordered draw commands with UTF8 text');
patch('fpcvalkyrie/src/vtigio.pas', '        VTIG_CMD_TEXT:\n        begin\n          iCoord :=',
  '        VTIG_CMD_TEXT:\n        begin\n          {$IFNDEF DRL_BROWSER}\n          iCoord :=', 'Rust owns UTF8 glyph layout');
patch('fpcvalkyrie/src/vtigio.pas', '            Inc(iCoord.X);\n          end;\n        end;',
  '            Inc(iCoord.X);\n          end;\n          {$ENDIF}\n        end;', 'Rust UTF8 glyph-layout branch');
patch('fpcvalkyrie/src/vtigio.pas', '      end;\n\n  if (FMousePosition.X',
  '      end;\n    end;\n\n  if (FMousePosition.X', 'ordered draw-command loop end');
patch('fpcvalkyrie/src/vtigio.pas', "  if (FMousePosition.X <> -1) and (FMousePosition.Y <> -1) then\n    FRenderer.OutputChar( FMousePosition.X, FMousePosition.Y, White, Chr(30) );",
  `  {$IFDEF DRL_BROWSER}
  if (FMousePosition.X <> -1) and (FMousePosition.Y <> -1) then
  begin
    FRenderer.OutputChar( FMousePosition.X, FMousePosition.Y, White, Chr(30) );
    FillChar(iHeader,SizeOf(iHeader),0);
    PutU32(iHeader,0,1); PutU32(iHeader,4,Ord(VTIG_CMD_TEXT));
    PutU32(iHeader,8,DWord(FMousePosition.X-1)); PutU32(iHeader,12,DWord(FMousePosition.Y-1));
    PutU32(iHeader,16,1); PutU32(iHeader,20,1);
    PutU32(iHeader,24,0); PutU32(iHeader,28,0); PutU32(iHeader,32,80); PutU32(iHeader,36,25);
    PutU32(iHeader,40,White); PutU32(iHeader,44,ColorNone); PutU32(iHeader,48,ColorNone); PutU32(iHeader,52,1);
    iGlyph := Chr(30);
    HostDrawCommand(@iHeader[0],SizeOf(iHeader),@iGlyph,1);
  end;
  {$ELSE}
  if (FMousePosition.X <> -1) and (FMousePosition.Y <> -1) then
    FRenderer.OutputChar( FMousePosition.X, FMousePosition.Y, White, Chr(30) );
  {$ENDIF}`, 'final original mouse marker remains above ordered UI draw commands');
patch('drl/src/drltextio.pas', '     {$IFDEF WINDOWS}\n     vtextio, vtextconsole,',
  '     {$IFDEF DRL_BROWSER}\n     vbrowserio, vbrowserconsole,\n     {$ELSE}\n     {$IFDEF WINDOWS}\n     vtextio, vtextconsole,', 'browser driver dependencies');
patch('drl/src/drltextio.pas', 'uses vrltools, vtextmap, vioevent, drlio, dfdata;',
  'uses vrltools, vtextmap, vioevent, drlio, dfdata{$IFDEF DRL_BROWSER}, vvector, vtigio{$ENDIF};',
  'browser gamepad vector type');
patch('drl/src/drltextio.pas', '    function OnEvent( const aEvent : TIOEvent ) : Boolean; override;',
  `    function OnEvent( const aEvent : TIOEvent ) : Boolean; override;
    {$IFDEF DRL_BROWSER}
    function GetPadLDir : TCoord2D; override;
    function IsGamepad : Boolean; override;
    {$ENDIF}`, 'browser gamepad adapter interface');
patch('drl/src/drltextio.pas', '    FTargetRange    : Byte;',
  `    FTargetRange    : Byte;
    {$IFDEF DRL_BROWSER}
    FBrowserPadLeft : TVec2f;
    FBrowserPadDirection : TCoord2D;
    FBrowserPadDetected : Boolean;
    {$ENDIF}`, 'browser gamepad adapter state');
patch('drl/src/drltextio.pas', '     drlbase, drlanimation,',
  '     drlbase, drlanimation, {$IFDEF DRL_BROWSER}drlcontrollerbindings,{$ENDIF}', 'reuse original gamepad direction helper');
patch('drl/src/drltextio.pas', '  FTargetRange  := 0;',
  `  FTargetRange  := 0;
  {$IFDEF DRL_BROWSER}
  FBrowserPadLeft.Init(); FBrowserPadDirection.Create(0,0); FBrowserPadDetected := False;
  {$ENDIF}`, 'browser gamepad reset');
patch('drl/src/drltextio.pas', 'var iWide : WideString;\nbegin\n  if ( aEvent.EType',
  `var iWide : WideString;
    {$IFDEF DRL_BROWSER}iValue : Integer; iPhysicalLeftTrigger : Boolean;{$ENDIF}
begin
  {$IFDEF DRL_BROWSER}
  // Exact original graphical input normalization, reused without SDL/rendering.
  if aEvent.EType = VEVENT_PADAXIS then begin
    iValue := aEvent.PadAxis.Value;
    if iValue > 32000 then iValue := 32000;
    if iValue < -32000 then iValue := -32000;
    if (iValue < 5000) and (iValue > -5000) then iValue := 0;
    case aEvent.PadAxis.Axis of
      VPAD_AXIS_LEFT_X: FBrowserPadLeft.X := iValue / 32000;
      VPAD_AXIS_LEFT_Y: FBrowserPadLeft.Y := iValue / 32000;
    end;
    if aEvent.PadAxis.Axis in [VPAD_AXIS_LEFT_X,VPAD_AXIS_LEFT_Y] then
      FBrowserPadDirection := AxisToDirection(FBrowserPadLeft);
  end;
  if aEvent.EType = VEVENT_PADDEVICE then begin
    FBrowserPadLeft.Init(); FBrowserPadDirection.Create(0,0);
  end;
  if aEvent.EType = VEVENT_PADDOWN then FBrowserPadDetected := True;
  if aEvent.EType = VEVENT_KEYDOWN then FBrowserPadDetected := False;
  if aEvent.EType in [VEVENT_PADDOWN,VEVENT_PADUP] then begin
    iPhysicalLeftTrigger := PadState.Active(VPAD_BUTTON_LEFTTRIGGER);
    case aEvent.Pad.Button of
      VPAD_BUTTON_DPAD_UP: begin VTIG_GetIOState.EventState.SetState(VTIG_IE_1,iPhysicalLeftTrigger and aEvent.Pad.Pressed); if iPhysicalLeftTrigger and aEvent.Pad.Pressed then Exit(isModal) end;
      VPAD_BUTTON_DPAD_DOWN: begin VTIG_GetIOState.EventState.SetState(VTIG_IE_4,iPhysicalLeftTrigger and aEvent.Pad.Pressed); if iPhysicalLeftTrigger and aEvent.Pad.Pressed then Exit(isModal) end;
      VPAD_BUTTON_DPAD_LEFT: begin VTIG_GetIOState.EventState.SetState(VTIG_IE_2,iPhysicalLeftTrigger and aEvent.Pad.Pressed); if iPhysicalLeftTrigger and aEvent.Pad.Pressed then Exit(isModal) end;
      VPAD_BUTTON_DPAD_RIGHT: begin VTIG_GetIOState.EventState.SetState(VTIG_IE_3,iPhysicalLeftTrigger and aEvent.Pad.Pressed); if iPhysicalLeftTrigger and aEvent.Pad.Pressed then Exit(isModal) end;
    end;
  end;
  {$ENDIF}
  if ( aEvent.EType`, 'preserve original gamepad deadzone/direction behavior');
patch('drl/src/drltextio.pas', '  if ( aEvent.EType = VEVENT_KEYDOWN ) and ( aEvent.Key.ASCII <> #0 ) then\n  begin',
  '  {$IFNDEF DRL_BROWSER}\n  if ( aEvent.EType = VEVENT_KEYDOWN ) and ( aEvent.Key.ASCII <> #0 ) then\n  begin', 'browser typed input uses original UTF8 text events exclusively');
patch('drl/src/drltextio.pas', '    VTIG_GetIOState.EventState.AppendText( PWideChar( iWide ) );\n  end;\n  Exit( inherited OnEvent( aEvent ) );',
  '    VTIG_GetIOState.EventState.AppendText( PWideChar( iWide ) );\n  end;\n  {$ENDIF}\n  Exit( inherited OnEvent( aEvent ) );', 'avoid browser ASCII key and text-event duplication');
patch('drl/src/drltextio.pas', 'procedure TDRLTextIO.WaitForAnimation( aStrict : Boolean = True );',
  `{$IFDEF DRL_BROWSER}
function TDRLTextIO.GetPadLDir : TCoord2D;
begin Result := FBrowserPadDirection; end;
function TDRLTextIO.IsGamepad : Boolean;
begin Result := FBrowserPadDetected; end;
{$ENDIF}

procedure TDRLTextIO.WaitForAnimation( aStrict : Boolean = True );`, 'browser gamepad direction/hint projection');
patch('drl/src/drltextio.pas', '     {$ENDIF}\n     vioconsole, vtig,',
  '     {$ENDIF}\n     {$ENDIF}\n     vioconsole, vtig,', 'browser driver dependency guard');
patch('drl/src/drltextio.pas', '  {$IFDEF WINDOWS}\n  FIODriver := TTextIODriver.Create( 80, 25 );',
  '  {$IFDEF DRL_BROWSER}\n  FIODriver := TBrowserIODriver.Create( 80, 25 );\n  {$ELSE}\n  {$IFDEF WINDOWS}\n  FIODriver := TTextIODriver.Create( 80, 25 );', 'browser input driver selection');
patch('drl/src/drltextio.pas', '  {$ENDIF}\n  if (FIODriver.GetSizeX',
  '  {$ENDIF}\n  {$ENDIF}\n  if (FIODriver.GetSizeX', 'browser input driver selection guard');
// Initialize and module-choice both select the same console host implementation.
for (let index = 0; index < 2; index++) {
  const file = path.join(out, 'drl', 'src', 'drltextio.pas');
  let s = fs.readFileSync(file, 'utf8');
  const needle = '  {$IFDEF WINDOWS}\n  iRenderer := TTextConsoleRenderer.Create( 80, 25, [VIO_CON_BGCOLOR, VIO_CON_CURSOR] );';
  const replacement = '  {$IFDEF DRL_BROWSER}\n  iRenderer := TBrowserConsoleRenderer.Create( 80, 25, [VIO_CON_BGCOLOR, VIO_CON_CURSOR] );\n  {$ELSE}\n' + needle;
  const position = s.indexOf(needle, index ? s.indexOf('procedure TDRLTextIO.RunModuleChoice') : s.indexOf('procedure TDRLTextIO.Initialize'));
  if (position < 0) throw new Error('Original renderer selection missing');
  s = s.slice(0, position) + s.slice(position).replace(needle, replacement).replace('  {$ENDIF}\n  inherited Initialize( iRenderer );', '  {$ENDIF}\n  {$ENDIF}\n  inherited Initialize( iRenderer );');
  fs.writeFileSync(file, s);
}
// Widths are presentation columns, never UTF8 bytes. Keep original native text
// behavior in the ELSE branches and retain original English domain Name fields.
patch('drl/src/drlio.pas', '          if Length( iDesc ) > 42 then iDesc := Copy(iDesc, 1, 42 );',
  '          {$IFDEF DRL_WASM}iDesc := VTIG_PrefixColumns(iDesc,42);{$ELSE}\n          if Length( iDesc ) > 42 then iDesc := Copy(iDesc, 1, 42 );\n          {$ENDIF}', 'whole-grapheme HUD weapon label prefix');
patch('drl/src/drlio.pas', 'Point(31+Length(iDesc),1)',
  'Point(31+{$IFDEF DRL_WASM}VTIG_Length(iDesc){$ELSE}Length(iDesc){$ENDIF},1)', 'HUD ammo position uses displayed columns');
// The canonical source-locked semantic overlay now owns these two complete
// display expressions, including their translated name and column width.
const semanticHud=fs.readFileSync(path.join(out,'drl/src/drlio.pas'),'utf8');
for(const anchor of [
  "iDesc := DRLRegistryText('level', DRL.Level.ID, 'base_game', 'name', DRL.Level.Name);",
  'VTIG_FreeLabel( iDesc, Point( -2-VTIG_Length( iDesc ), iBottom ), iColor );',
  "iDesc := DRLRegistryText('being', iBoss.ID, 'base_game', 'name', iBoss.Name);",
  'VTIG_FreeLabel( iDesc, Point( 40 - Ceil(VTIG_Length( iDesc ) / 2), 3 ), iCBold );',
])if(semanticHud.split(anchor).length!==2)throw Error('Expected one canonical semantic HUD width expression: '+anchor);
const semanticInventory=fs.readFileSync(path.join(out,'drl/src/drlplayerview.pas'),'utf8');
if(semanticInventory.split('if VTIG_Length( iEntry.Name ) > 47 then iEntry.Name := VTIG_Padded(iEntry.Name, 47);').length!==2)
  throw Error('Canonical inventory display prefix is missing or ambiguous');
// OnDescribe is allowed to run at original application preparation seams, never
// because a frame or locale is redrawn. Its result is retained, not omitted.
patch('drl/src/drlio.pas', '  procedure PreAction;',
  '  procedure PreAction;\n  {$IFDEF DRL_BROWSER}procedure PrepareHudProjection;{$ENDIF}', 'explicit HUD description preparation seam');
patch('drl/src/drlio.pas', '  FCachedAmmo  : Integer;',
  '  FCachedAmmo  : Integer;\n  {$IFDEF DRL_BROWSER}FCachedHUDTraits : AnsiString;{$ENDIF}', 'immutable prepared HUD description');
patch('drl/src/drlio.pas', '  FSeedHUDText   := \'\';',
  '  {$IFDEF DRL_BROWSER}FCachedHUDTraits := \'\';{$ENDIF}\n  FSeedHUDText   := \'\';', 'reset prepared HUD description');
patch('drl/src/drlio.pas', 'procedure TDRLIO.PreAction;',
  `{$IFDEF DRL_BROWSER}
procedure TDRLIO.PrepareHudProjection;
begin
  if Player = nil then FCachedHUDTraits := ''
    else FCachedHUDTraits := DRLViewTraitString(Player);
end;
{$ENDIF}

procedure TDRLIO.PreAction;`, 'prepare original OnDescribe output outside rendering');
patch('drl/src/drlio.pas', '    iTraitStr := DRLViewTraitString(Player);',
  '    {$IFDEF DRL_BROWSER}iTraitStr := FCachedHUDTraits;{$ELSE}\n    iTraitStr := DRLViewTraitString(Player);\n    {$ENDIF}', 'HUD redraw never invokes perk description hooks');
patch('drl/src/drlbase.pas', '     (FPlayerView as TPlayerView).Retain;\nend;',
  '     (FPlayerView as TPlayerView).Retain;\n  {$IFDEF DRL_BROWSER}\n  IO.PrepareHudProjection;\n  IO.FullUpdate; FLastFrameTime := IO.Time; IO.Driver.Sleep(0);\n  {$ENDIF}\nend;',
  'HUD preparation and browser event yield follow completed original PreAction');
patch('drl/src/drlbase.pas', "    CopyFileSimple( ModuleUserPath + 'save', ModuleUserPath + 'savedemo' );\nend;",
  "    CopyFileSimple( ModuleUserPath + 'save', ModuleUserPath + 'savedemo' );\n  {$IFDEF DRL_BROWSER}BrowserSaveCompleted;{$ENDIF}\nend;", 'witness successful closed original save without replacing serialization');
patch('drl/src/drlbase.pas', '  FreeAndNil( Stream );\n  FLevel.Clear;',
  "  FreeAndNil( Stream );\n  {$IFDEF DRL_BROWSER}\n  if not aCrash then begin\n    if not DRLSaveSemanticFeelings then\n      IO.Msg(DRLText('ui.error.feeling_sidecar_save', 'The game was saved, but its translated level message could not be saved.'));\n    if not DRLSaveSemanticItemNames then\n      IO.Msg(DRLText('ui.error.item_name_sidecar_save', 'The game was saved, but its translated item names could not be saved.'));\n    if not DRLSaveSemanticHistory then\n      IO.Msg(DRLText('ui.error.history_sidecar_save', 'The game was saved, but its translated history could not be saved.'));\n  end;\n  {$ENDIF}\n  FLevel.Clear;",
  'save versioned presentation metadata after original save closes and before level clears');
patch('drl/src/drlbase.pas', "  SaveVersionEngine := '';\n  SaveVersionModule := '';\n  SaveModString     := '';\n  iRecreate := False;",
  "  {$IFDEF DRL_BROWSER}DRLClearSemanticFeelings; DRLClearSemanticItemNames; DRLClearSemanticHistory;{$ENDIF}\n  SaveVersionEngine := '';\n  SaveVersionModule := '';\n  SaveModString     := '';\n  iRecreate := False;",
  'clear presentation records before original save validation and load');
patch('drl/src/drlbase.pas', '    LoadSaveFile := True;\n    FPadMoved    := True;',
  "    {$IFDEF DRL_BROWSER}\n    if not FCrashSave then begin\n      DRLLoadSemanticFeelings(DRL_FEELING_SIDECAR_FILE, FLevel.Feeling);\n      DRLLoadSemanticItemNames;\n      DRLLoadSemanticHistory;\n    end;\n    {$ENDIF}\n    LoadSaveFile := True;\n    FPadMoved    := True;",
  'restore typed presentation sidecar against successfully loaded original English feeling');
patch('drl/src/drlbase.pas', 'procedure TDRL.Reset;\nbegin\n  FreeAndNil( FLevel );',
  'procedure TDRL.Reset;\nbegin\n  {$IFDEF DRL_BROWSER}DRLClearSemanticFeelings; DRLClearSemanticItemNames; DRLClearSemanticHistory;{$ENDIF}\n  FreeAndNil( FLevel );',
  'clear presentation records when the original game session resets');
patch('drl/src/drlbase.pas', 'begin\n  FreeAndNil( UIDs );\n  UIDs := TUIDStore.Create;',
  'begin\n  {$IFDEF DRL_BROWSER}DRLClearSemanticFeelings; DRLClearSemanticItemNames; DRLClearSemanticHistory;{$ENDIF}\n  FreeAndNil( UIDs );\n  UIDs := TUIDStore.Create;',
  'clear presentation records before the original fresh-player UID store');
patch('drl/src/drlhudviews.pas', '  IO.Targeting := True;\nend;',
  '  IO.Targeting := True;\n  {$IFDEF DRL_BROWSER}UpdateTarget;{$ENDIF}\nend;', 'look description prepared when original view is opened');
patch('drl/src/drlhudviews.pas', '  IO.Targeting  := True;\nend;',
  '  IO.Targeting  := True;\n  {$IFDEF DRL_BROWSER}UpdateTarget;{$ENDIF}\nend;', 'target description prepared after all constructor fields');
patch('drl/src/drlplayerview.pas', '  FState := aInitialState;\nend;',
  '  FState := aInitialState;\n  {$IFDEF DRL_BROWSER}ReadInv; ReadEq;{$ENDIF}\nend;', 'prepare inventory/equipment item description arrays when view opens');
// A trait upgrade is an original UI command. Refresh the projection here rather
// than invoking the description hook during the next redraw.
patch('drl/src/drlplayerview.pas', '        else Player.Traits.Upgrade( Player.Klass, FTraits[iSelected].Index );',
  '        else Player.Traits.Upgrade( Player.Klass, FTraits[iSelected].Index );\n      {$IFDEF DRL_BROWSER}if not FTraitFirst then IO.PrepareHudProjection;{$ENDIF}', 'trait command prepares changed HUD description');
// Fixed C-WASM varargs ABI: retain the pre-adaptation native branch verbatim.
// Do not copy the separately generated upstream overlay over reviewed semantics.
for (const file of walk(out).filter(f => /\.(pas|pp|lpr)$/i.test(f) && !/[\\/]build[\\/]/.test(f))) {
  const relative = path.relative(out, file).replaceAll('\\', '/');
  const before = fs.readFileSync(file, 'utf8');
  const rewritten = rewriteLuaVarargs(before, relative);
  let adapted = rewritten.source;
  if (relative === 'fpcvalkyrie/libs/vlualibrary.pas') adapted = adaptLuaLibrary(adapted);
  if (adapted === before) continue;
  const after = '{$IFDEF DRL_WASM}\n' + adapted + '\n{$ELSE}\n' + before + '\n{$ENDIF}\n';
  fs.writeFileSync(file, after);
  manifest.changes.push({ path: relative, original_sha256: sha(Buffer.from(before)), adapted_sha256: sha(Buffer.from(after)),
    kind: 'fixed WASM C varargs call shape; native branch preserved', rewritten_calls: rewritten.rewritten_calls });
}
for (const name of ['drl_lua_varargs.pas', 'vluatypes.inc','drl_c_allocator.pas']) {
  const source = path.join(root, 'experiments/lua-wasi/pascal-overlay', name);
  const destination = path.join(out, 'fpcvalkyrie/libs', name);
  const before = fs.existsSync(destination) ? fs.readFileSync(destination) : null;
  const copied = fs.readFileSync(source);
  const content = before ? Buffer.concat([Buffer.from('{$IFDEF DRL_WASM}\n'),copied,Buffer.from('\n{$ELSE}\n'),before,Buffer.from('\n{$ENDIF}\n')]) : copied;
  fs.writeFileSync(destination,content);
  manifest.changes.push({ path: `fpcvalkyrie/libs/${name}`, original_sha256: before ? sha(before) : null, adapted_sha256: sha(content),
    kind: 'WASM Lua fixed ABI binding helper; native branch preserved' });
}
// GPL-2.0 section 2(a): the actual modified source files retain a dated notice.
// Pristine originals and byte-identical gameplay files remain byte-identical.
for(const file of walk(path.join(out,'drl')).filter(file=>/\.(pas|pp|lpr|lua|inc)$/i.test(file))){
  const relative=path.relative(out,file).replaceAll('\\','/');
  const originalFile=path.join(root,'native',relative);
  if(!fs.existsSync(originalFile))continue; // Authored new files are not modified upstream files.
  const before=fs.readFileSync(file,'utf8');
  if(sha(Buffer.from(before))===sha(fs.readFileSync(originalFile))||before.includes('Modified 2026-10-02'))continue;
  const notice=relative.endsWith('.lua')?
    '-- Modified 2026-10-02 for DRL browser platform and presentation adapters.\n-- Original upstream copyright and GPL-2.0 license are retained.\n':
    '{ Modified 2026-10-02 for DRL browser platform and presentation adapters.\n  Original upstream copyright and GPL-2.0 license are retained. }\n';
  const after=notice+before;
  fs.writeFileSync(file,after);
  manifest.changes.push({path:relative,original_sha256:sha(Buffer.from(before)),adapted_sha256:sha(Buffer.from(after)),
    kind:'dated GPL modified-file notice',prepend_notice:notice});
}
for (const file of walk(out)) {
  if (file.endsWith('adaptation-manifest.json') || /[\\/]build[\\/]/.test(file)) continue;
  manifest.files.push({ path: path.relative(out, file).replaceAll('\\', '/'), sha256: sha(fs.readFileSync(file)) });
}
fs.writeFileSync(path.join(out, 'adaptation-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ files: manifest.files.length, platform_changes: manifest.changes.length, out }));
