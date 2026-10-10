/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_RNG_PHASES_H
#define TOME_RNG_PHASES_H
#include <stdint.h>
#include <stddef.h>

/* Three complete existing codec envelopes, not three invented algorithms. */
enum { TOME_PHASE_SFMT_BYTES = 2524, TOME_PHASE_NORMAL_BYTES = 36,
       TOME_PHASE_LIBC_BYTES = 28 };
typedef struct {
    uint8_t sfmt[TOME_PHASE_SFMT_BYTES];
    uint8_t normal[TOME_PHASE_NORMAL_BYTES];
    uint8_t libc[TOME_PHASE_LIBC_BYTES];
} tome_rng_bank;
typedef enum { TOME_RNG_GAMEPLAY = 1, TOME_RNG_VISUAL = 2,
               TOME_RNG_FAULT = 3 } tome_rng_phase;

/* Single browser thread only. The application must stop ALL original RNG
 * consumers (including WFC) before calling a barrier API. Activity begin/end
 * cover the outer callback invocation including every retained callback it
 * runs. A guard does not nest; an inner callback inherits it. No nested
 * phase switches; FOV/game callbacks stay in GAMEPLAY. Renderer and the single
 * particle lane share VISUAL in explicit application preparation order.
 */
int tome_rng_phases_initialize_at_barrier(void);
int tome_rng_phase_activity_begin(tome_rng_phase expected);
int tome_rng_phase_activity_end(tome_rng_phase expected);
int tome_rng_phase_enter_visual_at_barrier(void);
int tome_rng_phase_leave_visual_at_barrier(void);
tome_rng_phase tome_rng_phase_current(void);
int tome_rng_phase_activity_count(void);
const char *tome_rng_phase_error_id(void);

/* Save both NAMED banks in a versioned application envelope. These C structs
 * are not a portable save format. Calls require idle GAMEPLAY phase and all
 * consumers quiescent; existing component envelopes remain versioned/checked.
 * Buffers must be immutable/disjoint during restore. Restoring only the live
 * global RNG would lose the visual bank and is not a supported save path.
 */
int tome_rng_phase_banks_write_at_barrier(tome_rng_bank *gameplay, tome_rng_bank *visual);
int tome_rng_phase_banks_restore_at_barrier(const tome_rng_bank *gameplay, const tome_rng_bank *visual);

/* Portable version-1 named-bank envelope, 5208 bytes. Internally uses the
 * actual existing 2524/36/28 writers and validators; never draws or reseeds.
 * Replace singleton native snapshot exports with this envelope once banks
 * are activated. validate performs no mutation and needs no phase switch.
 */
size_t tome_rng_phase_snapshot_size(void);
int tome_rng_phase_snapshot_write_at_barrier(uint8_t *output, size_t length);
int tome_rng_phase_snapshot_validate(const uint8_t *input, size_t length);
int tome_rng_phase_snapshot_restore_at_barrier(const uint8_t *input, size_t length);
#endif
