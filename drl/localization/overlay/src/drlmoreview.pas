{ Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained. }
{$INCLUDE drl.inc}
{
 ----------------------------------------------------
Copyright (c) 2002-2025 by Kornel Kisielewicz
----------------------------------------------------
}
unit drlmoreview;
interface
uses vutil, viotypes, drlio, dfdata, dfbeing, dfitem, drlhooks;

type TMoreBeingView = class( TIOLayer )
  constructor Create( aBeing : TBeing );
  procedure Update( aDTime : Integer; aActive : Boolean ); override;
  function IsFinished : Boolean; override;
  function IsModal : Boolean; override;
  destructor Destroy; override;
protected
  procedure ReadTexts;
protected
  FSize     : TPoint;
  FBeing    : TBeing;
  FDesc     : Ansistring;
  FASCII    : Ansistring;
  FTexts    : array[0..6] of TStringGArray;
end;

type TMoreItemView = class( TIOLayer )
  constructor Create( aItem : TItem );
  procedure Update( aDTime : Integer; aActive : Boolean ); override;
  function IsFinished : Boolean; override;
  function IsModal : Boolean; override;
  destructor Destroy; override;
protected
  procedure ReadTexts;
protected
  FSize     : TPoint;
  FItem     : TItem;
  FTitle    : Ansistring;
  FDesc     : Ansistring;
  FTexts    : array[0..2] of TStringGArray;
end;

implementation

uses drlsemanticviewterms, drlsemanticperks, drlsemantictext, drlsemanticregistry, math, sysutils, vluasystem, vtig, dfplayer, drlbase, drlperk;

constructor TMoreBeingView.Create( aBeing : TBeing );
var i : Integer;
begin
  VTIG_ResetScroll( 'more_being_view' );
  VTIG_EventClear;
  FFinished := False;
  FBeing    := aBeing;
  FDesc     := DRLRegistryText('being', FBeing.ID, 'base_game', 'desc',
    AnsiString(LuaSystem.Get(['beings',FBeing.ID,'desc'])));
  FASCII    := '';
  if not ModuleOption_FullBeingDescription then
    if FBeing.ID = 'soldier'
      then FASCII := Player.ASCIIMoreCode
      else FASCII := FBeing.ID;
  FSize      := Point( 80, 25 );
  for i := Low( FTexts ) to High( FTexts ) do
    FTexts[i] := nil;
  if ModuleOption_FullBeingDescription then
  begin
    FSize      := Point( 60, 25 );
    ReadTexts;
  end;
end;

procedure TMoreBeingView.ReadTexts;
var iTot, iTor : Integer;
    iRes       : TResistance;
    iCount, i  : Integer;
    iPerks     : TPerkList;
    iName      : Ansistring;
  procedure DescribeItem( aItem : TItem );
  var iBox    : Ansistring;
      iPos, i : Integer;
  begin
    if aItem = nil then Exit;
    FTexts[iCount] := TStringGArray.Create;
    FTexts[iCount].Push( '{!'+aItem.PresentationDescription+'}' );
    iBox := aItem.PresentationDescriptionBox( True );
    iPos := 1;
    if Length( iBox ) > 0 then
    begin
      for i := 1 to Length( iBox ) do
        if iBox[i] = #10 then
        begin
          FTexts[iCount].Push( Copy(iBox, iPos, i - iPos) );
          iPos := i + 1;
        end;
      if iPos <= Length( iBox ) then FTexts[iCount].Push( Copy( iBox, iPos, Length( iBox ) - iPos + 1) );
    end;
    Inc( iCount );
  end;

