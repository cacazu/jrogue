/* Modified 2026-10-02: additive phase-four source observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_site_c19fe75d4221ce95(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_kill.pline.s.c1fda072e8", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2c0cf95b79403b7b(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_kill.you.s_s.4acb54febc", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_32a38974d72158f2(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_kill.pline.s_is_s.86b098e6e9", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_89c98711e2e487d0(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_kill.there.is_no_monster_there.88e4a52a11", "There", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    There(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_586fab7e46c771af(const char * nh_p0, char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_load_lua.getlin.load_which_lua_file.97a26f916c", "getlin", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    getlin(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_010b2ca4f17ef9d1(const char * nh_p0, char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_load_splua.getlin.load_which_des_lua_file.0468e247bd", "getlin", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    getlin(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_d9c6750ab31f0485(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_flip_level.pline.s.f684c73cba", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_dffba0033a50e1bf(const char * nh_p0, char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_level_change.getlin.to_what_experience_level_do_you_want.603a1f4ac6", "getlin", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    getlin(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e0d5500c3b34ee67(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_level_change.you.are_already_that_experienced.11af20f207", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8a9cfc88ddb152b2(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_level_change.you.are_already_as_inexperienced_as_you_can.a110bd0db8", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_25a0ca7ad2a94dd6(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_level_change.you.are_already_as_experienced_as_you_can.41e2f0b02a", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3fdabccf56325022(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_telekinesis.pline.pick_a_monster_to_hurtle.12021a699e", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_387cbfb20817b7be(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_fuzzer.pline.the_fuzz_tester_will_make_nethack_execute.a66d57e305", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2ccf9d223089f49e(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_fuzzer.there.is_no_conventional_way_out_of_this.554d8fa610", "There", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    There(nh_p0);
    nh_text_end(nh_scope);
}

static inline char nh_phase4_site_732d6c22e68b0f03(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_fuzzer.y_n.do_you_want_to_call_panic_after.0b55a14f20", "y_n", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    char nh_result = y_n(nh_p0);
    nh_text_end(nh_scope);
    return nh_result;
}

static inline void nh_phase4_site_eef9427d24c83d84(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_show_vision.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f0940998a169b651(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_show_wmodes.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f6c9efa52376833e(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_map_levltyp.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_74d66aa4da386bd0(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_levltyp_legend.putstr.terrain_encodings.6208585164", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c7ca0d5ea5097d83(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_levltyp_legend.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_16a5974256706528(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_smell.you.are_incapable_of_detecting_odors_in_your.e4edbc77de", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_189d0a64acbc53ba(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_smell.you.can_move_the_cursor_to_a_monster.5e7a463137", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_bef0fcce96a5e76f(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_smell.pline.pick_a_monster_to_smell.d773471ded", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b095b6868613bfd0(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_smell.you.surreptitiously_sniff_under_your_s.ac546667a2", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_41ea6d44522de244(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_smell.pline.s_to_not_give_off_any_smell.f78a53f01d", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b9e2eac13cc34b01(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_smell.you.don_t_smell_any_monster_there.500fa64f97", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_74eba77da266c805(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_intrinsic.add_menu_str.symbol_or_empty.d8156bae0c", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b0d83dfdddf5cd14(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_intrinsic.end_menu.which_intrinsics.0bd85b18c8", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b32094db22916dab(const char * nh_p0, const char * nh_p1, const char * nh_p2, int nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_intrinsic.pline.timeout_for_s_s_d.20988fdb41", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_p3);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a70976cbb8fc5e5d(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.list_migrating_mons.pline.no_monsters_currently_migrating.5920c56100", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8e2fbaaa7bb8249b(const char * nh_p0, int nh_p1, const char * nh_p2, int nh_p3, int nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.list_migrating_mons.pline.d_mon_s_pending_for_current_level.ee6fdce058", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
        {"arg_4", NH_TEXT_INTEGER, NULL, (int64_t)nh_p4, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    pline(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 1, nh_p2), nh_p3, nh_p4);
    nh_text_end(nh_scope);
}

static inline char nh_phase4_site_e79741220a35b0c0(const char * nh_p0, const char * nh_p1, char nh_p2, boolean nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.list_migrating_mons.yn_function.list_which.7505ff4b72", "yn_function", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    char nh_result = yn_function(nh_p0, nh_p1, nh_p2, nh_p3);
    nh_text_end(nh_scope);
    return nh_result;
}

static inline void nh_phase4_site_627e50e26a063cb4(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.list_migrating_mons.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_dca8206503157c0b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.list_migrating_mons.pline.none.903ea500e7", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6a7b7fcbc0f4bbf5(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_show_stats.putstr.current_memory_statistics.b79648f080", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_26e966fa26141dbe(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_show_stats.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3bccb26d52fe0087(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_show_stats.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c570b4e06a06d4f4(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_show_stats.putstr.overview.5a3f8e7a5d", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c540cab6ae90041d(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_show_stats.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b263e87c0c96abb4(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_show_stats.putstr.miscellaneous.38111abb1f", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ba1ac1469956a072(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_show_stats.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f27d27f1ba654b02(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_display_macros.putstr.no_display_macro_issues_detected.4d187342db", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_947bf03bbf92c34c(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_show_nhuuid.pline.the_nhuuid_for_this_game_is_s.ef6602849c", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0aafe605806a3d2e(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_mon_diff.putstr.no_monster_difficulty_discrepancies_were_detected.2fcba9225d", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b57d4de720678282(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_objprobs.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_46a6cfba9c3183e0(const char * nh_p0, char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_migrate_mons.getlin.how_many_random_monsters_to_migrate_to.6704aadd27", "getlin", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    getlin(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_740079414da8afaf(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_migrate_mons.pline.can_t_get_there_from_here.ffa44ec031", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_810af0865bc86cce(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.wizcmds.wiz_custom.add_menu_heading.glyph_glyph_identifier_sym_clr_customcolor_unicode.c6baa314df", "add_menu_heading", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_heading(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}
