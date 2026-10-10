/* Modified 2026-10-02: additive phase-four source observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_site_90a6d85c68ab700a(const char * nh_p0, int nh_p1, int nh_p2, int nh_p3, int nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.makemon.m_initgrp.pline.cnt_d_using_d_cnttmp_d_cntdiv.29c241f26e", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
        {"arg_4", NH_TEXT_INTEGER, NULL, (int64_t)nh_p4, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    pline(nh_p0, nh_p1, nh_p2, nh_p3, nh_p4);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_68a855b7e311b4d5(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3, const char * nh_p4, int nh_p5) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.makemon.makemon.norep.s_s_s_s_c.929eddbe30", "Norep", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
        {"arg_4", NH_TEXT_TEXT, nh_p4, 0, NULL},
        {"arg_5", NH_TEXT_INTEGER, NULL, (int64_t)nh_p5, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 5, -1);
    Norep(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3), nh_text_captured_text(nh_scope, 3, nh_p4), nh_p5);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_de3ca6b1bdbbdce9(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.makemon.dump_mongen.raw_printf.int_mongen_order.fd119b9477", "raw_printf", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    raw_printf(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_b3cc4e5e94d91deb(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.makemon.dump_mongen.raw_print.symbol_or_empty.e3b0c44298", "raw_print", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    raw_print(nh_p0);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_c5b8462410194891(const char * nh_p0, int nh_p1, const char * nh_p2, int nh_p3, int nh_p4, int nh_p5, int nh_p6, int nh_p7, int nh_p8, int nh_p9, const char * nh_p10) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.makemon.dump_mongen.raw_printf.s_c_seq_d_idx_d_sym.61ee21eb08", "raw_printf", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
        {"arg_4", NH_TEXT_INTEGER, NULL, (int64_t)nh_p4, NULL},
        {"arg_5", NH_TEXT_INTEGER, NULL, (int64_t)nh_p5, NULL},
        {"arg_6", NH_TEXT_INTEGER, NULL, (int64_t)nh_p6, NULL},
        {"arg_7", NH_TEXT_INTEGER, NULL, (int64_t)nh_p7, NULL},
        {"arg_8", NH_TEXT_INTEGER, NULL, (int64_t)nh_p8, NULL},
        {"arg_9", NH_TEXT_INTEGER, NULL, (int64_t)nh_p9, NULL},
        {"arg_10", NH_TEXT_TEXT, nh_p10, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 10, -1);
    raw_printf(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 1, nh_p2), nh_p3, nh_p4, nh_p5, nh_p6, nh_p7, nh_p8, nh_p9, nh_text_captured_text(nh_scope, 9, nh_p10));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_ed572310039ac9fc(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.makemon.dump_mongen.raw_print.symbol_or_empty.df3982fd61", "raw_print", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    raw_print(nh_p0);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_3258782f1ac1d12f(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.makemon.dump_mongen.raw_print.symbol_or_empty.e3b0c44298", "raw_print", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    raw_print(nh_p0);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_1084af06b0d1867f(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3, const char * nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.makemon.grow_up.pline.as_s_grows_up_into_s_s.8b61c09717", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
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

static inline void nh_phase4_site_41e0f69ec908a439(struct monst * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3, const char * nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.makemon.grow_up.pline_mon.s_s_s.0a9515a848", "pline_mon", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p4, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 3, -1);
    pline_mon(nh_p0, nh_p1, nh_text_captured_text(nh_scope, 0, nh_p2), nh_text_captured_text(nh_scope, 1, nh_p3), nh_text_captured_text(nh_scope, 2, nh_p4));
    nh_text_end(nh_scope);
}
