// Isolated synthetic callback fixture for the already compiled snapshot module.
// CC BY-SA 3.0, matching the integration overlay. This is not an input_context.
#include "browser_input_snapshot.h"

#include <emscripten/heap.h>
#include <map>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace
{
struct synthetic_context {
    std::string category = "FIXTURE_ROOT";
    std::vector<std::string> actions = { "MOVE_N", "MISSING", "DEFAULT" };
    std::map<std::string, std::vector<input_event>> bindings;
    keyboard_mode mode = keyboard_mode::keycode;
};
struct frame {
    synthetic_context context;
    std::unique_ptr<cdda_browser_input_scope> scope;
};
std::vector<std::unique_ptr<frame>> frames;

cdda_browser_context_view read_context( const void *opaque ) noexcept
{
    const auto &context = *static_cast<const synthetic_context *>( opaque );
    cdda_browser_context_view result;
    result.category = &context.category;
    result.registered_actions = &context.actions;
    result.preferred_keyboard_mode = context.mode;
    result.effective_timeout_ms = -1;
    result.registered_any_input = true;
    result.coordinate_input_enabled = false;
    result.iso_mode = false;
    return result;
}

const std::vector<input_event> *read_bindings( const void *opaque,
        const std::string &action, cdda_browser_binding_origin &origin ) noexcept
{
    const auto &context = *static_cast<const synthetic_context *>( opaque );
    const auto found = context.bindings.find( action );
    origin = action == "DEFAULT" ? cdda_browser_binding_origin::default_context :
             found == context.bindings.end() ? cdda_browser_binding_origin::missing :
             cdda_browser_binding_origin::context;
    return found == context.bindings.end() ? nullptr : &found->second;
}

input_event event()
{
    // Default input_event/point constructors are inline in pinned official headers.
    // Avoid the out-of-line input_event(modifiers, key, type) constructor and point constants.
    input_event result;
    result.type = input_event_t::keyboard_code;
    result.modifiers = { keymod_t::ctrl, keymod_t::shift };
    result.sequence = { 97, 13 };
    result.text = u8"山田 <player>\\\"\n\t";
    result.text.push_back( '\0' );
    result.edit = u8"編集中";
    result.edit_refresh = true;
    return result;
}

void prepare( synthetic_context &context, unsigned int case_id )
{
    context.bindings["MOVE_N"] = { event() };
    context.bindings["DEFAULT"] = { event() };
    switch( case_id ) {
        case 1: break;
        case 2: context.category = "FIXTURE_MODAL"; break;
        case 3:
            context.category = "STRING_INPUT";
            context.mode = keyboard_mode::keychar;
            break;
        case 4: context.category = std::string( "\xc0\xaf", 2 ); break;
        case 5: context.category.assign( 16385, 'x' ); break;
        case 6: context.actions.assign( 2049, "MISSING" ); break;
        case 7: context.bindings["MOVE_N"].assign( 129, event() ); break;
        case 8: context.bindings["MOVE_N"][0].sequence.assign( 65, 97 ); break;
        case 9: context.mode = static_cast<keyboard_mode>( 99 ); break;
        case 10: context.bindings["MOVE_N"][0].type = static_cast<input_event_t>( 99 ); break;
        case 11:
            context.bindings["MOVE_N"][0].modifiers.insert( static_cast<keymod_t>( 99 ) );
            break;
        case 12:
            context.actions.assign( 2048, std::string( 256, 'x' ) );
            break;
        case 13: context.category = std::string( "\xed\xa0\x80", 3 ); break;
        case 14: context.category.assign( 16384, 'x' ); break;
        case 15:
            context.actions.clear();
            for( unsigned int index = 0; index < 2048; ++index ) {
                context.actions.push_back( "MISSING_" + std::to_string( index ) );
            }
            break;
        case 16: context.bindings["MOVE_N"].assign( 128, event() ); break;
        case 17: context.bindings["MOVE_N"][0].sequence.assign( 64, 97 ); break;
        case 18: context.category = std::string( "quote\" slash\\ nul\0 end", 22 ); break;
        case 19: context.category = std::string( "\xf4\x90\x80\x80", 4 ); break;
        default: throw std::invalid_argument( "unknown synthetic fixture case" );
    }
}
} // namespace

extern "C" {
unsigned int fixture_push( unsigned int case_id ) noexcept
{
    try {
        // The 65th frame tests the actual module depth guard, not stack exhaustion.
        if( frames.size() >= 65 ) {
            return 0;
        }
        frames.reserve( 65 );
        auto next = std::make_unique<frame>();
        prepare( next->context, case_id );
        next->scope = std::make_unique<cdda_browser_input_scope>(
                          &next->context, read_context, read_bindings );
        frames.push_back( std::move( next ) );
        return static_cast<unsigned int>( frames.size() );
    } catch( ... ) {
        return 0;
    }
}

unsigned int fixture_pop() noexcept
{
    if( frames.empty() ) {
        return 0;
    }
    frames.pop_back();
    return static_cast<unsigned int>( frames.size() );
}

void fixture_clear() noexcept
{
    // Explicit LIFO: std::vector::clear destruction order is not our scope contract.
    while( !frames.empty() ) {
        frames.pop_back();
    }
}

unsigned int fixture_mutate_root() noexcept
{
    if( frames.empty() ) {
        return 0;
    }
    try {
        frames.front()->context.category = "FIXTURE_ROOT_CHANGED";
        frames.front()->context.bindings["MOVE_N"][0].sequence = { 122 };
        return 1;
    } catch( ... ) {
        return 0;
    }
}

unsigned int fixture_heap_bytes() noexcept
{
    return static_cast<unsigned int>( emscripten_get_heap_size() );
}

unsigned int fixture_grow_heap() noexcept
{
    const size_t current = emscripten_get_heap_size();
    // Never request a high-bit address or more than 64 MiB in this fixture.
    if( current >= 64 * 1024 * 1024 - 65536 ) {
        return 0;
    }
    return static_cast<unsigned int>( emscripten_resize_heap( current + 65536 ) );
}
} // extern "C"
