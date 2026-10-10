/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_2eacc9b1c29aa6fa = {"nethack.message.dynamic.pickup.query_category.add_menu.auto_select_every_item_being_worn_or.1291b5bd66", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_2cad8a0d0a4cdacd = {"nethack.message.dynamic.pickup.query_category.add_menu.auto_select_every_relevant_item.fb1a9616c6", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_1e1321a4d9f7f924(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, struct nh_phase4_format_value nh_p7, unsigned int nh_p8) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p7.descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7.original, nh_p8);
    nh_text_end(nh_scope);
}

static const struct nh_text_descriptor nh_phase4_dynamic_format_6811189af869aa00 = {"nethack.message.dynamic.pickup.query_category.add_menu.all_worn_and_wielded_types.809ca3895f", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_a99bcc0636745da3 = {"nethack.message.dynamic.pickup.query_category.add_menu.all_types.f10988e79e", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_4a6f6ccb6bc25b1e(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, struct nh_phase4_format_value nh_p7, unsigned int nh_p8) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p7.descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7.original, nh_p8);
    nh_text_end(nh_scope);
}
