/* Modified 2026-10-02: source-selected semantic presentation bridge; upstream preserved below. */
#ifndef JROGUE_SITES_INSIGHT_H
#define JROGUE_SITES_INSIGHT_H
#include "nh-semantic.h"

static inline void nh_text_site_5b46c066e75fc4ed(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.insight.list_vanquished.pline.no_creatures_have_been_vanquished.66dcd1f447", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    pline(nh_p0);
    nh_text_end(nh_scope);
}

static inline char nh_text_site_fe88c222e4855ae1(const char * nh_p0, const char * nh_p1, char nh_p2, boolean nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.insight.list_vanquished.yn_function.do_you_want_an_account_of_creatures.1841930541", "yn_function", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    char nh_result = yn_function(nh_p0, nh_p1, nh_p2, nh_p3);
    nh_text_end(nh_scope);
    return nh_result;
}

static inline void nh_text_site_1e47b8a4f2df4c64(const char * nh_p0, const char * nh_p1, const char * nh_p2, const char * nh_p3, int nh_p4, int nh_p5, int nh_p6, int nh_p7, const char * nh_p8) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.insight.mstatusline.pline.status_of_s_s_s_level_d.b25dea39e4", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
        {"arg_4", NH_TEXT_INTEGER, NULL, (int64_t)nh_p4, NULL},
        {"arg_5", NH_TEXT_INTEGER, NULL, (int64_t)nh_p5, NULL},
        {"arg_6", NH_TEXT_INTEGER, NULL, (int64_t)nh_p6, NULL},
        {"arg_7", NH_TEXT_INTEGER, NULL, (int64_t)nh_p7, NULL},
        {"arg_8", NH_TEXT_TEXT, nh_p8, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 8, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_text_captured_text(nh_scope, 2, nh_p3), nh_p4, nh_p5, nh_p6, nh_p7, nh_text_captured_text(nh_scope, 7, nh_p8));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_bc1c35f8dfb91ba7(const char * nh_p0, const char * nh_p1, const char * nh_p2, int nh_p3, int nh_p4, int nh_p5, int nh_p6, const char * nh_p7) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.insight.ustatusline.pline.status_of_s_s_level_d_hp.d307caf6f7", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
        {"arg_3", NH_TEXT_INTEGER, NULL, (int64_t)nh_p3, NULL},
        {"arg_4", NH_TEXT_INTEGER, NULL, (int64_t)nh_p4, NULL},
        {"arg_5", NH_TEXT_INTEGER, NULL, (int64_t)nh_p5, NULL},
        {"arg_6", NH_TEXT_INTEGER, NULL, (int64_t)nh_p6, NULL},
        {"arg_7", NH_TEXT_TEXT, nh_p7, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 7, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2), nh_p3, nh_p4, nh_p5, nh_p6, nh_text_captured_text(nh_scope, 6, nh_p7));
    nh_text_end(nh_scope);
}

#endif
