/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_impossible_site_cd4c88edc44b701a(const char * nh_p0, int nh_p1, int nh_p2, int nh_p3, const char * nh_p4, const char * nh_p5) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkmaze.set_levltyp.impossible.set_levltyp_d_d_d_s_s.90b31679d5", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
        {"arg_4", NH_TEXT_TEXT, nh_p4, 0, NULL},
        {"arg_5", NH_TEXT_TEXT, nh_p5, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 5, -1);
    impossible(nh_p0, nh_p1, nh_p2, nh_p3, nh_text_captured_text(nh_scope, 3, nh_p4), nh_text_captured_text(nh_scope, 4, nh_p5));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_a60355bae43d7571(const char * nh_p0, int nh_p1, int nh_p2, int nh_p3, int nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkmaze.set_levltyp_lit.impossible.set_levltyp_lit_d_d_d_d.1aa766166e", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
        {"arg_4", NH_TEXT_INTEGER, NULL, (int64_t)nh_p4, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    impossible(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_1bbc4a2debbed14f(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkmaze.place_lregion.impossible.couldn_t_place_lregion_type_d.af746750f6", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_c0a906b0fb1f2844(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkmaze.makemaz.impossible.couldn_t_load_s_making_a_maze.2e1614a93c", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_f168e967353b449b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkmaze.mkportal.impossible.portal_on_top_of_portal.fa5131856f", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_42f35d8589a0b914(const char * nh_p0, int nh_p1, int nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkmaze.movebubbles.impossible.movebubbles_bad_pos_d_d.bd3253a03d", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    impossible(nh_p0, nh_p1, nh_p2);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_46b069a25b799b2d(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkmaze.restore_waterlevel.impossible.no_s_to_restore.56294dc818", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_3e4eb927a8568d94(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkmaze.set_wportal.impossible.set_wportal_no_portal.77b0069b80", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_e49c36efedd07850(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkmaze.mk_bubble.impossible.n_too_large_mk_bubble.105ba08983", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_0a465935fe0ba30c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mkmaze.mv_bubble.impossible.mv_bubble_unknown_bubble_contents.c4c6ba113d", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}
