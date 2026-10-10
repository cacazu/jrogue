// CC BY-SA 3.0; source preparation against CDDA 0.I-1. See ../NOTICE.md.
#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

#include "cdda_help_semantic.h"

namespace cdda_help_transport
{
// Engine-thread-only attachment at the original help consumer. No command authority.
// The dedicated help sink is owned by this integration; no unrelated sink is replaced.
void attach() noexcept;
// Allocation-free observer failure path: clear current, retain immutable old pins.
void invalidate() noexcept;
// Immediate borrowed callback -> checked owned bytes. Exposed for a focused native fixture.
void publish( const cdda_help_semantic::selected_help_observation &observation ) noexcept;
// Throws on unsupported identity, shape, UTF-8 or bounds. Does not query the game.
std::string encode( const cdda_help_semantic::selected_help_observation &observation );
}

extern "C" {
uint32_t cdda_help_snapshot_pin() noexcept;
const uint8_t *cdda_help_snapshot_data( uint32_t handle ) noexcept;
size_t cdda_help_snapshot_size( uint32_t handle ) noexcept;
void cdda_help_snapshot_release( uint32_t handle ) noexcept;
}
