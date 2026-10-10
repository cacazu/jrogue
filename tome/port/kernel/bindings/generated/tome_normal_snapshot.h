/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_NORMAL_SNAPSHOT_H
#define TOME_NORMAL_SNAPSHOT_H
#include <stddef.h>
#include <stdint.h>

/* Covers only core_lua.c's original Box-Muller cache. A complete RNG snapshot
 * must also save the original SFMT state, and restore both between commands.
 * Encoding is versioned, little endian and preserves raw double bits.
 */
size_t tome_normal_snapshot_size(void);
int tome_normal_snapshot_write(uint8_t *output, size_t length);
int tome_normal_snapshot_validate(const uint8_t *input, size_t length);
int tome_normal_snapshot_restore(const uint8_t *input, size_t length);
#endif
