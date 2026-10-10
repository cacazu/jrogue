{ Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained. }
{$INCLUDE drl.inc}
{
 ----------------------------------------------------
Copyright (c) 2002-2025 by Kornel Kisielewicz
----------------------------------------------------
}
unit drlplayerview;
interface
uses vioevent, viotypes, vgenerics, vtigstyle,
     dfitem, dfdata, drlhooks,
     drlio, drltraits, drlconfirmview;

type TPlayerViewState = (
  PLAYERVIEW_INVENTORY,
  PLAYERVIEW_EQUIPMENT,
  PLAYERVIEW_CHARACTER,
  PLAYERVIEW_TRAITS,
  PLAYERVIEW_CLOSING,
  PLAYERVIEW_PENDING,
  PLAYERVIEW_DONE
);

type TItemViewEntry = record
  Name  : Ansistring;
  Desc  : Ansistring;
  Stats : Ansistring;
  Perks : Ansistring;
  Item  : TItem;
  Color : Byte;
  QSlot : Byte;
end;

type TItemViewArray = specialize TGArray< TItemViewEntry >;

type TTraitViewEntry = record
  Entry     : Ansistring;
  Name      : Ansistring;
  Quote     : Ansistring;
  Desc      : Ansistring;
  Requires  : Ansistring;
  Blocks    : Ansistring;
  Available : Boolean;
  Value     : Byte;
  Index     : Byte;
  Master    : Boolean;
end;

type TTraitViewArray = specialize TGArray< TTraitViewEntry >;

type TPlayerView = class( TIOLayer )
  constructor Create( aInitialState : TPlayerViewState = PLAYERVIEW_INVENTORY );
  constructor CreateTrait( aFirstTrait : Boolean; aKlass : Byte = 0 );
  constructor CreateCommand( aCommand : Byte; aScavenger : Boolean = False );
  procedure Update( aDTime : Integer; aActive : Boolean ); override;
  function IsFinished : Boolean; override;
  function IsModal : Boolean; override;
  procedure Retain;
  destructor Destroy; override;
protected
  function MarkQSlot( aItem : TItem; aValue : Byte ) : Boolean;
  function QSlotChar( aQSlot : Byte ) : Char;
  procedure Initialize;
  procedure UpdateInventory( aActive : Boolean );
  procedure UpdateEquipment( aActive : Boolean );
  procedure UpdateCharacter( aActive : Boolean );
  procedure UpdateTraits( aActive : Boolean );
  procedure PushItem( aItem : TItem; aArray : TItemViewArray );
  procedure ReadInv;
  procedure ReadEq;
  procedure ReadTraits( aKlass : Byte );
  procedure ReadCharacter;
  procedure ReadQuickslots;
  procedure InitSwapMode( aSlot : TEqSlot );
  procedure Sort( aList : TItemViewArray );
protected
  procedure Filter( aSet : TItemTypeSet; aUsableOnly : Boolean = False );
protected
  FState       : TPlayerViewState;
  FSize        : TIOPoint;
  FInv         : TItemViewArray;
  FEq          : TItemViewArray;
  FCharacter   : array[0..5] of TStringGArray;
  FCompactStyle: TTIGStyle;
  FTraitsStyle : TTIGStyle;
  FAction      : AnsiString;
  FITitle      : AnsiString;
  FCTitle      : AnsiString;
  FSwapMode    : Boolean;
  FTraitMode   : Boolean;
  FTraitFirst  : Boolean;
  FScavenger   : Boolean;
  FSSlot       : TEqSlot;
  FTraits      : TTraitViewArray;
  FCommandMode : Byte;

  class var FTraitPick : Byte;
public
  class property TraitPick : Byte read FTraitPick;
end;

type TUnloadConfirmView = class( TConfirmView )
  constructor Create( aItem : TItem; aID : Ansistring = '' );
protected
  procedure OnConfirm; override;
protected
  FItem : TItem;
  FID   : Ansistring;
end;

type TNoRoomConfirmView = class( TConfirmView )
  constructor Create( aItem : TItem; aID : Ansistring = '' );
protected
  procedure OnConfirm; override;
protected
  FItem : TItem;
end;

implementation

uses drlsemanticfeelings, drlsemanticviewterms, drlsemanticperks, drlsemantictext, drlsemanticregistry, sysutils, math, variants,
     vutil, vtig, vtigio, vluasystem,
     dfplayer,
     drlcommand, drlbase, drlinventory, drlperk;

function DRLViewSlotName(aSlot: TEqSlot; const aEnglish: AnsiString): AnsiString;
begin
  case aSlot of
    efTorso: if aEnglish = '[ Armor      ]' then
      Exit(DRLText('mortem.slot.armor', aEnglish));
    efWeapon: if aEnglish = '[ Weapon     ]' then
      Exit(DRLText('mortem.slot.weapon', aEnglish));
    efBoots: if aEnglish = '[ Boots      ]' then
      Exit(DRLText('mortem.slot.boots', aEnglish));
    efWeapon2: if aEnglish = '[ Prepared   ]' then
      Exit(DRLText('mortem.slot.prepared', aEnglish));
    efRelic: if aEnglish = '[ Relic      ]' then
      Exit(DRLText('mortem.slot.relic', aEnglish));
  end;
  Exit(aEnglish);
end;



constructor TPlayerView.Create( aInitialState : TPlayerViewState = PLAYERVIEW_INVENTORY );
begin
  Initialize;
  FState := aInitialState;
end;

constructor TPlayerView.CreateTrait( aFirstTrait : Boolean; aKlass : Byte = 0 );
begin
  Initialize;
  FState     := PLAYERVIEW_TRAITS;
  FTraitMode := True;
  FTraitFirst:= aFirstTrait;

  if FTraitFirst
    then ReadTraits( aKlass )
    else ReadTraits( Player.Klass )
end;

constructor TPlayerView.CreateCommand( aCommand : Byte; aScavenger : Boolean = False );
begin
  Initialize;
  FCommandMode := aCommand;
  FScavenger   := aScavenger;
  FState       := PLAYERVIEW_INVENTORY;
  ReadInv;
  case aCommand of
    COMMAND_USE    : begin FAction := DRLText('view.inventory.action-use', 'use');  FITitle := DRLText('view.inventory.choose-use', 'Choose item to use');  Filter( [ITEMTYPE_PACK,ITEMTYPE_URANGED], True ); end;
    COMMAND_DROP   : begin FAction := DRLText('view.inventory.action-drop', 'drop'); FITitle := DRLText('view.inventory.choose-drop', 'Choose item to drop'); end;
    COMMAND_UNLOAD : if aScavenger
                       then begin FAction := DRLText('view.inventory.action-unload-scavenge', 'unload/scavenge');  FITitle := DRLText('view.inventory.choose-unload-scavenge', 'Choose item to unload/scavenge');  Filter( [ITEMTYPE_RANGED, ITEMTYPE_AMMOPACK, ITEMTYPE_MELEE, ITEMTYPE_ARMOR, ITEMTYPE_BOOTS] ); end
                       else begin FAction := DRLText('view.inventory.action-unload', 'unload');           FITitle := DRLText('view.inventory.choose-unload', 'Choose item to unload');  Filter( [ITEMTYPE_RANGED, ITEMTYPE_AMMOPACK] ); end;
  end;
