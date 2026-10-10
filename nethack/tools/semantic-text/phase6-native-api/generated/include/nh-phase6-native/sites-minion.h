/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_dd10c533535ca848(long nh_p0, const char * nh_p1, const char * nh_p2, long nh_p3, const char * nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.minion.demon_talk.livelog_printf.bribed_s_with_ld_s_for_safe.b703831800", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL, 0},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p4, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    livelog_printf(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2), nh_p3, nh_text_captured_text(nh_scope, 2, nh_p4));
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_78a59999ce2ba103(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.minion.gain_guardian_angel.panic.merged_weapon.3b978ad459", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}
