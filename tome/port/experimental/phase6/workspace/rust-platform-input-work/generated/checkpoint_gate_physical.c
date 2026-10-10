/* SPDX-License-Identifier: GPL-3.0-or-later */
#include <string.h>
#include <emscripten/emscripten.h>
#include "lauxlib.h"
#include "checkpoint_gate.h"

static char current_generation[129];
static int current_mode;
static int valid_generation(const char *text) {
    if (!text) return 0;
    size_t n = strnlen(text, sizeof(current_generation));
    if (!n || n >= sizeof(current_generation)) return 0;
    for (size_t i = 0; i < n; ++i) {
        unsigned char c = (unsigned char)text[i];
        if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
              (c >= '0' && c <= '9') || c == '_' || c == '-')) return 0;
    }
    return 1;
}
EMSCRIPTEN_KEEPALIVE int tome_web_checkpoint_busy(void) { return current_mode != 0; }
EMSCRIPTEN_KEEPALIVE int tome_web_checkpoint_mode(void) { return current_mode; }
int tome_web_checkpoint_held(const char *generation) {
    return current_mode && generation && !strcmp(current_generation, generation);
}
extern int tome_physical_busy(void);
static int acquire(lua_State *L) {
    const char *generation = luaL_checkstring(L, 1);
    int mode = luaL_checkint(L, 2);
    int ok = !current_mode && !tome_physical_busy() && valid_generation(generation) &&
        mode >= TOME_CHECKPOINT_BASELINE_SAVE && mode <= TOME_CHECKPOINT_STRICT_RESUME;
    if (ok) {
        strcpy(current_generation, generation);
        current_mode = mode;
    }
    lua_pushboolean(L, ok);
    return 1;
}
static int held(lua_State *L) {
    lua_pushboolean(L, tome_web_checkpoint_held(luaL_checkstring(L, 1)));
    return 1;
}
static int release(lua_State *L) {
    int ok = tome_web_checkpoint_held(luaL_checkstring(L, 1));
    if (ok) { current_generation[0] = '\0'; current_mode = 0; }
    lua_pushboolean(L, ok);
    return 1;
}
int tome_web_checkpoint_gate_install(lua_State *L) {
    int top = lua_gettop(L);
    lua_getglobal(L, "core");
    if (!lua_istable(L, -1)) { lua_settop(L, top); return 0; }
    lua_getfield(L, -1, "game");
    if (!lua_istable(L, -1)) { lua_settop(L, top); return 0; }
    lua_pushcfunction(L, acquire); lua_setfield(L, -2, "browserCheckpointAcquire");
    lua_pushcfunction(L, held); lua_setfield(L, -2, "browserCheckpointHeld");
    lua_pushcfunction(L, release); lua_setfield(L, -2, "browserCheckpointRelease");
    lua_settop(L, top);
    return 1;
}
