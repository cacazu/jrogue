/* Modified 2026-10-02: additive phase-four source observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_site_b63a6384c399ce95(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.ask_do_tutorial.add_menu.yes_do_a_tutorial.6e9f7cb7b4", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_be10dfc1cd96eb7e(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.ask_do_tutorial.add_menu.no_just_start_play.a0418d57cf", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_bd5431df66dc3700(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.ask_do_tutorial.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_823d15c49918a428(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.ask_do_tutorial.add_menu_str.please_choose_y_or_n.d1167e2143", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_305a4f381d2f340a(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.ask_do_tutorial.end_menu.do_you_want_a_tutorial.737ae8bda0", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c0a59be01a56bd8b(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.optfn_fruit.pline.fruit_is_now_s.de68df4448", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_60ee80ae01c87981(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3, const char * nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.optfn_sortvanquished.pline.s_s_s_s.266501164f", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
        {"arg_4", NH_TEXT_TEXT, nh_p4, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3), nh_text_captured_text(nh_scope, 3, nh_p4));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_abfdda088412be8c(const char * nh_p0, const char * nh_p1, const char * nh_p2, unsigned int nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.optfn_versinfo.pline.s_s_u.a11a6f051a", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p3, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_p3);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b83e770892ded0c5(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.optfn_boolean.pline.there_is_no_underlying_support_for_idlecheckpoint.690b296f15", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_507bc32584ec6cd4(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.optfn_boolean.pline.s_option_toggled_s.4c7facc748", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_33346d2884d61a03(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_menustyle.end_menu.select_menustyle.95efdb1dc4", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c316db9cbff81968(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_menustyle.pline.menustyle_s_s.c31a9ffb06", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a5dd633467f1d0cd(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_autounlock.pline.s_s_s.7a4ff72366", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3185c7ea23b2d35e(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_disclose.end_menu.change_which_disclosure_options_categories.83a0734f60", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c00f2a0aef7f0eec(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_disclose.add_menu.never_disclose_without_prompting.0209eab51a", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c942c5812804b0ec(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_disclose.add_menu.always_disclose_without_prompting.e8771bbbef", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_bcb28bd0b34f933f(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_disclose.add_menu.always_disclose_pick_sort_order_from_menu.4d6d2b8315", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_631882009dbc3853(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_disclose.add_menu.prompt_with_default_answer_of_no.106c0ed5da", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_5421b02f652ff938(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_disclose.add_menu.prompt_with_default_answer_of_yes.fdf6675abe", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_cc774a3c4a61bff3(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_disclose.add_menu.prompt_with_default_answer_of_ask_to.ca1d690641", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_720e5337fcba2f67(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_menu_objsyms.end_menu.set_object_symbols_in_menus_to_what.aa6ca815c3", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7e0dfa4e48f68e90(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_msg_window.end_menu.select_message_history_display_type.766a4776f1", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8a669f8b29c2f21a(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    /* Native-English fallback: precision-bound text has no approved public-prefix producer. */
    nh_text_cancel_pending(); /* presentation-only owner must not leak from an outer wrapper */
    pline(nh_p0, nh_p1, nh_p2);
}

