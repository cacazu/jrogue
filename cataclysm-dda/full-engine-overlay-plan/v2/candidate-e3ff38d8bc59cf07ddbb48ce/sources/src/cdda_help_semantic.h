// Source-only preparation against CDDA 0.I-1. CC BY-SA 3.0; see ../NOTICE.md.
#pragma once

#include <array>
#include <cstdint>
#include <optional>
#include <set>
#include <string>
#include <vector>

#include "input_enums.h"

class cata_path;
class input_context;
class JsonObject;
class translation;

namespace cdda_help_semantic
{
inline constexpr const char *source_commit = "7b2efa5cea38e4d4d97dd0e63b28b9148623da59";
inline constexpr const char *help_interface = "cdda-help-observation/1";

// This sidecar is UI metadata. Original translation/state/input tables remain authoritative.
struct topic_metadata {
    std::string name_id;
    // Original message order: controls, grid, movement_cost, melee, doors, safe_mode.
    // A null entry represents the structured grid, never a made-up text ID.
    std::array<std::optional<std::string>, 6> message_ids;
    std::string loaded_source;
    std::string loaded_file;
};

// C++ owned copies; transport serialization is not implemented by this slice.
struct binding_descriptor {
    input_event_t type = input_event_t::error;
    std::set<keymod_t> modifiers;
    std::vector<int> sequence;
    std::string text;
    std::string edit;
    bool edit_refresh = false;
};
// UI policy is kept separate from exact original descriptor metadata.
struct presentation_binding {
    binding_descriptor native;
    bool enabled_for_presentation = false;
    bool single_printable = false;
};

enum class binding_origin : uint8_t { context, default_context, missing };
struct binding_observation {
    std::string category;
    std::string action;
    binding_origin origin = binding_origin::missing;
    std::vector<presentation_binding> bindings;
};

enum class name_kind : uint8_t { semantic, legacy_translation, literal_action_id };
struct name_observation {
    name_kind kind = name_kind::legacy_translation;
    std::string semantic_id;
    std::string literal_action_id;
    std::string source_category;
    // Diagnostic classification only; not presented as translated product text.
    std::string legacy_reason;
};

struct key_parameter {
    std::string name;
    binding_observation value;
};
struct text_observation {
    std::string id;
    // These are KeyBinding records, separate from v1 scalar TextEvent.parameters ({}).
    std::vector<key_parameter> key_parameters;
};
struct grid_cell {
    std::string role;
    std::string action;
    int row = 0;
    int column = 0;
    std::array<std::optional<presentation_binding>, 2> alternatives;
};
struct structured_direction_grid {
    std::string category = "DEFAULTMODE";
    std::array<grid_cell, 9> cells;
};
enum class block_kind : uint8_t { text, structured_direction_grid };
struct help_block {
    block_kind kind = block_kind::text;
    text_observation text;
    structured_direction_grid grid;
};
struct selected_help_observation {
    // Future JSON must serialize this counter as a decimal string, not a JS number.
    uint64_t publication_sequence = 0;
    bool available = false;
    uint32_t schema_version = 1;
    std::string source_commit = cdda_help_semantic::source_commit;
    std::string engine_build_id;
    std::string interface = help_interface;
    text_observation title;
    text_observation topic_name;
    std::string loaded_source;
    std::string loaded_file;
    std::vector<help_block> blocks;
};

// Match only the pinned official owner and exact untranslated field values.
// Changed definitions/other files/user-provided names stay explicitly legacy.
std::string bind_keybinding_name( const cata_path &file, bool user_preferences,
                                 const std::string &category, const std::string &action,
                                 const JsonObject &object ) noexcept;
std::optional<topic_metadata> bind_movement_topic( const cata_path &file,
        const std::string &loaded_source, const translation &name,
        const std::vector<translation> &messages ) noexcept;
bool matches_reviewed_label_override( const std::string &id,
                                     const std::string &category, const std::string &action,
                                     const translation &name ) noexcept;

// Owned descriptor copy from an already existing const binding table.
presentation_binding copy_binding( const input_event &event, bool enabled );
text_observation plain_text( const std::string &id );

// Native consumer hooks call these; exported render/input functions do not.
// Sinks may copy records during the callback; references expire on return.
// This is an internal source interface, not the existing four-export WASM ABI.
using help_sink = void ( * )( const selected_help_observation & );
using name_sink = void ( * )( const name_observation & );
void set_help_sink( help_sink sink ) noexcept;
// Allocation-free failure signal; no borrowed record must be constructed.
using help_failure_sink = void ( * )();
void set_help_failure_sink( help_failure_sink sink ) noexcept;
void set_name_sink( name_sink sink ) noexcept;
void observe_action_name( const input_context &context, const std::string &action ) noexcept;
void observe_topic_name( const topic_metadata &metadata ) noexcept;

// Scoped publication surrounds the original selected-topic display. Destructor clears it.
// Unconverted topics publish unavailable; observations never authorize input commands.
class selected_help_scope final
{
    public:
        explicit selected_help_scope( const topic_metadata *metadata ) noexcept;
        ~selected_help_scope() noexcept;
        selected_help_scope( const selected_help_scope & ) = delete;
        selected_help_scope &operator=( const selected_help_scope & ) = delete;
        selected_help_scope( selected_help_scope && ) = delete;
        selected_help_scope &operator=( selected_help_scope && ) = delete;
};
} // namespace cdda_help_semantic
