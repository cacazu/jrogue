// Uncompiled CDDA browser observer preparation. CC BY-SA 3.0; see ../NOTICE.md.
#pragma once

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
#include <string>
#include <vector>
#include "input_enums.h"

// Internal C++ views only. These pointers never cross the four-export C ABI.
struct cdda_browser_context_view {
    const std::string *category = nullptr;
    const std::vector<std::string> *registered_actions = nullptr;
    keyboard_mode preferred_keyboard_mode = keyboard_mode::keycode;
    int effective_timeout_ms = -1;
    bool registered_any_input = false;
    bool coordinate_input_enabled = false;
    bool iso_mode = false;
};

enum class cdda_browser_binding_origin : uint8_t {
    context,
    default_context,
    missing
};

using cdda_browser_context_reader = cdda_browser_context_view ( * )( const void * ) noexcept;
using cdda_browser_binding_reader = const std::vector<input_event> *( * )(
        const void *, const std::string &, cdda_browser_binding_origin & ) noexcept;

// Constructed on the original handle_input stack, never from an exported call.
// Non-allocating callback arguments inherit the member's original private access.
class cdda_browser_input_scope final
{
    public:
        cdda_browser_input_scope( const void *context, cdda_browser_context_reader context_reader,
                                  cdda_browser_binding_reader binding_reader ) noexcept;
        ~cdda_browser_input_scope() noexcept;
        cdda_browser_input_scope( const cdda_browser_input_scope & ) = delete;
        cdda_browser_input_scope &operator=( const cdda_browser_input_scope & ) = delete;
        cdda_browser_input_scope( cdda_browser_input_scope && ) = delete;
        cdda_browser_input_scope &operator=( cdda_browser_input_scope && ) = delete;

    private:
        void publish() const noexcept;
        const void *context_ = nullptr;
        cdda_browser_context_reader context_reader_ = nullptr;
        cdda_browser_binding_reader binding_reader_ = nullptr;
        cdda_browser_input_scope *parent_ = nullptr;
        uint64_t context_epoch_ = 0;
        uint32_t depth_ = 0;
};

extern "C" {
#define CDDA_BROWSER_SNAPSHOT_NOEXCEPT noexcept
#else
#define CDDA_BROWSER_SNAPSHOT_NOEXCEPT
#endif

// Phase one: kind 1 is the current immutable live-input snapshot only.
// 0 means unavailable, unsupported kind, pin-capacity limit or exhausted handles.
uint32_t cdda_browser_snapshot_pin( uint32_t kind ) CDDA_BROWSER_SNAPSHOT_NOEXCEPT;
// Pointers are read-only and remain valid until this exact handle is released.
// Unknown/expired handles return NULL/0. No original input, draw or RNG call.
const uint8_t *cdda_browser_snapshot_data( uint32_t handle ) CDDA_BROWSER_SNAPSHOT_NOEXCEPT;
size_t cdda_browser_snapshot_size( uint32_t handle ) CDDA_BROWSER_SNAPSHOT_NOEXCEPT;
void cdda_browser_snapshot_release( uint32_t handle ) CDDA_BROWSER_SNAPSHOT_NOEXCEPT;

#ifdef __cplusplus
}
#endif
#undef CDDA_BROWSER_SNAPSHOT_NOEXCEPT
