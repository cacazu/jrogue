/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_cd62a133ebf4f187 = {"nethack.message.dynamic.zap.zapyourself.pline.the_wand_shoots_an_apparently_harmless_beam.1ec7b45592", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_0406be15a2829102 = {"nethack.message.dynamic.zap.zapyourself.pline.you_seem_no_deader_than_before.0bcdebdc48", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_556bbf102e941aba(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    pline(nh_p0.original);
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_40bafa409bda3f7b = {"nethack.message.dynamic.zap.zap_map.pline_the.floor_runs_like_butter.c32546be66", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_831a00df8aaf4ff6 = {"nethack.message.dynamic.zap.zap_map.pline_the.edges_on_the_floor_get_smoother.c56791d459", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_1fdabe85dfe2de81(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    pline_The(nh_p0.original);
    nh_text_end(nh_scope);
}
