// Synthetic descriptor fixture for the actual new transport, not original help loader execution.
#include "cdda_help_transport.h"
#include <array>
#include <cstring>
#include <stdexcept>
#include <string>
#include <utility>

namespace cdda_help_semantic {
// Link-only fixture callbacks. The original helper is deliberately absent from this test module.
void set_help_sink( help_sink ) noexcept {}
void set_help_failure_sink( help_failure_sink ) noexcept {}
}
namespace {
using namespace cdda_help_semantic;
selected_help_observation make_observation( uint64_t sequence ) {
    selected_help_observation result;
    result.publication_sequence = sequence;
    result.engine_build_id = CDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID;
    result.available = true;
    result.title.id = "ui.help.title";
    result.topic_name.id = "help.core.movement.name";
    result.loaded_source = "fixture-only-not-a-loaded-game";
    result.loaded_file = "data/core/help.json";
    constexpr std::array<const char *, 6> ids = {{ "help.core.movement.controls", nullptr, "help.core.movement.movement_cost", "help.core.movement.melee", "help.core.movement.doors", "help.core.movement.safe_mode" }};
    const std::array<std::vector<std::string>, 6> actions = {{ {}, {}, { "player_data" }, {}, { "open", "close", "smash" }, { "safemode" } }};
    constexpr std::array<const char *, 9> roles = {{ "north_west", "north", "north_east", "west", "pause", "east", "south_west", "south", "south_east" }};
    constexpr std::array<const char *, 9> grid_actions = {{ "LEFTUP", "UP", "RIGHTUP", "LEFT", "pause", "RIGHT", "LEFTDOWN", "DOWN", "RIGHTDOWN" }};
    for( size_t i = 0; i < 6; ++i ) {
        help_block block;
        if( i == 1 ) {
            block.kind = block_kind::structured_direction_grid;
            for( size_t at = 0; at < 9; ++at ) {
                auto &cell = block.grid.cells[at];
                cell.role = roles[at]; cell.action = grid_actions[at];
                cell.row = static_cast<int>( at / 3 ); cell.column = static_cast<int>( at % 3 );
            }
        } else {
            block.text.id = ids[i];
            for( const auto &action : actions[i] ) {
                key_parameter key;
                key.name = "press_" + action;
                key.value.category = "DEFAULTMODE"; key.value.action = action;
                key.value.origin = binding_origin::context;
                presentation_binding binding;
                binding.native.type = input_event_t::keyboard_char;
                binding.native.sequence = { -2147483647 - 1, 2147483647 };
                binding.native.text = "山田<press_open>\n\"\\";
                binding.native.text.push_back( '\0' );
                binding.native.edit = "編集中";
                binding.native.edit_refresh = true;
                binding.enabled_for_presentation = true;
                key.value.bindings.push_back( std::move( binding ) );
                block.text.key_parameters.push_back( std::move( key ) );
            }
        }
        result.blocks.push_back( std::move( block ) );
    }
    return result;
}
void require( bool value ) { if( !value ) { throw std::runtime_error( "help fixture assertion" ); } }
bool rejected( const selected_help_observation &observation ) {
    try { cdda_help_transport::encode( observation ); } catch( ... ) { return true; }
    return false;
}
} // namespace

extern "C" int cdda_help_fixture_run() {
    int checks = 0;
    auto value = make_observation( 1 );
    const auto bytes = cdda_help_transport::encode( value );
    require( bytes.find( "山田<press_open>" ) != std::string::npos ); ++checks;
    require( bytes.find( "\\u0000" ) != std::string::npos ); ++checks;
    require( bytes.find( "-2147483648,2147483647" ) != std::string::npos ); ++checks;
    cdda_help_transport::publish( value );
    std::array<uint32_t, 4> handles;
    for( auto &handle : handles ) { handle = cdda_help_snapshot_pin(); require( handle != 0 ); ++checks; }
    require( cdda_help_snapshot_pin() == 0 ); ++checks;
    require( cdda_help_snapshot_size( handles[0] ) == bytes.size() ); ++checks;
    require( std::memcmp( cdda_help_snapshot_data( handles[0] ), bytes.data(), bytes.size() ) == 0 ); ++checks;
    cdda_help_transport::invalidate(); require( cdda_help_snapshot_pin() == 0 ); ++checks;
    require( std::memcmp( cdda_help_snapshot_data( handles[0] ), bytes.data(), bytes.size() ) == 0 ); ++checks;
    for( auto handle : handles ) { cdda_help_snapshot_release( handle ); }
    require( cdda_help_snapshot_data( handles[0] ) == nullptr ); ++checks;
    require( cdda_help_snapshot_size( handles[0] ) == 0 ); ++checks;
    value = make_observation( 2 ); cdda_help_transport::publish( value );
    const auto fresh = cdda_help_snapshot_pin(); require( fresh > handles[3] ); ++checks;
    cdda_help_snapshot_release( fresh ); cdda_help_snapshot_release( fresh );
    value.available = false;
    const auto clear = cdda_help_transport::encode( value );
    require( clear.find( "\"blocks\"" ) == std::string::npos ); ++checks;
    require( clear.find( "\"title\"" ) == std::string::npos ); ++checks;
    value = make_observation( 3 ); value.title.id = "bad"; require( rejected( value ) ); ++checks;
    value = make_observation( 3 ); value.loaded_source.assign( "\xc0\xaf", 2 ); require( rejected( value ) ); ++checks;
    value = make_observation( 3 ); value.loaded_source.assign( 16385, 'x' ); require( rejected( value ) ); ++checks;
    value = make_observation( 3 ); value.blocks[2].text.key_parameters[0].value.origin = binding_origin::missing; require( rejected( value ) ); ++checks;
    value = make_observation( 3 ); value.blocks[4].text.key_parameters[0].name = "press_close"; require( rejected( value ) ); ++checks;
    value = make_observation( 3 ); value.blocks[1].grid.cells[0].role = "north"; require( rejected( value ) ); ++checks;
    value = make_observation( 3 ); value.blocks[1].grid.cells[0].alternatives[1] = presentation_binding(); require( rejected( value ) ); ++checks;
    value = make_observation( 3 ); value.blocks[2].text.key_parameters[0].value.bindings[0].native.type = static_cast<input_event_t>( 255 ); require( rejected( value ) ); ++checks;
    value = make_observation( 3 ); cdda_help_transport::publish( value );
    const auto last = cdda_help_snapshot_pin(); require( last > fresh ); ++checks;
    // Counter regression makes the observation family terminal; old immutable pin remains.
    cdda_help_transport::publish( value ); require( cdda_help_snapshot_pin() == 0 ); ++checks;
    require( cdda_help_snapshot_size( last ) != 0 ); ++checks;
    cdda_help_snapshot_release( last );
    return checks;
}
