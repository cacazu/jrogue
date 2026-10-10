/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_4ec17e722956158b = {"nethack.message.dynamic.apply.use_leash.you_cant.leash_s_from_inside.f395664dde", "You_cant", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_785ab8af65268ab7 = {"nethack.message.dynamic.apply.use_leash.you_cant.unleash_s_from_inside.64fae769ab", "You_cant", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_1bb6a0e474e89dbd = {"nethack.message.dynamic.apply.use_leash.you_cant.unleash_anything_from_inside_s.874de19512", "You_cant", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_db089decf867bfc3(struct nh_phase4_format_value nh_p0, const char * nh_p1) {
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, nh_arguments, 1, -1);
    You_cant(nh_p0.original, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_d5986f6f904ffdde = {"nethack.message.dynamic.apply.flip_coin.pline.wow_a_double_header.a7cef69d38", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_49ce5ea33243b44f = {"nethack.message.dynamic.apply.flip_coin.pline.the_coin_miraculously_lands_on_its_edge.d2a78eaa64", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_27a908c97a8562ed(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    pline(nh_p0.original);
    nh_text_end(nh_scope);
}
