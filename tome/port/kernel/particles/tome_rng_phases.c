/* SPDX-License-Identifier: GPL-3.0-or-later
 * Explicit ownership of the retained SFMT, Box-Muller spare and musl LCG.
 * No algorithm changes, concurrent restore, or frame-end rollback.
 */
#include <string.h>
#include "tome_rng_phases.h"
#include "tome_rng_snapshot.h"
#include "tome_normal_snapshot.h"
#include "tome_libc_rng_snapshot.h"
#include "tome_combined_rng_snapshot.h"

static tome_rng_bank gameplay_bank, visual_bank;
static tome_rng_phase phase = TOME_RNG_GAMEPLAY;
static int ready, activity;
static const char *error_id = "engine.rng_phase.none";

static int error(const char *id) { error_id = id; return 0; }
static int barrier(tome_rng_phase required) {
    if (!ready) return error("engine.rng_phase.not_initialized");
    if (phase != required || activity) return error("engine.rng_phase.not_quiescent");
    return 1;
}
static int valid(const tome_rng_bank *bank) {
    return bank && tome_rng_snapshot_validate(bank->sfmt, sizeof(bank->sfmt)) &&
        tome_normal_snapshot_validate(bank->normal, sizeof(bank->normal)) &&
        tome_libc_rng_snapshot_validate(bank->libc, sizeof(bank->libc));
}
static int capture(tome_rng_bank *bank) {
    return tome_rng_snapshot_write(bank->sfmt, sizeof(bank->sfmt)) &&
        tome_normal_snapshot_write(bank->normal, sizeof(bank->normal)) &&
        tome_libc_rng_snapshot_write(bank->libc, sizeof(bank->libc)) && valid(bank);
}
static int install(const tome_rng_bank *bank) {
    return tome_combined_rng_restore(bank->sfmt, sizeof(bank->sfmt),
        bank->normal, sizeof(bank->normal), bank->libc, sizeof(bank->libc));
}

int tome_rng_phases_initialize_at_barrier(void) {
    tome_rng_bank initial;
    if (ready || activity || phase != TOME_RNG_GAMEPLAY)
        return error("engine.rng_phase.already_initialized_or_busy");
    if (tome_rng_snapshot_size() != TOME_PHASE_SFMT_BYTES ||
        tome_normal_snapshot_size() != TOME_PHASE_NORMAL_BYTES ||
        tome_libc_rng_snapshot_size() != TOME_PHASE_LIBC_BYTES)
        return error("engine.rng_phase.codec_size_mismatch");
    if (!capture(&initial)) return error("engine.rng_phase.capture_failed");
    /* Clone once without drawing/reseeding. From this explicit boundary the
     * banks advance independently; no historical native thread interleaving
     * equivalence is implied by this deterministic platform partition.
     */
    gameplay_bank = initial;
    visual_bank = initial;
    ready = 1;
    return 1;
}

int tome_rng_phase_activity_begin(tome_rng_phase expected) {
    if ((expected != TOME_RNG_GAMEPLAY && expected != TOME_RNG_VISUAL) ||
        !ready || phase != expected || activity)
        return error("engine.rng_phase.callback_reentry");
    activity = 1;
    return 1;
}
int tome_rng_phase_activity_end(tome_rng_phase expected) {
    if (phase != expected || activity != 1)
        return error("engine.rng_phase.callback_boundary_mismatch");
    activity = 0;
    return 1;
}
int tome_rng_phase_enter_visual_at_barrier(void) {
    tome_rng_bank latest_gameplay;
    if (!barrier(TOME_RNG_GAMEPLAY)) return 0;
    if (!capture(&latest_gameplay) || !valid(&visual_bank))
        return error("engine.rng_phase.capture_or_validation_failed");
    if (!install(&visual_bank)) {
        phase = TOME_RNG_FAULT;
        return error("engine.rng_phase.install_failed");
    }
    gameplay_bank = latest_gameplay;
    phase = TOME_RNG_VISUAL;
    return 1;
}
int tome_rng_phase_leave_visual_at_barrier(void) {
    tome_rng_bank latest_visual;
    if (!barrier(TOME_RNG_VISUAL)) return 0;
    if (!capture(&latest_visual) || !valid(&gameplay_bank)) {
        phase = TOME_RNG_FAULT;
        return error("engine.rng_phase.capture_or_validation_failed");
    }
    if (!install(&gameplay_bank)) {
        phase = TOME_RNG_FAULT;
        return error("engine.rng_phase.install_failed");
    }
    visual_bank = latest_visual;
    phase = TOME_RNG_GAMEPLAY;
    return 1;
}
tome_rng_phase tome_rng_phase_current(void) { return phase; }
int tome_rng_phase_activity_count(void) { return activity; }
const char *tome_rng_phase_error_id(void) { return error_id; }

