// CC BY-SA 3.0; source preparation against CDDA 0.I-1. See ../NOTICE.md.
#include "cdda_help_transport.h"

#include <array>
#include <limits>
#include <memory>
#include <stdexcept>
#include <utility>

#ifndef CDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID
#error "The coordinated help build identity is required."
#endif

#ifdef EMSCRIPTEN
#include <emscripten.h>
#define CDDA_HELP_EXPORT EMSCRIPTEN_KEEPALIVE
EM_JS( void, cdda_help_notify, ( uint32_t low, uint32_t high, uint32_t availability ), {
    try {
        const notice = Object.freeze( { kind: 3, publicationLow: low >>> 0,
            publicationHigh: high >>> 0, availability: availability >>> 0 } );
        const deliver = () => {
            try {
                const receive = globalThis.cddaHelpSnapshotAvailable;
                if( typeof receive === 'function' ) { receive( notice ); }
            } catch( ignored ) { }
        };
        if( typeof queueMicrotask === 'function' ) { queueMicrotask( deliver ); }
        else { Promise.resolve().then( deliver ).catch( () => {} ); }
    } catch( ignored ) { }
} );
#else
#define CDDA_HELP_EXPORT
static void cdda_help_notify( uint32_t, uint32_t, uint32_t ) noexcept {}
#endif

