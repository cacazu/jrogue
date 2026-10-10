/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_1d34925c727c35c4 = {"nethack.message.dynamic.windows.choose_classes_menu.add_menu_str.toggle_off_autopickup_to_not_pick_up.78321bf870", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_033f91278163e262 = {"nethack.message.dynamic.windows.choose_classes_menu.add_menu_str.toggle_on_autopickup_to_automatically_pick_these.ef58bc305e", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_79580f79c4dbdb12(winid nh_p0, struct nh_phase4_format_value nh_p1) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p1.descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1.original);
    nh_text_end(nh_scope);
}
