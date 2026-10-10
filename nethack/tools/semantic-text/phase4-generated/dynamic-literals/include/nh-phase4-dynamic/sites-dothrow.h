/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_c91de04e10e20c38 = {"nethack.message.dynamic.dothrow.throwit.pline.s_lands_s_your_s.f01c5d508f", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_fdd23f055877eca9 = {"nethack.message.dynamic.dothrow.throwit.pline.s_back_to_you_landing_s_your.1ab6a5d152", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_cd71d37908dad662(struct nh_phase4_format_value nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, nh_arguments, 3, -1);
    pline(nh_p0.original, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_8c011b870bd7f8f4 = {"nethack.message.dynamic.dothrow.throwit.pline.s_your_s.c4c35c0e96", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_7226a8b41e4403e7 = {"nethack.message.dynamic.dothrow.throwit.pline.s_back_toward_you_hitting_your_s.cff78c8e14", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_a22a62784843c10a(struct nh_phase4_format_value nh_p0, const char * nh_p1, const char * nh_p2) {
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, nh_arguments, 2, -1);
    pline(nh_p0.original, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_f8d237f6b72b857b = {"nethack.message.dynamic.dothrow.throwit.pline.splash.7a649b170e", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_9e85776c27b0e810 = {"nethack.message.dynamic.dothrow.throwit.pline.plop.f944bf6f08", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_97e519389889a25b(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    pline(nh_p0.original);
    nh_text_end(nh_scope);
}