begin
  FTexts[0] := TStringGArray.Create;
  FTexts[0].Push( DRLText('view.being.health', 'Health     : {!{R{{health}}}/{{maximum}}}', [DRLIntegerParam('health', FBeing.HP), DRLIntegerParam('maximum', FBeing.HPMax)]) );
  FTexts[0].Push( DRLText('view.being.armor', 'Armor      : {!{{armor}}}', [DRLIntegerParam('armor', FBeing.Armor)]) );
  FTexts[0].Push( DRLText('view.being.speed', 'Speed      : {!{{speed}}%}', [DRLIntegerParam('speed', FBeing.Speed)]) );
  FTexts[0].Push( DRLText('view.being.accuracy', 'Accuracy   : {!{{accuracy}}}', [DRLIntegerParam('accuracy', FBeing.Accuracy)]) );
  FTexts[0].Push( DRLText('view.being.strength', 'Strength   : {!{{strength}}} (xd3 damage)', [DRLIntegerParam('strength', (FBeing.Strength + 1))]) );
  FTexts[0].Push( DRLText('view.being.experience', 'Experience : {!{{experience}}}', [DRLIntegerParam('experience', FBeing.ExpValue)]) );
  FTexts[0].Push( DRLText('view.being.vision', 'Vision     : {!{{vision}}}', [DRLIntegerParam('vision', FBeing.Vision)]) );

  FTexts[1] := TStringGArray.Create;
  for iRes := Low(TResistance) to High(TResistance) do
  begin
    iTot  := FBeing.getTotalResistance(ResIDs[iRes],TARGET_INTERNAL);
    iTor  := FBeing.getTotalResistance(ResIDs[iRes],TARGET_TORSO);
    if (iTot <> 0) or (iTor <> 0) then
    begin
      if (iTot <> iTor)
        then FTexts[1].Push( DRLViewResistanceLabel(iRes, ResNames[iRes])+' : '+ResistStr(iTot)+DRLText('view.being.torso-resistance-label', ', torso ')+ResistStr(iTor) )
        else FTexts[1].Push( DRLViewResistanceLabel(iRes, ResNames[iRes])+' : '+ResistStr(iTot) );
    end;
  end;
  iCount := 2;
  iPerks := FBeing.GetPerkList;
  if ( iPerks <> nil ) and ( iPerks.Size > 0 ) then
  begin
    for i := 0 to iPerks.Size - 1 do
      with PerkData[ iPerks[i].ID ] do
      if ( Desc <> '' ) and ( ColorExp <> 0 ) then
      begin
        if FTexts[iCount] = nil then
        begin
          FTexts[iCount] :=  TStringGArray.Create;
          FTexts[iCount].Push( DRLText('view.effects.status-heading', '{!Status effects}') );
        end;
        iName := Name;
        if iName = '' then iName := FBeing.GetPerkShort( iPerks[i].ID );
        if iPerks[i].Time > 0
          then FTexts[iCount].Push( '  {' + VTIG_ColorChar( Color ) + DRLViewPerkName(iPerks[i].ID, iName, Name) + '} ({!' + FloatToStr( iPerks[i].Time / 10 ) + '}s) - ' + DRLViewPerkField(iPerks[i].ID, 'desc', Desc) )
          else FTexts[iCount].Push( '  {' + VTIG_ColorChar( Color ) + DRLViewPerkName(iPerks[i].ID, iName, Name) + '} - ' + DRLViewPerkField(iPerks[i].ID, 'desc', Desc) );
      end;
    if FTexts[iCount] <> nil then Inc( iCount );
  end;

  if ( iPerks <> nil ) and ( iPerks.Size > 0 ) then
  begin
    for i := 0 to iPerks.Size - 1 do
      with PerkData[ iPerks[i].ID ] do
      if ( Desc <> '' ) and ( ColorExp = 0 ) then
      begin
        if FTexts[iCount] = nil then
        begin
          FTexts[iCount] :=  TStringGArray.Create;
          FTexts[iCount].Push( DRLText('view.effects.permanent-heading', '{!Permanents}') );
        end;
        FTexts[iCount].Push( '  {' + VTIG_ColorChar( Color ) + DRLViewPerkField(iPerks[i].ID, 'name', Name) + '} - ' + DRLViewPerkField(iPerks[i].ID, 'desc', Desc) );
      end;
    if FTexts[iCount] <> nil then Inc( iCount );
  end;

  if FBeing.Inv <> nil then
  begin
    DescribeItem( FBeing.Inv.Slot[ efWeapon ] );
    DescribeItem( FBeing.Inv.Slot[ efTorso ] );
  end;
