{$mode objfpc}{$H+}
program vtig_geometry_probe;
{ Authored regression fixture using the actual adapted VTIG unit. No gameplay
  engine initialization or campaign is claimed by this presentation probe. }
uses {$IFDEF DRL_WASM}drl_c_allocator,fpwidestring,{$ENDIF}
     SysUtils, viotypes, vutil, vtig, vtigio, vbrowserconsole, vbrowserio;
{$IFDEF DRL_WASM}
function DrlWasiStackLow:Pointer;cdecl;external name 'drl_wasi_stack_low';
{$ENDIF}
var Renderer: TBrowserConsoleRenderer;
    Driver: TBrowserIODriver;
    Clip: TIORect;
    Row: Integer;
    {$IFDEF DRL_WASM}TraitName, PaddedName: AnsiString;{$ENDIF}
begin
  {$IFDEF DRL_WASM}System.StackBottom := DrlWasiStackLow;{$ENDIF}
  {$IFDEF DRL_WASM}
  SetMultiByteConversionCodePage(CP_UTF8);
  TraitName := #$E5#$AE#$B9#$E8#$B5#$A6#$E3#$81#$AA#$E3#$81#$8D#$E6#$94#$BB#$E6#$92#$83;
  PaddedName := VTIG_Padded(TraitName,16);
  if (PaddedName <> TraitName+'    ') or (VTIG_Length(PaddedName) <> 16) then
    raise Exception.Create('Actual translated trait padding sliced UTF-8 or miscounted columns');
  if VTIG_Padded(TraitName,5) <> VTIG_PrefixColumns(TraitName,4)+' ' then
    raise Exception.Create('Odd-column trait padding must keep whole CJK clusters');
  if VTIG_Padded('{!'+TraitName,5) <> '{!'+VTIG_PrefixColumns(TraitName,4)+' ' then
    raise Exception.Create('Report padding closed its caller-owned color scope');
  if VTIG_Padded('{!'+TraitName+'}',5) <> '{!'+VTIG_PrefixColumns(TraitName,4)+'} ' then
    raise Exception.Create('Report padding failed to close a clipped balanced color scope');
  {$ENDIF}
  Renderer := TBrowserConsoleRenderer.Create;
  Driver := TBrowserIODriver.Create;
  VTIG_Initialize(Renderer,Driver,False);
  VTIG_NewFrame;
  VTIG_Begin('offset byte glyph',Point(12,7),Point(44,8));
  Clip := VTIG_GetClipRect;
  if (Clip.X <= Clip.W) or (Clip.Y <= Clip.H) then
    raise Exception.Create('Fixture does not exercise offset larger than dimensions');
  VTIG_FreeChar('G',Point(0,0),Yellow);
  VTIG_FreeLabel('MOUSE',Rectangle(Point(0,0),Point(5,1)),Green);
  for Row := 1 to 12 do VTIG_Text('scroll row');
  VTIG_Scrollbar; // Original function does not initialize its success result.
  VTIG_GetIOState.MousePosition := Clip.Pos;
  VTIG_End;
  VTIG_EndFrame;
  VTIG_Render;
  if Renderer.GetChar(Clip.X,Clip.Y) <> Chr(30) then
    raise Exception.Create('Native final mouse marker is not above ordinary rendering');
  VTIG_Shutdown;
  Driver.Free;
  Renderer.Free;
  WriteLn('PASS actual VTIG offset glyph, scrollbar and final mouse marker fixtures');
end.
