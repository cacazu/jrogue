/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_impossible_site_5dbd92e7ee57851b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do.boulder_hits_pool.impossible.not_a_boulder.a4d071cb33", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_9bf9fc1696c5ff9d(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do.u_collide_m.impossible.level_arrival_collision_s.0243824409", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_5de2273c5d21c045(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do.goto_level.impossible.goto_level_returning_to_discarded_level.dcea0bcd8f", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_5803b44448a6bb33(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do.goto_level.impossible.goto_level_no_corresponding_portal.de14cd1a04", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_d6135a570decb161(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do.revive_corpse.impossible.reviving_corpse_from_non_existent_container.1a29ff879d", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    impossible(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_e1632a2dfb04a410(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do.revive_corpse.impossible.revive_corpse_lost_corpse_d.11340f8c95", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}
