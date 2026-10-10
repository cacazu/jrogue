// Source-only preparation against CDDA 0.I-1. CC BY-SA 3.0; see ../NOTICE.md.
#include "cdda_help_semantic.h"

#include <algorithm>
#include <cctype>
#include <limits>
#include <stdexcept>
#include <utility>

#include "cata_path.h"
#include "flexbuffer_json.h"
#include "game.h"
#include "input_context.h"
#include "path_info.h"
#include "translation.h"

#include "reviewed_definitions.inc"

#ifndef CDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID
#error "The isolated semantic integration build must supply its exact browser build identity."
#endif

namespace cdda_help_semantic
{
namespace
{
help_sink active_help_sink = nullptr;
name_sink active_name_sink = nullptr;
bool in_callback = false;
uint64_t publication_sequence = 0;

void send_help( selected_help_observation &observation ) noexcept
{
    if( active_help_sink == nullptr || in_callback ) {
        return;
    }
    try {
        observation.engine_build_id = CDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID;
    } catch( ... ) {
        return;
    }
    if( publication_sequence == std::numeric_limits<uint64_t>::max() ) {
        observation.available = false;
        observation.publication_sequence = 0;
    } else {
        observation.publication_sequence = ++publication_sequence;
    }
    in_callback = true;
    try {
        active_help_sink( observation );
    } catch( ... ) {
        // Observer failures cannot change original help or escape into its input loop.
    }
    in_callback = false;
}

void send_name( const name_observation &observation ) noexcept
{
    if( active_name_sink == nullptr || in_callback ) {
        return;
    }
    in_callback = true;
    try {
        active_name_sink( observation );
    } catch( ... ) {
    }
    in_callback = false;
}

void publish_unavailable() noexcept
{
    try {
        selected_help_observation unavailable;
        send_help( unavailable );
    } catch( ... ) {
        // Even an inability to allocate the unavailable envelope is observer-only.
        // A future transport must invalidate host state on pin/publication failure.
    }
}

text_observation capture_text( const std::string &id, const input_context &context )
{
    text_observation observation = plain_text( id );
    for( const reviewed_press &binding : reviewed_press_parameters ) {
        if( id == binding.id ) {
            observation.key_parameters.push_back( {
                binding.parameter, context.observe_semantic_bindings( binding.action )
            } );
        }
    }
    return observation;
}

structured_direction_grid capture_grid( const input_context &context )
{
    structured_direction_grid grid;
    for( size_t i = 0; i < reviewed_grid_cells.size(); ++i ) {
        const reviewed_grid_cell &source = reviewed_grid_cells[i];
        grid_cell &cell = grid.cells[i];
        cell.role = source.role;
        cell.action = source.action;
        cell.row = source.row;
        cell.column = source.column;
        const binding_observation bindings = context.observe_semantic_bindings( source.action );
        size_t selected = 0;
        for( const presentation_binding &binding : bindings.bindings ) {
            const bool keyboard = binding.native.type == input_event_t::keyboard_char ||
                                  binding.native.type == input_event_t::keyboard_code;
            // Exact original grid policy: enabled keyboard, one printable code, no modifiers.
            if( keyboard && binding.enabled_for_presentation && binding.native.sequence.size() == 1 &&
                binding.native.modifiers.empty() && binding.single_printable ) {
                cell.alternatives[selected++] = binding;
                if( selected == cell.alternatives.size() ) {
                    break;
                }
            }
        }
    }
    return grid;
}
} // namespace

std::string bind_keybinding_name( const cata_path &file, const bool user_preferences,
                                 const std::string &category, const std::string &action,
                                 const JsonObject &object ) noexcept
{
    try {
        if( user_preferences || !( file == PATH_INFO::keybindings() ) || !object.has_string( "name" ) ) {
            return {};
        }
        for( const reviewed_label &label : reviewed_labels ) {
            if( category == label.category && action == label.action &&
                object.get_string( "name" ) == label.singular ) {
                return label.id;
            }
        }
    } catch( ... ) {
    }
    return {};
}

std::optional<topic_metadata> bind_movement_topic( const cata_path &file,
        const std::string &loaded_source, const translation &name,
        const std::vector<translation> &messages ) noexcept
{
    try {
        if( !( file == PATH_INFO::jsondir() / "help.json" ) ||
            name != translation::to_translation( "Movement" ) ||
            messages.size() != reviewed_movement_messages.size() ) {
            return std::nullopt;
        }
        for( size_t i = 0; i < messages.size(); ++i ) {
            // This operator compares raw/context/plural/no-translation fields; no gettext call.
            if( messages[i] != translation::to_translation( reviewed_movement_messages[i] ) ) {
                return std::nullopt;
            }
        }
        topic_metadata metadata;
        metadata.name_id = "help.core.movement.name";
        for( size_t i = 0; i < metadata.message_ids.size(); ++i ) {
            if( reviewed_movement_ids[i] != nullptr ) {
                metadata.message_ids[i] = reviewed_movement_ids[i];
            }
        }
        metadata.loaded_source = loaded_source;
        metadata.loaded_file = file.generic_u8string();
        return metadata;
    } catch( ... ) {
        return std::nullopt;
    }
}

bool matches_reviewed_label_override( const std::string &id,
                                     const std::string &category, const std::string &action,
                                     const translation &name ) noexcept
{
    try {
        return std::any_of( reviewed_labels.begin(), reviewed_labels.end(),
        [&]( const reviewed_label &label ) {
            return id == label.id && category == label.category && action == label.action &&
                   name == translation::to_translation( label.singular );
        } );
    } catch( ... ) {
        return false;
    }
}

presentation_binding copy_binding( const input_event &event, const bool enabled )
{
    if( event.sequence.size() > 64 || event.text.size() > 16384 || event.edit.size() > 16384 ) {
        throw std::length_error( "help semantic binding exceeds source-preparation limit" );
    }
    presentation_binding binding;
    binding.native.type = event.type;
    binding.native.modifiers = event.modifiers;
    binding.native.sequence = event.sequence;
    binding.native.text = event.text;
    binding.native.edit = event.edit;
    binding.native.edit_refresh = event.edit_refresh;
    binding.enabled_for_presentation = enabled;
    if( event.sequence.size() == 1 ) {
        const int key = event.sequence.front();
        // Original printable predicate for valid nonnegative native key values.
        // Reject a negative code rather than introducing C isprint undefined behavior.
        binding.single_printable = key >= 0 && key < 0xFF && key != ' ' &&
                                   std::isprint( static_cast<unsigned char>( key ) ) != 0;
    }
    return binding;
}

text_observation plain_text( const std::string &id )
{
    text_observation observation;
    observation.id = id;
    return observation;
}

void set_help_sink( const help_sink sink ) noexcept
{
    active_help_sink = sink;
}
void set_name_sink( const name_sink sink ) noexcept
{
    active_name_sink = sink;
}
void observe_action_name( const input_context &context, const std::string &action ) noexcept
{
    if( active_name_sink == nullptr || in_callback ) {
        return;
    }
    try {
        send_name( context.get_semantic_action_name( action ) );
    } catch( ... ) {
    }
}
void observe_topic_name( const topic_metadata &metadata ) noexcept
{
    if( active_name_sink == nullptr || in_callback ) {
        return;
    }
    try {
        name_observation observation;
        observation.kind = name_kind::semantic;
        observation.semantic_id = metadata.name_id;
        send_name( observation );
    } catch( ... ) {
    }
}

selected_help_scope::selected_help_scope( const topic_metadata *metadata ) noexcept
{
    if( active_help_sink == nullptr || in_callback ) {
        return;
    }
    try {
        if( metadata == nullptr ) {
            publish_unavailable();
            return;
        }
        // Original helper supplies the exact DEFAULTMODE/keycode/iso context at this native
        // selected-help consumer boundary. It is never called by Rust rendering/observation.
        const input_context movement_context = get_default_mode_input_context();
        selected_help_observation observation;
        observation.available = true;
        observation.title = plain_text( "ui.help.title" );
        observation.topic_name = plain_text( metadata->name_id );
        observation.loaded_source = metadata->loaded_source;
        observation.loaded_file = metadata->loaded_file;
        for( const std::optional<std::string> &id : metadata->message_ids ) {
            help_block block;
            if( id.has_value() ) {
                block.text = capture_text( *id, movement_context );
            } else {
                block.kind = block_kind::structured_direction_grid;
                block.grid = capture_grid( movement_context );
            }
            observation.blocks.push_back( std::move( block ) );
        }
        send_help( observation );
    } catch( ... ) {
        publish_unavailable();
    }
}

selected_help_scope::~selected_help_scope() noexcept
{
    publish_unavailable();
}
} // namespace cdda_help_semantic
