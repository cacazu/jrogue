/* Minimal CLI entry point for ToME's unchanged bundled Lua interpreter library.
 * The release contains the library sources, but no stock lua.c CLI entry point.
 * This file contains no game rules and does not boot the game.
 */
#include <stdio.h>
#include "lua.h"
#include "lauxlib.h"
#include "lualib.h"

int main(int argc, char **argv) {
    if (argc != 2) {
        fprintf(stderr, "Usage: lua.js fixture.lua\n");
        return 2;
    }
    lua_State *state = luaL_newstate();
    if (!state) {
        fprintf(stderr, "Could not create upstream Lua state\n");
        return 3;
    }
    luaL_openlibs(state);
    int result = luaL_loadfile(state, argv[1]);
    if (!result) result = lua_pcall(state, 0, LUA_MULTRET, 0);
    if (result) fprintf(stderr, "%s\n", lua_tostring(state, -1));
    lua_close(state);
    return result ? 1 : 0;
}
