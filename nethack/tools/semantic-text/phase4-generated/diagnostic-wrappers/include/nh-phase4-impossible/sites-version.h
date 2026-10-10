/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_impossible_site_659bc24faaf80c8d(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.version.check_version.impossible.check_version_called_with_complain_true_but.88d138b1b7", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}