end;

procedure TPlayerView.Initialize;
begin
  FCompactStyle := TIGStylePadless;
  FCompactStyle.Padding[ VTIG_WINDOW_PADDING ].X := 1;
  FCompactStyle.Padding[ VTIG_WINDOW_PADDING_OFFSET ] := Point( 0, 1 );
  FTraitsStyle := TIGStylePadless;
  FTraitsStyle.Padding[ VTIG_WINDOW_PADDING ].X := 1;
  VTIG_EventClear;
  VTIG_ResetSelect( 'inventory' );
  VTIG_ResetSelect( 'equipment' );
  VTIG_ResetSelect( 'traits' );
  VTIG_ResetSelect( 'unload_confirm' );
  VTIG_ResetScroll( 'character' );
  FState       := PLAYERVIEW_INVENTORY;
  FSize        := Point( 80, 25 );
  if IO.NarrowMode then FSize := Point( 76, 25 );
  FInv         := nil;
  FEq          := nil;
  FTraits      := nil;
  FSwapMode    := False;
  FTraitMode   := False;
  FTraitFirst  := False;
  FCommandMode := 0;
  FAction      := DRLText('view.inventory.action-wear-use', 'wear/use');
  FITitle      := DRLText('view.inventory.title', 'Inventory');
  FTraitPick   := 255;
end;

procedure TPlayerView.Update( aDTime : Integer; aActive : Boolean );
var iTraitFirst : Boolean;
begin
  if IsFinished or (FState = PLAYERVIEW_CLOSING) or (FState = PLAYERVIEW_PENDING) then Exit;

  iTraitFirst := FTraitFirst;
  if ( DRL.State <> DSPlaying ) and ( not iTraitFirst ) then
  begin
    FState := PLAYERVIEW_DONE;
    Exit;
  end;

  case FState of
    PLAYERVIEW_INVENTORY : UpdateInventory( aActive );
    PLAYERVIEW_EQUIPMENT : UpdateEquipment( aActive );
    PLAYERVIEW_CHARACTER : UpdateCharacter( aActive );
    PLAYERVIEW_TRAITS    : UpdateTraits( aActive );
  end;

  if (( DRL.State <> DSPlaying ) and ( not iTraitFirst )) or IsFinished or (FState = PLAYERVIEW_CLOSING) or (FState = PLAYERVIEW_PENDING) then Exit;

  if (aActive) and ( not FSwapMode ) and ( not FTraitMode ) and ( FCommandMode = 0 ) then
  begin
    if VTIG_Event( VTIG_IE_LEFT ) then
    begin
      if FState = Low( TPlayerViewState ) then FState := PLAYERVIEW_TRAITS       else FState := Pred( FState );
    end;
    if VTIG_Event( VTIG_IE_RIGHT ) then
    begin
      if FState = PLAYERVIEW_TRAITS       then FState := Low( TPlayerViewState ) else FState := Succ( FState );
    end;
    if ( FState <> PLAYERVIEW_DONE ) then
    begin
      if VTIG_Event( TIG_EV_INVENTORY ) then
      begin
        if FState = PLAYERVIEW_INVENTORY
          then FState := PLAYERVIEW_DONE
          else FState := PLAYERVIEW_INVENTORY;
      end;

      if VTIG_Event( TIG_EV_EQUIPMENT ) then
      begin
        if FState = PLAYERVIEW_EQUIPMENT
          then FState := PLAYERVIEW_DONE
          else FState := PLAYERVIEW_EQUIPMENT;
      end;

      if VTIG_Event( TIG_EV_CHARACTER ) then
      begin
        if FState = PLAYERVIEW_CHARACTER
          then FState := PLAYERVIEW_DONE
          else FState := PLAYERVIEW_CHARACTER;
      end;

      if VTIG_Event( TIG_EV_TRAITS ) then
      begin
        if FState = PLAYERVIEW_TRAITS
          then FState := PLAYERVIEW_DONE
          else FState := PLAYERVIEW_TRAITS;
      end;
    end;
  end;

  if aActive and ( FState <> PLAYERVIEW_DONE ) and VTIG_EventCancel then
  begin
    if ( not FTraitMode )
      then FState := PLAYERVIEW_DONE
      else if FTraitFirst then
        begin
          FState := PLAYERVIEW_DONE;
          FTraitPick := 255;
        end;
  end;
end;

function TPlayerView.IsFinished : Boolean;
begin
  Exit( FState = PLAYERVIEW_DONE );
end;

procedure TPlayerView.Retain;
begin
  if FState = PLAYERVIEW_PENDING then FState := PLAYERVIEW_INVENTORY;
end;

function TPlayerView.IsModal : Boolean;
begin
  Exit( ( FState <> PLAYERVIEW_CLOSING ) and ( FState <> PLAYERVIEW_PENDING ) );
end;

destructor TPlayerView.Destroy;
var i : Integer;
begin
  DRL.ClearPlayerView;
  FreeAndNil( FEq );
  FreeAndNil( FInv );
  FreeAndNil( FTraits );
  for i := Low( FCharacter ) to High( FCharacter ) do
    FreeAndNil( FCharacter[i] );
  inherited Destroy;
end;

function TPlayerView.MarkQSlot( aItem : TItem; aValue : Byte ) : Boolean;
var i : Integer;
begin
  if aItem.isWearable and ( not aItem.isRelic ) then
  begin
    if Player.FQuickSlots[ aValue ].UID = aItem.UID
      then Player.FQuickSlots[ aValue ].UID := 0
      else Player.FQuickSlots[ aValue ].UID := aItem.UID;
    Player.FQuickSlots[ aValue ].ID := '';
    for i := 1 to 9 do
      if ( i <> aValue ) and ( Player.FQuickSlots[ i ].UID = aItem.UID ) then
        Player.FQuickSlots[ i ].UID := 0;
    ReadQuickslots;
    Exit( True );
  end;
  if aItem.isUsable then
  begin
    if Player.FQuickSlots[ aValue ].ID = aItem.ID
      then Player.FQuickSlots[ aValue ].ID := ''
      else Player.FQuickSlots[ aValue ].ID := aItem.ID;
    Player.FQuickSlots[ aValue ].UID := 0;
    for i := 1 to 9 do
      if ( i <> aValue ) and ( Player.FQuickSlots[ i ].ID = aItem.ID ) then
        Player.FQuickSlots[ i ].ID := '';
    ReadQuickslots;
    Exit( True );
  end;
  Exit( False );
end;

function TPlayerView.QSlotChar( aQSlot : Byte ) : Char;
begin
  if IO.IsGamepad and ( aQSlot < 5 ) and ( aQSlot > 0 ) then
    Exit( PadQSlotChar[ aQSlot ] );
  Exit( Chr(Ord('0') + aQSlot ) );
end;

procedure TPlayerView.UpdateInventory( aActive : Boolean );
var iEntry    : TItemViewEntry;
    iSelected : Integer;
    iCommand  : Byte;

