/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_bb10c109993679c3(long nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.hack.still_chewing.livelog_printf.ate_for_the_first_time_by_chewing.70fe7e9832", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    livelog_printf(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_91b5e66f315a04e4(long nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.hack.domove_swap_with_pet.livelog_printf.killed_for_the_first_time.508817b74d", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    livelog_printf(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_0e85493add66969b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.hack.rounddiv.panic.division_by_zero_in_rounddiv.6ecc70c1ff", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}
