/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_d876492e1b2e1817 = {"nethack.message.dynamic.pray.offer_corpse.you.see_crabgrass_at_your_s_a_funny.97c7103718", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_d72471bb027a2ba6 = {"nethack.message.dynamic.pray.offer_corpse.you.glimpse_a_four_leaf_clover_at_your.e3f6e9859a", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_79d37b5e8e488893(struct nh_phase4_format_value nh_p0, const char * nh_p1) {
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, nh_arguments, 1, -1);
    You(nh_p0.original, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}
