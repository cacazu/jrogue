/* Modified 2026-10-02: additive phase-four source observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_site_d49e94b72bdc7662(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.cursed_book.you_feel.a_wrenching_sensation.1c534d0463", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_feel(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b9ecf1233864d83f(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.cursed_book.you_feel.threatened.3df8076e20", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_feel(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_1914f400528a6d22(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.cursed_book.pline.these_runes_were_just_too_much_to.46f4577896", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_03b8a6d75a678207(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.cursed_book.pline_the.book_was_coated_with_contact_poison.3fe5b88eda", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_5c54897b447cf112(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.cursed_book.pline_the.book_s_but_you_are_unharmed.2b25f323ee", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline_The(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8d193999583ac659(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.cursed_book.pline.as_you_read_the_book_it_s.ce66bec45d", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e5a52d87a392964d(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.confused_book.pline.being_confused_you_have_difficulties_in_controlling.bf66c749d5", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c95b85ff2eaaad42(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.confused_book.you.accidentally_tear_the_spellbook_to_pieces.453ed6631c", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_42fe379e8b117e8b(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.confused_book.you.find_yourself_reading_the_s_line_over.1dc08b687d", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b2ed14e503a91ed4(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.deadbook.you.turn_the_pages_of_the_book_of.4e027b8087", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ec30599af3d585ba(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.deadbook.pline_the.s.749be38fc0", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline_The(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_163048aeb7e74c1f(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.deadbook.pline.a_chill_runs_down_your_s.294bc8fd54", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_91a5909aa0cf5a2b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.deadbook.you_hear.a_faint_chime.503b790f53", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_hear(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_03748dfabc83ee68(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.deadbook.pline.vlad_s_doppelganger_is_amused.8999a943f5", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3f325256bef86566(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.deadbook.pline_the.invocation_fails.9dbe60312e", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_9ace50de726aac27(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.deadbook.pline.at_least_one_of_your_relics_is.b11cc66316", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0ef8999471735771(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.deadbook.you.have_a_feeling_that_s_is_amiss.fd123434aa", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e86e2f50e9bef1b4(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.deadbook.you.raised_the_dead.62c27822c3", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_5aa0511bd641fdd8(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.deadbook.your.ancestors_are_annoyed_with_you.b23441095c", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2e4040f021371d1b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.deadbook.pline_the.headstones_in_the_cemetery_begin_to_move.56763cf614", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6fe97d598ad4f5ba(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.deadbook.pline.oh_my_your_name_appears_in_the.644da00fac", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4a7b85d148ec5511(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.book_cursed.pline.s_shut.a92c84a6fb", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_22a0faf34d355dd4(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.learn.pline.this_spellbook_is_too_faint_to_be.d7f3119c8f", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f1c28f32b530462e(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.learn.your.knowledge_of_s_is_s.4eb492f429", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    Your(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_d06efde9fdea2b50(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.learn.pline.this_spellbook_is_too_faint_to_read.6f377db219", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7287e19c9b32f5a4(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.learn.you.learn_s.740ae1522d", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_df63fc3d97761921(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.study_book.pline.this_book_is_so_dull_that_you.734b783e39", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0b80d074767d0c5b(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.study_book.you.continue_your_efforts_to_s.9f60e6c15d", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a242661607a6dc72(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.study_book.pline.this_spellbook_is_all_blank.9cdb99be14", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8802ffa25c6ffc5b(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.study_book.you.know_s_quite_well_already.1bc1b1b452", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline char nh_phase4_site_f2ae57b943b854d6(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.study_book.y_n.refresh_your_memory_anyway.33ba604b0a", "y_n", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    char nh_result = y_n(nh_p0);
    nh_text_end(nh_scope);
    return nh_result;
}

static inline void nh_phase4_site_0f27ba3037f42007(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.study_book.pline_the.spellbook_crumbles_to_dust.05be677f22", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_9895c7d103eed311(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.study_book.you.begin_to_s_the_runes.589e31ea92", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ba9deb32463082be(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.rejectcasting.you.are_too_impaired_to_cast_a_spell.c9d9e74d4a", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_d2dfd4031a88501a(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.rejectcasting.you.are_unable_to_chant_the_incantation.e67815eb05", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_53872f45de02390b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.rejectcasting.your.arms_are_not_free_to_cast.a715f50e11", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ed4005a1298455a7(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.getspell.you.don_t_know_any_spells_right_now.80d2ffe46c", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_966d16b5e0efd3cc(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.getspell.pline.that_s_enough_tries.d66e957949", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7929363081d83507(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.getspell.you.don_t_know_that_spell.32b55ffe40", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_90f907ab2575b29b(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.dowizcast.end_menu.cast_which_spell.1d13d77451", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_64370322156c06ec(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.cast_chain_lightning.pline.you_shock_s_s.7b2fae3fad", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_178d3f68e88ccd0b(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.cast_chain_lightning.pline.s_resists.f78369b31d", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b9ac072be190157a(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.cast_protection.pline_the.s_haze_around_you_becomes_more_dense.6493c673a0", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline_The(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e4ca5c62e47118ea(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.cast_protection.pline_the.s_around_you_begins_to_shimmer_with.c4c3c5221e", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline_The(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b8a63172153c659c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.cast_protection.your.skin_feels_warm_for_a_moment.18845819a9", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_76266d476a89e440(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects_check.your.knowledge_of_this_spell_is_twisted.8830999c42", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f520ae97d21f9f1c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects_check.pline.it_invokes_nightmarish_images_in_your_mind.44714ec638", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f6c336adea993c4d(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects_check.you.strain_to_recall_the_spell.89a1d629bf", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_117d6c1a357f2fef(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects_check.you.have_difficulty_remembering_the_spell.7b41f827fa", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6f579438cc87a964(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects_check.your.knowledge_of_this_spell_is_growing_faint.0589111c5f", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_87758df7a45f58e6(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects_check.your.recall_of_this_spell_is_gradually_fading.4913b73a6c", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e3e2d8753cfe7c36(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects_check.you.are_too_hungry_to_cast_that_spell.989587b818", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6bfa4fbbdd89e928(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects_check.you.lack_the_strength_to_cast_spells.2f712667ae", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_037d7583f64a3eaf(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects_check.you_feel.the_amulet_draining_your_energy_away.3c555cad51", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_feel(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c49564a6cd4018fc(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects_check.you.don_t_have_enough_energy_to_cast.27bc6d174a", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2ba3be7ba3c34ca4(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects_check.you.fail_to_cast_the_spell_correctly.2e75d8988f", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_bca748f96a21b90c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects.pline_the.magical_energy_is_released.254170f1cb", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7103121c749b3b95(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects.you.are_s_ill.a3bb07677e", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a28ed442cf53f7d1(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects.you.sense_a_pointy_hat_on_top_of.8ae2444283", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_db5e235ceb5a1432(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.throwspell.pline.you_re_joking_in_this_weather.2416b508c9", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e89e01944689c8ec(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.throwspell.you.had_better_wait_for_the_sun_to.43e4de5437", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_1b7912f7ba57a251(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.throwspell.pline.where_do_you_want_to_cast_the.58e248a67c", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_91df3e04dbc06f12(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.throwspell.pline_the.spell_dissipates_over_the_distance.0ea1ec62e3", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_29bff77ab1df534d(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.throwspell.pline_the.spell_is_cut_short.ad2b45797f", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f8c990d3f6e792f8(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.throwspell.your.mind_fails_to_lock_onto_that_location.daca69b90d", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_62df24a45f8b1287(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spellsortmenu.add_menu_str.symbol_or_empty.e3b0c44298", "add_menu_str", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu_str(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7604d5bf584fd57f(winid nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spellsortmenu.end_menu.view_known_spells_list_sorted.7deb2de58d", "end_menu", NH_TEXT_MENU_END, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    end_menu(nh_p0, nh_p1);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_57550c6c23515432(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.dovspell.you.don_t_know_any_spells_right_now.80d2ffe46c", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4cca56eaad214633(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.show_spells.pline.you_didn_t_know_any_spells.aad4f79138", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_97051010b7406213(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.show_spells.pline.s.f684c73cba", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e96485b0a4e09c7d(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.show_spells.pline.spells.94c81b7913", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_73e11c9508e75dd7(winid nh_p0, const glyph_info * nh_p1, const anything * nh_p2, char nh_p3, char nh_p4, int nh_p5, int nh_p6, const char * nh_p7, unsigned int nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.dospellmenu.add_menu.sort_spells.2c524a3f9c", "add_menu", NH_TEXT_MENU_ROW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    add_menu(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8);
    nh_text_end(nh_scope);
}
