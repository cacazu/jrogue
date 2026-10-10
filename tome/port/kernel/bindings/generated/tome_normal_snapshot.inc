/* SPDX-License-Identifier: GPL-3.0-or-later
 * Append-only adapter: included after the retained core_lua.c source body.
 * The generator relocates the exact original cached locals to file scope.
 */
#include <string.h>
#include "tome_normal_snapshot.h"

typedef char tome_double_must_be_64_bits[(sizeof(double) == 8) ? 1 : -1];
enum { TOME_NORMAL_SIZE = 36 };
static const uint8_t tome_normal_magic[8] = {'T','O','M','E','N','O','R','M'};

static uint32_t tome_normal_read32(const uint8_t *input)
{
    return (uint32_t)input[0] | ((uint32_t)input[1] << 8) |
        ((uint32_t)input[2] << 16) | ((uint32_t)input[3] << 24);
}
static void tome_normal_write32(uint8_t *output, uint32_t value)
{
    for (size_t i = 0; i < 4; ++i) output[i] = (uint8_t)(value >> (i * 8));
}
static uint64_t tome_normal_read64(const uint8_t *input)
{
    uint64_t value = 0;
    for (size_t i = 0; i < 8; ++i) value |= (uint64_t)input[i] << (i * 8);
    return value;
}
static void tome_normal_write64(uint8_t *output, uint64_t value)
{
    for (size_t i = 0; i < 8; ++i) output[i] = (uint8_t)(value >> (i * 8));
}
static uint32_t tome_normal_checksum(const uint8_t *input, size_t length)
{
    uint32_t hash = UINT32_C(2166136261);
    for (size_t i = 0; i < length; ++i) {
        hash ^= input[i];
        hash *= UINT32_C(16777619);
    }
    return hash;
}
size_t tome_normal_snapshot_size(void)
{
    return TOME_NORMAL_SIZE;
}
int tome_normal_snapshot_write(uint8_t *output, size_t length)
{
    uint64_t z0_bits, z1_bits;
    if (!output || length != TOME_NORMAL_SIZE) return 0;
    memcpy(output, tome_normal_magic, sizeof(tome_normal_magic));
    tome_normal_write32(output + 8, 1);
    tome_normal_write32(output + 12, stored ? 1 : 0);
    memcpy(&z0_bits, &z0, sizeof(z0_bits));
    memcpy(&z1_bits, &z1, sizeof(z1_bits));
    tome_normal_write64(output + 16, z0_bits);
    tome_normal_write64(output + 24, z1_bits);
    tome_normal_write32(output + 32, tome_normal_checksum(output, 32));
    return 1;
}
int tome_normal_snapshot_validate(const uint8_t *input, size_t length)
{
    if (!input || length != TOME_NORMAL_SIZE) return 0;
    return memcmp(input, tome_normal_magic, sizeof(tome_normal_magic)) == 0 &&
        tome_normal_read32(input + 8) == 1 &&
        tome_normal_read32(input + 12) <= 1 &&
        tome_normal_read32(input + 32) == tome_normal_checksum(input, 32);
}
int tome_normal_snapshot_restore(const uint8_t *input, size_t length)
{
    uint64_t z0_bits, z1_bits;
    if (!tome_normal_snapshot_validate(input, length)) return 0;
    z0_bits = tome_normal_read64(input + 16);
    z1_bits = tome_normal_read64(input + 24);
    memcpy(&z0, &z0_bits, sizeof(z0));
    memcpy(&z1, &z1_bits, sizeof(z1));
    stored = tome_normal_read32(input + 12) ? TRUE : FALSE;
    return 1;
}