begin
  if FInv = nil then ReadInv;
  VTIG_PushStyle( @FCompactStyle );
  VTIG_BeginWindow( FITitle, 'inventory', FSize );
  VTIG_PopStyle();
    VTIG_BeginGroup( 50 );
    for iEntry in FInv do
      if iEntry.QSlot <> 0
        then VTIG_Selectable( '[{!{0}}] {1}',[QSlotChar( iEntry.QSlot ), iEntry.Name], True, iEntry.Color )
        else VTIG_Selectable( iEntry.Name, True, iEntry.Color );
    iSelected := VTIG_Selected;
    if FInv.Size = 0 then
    begin
      iSelected := -1;
      if FSwapMode
        then VTIG_Text( DRLText('view.inventory.no-matching-items', 'No matching items, press <{!{$input_ok}}>.') )
        else VTIG_Text( DRLText('view.inventory.empty', '{!No items in inventory!}') );
    end;
    if iSelected >= FInv.Size then
    begin
      VTIG_ResetSelect();
      iSelected := VTIG_Selected;
    end;

    VTIG_EndGroup;

    VTIG_BeginGroup;
    if iSelected >= 0 then
    begin
      if FInv[iSelected].Perks <> '' then
        VTIG_Text( FInv[iSelected].Perks );
      if FInv[iSelected].Stats <> '' then
        VTIG_Text( FInv[iSelected].Stats );
      VTIG_Text( FInv[iSelected].Desc );
      if ( FInv[iSelected].Item <> nil ) and ( FInv[iSelected].Item.isWearable ) then
        if IO.isGamepad
          then VTIG_FreeLabel( DRLText('view.item.more-controller', '  <{!RTrigger+A}> more'), Rectangle(1,13,48,1) )
          else VTIG_FreeLabel( DRLText('view.item.more-keyboard', '  <{!m}>ore'), Rectangle(12,13,48,1) );

      VTIG_Ruler( 19 );
      VTIG_Text( '<{!{$input_ok}}> {0}',[FAction] );
      if (not FSwapMode) and ( FCommandMode in [0, COMMAND_USE] ) then
      begin
        VTIG_Text( DRLText('view.inventory.drop-hint', '<{!{$input_uidrop}}> drop') );
        VTIG_Text( DRLText('view.inventory.unload-drop-hint', '<{!{$input_uialtdrop}}>    unload and drop') );
        if IO.IsGamepad
          then VTIG_Text( DRLText('view.item.quickslot-controller', '<{!LTrigger+DPad}> mark quickslot') )
          else VTIG_Text( DRLText('view.item.quickslot-keyboard', '<{!1-9}> mark quickslot') );
      end;
    end;

    VTIG_EndGroup;
  if FSwapMode or ( FCommandMode <> 0 )
    then VTIG_End(DRLText('view.hint.select-exit', '{l<{!{$input_up},{$input_down}}> select, <{!{$input_escape}}> exit}'))
    else VTIG_End(DRLText('view.hint.panels-select-exit', '{l<{!{$input_left},{$input_right}}> panels, <{!{$input_up},{$input_down}}> select, <{!{$input_escape}}> exit}'));


  if not aActive then Exit;

  if (iSelected >= 0) then
  begin
    if VTIG_Event( TIG_EV_MORE )
      or ( IO.IsGamepad
        and IO.PadState.Active( VPAD_BUTTON_RIGHTTRIGGER )
        and VTIG_EventConfirm ) then
    begin
      if Assigned( FInv[iSelected].Item ) then
        IO.FullLook( FInv[iSelected].Item );
    end
    else
    if FSwapMode then
    begin
      if VTIG_EventConfirm then
      begin
        FState := PLAYERVIEW_CLOSING;
        DRL.HandleCommand( TCommand.Create( COMMAND_SWAP, FInv[iSelected].Item, FSSlot ) );
        FState := PLAYERVIEW_DONE;
      end;
    end
    else
    begin
      if ( FCommandMode in [0, COMMAND_USE] ) then
      begin
        if VTIG_Event( VTIG_IE_BACKSPACE ) then
        begin
          FState := PLAYERVIEW_PENDING;
          DRL.HandleCommand( TCommand.Create(
            COMMAND_DROP,
            FInv[iSelected].Item,
            VTIG_Event( VTIG_IE_SHIFT )
              or IO.PadState.Active( VPAD_BUTTON_RIGHTTRIGGER )
          ) );
          if FState = PLAYERVIEW_PENDING
            then FState := PLAYERVIEW_DONE
            else begin ReadInv; FState := PLAYERVIEW_INVENTORY; end
        end
        else
        if VTIG_EventConfirm then
        begin
          iCommand := COMMAND_NONE;
          if FInv[iSelected].Item.isWearable then iCommand := COMMAND_WEAR;
          if FInv[iSelected].Item.isUsable   then iCommand := COMMAND_USE;
          FState := PLAYERVIEW_CLOSING;
          if iCommand <> COMMAND_NONE then
            if FInv[iSelected].Item.IType = ITEMTYPE_URANGED
              then DRL.HandleUsableCommand( FInv[iSelected].Item )
              else DRL.HandleCommand( TCommand.Create( iCommand, FInv[iSelected].Item ) );
          FState := PLAYERVIEW_DONE;
        end;
        if VTIG_Event( VTIG_IE_1 ) then MarkQSlot( FInv[iSelected].Item, 1 );
        if VTIG_Event( VTIG_IE_2 ) then MarkQSlot( FInv[iSelected].Item, 2 );
        if VTIG_Event( VTIG_IE_3 ) then MarkQSlot( FInv[iSelected].Item, 3 );
        if VTIG_Event( VTIG_IE_4 ) then MarkQSlot( FInv[iSelected].Item, 4 );
        if VTIG_Event( VTIG_IE_5 ) then MarkQSlot( FInv[iSelected].Item, 5 );
        if VTIG_Event( VTIG_IE_6 ) then MarkQSlot( FInv[iSelected].Item, 6 );
        if VTIG_Event( VTIG_IE_7 ) then MarkQSlot( FInv[iSelected].Item, 7 );
        if VTIG_Event( VTIG_IE_8 ) then MarkQSlot( FInv[iSelected].Item, 8 );
        if VTIG_Event( VTIG_IE_9 ) then MarkQSlot( FInv[iSelected].Item, 9 );
      end
      else
      begin
        if VTIG_EventConfirm then
        begin
          iCommand := FCommandMode;
          FState := PLAYERVIEW_CLOSING;
               if iCommand = COMMAND_UNLOAD then
            DRL.HandleUnloadCommand( FInv[iSelected].Item )
          else if iCommand <> COMMAND_NONE then
            DRL.HandleCommand( TCommand.Create( iCommand, FInv[iSelected].Item ) );
          FState := PLAYERVIEW_DONE;
        end;
      end;
    end;
  end
  else
  begin
    if VTIG_EventConfirm then
      FState := PLAYERVIEW_DONE;
  end;
end;

procedure TPlayerView.UpdateEquipment( aActive : Boolean );
var iEntry            : TItemViewEntry;
    iSelected,iY      : Integer;
    iB, iA, iR, iK    : Integer;
    iTot, iFeet, iTor : Integer;
    iCount            : Integer;
    iRes              : TResistance;
    iName             : Ansistring;
  function CannotUnequip : Boolean;
  var iSavedState : TPlayerViewState;
  begin
    if ( FEq[iSelected].Item <> nil ) then
    begin
      iSavedState := FState;
      FState := PLAYERVIEW_CLOSING;
      if not FEq[iSelected].Item.CallHookCheck( Hook_OnUnequipCheck, [ Player, False ] ) then
      begin
        FState := PLAYERVIEW_DONE;
        Exit( True );
      end;
      FState := iSavedState;
    end;
    Exit( False );
  end;

