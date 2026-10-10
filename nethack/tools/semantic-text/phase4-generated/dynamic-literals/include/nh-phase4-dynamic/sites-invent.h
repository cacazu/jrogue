/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_cd22b297fa764955 = {"nethack.message.dynamic.invent.display_pickinv.add_menu_heading.in_use.750af77aa4", "add_menu_heading", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_8b1b71e4f0c2e657 = {"nethack.message.dynamic.invent.display_pickinv.add_menu_heading.inventory_in_use.72712bb1a3", "add_menu_heading", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_99a7825cd3d68f33(winid nh_p0, struct nh_phase4_format_value nh_p1) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p1.descriptor, NULL, 0, nh_p0);
    add_menu_heading(nh_p0, nh_p1.original);
    nh_text_end(nh_scope);
}