namespace
{
using namespace cdda_help_semantic;
constexpr size_t max_bytes = 262144;
constexpr size_t max_field = 16384;
constexpr char build_id[] = CDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID;
static_assert( sizeof( build_id ) > 1 && sizeof( build_id ) <= max_field + 1,
               "nonempty bounded build identity" );
static_assert( std::numeric_limits<int>::digits == 31, "signed 32-bit native key codes" );
std::shared_ptr<const std::string> latest;
struct pin_slot { uint32_t handle = 0; std::shared_ptr<const std::string> bytes; };
std::array<pin_slot, 4> pins;
uint32_t next_handle = 1;
bool exhausted_handles = false;
bool inside_publish = false;
bool terminal = false;
uint64_t last_publication = 0;

bool valid_utf8( const std::string &text ) noexcept
{
    size_t at = 0;
    while( at < text.size() ) {
        const uint8_t first = static_cast<uint8_t>( text[at++] );
        if( first <= 0x7f ) { continue; }
        unsigned count = 0;
        uint32_t scalar = 0;
        uint32_t minimum = 0;
        if( first >= 0xc2 && first <= 0xdf ) { count = 1; scalar = first & 31; minimum = 0x80; }
        else if( first >= 0xe0 && first <= 0xef ) { count = 2; scalar = first & 15; minimum = 0x800; }
        else if( first >= 0xf0 && first <= 0xf4 ) { count = 3; scalar = first & 7; minimum = 0x10000; }
        else { return false; }
        if( count > text.size() - at ) { return false; }
        while( count-- > 0 ) {
            const uint8_t byte = static_cast<uint8_t>( text[at++] );
            if( ( byte & 0xc0 ) != 0x80 ) { return false; }
            scalar = ( scalar << 6 ) | ( byte & 63 );
        }
        if( scalar < minimum || scalar > 0x10ffff || ( scalar >= 0xd800 && scalar <= 0xdfff ) ) {
            return false;
        }
    }
    return true;
}
class json_writer
{
    public:
        void raw( const std::string &text ) {
            if( text.size() > max_bytes - bytes.size() ) { throw std::length_error( "help byte cap" ); }
            bytes += text;
        }
        void string( const std::string &text ) {
            if( text.size() > max_field || !valid_utf8( text ) ) {
                throw std::length_error( "help UTF-8/field cap" );
            }
            raw( "\"" );
            constexpr char hex[] = "0123456789abcdef";
            for( const unsigned char byte : text ) {
                if( byte == '\"' || byte == '\\' ) { raw( std::string( "\\" ) + static_cast<char>( byte ) ); }
                else if( byte < 32 ) {
                    std::string escape = "\\u00";
                    escape += hex[byte >> 4]; escape += hex[byte & 15]; raw( escape );
                } else { raw( std::string( 1, static_cast<char>( byte ) ) ); }
            }
            raw( "\"" );
        }
        std::string finish() && { return std::move( bytes ); }
    private:
        std::string bytes;
};
const char *event_name( input_event_t type )
{
    switch( type ) {
        case input_event_t::error: return "error";
        case input_event_t::timeout: return "timeout";
        case input_event_t::keyboard_char: return "keyboard_char";
        case input_event_t::keyboard_code: return "keyboard_code";
        case input_event_t::gamepad: return "gamepad";
        case input_event_t::mouse: return "mouse";
    }
    throw std::invalid_argument( "help event enum" );
}
const char *origin_name( binding_origin origin )
{
    switch( origin ) {
        case binding_origin::context: return "context";
        case binding_origin::default_context: return "default";
        case binding_origin::missing: return "missing";
    }
    throw std::invalid_argument( "help binding origin" );
}
void write_binding( json_writer &json, const presentation_binding &binding )
{
    if( binding.native.sequence.size() > 64 || binding.native.modifiers.size() > 3 ) {
        throw std::length_error( "help binding cap" );
    }
    json.raw( "{\"native\":{\"event_type\":" ); json.string( event_name( binding.native.type ) );
    json.raw( ",\"modifiers\":[" );
    bool first = true;
    for( const keymod_t modifier : binding.native.modifiers ) {
        const char *name = nullptr;
        switch( modifier ) {
            case keymod_t::ctrl: name = "ctrl"; break;
            case keymod_t::alt: name = "alt"; break;
            case keymod_t::shift: name = "shift"; break;
            default: throw std::invalid_argument( "help modifier enum" );
        }
        if( !first ) { json.raw( "," ); } json.string( name ); first = false;
    }
    json.raw( "],\"sequence\":[" ); first = true;
    for( const int code : binding.native.sequence ) {
        if( !first ) { json.raw( "," ); } json.raw( std::to_string( code ) ); first = false;
    }
    json.raw( "],\"text\":" ); json.string( binding.native.text );
    json.raw( ",\"edit\":" ); json.string( binding.native.edit );
    json.raw( ",\"edit_refresh\":" ); json.raw( binding.native.edit_refresh ? "true" : "false" );
    json.raw( "},\"enabled_for_presentation\":" ); json.raw( binding.enabled_for_presentation ? "true" : "false" );
    json.raw( ",\"single_printable\":" ); json.raw( binding.single_printable ? "true" : "false" ); json.raw( "}" );
}
void write_key( json_writer &json, const binding_observation &key, const char *action )
{
    if( key.category != "DEFAULTMODE" || key.action != action || key.bindings.size() > 128 ||
        ( key.origin == binding_origin::missing && !key.bindings.empty() ) ) {
        throw std::invalid_argument( "help key owner/cap" );
    }
    json.raw( "{\"category\":" ); json.string( key.category );
    json.raw( ",\"action\":" ); json.string( key.action );
    json.raw( ",\"origin\":" ); json.string( origin_name( key.origin ) );
    json.raw( ",\"bindings\":[" ); bool first = true;
    for( const auto &binding : key.bindings ) {
        if( !first ) { json.raw( "," ); } write_binding( json, binding ); first = false;
    }
    json.raw( "]}" );
}
void write_text( json_writer &json, const text_observation &text, const char *id,
                 const std::vector<std::string> &actions = {} )
{
    if( text.id != id || text.key_parameters.size() != actions.size() ) {
        throw std::invalid_argument( "help text owner" );
    }
    json.raw( "{\"id\":" ); json.string( text.id ); json.raw( ",\"key_parameters\":[" );
    for( size_t i = 0; i < actions.size(); ++i ) {
        const key_parameter &parameter = text.key_parameters[i];
        if( parameter.name != "press_" + actions[i] ) { throw std::invalid_argument( "help typed key role" ); }
        if( i != 0 ) { json.raw( "," ); }
        json.raw( "{\"name\":" ); json.string( parameter.name ); json.raw( ",\"value\":" );
        write_key( json, parameter.value, actions[i].c_str() ); json.raw( "}" );
    }
    json.raw( "]}" );
}
void write_grid( json_writer &json, const structured_direction_grid &grid )
{
    constexpr std::array<const char *, 9> roles = {{ "north_west", "north", "north_east", "west", "pause", "east", "south_west", "south", "south_east" }};
    constexpr std::array<const char *, 9> actions = {{ "LEFTUP", "UP", "RIGHTUP", "LEFT", "pause", "RIGHT", "LEFTDOWN", "DOWN", "RIGHTDOWN" }};
    if( grid.category != "DEFAULTMODE" ) { throw std::invalid_argument( "help grid category" ); }
    json.raw( "{\"category\":\"DEFAULTMODE\",\"cells\":[" );
    for( size_t i = 0; i < grid.cells.size(); ++i ) {
        const grid_cell &cell = grid.cells[i];
        if( cell.role != roles[i] || cell.action != actions[i] || cell.row != static_cast<int>( i / 3 ) ||
            cell.column != static_cast<int>( i % 3 ) || ( !cell.alternatives[0] && cell.alternatives[1] ) ) {
            throw std::invalid_argument( "help grid owner/order" );
        }
        if( i != 0 ) { json.raw( "," ); }
        json.raw( "{\"role\":" ); json.string( cell.role ); json.raw( ",\"action\":" ); json.string( cell.action );
        json.raw( ",\"row\":" ); json.raw( std::to_string( cell.row ) );
        json.raw( ",\"column\":" ); json.raw( std::to_string( cell.column ) ); json.raw( ",\"alternatives\":[" );
        for( size_t slot = 0; slot < 2; ++slot ) {
            if( slot != 0 ) { json.raw( "," ); }
            if( !cell.alternatives[slot] ) { json.raw( "null" ); continue; }
            const auto &binding = *cell.alternatives[slot];
            const auto &native = binding.native;
            if( ( native.type != input_event_t::keyboard_char && native.type != input_event_t::keyboard_code ) ||
                !binding.enabled_for_presentation || !binding.single_printable || native.sequence.size() != 1 ||
                !native.modifiers.empty() || native.sequence[0] < 0 || native.sequence[0] >= 255 || native.sequence[0] == 32 ) {
                throw std::invalid_argument( "help grid selected policy" );
            }
            write_binding( json, binding );
        }
        json.raw( "]}" );
    }
    json.raw( "]}" );
}
void notify( uint64_t sequence, uint32_t availability ) noexcept
{
    cdda_help_notify( static_cast<uint32_t>( sequence ), static_cast<uint32_t>( sequence >> 32 ), availability );
}
} // namespace

