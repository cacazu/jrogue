/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_51390f4d66c602f4 = {"nethack.message.dynamic.mthrowu.return_from_mtoss.pline.splash.7a649b170e", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_18f6ccd0297dd8a1 = {"nethack.message.dynamic.mthrowu.return_from_mtoss.pline.plop.f944bf6f08", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_74ca0601989b3bf9(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    pline(nh_p0.original);
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_4caee6ba66cabe32 = {"nethack.message.dynamic.mthrowu.hit_bars.you_hear.angry_snakes.dc4d8ec7f1", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR};

static const struct nh_text_descriptor nh_phase4_dynamic_format_9f7907ba83ab1430 = {"nethack.message.dynamic.mthrowu.hit_bars.you_hear.a_hissing_noise.33f70aff93", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR};

static inline void nh_phase4_dynamic_site_6f87348bdddc9bd8(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    You_hear(nh_p0.original);
    nh_text_end(nh_scope);
}
