// CDDA 0.I-1 browser platform adapter. CC BY-SA 3.0; see ../../NOTICE.md.
#pragma once
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#define CDDA_RNG_NOEXCEPT noexcept
#else
#define CDDA_RNG_NOEXCEPT
#endif

enum cdda_rng_snapshot_status {
    CDDA_RNG_OK = 0,
    CDDA_RNG_INVALID_ARGUMENT = 1,
    CDDA_RNG_BUFFER_TOO_SMALL = 2,
    CDDA_RNG_MALFORMED = 3,
    CDDA_RNG_FORMAT_MISMATCH = 4,
    CDDA_RNG_SOURCE_MISMATCH = 5,
    CDDA_RNG_ABI_MISMATCH = 6,
    CDDA_RNG_INVALID_STATE = 7,
    CDDA_RNG_RESOURCE_FAILURE = 8
};

// Query with output=NULL, capacity=0. required is mandatory. No RNG draws.
// A short buffer is left untouched. The returned size excludes any NUL byte.
int cdda_rng_snapshot_capture( uint8_t *output, size_t capacity, size_t *required ) CDDA_RNG_NOEXCEPT;
// Validates all seven sections into temporary state before a single commit.
int cdda_rng_snapshot_restore( const uint8_t *input, size_t size ) CDDA_RNG_NOEXCEPT;
// Stable until module teardown. Bind the outer save envelope to this exact string.
const char *cdda_rng_snapshot_abi( void ) CDDA_RNG_NOEXCEPT;
size_t cdda_rng_snapshot_max_bytes( void ) CDDA_RNG_NOEXCEPT;

#ifdef __cplusplus
}
#endif
#undef CDDA_RNG_NOEXCEPT
