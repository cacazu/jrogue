/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_a44e6fc84706cf6c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.track.rest_track.panic.rest_track_impossible_pt_counts.dcfd9f0ed6", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}
