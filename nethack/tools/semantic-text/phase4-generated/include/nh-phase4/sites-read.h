/* Modified 2026-10-02: additive phase-four source observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_site_d2826a878f59702e(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.you.break_up_the_cookie_and_throw_away.cf9c72c8f5", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0542af99935fffff(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.s_shirt_is_obscured_by_s_s.06b54219c9", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e907af070462e1c9(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.s_features_s.6cf5a9048c", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a3bdc824efa4a4d6(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.it_reads.26c9699b28", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_5588c64c1d824b60(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.s_s.dd2d9768e0", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_fca9cbe133888963(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.you_cant.find_anything_to_read_on_this_s.d1d0116765", "You_cant", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You_cant(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_504cb6a658f1f186(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.s_on_the_s_it_reads_s.33b7800873", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_72ac5929d1a7b730(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.you.feel_the_embossed_numbers.eb4b220c00", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_21be3eb79691436f(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.it_reads.26c9699b28", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0b46fd36b0aa0a0c(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.s.003070dda5", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_865d04af086b818c(const char * nh_p0, int nh_p1, int nh_p2, long nh_p3, int nh_p4, int nh_p5, int nh_p6, const char * nh_p7) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.d0_d_ld_d1_d_d0_s.ecc7a6613a", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
        {"arg_4", NH_TEXT_INTEGER, NULL, (int64_t)nh_p4, NULL},
        {"arg_5", NH_TEXT_INTEGER, NULL, (int64_t)nh_p5, NULL},
        {"arg_6", NH_TEXT_INTEGER, NULL, (int64_t)nh_p6, NULL},
        {"arg_7", NH_TEXT_TEXT, nh_p7, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 7, -1);
    pline(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4, nh_p5, nh_p6, nh_text_captured_text(nh_scope, 6, nh_p7));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_cf8d566c534505ef(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.this_s_has_no_label.561e4859f3", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b743e2b6a72eb9a0(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.it_reads.26c9699b28", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_75992fe01e09add3(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.you.feel_the_embossed_words.0fa07be138", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_263cf62f3a2e3928(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.you.read.cc9dba6f11", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_88f6a03c29329799(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.zorkmid_gue_in_frobs_we_trust.302172e531", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4990fae2c74283e7(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.you.feel_the_engraved_signature.3505048442", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6c7ca7a03d61d469(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.it_is_signed.68d8a15728", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7e80b63a66a721df(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.odin.9603ea141a", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_1d03b27d45f500ef(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.the_candy_bar_s_wrapper_is_blank.67c6a7e04c", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_907353af3f395116(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.being_blind_you_cannot_read_the_s.9c7139d268", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_94f6e456de0ec1c6(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.being_so_trippy_you_screw_up.2475195e80", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3f9355381aa90885(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.doread.pline.being_confused_you_s_the_magic_words.4a9878fb0d", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_edfbd68b0d626581(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.stripspe.pline.s_briefly.0418f61fa9", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_1b22b91eb28af85d(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.p_glow1.pline.s_briefly.0418f61fa9", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e23b12a68fbb6847(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.p_glow2.pline.s_s_s_for_a_moment.2a479517d4", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_92dd419686ceb8ae(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.p_glow3.pline.s_feebly_s_s_for_a_moment.a4567c81e3", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_65695079e4a2c90f(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.recharge.pline.s_momentarily_then_s.752c536f2e", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_1a740138809cb82c(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.recharge.pline.s_spins_sclockwise_for_a_moment.356c60e74c", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_5492b5d3d33e9cd1(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.recharge.your.marker_seems_permanently_dried_out.b13dfe99d1", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_39557bf6136acb01(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.recharge.pline.s_out.cc3f7ca01e", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b71102515e0a517f(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.recharge.pline.s_briefly.0418f61fa9", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ed6d2a021cfebf4f(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.recharge.you.have_a_feeling_of_loss.2fbba1f128", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_354e64deb22c439e(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_enchant_armor.pline.s_warm_for_a_moment.fc03482772", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_383d8e0826b54c1a(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3, const char * nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_enchant_armor.pline.s_covered_by_a_s_s_s.5fba284255", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
        {"arg_4", NH_TEXT_TEXT, nh_p4, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3), nh_text_captured_text(nh_scope, 3, nh_p4));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3d496a1c11f458fb(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_enchant_armor.pline.s_as_good_as_new.ee7e018b97", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_debb722fe23bfa49(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3, const char * nh_p4, const char * nh_p5) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_enchant_armor.pline.s_violently_s_s_s_for_a.f42d8621ab", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
        {"arg_4", NH_TEXT_TEXT, nh_p4, 0, NULL},
        {"arg_5", NH_TEXT_TEXT, nh_p5, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 5, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3), nh_text_captured_text(nh_scope, 3, nh_p4), nh_text_captured_text(nh_scope, 4, nh_p5));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_84cd57776cf60b36(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_enchant_armor.pline.s_merges_and_hardens.b47a2d0d0e", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f9ab40f055dacf39(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3, const char * nh_p4, const char * nh_p5, const char * nh_p6) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_enchant_armor.pline.s_s_s_s_s_for_a.57ca7f169f", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
        {"arg_4", NH_TEXT_TEXT, nh_p4, 0, NULL},
        {"arg_5", NH_TEXT_TEXT, nh_p5, 0, NULL},
        {"arg_6", NH_TEXT_TEXT, nh_p6, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 6, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3), nh_text_captured_text(nh_scope, 3, nh_p4), nh_text_captured_text(nh_scope, 4, nh_p5), nh_text_captured_text(nh_scope, 5, nh_p6));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_cbeb330ac34475ba(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_enchant_armor.pline.s_s.aabb0be3ec", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_54551c9d9200f06e(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_destroy_armor.pline.s.3ffc64bb85", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_5f2b48a0cf47927f(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_destroy_armor.pline.this_is_s.58675f203d", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2c3a5559f2751beb(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_confuse_monster.you_feel.confused.1bc528b083", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_feel(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e118ffe636bfc01f(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_confuse_monster.your.s_begin_to_s_s.080b50545b", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    Your(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3b41e68da1cf7490(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_confuse_monster.pline.a_s_s_surrounds_your_s.1a156f1b7b", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7a809fc6be343e6e(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_confuse_monster.your.s_tingle_s.05356d05d1", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    Your(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7b733e648251bf6d(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_confuse_monster.your.s_begin_to_glow_s.4fc893ae86", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    Your(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_13f89c1ead44205b(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_confuse_monster.pline_the.s_glow_of_your_s_intensifies.c74cf6a974", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline_The(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_55b0d38c5b5c2970(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_confuse_monster.your.s_tingle_s_sharply.05d9f56d5b", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    Your(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0092398860656671(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_confuse_monster.your.s_glow_s_brilliant_s.171fbb1c94", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    Your(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3e577ef033f98441(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_scare_monster.you_hear.s_s.aabb0be3ec", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    You_hear(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7c36a14b3b62935a(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_remove_curse.pline_the.scroll_disintegrates.6f0b6f3a0b", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_24ec120937f73dcc(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_remove_curse.pline.s_s.aabb0be3ec", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6be6f360b00cf891(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_remove_curse.pline_the.clasp_on_your_s_vanishes.441c669f31", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline_The(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_9200dabe9f657d5a(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_enchant_weapon.your.weapon_feels_warm_for_a_moment.4677de916e", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a1435c3a5c7d598c(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3, const char * nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_enchant_weapon.pline.s_covered_by_a_s_s_s.5fba284255", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
        {"arg_4", NH_TEXT_TEXT, nh_p4, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3), nh_text_captured_text(nh_scope, 3, nh_p4));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b365b777abf22e66(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_enchant_weapon.pline.s_as_good_as_new.ee7e018b97", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c310b1bbc43022fe(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_taming.pline.nothing_interesting_s.39b7d1bbdd", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_dceb793238c25664(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_taming.pline_the.neighborhood_s_sfriendlier.7677540063", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline_The(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_5e3f394c12eb4dbf(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_genocide.you.have_found_a_scroll_of_genocide.d4a9c9851d", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a6b39b05328a12bd(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_light.pline.tiny_lights_sparkle_in_the_air_momentarily.bdffc57c7f", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_16548ea19798cbbd(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_light.pline.lights_appear_all_around_you.187210a053", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b821c22748e08514(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_charging.you_feel.discharged.e34e3e0914", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_feel(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3ff40e350093fd34(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_charging.you_feel.charged_up.7971c3caed", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_feel(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_fc19821eae7f6fbe(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_charging.pline.this_is_a_charging_scroll.73d03c8166", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7048de26bbf660ff(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_amnesia.your.mind_releases_itself_from_mundane_concerns.055bfc3c8b", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c027a184f708bfb8(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_amnesia.pline.who_was_that_maud_person_anyway.ce8962529b", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_93ddc0ab892f5dcf(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_amnesia.pline.thinking_of_maud_you_forget_everything_else.5b03c11220", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3b2cce45b621404b(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_fire.pline.a_little_s_around_you_vaporizes.c73ee8001a", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2a1bdcc6c11db03a(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_fire.pline.oh_look_what_a_pretty_fire_in.98f3cfe327", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b7aa25691218b8f4(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_fire.you_feel.a_pleasant_warmth_in_your_s.25402ef34d", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You_feel(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ce80c0ad9bebb888(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_fire.pline_the.scroll_catches_fire_and_you_burn_your.32dcf5975c", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline_The(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b2e067abb1e87916(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_fire.pline_the.s_around_you_vaporizes_violently.5f36087faa", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline_The(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e3f215b5d4406a23(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_fire.pline.this_is_a_scroll_of_fire.0a2d8f9bb1", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_491d0f1a84fb7157(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_fire.pline.where_do_you_want_to_center_the.302ee73484", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_dc5f75e4c55694ce(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_fire.pline_the.scroll_erupts_in_a_tower_of_flame.2b3debc946", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3f59bc4bb97988f9(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_earth.you_hear.rumbling.26b62d01e7", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_hear(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_39b313fcf3807b9b(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_earth.pline_the.s_rumbles_s_you.f13920d8a0", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline_The(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_83170620faff8504(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_earth.pline.s_of_boulders_s_s_you.66fbbcaed8", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_1ed8348786453747(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_earth.pline.but_nothing_else_happens.e383f9c34b", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_61a1d100f19dff8d(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_punishment.you_feel.guilty.bd4a9e76e6", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_feel(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_60c527f8952455ed(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_stinking_cloud.you.have_found_a_scroll_of_stinking_cloud.ae821c77ce", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6b950d79874e5555(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_blank_paper.you.don_t_remember_there_being_any_magic.29b4929596", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_efb4b561d6f70b2d(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_blank_paper.pline.this_scroll_seems_to_be_blank.9962b124d1", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_72ace3bd04e41d84(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_identify.you.identify_this_as_an_identify_scroll.58919b52e5", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c9267a820db28361(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_identify.pline.this_is_an_identify_scroll.aecdb8c6ff", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b1ac2c958a2b94de(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_identify.pline.you_re_not_carrying_anything_s_to.fc414ef08b", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_17c9c93e8a93ad64(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_magic_mapping.your.mind_is_filled_with_crazy_lines.5be12ce4f3", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_611b7311bc159618(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_magic_mapping.pline.wow_modern_art.01fb3f5410", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_bed7cc3b060d6488(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_magic_mapping.your.s_spins_in_bewilderment.83e41e67d4", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    Your(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_46356b0b97c3ac26(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_magic_mapping.your.s_spins_as_s_blocks_the_spell.5b69615ebd", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    Your(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4150338af3a3ec1d(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_magic_mapping.pline.a_map_coalesces_in_your_mind.f66f417161", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_aab94dc53f4b4148(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_magic_mapping.pline.unfortunately_you_can_t_grasp_the_details.c4d42512a7", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_6aff4b8629d89950(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_mail.pline.this_scroll_is_marked_s.692a7f9e03", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4d28492d0a7fe778(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_mail.pline.this_seems_to_be_s.7e3d72757f", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_17e1700e36cbba17(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.seffect_mail.pline.that_was_a_scroll_of_mail.676537d29d", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_bb50ae74ffffe079(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.drop_boulder_on_player.you.are_hit_by_s.d7772be718", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8a4f4d207b14ded5(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.drop_boulder_on_player.pline.fortunately_you_are_wearing_a_hard_helmet.9bad0ae8fa", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2fbff815e233da8f(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.drop_boulder_on_player.pline.s_does_not_protect_you.e5d8726fda", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_73461490b51403c6(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.drop_boulder_on_monster.pline.s_is_hit_by_s.1a2a10b5f5", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_245d84065fc97675(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.drop_boulder_on_monster.you_hear.something_hit_s_s_over_your_s.e0803455b7", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    You_hear(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e33a182cbe5a3b86(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.drop_boulder_on_monster.pline.fortunately_s_is_wearing_a_hard_helmet.53e7ad8d2a", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_1daff9ae0eaa9bd6(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.drop_boulder_on_monster.you_hear.a_clanging_sound.5d9062cecc", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_hear(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_658b03675a031f3a(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.drop_boulder_on_monster.pline.s_s_s_does_not_protect_s.703bb00b5e", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_115bfe8d35f97632(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.drop_boulder_on_monster.pline.s_is_killed.1ea5cafc39", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_cb85bd03efa06572(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.wand_explode.pline.s_s_explodes.07ae20b3d2", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_d26825083d9adbad(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.litroom.pline_the.ambient_light_seems_dimmer.fadee28f7a", "pline_The", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline_The(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_7b6a79f5ab7a2772(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.litroom.pline.it_seems_even_darker_in_here_than.7d4ce63aa7", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4e520cd433f0d27e(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.litroom.you.are_surrounded_by_darkness.0e90414b18", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_dc673c624b763b90(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.litroom.pline.s_s_is_lit.486f9438a8", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2bf47e032bca57ab(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.litroom.pline.s_shines_briefly.a8e614930f", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8f29a7cc33117fe2(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.litroom.pline.s_glistens.3b71b24556", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4a7823314aae904e(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.litroom.pline.a_lit_field_ssurrounds_you.0d544e4843", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_f262eb55b27c9911(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_class_genocide.pline.s.3ffc64bb85", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c380f505952bddb4(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_class_genocide.pline.all_such_monsters_are_already_nonexistent.e2de204004", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a254436434209ad9(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_class_genocide.you.aren_t_permitted_to_genocide_such_monsters.f33a5b0850", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a310557bb7d45d34(const char * nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_class_genocide.pline.eliminated_d_monster_s.5107d880e9", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4da2d5ea59d1768c(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_class_genocide.pline.that_s_does_not_represent_any_monster.be2608a122", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a04c6e66207a9f2c(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_class_genocide.pline.wiped_out_all_s.1d4b61635e", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_d59641a27d9af38c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_class_genocide.urgent_pline.you_die.5cab21959b", "urgent_pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    urgent_pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e351cbb19c70d6d6(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_class_genocide.you_feel.s_inside.7e1604ac31", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You_feel(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ce3449cf7f99e4ec(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_class_genocide.urgent_pline.you_die.5cab21959b", "urgent_pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    urgent_pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3ad9fe51b668e9e9(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_class_genocide.pline.s_are_already_nonexistent.377cf10c93", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_9752ab884208361d(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_class_genocide.you.aren_t_permitted_to_genocide_s_s.bc836d7494", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_99573f05e54ad7bb(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_genocide.pline.s.3ffc64bb85", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_2e2dd33929e0fe11(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_genocide.pline.such_creatures_s_exist_in_this_world.79b1ccda1f", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e046006fed096be3(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_genocide.verbalize.no_mortal_that_will_not_be_done.959314f6c8", "verbalize", NH_TEXT_MESSAGE, NH_TEXT_QUOTED
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    verbalize(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_fc8997531dd80eda(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_genocide.pline.wiped_out_s_s.110ab1a3f7", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b9d3e8856c1a000e(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_genocide.you_feel.s_inside.7e1604ac31", "You_feel", NH_TEXT_MESSAGE, NH_TEXT_FEEL
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You_feel(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_4434644a365f7c62(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_genocide.pline.sent_in_s_s.f50db09c9a", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ab2e1bceef8066b7(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.punish.you.are_being_punished_for_your_misbehavior.044e85b4d6", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_33ad4ab50c7595ab(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.punish.your.iron_ball_gets_heavier.e93e16a7eb", "Your", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    Your(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_cbd54dedd93245ab(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.punish.pline.a_ball_and_chain_appears_then_falls.550f70d720", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_514a8ec69cc10ee7(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_stinking_cloud.pline.where_do_you_want_to_center_the.49143c17c7", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_455667365f391773(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_stinking_cloud.pline.ugh_someone_cut_the_cheese.e20e7aa7a9", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_eb5332addd749afe(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.do_stinking_cloud.pline.s_a_whiff_of_rotten_eggs.2de0505b1f", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c927cb7c4e27520c(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.create_particular.pline.i_ve_never_heard_of_such_monsters.38697d94f6", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e110b85cd85477f7(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.read.create_particular.pline.try_again_type_for_random_esc_to.94c6fc2b18", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}
