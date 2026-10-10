/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Native registration and loader adapter for retained Tales of Maj'Eyal 1.7.6.
 * Original registration sequence: src/main.c:1228-1251 (Nicolas Casalini).
 * Original loader arguments: src/main.c:1333-1341; optional profile is
 * documented by game/loader/init.lua:38.
 * This adapter contains no gameplay replacements and no native-module stubs.
 */
#include <limits.h>
#include "lua.h"
#include "lauxlib.h"
#include "lualib.h"
#include "retained_registry.h"

/* Declarations only. Every implementation must link from retained source.
 * Modules are not considered optional just because a probe does not call them.
 */
extern int luaopen_physfs(lua_State *);
extern int luaopen_core(lua_State *);
extern int luaopen_fov(lua_State *);
extern int luaopen_socket_core(lua_State *);
extern int luaopen_mime_core(lua_State *);
extern int luaopen_struct(lua_State *);
extern int luaopen_profiler(lua_State *);
extern int luaopen_bit(lua_State *);
extern int luaopen_lpeg(lua_State *);
extern int luaopen_lxp(lua_State *);
extern int luaopen_md5_core(lua_State *);
extern int luaopen_map(lua_State *);
extern int luaopen_particles(lua_State *);
extern int luaopen_sound(lua_State *);
extern int luaopen_noise(lua_State *);
extern int luaopen_diamond_square(lua_State *);
extern int luaopen_shaders(lua_State *);
extern int luaopen_serial(lua_State *);
extern int luaopen_profile(lua_State *);
extern int luaopen_zlib(lua_State *);
extern int luaopen_wait(lua_State *);
extern int luaopen_wfc(lua_State *);

static int open_original_modules_protected(lua_State *state)
{
    /* lua_cpcall supplies one private userdata argument; the original native
     * registrations are invoked with the same empty initial stack as boot_lua.
     */
    lua_settop(state, 0);
    luaL_openlibs(state);
    luaopen_physfs(state);
    luaopen_core(state);
    luaopen_fov(state);
    luaopen_socket_core(state);
    luaopen_mime_core(state);
    luaopen_struct(state);
    luaopen_profiler(state);
    luaopen_bit(state);
    luaopen_lpeg(state);
    luaopen_lxp(state);
    luaopen_md5_core(state);
    luaopen_map(state);
    luaopen_particles(state);
    luaopen_sound(state);
    luaopen_noise(state);
    luaopen_diamond_square(state);
    luaopen_shaders(state);
    luaopen_serial(state);
    luaopen_profile(state);
    luaopen_zlib(state);
    luaopen_bit(state);
    luaopen_wait(state);
    luaopen_wfc(state);
    return 0;
}

int tome_open_original_modules(lua_State *state)
{
    return lua_cpcall(state, open_original_modules_protected, NULL);
}

void tome_initialize_original_globals(lua_State *state, const char *self_executable)
{
    lua_newtable(state);
    lua_setglobal(state, "__uids");
    if (self_executable != NULL) lua_pushstring(state, self_executable);
    else lua_pushnil(state);
    lua_setglobal(state, "__SELFEXE");
}

int tome_seed_original_rng(lua_State *state, unsigned int seed)
{
    if (seed > INT_MAX) {
        lua_pushliteral(state, "seed exceeds the nonnegative original C int range");
        return LUA_ERRRUN;
    }
    lua_getglobal(state, "rng");
    if (!lua_istable(state, -1)) {
        lua_pop(state, 1);
        lua_pushliteral(state, "original rng namespace is not registered");
        return LUA_ERRRUN;
    }
    lua_getfield(state, -1, "seed");
    lua_remove(state, -2);
    if (!lua_isfunction(state, -1)) {
        lua_pop(state, 1);
        lua_pushliteral(state, "original rng.seed binding is not registered");
        return LUA_ERRRUN;
    }
    lua_pushnumber(state, seed);
    return lua_pcall(state, 1, 0, 0);
}

int tome_run_original_file(lua_State *state, const char *virtual_path)
{
    int status = luaL_loadfile(state, virtual_path);
    if (status != 0) return status;
    return lua_pcall(state, 0, 0, 0);
}

int tome_run_original_bootstrap(lua_State *state)
{
    return tome_run_original_file(state, "/bootstrap/boot.lua");
}

int tome_run_original_preinit(lua_State *state)
{
    return tome_run_original_file(state, "/loader/pre-init.lua");
}

static void push_string_or_nil(lua_State *state, const char *value)
{
    if (value != NULL) lua_pushstring(state, value);
    else lua_pushnil(state);
}

int tome_run_original_loader(lua_State *state, const tome_loader_options *options)
{
    int status;
    if (options == NULL) {
        lua_pushliteral(state, "original loader options are required");
        return LUA_ERRRUN;
    }
    status = luaL_loadfile(state, "/loader/init.lua");
    if (status != 0) return status;
    push_string_or_nil(state, options->engine);
    push_string_or_nil(state, options->engine_version);
    push_string_or_nil(state, options->module);
    push_string_or_nil(state, options->save_name);
    lua_pushboolean(state, options->new_game);
    push_string_or_nil(state, options->extra_info);
    push_string_or_nil(state, options->profile);
    return lua_pcall(state, 7, 0, 0);
}
