/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_impossible_site_a4bd26d89598c3ea(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.hack.trapmove.impossible.trapmove_trapped_in_nothing.5e91bc9f59", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_cc17051250884adf(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.hack.trapmove.impossible.trapmove_stuck_in_unknown_trap_d.afeec55b4d", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_8e71e33455fa0ebd(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.hack.handle_tip.impossible.unknown_tip_in_handle_tip_i.dc0d8c35d6", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_c0b7ad280ae5b46c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.hack.domove_swap_with_pet.impossible.that_s_strange_unknown_mintrap_result.063440c1cb", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_53320621744afa34(const char * nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.hack.losehp.impossible.hero_losing_d_hit_points_due_to.632b8ecfb7", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    impossible(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}
