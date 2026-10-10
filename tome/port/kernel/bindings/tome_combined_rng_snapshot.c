/* SPDX-License-Identifier: GPL-3.0-or-later */
#include "tome_rng_snapshot.h"
#include "tome_normal_snapshot.h"
#include "tome_libc_rng_snapshot.h"
#include "tome_combined_rng_snapshot.h"

int tome_combined_rng_restore(
    const uint8_t *sfmt, size_t sfmt_length,
    const uint8_t *normal, size_t normal_length,
    const uint8_t *libc, size_t libc_length)
{
    /* No state is touched before all three immutable envelopes pass. Each
     * restore's only failure condition is the same already-tested validation.
     * Caller owns the paused execution boundary and immutable buffers.
     */
    if (!tome_rng_snapshot_validate(sfmt, sfmt_length) ||
        !tome_normal_snapshot_validate(normal, normal_length) ||
        !tome_libc_rng_snapshot_validate(libc, libc_length)) return 0;
    if (!tome_rng_snapshot_restore(sfmt, sfmt_length)) return 0;
    if (!tome_normal_snapshot_restore(normal, normal_length)) return 0;
    return tome_libc_rng_snapshot_restore(libc, libc_length);
}
