/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_b8d0338419a15a17 = {"nethack.message.dynamic.sounds.dosounds.you_hear.someone_counting_gold_coins.ac3276877e", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR};

static const struct nh_text_descriptor nh_phase4_dynamic_format_5c5430c6a5f930f2 = {"nethack.message.dynamic.sounds.dosounds.you_hear.the_quarterback_calling_the_play.593bb3344f", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR};

static inline void nh_phase4_dynamic_site_2e361d53a52aadf7(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    You_hear(nh_p0.original);
    nh_text_end(nh_scope);
}
