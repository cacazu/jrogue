/* Modified 2026-10-02: additive phase-four source observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_site_91758b00dbcc079c(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.doextlist.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_5b959776b0059839(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.doextlist.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f990dd98037453f5(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.doextlist.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_09266d5891f034fa(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.enter_explore_mode.pline.beware_from_explore_mode_there_will_be.6f2ab884fc", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0e7b9c36dc79381a(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.enter_explore_mode.pline.continuing_with_s.4b0b1c2879", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_74ed19072766eeaf(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.doterrain.add_menu.internal_levl_typ_codes_in_base.dc82397350", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8bc10de4b8da4ddf(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.doterrain.add_menu.legend_of_base_levl_typ_codes.1add9e9ffc", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a791412f050d897e(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.lookaround_known_room.you.s_s_s.0a9515a848", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_54fe37bbd00fb877(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.lookaround_known_room.you.guess_s_to_be_s_s.9d9f86cb92", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e615b38fa0766708(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.lookaround_known_room.you.can_t_guess_the_size_of_s.5521f005fa", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c966694c830cfe23(coordxy nh_p0, coordxy nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.dolookaround.pline_xy.s.3ffc64bb85", "pline_xy", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline_xy(nh_p0, nh_p1, nh_p2, nh_text_captured_text(nh_scope, 0, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0fd571d5460757a3(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.handler_rebind_keys_add.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0cc2031e8318d85b(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.handler_rebind_keys_add.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_423fcaad08063730(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.dokeylist.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_36cf7dcf0e124143(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.dokeylist.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_25d5292ee9b26eb7(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.dokeylist.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e9d97e194b43f701(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.dokeylist.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8485f7ba9f8b0848(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.dokeylist.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_d7db6a2d428abb2d(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.dokeylist.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4d564f5c5a5501c9(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.dokeylist.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_cafca8c3dba3ef9f(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.dokeylist.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ae7abed03119663f(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.dokeylist.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_5992c8cb9087e0c4(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.dokeylist.putstr.debug_mode_commands.364ad0fa5c", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2f6f43f6fe57e341(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.parseautocomplete.raw_printf.bad_autocomplete_invalid_extended_command_s.909f59b19d", "raw_printf", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    raw_printf(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_60e23fa289e1bf95(unsigned nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.rhack.custompline.the_s_command_does_not_accept_s.fd85380caa", "custompline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    custompline(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2), nh_text_captured_text(nh_scope, 1, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4e365f65ab30bae5(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.rhack.pline.the_s_prefix_should_be_followed_by.548351366f", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_d9a7a2fc82c8e24a(unsigned nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.rhack.custompline.unknown_command_s.182364ee1e", "custompline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    custompline(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_84c646e722457189(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.show_direction_keys.putstr.symbol_or_empty.85f51ee76d", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_09eee89308c3aa12(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.show_direction_keys.putstr.symbol_or_empty.85f51ee76d", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4d20b3cda199411e(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.show_direction_keys.putstr.symbol_or_empty.f050e71203", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_32e89313be024c5f(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.show_direction_keys.putstr.symbol_or_empty.c46147fff4", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_260d44fc83c7d2dc(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.help_dir.pline.s.f684c73cba", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_59b7713eeaba6367(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.help_dir.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_11ca55910c5483ff(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.help_dir.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c78c53d8601e46be(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.help_dir.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_05a212b4e4e141b9(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.help_dir.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_460ac3c9fe0ed34d(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.help_dir.putstr.to_use_that_command_hold_down_the.cb395c6126", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e5beb606a633a3a6(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.help_dir.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_590c53a9a3917d30(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.help_dir.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3984b73245226462(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.help_dir.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ffbab4e36ccd7308(unsigned nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.get_count.custompline.s.f684c73cba", "custompline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    custompline(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f74b72abcacc28a7(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.cmd.yn_function_menu.pline.s_s.8a977da5cd", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}
