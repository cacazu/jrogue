/* SPDX-License-Identifier: GPL-3.0-or-later
 * Append to exact original map.c; main map fields/functions remain original.
 * Source-only; compile/runtime verification belongs to parent integration. */
#include <stdio.h>
#include <string.h>

static uint32_t tome_map_fnv_u32(uint32_t hash, uint32_t value)
{
    unsigned i;
    for (i = 0; i < 4; ++i) { hash ^= (value >> (8*i)) & 255u; hash *= 16777619u; }
    return hash;
}

int tome_map_callback_summary_get(const map_type *map, size_t max_visits,
                                  tome_map_callback_summary *out)
{
    int x, y, z;
    uint32_t hash = 2166136261u;
    if (!out) return 0;
    memset(out, 0, sizeof(*out));
    if (!map || !map->grids || !map->z_callbacks || map->w <= 0 || map->h <= 0 || map->zdepth <= 0 || !max_visits) return 0;
    hash = tome_map_fnv_u32(hash, (uint32_t)map->w);
    hash = tome_map_fnv_u32(hash, (uint32_t)map->h);
    hash = tome_map_fnv_u32(hash, (uint32_t)map->zdepth);
    for (z = 0; z < map->zdepth; ++z) {
        if (out->visits >= max_visits) { out->truncated = 1; goto done; }
        ++out->visits;
        if (map->z_callbacks[z] != LUA_NOREF) {
            ++out->z_callbacks;
            hash = tome_map_fnv_u32(hash, 1u);
            hash = tome_map_fnv_u32(hash, (uint32_t)z);
            hash = tome_map_fnv_u32(hash, (uint32_t)map->z_callbacks[z]);
        }
        for (y = 0; y < map->h; ++y) for (x = 0; x < map->w; ++x) {
            const map_object *object;
            unsigned chain = 0;
            if (out->visits >= max_visits) { out->truncated = 1; goto done; }
            ++out->visits;
            object = map->grids[x][y][z];
            while (object) {
                uint64_t uid;
                if (out->visits >= max_visits) { out->truncated = 1; goto done; }
                ++out->visits;
                if (object->cb_ref != LUA_NOREF) {
                    ++out->object_callbacks;
                    uid = (uint64_t)(int64_t)object->uid;
                    hash = tome_map_fnv_u32(hash, 2u);
                    hash = tome_map_fnv_u32(hash, (uint32_t)x);
                    hash = tome_map_fnv_u32(hash, (uint32_t)y);
                    hash = tome_map_fnv_u32(hash, (uint32_t)z);
                    hash = tome_map_fnv_u32(hash, chain);
                    hash = tome_map_fnv_u32(hash, (uint32_t)uid);
                    hash = tome_map_fnv_u32(hash, (uint32_t)(uid >> 32));
                    hash = tome_map_fnv_u32(hash, (uint32_t)object->cb_ref);
                }
                object = object->next;
                ++chain;
            }
        }
    }
done:
    out->fnv1a = hash;
    return 1;
}

int tome_map_callback_summary_lua(lua_State *L)
{
    map_type *map = (map_type*)auxiliar_checkclass(L, "core{map}", 1);
    lua_Integer budget = luaL_optinteger(L, 2, 65536);
    tome_map_callback_summary result;
    char hex[9];
    if (budget <= 0 || budget > 1048576) return luaL_error(L, "map callback diagnostic budget is outside 1..1048576");
    if (!tome_map_callback_summary_get(map, (size_t)budget, &result)) return luaL_error(L, "map callback diagnostics require a live native map");
    snprintf(hex, sizeof(hex), "%08x", (unsigned)result.fnv1a);
    lua_newtable(L);
#define TOME_MAP_DIAG_NUMBER(key, value) lua_pushnumber(L, (lua_Number)(value)); lua_setfield(L, -2, key)
    TOME_MAP_DIAG_NUMBER("schema", 1);
    TOME_MAP_DIAG_NUMBER("visits", result.visits);
    TOME_MAP_DIAG_NUMBER("object_callbacks", result.object_callbacks);
    TOME_MAP_DIAG_NUMBER("z_callbacks", result.z_callbacks);
#undef TOME_MAP_DIAG_NUMBER
    lua_pushstring(L, hex); lua_setfield(L, -2, "fnv1a");
    lua_pushboolean(L, result.truncated); lua_setfield(L, -2, "truncated");
    return 1;
}

int tome_map_callback_ref_lua(lua_State *L)
{
    map_type *map = (map_type*)auxiliar_checkclass(L, "core{map}", 1);
    int x = luaL_checkinteger(L, 2), y = luaL_checkinteger(L, 3), z = luaL_checkinteger(L, 4);
    lua_Integer index = luaL_optinteger(L, 5, 0);
    const map_object *object;
    lua_Integer i;
    if (!map->grids || x < 0 || x >= map->w || y < 0 || y >= map->h || z < 0 || z >= map->zdepth || index < 0 || index > 1024)
        return luaL_error(L, "invalid native map callback diagnostic location");
    object = map->grids[x][y][z];
    for (i = 0; object && i < index; ++i) object = object->next;
    if (!object) { lua_pushnil(L); return 1; }
    lua_pushinteger(L, object->cb_ref);
    lua_pushnumber(L, (lua_Number)object->uid);
    return 2;
}

int tome_map_fov_prepared_guard(lua_State *L)
{
    int base = lua_gettop(L), boundary, game, enabled;
    lua_getglobal(L, "__TOME_WEB_RENDER_BOUNDARY");
    if (!lua_istable(L, -1)) { lua_settop(L, base); return 0; }
    boundary = base + 1;
    lua_getglobal(L, "game");
    game = base + 2;
    lua_getfield(L, boundary, "enabled");
    if (!lua_isfunction(L, -1)) return luaL_error(L, "render boundary enabled method missing");
    lua_pushvalue(L, boundary); lua_pushvalue(L, game);
    lua_call(L, 2, 1);
    enabled = lua_toboolean(L, -1);
    lua_pop(L, 1);
    if (!enabled) { lua_settop(L, base); return 0; }
    lua_getfield(L, boundary, "assertNativePrepared");
    if (!lua_isfunction(L, -1)) return luaL_error(L, "native FOV preparation guard missing");
    lua_pushvalue(L, boundary); lua_pushvalue(L, game);
    lua_pushvalue(L, 1); /* actual retained native map receiver */
    lua_call(L, 3, 0);
    lua_settop(L, base);
    return 1;
}