namespace cdda_help_transport
{
std::string encode( const selected_help_observation &observation )
{
    if( observation.interface != help_interface || observation.schema_version != 1 ||
        observation.source_commit != source_commit || observation.engine_build_id != build_id ||
        ( observation.available && observation.publication_sequence == 0 ) ) {
        throw std::invalid_argument( "help identity/publication" );
    }
    json_writer json;
    json.raw( "{\"interface\":" ); json.string( observation.interface );
    json.raw( ",\"schema_version\":1,\"source_commit\":" ); json.string( observation.source_commit );
    json.raw( ",\"engine_build_id\":" ); json.string( observation.engine_build_id );
    json.raw( ",\"publication_sequence\":" ); json.string( std::to_string( observation.publication_sequence ) );
    json.raw( ",\"available\":" ); json.raw( observation.available ? "true" : "false" );
    if( observation.available ) {
        if( observation.blocks.size() != 6 ) { throw std::invalid_argument( "help block count" ); }
        json.raw( ",\"title\":" ); write_text( json, observation.title, "ui.help.title" );
        json.raw( ",\"topic_name\":" ); write_text( json, observation.topic_name, "help.core.movement.name" );
        json.raw( ",\"loaded_source\":" ); json.string( observation.loaded_source );
        json.raw( ",\"loaded_file\":" ); json.string( observation.loaded_file ); json.raw( ",\"blocks\":[" );
        constexpr std::array<const char *, 6> ids = {{ "help.core.movement.controls", nullptr, "help.core.movement.movement_cost", "help.core.movement.melee", "help.core.movement.doors", "help.core.movement.safe_mode" }};
        const std::array<std::vector<std::string>, 6> actions = {{ {}, {}, { "player_data" }, {}, { "open", "close", "smash" }, { "safemode" } }};
        for( size_t i = 0; i < 6; ++i ) {
            const help_block &block = observation.blocks[i];
            if( i != 0 ) { json.raw( "," ); }
            if( i == 1 ) {
                if( block.kind != block_kind::structured_direction_grid ) { throw std::invalid_argument( "help grid role" ); }
                json.raw( "{\"kind\":\"structured_direction_grid\",\"grid\":" ); write_grid( json, block.grid );
            } else {
                if( block.kind != block_kind::text ) { throw std::invalid_argument( "help text role" ); }
                json.raw( "{\"kind\":\"text\",\"text\":" ); write_text( json, block.text, ids[i], actions[i] );
            }
            json.raw( "}" );
        }
        json.raw( "]" );
    }
    // Unavailable payload members are deliberately omitted, including default empty IDs.
    json.raw( "}" ); return std::move( json ).finish();
}
void publish( const selected_help_observation &observation ) noexcept
{
    if( inside_publish || terminal ) { return; }
    inside_publish = true;
    uint32_t availability = 1;
    uint64_t sequence = observation.publication_sequence;
    if( sequence == 0 || sequence <= last_publication ) {
        terminal = true; latest.reset(); availability = 3; sequence = 0;
    } else {
        last_publication = sequence;
        try { latest = std::make_shared<const std::string>( encode( observation ) ); }
        catch( ... ) { latest.reset(); availability = 2; }
    }
    inside_publish = false;
    // A deferred notice never holds a native pointer or calls the host during serialization.
    notify( sequence, availability );
}
void invalidate() noexcept
{
    latest.reset();
    notify( last_publication, 2 );
}
void attach() noexcept
{
    if( inside_publish || terminal ) { return; }
    set_help_sink( publish );
    set_help_failure_sink( invalidate );
    invalidate(); // No selected topic is current while entering the original help menu.
}
} // namespace cdda_help_transport

