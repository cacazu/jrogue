/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_b914232c5a1a6884(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pickup.delta_cwt.panic.delta_cwt_obj_not_inside_container.a17d5ebe27", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_2cfa4932e0dc1ab5(long nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pickup.in_container.livelog_printf.just_blew_up_s_bag_of_holding.c72372046f", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    livelog_printf(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_030fe59ad8a9a676(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pickup.in_container.panic.in_container_bag_not_found.80d473b3ab", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_2c93f36093d7f729(long nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pickup.tipcontainer.livelog_printf.just_blew_up_s_bag_of_holding.6652a3b098", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    livelog_printf(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2));
    nh_text_end(nh_scope);
}
