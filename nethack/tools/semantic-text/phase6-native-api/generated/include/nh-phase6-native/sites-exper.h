/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_c5bc9d78ef0ea8f4(long nh_p0, const char * nh_p1, int nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.exper.losexp.livelog_printf.lost_experience_level_d.31c554e8ea", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    livelog_printf(nh_p0, nh_p1, nh_p2);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_a29076e84f6ceb06(long nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.exper.losexp.livelog_printf.lost_all_experience.c9925e7a0a", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    livelog_printf(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_88779d3708649776(long nh_p0, const char * nh_p1, const char * nh_p2, int nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.exper.pluslvl.livelog_printf.sgained_experience_level_d.ee6d0374d7", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL, 0},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    livelog_printf(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2), nh_p3);
    nh_text_end(nh_scope);
}