begin
  if FEq = nil then ReadEq;
  VTIG_BeginWindow(DRLText('view.equipment.title', 'Equipment'), 'equipment', FSize );
    VTIG_BeginGroup( 10, True );

      VTIG_BeginGroup( 50 );
        for iEntry in FEq do
           if (iEntry.QSlot <> 0) and (iEntry.Item <> nil)
            then VTIG_Selectable( '[{!{0}}] {1}',[QSlotChar( iEntry.QSlot ), iEntry.Name], True, iEntry.Color )
            else VTIG_Selectable( iEntry.Name, iEntry.Item <> nil, iEntry.Color );
      iSelected := VTIG_Selected;
      VTIG_Text( '' );
      if ( iSelected >= 0 ) and Assigned( FEq[iSelected].Item ) then
        VTIG_Text( FEq[iSelected].Desc );
      VTIG_EndGroup;

      VTIG_BeginGroup;
      if ( iSelected >= 0 ) and Assigned( FEq[iSelected].Item ) then
      begin
        if FEq[iSelected].Perks <> '' then
          VTIG_Text( FEq[iSelected].Perks );
        VTIG_Text( FEq[iSelected].Stats );
        if IO.isGamepad
          then VTIG_FreeLabel( DRLText('view.item.more-controller', '  <{!RTrigger+A}> more'), Rectangle(1,8,48,1) )
          else VTIG_FreeLabel( DRLText('view.item.more-keyboard', '  <{!m}>ore'), Rectangle(12,8,48,1) );
      end;
      VTIG_EndGroup;

    VTIG_EndGroup( True );

    iY := 10;
    iB := 0;
    iA := 0;
    iR := 42;
    iK := 42;
    if IO.NarrowMode then
    begin
      iR := 40;
      iK := 40;
    end;

    VTIG_FreeLabel( DRLText('view.traits.basic', 'Basic traits'),    Point(0, iY) );
    VTIG_FreeLabel( DRLText('view.traits.advanced', 'Advanced traits'), Point(20,iY) );
    VTIG_FreeLabel( DRLText('view.equipment.resistances', 'Resistances'),     Point(iR,iY) );

    for iCount := 1 to MAXTRAITS do
      if Player.Traits[iCount] > 0 then
      begin
        iName := DRLRegistryText('trait', AnsiString(LuaSystem.Get(['traits',iCount,'id'])), 'base_game', 'name', AnsiString(LuaSystem.Get(['traits',iCount,'name'])));
        if iName = '' then Continue;
        if iCount < 10 then
        begin
          Inc( iB );
          VTIG_FreeLabel( '{d'+VTIG_Padded(iName,16) + '({!' + IntToStr(Player.Traits[iCount])+ '})}', Point(0, iY+iB) );
        end
        else
        begin
          Inc( iA );
          VTIG_FreeLabel( '{d'+VTIG_Padded(iName,16) + '({!' + IntToStr(Player.Traits[iCount])+ '})}', Point(20, iY+iA) );
        end;
      end;

    for iRes := Low(TResistance) to High(TResistance) do
    begin
      iTot  := Player.getTotalResistance(ResIDs[iRes],TARGET_INTERNAL);
      iTor  := Player.getTotalResistance(ResIDs[iRes],TARGET_TORSO);
      iFeet := Player.getTotalResistance(ResIDs[iRes],TARGET_FEET);
      if (iTot <> 0) or (iTor <> 0) or (iFeet <> 0) then
      begin
        Inc( iY );
        VTIG_FreeLabel( '{d'+DRLViewResistanceLabel(iRes, ResNames[iRes])+Padded(ResistStr(iTot),8)+
             DRLText('view.equipment.torso', ' Torso')+Padded(ResistStr(iTor),8)+
             DRLText('view.equipment.feet', ' Feet')+Padded(ResistStr(iFeet),8)+'}', Point( iR, iY ) );
      end;
    end;

    VTIG_FreeLabel( DRLText('view.equipment.wear-remove-hint', '<{!{$input_ok}}> take off/wear'), Point(iK, 19) );
    if IO.IsGamepad then
    begin
      VTIG_FreeLabel( DRLText('view.item.quickslot-controller', '<{!LTrigger+DPad}> mark quickslot'), Point(iK, 20) );
      VTIG_FreeLabel( DRLText('view.equipment.swap-drop-hint', '<{!{$input_uiswap}}> swap item, <{!{$input_uidrop}}> drop item'), Point(iK, 21) );
    end
    else
    begin
      VTIG_FreeLabel( DRLText('view.equipment.swap-quickslot-hint', '<{!{$input_uiswap}}> swap item, <{!1-9}> mark quickslot'), Point(iK, 20) );
      VTIG_FreeLabel( DRLText('view.equipment.drop-hint', '<{!{$input_uidrop}}> drop item'), Point(iK, 21) );
    end;
  VTIG_End(DRLText('view.hint.panels-select-exit', '{l<{!{$input_left},{$input_right}}> panels, <{!{$input_up},{$input_down}}> select, <{!{$input_escape}}> exit}'));

  if not aActive then Exit;

  if (iSelected >= 0) then
  begin
    if VTIG_Event( TIG_EV_MORE )
      or ( IO.IsGamepad
        and IO.PadState.Active( VPAD_BUTTON_RIGHTTRIGGER )
        and VTIG_EventConfirm ) then
    begin
      if Assigned( FEq[iSelected].Item ) then
        IO.FullLook( FEq[iSelected].Item );
    end
    else
    if VTIG_EventConfirm then
    begin
      if Assigned( FEq[iSelected].Item ) then
      begin
        if ( Player.Inv.isFull ) then
        begin
          FState := PLAYERVIEW_CLOSING;
          if not Option_InvFullDrop then
          begin
            IO.PushLayer( TNoRoomConfirmView.Create( FEq[iSelected].Item ) );
            FState := PLAYERVIEW_DONE;
            Exit;
          end;
          if CannotUnequip then Exit;
          FState := PLAYERVIEW_CLOSING;
          DRL.HandleCommand( TCommand.Create( COMMAND_DROP, FEq[iSelected].Item ) );
          FState := PLAYERVIEW_DONE;
        end
        else
        begin
          if CannotUnequip then Exit;
          FState := PLAYERVIEW_CLOSING;
          DRL.HandleCommand( TCommand.Create( COMMAND_TAKEOFF, nil, TEqSlot(iSelected) ) );
          FState := PLAYERVIEW_DONE;
        end;
      end
      else
      begin
        InitSwapMode( TEqSlot(iSelected) );
        Exit;
      end;
    end
    else
    if VTIG_Event( VTIG_IE_TAB ) then
    begin
      if CannotUnequip then Exit;
      InitSwapMode( TEqSlot(iSelected) );
      Exit;
    end
    else
    if Assigned( FEq[iSelected].Item ) then
    begin
      if VTIG_Event( VTIG_IE_BACKSPACE ) then
      begin
        if CannotUnequip then Exit;
        FState := PLAYERVIEW_CLOSING;
        DRL.HandleCommand( TCommand.Create(
          COMMAND_DROP,
          FEq[iSelected].Item,
          VTIG_Event( VTIG_IE_SHIFT )
            or IO.PadState.Active( VPAD_BUTTON_RIGHTTRIGGER )
        ) );
        FState := PLAYERVIEW_DONE;
      end;
      if VTIG_Event( VTIG_IE_1 ) then MarkQSlot( FEq[iSelected].Item, 1 );
      if VTIG_Event( VTIG_IE_2 ) then MarkQSlot( FEq[iSelected].Item, 2 );
      if VTIG_Event( VTIG_IE_3 ) then MarkQSlot( FEq[iSelected].Item, 3 );
      if VTIG_Event( VTIG_IE_4 ) then MarkQSlot( FEq[iSelected].Item, 4 );
      if VTIG_Event( VTIG_IE_5 ) then MarkQSlot( FEq[iSelected].Item, 5 );
      if VTIG_Event( VTIG_IE_6 ) then MarkQSlot( FEq[iSelected].Item, 6 );
      if VTIG_Event( VTIG_IE_7 ) then MarkQSlot( FEq[iSelected].Item, 7 );
      if VTIG_Event( VTIG_IE_8 ) then MarkQSlot( FEq[iSelected].Item, 8 );
      if VTIG_Event( VTIG_IE_9 ) then MarkQSlot( FEq[iSelected].Item, 9 );
    end;
  end;
