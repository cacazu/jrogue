/* Modified 2026-10-02: source-selected semantic presentation bridge; upstream preserved below. */
#ifndef JROGUE_SITES_INVENT_H
#define JROGUE_SITES_INVENT_H
#include "nh-semantic.h"

static inline void nh_text_site_6966be8017dafc42(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.addinv_core2.pline.you_decipher_the_label_on_s.fe2d3f6f75", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline char nh_text_site_22687c889b806ec6(const char * nh_p0, const char * nh_p1, char nh_p2, boolean nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.adjust_split.yn_function.split_off_how_many.de8dc35fa2", "yn_function", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    char nh_result = yn_function(nh_p0, nh_p1, nh_p2, nh_p3);
    nh_text_end(nh_scope);
    return nh_result;
}

static inline void nh_text_site_3fcb276a2717fe95(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.askchain.pline.no_applicable_objects.8deea0bf59", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_bc1e6d055a3e9f23(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.askchain.pline.that_was_all.cd63662efb", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_7d93cb5e9387471c(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.display_pickinv.add_menu_heading.miscellaneous.5cb0b42660", "add_menu_heading", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_heading(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_15199f085af57e92(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.display_pickinv.add_menu_heading.special.997c544f1b", "add_menu_heading", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_heading(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_db33834e4ae42fc9(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.display_pickinv.add_menu_str.all_items_are_permanently_identified_already.d413a251ec", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_6e03b2cc8e8f52ec(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.display_used_invlets.end_menu.inventory_letters_used.40509b2ccf", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_688a62744999047e(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.doorganize_core.pline.only_gold_coins_may_be_moved_into.aa6897b6c3", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_32ae8db8430dc3f3(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.doorganize_core.pline.select_an_inventory_slot_letter.127cb55ee9", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_04b2702684eb0ceb(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.doorganize_core.your.pack_is_too_full.3c64dd5685", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_e6d5272e328b14e9(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.doperminv.pline.persistent_inventory_display_is_empty.bb590181fa", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_e7b288ba4b1d8019(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.doperminv.pline.persistent_inventory_perm_invent_option_is_not.221f1f23c7", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_53c345ffeb6d6c3f(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.dopramulet.you.are_not_wearing_an_amulet.f980918953", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_462bbd8538031062(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.doprgold.you.have_no_money.abecd636af", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_69ea0685d90f9793(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.doprinuse.you.are_not_wearing_or_wielding_anything.18422707cf", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_d684d064553b7752(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.doprring.you.are_not_wearing_any_rings.9f63a0dcb2", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_d628b2527f62bcaa(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.doprtool.you.are_not_using_any_tools.2831e3518b", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_0a685dfba897fd71(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.dotypeinv.you.are_not_carrying_any_unpaid_objects.8233676478", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_165da3ce03af2121(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.dotypeinv.you.aren_t_carrying_anything.2f95b9065f", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_7c13e08618b699b9(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.getobj.pline.no_count_allowed_with_this_command.073cc4f8f0", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_2da0041c631ceb2a(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.getobj.pline_the.lrs_would_be_very_interested_to_know.58b01e1881", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_62895caff939579f(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.getobj.you.don_t_have_that_object.cc8b045c2c", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_04372caf804f415f(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.ggetobj.pline.not_applicable.a3014a3653", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_a342c96511628e2c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.ggetobj.you.are_not_wearing_a_blindfold.22a2fec9cc", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_2bf70351c965742b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.ggetobj.you.are_not_wearing_an_amulet.f980918953", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_774ae811c178254f(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.ggetobj.you.are_not_wearing_rings.7c4e24c8ce", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_14179107155b1f86(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.ggetobj.you.are_not_wielding_anything.c119ecdbad", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_79eb3443f901a82a(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.look_here.pline.but_you_can_t_reach_it.b1d6b2a80a", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_35e87da00b43e280(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.look_here.you.try_to_feel_what_is_here.1e921fc4bc", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_27bfed88e9728a1b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.look_here.you.try_to_feel_what_is_on_it.f57f0178cd", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_fdccfa3764837c3d(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.menu_identify.pline.choose_an_item_use_esc_to_decline.53bd22378e", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_7c36ebbcedc551d9(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.menu_identify.pline.that_was_all.cd63662efb", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_a685527e82761da8(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.merged.pline.you_learn_more_about_your_items_by.f4c26b5f9f", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_f5f88b99ee9c5439(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.noarmor.you.are_not_wearing_any_armor.9b38977a8c", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_84c0d261f63889c2(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.reroll_menu.add_menu.reroll_another_character.8e30cc09a8", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_fd12d0aa5691a485(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.reroll_menu.add_menu.start_the_game_with_this_character.e7db49572a", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_1005fda49bed2235(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.reroll_menu.end_menu.reroll_this_character.39af1c09ce", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline char nh_text_site_d48c004d3582326a(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.reroll_menu.y_n.reroll_this_character.39af1c09ce", "y_n", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    char nh_result = y_n(nh_p0);
    nh_text_end(nh_scope);
    return nh_result;
}

static inline void nh_text_site_c04c5ef89e55eed7(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.invent.silly_thing.pline_the.amulet_doesn_t_like_being_called_names.8930bebdba", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

#endif
