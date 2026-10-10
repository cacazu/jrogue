/* SPDX-License-Identifier: GPL-3.0-or-later
 * Platform-only scheduling seam for unchanged main.c:on_event/on_tick.
 * Original dispatch: main.c:1704-1727; original on_tick:621-635.
 * This adapter does not implement movement, attacks, energy or actor rules.
 */
#include <string.h>
#include <SDL.h>
#include "lua.h"
#include "lauxlib.h"
#include "types.h"
#include "retained_platform_drain.h"
#include "tome_main_platform.h"

extern int current_game;
extern bool tickPaused;
extern bool isActive;
extern bool exit_engine;
extern bool on_event(SDL_Event *event);
extern void on_tick(void);

int tome_platform_attach_state(lua_State *state)
{
    return tome_main_attach_state(state);
}

static int original_input_type(Uint32 type)
{
    switch (type) {
    case SDL_KEYDOWN:
    case SDL_KEYUP:
    case SDL_TEXTINPUT:
    case SDL_TEXTEDITING:
    case SDL_MOUSEMOTION:
    case SDL_MOUSEBUTTONDOWN:
    case SDL_MOUSEBUTTONUP:
    case SDL_MOUSEWHEEL:
    case SDL_JOYAXISMOTION:
    case SDL_JOYBALLMOTION:
    case SDL_JOYHATMOTION:
    case SDL_JOYBUTTONDOWN:
    case SDL_JOYBUTTONUP:
    case SDL_CONTROLLERAXISMOTION:
    case SDL_CONTROLLERBUTTONDOWN:
    case SDL_CONTROLLERBUTTONUP:
    case SDL_FINGERDOWN:
    case SDL_FINGERUP:
    case SDL_FINGERMOTION:
        return 1;
    default:
        return 0;
    }
}

int tome_platform_drain_input(unsigned int budget, tome_platform_drain_result *result)
{
    SDL_Event event;
    if (!tome_main_get_state() || !result) return 0;
    memset(result, 0, sizeof(*result));
    while (result->input_events < budget && SDL_PollEvent(&event)) {
        if (!original_input_type(event.type)) {
            result->has_system_event = 1;
            result->system_event = event;
            return 1;
        }
        if (on_event(&event)) {
            tickPaused = FALSE;
            result->simulation_woken = 1;
        }
        ++result->input_events;
    }
    return 1;
}

int tome_platform_step_original(void)
{
    if (!tome_main_get_state()) return -1;
    if (exit_engine || !isActive || tickPaused || current_game == LUA_NOREF) return 0;
    on_tick();
    return 1;
}
