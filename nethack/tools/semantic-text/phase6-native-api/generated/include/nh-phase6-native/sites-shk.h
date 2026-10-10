/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_7f652e637782b1c6(long nh_p0, const char * nh_p1, long nh_p2, const char * nh_p3, const char * nh_p4, const char * nh_p5) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.shk.rob_shop.livelog_printf.stole_ld_s_worth_of_merchandise_from.fd48815ee5", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL, 0},
        {"arg_3", NH_TEXT_TEXT, nh_p4, 0, NULL, 0},
        {"arg_4", NH_TEXT_TEXT, nh_p5, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    livelog_printf(nh_p0, nh_p1, nh_p2, nh_text_captured_text(nh_scope, 1, nh_p3), nh_text_captured_text(nh_scope, 2, nh_p4), nh_text_captured_text(nh_scope, 3, nh_p5));
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_0c300ca4ee957359(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.shk.add_to_billobjs.panic.add_to_billobjs_obj_not_free.e30297416d", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}