end;

procedure TPlayerView.UpdateCharacter( aActive : Boolean );
var iString : Ansistring;
    iCount  : Integer;
begin
  if FCharacter[0] = nil then ReadCharacter;
  VTIG_BeginWindow(FCTitle, 'character', FSize );
  for iString in FCharacter[0] do
    VTIG_Text( iString );
  for iCount := 1 to High( FCharacter ) do
    if FCharacter[iCount] <> nil then
    begin
      VTIG_Ruler;
      for iString in FCharacter[iCount] do
        VTIG_Text( iString );
    end;
  VTIG_Scrollbar;
  VTIG_End(DRLText('view.hint.panels-scroll-exit', '{l<{!{$input_left},{$input_right}}> panels, <{!{$input_up},{$input_down}}> scroll, <{!{$input_escape}}> exit}'));
end;

procedure TPlayerView.UpdateTraits( aActive : Boolean );
var iSelected : Integer;
    iEntry    : TTraitViewEntry;
begin
  if FTraits = nil then ReadTraits( Player.Klass );
  VTIG_PushStyle( @FTraitsStyle );
  if FTraitMode
    then VTIG_BeginWindow(DRLText('view.traits.choose-upgrade', 'Select trait to upgrade'), 'traits', FSize )
    else VTIG_BeginWindow(DRLText('view.traits.title', 'Traits'), 'traits', FSize );
  VTIG_PopStyle();

  VTIG_BeginGroup( 23 );
    for iEntry in FTraits do
      if iEntry.Available
        then VTIG_Selectable( iEntry.Entry, True, LightRed )
        else VTIG_Selectable( iEntry.Entry, False );
    iSelected := VTIG_Selected;
  VTIG_EndGroup;

  VTIG_BeginGroup;
  if iSelected >= 0 then
  begin
    VTIG_Text('');
    VTIG_Text( FTraits[iSelected].Name, LightRed );
    VTIG_Ruler;
    if FTraits[iSelected].Quote <> '' then
    begin
      VTIG_Text( FTraits[iSelected].Quote, Yellow );
      VTIG_Text( '' );
    end;
    VTIG_Text( FTraits[iSelected].Desc );
    VTIG_Text( '' );
    if FTraits[iSelected].Requires <> '' then
      VTIG_Text( DRLText('view.traits.requires', 'Requires : {0}'),[FTraits[iSelected].Requires] );
    if FTraits[iSelected].Blocks <> '' then
      VTIG_Text( DRLText('view.traits.blocks', 'Blocks   : {0}'),[FTraits[iSelected].Blocks] );
    if FTraits[iSelected].Master then
    begin
      VTIG_Text( '' );
      if ( not FTraitFirst ) and ( Player.Traits.Master > 0 ) then
      begin
        if FTraits[iSelected].Index <> Player.Traits.Master then
          VTIG_Text( DRLText('view.traits.one-master-warning', '{rYou can pick only one {RMaster} trait.}') );
      end
      else
        VTIG_Text( DRLText('view.traits.one-master', 'You can pick only one {!Master} trait.') );
    end;
  end;
  VTIG_EndGroup;

  if FTraitMode
    then VTIG_End(DRLText('view.hint.scroll-select', '{l<{!{$input_up},{$input_down}}> scroll, <{!{$input_ok}}> select}'))
    else VTIG_End(DRLText('view.hint.panels-scroll-exit', '{l<{!{$input_left},{$input_right}}> panels, <{!{$input_up},{$input_down}}> scroll, <{!{$input_escape}}> exit}'));

  if (iSelected >= 0) and FTraitMode and FTraits[iSelected].Available then
    if VTIG_EventConfirm then
    begin
      FState := PLAYERVIEW_CLOSING;
      if FTraitFirst
        then FTraitPick := FTraits[iSelected].Index
        else Player.Traits.Upgrade( Player.Klass, FTraits[iSelected].Index );
      FState := PLAYERVIEW_DONE;
    end;
end;

procedure TPlayerView.PushItem( aItem : TItem; aArray : TItemViewArray );
var iEntry : TItemViewEntry;
    iSet   : AnsiString;
begin
  iEntry.Item  := aItem;
  iEntry.Name  := aItem.PresentationDescription;
  {$IFDEF DRL_WASM}
  if VTIG_Length( iEntry.Name ) > 47 then iEntry.Name := VTIG_Padded(iEntry.Name, 47);
  {$ELSE}
  if Length( iEntry.Name ) > 47 then iEntry.Name := Copy(iEntry.Name, 1, 47 );
  {$ENDIF}
  iEntry.Stats := aItem.PresentationDescriptionBox;
  iEntry.Perks := DRLViewTraitString(aItem, True);
  iEntry.Color := aItem.MenuColor;
  iEntry.QSlot := 0;

  iEntry.Desc  := DRLRegistryText('item', aItem.ID, 'base_game', 'desc',
    AnsiString(LuaSystem.Get(['items',aItem.ID,'desc'], '')));
  if aItem.Flags[ IF_SETITEM ] then
  begin
    iSet        := LuaSystem.Get(['items',aItem.ID,'set']);
    iEntry.Desc := Format('{!%s} (1/%d)', [
      DRLRegistryText('itemset', iSet, 'base_game', 'name',
        AnsiString(LuaSystem.Get(['itemsets',iSet,'name']))),
      Byte( LuaSystem.Get(['itemsets',iSet,'trigger']) ) ])
      + #10+ iEntry.Desc;
  end;
  aArray.Push( iEntry );
end;

procedure TPlayerView.ReadInv;
var iItem  : TItem;
begin
  if FInv = nil then FInv := TItemViewArray.Create;
  FInv.Clear;

  for iItem in Player.Inv do
    if (not Player.Inv.Equipped( iItem )) {and (iItem.IType in aFilter) }then
      PushItem( iItem, FInv );

  Sort( FInv );
  ReadQuickSlots;
