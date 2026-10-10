/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_1141247dbb9e80ac = {"nethack.message.dynamic.potion.make_deaf.you.can_hear_again.9f23f9c1fb", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_42453d65f62b4c77 = {"nethack.message.dynamic.potion.make_deaf.you.are_unable_to_hear_anything.31b2508d00", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_72cd1431fc0ce9d5(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    You(nh_p0.original);
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_ec08d0ecaec96dd8 = {"nethack.message.dynamic.potion.peffect_see_invisible.pline.this_tastes_like_real_s_s_all.ed845eaef9", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_0b133d6fdf02fcfe = {"nethack.message.dynamic.potion.peffect_see_invisible.pline.this_tastes_like_s_s.d397d56aee", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_bc718086beaccf27(struct nh_phase4_format_value nh_p0, const char * nh_p1, const char * nh_p2) {
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, nh_arguments, 2, -1);
    pline(nh_p0.original, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}
