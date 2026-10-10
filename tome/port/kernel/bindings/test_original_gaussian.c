/* SPDX-License-Identifier: GPL-3.0-or-later
 * Characterization executable only. Runs original core_lua.c rnglib callbacks
 * in the original Lua interpreter and original SFMT, including the original
 * Box-Muller cached-pair and rng.seed semantics. No game/domain substitutes.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "lua.h"
#include "lauxlib.h"
#include "lualib.h"
#include "tome_normal_snapshot.h"
#include "tome_rng_snapshot.h"
#include "tome_libc_rng_snapshot.h"
#include "tome_combined_rng_snapshot.h"

extern int tome_test_open_original_rng(lua_State *state);
static unsigned int assertions;
#define CHECK(expression) do { \
    if (!(expression)) { fprintf(stderr, "FAIL line %d: %s\n", __LINE__, #expression); exit(1); } \
    ++assertions; \
} while (0)

static uint64_t number_bits(double value)
{
    uint64_t bits;
    memcpy(&bits, &value, sizeof(bits));
    return bits;
}

static void push_original_rng(lua_State *state, const char *name)
{
    lua_getglobal(state, "rng");
    lua_getfield(state, -1, name);
    lua_remove(state, -2);
    CHECK(lua_isfunction(state, -1));
}

static void seed_original(lua_State *state, unsigned int seed)
{
    push_original_rng(state, "seed");
    lua_pushnumber(state, seed);
    CHECK(lua_pcall(state, 1, 0, 0) == 0);
    CHECK(lua_gettop(state) == 0);
}

static uint64_t original_draw(lua_State *state, unsigned int index)
{
    const char *name;
    int argument_count;
    switch (index % 7) {
    case 0: name = "normalFloat"; argument_count = 2; break;
    case 1: name = "range"; argument_count = 2; break;
    case 2: name = "chance"; argument_count = 1; break;
    case 3: name = "percent"; argument_count = 1; break;
    case 4: name = "normalFloat"; argument_count = 2; break;
    case 5: name = "normal"; argument_count = 2; break;
    default: name = "float"; argument_count = 2; break;
    }
    push_original_rng(state, name);
    switch (index % 7) {
    case 0: lua_pushnumber(state, -3.125); lua_pushnumber(state, 2.75); break;
    case 1: lua_pushnumber(state, -31.75); lua_pushnumber(state, 72.25); break;
    case 2: lua_pushnumber(state, 7); break;
    case 3: lua_pushnumber(state, 37.9); break;
    case 4: lua_pushnumber(state, 1024.125); lua_pushnumber(state, 0.375); break;
    case 5: lua_pushnumber(state, 11); lua_pushnumber(state, 3); break;
    default: lua_pushnumber(state, -2.5); lua_pushnumber(state, 8.125); break;
    }
    CHECK(lua_pcall(state, argument_count, 1, 0) == 0);
    CHECK(lua_gettop(state) == 1);
    CHECK(lua_isnumber(state, -1) || lua_isboolean(state, -1));
    double value = lua_isboolean(state, -1) ? lua_toboolean(state, -1) : lua_tonumber(state, -1);
    lua_pop(state, 1);
    return number_bits(value);
}

static uint64_t original_math_draw(lua_State *state, unsigned int index)
{
    lua_getglobal(state, "math");
    lua_getfield(state, -1, "random");
    lua_remove(state, -2);
    CHECK(lua_isfunction(state, -1));
    int argument_count = (int)(index % 3);
    if (argument_count == 1) lua_pushnumber(state, 17);
    if (argument_count == 2) { lua_pushnumber(state, -29); lua_pushnumber(state, 93); }
    CHECK(lua_pcall(state, argument_count, 1, 0) == 0);
    CHECK(lua_gettop(state) == 1);
    CHECK(lua_isnumber(state, -1));
    uint64_t bits = number_bits(lua_tonumber(state, -1));
    lua_pop(state, 1);
    return bits;
}

static void seed_original_math(lua_State *state, unsigned int seed_value)
{
    lua_getglobal(state, "math");
    lua_getfield(state, -1, "randomseed");
    lua_remove(state, -2);
    CHECK(lua_isfunction(state, -1));
    lua_pushnumber(state, seed_value);
    CHECK(lua_pcall(state, 1, 0, 0) == 0);
    CHECK(lua_gettop(state) == 0);
}

static void save_components(uint8_t *sfmt, size_t sfmt_size, uint8_t normal[36], uint8_t libc[28])
{
    CHECK(tome_rng_snapshot_write(sfmt, sfmt_size));
    CHECK(tome_normal_snapshot_write(normal, 36));
    CHECK(tome_libc_rng_snapshot_write(libc, 28));
}

static int restore_components(const uint8_t *sfmt, size_t sfmt_size, const uint8_t normal[36], const uint8_t libc[28])
{
    return tome_combined_rng_restore(sfmt, sfmt_size, normal, 36, libc, 28);
}

static uint32_t checksum(const uint8_t *bytes, size_t length)
{
    uint32_t hash = UINT32_C(2166136261);
    for (size_t index = 0; index < length; ++index) { hash ^= bytes[index]; hash *= UINT32_C(16777619); }
    return hash;
}

static void set_checksum(uint8_t normal[36])
{
    uint32_t value = checksum(normal, 32);
    for (size_t index = 0; index < 4; ++index) normal[32 + index] = (uint8_t)(value >> (index * 8));
}

int main(void)
{
    lua_State *state = luaL_newstate();
    CHECK(state != NULL);
    CHECK(tome_test_open_original_rng(state));
    CHECK(luaopen_math(state) == 1);
    lua_settop(state, 0);
    size_t sfmt_size = tome_rng_snapshot_size();
    CHECK(sfmt_size == 2524);
    CHECK(tome_normal_snapshot_size() == 36);
    CHECK(tome_libc_rng_snapshot_size() == 28);
    uint8_t *sfmt = malloc(sfmt_size), *after = malloc(sfmt_size);
    CHECK(sfmt && after);
    uint8_t normal[36], normal_after[36], malformed[36];
    uint8_t libc[28], libc_after[28], libc_malformed[28];
    uint64_t expected[1000], expected_math[1000];

    /* Preserve musl's unsigned-int subtraction before assignment to uint64:
     * srand(0) stores 0x00000000ffffffff, while srand(1) stores zero.
     */
    seed_original_math(state, 0);
    CHECK(tome_libc_rng_snapshot_write(libc, 28));
    CHECK(memcmp(libc, "TOMELCG1", 8) == 0);
    CHECK(libc[8] == 1 && libc[9] == 0 && libc[10] == 0 && libc[11] == 0);
    CHECK(libc[12] == 1 && libc[13] == 0 && libc[14] == 0 && libc[15] == 0);
    for (unsigned int index = 16; index < 20; ++index) CHECK(libc[index] == 0xff);
    for (unsigned int index = 20; index < 24; ++index) CHECK(libc[index] == 0);
    seed_original_math(state, 1);
    CHECK(tome_libc_rng_snapshot_write(libc, 28));
    for (unsigned int index = 16; index < 24; ++index) CHECK(libc[index] == 0);

    for (unsigned int checkpoint = 0; checkpoint < 24; ++checkpoint) {
        seed_original(state, checkpoint * 7919 + 17);
        seed_original_math(state, checkpoint * 3571 + 31);
        for (unsigned int warmup = 0; warmup <= checkpoint; ++warmup) {
            (void)original_draw(state, warmup);
            (void)original_math_draw(state, warmup);
        }
        save_components(sfmt, sfmt_size, normal, libc);
        for (unsigned int index = 0; index < 1000; ++index) {
            expected[index] = original_draw(state, index);
            expected_math[index] = original_math_draw(state, index);
        }
        CHECK(restore_components(sfmt, sfmt_size, normal, libc));
        for (unsigned int index = 0; index < 1000; ++index) {
            CHECK(original_draw(state, index) == expected[index]);
            CHECK(original_math_draw(state, index) == expected_math[index]);
        }
    }

    /* Original rng.seed must preserve an odd cached pair and the next cached
     * normalFloat must consume no newly seeded SFMT value.
     */
    seed_original(state, 20261002);
    CHECK(tome_normal_snapshot_write(normal, 36));
    if (normal[12] == 1) (void)original_draw(state, 0);
    (void)original_draw(state, 0);
    CHECK(tome_normal_snapshot_write(normal, 36));
    CHECK(normal[12] == 1);
    seed_original(state, 91234);
    CHECK(tome_normal_snapshot_write(normal_after, 36));
    CHECK(memcmp(normal, normal_after, 36) == 0);
    CHECK(tome_rng_snapshot_write(sfmt, sfmt_size));
    uint64_t z1_bits = 0;
    for (unsigned int index = 0; index < 8; ++index) z1_bits |= (uint64_t)normal[24 + index] << (index * 8);
    double z1;
    memcpy(&z1, &z1_bits, sizeof(z1));
    CHECK(original_draw(state, 4) == number_bits(z1 * 0.375 + 1024.125));
    CHECK(tome_rng_snapshot_write(after, sfmt_size));
    CHECK(memcmp(sfmt, after, sfmt_size) == 0);

    save_components(sfmt, sfmt_size, normal, libc);
    for (unsigned int byte = 0; byte < 36; ++byte) {
        memcpy(malformed, normal, 36);
        malformed[byte] ^= 0x80;
        CHECK(!restore_components(sfmt, sfmt_size, malformed, libc));
        CHECK(tome_normal_snapshot_write(normal_after, 36));
        CHECK(memcmp(normal, normal_after, 36) == 0);
        CHECK(tome_rng_snapshot_write(after, sfmt_size));
        CHECK(memcmp(sfmt, after, sfmt_size) == 0);
        CHECK(tome_libc_rng_snapshot_write(libc_after, 28));
        CHECK(memcmp(libc, libc_after, 28) == 0);
    }
    for (unsigned int byte = 0; byte < 28; ++byte) {
        memcpy(libc_malformed, libc, 28);
        libc_malformed[byte] ^= 0x80;
        CHECK(!restore_components(sfmt, sfmt_size, normal, libc_malformed));
        CHECK(tome_rng_snapshot_write(after, sfmt_size));
        CHECK(memcmp(sfmt, after, sfmt_size) == 0);
        CHECK(tome_normal_snapshot_write(normal_after, 36));
        CHECK(memcmp(normal, normal_after, 36) == 0);
        CHECK(tome_libc_rng_snapshot_write(libc_after, 28));
        CHECK(memcmp(libc, libc_after, 28) == 0);
    }
    memcpy(after, sfmt, sfmt_size); after[0] ^= 0x80;
    CHECK(!restore_components(after, sfmt_size, normal, libc));
    CHECK(tome_normal_snapshot_write(normal_after, 36));
    CHECK(memcmp(normal, normal_after, 36) == 0);
    CHECK(tome_libc_rng_snapshot_write(libc_after, 28));
    CHECK(memcmp(libc, libc_after, 28) == 0);
    memcpy(malformed, normal, 36); malformed[12] = 2; set_checksum(malformed);
    CHECK(!tome_normal_snapshot_validate(malformed, 36));
    memcpy(malformed, normal, 36); malformed[8] = 2; set_checksum(malformed);
    CHECK(!tome_normal_snapshot_validate(malformed, 36));
    CHECK(!tome_normal_snapshot_restore(NULL, 36));
    CHECK(!tome_normal_snapshot_restore(normal, 35));
    CHECK(!tome_normal_snapshot_restore(normal, 37));
    CHECK(!tome_normal_snapshot_write(NULL, 36));
    CHECK(!tome_normal_snapshot_write(normal_after, 35));
    CHECK(!tome_libc_rng_snapshot_restore(NULL, 28));
    CHECK(!tome_libc_rng_snapshot_restore(libc, 27));
    CHECK(!tome_libc_rng_snapshot_restore(libc, 29));
    CHECK(!tome_libc_rng_snapshot_write(NULL, 28));
    CHECK(!tome_libc_rng_snapshot_write(libc_after, 27));
    for (unsigned int field = 8; field <= 12; field += 4) {
        memcpy(libc_malformed, libc, 28); libc_malformed[field] = 2;
        uint32_t value = checksum(libc_malformed, 24);
        for (unsigned int index = 0; index < 4; ++index) libc_malformed[24 + index] = (uint8_t)(value >> (index * 8));
        CHECK(!tome_libc_rng_snapshot_validate(libc_malformed, 28));
    }

    lua_close(state);
    free(sfmt); free(after);
    printf("original Gaussian/SFMT/libc characterization passed: %u assertions; 24 checkpoints x 1000 mixed original rng and math.random draws\n", assertions);
    return 0;
}
