/* Modified 2026-10-02: additive phase-four source observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_site_4514c29fc06b7f42(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.you.need_hands_to_be_able_to_write.3efa527d71", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a9363badde2a9a46(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.pline.s_from_your_s.9551182013", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_16d1d9e274d3ac2b(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.pline.s_can_t_create_braille_text.291e0950fa", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_29f7901f76decd58(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.pline.that_s_is_not_blank.362c883661", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2901e6d1c9474221(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.there.is_no_such_s.8925303bac", "There", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    There(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_30f66707d7308077(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.you_cant.write_that.7c2fda92bc", "You_cant", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_cant(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_5e1063609ed9e159(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.pline.it_s_obscene.0918c461d7", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f988de39e46850dc(const char * nh_p0, struct nh_phase4_text_value nh_p1, struct nh_phase4_text_value nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.you.s_to_write_the_great_yendorian_novel.953863b910", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1.original, 0, nh_p1.event_json},
        {"arg_2", NH_TEXT_TEXT, nh_p2.original, 0, nh_p2.event_json},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    if (!nh_p1.event_json) nh_text_truncated(nh_scope);
    if (!nh_p2.event_json) nh_text_truncated(nh_scope);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1.original), nh_text_captured_text(nh_scope, 1, nh_p2.original));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_aee5d099fe3948f5(const char * nh_p0, struct nh_phase4_text_value nh_p1, struct nh_phase4_text_value nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.you.sproduce_really_s_fan_fiction.2e0d6377c2", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1.original, 0, nh_p1.event_json},
        {"arg_2", NH_TEXT_TEXT, nh_p2.original, 0, nh_p2.event_json},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    if (!nh_p1.event_json) nh_text_truncated(nh_scope);
    if (!nh_p2.event_json) nh_text_truncated(nh_scope);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1.original), nh_text_captured_text(nh_scope, 1, nh_p2.original));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a7e71f0ecd18dd50(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.you.give_up_on_the_idea.fb7ff1558c", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_24eee8b296516bfa(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.you.tear_it_up.22fb259011", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_afb614d7bf5a0142(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.pline.no_mere_dungeon_adventurer_could_write_that.cd1a9cd7f3", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2cea718a9d029c68(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.pline.unfortunately_you_don_t_have_enough_information.440d385143", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_dbf59ab489ad01f0(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.your.marker_is_too_dry_to_write_that.4a36897d2b", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_67ecfcb31300ce38(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.your.marker_dries_out.9adfc13ae9", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6c963e5f75580453(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.pline_the.spellbook_is_left_unfinished_and_your_writing.d583169b21", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_bfa7bfc92c409e5d(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.pline_the.scroll_is_now_useless_and_disappears.b5be4943b6", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_1a551e1d61e12095(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.you.s_to_write_that.95f9fd77a3", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b8ac7ba397b3d922(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.you.write_in_your_best_handwriting_my_diary.b5cc1f7f94", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ba700eba11d83d2e(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.you.write_s_and_the_scroll_disappears.6ac33dd8eb", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_52bcf31174f0c546(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.you.fail_to_write_the_scroll_correctly_and.350b64109b", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8b81952288c4cd64(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.pline_the.spellbook_warps_strangely_then_turns_s.fbd835a126", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const char *nh_public_0 = nh_text_name_event(nh_p1);
    char *nh_raw_0 = nh_public_0 ? NULL : nh_phase4_public_raw(nh_p1);
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, (nh_public_0 ? nh_public_0 : nh_raw_0)},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    if (!nh_public_0 && !nh_raw_0) nh_text_truncated(nh_scope);
    free(nh_raw_0); /* nh_text_begin owns its validated copy now */
    pline_The(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}
