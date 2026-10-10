/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_impossible_site_0b9614133eda6774(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.erode_obj.impossible.invalid_erosion_type_in_erode_obj.eec5e889c2", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_ffbf1b66b704109d(const char * nh_p0, int nh_p1, int nh_p2, unsigned long nh_p3, const char * nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.erode_obj.impossible.erode_obj_d_destroying_strangely_worn_item.9169dcf3dd", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p3, NULL},
        {"arg_4", NH_TEXT_TEXT, nh_p4, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    impossible(nh_p0, nh_p1, nh_p2, nh_p3, nh_text_captured_text(nh_scope, 3, nh_p4));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_c5c9e1f3c6a537b9(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.maketrap.impossible.making_fixed_dest_tele_trap_pointing_to.8c5e6b642e", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_2c86ed266f5880a2(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.m_harmless_trap.impossible.m_harmless_trap_unknown_trap_i.a032dba923", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_e343ec7ca89218ed(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.trapeffect_hole.impossible.dotrap_ss_cannot_exist_on_this_level.f8a6135515", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_1b6b8b32ba4e2fff(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.trapeffect_hole.impossible.mintrap_ss_cannot_exist_on_this_level.2916ff321e", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_0a1f4c3f858e4db2(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.trapeffect_poly_trap.impossible.re_equipping_iron_shoes_destroyed_them.57327cbd81", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_daf34ce272b5d8fe(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.immune_to_trap.impossible.immune_to_trap_null_monster.783094cbea", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_e16b7341e9e76372(const char * nh_p0, unsigned int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.immune_to_trap.impossible.immune_to_trap_bad_ttype_u.40e994aa07", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_0f6440545ef4f56d(const char * nh_p0, const char * nh_p1, int nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.trapeffect_selector.impossible.s_encountered_a_strange_trap_of_type.762f831681", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    impossible(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_2f80ce4451c02efe(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.steedintrap.impossible.steed_hit_by_non_existent_arrow.dfa17a7092", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_37e01de1d0e6454c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.steedintrap.impossible.steed_hit_by_non_existent_dart.f5de2799f3", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_8858801f02ea4143(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.chest_trap.impossible.chest_disarm_bug.094887bdb7", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_64dbc0bf5b2065f5(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.chest_trap.impossible.bad_chest_trap.aabbcbbb73", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_17cc1ba7b196adf4(const char * nh_p0, const char * nh_p1, unsigned int nh_p2, unsigned int nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.lava_effects.impossible.lava_effects_s_u_is_already_in.7785f92366", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p3, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    impossible(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2, nh_p3);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_2b3d5b67fd80360b(const char * nh_p0, int nh_p1, int nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.trap_sanity_check.impossible.trap_sanity_location_i_i.d74a7cdbd3", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    impossible(nh_p0, nh_p1, nh_p2);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_dc36616c3a17a2c5(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.trap_sanity_check.impossible.trap_sanity_type_i.4442e3e88e", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}
