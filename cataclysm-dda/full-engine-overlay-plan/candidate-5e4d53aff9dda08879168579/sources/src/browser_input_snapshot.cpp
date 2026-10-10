// Source preparation only: uncompiled/unconnected. CC BY-SA 3.0; see ../NOTICE.md.
#include "browser_input_snapshot.h"

#include <array>
#include <limits>
#include <memory>
#include <stdexcept>
#include <utility>

#ifndef CDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID
#error Define CDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID to the explicit integration build identity
#endif

#if defined(EMSCRIPTEN)
#include <emscripten.h>
// Notification only: no DOM/engine call, no callback reentry while publishing.
// Hosts compare the notification generation with copied JSON and ignore stale notices.
EM_JS( void, cdda_browser_input_snapshot_notify,
       ( uint32_t low, uint32_t high, uint32_t availability ), {
    // Both scheduling and the deferred host callback are observational failures.
    // Logging failure is ignored too, so no JS exception escapes into C++.
    function report( error ) {
        try { console.error( 'CDDA input snapshot observer callback failed', error ); }
        catch( ignored ) {}
    }
    try {
        const notice = Object.freeze( { kind: 1, publicationLow: low >>> 0,
                                      publicationHigh: high >>> 0, availability: availability } );
        queueMicrotask( function() {
            try {
                if( typeof globalThis.cddaInputSnapshotAvailable === 'function' ) {
                    globalThis.cddaInputSnapshotAvailable( notice );
                }
            } catch( error ) {
                report( error );
            }
        } );
    } catch( error ) {
        report( error );
    }
} );
#else
static void cdda_browser_input_snapshot_notify( uint32_t, uint32_t, uint32_t ) noexcept {}
#endif