static inline void nh_phase4_site_9a41e1af46a59e7d(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_msg_window.pline.s_option_is_not_supported_for_s.faa0541b6b", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6e7480e516e767c4(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_number_pad.end_menu.select_number_pad_mode.4da6705c77", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2d43e98407d76e2e(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_paranoid_confirmation.end_menu.actions_requiring_extra_confirmation.7158b103a7", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_58f2544b71c8c188(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_perminv_mode.end_menu.choose_permanent_inventory_mode.3207013f93", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_d1c96a9a51f891e9(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_perminv_mode.pline.perminv_mode_s_s_s.94ce75b4b1", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_5f2eb5934db87ee7(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_pickup_burden.end_menu.select_encumbrance_level.13d3bff659", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0143dc48e565fc8a(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_runmode.end_menu.select_run_travel_display_mode.8827aa2165", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7d9f2fab29580471(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_sortloot.end_menu.select_loot_sorting_type.d3fdb77dbd", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_fbaf81d42a98fa9d(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_whatis_coord.add_menu.compass_east_or_s_or_n_w.51ea1e1e94", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0da82c9d650fd6d8(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_whatis_coord.add_menu.full_compass_east_or_south_or_north.f9b833244f", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ad4691ae5a53a95b(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_whatis_coord.add_menu.map_x_y.af4a280f4b", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e7c96c8967fa0872(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_whatis_coord.add_menu.screen_row_column.83983b56da", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_9a1043f953a537fb(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_whatis_coord.add_menu.none_no_coordinates_displayed.e2850253d9", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6fd61374554d20b0(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_whatis_coord.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_24f9016f28cafd86(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_whatis_coord.add_menu_str.screen_row_is_offset_to_accommodate_tty.eef75cee83", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_bd5e8a03b3a9d61d(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_whatis_coord.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_fe0a770f6d20f592(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_whatis_coord.end_menu.select_coordinate_display_when_auto_describing_a.a5bed12d8c", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_9db1d1d6d837c2bc(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_whatis_filter.add_menu.no_filtering.a33d3f5979", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7370cbb5a1db09e5(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_whatis_filter.add_menu.in_view_only.b966927c10", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e7c2fe91bc209701(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_whatis_filter.add_menu.in_same_area.25fe621c8d", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ef3a42b791bde20d(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_whatis_filter.end_menu.select_location_filtering_when_going_for_next.393addb179", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f19f5e6115af19cb(const char * nh_p0, char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_autopickup_exception.getlin.what_new_autopickup_exception_pattern.58070ae313", "getlin", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    getlin(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4e552bb9ae0837e0(const char * nh_p0, char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_menu_colors.getlin.what_new_menucolor_pattern.ac1d248aa2", "getlin", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    getlin(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_736d2c7426632237(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_menu_colors.pline.error_adding_the_menu_color.71fd95e8ef", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_435455e6573568b0(const char * nh_p0, char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_msgtype.getlin.what_new_message_pattern.cff05d8063", "getlin", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    getlin(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_076f22b8ef7aac8f(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_msgtype.pline.error_adding_the_message_type.a097dbc2da", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_fe30e8bd4fc547ec(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_versinfo.add_menu.version_number.36a308453a", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_15682f5ed09581d1(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_versinfo.add_menu.game_name.558f3199d3", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6d1270e29604b60c(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_versinfo.end_menu.select_version_information_flags.53cd271b90", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_46f8e90622e543ba(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handler_windowborders.end_menu.select_window_borders_mode.8f272bc48a", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8e527f36d1226000(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.rejectoption.pline.s_settable_only_from_s.386eb84704", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_90cb03f722d1713d(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.rejectoption.pline.s_can_be_set_only_from_nethackoptions.fa0bd89f15", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0609100fdde43558(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.initoptions_finish.raw_printf.status_highlighting_not_supported_for_s_interface.950237650e", "raw_printf", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    raw_printf(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a49f43f4d0dd557e(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.feature_alert_opts.you_cant.disable_new_feature_alerts_for_future_versions.e660ea6680", "You_cant", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_cant(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b6b51e9388e5e4f1(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.query_msgtype.end_menu.how_to_show_the_message.e753b11dcc", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_9854248e7f201407(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.add_menu_cmd_alias.pline.out_of_menu_map_space.dddf383b35", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3546166855e6b194(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.doset_simple_menu.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_d01534bb857f636e(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.doset_simple_menu.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_230f7543158a27c5(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.doset_simple_menu.end_menu.options.d0db8b5e36", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_9634e2100173333d(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.doset.add_menu.view_help_for_options_menu.5e01e24b84", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_eb697f896e9f4c2d(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.doset.add_menu_heading.booleans_selecting_will_toggle_value.ceeb3573ff", "add_menu_heading", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_heading(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_eec131ee129d6fc1(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.doset.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_71801ddb29cde275(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.doset.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_326e333e7a43e10c(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.doset.add_menu_heading.other_settings.3cbaf935a8", "add_menu_heading", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_heading(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_223f5b8999f913f0(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.doset.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_72ec31b195477a00(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.doset.add_menu_heading.variable_playground_locations.693cf04f78", "add_menu_heading", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_heading(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0ce6634539a9cb7f(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.doset.end_menu.set_what_options.bd6f86dbea", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f8c5c23dfe47fe7b(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.show_menu_controls.putstr.menu_control_keys.af169171e7", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3b13409bcdce541a(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.show_menu_controls.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_757c00a9c9e057b3(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.show_menu_controls.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_81513ddb70775bce(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.show_menu_controls.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8a79262022ee6cef(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.show_menu_controls.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_940039bb870e597a(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.handle_add_list_remove.end_menu.do_what.35089f705f", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_5cc1756311a27bec(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.dotogglepickup.pline.autopickup_s.477daf2b23", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_711e36d66ef25a5d(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.option_help.putstr.compound_options.8736f2b6f0", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_268441b491312e16(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.option_help.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_19876e00afb41cd3(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.option_help.putstr.other_settings.3cbaf935a8", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8c1a7ba86ca09d3c(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.options.option_help.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}
