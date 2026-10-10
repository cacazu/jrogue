/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_impossible_site_913177edb0dfa729(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.dbridge.create_drawbridge.impossible.bad_direction_in_create_drawbridge.25e85aee15", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}
