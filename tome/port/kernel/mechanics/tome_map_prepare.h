/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_MAP_PREPARE_H
#define TOME_MAP_PREPARE_H
#include <stddef.h>
#include <stdint.h>
#include "lua.h"
#include "map.h"

/* Read-only diagnostics; registry refs are opaque and process-local.
 * FNV-1a is an accidental-change fingerprint, not a gameplay/purity proof. */
typedef struct {
    uint32_t fnv1a;
    size_t visits, object_callbacks, z_callbacks;
    int truncated;
} tome_map_callback_summary;

int tome_map_callback_summary_get(const map_type *map, size_t max_visits,
                                  tome_map_callback_summary *out);
int tome_map_callback_summary_lua(lua_State *L);
int tome_map_callback_ref_lua(lua_State *L);
/* Called only from retained map_to_screen with its native receiver at index 1.
 * Returns 0 for original baseline, 1 for an enabled/proved native-tail FOV guard.
 * Does not execute FOV, callbacks, RNG or a substitute gameplay implementation. */
int tome_map_fov_prepared_guard(lua_State *L);
#endif
