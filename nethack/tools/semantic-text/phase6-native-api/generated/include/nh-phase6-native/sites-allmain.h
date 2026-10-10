/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_af9228d9c801294b(long nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.allmain.welcome.livelog_printf.s_the_s_entered_the_dungeon.f14300d72c", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL, 0},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    livelog_printf(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2), nh_text_captured_text(nh_scope, 1, nh_p3));
    nh_text_end(nh_scope);
}
