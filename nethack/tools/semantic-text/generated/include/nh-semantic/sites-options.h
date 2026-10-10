/* Modified 2026-10-02: source-selected semantic presentation bridge; upstream preserved below. */
#ifndef JROGUE_SITES_OPTIONS_H
#define JROGUE_SITES_OPTIONS_H
#include "nh-semantic.h"

static inline void nh_text_site_080f721a77e0f195(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.doset.add_menu_heading.compounds_selecting_will_prompt_for_new_value.338b660078", "add_menu_heading", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_heading(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_6515726306997531(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.feature_alert_opts.pline.feature_change_alerts_disabled_for_nethack_s.3cde7170f3", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_b282f432fd7b0373(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_align_misc.add_menu.bottom.be9b7607e0", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_44a19ca8bd1a14eb(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_align_misc.add_menu.left.360f840359", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_3f3e1098f42cedd5(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_align_misc.add_menu.right.27042f4e6e", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_a66bf367ab99d840(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_align_misc.add_menu.top.28720365c5", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_c9b770286b0f51df(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_autopickup_exception.add_menu_heading.always_pickup_never_pickup.1abf2c3662", "add_menu_heading", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_heading(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_15a061cb75655276(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.optfn_fruit.config_error_add.doing_that_so_many_times_isn_t.6535d12444", "config_error_add", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    config_error_add(nh_p0);
    nh_text_end(nh_scope);
}

#endif
