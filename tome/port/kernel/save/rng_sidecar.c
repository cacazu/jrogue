/* SPDX-License-Identifier: GPL-3.0-or-later */
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <emscripten/emscripten.h>
#include "checkpoint_gate.h"
#include "rng_sidecar.h"
#include "tome_rng_snapshot.h"
#include "tome_normal_snapshot.h"
#include "tome_libc_rng_snapshot.h"
#include "tome_combined_rng_snapshot.h"
#include "tome_rng_phases.h"

enum { SINGLE_BYTES = 2588, NAMED_BYTES = 5208, SFMT_BYTES = 2524,
       NORMAL_BYTES = 36, LIBC_BYTES = 28 };
static char encoded[NAMED_BYTES * 2 + 1];
static const char *error_id = "save.rng.none";
static int fail(const char *id) { error_id = id; return 0; }
static size_t layout_bytes(int layout) {
    return layout == TOME_WEB_RNG_SINGLETON_V1 ? SINGLE_BYTES :
        layout == TOME_WEB_RNG_NAMED_V1 ? NAMED_BYTES : 0;
}
static int nibble(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}
static int decode(const char *hex, int layout, uint8_t *output) {
    size_t n = layout_bytes(layout);
    if (!hex || !n || strnlen(hex, NAMED_BYTES * 2 + 1) != n * 2) return 0;
    for (size_t i = 0; i < n; ++i) {
        int hi = nibble(hex[i * 2]), lo = nibble(hex[i * 2 + 1]);
        if (hi < 0 || lo < 0) return 0;
        output[i] = (uint8_t)((hi << 4) | lo);
    }
    return 1;
}
static int validate_bytes(const uint8_t *bytes, int layout) {
    if (layout == TOME_WEB_RNG_NAMED_V1)
        return tome_rng_phase_snapshot_validate(bytes, NAMED_BYTES);
    return layout == TOME_WEB_RNG_SINGLETON_V1 &&
        tome_rng_snapshot_validate(bytes, SFMT_BYTES) &&
        tome_normal_snapshot_validate(bytes + SFMT_BYTES, NORMAL_BYTES) &&
        tome_libc_rng_snapshot_validate(bytes + SFMT_BYTES + NORMAL_BYTES, LIBC_BYTES);
}
EMSCRIPTEN_KEEPALIVE int tome_web_rng_validate_hex(const char *hex, int expected_layout) {
    uint8_t bytes[NAMED_BYTES];
    if (!decode(hex, expected_layout, bytes) || !validate_bytes(bytes, expected_layout))
        return fail("save.rng.invalid_envelope");
    return 1;
}
EMSCRIPTEN_KEEPALIVE const char *tome_web_rng_capture_hex(int layout) {
    uint8_t bytes[NAMED_BYTES];
    size_t n = layout_bytes(layout);
    int mode = tome_web_checkpoint_mode();
    if (!((layout == TOME_WEB_RNG_SINGLETON_V1 && mode == TOME_CHECKPOINT_BASELINE_SAVE) ||
          (layout == TOME_WEB_RNG_NAMED_V1 && mode == TOME_CHECKPOINT_STRICT_SAVE))) {
        fail("save.rng.capture_mode_mismatch"); return NULL;
    }
    int ok;
    if (layout == TOME_WEB_RNG_SINGLETON_V1) {
        ok = tome_rng_snapshot_write(bytes, SFMT_BYTES) &&
            tome_normal_snapshot_write(bytes + SFMT_BYTES, NORMAL_BYTES) &&
            tome_libc_rng_snapshot_write(bytes + SFMT_BYTES + NORMAL_BYTES, LIBC_BYTES);
    } else {
        ok = tome_rng_phase_snapshot_size() == NAMED_BYTES &&
            tome_rng_phase_snapshot_write_at_barrier(bytes, NAMED_BYTES);
    }
    if (!ok || !validate_bytes(bytes, layout)) { fail("save.rng.capture_failed"); return NULL; }
    static const char digits[] = "0123456789abcdef";
    for (size_t i = 0; i < n; ++i) {
        encoded[i * 2] = digits[bytes[i] >> 4];
        encoded[i * 2 + 1] = digits[bytes[i] & 15];
    }
    encoded[n * 2] = '\0';
    return encoded;
}
EMSCRIPTEN_KEEPALIVE int tome_web_rng_restore_hex(const char *hex, int layout) {
    uint8_t bytes[NAMED_BYTES];
    int mode = tome_web_checkpoint_mode();
    if (!((layout == TOME_WEB_RNG_SINGLETON_V1 && mode == TOME_CHECKPOINT_BASELINE_RESUME) ||
          (layout == TOME_WEB_RNG_NAMED_V1 && mode == TOME_CHECKPOINT_STRICT_RESUME)))
        return fail("save.rng.restore_mode_mismatch");
    if (!decode(hex, layout, bytes) || !validate_bytes(bytes, layout))
        return fail("save.rng.invalid_envelope");
    int ok = layout == TOME_WEB_RNG_NAMED_V1 ?
        tome_rng_phase_snapshot_restore_at_barrier(bytes, NAMED_BYTES) :
        tome_combined_rng_restore(bytes, SFMT_BYTES,
            bytes + SFMT_BYTES, NORMAL_BYTES,
            bytes + SFMT_BYTES + NORMAL_BYTES, LIBC_BYTES);
    return ok ? 1 : fail("save.rng.restore_failed");
}
EMSCRIPTEN_KEEPALIVE const char *tome_web_rng_error_id(void) { return error_id; }
