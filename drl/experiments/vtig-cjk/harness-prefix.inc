{$mode objfpc}{$H+}{$modeswitch advancedrecords}{$coperaTORS on}{$codepage utf8}
program vtig_text_contract_probe;
uses SysUtils, Math;
type TIOColor = DWord;
     TIOPoint = record X,Y: Integer; end;
     TIORect = record X,Y,X2,Y2: Integer; Pos,Pos2,Dim: TIOPoint; end;
     TTIGDrawCommand = record CType: Integer; Clip,Area: TIORect; FG,BG,XC,TextEncoding: DWord; Text: TIOPoint; end;
const VTIG_CMD_TEXT = 0;
      Black=0;Blue=1;Green=2;Cyan=3;Red=4;Magenta=5;Brown=6;LightGray=7;
      DarkGray=8;LightBlue=9;LightGreen=10;LightCyan=11;LightRed=12;LightMagenta=13;Yellow=14;White=15;
      VTIG_BOLD_COLOR=0;
type TTIGDrawList = class
       FText: AnsiString;
       function PushText(aPart:PAnsiChar; aLength:Integer):TIOPoint;
       procedure Push(const aCmd:TTIGDrawCommand);
     end;
     TTIGWindow = class DrawList: TTIGDrawList; end;
     TTIGStyle = record Color: array[0..15] of TIOColor; end;
     PTIGStyle = ^TTIGStyle;
     TTIGSubCallback = function(const aID:AnsiString):AnsiString;
     TTIGContext = record Current:TTIGWindow; BGColor:TIOColor; Style:PTIGStyle;
       MaxCharacters:Integer; SubCallback:TTIGSubCallback; end;
var GCtx:TTIGContext;
    GRawMode:Boolean=False;
    VTIG_HighColor:Boolean=False;
    ProbeStyle:TTIGStyle;
procedure HostDraw(aHeader:Pointer;aHeaderLength:DWord;aText:Pointer;aTextLength:DWord);
  external 'drl_host' name 'draw_command';
function Point(x,y:Integer):TIOPoint;
begin Result.X:=x;Result.Y:=y;end;
function Rectangle(aPosition,aSize:TIOPoint):TIORect;
begin
  Result.Pos:=aPosition;Result.Dim:=aSize;Result.X:=aPosition.X;Result.Y:=aPosition.Y;
  Result.X2:=Result.X+aSize.X-1;Result.Y2:=Result.Y+aSize.Y-1;
  Result.Pos2:=Point(Result.X2,Result.Y2);
end;
function VTIG_BoldenColor(aColor:TIOColor):TIOColor;
begin
  case aColor of 0:Exit(0);1..7:Exit(aColor+8);8:Exit(7);end;Exit(15);
end;
function TTIGDrawList.PushText(aPart:PAnsiChar;aLength:Integer):TIOPoint;
var s:AnsiString;
begin
  Result.X:=Length(FText);SetString(s,aPart,aLength);FText+=s;Result.Y:=Length(FText);
end;
procedure TTIGDrawList.Push(const aCmd:TTIGDrawCommand);
var words:array[0..15] of DWord;s:AnsiString;
begin
  FillChar(words,SizeOf(words),0);words[0]:=1;words[1]:=0;
  words[2]:=aCmd.Area.X-1;words[3]:=aCmd.Area.Y-1;
  words[4]:=aCmd.Area.Dim.X;words[5]:=aCmd.Area.Dim.Y;
  words[6]:=aCmd.Clip.X-1;words[7]:=aCmd.Clip.Y-1;
  words[8]:=aCmd.Clip.Dim.X;words[9]:=aCmd.Clip.Dim.Y;
  words[10]:=aCmd.FG;words[11]:=aCmd.BG;words[13]:=aCmd.TextEncoding;
  s:=Copy(FText,aCmd.Text.X+1,aCmd.Text.Y-aCmd.Text.X);
  HostDraw(@words[0],SizeOf(words),PAnsiChar(s),Length(s));
end;
