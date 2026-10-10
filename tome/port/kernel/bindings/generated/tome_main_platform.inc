/* SPDX-License-Identifier: GPL-3.0-or-later
 * Append after the byte-identical original main.c body. Access its private
 * state without removing static or copying original event/game logic.
 */
#include "tome_main_platform.h"

lua_State *tome_main_get_state(void)
{
    return L;
}

int tome_main_attach_state(lua_State *state)
{
    if (!state || (L && L != state)) return 0;
    L = state;
    return 1;
}

int tome_main_initialize_core_metadata(void)
{
    /* Never replace metadata on a live game. The desktop initializer uses
     * exactly these original three operations at main.c:1437-1439.
     */
    if (core_def) return core_def->define == &define_core;
    core_def = calloc(1, sizeof(core_boot_type));
    if (!core_def) return 0;
    core_def->define = &define_core;
    core_def->define(core_def, "te4core", -1, NULL, NULL, NULL, NULL, 0, NULL);
    return core_def->coretype != NULL;
}
