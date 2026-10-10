/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_impossible_site_a003cdf3161e3731(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.steed.put_saddle_on_mon.impossible.put_saddle_on_mon_saddle_obj_could.4988c7b041", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_fb23bab8175ef77d(const char * nh_p0, const char * nh_p1, int nh_p2, int nh_p3, unsigned long nh_p4, const char * nh_p5) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.steed.place_monster.impossible.trying_to_place_s_at_d_d.0bbadd97b6", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
        {"arg_4", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p4, NULL},
        {"arg_5", NH_TEXT_TEXT, nh_p5, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 5, -1);
    impossible(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2, nh_p3, nh_p4, nh_text_captured_text(nh_scope, 4, nh_p5));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_dc0590338a47935a(const char * nh_p0, const char * nh_p1, unsigned long nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.steed.place_monster.impossible.placing_s_onto_map_mstate_lx_on.7a49edf1ed", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    impossible(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2, nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_601f0da7c1d57d0f(const char * nh_p0, const char * nh_p1, const char * nh_p2, int nh_p3, int nh_p4, unsigned long nh_p5, unsigned long nh_p6, const char * nh_p7) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.steed.place_monster.impossible.placing_s_over_s_at_d_d.c64b07f56a", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
        {"arg_4", NH_TEXT_INTEGER, NULL, (int64_t)nh_p4, NULL},
        {"arg_5", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p5, NULL},
        {"arg_6", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p6, NULL},
        {"arg_7", NH_TEXT_TEXT, nh_p7, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 7, -1);
    impossible(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_p3, nh_p4, nh_p5, nh_p6, nh_text_captured_text(nh_scope, 6, nh_p7));
    nh_text_end(nh_scope);
}
