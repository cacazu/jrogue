import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const relative = 'fpcvalkyrie/src/vtig.pas';
const source = fs.readFileSync(path.join(root, 'native', relative));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const original = '509ebaae8da6fc8e4c9afcaa1a449e60ed52ba9437452065089fd85d660e4d4c';
if (sha(source) !== original) throw Error('Pinned original vtig.pas hash changed');
let text = source.toString('utf8');
const interfaceNeedle='function VTIG_StripTags( const aText : AnsiString ) : AnsiString;';
if(text.split(interfaceNeedle).length!==2)throw Error('Ambiguous VTIG public prefix interface');
text=text.replace(interfaceNeedle,interfaceNeedle+'\nfunction VTIG_PrefixColumns(const aText: AnsiString; aColumns: Integer): AnsiString; overload;\nfunction VTIG_PrefixColumns(const aText: AnsiString; aColumns: Integer; aParameters: array of const): AnsiString; overload;\nfunction VTIG_Padded(const aText: AnsiString; aColumns: Byte; aPadChar: Char = \' \'): AnsiString;');
function bracket(start, end, replacement) {
  const from = text.indexOf(start);
  if (from < 0 || text.indexOf(start, from + 1) >= 0) throw Error(`Ambiguous VTIG patch start: ${start}`);
  const to = text.indexOf(end, from);
  if (to < 0) throw Error(`Missing VTIG patch end: ${end}`);
  const baseline = text.slice(from, to);
  text = text.slice(0, from) + '{$IFDEF DRL_WASM}\n' + replacement + '\n{$ELSE}\n' + baseline + '{$ENDIF}\n\n' + text.slice(to);
}
bracket('procedure VTIG_RenderTextSegment( const aText:', 'function VTIG_RenderText(const aText:', fs.readFileSync(path.join(here, 'utf8-adapter.inc'), 'utf8'));
bracket('function VTIG_PLength( const aText: PAnsiChar; aParameters: array of const ) : Integer;\nvar', 'function VTIG_Length( const aText: AnsiString; aParameters:',
  'function VTIG_PLength(const aText: PAnsiChar; aParameters: array of const): Integer;\nbegin\n  Result := VTIG_UTF8Total(VTIG_UTF8Plain(aText, aParameters));\nend;');
const legacyTextNeedle='iCmd.CType := VTIG_CMD_TEXT;\n      iCmd.Clip';
if(text.split(legacyTextNeedle).length!==2)throw Error('Ambiguous original VTIG label producer');
text=text.replace(legacyTextNeedle,'iCmd.CType := VTIG_CMD_TEXT;\n      {$IFDEF DRL_BROWSER}iCmd.TextEncoding := 0; iCmd.XC := 0;{$ENDIF}\n      iCmd.Clip');
const charStart=text.indexOf('procedure VTIG_RenderChar( aChar : Char;');
const charEnd=text.indexOf('procedure ClampTo(',charStart);
if(charStart<0||charEnd<0)throw Error('Missing VTIG byte glyph producer');
const charBlock=text.slice(charStart,charEnd);
const charNeedle='iCmd.CType := VTIG_CMD_TEXT;';
if(charBlock.split(charNeedle).length!==2)throw Error('Ambiguous VTIG byte glyph patch');
const charArea='  iCmd.Area  := Rectangle( aPosition, iClip.Dim - aPosition );';
if(charBlock.split(charArea).length!==2)throw Error('Ambiguous VTIG byte glyph geometry');
const adaptedChar=charBlock.replace(charNeedle,charNeedle+'\n  {$IFDEF DRL_BROWSER}iCmd.TextEncoding := 1; iCmd.XC := 0;{$ENDIF}')
  .replace(charArea,`  {$IFDEF DRL_BROWSER}
  iCmd.Area  := Rectangle( aPosition, Max(0, iClip.X2-aPosition.X+1), Max(0, iClip.Y2-aPosition.Y+1) );
  {$ELSE}
${charArea}
  {$ENDIF}`);
