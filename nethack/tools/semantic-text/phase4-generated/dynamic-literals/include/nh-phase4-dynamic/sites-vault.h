/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_48c2b07ee7164e56 = {"nethack.message.dynamic.vault.invault.getlin.you_are_required_to_supply_your_name.66af2eed4c", "getlin", NH_TEXT_QUESTION, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_b51c845f2c90ee1f = {"nethack.message.dynamic.vault.invault.getlin.hello_stranger_who_are_you.7ce7528967", "getlin", NH_TEXT_QUESTION, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_c3588c3b563a6f4f(struct nh_phase4_format_value nh_p0, char * nh_p1) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    getlin(nh_p0.original, nh_p1);
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_ecbf6edd9c0c7860 = {"nethack.message.dynamic.vault.gd_letknow.you.see_s_approaching.3d140089a1", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_6a218acbe02fb9c4 = {"nethack.message.dynamic.vault.gd_letknow.you.are_confronted_by_s.18837143d6", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_667c806f70112151(struct nh_phase4_format_value nh_p0, const char * nh_p1) {
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, nh_arguments, 1, -1);
    You(nh_p0.original, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}
