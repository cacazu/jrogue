/* SPDX-License-Identifier: GPL-3.0-or-later
 * Append after the byte-identical SDK musl rand.c. Its original private seed,
 * default initialization, rand/srand algorithm and integer conversions stay.
 */
#include <string.h>
#include "tome_libc_rng_snapshot.h"

enum { TOME_LIBC_RNG_SIZE = 28 };
static const uint8_t tome_libc_rng_magic[8] = {'T','O','M','E','L','C','G','1'};
static uint32_t tome_libc_rng_read32(const uint8_t *input)
{
    return (uint32_t)input[0] | ((uint32_t)input[1] << 8) |
        ((uint32_t)input[2] << 16) | ((uint32_t)input[3] << 24);
}
static void tome_libc_rng_write32(uint8_t *output, uint32_t value)
{
    for (size_t index = 0; index < 4; ++index) output[index] = (uint8_t)(value >> (index * 8));
}
static uint64_t tome_libc_rng_read64(const uint8_t *input)
{
    uint64_t value = 0;
    for (size_t index = 0; index < 8; ++index) value |= (uint64_t)input[index] << (index * 8);
    return value;
}
static void tome_libc_rng_write64(uint8_t *output, uint64_t value)
{
    for (size_t index = 0; index < 8; ++index) output[index] = (uint8_t)(value >> (index * 8));
}
static uint32_t tome_libc_rng_checksum(const uint8_t *input, size_t length)
{
    uint32_t hash = UINT32_C(2166136261);
    for (size_t index = 0; index < length; ++index) {
        hash ^= input[index]; hash *= UINT32_C(16777619);
    }
    return hash;
}
size_t tome_libc_rng_snapshot_size(void)
{
    return TOME_LIBC_RNG_SIZE;
}
int tome_libc_rng_snapshot_write(uint8_t *output, size_t length)
{
    if (!output || length != TOME_LIBC_RNG_SIZE) return 0;
    memcpy(output, tome_libc_rng_magic, sizeof(tome_libc_rng_magic));
    tome_libc_rng_write32(output + 8, 1); /* Envelope schema. */
    tome_libc_rng_write32(output + 12, 1); /* SDK musl uint64 LCG family. */
    tome_libc_rng_write64(output + 16, seed);
    tome_libc_rng_write32(output + 24, tome_libc_rng_checksum(output, 24));
    return 1;
}
int tome_libc_rng_snapshot_validate(const uint8_t *input, size_t length)
{
    if (!input || length != TOME_LIBC_RNG_SIZE) return 0;
    return memcmp(input, tome_libc_rng_magic, sizeof(tome_libc_rng_magic)) == 0 &&
        tome_libc_rng_read32(input + 8) == 1 &&
        tome_libc_rng_read32(input + 12) == 1 &&
        tome_libc_rng_read32(input + 24) == tome_libc_rng_checksum(input, 24);
}
int tome_libc_rng_snapshot_restore(const uint8_t *input, size_t length)
{
    if (!tome_libc_rng_snapshot_validate(input, length)) return 0;
    seed = tome_libc_rng_read64(input + 16);
    return 1;
}
