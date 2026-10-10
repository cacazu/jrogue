function VTIG_PLength(const aText:PAnsiChar;aParameters:array of const):Integer;
begin Result:=VTIG_UTF8Total(VTIG_UTF8Plain(aText,aParameters));end;
function Substitute(const aID:AnsiString):AnsiString;
begin if aID='name' then Result:='日本語' else Result:='';end;
procedure Check(aValue,aExpected:Integer;const aName:String);
begin
  if aValue<>aExpected then begin
    WriteLn('FAIL ',aName,' actual=',aValue,' expected=',aExpected);Halt(1);
  end;
  WriteLn('PASS ',aName);
end;
procedure CheckText(const aValue,aExpected:AnsiString;const aName:String);
begin
  if aValue<>aExpected then begin WriteLn('FAIL ',aName);Halt(1);end;
  WriteLn('PASS ',aName);
end;
procedure Draw(const s:AnsiString;x,y,w,h:Integer;aParams:array of const);
var stack:TTIGStyleStack;clip:TIORect;
begin
  stack.Init(7);clip:=Rectangle(Point(x,y),Point(w,h));
  VTIG_RenderTextSegment(PAnsiChar(s),x,y,clip,stack,aParams);
end;
begin
  FillChar(GPadBuffer,SizeOf(GPadBuffer),' ');
  GCtx.Current:=TTIGWindow.Create;GCtx.Current.DrawList:=TTIGDrawList.Create;
  GCtx.MaxCharacters:=-1;GCtx.Style:=@ProbeStyle;ProbeStyle.Color[0]:=15;
  GCtx.SubCallback:=@Substitute;
  Check(VTIG_PLength(PAnsiChar('日本語'),[]),6,'Japanese display columns');
  Check(VTIG_PLength(PAnsiChar('A{R日本}B'),[]),6,'native color tags');
  Check(VTIG_PLength(PAnsiChar('x{0}y'),['日本語']),8,'indexed UTF8 parameter');
  Check(VTIG_PLength(PAnsiChar('{0}'),[123]),3,'integer parameter');
  Check(VTIG_PLength(PAnsiChar('{0|3}'),['日本語']),3,'cut and pad odd width');
  Check(VTIG_PLength(PAnsiChar('{0|-3}'),['日本語']),2,'cut only preserves cluster');
  Check(VTIG_PLength(PAnsiChar('{0|+3}'),['日本語']),6,'pad only retains text');
  Check(VTIG_PLength(PAnsiChar('{$name|8}'),[]),8,'callback and padding');
  Check(VTIG_PLength(PAnsiChar('e'+#$CC#$81),[]),1,'combining cluster');
  Check(VTIG_PLength(PAnsiChar(#$F0#$9F#$91#$A9#$E2#$80#$8D#$F0#$9F#$94#$AC),[]),2,'emoji ZWJ cluster');
  Check(VTIG_PLength(PAnsiChar('{0|-2}'),['A'+#10+'日本']),2,'multiline local cut budget');
  Check(VTIG_PLength(PAnsiChar(#$CC#$81),[]),1,'leading combining mark dotted base');
  CheckText(VTIG_UTF8CutTagged('A{R日本}B',3),'A{R日}','markup prefix closes cut styles');
  CheckText(VTIG_UTF8Expand(PAnsiChar('{$name|3}'),[]),'日 ','expanded callback width');
  CheckText(VTIG_UTF8CutTagged(VTIG_UTF8Expand(PAnsiChar('x{0|3}y'),['日本語']),4),'x日 ','indexed prefix');
  CheckText(VTIG_UTF8CutTagged('e'+#$CC#$81+'Z',1),'e'+#$CC#$81,'prefix combining cluster');
  CheckText(VTIG_UTF8CutTagged('日本',0),'','zero column prefix');
  CheckText(VTIG_UTF8CutTagged('AB{R日本}Z',7),'AB{R日本}Z','uncut controls preserved');
  Draw('日本語ABC',1,1,5,3,[]);
  Draw('AB{R日本語}Z',1,5,6,3,[]);
  Draw('X{0|3}Y',1,9,8,2,['日本語']);
  Draw('X{0|-3}Y',1,12,8,2,['日本語']);
  Draw('one two three',1,15,7,3,[]);
  Draw('A'+#13#10+'日本',1,19,4,3,[]);
  Draw('X{0|-3}Y',1,21,8,1,['A{R日本}B']);
  Draw('日本語',1,23,1,1,[]);
  Draw('{0|-2}',31,2,8,3,['A'+#10+'日本']);
  Draw(VTIG_UTF8CutTagged('A{R日本}B',3),31,6,8,1,[]);
  GCtx.Current.DrawList.Free;GCtx.Current.Free;
  WriteLn('PASS CJK rendering completed');
end.