end;

procedure TMoreBeingView.Update( aDTime : Integer; aActive : Boolean );
var iString : Ansistring;
    iCount  : Integer;
begin
  if not ModuleOption_FullBeingDescription then
  begin
    VTIG_PushStyle(@TIGStylePadless);
    VTIG_BeginWindow(DRLRegistryText('being', FBeing.ID, 'base_game', 'name', FBeing.Name), 'more_being_view', FSize );
    VTIG_PopStyle();
    iCount := 0;
    if IO.Ascii.Exists(FASCII) then
      for iString in IO.Ascii[FASCII] do
      begin
        VTIG_FreeLabel( iString, Point( 2, iCount ) );
        Inc( iCount );
      end
    else
      VTIG_FreeLabel( DRLText('view.being.picture-unavailable', 'Picture'#10'N/A'), Point( 10, 10 ), LightRed );

    VTIG_BeginWindow(DRLRegistryText('being', FBeing.ID, 'base_game', 'name', FBeing.Name), Point( 38, -1 ), Point( 40,11 ) );
    VTIG_Text( FDesc );
    VTIG_End;
    VTIG_End(DRLText('view.hint.confirm-escape-exit', '{l<{!{$input_escape}},{!{$input_ok}}> exit}'));
  end
  else
  begin
    VTIG_BeginWindow(DRLRegistryText('being', FBeing.ID, 'base_game', 'name', FBeing.Name), 'more_being_view', FSize );
    VTIG_Text( FDesc );
    VTIG_Ruler;
    for iString in FTexts[0] do
      VTIG_Text( iString );
    if FTexts[1].Size > 0 then
    begin
      VTIG_Ruler;
      VTIG_Text( DRLText('view.being.resistances', '{!Resistances}') );
      for iString in FTexts[1] do
        VTIG_Text( iString );
    end;
    for iCount := 2 to High( FTexts ) do
      if FTexts[iCount] <> nil then
      begin
        VTIG_Ruler;
        for iString in FTexts[iCount] do
          VTIG_Text( iString );
      end;
    VTIG_Scrollbar;
    VTIG_End(DRLText('view.hint.scroll-return', '{l<{!{$input_up},{$input_down}}> scroll, <{!{$input_ok},{$input_escape}}> return}'));
  end;

  if VTIG_EventCancel or VTIG_EventConfirm or VTIG_Event( TIG_EV_MORE ) then
    FFinished := True;
end;


function TMoreBeingView.IsFinished : Boolean;
begin
  Exit( FFinished or ( DRL.State <> DSPlaying ) );
end;

function TMoreBeingView.IsModal : Boolean;
begin
  Exit( True );
end;

destructor TMoreBeingView.Destroy;
var i : Integer;
begin
  for i := Low( FTexts ) to High( FTexts ) do
    if FTexts[i] <> nil then
      FreeAndNil( FTexts[i] );
end;

{ TMoreItemView }

constructor TMoreItemView.Create( aItem : TItem );
var i : Integer;
begin
  VTIG_ResetScroll( 'more_item_view' );
  VTIG_EventClear;
  FFinished := False;
  FItem     := aItem;
  FDesc     := DRLRegistryText('item', FItem.ID, 'base_game', 'desc',
    AnsiString(LuaSystem.Get(['items',FItem.ID,'desc'])));
  FSize     := Point( 60, 25 );
  FTitle    := '{'+VTIG_ColorChar( FItem.MenuColor ) + FItem.PresentationDescription + '}';
  for i := Low( FTexts ) to High( FTexts ) do
    FTexts[i] := nil;
  ReadTexts;
end;

procedure TMoreItemView.ReadTexts;
var iPerks     : TPerkList;
    iHasFire   : Boolean;
    i          : Integer;
    iStatQueue : TStringGArray;
    iGroup     : AnsiString;
    iGroupName : AnsiString;
  procedure AddStat( const aName : Ansistring; const aValue : Ansistring );
  begin
    iStatQueue.Push( VTIG_Padded( aName, 13 ) + ': {!' + aValue + '}' );
  end;
  procedure FlushStats;
  var iLine : Ansistring;
      iIdx  : Integer;
  begin
    iIdx := 0;
    while iIdx + 1 < iStatQueue.Size do
    begin
      iLine := VTIG_Padded( iStatQueue[iIdx], 29 ) + ' ' + iStatQueue[iIdx + 1];
      FTexts[0].Push( iLine );
      iIdx += 2;
    end;
    if iIdx < iStatQueue.Size then
      FTexts[0].Push( iStatQueue[iIdx] );
    iStatQueue.Clear;
  end;
begin
  // Stats
  FTexts[0] := TStringGArray.Create;
  iStatQueue := TStringGArray.Create;

  iGroup := LuaSystem.Get(['items', FItem.ID, 'group'], '');
  if iGroup <> '' then
  begin
    iGroupName := DRLViewWeaponGroupName(iGroup, AnsiString(LuaSystem.Get(['core', 'weapon_group_name', iGroup], iGroup)));
    AddStat( DRLText('view.item-stat.weapon-group', 'Weapon group'), iGroupName );
  end;
  if (FItem.AmmoID > 0) and (not FItem.Flags[ IF_NOAMMO ]) then
    AddStat( DRLText('view.item-stat.ammo-type', 'Ammo type'), DRLRegistryText('item', AnsiString(LuaSystem.Get(['items', FItem.AmmoID, 'id'])), 'base_game', 'name', AnsiString(LuaSystem.Get(['items', FItem.AmmoID, 'name'], ''))) );

  case FItem.IType of
    ITEMTYPE_ARMOR, ITEMTYPE_BOOTS :
    begin
      AddStat( DRLText('view.item-stat.durability', 'Durability'), IntToStr(FItem.MaxDurability) );
      AddStat( DRLText('view.item-stat.swap-time', 'Swap time'), Seconds(FItem.SwapTime) );
    end;
    ITEMTYPE_URANGED :
    begin
      AddStat( DRLText('view.item-stat.damage-type', 'Damage type'), DRLViewDamageTypeName(FItem.DamageType, DamageTypeName(FItem.DamageType)) );
      AddStat( DRLText('view.item-stat.explosion-radius', 'Expl.radius'), IntToStr(FItem.Radius) );
    end;
    ITEMTYPE_RANGED, ITEMTYPE_NRANGED :
    begin
      AddStat( DRLText('view.item-stat.fire-time', 'Fire time'), Seconds(FItem.UseTime) );
      AddStat( DRLText('view.item-stat.reload-time', 'Reload time'), Seconds(FItem.ReloadTime) );
      AddStat( DRLText('view.item-stat.swap-time', 'Swap time'), Seconds(FItem.SwapTime) );
      AddStat( DRLText('view.item-stat.accuracy', 'Accuracy'), BonusStr(FItem.Acc) );
      AddStat( DRLText('view.item-stat.damage-type', 'Damage type'), DRLViewDamageTypeName(FItem.DamageType, DamageTypeName(FItem.DamageType)) );
      AddStat( DRLText('view.item-stat.shots', 'Shots'), IntToStr(math.Max(FItem.Shots, 1)) );
      AddStat( DRLText('view.item-stat.shot-cost', 'Shot cost'), IntToStr(Iif(FItem.Flags[IF_NOAMMO], 0, math.Max(FItem.ShotCost,1))) );
      AddStat( DRLText('view.item-stat.explosion-radius', 'Expl.radius'), IntToStr(FItem.Radius) );
      AddStat( DRLText('view.item-stat.damage-falloff', 'Dmg. falloff'), IntToStr(FItem.Falloff)+'%' );
      AddStat( DRLText('view.item-stat.cone-size', 'Cone size'), IntToStr(FItem.Spread) );
      AddStat( DRLText('view.item-stat.max-range', 'Max range'), IIf( FItem.Range > 0, IntToStr(FItem.Range), DRLText('view.item-stat.not-applicable', 'N/A') ) );
      if FItem.HasHook( Hook_OnAltFire ) then
        AddStat( DRLText('view.item-stat.alt-fire', 'Alt. fire'), DRLViewItemPerkText(FItem, Hook_OnAltFire, 'short', FItem.GetAltFireName) );
      if FItem.HasHook( Hook_OnAltReload ) then
        AddStat( DRLText('view.item-stat.alt-reload', 'Alt. reload'), DRLViewItemPerkText(FItem, Hook_OnAltReload, 'short', FItem.GetAltReloadName) );
    end;
    ITEMTYPE_MELEE :
    begin
      AddStat( DRLText('view.item-stat.attack-time', 'Attack time'), Seconds(FItem.UseTime) );
      AddStat( DRLText('view.item-stat.swap-time', 'Swap time'), Seconds(FItem.SwapTime) );
      AddStat( DRLText('view.item-stat.accuracy', 'Accuracy'), BonusStr(FItem.Acc) );
      AddStat( DRLText('view.item-stat.damage-type', 'Damage type'), DRLViewDamageTypeName(FItem.DamageType, DamageTypeName(FItem.DamageType)) );
      if FItem.HasHook( Hook_OnAltFire ) then
        AddStat( DRLText('view.item-stat.alt-fire', 'Alt. fire'), DRLViewItemPerkText(FItem, Hook_OnAltFire, 'short', FItem.GetAltFireName) );
    end;
  end;

  // Common stats
  AddStat( DRLText('view.item-stat.move-speed', 'Move speed'), Percent(FItem.MoveMod) );
  AddStat( DRLText('view.item-stat.knockback', 'Knockback'), Percent(FItem.KnockMod) );
  AddStat( DRLText('view.item-stat.dodge-rate', 'Dodge rate'), Percent(FItem.DodgeMod) );

  FlushStats;
  
  // Resistances
  if FItem.GetResistance('bullet') <> 0 then
    AddStat( DRLText('view.item-stat.bullet-resistance', 'Bullet res.'), BonusStr(FItem.GetResistance('bullet')) );
  if FItem.GetResistance('melee') <> 0 then
    AddStat( DRLText('view.item-stat.melee-resistance', 'Melee res.'), BonusStr(FItem.GetResistance('melee')) );
  if FItem.GetResistance('shrapnel') <> 0 then
    AddStat( DRLText('view.item-stat.shrapnel-resistance', 'Shrapnel res'), BonusStr(FItem.GetResistance('shrapnel')) );
  if FItem.GetResistance('acid') <> 0 then
    AddStat( DRLText('view.item-stat.acid-resistance', 'Acid res.'), BonusStr(FItem.GetResistance('acid')) );
  if FItem.GetResistance('fire') <> 0 then
    AddStat( DRLText('view.item-stat.fire-resistance', 'Fire res.'), BonusStr(FItem.GetResistance('fire')) );
  if FItem.GetResistance('plasma') <> 0 then
    AddStat( DRLText('view.item-stat.plasma-resistance', 'Plasma res.'), BonusStr(FItem.GetResistance('plasma')) );
  if FItem.GetResistance('cold') <> 0 then
    AddStat( DRLText('view.item-stat.cold-resistance', 'Cold res.'), BonusStr(FItem.GetResistance('cold')) );
  if FItem.GetResistance('poison') <> 0 then
    AddStat( DRLText('view.item-stat.poison-resistance', 'Poison res.'), BonusStr(FItem.GetResistance('poison')) );
  if FItem.GetResistance('pierce') <> 0 then
    AddStat( DRLText('view.item-stat.pierce-resistance', 'Pierce res.'), BonusStr(FItem.GetResistance('pierce')) );
  
  if iStatQueue.Size > 0 then
  begin
    FTexts[0].Push( '' ); // Empty line before resistances
    FlushStats;
  end;
  
  FreeAndNil( iStatQueue );

  iPerks := FItem.GetPerkList;
  if ( iPerks <> nil ) and ( iPerks.Size > 0 ) then
  begin
    iHasFire := False;
    // Alt-fire perk (shown separately with description)
    if FItem.HasHook( Hook_OnAltFire ) then
      for i := 0 to iPerks.Size - 1 do
        with PerkData[ iPerks[i].ID ] do
          if Hook_OnAltFire in Hooks then
          begin
            FTexts[0].Push( '' );
            FTexts[0].Push( DRLText('view.item.alt-fire-description', 'Alt. fire    : {!{{description}}}', [DRLStringParam('description', DRLViewPerkField(iPerks[i].ID, 'desc', Desc))]) );
            iHasFire := True;
            break;
          end;

    // Alt-reload perk (shown separately with description)
    if FItem.HasHook( Hook_OnAltReload ) then
      for i := 0 to iPerks.Size - 1 do
        with PerkData[ iPerks[i].ID ] do
          if Hook_OnAltReload in Hooks then
          begin
            if not iHasFire then FTexts[0].Push( '' );
            FTexts[0].Push( DRLText('view.item.alt-reload-description', 'Alt. reload  : {!{{description}}}', [DRLStringParam('description', DRLViewPerkField(iPerks[i].ID, 'desc', Desc))]) );
            break;
          end;

    FTexts[1] := TStringGArray.Create;
    for i := 0 to iPerks.Size - 1 do
      with PerkData[ iPerks[i].ID ] do
        if ( Name <> '' ) and ( Desc <> '' ) then
          FTexts[1].Push( '{' + VTIG_ColorChar( Color ) + DRLViewPerkField(iPerks[i].ID, 'name', Name) + '} - ' + DRLViewPerkField(iPerks[i].ID, 'desc', Desc) );
  end;
end;

procedure TMoreItemView.Update( aDTime : Integer; aActive : Boolean );
var iString : Ansistring;
begin
  VTIG_BeginWindow(FTitle, 'more_item_view', FSize );
  VTIG_Text( FDesc );
  VTIG_Ruler;
  if FTexts[0] <> nil then
    for iString in FTexts[0] do
      VTIG_Text( iString );
  if FTexts[1] <> nil then
  begin
    VTIG_Ruler;
    for iString in FTexts[1] do
      VTIG_Text( iString );
  end;
  VTIG_Scrollbar;
  VTIG_End(DRLText('view.hint.scroll-return', '{l<{!{$input_up},{$input_down}}> scroll, <{!{$input_ok},{$input_escape}}> return}'));

  if VTIG_EventCancel or VTIG_EventConfirm or VTIG_Event( TIG_EV_MORE ) then
  begin
    VTIG_EventClear;
    FFinished := True;
  end;
end;

function TMoreItemView.IsFinished : Boolean;
begin
  Exit( FFinished or ( DRL.State <> DSPlaying ) );
end;

function TMoreItemView.IsModal : Boolean;
begin
  Exit( True );
end;

destructor TMoreItemView.Destroy;
var i : Integer;
begin
  for i := Low( FTexts ) to High( FTexts ) do
    if FTexts[i] <> nil then
      FreeAndNil( FTexts[i] );
end;

end.

