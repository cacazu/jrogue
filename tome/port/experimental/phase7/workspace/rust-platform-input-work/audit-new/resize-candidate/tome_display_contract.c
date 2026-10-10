/* SPDX-License-Identifier: GPL-3.0-or-later
 * Source-only additive platform diagnostics; no resize, draw, event pump, or RNG.
 * Parent compiles only into a distinct physical-input variant.
 */
#include <emscripten/emscripten.h>
#include <math.h>
#include <stdio.h>
#include "lua.h"
#include "lauxlib.h"
#include "types.h"
#include "display.h"
#include "main.h"
#include "tome_main_platform.h"
#include "checkpoint_gate.h"

extern SDL_Window *window;
extern SDL_GLContext maincontext;
extern int current_game;
extern int tome_physical_busy(void);

static char display_contract[1024];

EM_JS(int, tome_display_canvas_value, (int field), {
    const canvas = Module['canvas'];
    if (!canvas) return -1;
    if (field === 0) return canvas.width;
    if (field === 1) return canvas.height;
    if (field === 2) return typeof GLctx !== 'undefined' && GLctx ? GLctx.drawingBufferWidth : -1;
    if (field === 3) return typeof GLctx !== 'undefined' && GLctx ? GLctx.drawingBufferHeight : -1;
    if (field === 4) return typeof document !== 'undefined' && document.querySelector('#canvas') === canvas ? 1 : 0;
    if (field === 5) return typeof GLctx !== 'undefined' && GLctx && GLctx.canvas === canvas ? 1 : 0;
    if (field === 6) return typeof GLctx !== 'undefined' && GLctx && GLctx.getParameter(GLctx.FRAMEBUFFER_BINDING) === null ? 1 : 0;
    return -1;
});

/* Actual fresh-state proof before any native initializer can create SDL/GL state. */
EMSCRIPTEN_KEEPALIVE int tome_platform_canvas_fresh(void) {
    return !window && !screen && !maincontext;
}

static int raw_game_size(double *width, double *height) {
    lua_State *state = tome_main_get_state();
    if (!state || current_game == LUA_NOREF) return 0;
    int top = lua_gettop(state), known = 0;
    lua_rawgeti(state, LUA_REGISTRYINDEX, current_game);
    if (lua_istable(state, -1)) {
        lua_pushliteral(state, "w"); lua_rawget(state, -2);
        lua_pushliteral(state, "h"); lua_rawget(state, -3);
        if (lua_type(state, -2) == LUA_TNUMBER && lua_type(state, -1) == LUA_TNUMBER) {
            *width = lua_tonumber(state, -2);
            *height = lua_tonumber(state, -1);
            known = isfinite(*width) && isfinite(*height) && *width > 0 && *height > 0;
        }
    }
    lua_settop(state, top);
    if (!known) { *width = 0; *height = 0; }
    return known;
}

/* Call at a completed original root-frame boundary, outside the Rust-only heap
 * comparison bracket. Getter writes only diagnostic scratch/native Lua stack.
 * Do not call SDL_GetWindowSurface: refreshing it would mutate platform state.
 */
EMSCRIPTEN_KEEPALIVE const char *tome_platform_display_contract(void) {
    if (!window || !screen || !maincontext || !isfinite(screen_zoom) || screen_zoom <= 0) {
        return "{\"protocol\":1,\"error_id\":\"platform.resize.unavailable\"}";
    }
    int width = 0, height = 0;
    GLint viewport[4] = {0, 0, 0, 0};
    double game_width = 0, game_height = 0;
    SDL_GetWindowSize(window, &width, &height);
    glGetIntegerv(GL_VIEWPORT, viewport);
    int game_known = raw_game_size(&game_width, &game_height);
    snprintf(display_contract, sizeof(display_contract),
        "{\"protocol\":1,\"window_width\":%d,\"window_height\":%d,"
        "\"screen_width\":%d,\"screen_height\":%d,\"screen_zoom\":%.9g,"
        "\"logical_width\":%.17g,\"logical_height\":%.17g,"
        "\"game_known\":%s,\"game_width\":%.17g,\"game_height\":%.17g,"
        "\"canvas_width\":%d,\"canvas_height\":%d,"
        "\"drawing_buffer_width\":%d,\"drawing_buffer_height\":%d,"
        "\"selector_matches\":%s,\"context_matches\":%s,\"framebuffer_default\":%s,"
        "\"viewport\":[%d,%d,%d,%d],"
        "\"input_busy\":%s,\"checkpoint_busy\":%s}",
        width, height, screen->w, screen->h, (double)screen_zoom,
        (double)(screen->w / screen_zoom), (double)(screen->h / screen_zoom),
        game_known ? "true" : "false", game_width, game_height,
        tome_display_canvas_value(0), tome_display_canvas_value(1),
        tome_display_canvas_value(2), tome_display_canvas_value(3),
        tome_display_canvas_value(4) == 1 ? "true" : "false",
        tome_display_canvas_value(5) == 1 ? "true" : "false",
        tome_display_canvas_value(6) == 1 ? "true" : "false",
        viewport[0], viewport[1], viewport[2], viewport[3],
        tome_physical_busy() ? "true" : "false",
        tome_web_checkpoint_busy() ? "true" : "false");
    return display_contract; /* Borrowed buffer: copy/parse immediately. */
}
