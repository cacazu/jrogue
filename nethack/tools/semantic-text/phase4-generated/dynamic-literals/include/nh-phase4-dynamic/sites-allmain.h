/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_7fe7c194cb9b1901 = {"nethack.message.dynamic.allmain.welcome.pline.s_s_welcome_to_nethack_you_are.4d798ac3fa", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_c5b4071af0e4a158 = {"nethack.message.dynamic.allmain.welcome.pline.s_s_the_s_welcome_back_to.050fcf7fd8", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_cebc67044a3ab2ce(struct nh_phase4_format_value nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, nh_arguments, 3, -1);
    pline(nh_p0.original, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}
