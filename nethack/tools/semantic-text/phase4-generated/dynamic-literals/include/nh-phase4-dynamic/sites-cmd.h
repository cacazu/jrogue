/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_ecba6480a7ed551e = {"nethack.message.dynamic.cmd.doextlist.add_menu.switch_to_showing_debugging_commands_in_separate.bede177def", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_c9aa0131eb60a6b9 = {"nethack.message.dynamic.cmd.doextlist.add_menu.switch_to_showing_all_alphabetically_including_debugging.f3a0fc2d16", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_e51286e4023e5222(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, struct nh_phase4_format_value nh_p7, unsigned int nh_p8) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p7.descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7.original, nh_p8);
    nh_text_end(nh_scope);
}
