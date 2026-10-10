/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_impossible_site_1fb48e0bfeec92b7(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.cost.impossible.you_can_t_write_such_a_weird.9f9152679e", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}
