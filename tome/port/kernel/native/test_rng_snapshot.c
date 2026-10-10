/* SPDX-License-Identifier: GPL-3.0-or-later */
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <stdlib.h>
#include "SFMT.h"
#include "tome_rng_snapshot.h"

static int assertions;
#define CHECK(c) do { ++assertions; if (!(c)) { fprintf(stderr,"failure line %d: %s\n",__LINE__,#c); return 1; } } while (0)

static void rechecksum(uint8_t *bytes, size_t size) {
    uint32_t hash = UINT32_C(2166136261);
    for (size_t i = 0; i < size - 4; ++i) { hash ^= bytes[i]; hash *= UINT32_C(16777619); }
    for (size_t i = 0; i < 4; ++i) bytes[size - 4 + i] = (uint8_t)(hash >> (8 * i));
}

int main(void) {
    size_t size = tome_rng_snapshot_size();
    uint8_t *snapshot = malloc(size), *other = malloc(size), *current = malloc(size);
    CHECK(snapshot && other && current);
    CHECK(tome_rng_snapshot_write(snapshot, size));
    CHECK(tome_rng_snapshot_restore(snapshot, size));
    unsigned seeds[] = {0, 1, 104729, 2147483647};
    unsigned checkpoints[] = {0, 1, 623, 624, 625, 4096};
    for (size_t s = 0; s < sizeof(seeds)/sizeof(seeds[0]); ++s) {
        for (size_t c = 0; c < sizeof(checkpoints)/sizeof(checkpoints[0]); ++c) {
            init_gen_rand(seeds[s]);
            for (unsigned i = 0; i < checkpoints[c]; ++i) gen_rand32();
            CHECK(tome_rng_snapshot_write(snapshot, size));
            uint32_t draws[1000];
            for (size_t i = 0; i < 1000; ++i) draws[i] = gen_rand32();
            CHECK(tome_rng_snapshot_restore(snapshot, size));
            for (size_t i = 0; i < 1000; ++i) CHECK(draws[i] == gen_rand32());
            CHECK(tome_rng_snapshot_write(current, size));
            CHECK(!tome_rng_snapshot_restore(snapshot, size - 1));
            memcpy(other, snapshot, size); other[8] = 2;
            CHECK(!tome_rng_snapshot_restore(other, size));
            memcpy(other, snapshot, size); other[8] = 2; rechecksum(other, size);
            CHECK(!tome_rng_snapshot_validate(other, size));
            memcpy(other, snapshot, size); other[16] = 0xff; other[17] = 0xff; rechecksum(other, size);
            CHECK(!tome_rng_snapshot_restore(other, size));
            memcpy(other, snapshot, size); other[20] = 2; rechecksum(other, size);
            CHECK(!tome_rng_snapshot_restore(other, size));
            memcpy(other, snapshot, size); memset(other + 24, 0, size - 28); other[20] = 1; rechecksum(other, size);
            CHECK(!tome_rng_snapshot_restore(other, size));
            memcpy(other, snapshot, size); other[12] ^= 1;
            CHECK(!tome_rng_snapshot_restore(other, size));
            memcpy(other, snapshot, size); other[size - 1] ^= 1;
            CHECK(!tome_rng_snapshot_restore(other, size));
            for (size_t i = 0; i < size; i += 13) {
                memcpy(other, snapshot, size); other[i] ^= 1;
                CHECK(!tome_rng_snapshot_restore(other, size));
            }
            CHECK(tome_rng_snapshot_write(other, size));
            CHECK(memcmp(current, other, size) == 0);
        }
    }
    free(snapshot); free(other); free(current);
    printf("TOME_NATIVE_RNG_SNAPSHOT={\"assertions\":%d,\"bytes\":%zu,\"seeds\":4,\"checkpoints\":6,\"drawsPerCheckpoint\":1000}\n", assertions, size);
    return 0;
}
