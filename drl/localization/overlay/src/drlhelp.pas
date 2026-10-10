{ Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained. }
{$INCLUDE drl.inc}
{
 ----------------------------------------------------
Copyright (c) 2002-2025 by Kornel Kisielewicz
----------------------------------------------------
}
unit drlhelp;
interface
uses classes, vnode, dfdata, viotypes, vgenerics;

type THelpEntry = class(TVObject)
  constructor Create;
  destructor Destroy; override;
private
  FID    : Ansistring;
  FDesc  : Ansistring;
  FText  : TIOStringArray;
  FSemanticTopic : Integer;
public
  property ID   : Ansistring     read FID;
  property Desc : Ansistring     read FDesc;
  function PresentationBlockCount: Integer;
  function PresentationBlockText(aIndex: Integer): AnsiString;
  function PresentationTitle(const aOriginalTitle: AnsiString): AnsiString;
  property Text : TIOStringArray read FText;
end;

type THelpArray = specialize TGObjectArray< THelpEntry >;
     TGHashMap  = specialize TGHashMap< THelpEntry >;

type THelp = class(TVObject)
  constructor Create;
  procedure StreamLoader( aStream : TStream; aName : Ansistring; aSize : DWord );
  function Get( const aID : Ansistring ) : THelpEntry;
  destructor Destroy; override;
private
  FData : THelpArray;
  FMap  : TGHashMap;
public
  property Data[ const aID : Ansistring ] : THelpEntry read Get; default;
end;

var Help : THelp;

implementation

uses SysUtils, vutil, vtig, drlsemantichelp;

constructor THelpEntry.Create;
begin
  FText := nil;
  FSemanticTopic := -1;
end;

destructor THelpEntry.Destroy;
begin
  FreeAndNil( FText );
end;

function THelpEntry.PresentationBlockCount: Integer;
begin
  if FSemanticTopic >= 0 then Exit(DRLHelpParagraphCount(FSemanticTopic));
  if FText = nil then Exit(0);
  Exit(FText.Size);
end;

function THelpEntry.PresentationBlockText(aIndex: Integer): AnsiString;
begin
  if FSemanticTopic >= 0 then Exit(DRLHelpParagraphText(FSemanticTopic, aIndex));
  Exit(FText[aIndex]);
end;

function THelpEntry.PresentationTitle(const aOriginalTitle: AnsiString): AnsiString;
begin
  Exit(DRLHelpTopicTitle(FSemanticTopic, aOriginalTitle));
end;

constructor THelp.Create;
begin
  FData := THelpArray.Create( True );
  FMap  := TGHashMap.Create;
end;

{$HINTS OFF}
procedure THelp.StreamLoader( aStream : TStream; aName : Ansistring; aSize : DWord);
var iEntry : THelpEntry;
    iTopic, iLine : Integer;
    iMatches : Boolean;
begin
  Log( 'Registering help file '+aName+'...' );
  iEntry := THelpEntry.Create;
  iEntry.FText  := TIOStringArray.Create;
  while aStream.Position < aSize do
    iEntry.FText.Push( ReadLineFromStream( aStream, aSize ) );
  iEntry.FDesc  := VTIG_StripTags( iEntry.FText[0] );
  iEntry.FID    := ChangeFileExt( aName, '' );
  { Keep exact original help bytes; store provenance, project only at display. }
  iTopic := DRLHelpTopicIndex(iEntry.FID);
  iMatches := (iTopic >= 0) and
    (iEntry.FText.Size = DRLHelpSourceLineCount(iTopic));
  if iMatches then
    for iLine := 0 to iEntry.FText.Size - 1 do
      if iEntry.FText[iLine] <> DRLHelpSourceLine(iTopic, iLine) then
        iMatches := False;
  if iMatches then iEntry.FSemanticTopic := iTopic;
  FData.Push( iEntry );
  FMap[ iEntry.FID ] := iEntry;
end;
{$HINTS ON}

function THelp.Get( const aID : Ansistring ) : THelpEntry;
begin
  Exit( FMap.Get( aID, nil ) );
end;

destructor THelp.Destroy;
begin
  FreeAndNil( FData );
  FreeAndNil( FMap );
end;

end.
