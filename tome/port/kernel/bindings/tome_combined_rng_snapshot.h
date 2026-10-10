/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_COMBINED_RNG_SNAPSHOT_H
#define TOME_COMBINED_RNG_SNAPSHOT_H
#include <stddef.h>
#include <stdint.h>

/* Immutable, disjoint component buffers are required. Host must pause original
 * RNG consumers, including particle updates and WFC threads, for this call.
 * This is a boundary snapshot, not an original game save or a concurrent lock.
 */
int tome_combined_rng_restore(
    const uint8_t *sfmt, size_t sfmt_length,
    const uint8_t *normal, size_t normal_length,
    const uint8_t *libc, size_t libc_length);
#endif
