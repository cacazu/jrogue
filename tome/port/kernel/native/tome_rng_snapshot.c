/* SPDX-License-Identifier: GPL-3.0-or-later
 * Adapter around the unchanged upstream BSD SFMT implementation.
 * Build this translation unit instead of SFMT.c, with the upstream src include
 * directory. Original RNG algorithms and state are included verbatim.
 * The application calls these only between original gameplay commands.
 */
#include "SFMT.c"
#include "tome_rng_snapshot.h"

#if defined(BIG_ENDIAN64) || defined(ONLY64)
#error This adapter currently validates the browser little-endian SFMT layout.
#endif

enum { HEADER_SIZE = 24, CHECKSUM_SIZE = 4 };
static const uint8_t magic[8] = {'T','O','M','E','S','F','M','T'};

static uint32_t read32(const uint8_t *bytes) {
    return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8) |
        ((uint32_t)bytes[2] << 16) | ((uint32_t)bytes[3] << 24);
}
static void write32(uint8_t *bytes, uint32_t value) {
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8);
    bytes[2] = (uint8_t)(value >> 16);
    bytes[3] = (uint8_t)(value >> 24);
}
static uint32_t checksum(const uint8_t *bytes, size_t count) {
    uint32_t hash = UINT32_C(2166136261);
    for (size_t i = 0; i < count; ++i) {
        hash ^= bytes[i];
        hash *= UINT32_C(16777619);
    }
    return hash;
}
size_t tome_rng_snapshot_size(void) {
    return HEADER_SIZE + N32 * 4 + CHECKSUM_SIZE;
}
int tome_rng_snapshot_write(uint8_t *output, size_t length) {
    if (!output || length != tome_rng_snapshot_size()) return 0;
    memcpy(output, magic, sizeof(magic));
    write32(output + 8, 1); /* snapshot schema */
    write32(output + 12, MEXP); /* SFMT family, not a native save format */
    write32(output + 16, (uint32_t)idx);
    write32(output + 20, (uint32_t)initialized);
    for (size_t i = 0; i < N32; ++i) write32(output + HEADER_SIZE + i * 4, psfmt32[i]);
    write32(output + length - CHECKSUM_SIZE, checksum(output, length - CHECKSUM_SIZE));
    return 1;
}
int tome_rng_snapshot_validate(const uint8_t *input, size_t length) {
    if (!input || length != tome_rng_snapshot_size()) return 0;
    if (memcmp(input, magic, sizeof(magic)) || read32(input + 8) != 1 ||
        read32(input + 12) != MEXP || read32(input + 16) > N32 ||
        read32(input + 20) > 1 ||
        read32(input + length - CHECKSUM_SIZE) != checksum(input, length - CHECKSUM_SIZE)) return 0;
    uint32_t any = 0;
    for (size_t i = 0; i < N32; ++i) any |= read32(input + HEADER_SIZE + i * 4);
    if (read32(input + 20) && !any) return 0;
    return 1;
}
int tome_rng_snapshot_restore(const uint8_t *input, size_t length) {
    if (!tome_rng_snapshot_validate(input, length)) return 0;
    /* Validate the entire envelope before touching the original global state. */
    for (size_t i = 0; i < N32; ++i) psfmt32[i] = read32(input + HEADER_SIZE + i * 4);
    idx = (int)read32(input + 16);
    initialized = (int)read32(input + 20);
    return 1;
}
