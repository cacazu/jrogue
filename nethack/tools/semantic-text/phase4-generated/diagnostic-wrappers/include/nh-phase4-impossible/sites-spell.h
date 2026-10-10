/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_impossible_site_14dbcbe5513f44c8(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.learn.impossible.too_many_spells_memorized.99297a23fb", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_c5fe2ec5f3171fc4(const char * nh_p0, int nh_p1, int nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.study_book.impossible.unknown_spellbook_level_d_book_d.991b1a5a5e", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    impossible(nh_p0, nh_p1, nh_p2);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_ac29fda1f4abb31b(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelltypemnemonic.impossible.unknown_spell_skill_d.5f0a6ee035", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_7c4c0f27db36a806(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.spelleffects.impossible.unknown_spell_d_attempted.ea2026daef", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_449e2425f38b3d1e(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.tport_spell.impossible.tport_spell_spellbook_full.06f5610209", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_6a9c7c442f520be7(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.initialspell.impossible.too_many_spells_memorized.99297a23fb", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_b15d1de38f4172b6(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.initialspell.impossible.spell_s_already_known.4cb54eafce", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_b26aa23e96423ece(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.spell.force_learn_spell.impossible.too_many_spells_memorized.7e50d9a1b9", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}
