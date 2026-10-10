{ Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained. }
{$INCLUDE drl.inc}
{
 ----------------------------------------------------
Copyright (c) 2002-2025 by Kornel Kisielewicz
----------------------------------------------------
}
unit drlhelpview;
interface
uses vutil, viotypes, drlio, drlhelp, dfdata;

type THelpView = class( TIOLayer )
  constructor Create;
  procedure Update( aDTime : Integer; aActive : Boolean ); override;
  function IsFinished : Boolean; override;
  function IsModal : Boolean; override;
  destructor Destroy; override;
protected
  procedure UpdateRead;
  procedure UpdateMenu;
protected
  FMode    : ( HELPVIEW_MENU, HELPVIEW_READ, HELPVIEW_DONE );
  FCurrent : Byte;
  FSize    : TPoint;
  FRect    : TRectangle;
  FList    : THelpArray;
  FEntries : TStringGArray
end;

implementation

uses drlsemantictext, sysutils, vtig, vluasystem;

constructor THelpView.Create;
var iTable : TLuaTable;
begin
  VTIG_EventClear;
  VTIG_ResetSelect( 'help_view' );

  FSize    := Point( 80, 25 );
  FMode    := HELPVIEW_MENU;
  FCurrent := 0;

  FList    := THelpArray.Create( False );
  FEntries := TStringGArray.Create;

  if not LuaSystem.Defined([CoreModuleID,'help']) then Exit;
  with LuaSystem.GetTable([CoreModuleID]) do
  try
    for iTable in ITables('help') do
    begin
      FList.Push( Help[iTable.GetValue(1)] );
      FEntries.Push( iTable.GetValue(2) );
    end;
  finally
    Free;
  end;
end;

procedure THelpView.Update( aDTime : Integer; aActive : Boolean );
begin
       if FMode = HELPVIEW_MENU then UpdateMenu
  else if FMode = HELPVIEW_READ then UpdateRead;
end;

function THelpView.IsFinished : Boolean;
begin
  Exit( FMode = HELPVIEW_DONE );
end;

function THelpView.IsModal : Boolean;
begin
  Exit( True );
end;

destructor THelpView.Destroy;
begin
  FreeAndNil( FList );
  FreeAndNil( FEntries );
end;

procedure THelpView.UpdateRead;
var iBlock : Integer;
begin
  VTIG_BeginWindow( FList[FCurrent].PresentationTitle(FEntries[FCurrent]), 'help_view_read', FSize );
  for iBlock := 0 to FList[FCurrent].PresentationBlockCount - 1 do
    VTIG_Text(FList[FCurrent].PresentationBlockText(iBlock));
  VTIG_Scrollbar;
  FRect := VTIG_GetWindowRect;
  VTIG_End(DRLText('help.hint.read', '{l<{!{$input_up},{$input_down}}> scroll, <{!{$input_ok},{$input_escape}}> return}'));
  if VTIG_EventCancel or VTIG_EventConfirm then
    FMode := HELPVIEW_MENU;
end;

procedure THelpView.UpdateMenu;
var i,iSelect : Integer;

begin
  if FList.Size = 0 then
  begin
    FMode := HELPVIEW_DONE;
    Exit;
  end;
  VTIG_BeginWindow( DRLText('help.title', 'Help topics'), 'help_view', FSize );
  iSelect := 0;

  for i := 1 to FList.Size-1 do
    if VTIG_Selectable( '      '+FList[i].PresentationTitle(FEntries[i]) ) then
       iSelect := i;
  if VTIG_Selectable(   '      '+DRLText('help.exit', 'Quit help') ) then
     FMode := HELPVIEW_DONE;

  VTIG_Ruler;

  if IO.IsGamepad then
  begin
    VTIG_Text(DRLText('help.primer.controller.title', 'Select help topic above. Quick controls primer:'));
    VTIG_Text('');
    VTIG_Text(DRLText('help.primer.controller.move', 'Movement is done by moving the {!Left Stick} to the desired direction and confirming it with the {!{$controller_gameplay_move}} button.'));
    VTIG_Text(DRLText('help.primer.controller.move-modifier', '  {!{$controller_gameplay_move|5}} -- move ( with {!{$controller_gameplay_modifier_alt}} held - move targeting reticule )') );
    VTIG_Text(DRLText('help.primer.controller.action', '  {!{$controller_gameplay_action|5}} -- pickup item or activate stairs/lever'));
    VTIG_Text(DRLText('help.primer.controller.ground', '           + with {!{$controller_gameplay_modifier_alt}} held - use item from ground'));
    VTIG_Text(DRLText('help.primer.controller.direction', '           + {!LStick} direction - direction of action (open/close door)'));
    VTIG_Text(DRLText('help.primer.controller.fire', '  {!{$controller_gameplay_fire|5}} -- fire ( with {!{$controller_gameplay_modifier_alt}} held - alt-fire )') );
    VTIG_Text(DRLText('help.primer.controller.reload', '  {!{$controller_gameplay_reload|5}} -- reload ( with {!{$controller_gameplay_modifier_alt}} held - alt-reload )') );
    VTIG_Text(DRLText('help.primer.controller.player', '  {!{$controller_gameplay_player|5}} -- character screens (inventory, etc)') );
    VTIG_Text(DRLText('help.primer.controller.more', '  ...      -- see "Gamepad controls" entry for the rest'));
  end
  else
  begin
    VTIG_Text(DRLText('help.primer.keyboard.title', 'Select help topic above. Quick (default) keybindings primer:'));
    VTIG_Text('');
    VTIG_Text(DRLText('help.primer.keyboard.menu', '  {!Escape}    - game menu (Save, Quit, Settings, Help, etc)'));
    VTIG_Text(DRLText('help.primer.keyboard.move', '  {!Arrows}    - movement (Home,End,PgUp,PgDown - diagonals)'));
    VTIG_Text(DRLText('help.primer.keyboard.wait', '  {!W}         - wait (pass turn)'));
    VTIG_Text(DRLText('help.primer.keyboard.action', '  {!SPACE}     - action (open,close,press button,descend stairs)'));
    VTIG_Text(DRLText('help.primer.keyboard.player', '  {!I},{!E},{!P},{!T}   - inventory, equipment etc (left/right to switch while open)'));
    VTIG_Text(DRLText('help.primer.keyboard.fire', '  {!F}         - fire weapon (SHIFT for alternative mode)'));
    VTIG_Text(DRLText('help.primer.keyboard.reload', '  {!R}         - reload weapon (SHIFT for alternative mode)'));
    VTIG_Text(DRLText('help.primer.keyboard.ground', '  {!G}         - get item (pickup) from floor (SHIFT to use)'));
    VTIG_Text(DRLText('help.primer.keyboard.more', '  ...          see "Controls" entry for the rest'));
  end;

  FRect := VTIG_GetWindowRect;
  VTIG_End(DRLText('help.hint.menu', '{l<{!{$input_up},{$input_down}}> select, <{!{$input_ok}}> open, <{!{$input_escape}}> exit}'));
  if iSelect > 0 then
  begin
    VTIG_ResetScroll( 'help_view_read' );
    FMode    := HELPVIEW_READ;
    FCurrent := iSelect;
  end;

  if VTIG_EventCancel then
     FMode := HELPVIEW_DONE;
end;

end.

