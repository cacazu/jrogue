/* Modified 2026-10-02: first diagnostic semantic observation; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_impossible_site_6a7189f03e60a11f(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.dig.mkcavepos.impossible.mkcavepos_called_with_dist_d.f69dc49db2", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_2d74e7fb490c8fe1(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.dig.digactualhole.impossible.digactualhole_can_t_dig_s_on_this.eecc8d8f58", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    impossible(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_e08ad826dd6c1441(const char * nh_p0, int nh_p1, int nh_p2, const char * nh_p3, const char * nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.dig.liquid_flow.impossible.insane_liquid_flow_d_d_s_s.52b20d991f", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
        {"arg_4", NH_TEXT_TEXT, nh_p4, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    impossible(nh_p0, nh_p1, nh_p2, nh_text_captured_text(nh_scope, 2, nh_p3), nh_text_captured_text(nh_scope, 3, nh_p4));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_impossible_site_a089c0901abfd467(const char * nh_p0, const char * nh_p1, int nh_p2, int nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.dig.mdig_tunnel.impossible.mdig_tunnel_s_at_d_d_is.07f6688b01", "impossible", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    impossible(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2, nh_p3);
    nh_text_end(nh_scope);
}
