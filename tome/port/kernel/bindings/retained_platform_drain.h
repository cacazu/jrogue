/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_RETAINED_PLATFORM_DRAIN_H
#define TOME_RETAINED_PLATFORM_DRAIN_H
#include <SDL.h>
#include "lua.h"

typedef struct tome_platform_drain_result {
    unsigned int input_events;
    int simulation_woken;
    int has_system_event;
    SDL_Event system_event;
} tome_platform_drain_result;

/* Attach a fresh real state to original main.c's event/tick dispatch. The
 * original platform runtime and current handler references must already be
 * initialized. This does not reset any gameplay state or RNG cache.
 */
int tome_platform_attach_state(lua_State *state);

/* Drain only original keyboard/mouse/text input callbacks. A window, quit,
 * audio, redraw, or timer event is returned unchanged for the host platform
 * layer to process; it is not silently discarded or replaced with a mock.
 * This function never advances simulation or redraws.
 */
int tome_platform_drain_input(unsigned int budget, tome_platform_drain_result *result);

/* Advance at most one original main.c:on_tick dispatch, respecting the same
 * paused/active/exit/current-game gates used by its main loop. Returns 1 if a
 * tick was dispatched, 0 if gated, -1 if the real state is unattached.
 */
int tome_platform_step_original(void);
#endif
