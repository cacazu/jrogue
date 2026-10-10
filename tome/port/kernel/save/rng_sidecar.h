/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef TOME_WEB_RNG_SIDECAR_H
#define TOME_WEB_RNG_SIDECAR_H
enum { TOME_WEB_RNG_SINGLETON_V1 = 1, TOME_WEB_RNG_NAMED_V1 = 2 };
/* Hex is an encoding of the exact existing component envelopes, not a new RNG.
 * Validate accepts either layout without mutation. Capture/restore enforce the
 * explicit baseline-singleton or strict-named checkpoint/resume gate mode.
 */
int tome_web_rng_validate_hex(const char *hex, int expected_layout);
const char *tome_web_rng_capture_hex(int layout);
int tome_web_rng_restore_hex(const char *hex, int layout);
const char *tome_web_rng_error_id(void);
#endif
