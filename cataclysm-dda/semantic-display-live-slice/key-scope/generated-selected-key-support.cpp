// Fixture-only selected original support, not complete original translation units.
// CC BY-SA 3.0; pinned upstream 0.I-1. Unexpected diagnostic leaves still abort.
#include "../fixtures/generated-original-support.cpp"
#include "action.h"
#include "input_context.h"
#include "filesystem.h"
#include "path_info.h"
#include <istream>
#include <map>
#include <set>
#include <string>
static void parse_keymap( std::istream &, std::map<char, action_id> &, std::set<action_id> & );
static int inputdelay;

void load_keyboard_settings( std::map<char, action_id> &keymap,
                             std::string &keymap_file_loaded_from,
                             std::set<action_id> &unbound_keymap )
{
    const auto parser = [&]( std::istream & fin ) {
        parse_keymap( fin, keymap, unbound_keymap );
    };
    if( read_from_file_optional( PATH_INFO::keymap(), parser ) ) {
        keymap_file_loaded_from = PATH_INFO::keymap();
    }
}

void parse_keymap( std::istream &keymap_txt, std::map<char, action_id> &kmap,
                   std::set<action_id> &unbound_keymap )
{
    while( !keymap_txt.eof() ) {
        std::string id;
        keymap_txt >> id;
        if( id.empty() || id[0] == '#' ) {
            // Empty line or comment, chomp it
            getline( keymap_txt, id );
        } else if( id == "unbind" ) {
            keymap_txt >> id;
            const action_id act = look_up_action( id );
            if( act != ACTION_NULL ) {
                unbound_keymap.insert( act );
            }
            break;
        } else {
            const action_id act = look_up_action( id );
            if( act == ACTION_NULL ) {
                debugmsg( "Warning!  keymap.txt contains an unknown action, \"%s\"\n"
                          "Fix \"%s\" at your next chance!", id, PATH_INFO::keymap() );
            } else {
                while( !keymap_txt.eof() ) {
                    char ch;
                    keymap_txt >> std::noskipws >> ch >> std::skipws;
                    if( ch == '\n' ) {
                        break;
                    } else if( ch != ' ' || keymap_txt.peek() == '\n' ) {
                        if( kmap.find( ch ) != kmap.end() ) {
                            debugmsg( "Warning!  '%c' assigned twice in the keymap!\n"
                                      "%s is being ignored.\n"
                                      "Fix \"%s\" at your next chance!", ch, id, PATH_INFO::keymap() );
                        } else {
                            kmap[ ch ] = act;
                        }
                    }
                }
            }
        }
    }
}

