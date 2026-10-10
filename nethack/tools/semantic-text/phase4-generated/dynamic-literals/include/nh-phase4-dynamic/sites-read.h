/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_f7d06df2d46ae506 = {"nethack.message.dynamic.read.doread.pline.you_s_the_formula_on_the_scroll.f95c60250c", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_ea5f8dc456129ddf = {"nethack.message.dynamic.read.doread.pline.as_you_s_the_formula_on_it.db753b3778", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_081b86adff73ce10(struct nh_phase4_format_value nh_p0, const char * nh_p1) {
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, nh_arguments, 1, -1);
    pline(nh_p0.original, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_ad9a06309195dc28 = {"nethack.message.dynamic.read.doread.pline.you_read_the_scroll.04c477b870", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_bd55e5b6146f9307 = {"nethack.message.dynamic.read.doread.pline.as_you_read_the_scroll_it_disappears.4d0bba6096", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_189a8541bd77d777(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    pline(nh_p0.original);
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_b02ae69af7db4662 = {"nethack.message.dynamic.read.seffect_remove_curse.you_feel.like_someone_is_helping_you.29e9e8b3cc", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL};

static const struct nh_text_descriptor nh_phase4_dynamic_format_fca515af79ea5656 = {"nethack.message.dynamic.read.seffect_remove_curse.you_feel.like_you_need_some_help.bce0311b34", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL};

static const struct nh_text_descriptor nh_phase4_dynamic_format_9c992b04b76012b8 = {"nethack.message.dynamic.read.seffect_remove_curse.you_feel.in_touch_with_the_universal_oneness.2330524b24", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL};

static const struct nh_text_descriptor nh_phase4_dynamic_format_032867ebb29e0de3 = {"nethack.message.dynamic.read.seffect_remove_curse.you_feel.the_power_of_the_force_against_you.9bceaf9ffc", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL};

static inline void nh_phase4_dynamic_site_3cbe638734eef862(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    You_feel(nh_p0.original);
    nh_text_end(nh_scope);
}