extern "C" CDDA_HELP_EXPORT uint32_t cdda_help_snapshot_pin() noexcept
{
    if( inside_publish || !latest || exhausted_handles ) { return 0; }
    for( auto &slot : pins ) {
        if( slot.handle == 0 ) {
            const uint32_t handle = next_handle;
            if( next_handle == std::numeric_limits<uint32_t>::max() ) { exhausted_handles = true; }
            else { ++next_handle; }
            slot.bytes = latest; slot.handle = handle; return handle;
        }
    }
    return 0;
}
extern "C" CDDA_HELP_EXPORT const uint8_t *cdda_help_snapshot_data( uint32_t handle ) noexcept
{
    if( inside_publish || handle == 0 ) { return nullptr; }
    for( const auto &slot : pins ) { if( slot.handle == handle ) { return reinterpret_cast<const uint8_t *>( slot.bytes->data() ); } }
    return nullptr;
}
extern "C" CDDA_HELP_EXPORT size_t cdda_help_snapshot_size( uint32_t handle ) noexcept
{
    if( inside_publish || handle == 0 ) { return 0; }
    for( const auto &slot : pins ) { if( slot.handle == handle ) { return slot.bytes->size(); } }
    return 0;
}
extern "C" CDDA_HELP_EXPORT void cdda_help_snapshot_release( uint32_t handle ) noexcept
{
    if( inside_publish || handle == 0 ) { return; }
    for( auto &slot : pins ) { if( slot.handle == handle ) { slot.bytes.reset(); slot.handle = 0; return; } }
}