std::string action_ident( action_id act )
{
    switch( act ) {
        case ACTION_PAUSE:
            return "pause";
        case ACTION_TIMEOUT:
            return "TIMEOUT";
        case ACTION_MOVE_FORTH:
            return "UP";
        case ACTION_MOVE_FORTH_RIGHT:
            return "RIGHTUP";
        case ACTION_MOVE_RIGHT:
            return "RIGHT";
        case ACTION_MOVE_BACK_RIGHT:
            return "RIGHTDOWN";
        case ACTION_MOVE_BACK:
            return "DOWN";
        case ACTION_MOVE_BACK_LEFT:
            return "LEFTDOWN";
        case ACTION_MOVE_LEFT:
            return "LEFT";
        case ACTION_MOVE_FORTH_LEFT:
            return "LEFTUP";
        case ACTION_MOVE_DOWN:
            return "LEVEL_DOWN";
        case ACTION_MOVE_UP:
            return "LEVEL_UP";
        case ACTION_TOGGLE_MAP_MEMORY:
            return "toggle_map_memory";
        case ACTION_CENTER:
            return "center";
        case ACTION_SHIFT_N:
            return "shift_n";
        case ACTION_SHIFT_NE:
            return "shift_ne";
        case ACTION_SHIFT_E:
            return "shift_e";
        case ACTION_SHIFT_SE:
            return "shift_se";
        case ACTION_SHIFT_S:
            return "shift_s";
        case ACTION_SHIFT_SW:
            return "shift_sw";
        case ACTION_SHIFT_W:
            return "shift_w";
        case ACTION_SHIFT_NW:
            return "shift_nw";
        case ACTION_CYCLE_MOVE:
            return "cycle_move";
        case ACTION_CYCLE_MOVE_REVERSE:
            return "cycle_move_reverse";
        case ACTION_RESET_MOVE:
            return "reset_move";
        case ACTION_TOGGLE_RUN:
            return "toggle_run";
        case ACTION_TOGGLE_CROUCH:
            return "toggle_crouch";
        case ACTION_TOGGLE_PRONE:
            return "toggle_prone";
        case ACTION_OPEN_MOVEMENT:
            return "open_movement";
        case ACTION_OPEN:
            return "open";
        case ACTION_CLOSE:
            return "close";
        case ACTION_SMASH:
            return "smash";
        case ACTION_EXAMINE:
            return "examine";
        case ACTION_EXAMINE_AND_PICKUP:
            return "examine_and_pickup";
        case ACTION_ADVANCEDINV:
            return "advinv";
        case ACTION_PICKUP:
            return "pickup";
        case ACTION_PICKUP_ALL:
            return "pickup_all";
        case ACTION_GRAB:
            return "grab";
        case ACTION_HAUL:
            return "haul";
        case ACTION_HAUL_TOGGLE:
            return "haul_toggle";
        case ACTION_BUTCHER:
            return "butcher";
        case ACTION_CHAT:
            return "chat";
        case ACTION_LOOK:
            return "look";
        case ACTION_PEEK:
            return "peek";
        case ACTION_LIST_ITEMS:
            return "listitems";
        case ACTION_ZONES:
            return "zones";
        case ACTION_LOOT:
            return "loot";
        case ACTION_INVENTORY:
            return "inventory";
        case ACTION_COMPARE:
            return "compare";
        case ACTION_ORGANIZE:
            return "organize";
        case ACTION_USE:
            return "apply";
        case ACTION_USE_WIELDED:
            return "apply_wielded";
        case ACTION_WEAR:
            return "wear";
        case ACTION_TAKE_OFF:
            return "take_off";
        case ACTION_EAT:
            return "eat";
        case ACTION_OPEN_CONSUME:
            return "open_consume";
        case ACTION_READ:
            return "read";
        case ACTION_WIELD:
            return "wield";
        case ACTION_PICK_STYLE:
            return "pick_style";
        case ACTION_RELOAD_ITEM:
            return "reload_item";
        case ACTION_RELOAD_WEAPON:
            return "reload_weapon";
        case ACTION_RELOAD_WIELDED:
            return "reload_wielded";
        case ACTION_INSERT_ITEM:
            return "insert";
        case ACTION_UNLOAD:
            return "unload";
        case ACTION_MEND:
            return "mend";
        case ACTION_THROW:
            return "throw";
        case ACTION_THROW_WIELDED:
            return "throw_wielded";
        case ACTION_FIRE:
            return "fire";
        case ACTION_FIRE_BURST:
            return "fire_burst";
        case ACTION_CAST_SPELL:
            return "cast_spell";
        case ACTION_RECAST_SPELL:
            return "recast_spell";
        case ACTION_SELECT_FIRE_MODE:
            return "select_fire_mode";
        case ACTION_SELECT_DEFAULT_AMMO:
            return "select_default_ammo";
        case ACTION_UNLOAD_CONTAINER:
            return "unload_container";
        case ACTION_DROP:
            return "drop";
        case ACTION_DIR_DROP:
            return "drop_adj";
        case ACTION_BIONICS:
            return "bionics";
        case ACTION_MUTATIONS:
            return "mutations";
        case ACTION_SORT_ARMOR:
            return "sort_armor";
        case ACTION_WAIT:
            return "wait";
        case ACTION_CRAFT:
            return "craft";
        case ACTION_RECRAFT:
            return "recraft";
        case ACTION_LONGCRAFT:
            return "long_craft";
        case ACTION_CONSTRUCT:
            return "construct";
        case ACTION_DISASSEMBLE:
            return "disassemble";
        case ACTION_SLEEP:
            return "sleep";
        case ACTION_CONTROL_VEHICLE:
            return "control_vehicle";
        case ACTION_TOGGLE_AUTO_TRAVEL_MODE:
            return "auto_travel_mode";
        case ACTION_TOGGLE_SAFEMODE:
            return "safemode";
        case ACTION_TOGGLE_AUTOSAFE:
            return "autosafe";
        case ACTION_TOGGLE_THIEF_MODE:
            return "toggle_thief_mode";
        case ACTION_TOGGLE_LANGUAGE_TO_EN:
            return "toggle_language_to_en";
        case ACTION_IGNORE_ENEMY:
            return "ignore_enemy";
        case ACTION_WHITELIST_ENEMY:
            return "whitelist_enemy";
        case ACTION_WORKOUT:
            return "workout";
        case ACTION_SAVE:
            return "save";
        case ACTION_QUICKSAVE:
            return "quicksave";
        case ACTION_QUICKLOAD:
            return "quickload";
        case ACTION_SUICIDE:
            return "SUICIDE";
        case ACTION_PL_INFO:
            return "player_data";
        case ACTION_MAP:
            return "map";
        case ACTION_SKY:
            return "sky";
        case ACTION_MISSIONS:
            return "missions";
        case ACTION_FACTIONS:
            return "factions";
        case ACTION_MEDICAL:
            return "medical";
        case ACTION_BODYSTATUS:
            return "bodystatus";
        case ACTION_MORALE:
            return "morale";
        case ACTION_MESSAGES:
            return "messages";
        case ACTION_HELP:
            return "help";
        case ACTION_DEBUG:
            return "debug";
        case ACTION_DISPLAY_NPC_ATTACK_POTENTIAL:
            return "debug_npc_attack_potential";
        case ACTION_TOGGLE_HOUR_TIMER:
            return "debug_hour_timer";
        case ACTION_TOGGLE_DEBUG_MODE:
            return "debug_mode";
        case ACTION_ZOOM_OUT:
            return "zoom_out";
        case ACTION_ZOOM_IN:
            return "zoom_in";
        case ACTION_TOGGLE_FULLSCREEN:
            return "toggle_fullscreen";
        case ACTION_TOGGLE_PIXEL_MINIMAP:
            return "toggle_pixel_minimap";
        case ACTION_TOGGLE_PANEL_ADM:
            return "toggle_panel_adm";
        case ACTION_PANEL_MGMT:
            return "panel_mgmt";
        case ACTION_RELOAD_TILESET:
            return "reload_tileset";
        case ACTION_TOGGLE_AUTO_FEATURES:
            return "toggle_auto_features";
        case ACTION_TOGGLE_AUTO_PULP_BUTCHER:
            return "toggle_auto_pulp_butcher";
        case ACTION_TOGGLE_AUTO_MINING:
            return "toggle_auto_mining";
        case ACTION_TOGGLE_AUTO_FORAGING:
            return "toggle_auto_foraging";
        case ACTION_TOGGLE_AUTO_PICKUP:
            return "toggle_auto_pickup";
        case ACTION_TOGGLE_PREVENT_OCCLUSION:
            return "toggle_prevent_occlusion";
        case ACTION_ACTIONMENU:
            return "action_menu";
        case ACTION_ITEMACTION:
            return "item_action_menu";
        case ACTION_SELECT:
            return "SELECT";
        case ACTION_SEC_SELECT:
            return "SEC_SELECT";
        case ACTION_CLICK_AND_DRAG:
            return "CLICK_AND_DRAG";
        case ACTION_AUTOATTACK:
            return "autoattack";
        case ACTION_MAIN_MENU:
            return "main_menu";
        case ACTION_DIARY:
            return "diary";
        case ACTION_KEYBINDINGS:
            return "HELP_KEYBINDINGS";
        case ACTION_OPTIONS:
            return "open_options";
        case ACTION_AUTOPICKUP:
            return "open_autopickup";
        case ACTION_AUTONOTES:
            return "open_autonotes";
        case ACTION_SAFEMODE:
            return "open_safemode";
        case ACTION_COLOR:
            return "open_color";
        case ACTION_WORLD_MODS:
            return "open_world_mods";
        case ACTION_DISTRACTION_MANAGER:
            return "open_distraction_manager";
        case ACTION_NULL:
            return "null";
        default:
            return "unknown";
    }
}

