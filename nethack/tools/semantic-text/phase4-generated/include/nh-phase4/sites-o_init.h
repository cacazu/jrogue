/* Modified 2026-10-02: additive phase-four source observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_site_f6d73a3e48065b16(const char * nh_p0, int nh_p1, int nh_p2, int nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.o_init.setgemprobs.raw_printf.not_enough_gems_first_d_j_d.3965065a07", "raw_printf", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    raw_printf(nh_p0, nh_p1, nh_p2, nh_p3);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e34a8e639f6cfd91(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.o_init.choose_disco_sort.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6421d87bf3c1abc1(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.o_init.choose_disco_sort.add_menu_str.note_full_alphabetical_and_alphabetical_within_class.96ed631c7d", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_281f442ae39a982f(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.o_init.choose_disco_sort.add_menu_str.are_equivalent_for_single_class_discovery_but.109b253d77", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c2d24e127f31c63f(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.o_init.choose_disco_sort.add_menu_str.will_matter_for_future_use_of_total.5c95451ce1", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_9ae1447b8a4a2ef6(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.o_init.choose_disco_sort.end_menu.ordering_of_discoveries.2ccf709333", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b74bb4ccc78a8aed(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.o_init.dodiscovered.putstr.symbol_or_empty.e3b0c44298", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_12d12ac98f8c17ca(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.o_init.dodiscovered.you.haven_t_discovered_anything_yet.c4e35ccfa8", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_d648cbb28bcf66dc(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.o_init.dodiscovered.putstr.discovered_items.384328f4ac", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline char nh_phase4_site_9372577d2ced2a23(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.o_init.doclassdisco.y_n.dump_information_about_all_artifacts.fd47400fe4", "y_n", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    char nh_result = y_n(nh_p0);
    nh_text_end(nh_scope);
    return nh_result;
}

static inline void nh_phase4_site_af143f8775ecf8b2(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.o_init.rename_disco.you.haven_t_discovered_anything_yet.c4e35ccfa8", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_697d262d36cfe215(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.o_init.rename_disco.pline.none_of_your_discoveries_can_be_assigned.59b0d0320b", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e510f93874af3276(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.o_init.rename_disco.end_menu.pick_an_object_type_to_name.3f74208412", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}
