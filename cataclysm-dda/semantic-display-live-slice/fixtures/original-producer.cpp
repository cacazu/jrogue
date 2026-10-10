// Actual original help::load/reset and raw-binding helper fixture; uncompiled source preparation.
// No replacement JsonObject/translation/help loader or original matching function is permitted.
#include "help.h"
#include "cdda_help_semantic.h"
#include "json_loader.h"
#include "flexbuffer_json.h"
#include "json.h"
#include "path_info.h"
#include <stdexcept>
#include <string>

// Original production translation style-check flag, disabled for this focused data fixture.
// All translation parsing/comparison behavior remains from the actual original objects.
bool test_mode = false;
namespace {
void require( bool value ) { if( !value ) { throw std::runtime_error( "original help fixture assertion" ); } }
void load_topic( const char *json, const cata_path &file ) {
    const JsonObject object = json_loader::from_string( json ).get_object();
    help::load( object, "focused-original-loader-fixture", cata_path(), file );
}
}
extern "C" int cdda_original_help_fixture_run() {
    int checks = 0;
    PATH_INFO::init_base_path( "" );
    PATH_INFO::init_user_dir( "/tmp/cdda-focused-help-not-a-native-save" );
    PATH_INFO::set_standard_filenames();
    Json::globally_report_unvisited_members( false );
    const cata_path official = PATH_INFO::jsondir() / "help.json";
    help::reset();
    load_topic( R"cdda_json({"type":"help","order":1,"name":"Movement","messages":["Movement is performed using the numpad, the arrow keys, or vikeys.","<HELP_DRAW_DIRECTIONS>","Each step will take 100 movement points (or more, depending on the terrain); you will then replenish a variable amount of movement points, depending on many factors (press <press_player_data> to see the exact amount).","To attempt to hit a monster with your weapon, simply move into it.","You may find doors, ('+'); these may be opened with <press_open> or closed with <press_close>.  Some doors are locked.  Locked doors, windows, and some other obstacles can be destroyed by smashing them (<press_smash>, then choose a direction).  Smashing down obstacles is much easier with a good weapon or a strong character.","There may be times when you want to move more quickly by holding down a movement key.  However, fast movement in this fashion may lead to the player getting into a dangerous situation or even killed before they have a chance to react.  Pressing <press_safemode> will toggle \"safe mode.\"  While this is on, any movement will be ignored if new monsters enter the player's view."]})cdda_json", official );
    const auto captured = get_help().observe_loaded_topic( 1 );
    require( captured.has_value() ); ++checks;
    require( captured->name_id == "help.core.movement.name" ); ++checks;
    require( captured->message_ids[0] == "help.core.movement.controls" ); ++checks;
    require( !captured->message_ids[1].has_value() ); ++checks;
    require( captured->message_ids[4] == "help.core.movement.doors" ); ++checks;
    require( captured->loaded_source == "focused-original-loader-fixture" ); ++checks;
    require( captured->loaded_file == official.generic_u8string() ); ++checks;
    auto copy = captured; copy->name_id = "external-mutation";
    require( get_help().observe_loaded_topic( 1 )->name_id == "help.core.movement.name" ); ++checks;
    bool duplicate = false;
    try { load_topic( R"cdda_json({"type":"help","order":1,"name":"Movement","messages":["Movement is performed using the numpad, the arrow keys, or vikeys.","<HELP_DRAW_DIRECTIONS>","Each step will take 100 movement points (or more, depending on the terrain); you will then replenish a variable amount of movement points, depending on many factors (press <press_player_data> to see the exact amount).","To attempt to hit a monster with your weapon, simply move into it.","You may find doors, ('+'); these may be opened with <press_open> or closed with <press_close>.  Some doors are locked.  Locked doors, windows, and some other obstacles can be destroyed by smashing them (<press_smash>, then choose a direction).  Smashing down obstacles is much easier with a good weapon or a strong character.","There may be times when you want to move more quickly by holding down a movement key.  However, fast movement in this fashion may lead to the player getting into a dangerous situation or even killed before they have a chance to react.  Pressing <press_safemode> will toggle \"safe mode.\"  While this is on, any movement will be ignored if new monsters enter the player's view."]})cdda_json", official ); } catch( const JsonError & ) { duplicate = true; }
    require( duplicate ); ++checks;
    help::reset(); require( !get_help().observe_loaded_topic( 1 ).has_value() ); ++checks;
    load_topic( R"cdda_json({"type":"help","order":1,"name":"Movement","messages":["Movement is performed using the numpad, the arrow keys, or vikeys.","<HELP_DRAW_DIRECTIONS>","Each step will take 100 movement points (or more, depending on the terrain); you will then replenish a variable amount of movement points, depending on many factors (press <press_player_data> to see the exact amount).","To attempt to hit a monster with your weapon, simply move into it.","You may find doors, ('+'); these may be opened with <press_open> or closed with <press_close>.  Some doors are locked.  Locked doors, windows, and some other obstacles can be destroyed by smashing them (<press_smash>, then choose a direction).  Smashing down obstacles is much easier with a good weapon or a strong character.","There may be times when you want to move more quickly by holding down a movement key.  However, fast movement in this fashion may lead to the player getting into a dangerous situation or even killed before they have a chance to react.  Pressing <press_safemode> will toggle \"safe mode.\"  While this is on, any movement will be ignored if new monsters enter the player's view."]})cdda_json", PATH_INFO::jsondir() / "mod-help.json" );
    require( !get_help().observe_loaded_topic( 1 ).has_value() ); ++checks;
    help::reset(); load_topic( R"cdda_json({"type":"help","order":1,"name":"Movement","messages":["Movement is performed using the numpad, the arrow keys, or vikeys. changed","<HELP_DRAW_DIRECTIONS>","Each step will take 100 movement points (or more, depending on the terrain); you will then replenish a variable amount of movement points, depending on many factors (press <press_player_data> to see the exact amount).","To attempt to hit a monster with your weapon, simply move into it.","You may find doors, ('+'); these may be opened with <press_open> or closed with <press_close>.  Some doors are locked.  Locked doors, windows, and some other obstacles can be destroyed by smashing them (<press_smash>, then choose a direction).  Smashing down obstacles is much easier with a good weapon or a strong character.","There may be times when you want to move more quickly by holding down a movement key.  However, fast movement in this fashion may lead to the player getting into a dangerous situation or even killed before they have a chance to react.  Pressing <press_safemode> will toggle \"safe mode.\"  While this is on, any movement will be ignored if new monsters enter the player's view."]})cdda_json", official );
    require( !get_help().observe_loaded_topic( 1 ).has_value() ); ++checks;
    help::reset(); load_topic( R"cdda_json({"type":"help","order":1,"name":{"str":"Movement","ctxt":"foreign-topic-context"},"messages":["Movement is performed using the numpad, the arrow keys, or vikeys.","<HELP_DRAW_DIRECTIONS>","Each step will take 100 movement points (or more, depending on the terrain); you will then replenish a variable amount of movement points, depending on many factors (press <press_player_data> to see the exact amount).","To attempt to hit a monster with your weapon, simply move into it.","You may find doors, ('+'); these may be opened with <press_open> or closed with <press_close>.  Some doors are locked.  Locked doors, windows, and some other obstacles can be destroyed by smashing them (<press_smash>, then choose a direction).  Smashing down obstacles is much easier with a good weapon or a strong character.","There may be times when you want to move more quickly by holding down a movement key.  However, fast movement in this fashion may lead to the player getting into a dangerous situation or even killed before they have a chance to react.  Pressing <press_safemode> will toggle \"safe mode.\"  While this is on, any movement will be ignored if new monsters enter the player's view."]})cdda_json", official );
    require( !get_help().observe_loaded_topic( 1 ).has_value() ); ++checks;
    help::reset();
    { const JsonObject object = json_loader::from_string( R"cdda_json({"type":"keybinding","id":"UP","name":"Pan up","bindings":[{"input_method":"keyboard_any","key":"k"},{"input_method":"keyboard_any","key":"UP"},{"input_method":"keyboard_any","key":"8"},{"input_method":"keyboard_code","key":"KEYPAD_8"},{"input_method":"gamepad","key":"JOY_UP"}]})cdda_json" ).get_object();
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::keybindings(), false, "default", "UP", object ) == "input.keybinding.default.up.name" ); ++checks;
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::keybindings(), true, "default", "UP", object ).empty() ); ++checks;
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::jsondir() / "foreign-keybindings.json", false, "default", "UP", object ).empty() ); ++checks; }
    { const JsonObject object = json_loader::from_string( R"cdda_json({"type":"keybinding","id":"UP","category":"PICKUP","name":"Previous item","bindings":[{"input_method":"keyboard_any","key":"k"},{"input_method":"keyboard_any","key":"UP"},{"input_method":"gamepad","key":"JOY_UP"}]})cdda_json" ).get_object();
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::keybindings(), false, "PICKUP", "UP", object ) == "input.keybinding.pickup.up.name" ); ++checks;
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::keybindings(), true, "PICKUP", "UP", object ).empty() ); ++checks;
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::jsondir() / "foreign-keybindings.json", false, "PICKUP", "UP", object ).empty() ); ++checks; }
    { const JsonObject object = json_loader::from_string( R"cdda_json({"type":"keybinding","id":"UP","category":"BIONICS","name":"Move cursor up","bindings":[{"input_method":"keyboard_any","key":"8"},{"input_method":"keyboard_code","key":"KEYPAD_8"},{"input_method":"keyboard_any","key":"UP"},{"input_method":"gamepad","key":"JOY_UP"}]})cdda_json" ).get_object();
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::keybindings(), false, "BIONICS", "UP", object ) == "input.keybinding.bionics.up.name" ); ++checks;
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::keybindings(), true, "BIONICS", "UP", object ).empty() ); ++checks;
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::jsondir() / "foreign-keybindings.json", false, "BIONICS", "UP", object ).empty() ); ++checks; }
    { const JsonObject object = json_loader::from_string( R"cdda_json({"type":"keybinding","name":"Pause","category":"DEFAULTMODE","id":"pause","bindings":[{"input_method":"keyboard_any","key":"."},{"input_method":"keyboard_code","key":"KEYPAD_PERIOD"},{"input_method":"keyboard_any","key":"5"},{"input_method":"keyboard_code","key":"KEYPAD_5"},{"input_method":"gamepad","key":"JOY_7"}]})cdda_json" ).get_object();
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::keybindings(), false, "DEFAULTMODE", "pause", object ) == "input.keybinding.default_mode.pause.name" ); ++checks;
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::keybindings(), true, "DEFAULTMODE", "pause", object ).empty() ); ++checks;
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::jsondir() / "foreign-keybindings.json", false, "DEFAULTMODE", "pause", object ).empty() ); ++checks; }
    { const JsonObject object = json_loader::from_string( R"cdda_json({"type":"keybinding","name":"Pick up items from one nearby tile","category":"DEFAULTMODE","id":"pickup","bindings":[{"input_method":"keyboard_any","key":"g"}]})cdda_json" ).get_object();
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::keybindings(), false, "DEFAULTMODE", "pickup", object ) == "input.keybinding.default_mode.pickup.name" ); ++checks;
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::keybindings(), true, "DEFAULTMODE", "pickup", object ).empty() ); ++checks;
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::jsondir() / "foreign-keybindings.json", false, "DEFAULTMODE", "pickup", object ).empty() ); ++checks; }
    { const JsonObject object = json_loader::from_string( R"cdda_json({"type":"keybinding","name":"Open inventory","category":"DEFAULTMODE","id":"inventory","bindings":[{"input_method":"keyboard_any","key":"i"},{"input_method":"gamepad","key":"JOY_5"}]})cdda_json" ).get_object();
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::keybindings(), false, "DEFAULTMODE", "inventory", object ) == "input.keybinding.default_mode.inventory.name" ); ++checks;
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::keybindings(), true, "DEFAULTMODE", "inventory", object ).empty() ); ++checks;
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::jsondir() / "foreign-keybindings.json", false, "DEFAULTMODE", "inventory", object ).empty() ); ++checks; }
    { const JsonObject object = json_loader::from_string( R"cdda_json({"type":"keybinding","name":"View help","category":"DEFAULTMODE","id":"help","bindings":[{"input_method":"keyboard_any","key":"0"},{"input_method":"keyboard_code","key":"KEYPAD_0"}]})cdda_json" ).get_object();
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::keybindings(), false, "DEFAULTMODE", "help", object ) == "input.keybinding.default_mode.help.name" ); ++checks;
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::keybindings(), true, "DEFAULTMODE", "help", object ).empty() ); ++checks;
      require( cdda_help_semantic::bind_keybinding_name( PATH_INFO::jsondir() / "foreign-keybindings.json", false, "DEFAULTMODE", "help", object ).empty() ); ++checks; }

    return checks;
}