end;

procedure TPlayerView.ReadEq;
var iSlot  : TEqSlot;
    iEntry : TItemViewEntry;
begin
  if FEq = nil then FEq := TItemViewArray.Create;
  FEq.Clear;

  for iSlot := Low(TEqSlot) to High(TEqSlot) do
  begin
    if (iSlot = efRelic) and (not ModuleOption_RelicSlot) then Continue;
    if Player.Inv.Slot[iSlot] <> nil
      then PushItem( Player.Inv.Slot[iSlot], FEq )
      else
        begin
          iEntry.Item  := nil;
          iEntry.Name  := DRLViewSlotName(iSlot, SlotName(iSlot));
          iEntry.Stats := '';
          iEntry.Perks := '';
          iEntry.Desc  := '';
          iEntry.Color := DarkGray;
          iEntry.QSlot := 0;
          FEq.Push( iEntry );
        end;
  end;

  ReadQuickSlots;
end;

procedure TPlayerView.ReadTraits( aKlass : Byte );
var iEntry    : TTraitViewEntry;
    iKlass    : Byte;
    iLevel    : Byte;
    iTrait, i : byte;
    iTraits   : Variant;
    iName     : AnsiString;
    iNID      : Word;
    iValue    : Word;
    iSize     : Word;
    iCount    : Word;
    iTable    : TLuaTable;
    iReqLen   : Integer;
const RG : array[Boolean] of Char = ('G','R');
      RL : array[Boolean] of Char = ('L','R');
const MaxReqLength = 38;
  function Value( aTrait : Byte ) : Byte;
  begin
    if FTraitFirst then Exit(0);
    Exit( Player.Traits[aTrait] );
  end;

  procedure AddRequires( aStr : Ansistring );
  var iLS : Integer;
  begin
    iLS := VTIG_Length( aStr );
    if iReqLen + iLS > MaxReqLength then
    begin
      iEntry.Requires += #10+'           ';
      iReqLen := 0;
    end;
    iEntry.Requires += aStr;
    iReqLen += iLS;
  end;
begin
  if FTraits = nil then FTraits := TTraitViewArray.Create;
  FTraits.Clear;

  iKlass := aKlass;
  iLevel := 0;
  if not FTraitFirst then
    iLevel := Player.ExpLevel;

  iTraits := LuaSystem.Get(['klasses',iKlass,'traitlist']);
  for i := VarArrayLowBound(iTraits, 1) to VarArrayHighBound(iTraits, 1) do
  begin
    iTrait := iTraits[ i ];
    iEntry.Value     := Value( iTrait );
    iEntry.Name      := DRLRegistryText('trait', AnsiString(LuaSystem.Get(['traits',iTrait,'id'])), 'base_game', 'name', AnsiString(LuaSystem.Get(['traits',iTrait,'name'])));
    iEntry.Entry     := VTIG_Padded(iEntry.Name,16) +' ({!'+IntToStr(iEntry.Value)+'})';
    with LuaSystem.GetTable(['traits',iTrait]) do
    try
      iEntry.Quote := DRLRegistryText('trait', getString('id'), 'base_game', 'quote', getString('quote'));
      iEntry.Desc  := DRLRegistryText('trait', getString('id'), 'base_game', 'desc', getString('desc'));
    finally
      Free;
    end;

    iReqLen := 0;
    iEntry.Requires := '';
    iEntry.Blocks   := '';
    with LuaSystem.GetTable(['klasses',iKlass,'trait',iTrait]) do
    try
      iEntry.Master:= getBoolean( 'master', False );
      if GetTableSize('requires') > 0 then
      for iTable in ITables('requires') do
      begin
        iNID            := iTable.GetValue( 1 );
        iName           := DRLRegistryText('trait', AnsiString(LuaSystem.Get(['traits',iNID,'id'])), 'base_game', 'name', AnsiString(LuaSystem.Get(['traits',iNID,'name'])));
        iValue          := iTable.GetValue( 2 );
        AddRequires( '{'+RG[Value(iNID) < iValue]+iName+'} ({!'+IntToStr(iValue)+'}), ' );
      end;

      iValue := GetInteger('reqlevel',0);
      if iValue > 0 then iValue += Value(iTrait)*3;
      if iValue > 0 then AddRequires( '{'+RG[iLevel < iValue]+DRLText('view.traits.level-requirement-label', 'Level }({!')+IntToStr(iValue)+'}), ' );
      if Length( iEntry.Requires ) > 0 then
        Delete( iEntry.Requires, Length(iEntry.Requires) - 1, 2 );


      iSize   := GetTableSize('blocks');
      if iSize > 0 then
      begin
        with GetTable('blocks') do
        try
          for iCount := 1 to iSize do
          begin
            iNID          := GetValue( iCount );
            iName         := DRLRegistryText('trait', AnsiString(LuaSystem.Get(['traits',iNID,'id'])), 'base_game', 'name', AnsiString(LuaSystem.Get(['traits',iNID,'name'])));
            iEntry.Blocks += '{'+RL[Value(iNID) > 0]+iName+'}, ';
          end;
        finally
          Free;
        end;
        Delete( iEntry.Blocks, Length(iEntry.Blocks) - 1, 2 );
      end;
    finally
      Free;
    end;

    iEntry.Index     := iTrait;
    if FTraitFirst
      then iEntry.Available := TTraits.CanPickInitially( iTrait, iKlass )
      else iEntry.Available := Player.Traits.CanPick( iKlass, iTrait, iLevel );
    FTraits.Push( iEntry );
  end;
end;

procedure TPlayerView.ReadCharacter;
var iKillRecord   : Integer;
    iDodgeBonus   : Integer;
    iKnockMod     : Integer;
    iLeft, iULeft : DWord;
    i             : Integer;
    iPerks        : TPerkList;
    iName         : Ansistring;
    iMelee        : Boolean;
  function Percent( aCurrent, aMax : Integer ) : Integer;
  begin
    Exit( Floor( ( aCurrent / aMax ) * 100.0 ) );
  end;
