/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_MAIN_PLATFORM_H
#define TOME_MAIN_PLATFORM_H
#include "lua.h"

/* Append-only exports from the original main.c translation unit. No desktop
 * event loop is run by these functions; compile with -Dmain=tome_desktop_main.
 */
lua_State *tome_main_get_state(void);
int tome_main_attach_state(lua_State *state);
int tome_main_initialize_core_metadata(void);
#endif
