/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_impossible_site_6e28d6138c996643(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.botl.status_initialize.impossible.nd_status_initialize_with_full_init.ecd988bb6a", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_22fbc1e81796ac2f(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.botl.init_blstats.impossible.init_blstats_called_more_than_once.9583cf1cea", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_ac3e166189e28752(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.botl.percentage.impossible.percentage_bad_istat_pointer_s_s.a72f46345c", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    impossible(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_76d4f2f7ba939e14(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.botl.status_hilite2str.impossible.hl_behavior_percentage_rel_error.97b0478110", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_3a8605dd320ae339(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.botl.status_hilite2str.impossible.hl_behavior_updown_rel_error.8c7235f277", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_f93d72ab7e106439(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.botl.status_hilite2str.impossible.hl_behavior_absolute_rel_error.57f8bfc2f3", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_d63d75e2ab5f0096(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.botl.status_hilite2str.impossible.hl_behavior_textmatch_rel_or_textmatch_error.1dbd803930", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_da8d04a7ec756339(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.botl.status_hilite2str.impossible.hl_behavior_condition_rel_error.c4b422f486", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}
