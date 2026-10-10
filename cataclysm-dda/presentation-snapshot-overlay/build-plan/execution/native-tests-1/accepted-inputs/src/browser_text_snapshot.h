// Source-only original CDDA text-presentation observer. See ../NOTICE.md.
#pragma once
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
namespace catacurses { class window; }
class Font;
struct point;

enum class cdda_text_font_role : uint32_t { ui = 1, map = 2, overmap = 3, unknown = 4 };

// Called only by original SDL producers on the existing engine thread.
// Views are copied synchronously; no native pointer is retained or exported.
void cdda_text_observe_window( const catacurses::window &window, const Font &font,
                              cdda_text_font_role role, const point &glyph_offset,
                              const point &clip_size, int scaling_factor,
                              bool ascii_lines_option ) noexcept;
// Original refresh_display calls this only after restoring display_buffer.
// This publishes an ordered text-submission batch, never a complete canvas.
void cdda_text_present_committed() noexcept;

extern "C" {
#define CDDA_TEXT_NOEXCEPT noexcept
#else
#define CDDA_TEXT_NOEXCEPT
#endif

// Independent family: cdda-native-text-submissions/1, notice kind 2.
// Immutable historical bytes; no input, redraw, RNG or simulation export.
uint32_t cdda_text_snapshot_pin( void ) CDDA_TEXT_NOEXCEPT;
const uint8_t *cdda_text_snapshot_data( uint32_t handle ) CDDA_TEXT_NOEXCEPT;
size_t cdda_text_snapshot_size( uint32_t handle ) CDDA_TEXT_NOEXCEPT;
void cdda_text_snapshot_release( uint32_t handle ) CDDA_TEXT_NOEXCEPT;

#ifdef __cplusplus
}
#endif
#undef CDDA_TEXT_NOEXCEPT
