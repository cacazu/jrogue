/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_23da9657cdcfe662 = {"nethack.message.dynamic.timeout.nh_timeout.you.are_no_longer_invisible.840c8df237", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_dde1ab6f1692210f = {"nethack.message.dynamic.timeout.nh_timeout.you.can_no_longer_see_through_yourself.67c13aa63c", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_adeec2c85f8b499a(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    You(nh_p0.original);
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_e999fb580ca8b5cd = {"nethack.message.dynamic.timeout.burn_object.pline.they_shriek.b05d46e8b3", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_fe7f8dd8f945f359 = {"nethack.message.dynamic.timeout.burn_object.pline.it_shrieks.2ce4f1fc6f", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_c574161f054301da = {"nethack.message.dynamic.timeout.burn_object.pline.symbol_or_empty.e3b0c44298", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_f60cc24d4eaa82c2 = {"nethack.message.dynamic.timeout.burn_object.pline.their_flames_die.1a2ea10010", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_3e81b62608b6062a = {"nethack.message.dynamic.timeout.burn_object.pline.its_flame_dies.83b95b4bf8", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_8fb85a7e94ae12bc(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    pline(nh_p0.original);
    nh_text_end(nh_scope);
}