namespace
{
constexpr size_t max_snapshot_bytes = 256 * 1024;
constexpr size_t max_field_bytes = 16 * 1024;
constexpr size_t max_actions = 2048;
constexpr size_t max_bindings_per_action = 128;
constexpr size_t max_key_sequence = 64;
constexpr uint32_t max_scope_depth = 64;
constexpr size_t max_pins = 16;
constexpr const char *source_commit = "7b2efa5cea38e4d4d97dd0e63b28b9148623da59";

struct pin_slot {
    uint32_t handle = 0;
    std::shared_ptr<const std::string> bytes;
};
struct observer_state {
    cdda_browser_input_scope *active = nullptr;
    std::shared_ptr<const std::string> latest;
    std::array<pin_slot, max_pins> pins;
    uint64_t next_context_epoch = 1;
    uint64_t next_publication = 1;
    uint32_t next_handle = 1;
};

observer_state &observer() noexcept
{
    // No game, clock, RNG, draw or native keybinding object is created here.
    static observer_state state;
    return state;
}

uint64_t take_counter( uint64_t &counter ) noexcept
{
    if( counter == 0 ) {
        return 0;
    }
    const uint64_t result = counter;
    counter = result == std::numeric_limits<uint64_t>::max() ? 0 : result + 1;
    return result;
}

bool valid_utf8( const std::string &text ) noexcept
{
    size_t index = 0;
    while( index < text.size() ) {
        const uint8_t first = static_cast<uint8_t>( text[index++] );
        if( first <= 0x7f ) {
            continue;
        }
        unsigned continuation = 0;
        uint32_t scalar = 0;
        uint32_t minimum = 0;
        if( first >= 0xc2 && first <= 0xdf ) {
            continuation = 1; scalar = first & 0x1f; minimum = 0x80;
        } else if( first >= 0xe0 && first <= 0xef ) {
            continuation = 2; scalar = first & 0x0f; minimum = 0x800;
        } else if( first >= 0xf0 && first <= 0xf4 ) {
            continuation = 3; scalar = first & 0x07; minimum = 0x10000;
        } else {
            return false;
        }
        if( continuation > text.size() - index ) {
            return false;
        }
        for( unsigned byte = 0; byte < continuation; ++byte ) {
            const uint8_t value = static_cast<uint8_t>( text[index++] );
            if( ( value & 0xc0 ) != 0x80 ) {
                return false;
            }
            scalar = ( scalar << 6 ) | ( value & 0x3f );
        }
        if( scalar < minimum || scalar > 0x10ffff ||
            ( scalar >= 0xd800 && scalar <= 0xdfff ) ) {
            return false;
        }
    }
    return true;
}

class bounded_json
{
    public:
        void raw( const std::string &value ) {
            if( value.size() > max_snapshot_bytes - bytes.size() ) {
                throw std::length_error( "input snapshot byte limit" );
            }
            bytes += value;
        }
        void string( const std::string &value ) {
            if( value.size() > max_field_bytes || !valid_utf8( value ) ) {
                throw std::length_error( "input snapshot string/UTF-8 limit" );
            }
            raw( "\"" );
            constexpr char hex[] = "0123456789abcdef";
            for( const unsigned char character : value ) {
                if( character == '\"' || character == '\\' ) {
                    raw( std::string( "\\" ) + static_cast<char>( character ) );
                } else if( character < 0x20 ) {
                    std::string escape = "\\u00";
                    escape += hex[character >> 4];
                    escape += hex[character & 0x0f];
                    raw( escape );
                } else {
                    raw( std::string( 1, static_cast<char>( character ) ) );
                }
            }
            raw( "\"" );
        }
        std::string finish() && {
            return std::move( bytes );
        }
    private:
        std::string bytes;
};

const char *keyboard_mode_name( keyboard_mode mode )
{
    switch( mode ) {
        case keyboard_mode::keychar: return "keychar";
        case keyboard_mode::keycode: return "keycode";
    }
    throw std::invalid_argument( "unknown source keyboard mode" );
}
const char *event_type_name( input_event_t type )
{
    switch( type ) {
        case input_event_t::error: return "error";
        case input_event_t::timeout: return "timeout";
        case input_event_t::keyboard_char: return "keyboard_char";
        case input_event_t::keyboard_code: return "keyboard_code";
        case input_event_t::gamepad: return "gamepad";
        case input_event_t::mouse: return "mouse";
    }
    throw std::invalid_argument( "unknown source input event type" );
}
const char *origin_name( cdda_browser_binding_origin origin )
{
    switch( origin ) {
        case cdda_browser_binding_origin::context: return "context";
        case cdda_browser_binding_origin::default_context: return "default";
        case cdda_browser_binding_origin::missing: return "missing";
    }
    throw std::invalid_argument( "unknown binding origin" );
}

void write_binding( bounded_json &json, const input_event &binding )
{
    if( binding.sequence.size() > max_key_sequence ) {
        throw std::length_error( "source binding sequence limit" );
    }
    json.raw( "{\"type\":" ); json.string( event_type_name( binding.type ) );
    json.raw( ",\"modifiers\":[" );
    bool first = true;
    for( const keymod_t modifier : binding.modifiers ) {
        const char *name = nullptr;
        switch( modifier ) {
            case keymod_t::ctrl: name = "ctrl"; break;
            case keymod_t::alt: name = "alt"; break;
            case keymod_t::shift: name = "shift"; break;
            default: throw std::invalid_argument( "unknown source modifier" );
        }
        if( !first ) { json.raw( "," ); }
        json.string( name ); first = false;
    }
    json.raw( "],\"sequence\":[" );
    first = true;
    for( const int key : binding.sequence ) {
        if( !first ) { json.raw( "," ); }
        json.raw( std::to_string( key ) ); first = false;
    }
    json.raw( "],\"text\":" ); json.string( binding.text );
    json.raw( ",\"edit\":" ); json.string( binding.edit );
    json.raw( ",\"edit_refresh\":" ); json.raw( binding.edit_refresh ? "true" : "false" );
    // Binding descriptors do not carry a pointer event's live screen coordinates.
    // This phase exports effective bindings, not the last raw native input event.
    json.raw( "}" );
}

void notify( uint64_t publication, uint32_t availability ) noexcept
{
    cdda_browser_input_snapshot_notify( static_cast<uint32_t>( publication & 0xffffffffu ),
                                       static_cast<uint32_t>( publication >> 32 ), availability );
}
void unavailable( uint32_t reason ) noexcept
{
    observer().latest.reset();
    notify( take_counter( observer().next_publication ), reason );
}
} // namespace

cdda_browser_input_scope::cdda_browser_input_scope(
    const void *context, cdda_browser_context_reader context_reader,
    cdda_browser_binding_reader binding_reader ) noexcept :
    context_( context ), context_reader_( context_reader ), binding_reader_( binding_reader )
{
    observer_state &state = observer();
    parent_ = state.active;
    depth_ = parent_ == nullptr ? 1 :
             ( parent_->depth_ == std::numeric_limits<uint32_t>::max() ? parent_->depth_ :
               parent_->depth_ + 1 );
    context_epoch_ = take_counter( state.next_context_epoch );
    state.active = this;
    publish();
}

cdda_browser_input_scope::~cdda_browser_input_scope() noexcept
{
    observer_state &state = observer();
    if( state.active != this ) {
        // Unexpected non-LIFO destruction: clear the published context, never
        // keep a stale gameplay context while a different native reader is active.
        state.active = nullptr;
        unavailable( 3 );
        return;
    }
    state.active = parent_;
    if( parent_ != nullptr ) {
        // Refresh actual layered bindings after nested help/keybinding editing.
        // The parent's native handle_input stack/context is still alive here.
        parent_->publish();
    } else {
        unavailable( 0 ); // no tracked native wait is currently active
    }
}