begin
  for i := Low( FCharacter ) to High( FCharacter ) do
    FreeAndNil( FCharacter[i] );

  FCTitle := LuaSystem.Get([ 'diff', DRL.Difficulty, 'code' ]);
  if DRL.Challenge <> ''  then FCTitle += ' / ' + LuaSystem.Get(['chal',DRL.Challenge,'abbr']);
  if DRL.SChallenge <> '' then FCTitle += ' + ' + LuaSystem.Get(['chal',DRL.SChallenge,'abbr']);
  FCTitle := DRLText('view.character.title', 'Character ( {{mode}} )', [DRLStringParam('mode', FCTitle)]);

  with Player do
  begin
    Statistics.Update();
    iKillRecord := Statistics['kills_non_damage'];
    if FKills.NoDamageSequence > iKillRecord then iKillRecord := FKills.NoDamageSequence;
    iDodgeBonus := getDodgeMod;
    iKnockMod   := getKnockMod;

    // Section 0: Player
    FCharacter[0] := TStringGArray.Create;
    FCharacter[0].Push( DRLText('view.character.identity', '{!{{name}}} - level {!{{level}}} {{class}}', [DRLStringParam('name', Name), DRLIntegerParam('level', ExpLevel), DRLStringParam('class', DRLRegistryText('klass', AnsiString(LuaSystem.Get(['klasses',Klass,'id'])), 'base_game', 'name', AnsiString(LuaSystem.Get(['klasses',Klass,'name']))))]) );
    if ExpLevel < MaxPlayerLevel - 1
      then FCharacter[0].Push( DRLText('view.character.experience', '  Experience   : {!{{experience}}} ({!{{needed}}} more needed for level {!{{next_level}}})', [DRLIntegerParam('experience', Exp), DRLIntegerParam('needed', ExpTable[ExpLevel+1] - Exp), DRLIntegerParam('next_level', ExpLevel+1)]) )
      else FCharacter[0].Push( DRLText('view.character.experience-max', '  Experience   : {!{{experience}}} ({!max level reached!})', [DRLIntegerParam('experience', Exp)]) );
    FCharacter[0].Push( DRLText('view.character.kills', '  Kills        : {!{{kills}}}/{!{{maximum}}} ({!{{percentage}}%}), spree {!{{spree}}} (record {!{{record}}})', [DRLIntegerParam('kills', Statistics['unique_kills']), DRLIntegerParam('maximum', Statistics['max_unique_kills']), DRLIntegerParam('percentage', Percent( Statistics['unique_kills'], Statistics['max_unique_kills'] )), DRLIntegerParam('spree', FKills.NoDamageSequence), DRLIntegerParam('record', iKillRecord)]) );
    if Statistics['kills'] <> Statistics['unique_kills'] then
      FCharacter[0].Push( DRLText('view.character.total-kills', '  Total kills  : {!{{kills}}}/{!{{maximum}}}', [DRLIntegerParam('kills', Statistics['kills']), DRLIntegerParam('maximum', Statistics['max_kills'])]) );
    FCharacter[0].Push( DRLText('view.character.damage-taken', '  Damage taken : {!{{damage}}} ({!{{floor_damage}}} this floor)', [DRLIntegerParam('damage', Statistics['damage_taken']), DRLIntegerParam('floor_damage', Statistics['damage_on_level'])]) );
    FCharacter[0].Push( DRLText('view.character.game-time', '  Game time    : {!{{turns}}} turns, {!{{seconds}}}s realtime', [DRLIntegerParam('turns', Statistics['game_time']), DRLIntegerParam('seconds', Statistics['real_time'])]) );
    FCharacter[0].Push( '' );

    // Speeds, Accuracy, Bonuses
    iMelee := True;
    if Inv.Slot[efWeapon] <> nil then
      iMelee := not Inv.Slot[efWeapon].isRanged;
    FCharacter[0].Push(
      VTIG_Padded( DRLText('view.character.speeds', '{!Current speeds}'), 26 ) +
      VTIG_Padded( DRLText('view.character.accuracy-heading', '{!Accuracy}'), 24 ) +
      DRLText('view.character.bonuses', '{!Bonuses}') );
    FCharacter[0].Push(
      VTIG_Padded( '  ' + VTIG_Padded(DRLText('view.character.movement', 'Movement'), 8) + ' : {!' + Format('%.2f', [getMoveCost/(Speed*10.0)]) + '}s', 24 ) +
      VTIG_Padded( '    ' + VTIG_Padded(DRLText('view.character.ranged', 'Ranged'), 8) + ' : {!' + toHitPercent(10+getToHit(Inv.Slot[efWeapon], False, False)) + '}', 24 ) +
      '    ' + VTIG_Padded(DRLText('view.character.dodge', 'Dodge'), 9) + ' : {!' + BonusStr(iDodgeBonus) + '%}' );
    FCharacter[0].Push(
      VTIG_Padded( '  ' + VTIG_Padded(Iif(iMelee,DRLText('view.character.attack', 'Attack'),DRLText('view.character.fire', 'Fire')), 8) + ' : {!' + Format('%.2f', [getFireCost( False, iMelee )/(Speed*10.0)]) + '}s/' + IIf(canDualWield,DRLText('view.character.dualshot', 'dualshot'),DRLText('view.character.shot', 'shot')), 24 ) +
      VTIG_Padded( '    ' + VTIG_Padded(DRLText('view.character.melee', 'Melee'), 8) + ' : {!' + toHitPercent(12+getToHit(Inv.Slot[efWeapon], False, True)) + '}', 24 ) +
      '    ' + VTIG_Padded(DRLText('view.character.knockback', 'Knockback'), 9) + ' : {!' + IntToStr(iKnockMod) + '%}' );
    FCharacter[0].Push(
      '  ' + VTIG_Padded(DRLText('view.character.reload', 'Reload'), 8) + ' : {!' + Format('%.2f', [getReloadCost(Inv.Slot[efWeapon])/(Speed*10.0)]) + '}s' );

    // Player perks: status effects
    iPerks := GetPerkList;
    if ( iPerks <> nil ) and ( iPerks.Size > 0 ) then
    begin
      for i := 0 to iPerks.Size - 1 do
        with PerkData[ iPerks[i].ID ] do
        if ( Desc <> '' ) and ( ColorExp <> 0 ) then
        begin
          FCharacter[0].Push( '' );
          FCharacter[0].Push( DRLText('view.effects.status-heading', '{!Status effects}') );
          break;
        end;
      for i := 0 to iPerks.Size - 1 do
        with PerkData[ iPerks[i].ID ] do
        if ( Desc <> '' ) and ( ColorExp <> 0 ) then
        begin
          iName := Name;
          if iName = '' then iName := GetPerkShort( iPerks[i].ID );
          if iPerks[i].Time > 0
            then FCharacter[0].Push( '  {' + VTIG_ColorChar( Color ) + DRLViewPerkName(iPerks[i].ID, iName, Name) + '} ({!' + FloatToStr( iPerks[i].Time / 10 ) + '}s) - ' + DRLViewPerkField(iPerks[i].ID, 'desc', Desc) )
            else FCharacter[0].Push( '  {' + VTIG_ColorChar( Color ) + DRLViewPerkName(iPerks[i].ID, iName, Name) + '} - ' + DRLViewPerkField(iPerks[i].ID, 'desc', Desc) );
        end;

      // Player perks: permanents
      for i := 0 to iPerks.Size - 1 do
        with PerkData[ iPerks[i].ID ] do
        if ( Desc <> '' ) and ( ColorExp = 0 ) then
        begin
          FCharacter[0].Push( '' );
          FCharacter[0].Push( DRLText('view.effects.permanent-heading', '{!Permanents}') );
          break;
        end;
      for i := 0 to iPerks.Size - 1 do
        with PerkData[ iPerks[i].ID ] do
        if ( Desc <> '' ) and ( ColorExp = 0 ) then
          FCharacter[0].Push( '  {' + VTIG_ColorChar( Color ) + DRLViewPerkField(iPerks[i].ID, 'name', Name) + '} - ' + DRLViewPerkField(iPerks[i].ID, 'desc', Desc) );
    end;

    // Section 1: Level
    FCharacter[1] := TStringGArray.Create;
    FCharacter[1].Push( Format( '{!%s}', [ DRLRegistryText('level', DRL.Level.ID, 'base_game', 'name', DRL.Level.Name) ] ) );
    iLeft  := DRL.Level.EnemiesLeft;
    iULeft := DRL.Level.EnemiesLeft( True );
    if iLeft = iULeft
      then FCharacter[1].Push( VTIG_Padded( DRLText('view.level.turns-taken', '  Turns taken  : {!{{turns}}}', [DRLIntegerParam('turns', DRL.Level.LTime)]), 32 ) + DRLText('view.level.enemies-left', 'Enemies left : {!{{enemies}}}', [DRLIntegerParam('enemies', iLeft)]) )
      else FCharacter[1].Push( VTIG_Padded( DRLText('view.level.turns-taken', '  Turns taken  : {!{{turns}}}', [DRLIntegerParam('turns', DRL.Level.LTime)]), 32 ) + DRLText('view.level.enemies-respawned', 'Enemies left : {!{{enemies}}} ({{respawned}} respawned)', [DRLIntegerParam('enemies', iLeft), DRLIntegerParam('respawned', iLeft-iULeft)]) );
    if DRL.Level.Feeling <> '' then
      FCharacter[1].Push( DRLText('view.level.feeling', '  Level feel   : {!{{feeling}}}', [DRLStringParam('feeling', DRLRepeatSemanticFeeling(DRL.Level.Feeling))]) );

    // Level perks
    iPerks := DRL.Level.GetPerkList;
    if ( iPerks <> nil ) and ( iPerks.Size > 0 ) then
    begin
      FCharacter[1].Push( '' );
      for i := 0 to iPerks.Size - 1 do
        with PerkData[ iPerks[i].ID ] do
        if ( Desc <> '' ) then
        begin
          iName := Name;
          if iName = '' then iName := DRL.Level.GetPerkShort( iPerks[i].ID );
          if iPerks[i].Time > 0
            then FCharacter[1].Push( '  {' + VTIG_ColorChar( Color ) + DRLViewPerkName(iPerks[i].ID, iName, Name) + '} ({!' + FloatToStr( iPerks[i].Time / 10 ) + '}s) - ' + DRLViewPerkField(iPerks[i].ID, 'desc', Desc) )
            else FCharacter[1].Push( '  {' + VTIG_ColorChar( Color ) + DRLViewPerkName(iPerks[i].ID, iName, Name) + '} - ' + DRLViewPerkField(iPerks[i].ID, 'desc', Desc) );
        end;
    end;
  end;

