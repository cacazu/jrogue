/* Added 2026-10-02: phase-four source-selected argument values; NGPL. */
#ifndef JROGUE_NH_PHASE4_VALUES_H
#define JROGUE_NH_PHASE4_VALUES_H
#include "nh-semantic.h"
#include "nh-semantic-name.h"
#include <stddef.h>
_Static_assert(sizeof(size_t) == 4, "Phase-four %zu transport is pinned to wasm32");
struct nh_phase4_text_value { const char *original, *event_json; };
struct nh_phase4_format_value {
    const char *original;
    const struct nh_text_descriptor *descriptor;
};
static inline struct nh_phase4_text_value nh_phase4_text(const char *original,
                                                         const char *event_json) {
    struct nh_phase4_text_value value={original,event_json};
    return value;
}
static inline struct nh_phase4_format_value nh_phase4_format(const char *original,
                                    const struct nh_text_descriptor *descriptor) {
    struct nh_phase4_format_value value={original,descriptor};
    return value;
}
/* Allocated, bounded JSON; caller frees after nh_text_begin copies it. */
char *nh_phase4_public_raw(const char *);
#endif
