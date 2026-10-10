{ Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained. }
{$INCLUDE drl.inc}
{
 ----------------------------------------------------
Copyright (c) 2002-2025 by Kornel Kisielewicz
----------------------------------------------------
}
unit drlrankupview;
interface
uses vutil, viotypes, dfdata;

type TRankUpView = class( TIOLayer )
  constructor Create( aRank : THOFRank );
  procedure Update( aDTime : Integer; aActive : Boolean ); override;
  function IsModal : Boolean; override;
protected
  FSize     : TPoint;
  FLines    : array of Ansistring;
end;

implementation

uses drlsemantictext, drlsemanticregistry, sysutils, vluasystem, vtig;

constructor TRankUpView.Create( aRank : THOFRank );
var i, i2 : Integer;
    iSize : Integer;
    iUnl  : Integer;
    iRank : Ansistring;
    iDesc : Ansistring;
begin
  VTIG_EventClear;
  FSize      := Point( 80, 25 );
  iSize := 0;
  SetLength( FLines, 200 );
  for i := 0 to High( aRank.Data ) do
    if aRank.Data[i].Value <> 0 then
    begin
      iRank := DRLRegistryText('rank', aRank.Data[i].ID + ':' + IntToStr(aRank.Data[i].Value + 1), 'base_game', 'name',
        AnsiString(LuaSystem.Get(['ranks',aRank.Data[i].ID,aRank.Data[i].Value+1,'name'],'')));
      iDesc := LuaSystem.Get(['ranks',aRank.Data[i].ID,'award'],'');
      if (aRank.Data[i].ID = 'skill') and (iDesc = 'You have amazing skill and advance to {!%s} rank!') then
        FLines[iSize] := DRLText('message.rank.skill.promoted', 'You have amazing skill and advance to {!{{rank}}} rank!', [DRLStringParam('rank', iRank)])
      else if (aRank.Data[i].ID = 'exp') and (iDesc = 'You have fierceful determination and advance to {!%s} rank!') then
        FLines[iSize] := DRLText('message.rank.experience.promoted', 'You have fierceful determination and advance to {!{{rank}}} rank!', [DRLStringParam('rank', iRank)])
      else FLines[iSize] := Format(iDesc, [iRank]);
      Inc( iSize );
      iUnl := LuaSystem.GetTableSize(['ranks',aRank.Data[i].ID,aRank.Data[i].Value+1,'unlocks']);
      if iUnl > 0 then
      begin
        FLines[iSize] := DRLText('view.rank-up.unlocks-heading', 'This unlocks the following features:');
        Inc( iSize );
        for i2 := 1 to iUnl do
        begin
          FLines[iSize] := ' * '+LuaSystem.Get(['ranks',aRank.Data[i].ID,aRank.Data[i].Value+1,'unlocks',i2]);
          Inc( iSize );
        end;
        FLines[iSize] := '';
        Inc( iSize );
      end;
    end;

  SetLength( FLines, iSize );
end;

procedure TRankUpView.Update( aDTime : Integer; aActive : Boolean );
var i : Integer;
begin
  VTIG_BeginWindow(DRLText('view.rank-up.title', 'Congratulations!'), 'rank_up_view', FSize );

  for i := 0 to High( FLines ) do
    VTIG_FreeLabel( FLines[i], Point( 4, 6+i ) );

  VTIG_FreeLabel( DRLText('view.rank-up.press-confirm', 'Press <{!{$input_ok}}>...'), Point( 12, 8+High( FLines ) ) );

  VTIG_End(DRLText('view.hint.confirm-escape-continue', '{l<{!{$input_ok},{$input_escape}}> continue}'));
  if VTIG_EventCancel or VTIG_EventConfirm then
    FFinished := True;
end;


function TRankUpView.IsModal : Boolean;
begin
  Exit( True );
end;

end.