end;

procedure TPlayerView.Sort( aList : TItemViewArray );
var iCount  : Integer;
    iCount2 : Integer;
    iTemp   : TItemViewEntry;
begin
  for iCount := 0 to aList.Size - 1 do
    for iCount2 := 0 to aList.Size - iCount - 2 do
      if TItem.Compare(aList[iCount2].Item,aList[iCount2+1].Item) then
      begin
        iTemp := aList[iCount2];
        aList[iCount2] := aList[iCount2+1];
        aList[iCount2+1] := iTemp;
      end;
end;

procedure TPlayerView.Filter( aSet : TItemTypeSet; aUsableOnly : Boolean = False );
var iCount  : Integer;
    iSize   : Integer;
begin
  iSize := 0;
  if FInv = nil then ReadInv;
  if FInv.Size > 0 then
  for iCount := 0 to FInv.Size - 1 do
    if (FInv[ iCount ].Item.IType in aSet) and
       ((not aUsableOnly) or FInv[ iCount ].Item.isUsable) then
    begin
      if iCount <> iSize then
        FInv[ iSize ] := FInv[ iCount ];
      Inc( iSize );
    end;
  FInv.Resize( iSize );
end;

procedure TPlayerView.ReadQuickslots;
var i,s    : Integer;
begin
  if Assigned( FInv ) and ( FInv.Size > 0 ) then
  begin
    for i := 0 to FInv.Size - 1 do
      FInv.Data^[i].QSlot := 0;

    for s := 1 to 9 do
    begin
      if Player.FQuickSlots[s].UID <> 0 then
      begin
        for i := 0 to FInv.Size - 1 do
          if Assigned( FInv.Data^[i].Item ) then
            if FInv.Data^[i].Item.UID = Player.FQuickSlots[s].UID then
              FInv.Data^[i].QSlot := s;
      end
      else if Player.FQuickSlots[s].ID <> '' then
      begin
        for i := 0 to FInv.Size - 1 do
          if Assigned( FInv.Data^[i].Item ) then
            if FInv.Data^[i].Item.ID = Player.FQuickSlots[s].ID then
              FInv.Data^[i].QSlot := s;
      end;
    end;
  end;

  if Assigned( FEq ) and ( FEq.Size > 0 ) then
  begin
    for i := 0 to FEq.Size - 1 do
       FEq.Data^[i].QSlot := 0;

    for s := 1 to 9 do
    begin
      if Player.FQuickSlots[s].UID <> 0 then
      begin
        for i := 0 to FEq.Size - 1 do
          if Assigned( FEq.Data^[i].Item ) then
            if FEq.Data^[i].Item.UID = Player.FQuickSlots[s].UID then
              FEq.Data^[i].QSlot := s;
      end
    end;
  end;
end;

procedure TPlayerView.InitSwapMode( aSlot : TEqSlot );
begin
  VTIG_ResetSelect( 'inventory' );
  FState    := PLAYERVIEW_INVENTORY;
  FSwapMode := True;
  FITitle   := DRLText('view.inventory.choose-wear-wield', 'Select item to wear/wield');
  FAction   := DRLText('view.inventory.action-wear-wield', 'wear/wield');
  Filter( ItemEqFilters[ aSlot ] );
  FSSlot := aSlot;
end;

constructor TUnloadConfirmView.Create( aItem : TItem; aID : Ansistring = '' );
begin
  inherited Create;
  FItem := aItem;
  FID   := aID;
  if FID = ''
    then FMessage := DRLText('view.inventory.ammopack-unload-confirm', 'An ammopack might serve better in the Prepared slot. Continuing will unload the ammo destroying the pack. Are you sure?')
    else FMessage := DRLText('view.inventory.disassemble-confirm', 'Do you want to disassemble the {{item}}?', [DRLStringParam('item', DRLRegistryText('item', FItem.ID, 'base_game', 'name', FItem.Name))]);
  if FID = ''
    then FSize := Point( 50,10 )
    else FSize := Point( 50, 9 );
end;

procedure TUnloadConfirmView.OnConfirm;
begin
  DRL.HandleCommand( TCommand.Create( COMMAND_UNLOAD, FItem, FID ) );
end;

constructor TNoRoomConfirmView.Create( aItem : TItem; aID : Ansistring = '' );
begin
  inherited Create;
  FItem := aItem;
  FConfirm := DRLText('view.inventory.confirm-drop', 'Drop item');
  FCancel  := DRLText('view.confirm.cancel', 'Cancel');
  FMessage := DRLText('view.inventory.no-room-confirm', 'No room in inventory to take off {{item}}, should it be dropped?', [DRLStringParam('item', DRLRegistryText('item', FItem.ID, 'base_game', 'name', FItem.Name))]);
  FSize := Point( 50, 9 );
end;

procedure TNoRoomConfirmView.OnConfirm;
begin
  if FItem.CallHookCheck( Hook_OnUnequipCheck, [ Player, False ] )
    then DRL.HandleCommand( TCommand.Create( COMMAND_DROP, FItem ) );
end;


end.