void cdda_browser_input_scope::publish() const noexcept
{
    try {
        if( context_ == nullptr || context_reader_ == nullptr || binding_reader_ == nullptr ||
            context_epoch_ == 0 || depth_ > max_scope_depth ) {
            unavailable( 3 );
            return;
        }
        const cdda_browser_context_view view = context_reader_( context_ );
        if( view.category == nullptr || view.registered_actions == nullptr ||
            view.registered_actions->size() > max_actions ) {
            unavailable( 3 );
            return;
        }
        const uint64_t publication = take_counter( observer().next_publication );
        if( publication == 0 ) {
            unavailable( 3 );
            return;
        }
        bounded_json json;
        json.raw( "{\"schema_version\":1,\"interface\":\"cdda-live-input-snapshot/1\",\"source_commit\":" );
        json.string( source_commit );
        json.raw( ",\"engine_build_id\":" ); json.string( CDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID );
        json.raw( ",\"publication_sequence\":" ); json.string( std::to_string( publication ) );
        json.raw( ",\"context_epoch\":" ); json.string( std::to_string( context_epoch_ ) );
        json.raw( ",\"parent_context_epoch\":" );
        json.string( std::to_string( parent_ == nullptr ? 0 : parent_->context_epoch_ ) );
        json.raw( ",\"depth\":" ); json.raw( std::to_string( depth_ ) );
        json.raw( ",\"phase\":\"input_wait\",\"category\":" ); json.string( *view.category );
        json.raw( ",\"text_policy\":" );
        json.string( *view.category == "STRING_INPUT" ? "raw_utf8" : "native_context" );
        json.raw( ",\"preferred_keyboard_mode\":" );
        json.string( keyboard_mode_name( view.preferred_keyboard_mode ) );
        json.raw( ",\"effective_timeout_ms\":" ); json.raw( std::to_string( view.effective_timeout_ms ) );
        json.raw( ",\"registered_any_input\":" ); json.raw( view.registered_any_input ? "true" : "false" );
        json.raw( ",\"coordinate_input_enabled\":" ); json.raw( view.coordinate_input_enabled ? "true" : "false" );
        json.raw( ",\"iso_mode\":" ); json.raw( view.iso_mode ? "true" : "false" );
        json.raw( ",\"binding_authority\":\"original_action_contexts_const_lookup\",\"actions\":[" );
        size_t index = 0;
        for( const std::string &action : *view.registered_actions ) {
            cdda_browser_binding_origin origin = cdda_browser_binding_origin::missing;
            const std::vector<input_event> *bindings = binding_reader_( context_, action, origin );
            if( bindings != nullptr && bindings->size() > max_bindings_per_action ) {
                throw std::length_error( "source binding list limit" );
            }
            if( index != 0 ) { json.raw( "," ); }
            json.raw( "{\"index\":" ); json.raw( std::to_string( index++ ) );
            json.raw( ",\"id\":" ); json.string( action );
            json.raw( ",\"origin\":" ); json.string( origin_name( origin ) );
            json.raw( ",\"bindings\":[" );
            bool first = true;
            if( bindings != nullptr ) {
                for( const input_event &binding : *bindings ) {
                    if( !first ) { json.raw( "," ); }
                    write_binding( json, binding ); first = false;
                }
            }
            json.raw( "]}" );
        }
        json.raw( "]}" );
        observer().latest = std::make_shared<const std::string>( std::move( json ).finish() );
        notify( publication, 1 );
    } catch( ... ) {
        // Observational failure never throws into the original input loop.
        // Explicitly clear stale data; the host keeps native input active.
        unavailable( 2 );
    }
}

extern "C" uint32_t cdda_browser_snapshot_pin( uint32_t kind ) noexcept
{
    observer_state &state = observer();
    if( kind != 1 || !state.latest || state.next_handle == 0 ) {
        return 0;
    }
    for( pin_slot &slot : state.pins ) {
        if( slot.handle == 0 ) {
            const uint32_t handle = state.next_handle;
            state.next_handle = handle == std::numeric_limits<uint32_t>::max() ? 0 : handle + 1;
            slot.bytes = state.latest;
            slot.handle = handle;
            return handle;
        }
    }
    return 0;
}

extern "C" const uint8_t *cdda_browser_snapshot_data( uint32_t handle ) noexcept
{
    if( handle == 0 ) { return nullptr; }
    for( const pin_slot &slot : observer().pins ) {
        if( slot.handle == handle && slot.bytes ) {
            return reinterpret_cast<const uint8_t *>( slot.bytes->data() );
        }
    }
    return nullptr;
}

extern "C" size_t cdda_browser_snapshot_size( uint32_t handle ) noexcept
{
    if( handle == 0 ) { return 0; }
    for( const pin_slot &slot : observer().pins ) {
        if( slot.handle == handle && slot.bytes ) { return slot.bytes->size(); }
    }
    return 0;
}

extern "C" void cdda_browser_snapshot_release( uint32_t handle ) noexcept
{
    if( handle == 0 ) { return; }
    for( pin_slot &slot : observer().pins ) {
        if( slot.handle == handle ) {
            slot.bytes.reset();
            slot.handle = 0;
            return;
        }
    }
}
