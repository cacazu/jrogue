{ Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained. }
{$INCLUDE drl.inc}
{
 ----------------------------------------------------
Copyright (c) 2002-2025 by Kornel Kisielewicz
----------------------------------------------------
}
unit drlconfiguration;
interface
uses vconfiguration;

type TDRLConfiguration = class( TConfigurationManager )
  constructor Create;
end;

var Configuration : TDRLConfiguration;

implementation

uses drlsemantictext, vioevent, drlkeybindings, drlcontrollerbindings;

constructor TDRLConfiguration.Create;
var iGroup : TConfigurationGroup;
    iInput : TInputKey;
    iID    : Ansistring;
const CInputGroups : array[1..7] of Ansistring = (
  'keybindings_movement',
  'keybindings_actions',
  'keybindings_ui',
  'keybindings_running',
  'keybindings_target',
  'keybindings_helper',
  'keybindings_legacy'
);
begin
  inherited Create;

  iGroup := AddGroup( 'meta' );
  iGroup.AddInteger( 'config_version', 0 );

  iGroup := AddGroup( 'general' );
  iGroup.AddToggle( 'first_run', True );
  iGroup.AddToggle( 'skip_intro', False )
    .SetName(DRLText('settings.option.skip_intro.name', 'Skip intro'))
    .SetDescription(DRLText('settings.option.skip_intro.description', 'Setting to {!Enabled} will skip the plot intro text before playing.'))
    ;
  iGroup.AddString( 'default_module', '' )
    .SetName(DRLText('settings.option.default_module.name', 'Default module'))
    .SetDescription(DRLText('settings.option.default_module.description', 'Select module to skip module selection screen on launch, or {!Ask} to ask at launch.'))
    ;

  iGroup := AddGroup( 'display' );
  iGroup.AddInteger( 'display_mode', 0 );
  iGroup.AddInteger( 'screen_width', 0 );
  iGroup.AddInteger( 'screen_height', 0 );

  iGroup.AddToggle( 'fullscreen', True )
    .SetName(DRLText('settings.option.fullscreen.name', 'Fullscreen'))
    .SetDescription(DRLText('settings.option.fullscreen.description', 'Set to {!Disabled} to make the game launch in windowed mode.'))
    ;

  iGroup.AddInteger( 'font_multiplier', 0 )
    .SetRange(0,4)
    .SetNames([DRLText('settings.value.automatic', 'Automatic'),'x1','x2','x3','x4'])
    .SetName(DRLText('settings.option.font_multiplier.name', 'Font size multiplier'))
    .SetDescription(DRLText('settings.option.font_multiplier.description', 'Control font size multiplier. Set to {!Automatic} to pick one based on resolution.'))
    ;

  iGroup.AddInteger( 'tile_multi', 0 )
    .SetRange(0,5)
    .SetNames([DRLText('settings.value.automatic', 'Automatic'),'x1',DRLText('settings.value.tile-fuzzy', 'x1.5(fuzzy)'),'x2','x3','x4'])
    .SetName(DRLText('settings.option.tile_multi.name', 'Tile size multiplier'))
    .SetDescription(DRLText('settings.option.tile_multi.description', 'Control tile size multiplier. Set to {!Automatic} to pick one based on resolution.'))
    ;

  iGroup.AddInteger( 'minimap_multi', 0 )
    .SetRange(0,7)
    .SetNames([DRLText('settings.value.automatic', 'Automatic'),'x1','x2','x3','x4','x6','x8','x10'])
    .SetName(DRLText('settings.option.minimap_multi.name', 'Minimap size multiplier'))
    .SetDescription(DRLText('settings.option.minimap_multi.description', 'Control minimap size multiplier. Set to {!Automatic} to pick one based on resolution.'))
    ;
  iGroup.AddInteger( 'minimap_opacity', 2 )
    .SetRange(0,5)
    .SetName(DRLText('settings.option.minimap_opacity.name', 'Minimap opacity'))
    .SetDescription(DRLText('settings.option.minimap_opacity.description', 'Control minimap opacity. Set to {!0} to disable minimap.'))
    ;
  iGroup.AddToggle( 'screen_shake', True )
    .SetName(DRLText('settings.option.screen_shake.name', 'Screen shake effect'))
    .SetDescription(DRLText('settings.option.screen_shake.description', 'Setting to {!Disabled} will disable screen shake FX.'))
    ;
  iGroup.AddToggle( 'flashing_fx', True )
    .SetName(DRLText('settings.option.flashing_fx.name', 'Screen flashing'))
    .SetDescription(DRLText('settings.option.flashing_fx.description', 'Setting to {!Disabled} will disable screen flash FX.'))
    ;
  iGroup.AddToggle( 'pulse_fx', True )
    .SetName(DRLText('settings.option.pulse_fx.name', 'Blood pulse'))
    .SetDescription(DRLText('settings.option.pulse_fx.description', 'Setting to {!Disabled} will disable pulsing blood vignette.'))
    ;
  iGroup.AddToggle( 'glow_fx', True )
    .SetName(DRLText('settings.option.glow_fx.name', 'Emissive glow'))
    .SetDescription(DRLText('settings.option.glow_fx.description', 'Setting to {!Disabled} will disable glow FX and improve performance.'))
    ;
  iGroup.AddToggle( 'fade_fx', True )
    .SetName(DRLText('settings.option.fade_fx.name', 'Fading effects'))
    .SetDescription(DRLText('settings.option.fade_fx.description', 'Setting to {!Disabled} will disable on level change/exit fading.'))
    ;
  iGroup.AddToggle( 'item_drop_animation', True )
    .SetName(DRLText('settings.option.item_drop_animation.name', 'Item drop animation'))
    .SetDescription(DRLText('settings.option.item_drop_animation.description', 'Setting to {!Disabled} will disable the drop bump animation.'))
    ;

  iGroup := AddGroup( 'audio' );
  iGroup.AddInteger( 'volume_sound', 70 )
    .SetRange(0,100,5)
    .SetName(DRLText('settings.option.volume_sound.name', 'Sound volume'))
    .SetDescription(DRLText('settings.option.volume_sound.description', 'Control sound volume. Set to {!0} to turn off sounds.'))
    ;
  iGroup.AddInteger( 'volume_music', 30 )
    .SetRange(0,100,5)
    .SetName(DRLText('settings.option.volume_music.name', 'Music volume'))
    .SetDescription(DRLText('settings.option.volume_music.description', 'Control music volume. Set to {!0} to turn off music.'))
    ;
  iGroup.AddToggle( 'menu_sound', True )
    .SetName(DRLText('settings.option.menu_sound.name', 'Menu sounds'))
    .SetDescription(DRLText('settings.option.menu_sound.description', 'Set to {!Disabled} to disable the chunky menu sounds.'))
    ;
  iGroup.AddToggle( 'heartbeat_sound', True )
    .SetName(DRLText('settings.option.heartbeat_sound.name', 'Heartbeat'))
    .SetDescription(DRLText('settings.option.heartbeat_sound.description', 'Set to {!Disabled} to disable the low health heartbeat sound.'))
    ;
  iGroup.AddToggle( 'wait_sound', True )
    .SetName(DRLText('settings.option.wait_sound.name', 'Wait sound'))
    .SetDescription(DRLText('settings.option.wait_sound.description', 'Set to {!Disabled} to disable the wait action sound.'))
    ;

  iGroup := AddGroup( 'gameplay' );
  iGroup.AddToggle( 'always_random_name', False )
    .SetName(DRLText('settings.option.always_random_name.name', 'Always random name'))
    .SetDescription( DRLText('settings.option.always_random_name.description', 'Setting to {!Enabled} will skip name entry and always supply a random name.'))
    ;
  iGroup.AddToggle( 'hide_hints', False )
    .SetName(DRLText('settings.option.hide_hints.name', 'Hide hints'))
    .SetDescription(DRLText('settings.option.hide_hints.description', 'Setting to {!Enabled} will hide the hints in the top right corner.'))
    ;
  iGroup.AddToggle( 'run_over_items', False )
    .SetName(DRLText('settings.option.run_over_items.name', 'Run over items'))
    .SetDescription(DRLText('settings.option.run_over_items.description', 'Setting to {!Enabled} will make the run command not stop on items.'))
    ;
  iGroup.AddToggle( 'group_messages', True )
    .SetName(DRLText('settings.option.group_messages.name', 'Group messages'))
    .SetDescription(DRLText('settings.option.group_messages.description', 'Group repeated messages into (x{^3}) combos to save on doing "more...".'))
    ;
  iGroup.AddToggle( 'unlock_all', False )
    .SetName(DRLText('settings.option.unlock_all.name', 'Unlock all unlocks'))
    .SetDescription(DRLText('settings.option.unlock_all.description', 'For returning players so they don''t have to unlock everything again. Otherwise a cheat!'))
    ;

  iGroup := AddGroup( 'input' );
  iGroup.AddToggle( 'empty_confirm', False )
    .SetName(DRLText('settings.option.empty_confirm.name', 'Confirm firing empty weapon'))
    .SetDescription(DRLText('settings.option.empty_confirm.description', 'Setting to {!Enabled} will make the game wait for confirmation if trying to fire an empty weapon'))
    ;
  iGroup.AddToggle( 'enable_mouse', True )
    .SetName(DRLText('settings.option.enable_mouse.name', 'Mouse control'))
    .SetDescription(DRLText('settings.option.enable_mouse.description', 'Setting to {!Disabled} will turn off interaction and visuals of the mouse.'))
    ;
  iGroup.AddToggle( 'mouse_edge_pan', False )
    .SetName(DRLText('settings.option.mouse_edge_pan.name', 'Screen edge mouse scroll'))
    .SetDescription(DRLText('settings.option.mouse_edge_pan.description', 'Setting to {!Enabled} will make the screen scroll if the mouse is at the edge.'))
    ;
  iGroup.AddToggle( 'enable_gamepad', True )
    .SetName(DRLText('settings.option.enable_gamepad.name', 'Gamepad control'))
    .SetDescription(DRLText('settings.option.enable_gamepad.description', 'Setting to {!Disabled} will turn off interaction and visuals of the gamepad.'))
    ;
  iGroup.AddToggle( 'enable_rumble', True )
    .SetName(DRLText('settings.option.enable_rumble.name', 'Gamepad rumble'))
    .SetDescription(DRLText('settings.option.enable_rumble.description', 'Setting to {!Disabled} will turn off gamepad rumble effects.'))
    ;

  iGroup := AddGroup( CONTROLLER_BINDINGS_GAMEPLAY_GROUP );
  RegisterControllerBindings( iGroup );

  iGroup := AddGroup( 'keybindings_hidden' );
  iGroup.AddInteger( 'input_escape', VKEY_ESCAPE );
  iGroup.AddInteger( 'input_ok', VKEY_ENTER );

  for iID in CInputGroups do
  begin
    iGroup := AddGroup( iID );
    for iInput in TInputKey do
      if KeyInfo[ iInput ].Group = iID then
        iGroup.AddInteger( KeyInfo[ iInput ].ID, KeyInfo[ iInput ].Default )
          .SetName(DRLText(KeyInfo[ iInput ].ID + '.name', KeyInfo[ iInput ].Name))
          .SetDescription(DRLText(KeyInfo[ iInput ].ID + '.description', KeyInfo[ iInput ].Description))
          ;
  end;
end;

end.