text=text.slice(0,charStart)+adaptedChar+text.slice(charEnd);
const initializeImplementation='procedure VTIG_Initialize( aRenderer : TIOConsoleRenderer; aDriver : TIODriver; aClearOnRender : Boolean = True );\nvar iCanvas';
if(text.split(initializeImplementation).length!==2)throw Error('Ambiguous scrollbar helper insertion');
const scrollHelper=`{$IFDEF DRL_BROWSER}
{ Display-only correction: the native byte-text path wraps this border glyph
  because it lies outside content. Keep the intended thumb cell and bound it to
  its owning window, every ancestor content rectangle, and the screen. }
procedure VTIG_RenderScrollbarChar(aChar: Char; aPosition: TIOPoint);
var iWindow: TTIGWindow;
    iClip, iBounds: TIORect;
    iLeft, iTop, iRight, iBottom, i: Integer;
    iCmd: TTIGDrawCommand;
begin
  iWindow := GCtx.Current;
  iClip := iWindow.DC.FClip;
  if GCtx.Style^.Frame[VTIG_BORDER_FRAME] <> '' then iClip := iClip.Expanded(1);
  iLeft := Max(1,iClip.X); iTop := Max(1,iClip.Y);
  iRight := Min(GCtx.Size.X,iClip.X2); iBottom := Min(GCtx.Size.Y,iClip.Y2);
  for i := 0 to GCtx.WindowStack.Size-2 do begin
    iBounds := GCtx.WindowStack[i].FClipContent;
    iLeft := Max(iLeft,iBounds.X); iTop := Max(iTop,iBounds.Y);
    iRight := Min(iRight,iBounds.X2); iBottom := Min(iBottom,iBounds.Y2);
  end;
  if (iRight < iLeft) or (iBottom < iTop) then Exit;
  iClip := Rectangle(iLeft,iTop,iRight-iLeft+1,iBottom-iTop+1);
  if not (aPosition in iClip) then Exit;
  Initialize(iCmd);
  iCmd.CType := VTIG_CMD_TEXT; iCmd.TextEncoding := 1; iCmd.XC := 0;
  iCmd.Clip := iClip; iCmd.Area := Rectangle(aPosition,1,1);
  iCmd.FG := GCtx.Color; iCmd.BG := GCtx.BGColor;
  iCmd.Text := iWindow.DrawList.PushChar(aChar);
  iWindow.DrawList.Push(iCmd);
end;
{$ENDIF}

`;
text=text.replace(initializeImplementation,scrollHelper+initializeImplementation);
const scrollChar='  VTIG_RenderChar( iFrame[4], Point(iWindow.DC.FClip.X2 + 1, iWindow.DC.FClip.Y + iYpos) );';
if(text.split(scrollChar).length!==2)throw Error('Ambiguous original scrollbar thumb');
text=text.replace(scrollChar,`  {$IFDEF DRL_BROWSER}
  VTIG_RenderScrollbarChar( iFrame[4], Point(iWindow.DC.FClip.X2 + 1, iWindow.DC.FClip.Y + iYpos) );
  {$ELSE}
${scrollChar}
  {$ENDIF}`);
const prefixImplementation=`function VTIG_PrefixColumns(const aText: AnsiString; aColumns: Integer): AnsiString;
begin Result := VTIG_PrefixColumns(aText, aColumns, []); end;

function VTIG_PrefixColumns(const aText: AnsiString; aColumns: Integer; aParameters: array of const): AnsiString;
begin
  if aColumns <= 0 then Exit('');
  {$IFDEF DRL_WASM}
  Result := VTIG_UTF8CutTagged(VTIG_UTF8Expand(PAnsiChar(aText), aParameters), aColumns);
  {$ELSE}
  Result := Copy(aText, 1, aColumns);
  {$ENDIF}
end;

function VTIG_Padded(const aText: AnsiString; aColumns: Byte; aPadChar: Char = ' '): AnsiString;
var iColumns: Integer;
begin
  {$IFDEF DRL_WASM}
  Result := VTIG_UTF8CutTagged(VTIG_UTF8Expand(PAnsiChar(aText),[]),aColumns,True);
  iColumns := VTIG_Length(Result);
  if iColumns < aColumns then Result += StringOfChar(aPadChar,aColumns-iColumns);
  {$ELSE}
  Result := vutil.Padded(aText,aColumns,aPadChar);
  {$ENDIF}
end;

`;
const stripImplementation='function VTIG_StripTags( const aText: AnsiString ): AnsiString;';
if(text.split(stripImplementation).length!==2)throw Error('Ambiguous VTIG prefix implementation position');
text=text.replace(stripImplementation,prefixImplementation+stripImplementation);
const dest = path.join(root, 'core-overlay', relative);
fs.mkdirSync(path.dirname(dest), {recursive: true});
fs.writeFileSync(dest, text);
const manifest = {schema: 1, path: relative, original_sha256: original,
  adapted_sha256: sha(Buffer.from(text)), adapter_sha256: sha(fs.readFileSync(path.join(here, 'utf8-adapter.inc'))),
  generator: 'experiments/vtig-cjk/prepare.mjs', conditional: 'DRL_WASM',
  gameplay_changed: false, changes: ['VTIG UTF-8 display width/prefix through Rust host', 'VTIG tag-aware display-column measurement and wrapping'],
  native_branch_preserved: true, byte_glyphs_explicit_cp437: true, byte_glyph_extents_use_clip_coordinates: true,
  browser_scrollbar_thumb_intended_cell_bounded_by_owner_ancestors_screen:true};
fs.writeFileSync(path.join(here, 'patch-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
