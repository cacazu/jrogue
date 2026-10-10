{$mode objfpc}{$H+}{$codepage utf8}
program vtig_cjk_probe;
uses SysUtils, viotypes, vutil, vtig, vtigio, vbrowserconsole, vbrowserio;
var Renderer: TBrowserConsoleRenderer;
    Driver: TBrowserIODriver;
function Substitute(const aID: AnsiString): AnsiString;
begin
  if aID = 'name' then Result := '日本語' else Result := '';
end;
procedure Check(aValue, aExpected: Integer; const aName: String);
begin
  if aValue <> aExpected then begin
    WriteLn('FAIL ', aName, ' actual=', aValue, ' expected=', aExpected); Halt(1);
  end;
  WriteLn('PASS ', aName);
end;
procedure CheckText(const aValue,aExpected:AnsiString;const aName:String);
begin
  if aValue<>aExpected then begin WriteLn('FAIL ',aName);Halt(1);end;
  WriteLn('PASS ',aName);
end;
begin
  Renderer := TBrowserConsoleRenderer.Create;
  Driver := TBrowserIODriver.Create;
  VTIG_Initialize(Renderer, Driver, False);
  VTIG_SetSubCallback(@Substitute);
  Check(VTIG_Length('日本語'), 6, 'Japanese display columns');
  Check(VTIG_Length('A{R日本}B'), 6, 'native color tags');
  Check(VTIG_Length('x{0}y', ['日本語']), 8, 'indexed UTF8 parameter');
  Check(VTIG_Length('{0}', [123]), 3, 'integer parameter');
  Check(VTIG_Length('{0|3}', ['日本語']), 3, 'cut and pad odd width');
  Check(VTIG_Length('{0|-3}', ['日本語']), 2, 'cut only preserves cluster');
  Check(VTIG_Length('{0|+3}', ['日本語']), 6, 'pad only retains text');
  Check(VTIG_Length('{$name|8}'), 8, 'callback and padding');
  Check(VTIG_Length('e' + #$CC#$81), 1, 'combining cluster');
  Check(VTIG_Length(#$F0#$9F#$91#$A9#$E2#$80#$8D#$F0#$9F#$94#$AC), 2, 'emoji ZWJ cluster');
  Check(VTIG_Length('{0|-2}', ['A'+#10+'日本']), 2, 'multiline local cut budget');
  Check(VTIG_Length(#$CC#$81), 1, 'leading combining mark dotted base');
  CheckText(VTIG_PrefixColumns('A{R日本}B',3),'A{R日}','markup prefix closes cut styles');
  CheckText(VTIG_PrefixColumns('{$name|3}',3),'日 ','expanded callback width');
  CheckText(VTIG_PrefixColumns('x{0|3}y',4,['日本語']),'x日 ','indexed prefix');
  CheckText(VTIG_PrefixColumns('e'+#$CC#$81+'Z',1),'e'+#$CC#$81,'prefix combining cluster');
  CheckText(VTIG_PrefixColumns('日本',0),'','zero column prefix');
  CheckText(VTIG_PrefixColumns('AB{R日本}Z',7),'AB{R日本}Z','uncut controls preserved');
  VTIG_NewFrame;
  { Every row is a separately identifiable narrow clip for host assertions. }
  VTIG_FreeLabel('日本語ABC', Rectangle(Point(0,0), Point(5,3)));
  VTIG_FreeLabel('AB{R日本語}Z', Rectangle(Point(0,4), Point(6,3)));
  VTIG_FreeLabel('X{0|3}Y', Rectangle(Point(0,8), Point(8,2)), ['日本語']);
  VTIG_FreeLabel('X{0|-3}Y', Rectangle(Point(0,11), Point(8,2)), ['日本語']);
  VTIG_FreeLabel('one two three', Rectangle(Point(0,14), Point(7,3)));
  VTIG_FreeLabel('A' + #13#10 + '日本', Rectangle(Point(0,18), Point(4,3)));
  VTIG_FreeLabel('X{0|-3}Y', Rectangle(Point(0,20), Point(8,1)), ['A{R日本}B']);
  VTIG_FreeLabel('日本語', Rectangle(Point(0,22), Point(1,1)));
  VTIG_FreeLabel('{0|-2}', Rectangle(Point(30,1), Point(8,3)), ['A'+#10+'日本']);
  VTIG_FreeLabel(VTIG_PrefixColumns('A{R日本}B',3),Rectangle(Point(30,5),Point(8,1)));
  VTIG_EndFrame;
  VTIG_Render;
  VTIG_Shutdown;
  Driver.Free; Renderer.Free;
  WriteLn('PASS CJK rendering completed');
end.
