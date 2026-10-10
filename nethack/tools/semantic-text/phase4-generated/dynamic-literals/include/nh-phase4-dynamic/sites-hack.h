/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_21c3c986ada97697 = {"nethack.message.dynamic.hack.dosinkfall.you.wobble_unsteadily_for_a_moment.7b763c59c5", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_885ff315d44af8e8 = {"nethack.message.dynamic.hack.dosinkfall.you.gain_control_of_your_flight.f4c06758d0", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_3e9752f89bc5564c(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    You(nh_p0.original);
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_e9e1798dcf321bf0 = {"nethack.message.dynamic.hack.maybe_wail.pline.s_all_your_powers_will_be_lost.566963fdcf", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_8c0876f7bdb49388 = {"nethack.message.dynamic.hack.maybe_wail.pline.s_your_life_force_is_running_out.ba56d69556", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_6ad0d79b70d804fe(struct nh_phase4_format_value nh_p0, const char * nh_p1) {
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, nh_arguments, 1, -1);
    pline(nh_p0.original, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_6545db44bd63e1f8 = {"nethack.message.dynamic.hack.maybe_wail.you_hear.the_wailing_of_the_banshee.7dc0204168", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR};

static const struct nh_text_descriptor nh_phase4_dynamic_format_2f178958147b2ddb = {"nethack.message.dynamic.hack.maybe_wail.you_hear.the_howling_of_the_cwnannwn.8447843d55", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR};

static inline void nh_phase4_dynamic_site_7581577e367f0585(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    You_hear(nh_p0.original);
    nh_text_end(nh_scope);
}
