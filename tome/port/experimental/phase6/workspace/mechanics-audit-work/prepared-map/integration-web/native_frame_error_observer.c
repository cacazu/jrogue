/* SPDX-License-Identifier: GPL-3.0-or-later
 * Isolated diagnostic ABI. Preserve original error ownership and popup queue.
 * main.c120 owns the head; traceback200..218 records a swallowed draw error.
 * main.h93 declares it extern. No Lua call, queue consumption, time or RNG.
 */
#include "lua.h"
#include "display.h"
#include "types.h"
#include "main.h"
#include <emscripten/emscripten.h>
#include <stddef.h>

EMSCRIPTEN_KEEPALIVE int tome_native_prepared_map_lua_error_pending(void) {
    return last_lua_error_head != NULL;
}
/* Borrowed copied diagnostics; copy immediately. This buffer is not a domain
 * state field and is excluded from the packet-getter full-memory comparison. */
EMSCRIPTEN_KEEPALIVE const char *tome_native_prepared_map_lua_error_message(void) {
    static char diagnostic[8192];
    const char *message = last_lua_error_head ? last_lua_error_head->err_msg : NULL;
    size_t count = 0;
    if (message) while (count < sizeof(diagnostic)-1 && message[count]) {
        diagnostic[count] = message[count]; count++;
    }
    diagnostic[count] = 0;
    return diagnostic;
}