action_id look_up_action( const std::string &ident )
{
    // Temporarily for the interface with the input manager!
    if( ident == "move_nw" ) {
        return ACTION_MOVE_FORTH_LEFT;
    } else if( ident == "move_sw" ) {
        return ACTION_MOVE_BACK_LEFT;
    } else if( ident == "move_ne" ) {
        return ACTION_MOVE_FORTH_RIGHT;
    } else if( ident == "move_se" ) {
        return ACTION_MOVE_BACK_RIGHT;
    } else if( ident == "move_n" ) {
        return ACTION_MOVE_FORTH;
    } else if( ident == "move_s" ) {
        return ACTION_MOVE_BACK;
    } else if( ident == "move_w" ) {
        return ACTION_MOVE_LEFT;
    } else if( ident == "move_e" ) {
        return ACTION_MOVE_RIGHT;
    } else if( ident == "move_down" ) {
        return ACTION_MOVE_DOWN;
    } else if( ident == "move_up" ) {
        return ACTION_MOVE_UP;
    }
    // ^^ Temporarily for the interface with the input manager!
    for( int i = 0; i < NUM_ACTIONS; i++ ) {
        if( action_ident( static_cast<action_id>( i ) ) == ident ) {
            return static_cast<action_id>( i );
        }
    }
    return ACTION_NULL;
}

