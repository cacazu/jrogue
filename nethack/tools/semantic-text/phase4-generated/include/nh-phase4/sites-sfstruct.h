/* Modified 2026-10-02: additive phase-four source observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_site_74a41eedc8120aad(const char * nh_p0, int nh_p1, unsigned int nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.sfstruct.mread.pline.read_d_instead_of_u_bytes.6bb948795b", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_p1, nh_p2);
    nh_text_end(nh_scope);
}
