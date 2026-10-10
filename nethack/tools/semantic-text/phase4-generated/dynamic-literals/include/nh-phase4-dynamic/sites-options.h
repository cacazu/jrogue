/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_40cf2559c682514f = {"nethack.message.dynamic.options.doset_simple_menu.add_menu.hide_help.bfa7fc9f17", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_c0a913e05a08d49a = {"nethack.message.dynamic.options.doset_simple_menu.add_menu.show_help.78cf486d4b", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_2bebb0fdd199809e(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, struct nh_phase4_format_value nh_p7, unsigned int nh_p8) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p7.descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7.original, nh_p8);
    nh_text_end(nh_scope);
}
