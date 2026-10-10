/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_impossible_site_be36411cc7bd2e94(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.forget_temple_entry.impossible.attempting_to_manipulate_shrine_data_for_non.c57e5e6dd6", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}
