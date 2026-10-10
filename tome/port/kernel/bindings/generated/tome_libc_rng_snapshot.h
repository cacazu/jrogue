/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_LIBC_RNG_SNAPSHOT_H
#define TOME_LIBC_RNG_SNAPSHOT_H
#include <stddef.h>
#include <stdint.h>
size_t tome_libc_rng_snapshot_size(void);
int tome_libc_rng_snapshot_write(uint8_t *output, size_t length);
int tome_libc_rng_snapshot_validate(const uint8_t *input, size_t length);
int tome_libc_rng_snapshot_restore(const uint8_t *input, size_t length);
#endif
