/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_a6734918c4e04a48 = {"nethack.message.dynamic.shk.u_left_shop.verbalize.s_please_pay_before_leaving.c879f9694e", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED};

static const struct nh_text_descriptor nh_phase4_dynamic_format_108062634b1999f2 = {"nethack.message.dynamic.shk.u_left_shop.verbalize.s_don_t_you_leave_without_paying.609dc3dc5e", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED};

static inline void nh_phase4_dynamic_site_6b871ae3d17494d2(struct nh_phase4_format_value nh_p0, const char * nh_p1) {
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, nh_arguments, 1, -1);
    verbalize(nh_p0.original, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_206f1bf33585eb4f = {"nethack.message.dynamic.shk.u_entered_shop.verbalize.will_you_please_leave_your_s_s.de22aad14f", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED};

static const struct nh_text_descriptor nh_phase4_dynamic_format_6c052be9e08fff93 = {"nethack.message.dynamic.shk.u_entered_shop.verbalize.leave_the_s_s_outside.5556d93dd3", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED};

static inline void nh_phase4_dynamic_site_f16bc07ac63b1efe(struct nh_phase4_format_value nh_p0, const char * nh_p1, const char * nh_p2) {
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, nh_arguments, 2, -1);
    verbalize(nh_p0.original, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_b22b42ad0d6f1370 = {"nethack.message.dynamic.shk.u_entered_shop.verbalize.will_you_please_leave_s_outside.c7629ada54", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED};

static const struct nh_text_descriptor nh_phase4_dynamic_format_4fc6ca6473d39c79 = {"nethack.message.dynamic.shk.u_entered_shop.verbalize.leave_s_outside.41597e7804", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED};

static inline void nh_phase4_dynamic_site_b17b6cffefffd1bd(struct nh_phase4_format_value nh_p0, const char * nh_p1) {
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, nh_arguments, 1, -1);
    verbalize(nh_p0.original, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}