int tome_rng_phase_banks_write_at_barrier(tome_rng_bank *gameplay, tome_rng_bank *visual) {
    tome_rng_bank current;
    if (!gameplay || !visual || gameplay == visual)
        return error("engine.rng_phase.invalid_buffers");
    if (!barrier(TOME_RNG_GAMEPLAY)) return 0;
    if (!capture(&current) || !valid(&visual_bank))
        return error("engine.rng_phase.capture_or_validation_failed");
    gameplay_bank = current;
    *gameplay = gameplay_bank;
    *visual = visual_bank;
    return 1;
}
int tome_rng_phase_banks_restore_at_barrier(const tome_rng_bank *gameplay, const tome_rng_bank *visual) {
    if (!barrier(TOME_RNG_GAMEPLAY)) return 0;
    if (!gameplay || !visual || gameplay == visual || !valid(gameplay) || !valid(visual))
        return error("engine.rng_phase.invalid_saved_banks");
    /* Immutable copies keep all validation and restore operands disjoint from
     * the manager's live banks. All six codec validations precede mutation.
     */
    tome_rng_bank next_gameplay = *gameplay, next_visual = *visual;
    if (!install(&next_gameplay)) {
        phase = TOME_RNG_FAULT;
        return error("engine.rng_phase.install_failed");
    }
    gameplay_bank = next_gameplay;
    visual_bank = next_visual;
    return 1;
}

enum { BANK_BYTES = TOME_PHASE_SFMT_BYTES + TOME_PHASE_NORMAL_BYTES +
    TOME_PHASE_LIBC_BYTES, HEADER_BYTES = 32, SNAPSHOT_BYTES = HEADER_BYTES + 2 * BANK_BYTES };
static const uint8_t snapshot_header[HEADER_BYTES] = {
    'T','B','R','N', 1,0,0,0, 32,0,0,0, 0x58,0x14,0,0,
    0x1c,0x0a,0,0, 2,0,0,0, 'G','A','M','E', 'V','I','S','U'
};
static void encode_bank(uint8_t *out, const tome_rng_bank *bank) {
    memcpy(out, bank->sfmt, TOME_PHASE_SFMT_BYTES);
    memcpy(out + TOME_PHASE_SFMT_BYTES, bank->normal, TOME_PHASE_NORMAL_BYTES);
    memcpy(out + TOME_PHASE_SFMT_BYTES + TOME_PHASE_NORMAL_BYTES,
        bank->libc, TOME_PHASE_LIBC_BYTES);
}
static void decode_bank(tome_rng_bank *bank, const uint8_t *input) {
    memcpy(bank->sfmt, input, TOME_PHASE_SFMT_BYTES);
    memcpy(bank->normal, input + TOME_PHASE_SFMT_BYTES, TOME_PHASE_NORMAL_BYTES);
    memcpy(bank->libc, input + TOME_PHASE_SFMT_BYTES + TOME_PHASE_NORMAL_BYTES,
        TOME_PHASE_LIBC_BYTES);
}
size_t tome_rng_phase_snapshot_size(void) { return SNAPSHOT_BYTES; }
int tome_rng_phase_snapshot_write_at_barrier(uint8_t *output, size_t length) {
    tome_rng_bank saved_gameplay, saved_visual;
    if (!output || length != SNAPSHOT_BYTES)
        return error("engine.rng_phase.invalid_snapshot_buffer");
    if (!tome_rng_phase_banks_write_at_barrier(&saved_gameplay, &saved_visual)) return 0;
    memcpy(output, snapshot_header, HEADER_BYTES);
    encode_bank(output + HEADER_BYTES, &saved_gameplay);
    encode_bank(output + HEADER_BYTES + BANK_BYTES, &saved_visual);
    return 1;
}
int tome_rng_phase_snapshot_validate(const uint8_t *input, size_t length) {
    tome_rng_bank saved_gameplay, saved_visual;
    if (!input || length != SNAPSHOT_BYTES || memcmp(input, snapshot_header, HEADER_BYTES)) return 0;
    decode_bank(&saved_gameplay, input + HEADER_BYTES);
    decode_bank(&saved_visual, input + HEADER_BYTES + BANK_BYTES);
    return valid(&saved_gameplay) && valid(&saved_visual);
}
int tome_rng_phase_snapshot_restore_at_barrier(const uint8_t *input, size_t length) {
    tome_rng_bank saved_gameplay, saved_visual;
    if (!tome_rng_phase_snapshot_validate(input, length))
        return error("engine.rng_phase.invalid_snapshot");
    decode_bank(&saved_gameplay, input + HEADER_BYTES);
    decode_bank(&saved_visual, input + HEADER_BYTES + BANK_BYTES);
    return tome_rng_phase_banks_restore_at_barrier(&saved_gameplay, &saved_visual);
}
