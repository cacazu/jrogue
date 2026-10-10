/* Parse the boot adapter using the unchanged official Lua 5.1 parser.
 * Deliberately do not execute the parsed chunk or invent native game bindings. */
#include <stdio.h>
#include "lua.h"
#include "lauxlib.h"

int main(void) {
    lua_State *state = luaL_newstate();
    if (!state) return 2;
    int result = luaL_loadfile(state, "/real-core-probe.lua");
    if (result) fprintf(stderr, "%s\n", lua_tostring(state, -1));
    else printf("TOME_REAL_CORE_PROBE_LUA51_SYNTAX_OK\n");
    lua_close(state);
    return result ? 1 : 0;
}
