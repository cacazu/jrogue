/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_c624712ded969c76(const char * nh_p0, const char * nh_p1, int nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mon.sanity_check_single_mon.panic.illegal_mon_data_s_mnum_d_s.a2779f0547", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL, 0},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    panic(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2, nh_text_captured_text(nh_scope, 2, nh_p3));
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_c322f48749939b2b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mon.relmon.panic.relmon_no_fmon_available.9743028257", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_8ff5b25019356788(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mon.relmon.panic.relmon_mon_not_in_list.f945b48010", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_8a17df0e34093e79(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mon.dealloc_monst.panic.dealloc_monst_with_nmon_on_s.fb3aaa699c", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_5328b2ee2db561db(long nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3, const char * nh_p4, const char * nh_p5) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mon.logdeadmon.livelog_printf.s_s_s_s.4d75e5c41d", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL, 0},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL, 0},
        {"arg_3", NH_TEXT_TEXT, nh_p4, 0, NULL, 0},
        {"arg_4", NH_TEXT_TEXT, nh_p5, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    livelog_printf(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2), nh_text_captured_text(nh_scope, 1, nh_p3), nh_text_captured_text(nh_scope, 2, nh_p4), nh_text_captured_text(nh_scope, 3, nh_p5));
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_8d58f230ab0d15c4(long nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3, const char * nh_p4, const char * nh_p5) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mon.logdeadmon.livelog_printf.s_s_has_been_s_s.bc64c556dd", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL, 0},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL, 0},
        {"arg_3", NH_TEXT_TEXT, nh_p4, 0, NULL, 0},
        {"arg_4", NH_TEXT_TEXT, nh_p5, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    livelog_printf(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2), nh_text_captured_text(nh_scope, 1, nh_p3), nh_text_captured_text(nh_scope, 2, nh_p4), nh_text_captured_text(nh_scope, 3, nh_p5));
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_072f92eced3aa283(long nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mon.xkilled.livelog_printf.killed_for_the_first_time.508817b74d", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    livelog_printf(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_4557b90149d0ad42(long nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3, const char * nh_p4, const char * nh_p5) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mon.xkilled.livelog_printf.murdered_s_s_s_faithful_s.fdf2b9e6b9", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL, 0},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL, 0},
        {"arg_3", NH_TEXT_TEXT, nh_p4, 0, NULL, 0},
        {"arg_4", NH_TEXT_TEXT, nh_p5, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    livelog_printf(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2), nh_text_captured_text(nh_scope, 1, nh_p3), nh_text_captured_text(nh_scope, 2, nh_p4), nh_text_captured_text(nh_scope, 3, nh_p5));
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_b17e3c5c611e959f(long nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3, const char * nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.mon.xkilled.livelog_printf.destroyed_s_s_former_s.1cd9317fc0", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL, 0},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL, 0},
        {"arg_3", NH_TEXT_TEXT, nh_p4, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    livelog_printf(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2), nh_text_captured_text(nh_scope, 1, nh_p3), nh_text_captured_text(nh_scope, 2, nh_p4));
    nh_text_end(nh_scope);
}
