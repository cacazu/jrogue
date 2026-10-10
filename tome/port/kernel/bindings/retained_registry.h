/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_RETAINED_REGISTRY_H
#define TOME_RETAINED_REGISTRY_H

#include "lua.h"

/* Register the actual linked 1.7.6 native modules, in original main.c order.
 * There are deliberately no fallbacks or mock implementations.
 * On failure, the original Lua error object remains at stack top.
 */
int tome_open_original_modules(lua_State *state);

/* Establish original main.c globals (__uids and __SELFEXE) after registration.
 * Call once for a fresh state; do not call on a loaded/live game.
 */
void tome_initialize_original_globals(lua_State *state, const char *self_executable);

/* Seed the original C rng.seed binding; negative seeds are rejected because
 * they request wall-clock seeding upstream. Valid range is 0..INT_MAX.
 */
int tome_seed_original_rng(lua_State *state, unsigned int seed);

/* Load a trusted bundled source file through the original Lua/PhysFS loader.
 * No arbitrary browser-provided Lua code should be passed to this interface.
 */
int tome_run_original_file(lua_State *state, const char *virtual_path);

typedef struct tome_loader_options {
    const char *engine;
    const char *engine_version;
    const char *module;
    const char *save_name;
    int new_game;
    const char *extra_info;
    const char *profile;
} tome_loader_options;

/* The caller mounts the original archives/paths and initializes required
 * platform services before invoking these phases. The functions run original
 * /bootstrap/boot.lua, /loader/pre-init.lua, and /loader/init.lua; they do not
 * construct a replacement Game, Actor, map, campaign, or birth workflow.
 */
int tome_run_original_bootstrap(lua_State *state);
int tome_run_original_preinit(lua_State *state);
int tome_run_original_loader(lua_State *state, const tome_loader_options *options);

#endif