input_context get_default_mode_input_context()
{
    input_context ctxt( "DEFAULTMODE", keyboard_mode::keycode );
    // Because those keys move the character, they don't pan, as their original name says
    ctxt.set_iso( true );
    ctxt.register_action( "UP", to_translation( "Move north" ) );
    ctxt.register_action( "RIGHTUP", to_translation( "Move northeast" ) );
    ctxt.register_action( "RIGHT", to_translation( "Move east" ) );
    ctxt.register_action( "RIGHTDOWN", to_translation( "Move southeast" ) );
    ctxt.register_action( "DOWN", to_translation( "Move south" ) );
    ctxt.register_action( "LEFTDOWN", to_translation( "Move southwest" ) );
    ctxt.register_action( "LEFT", to_translation( "Move west" ) );
    ctxt.register_action( "LEFTUP", to_translation( "Move northwest" ) );
    ctxt.register_action( "pause" );
    ctxt.register_action( "LEVEL_DOWN", to_translation( "Descend stairs" ) );
    ctxt.register_action( "LEVEL_UP", to_translation( "Ascend stairs" ) );
    ctxt.register_action( "toggle_map_memory" );
    ctxt.register_action( "center" );
    ctxt.register_action( "shift_n" );
    ctxt.register_action( "shift_ne" );
    ctxt.register_action( "shift_e" );
    ctxt.register_action( "shift_se" );
    ctxt.register_action( "shift_s" );
    ctxt.register_action( "shift_sw" );
    ctxt.register_action( "shift_w" );
    ctxt.register_action( "shift_nw" );
    ctxt.register_action( "cycle_move" );
    ctxt.register_action( "cycle_move_reverse" );
    ctxt.register_action( "reset_move" );
    ctxt.register_action( "toggle_run" );
    ctxt.register_action( "toggle_crouch" );
    ctxt.register_action( "toggle_prone" );
    ctxt.register_action( "open_movement" );
    ctxt.register_action( "open" );
    ctxt.register_action( "close" );
    ctxt.register_action( "smash" );
    ctxt.register_action( "loot" );
    ctxt.register_action( "examine" );
    ctxt.register_action( "examine_and_pickup" );
    ctxt.register_action( "advinv" );
    ctxt.register_action( "pickup" );
    ctxt.register_action( "pickup_all" );
    ctxt.register_action( "grab" );
    ctxt.register_action( "haul" );
    ctxt.register_action( "haul_toggle" );
    ctxt.register_action( "butcher" );
    ctxt.register_action( "chat" );
    ctxt.register_action( "look" );
    ctxt.register_action( "peek" );
    ctxt.register_action( "listitems" );
    ctxt.register_action( "zones" );
    ctxt.register_action( "inventory" );
    ctxt.register_action( "compare" );
    ctxt.register_action( "organize" );
    ctxt.register_action( "apply" );
    ctxt.register_action( "apply_wielded" );
    ctxt.register_action( "wear" );
    ctxt.register_action( "take_off" );
    ctxt.register_action( "eat" );
    ctxt.register_action( "open_consume" );
    ctxt.register_action( "read" );
    ctxt.register_action( "wield" );
    ctxt.register_action( "pick_style" );
    ctxt.register_action( "reload_item" );
    ctxt.register_action( "reload_weapon" );
    ctxt.register_action( "reload_wielded" );
    ctxt.register_action( "insert" );
    ctxt.register_action( "unload" );
    ctxt.register_action( "throw" );
    ctxt.register_action( "throw_wielded" );
    ctxt.register_action( "fire" );
    ctxt.register_action( "cast_spell" );
    ctxt.register_action( "recast_spell" );
    ctxt.register_action( "fire_burst" );
    ctxt.register_action( "select_fire_mode" );
    ctxt.register_action( "select_default_ammo" );
    ctxt.register_action( "drop" );
    ctxt.register_action( "unload_container" );
    ctxt.register_action( "drop_adj" );
    ctxt.register_action( "bionics" );
    ctxt.register_action( "mutations" );
    ctxt.register_action( "medical" );
    ctxt.register_action( "bodystatus" );
    ctxt.register_action( "sort_armor" );
    ctxt.register_action( "wait" );
    ctxt.register_action( "craft" );
    ctxt.register_action( "recraft" );
    ctxt.register_action( "long_craft" );
    ctxt.register_action( "construct" );
    ctxt.register_action( "disassemble" );
    ctxt.register_action( "sleep" );
    ctxt.register_action( "control_vehicle" );
    ctxt.register_action( "auto_travel_mode" );
    ctxt.register_action( "safemode" );
    ctxt.register_action( "autosafe" );
    ctxt.register_action( "autoattack" );
    ctxt.register_action( "ignore_enemy" );
    ctxt.register_action( "whitelist_enemy" );
    ctxt.register_action( "workout" );
    ctxt.register_action( "save" );
    ctxt.register_action( "quicksave" );
#if !defined(RELEASE)
    ctxt.register_action( "quickload" );
#endif
    ctxt.register_action( "SUICIDE" );
    ctxt.register_action( "player_data" );
    ctxt.register_action( "map" );
    ctxt.register_action( "sky" );
    ctxt.register_action( "missions" );
    ctxt.register_action( "factions" );
    ctxt.register_action( "morale" );
    ctxt.register_action( "messages" );
    ctxt.register_action( "help" );
    ctxt.register_action( "HELP_KEYBINDINGS" );
    ctxt.register_action( "open_options" );
    ctxt.register_action( "open_autopickup" );
    ctxt.register_action( "open_autonotes" );
    ctxt.register_action( "open_safemode" );
    ctxt.register_action( "open_distraction_manager" );
    ctxt.register_action( "open_color" );
    ctxt.register_action( "open_world_mods" );
    ctxt.register_action( "debug" );
    ctxt.register_action( "debug_scent" );
    ctxt.register_action( "debug_scent_type" );
    ctxt.register_action( "debug_temp" );
    ctxt.register_action( "debug_visibility" );
    ctxt.register_action( "debug_lighting" );
    ctxt.register_action( "debug_radiation" );
    ctxt.register_action( "debug_hour_timer" );
    ctxt.register_action( "debug_mode" );
    ctxt.register_action( "zoom_out" );
    ctxt.register_action( "zoom_in" );
#if !defined(__ANDROID__) && !defined(EMSCRIPTEN)
    ctxt.register_action( "toggle_fullscreen" );
#endif
    ctxt.register_action( "toggle_pixel_minimap" );
    ctxt.register_action( "toggle_panel_adm" );
    ctxt.register_action( "reload_tileset" );
    ctxt.register_action( "toggle_auto_features" );
    ctxt.register_action( "toggle_auto_pulp_butcher" );
    ctxt.register_action( "toggle_auto_mining" );
    ctxt.register_action( "toggle_auto_foraging" );
    ctxt.register_action( "toggle_auto_pickup" );
    ctxt.register_action( "toggle_thief_mode" );
    ctxt.register_action( "toggle_prevent_occlusion" );
    ctxt.register_action( "diary" );
    ctxt.register_action( "action_menu" );
    ctxt.register_action( "main_menu" );
    ctxt.register_action( "item_action_menu" );
    ctxt.register_action( "ANY_INPUT" );
    ctxt.register_action( "COORDINATE" );
    ctxt.register_action( "MOUSE_MOVE" );
    ctxt.register_action( "SELECT" );
    ctxt.register_action( "CLICK_AND_DRAG" );
    ctxt.register_action( "SEC_SELECT" );
    return ctxt;
}

int djb2_hash( const unsigned char *input )
{
    unsigned int hash = 5381;
    unsigned char c = *input++;
    while( c != '\0' ) {
        hash = ( ( hash << 5 ) + hash ) + c; /* hash * 33 + c */
        c = *input++;
    }
    return hash;
}

void input_manager::set_timeout( const int delay )
{
    input_timeout = delay;
    inputdelay = delay;
}


// Explicit fixture platform capability: this Node/MEMFS harness has no gamepad.
// This does not execute native SDL gamepad enumeration or a browser input adapter.
bool gamepad_available() { return false; }
