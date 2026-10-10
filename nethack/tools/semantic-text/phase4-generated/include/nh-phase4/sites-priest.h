/* Modified 2026-10-02: additive phase-four source observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_site_068fe705dd740727(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.pri_move.your.displaced_image_doesn_t_fool_s.8e0c2e6998", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    Your(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_869f93d242a5370a(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.intemple.pline.s_intones.edc74290c1", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_1b4d95fa3afbe0f8(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.intemple.you.have_an_eerie_feeling.7ee1eac22c", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_19712b36fe74933e(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.intemple.you_feel.like_you_are_being_watched.f1fa33d989", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_feel(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b2beb5917df89a7b(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.intemple.pline.a_shiver_runs_down_your_s.79241f5b1c", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8728fab08d14bad6(const char * nh_p0, struct nh_phase4_text_value nh_p1, int nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.intemple.pline.a_s_ghost_appears_next_to_you.44beb5bdea", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1.original, 0, nh_p1.event_json},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    if (!nh_p1.event_json) nh_text_truncated(nh_scope);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1.original), nh_p2);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e01285c2946b5ddf(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.intemple.you.sense_a_presence_close_by.2377fca184", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_201953514ba10c7f(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.intemple.you.are_frightened_to_death_and_unable_to.eb08225b09", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6738da205d046899(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.pline.s_doesn_t_want_anything_to_do.35bdc22ef7", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8bad6fa8c8f8fbe6(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.pline.s_breaks_out_of_s_reverie.8c4561c163", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_52167cfcd0114d9a(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.verbalize.begone_thou_desecratest_this_holy_place_with.0ea44ae5b4", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    verbalize(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_273dac7ee35793b0(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.pline.s_gives_you_s_s_for_an.8227800271", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
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

static inline void nh_phase4_site_0c1f036b0e01a9b7(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.pline.s_preaches_the_virtues_of_poverty.eeda87a0e8", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f3ce654f259de636(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.pline.s_is_not_interested.2460c08185", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_16e1f17e6bcbd6ec(const char * nh_p0, const char * nh_p1, long nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.pline.s_asks_you_for_a_contribution_for.adfabad368", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7741148f33dd95c2(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.pline.s_asks_you_for_a_contribution_for.221487ccc1", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b93d0f2e47186fd9(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.verbalize.thou_shalt_regret_thine_action.fc235fb244", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    verbalize(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7619a2a8231124eb(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.verbalize.cheapskate.3f8313b259", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    verbalize(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_84e3a9209e835725(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.verbalize.i_thank_thee_for_thy_contribution.e7c02eb2ff", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    verbalize(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a2a87443be8967d9(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.verbalize.thou_art_indeed_a_pious_individual.eb4ac8d323", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    verbalize(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8f55508dd10beb19(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.verbalize.i_bestow_upon_thee_a_blessing.a0516dabe4", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    verbalize(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ede4238b78bab2fa(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.verbalize.thou_hast_been_rewarded_for_thy_devotion.2882643f02", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    verbalize(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_cee81709460ce0a9(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.verbalize.thy_selfless_generosity_is_deeply_appreciated.888232317c", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    verbalize(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7ca3f35fc9f822ab(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.priest_talk.verbalize.thy_selfless_generosity_is_deeply_appreciated.888232317c", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    verbalize(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_1ed7a28f067216f0(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.ghod_hitsu.pline.s_roars_in_anger_thou_shalt_suffer.fd76c6b31a", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a58513d601d85faa(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.ghod_hitsu.pline.s_voice_booms_how_darest_thou_harm.3a922951cd", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f35a4cf62ee63d6d(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.priest.ghod_hitsu.pline.s_roars_thou_dost_profane_my_shrine.fc052b1835", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}
