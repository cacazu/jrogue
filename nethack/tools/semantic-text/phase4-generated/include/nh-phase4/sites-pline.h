/* Modified 2026-10-02: additive phase-four source observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_site_549b62ddffa26663(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pline.impossible.pline.s.f684c73cba", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_654b9cc881a31bb6(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pline.impossible.pline.s.f684c73cba", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_9a5f407959f4bcb0(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pline.impossible.pline.please_report_these_messages_to_s.de497f3c8f", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_0498e0e3cff79ce4(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pline.impossible.pline.alternatively_contact_local_support_s.93e60a7f2d", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline char nh_phase4_site_fb9002f49d7ba579(const char * nh_p0, const char * nh_p1, char nh_p2, boolean nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pline.impossible.yn_function.report_now.b0c384f73e", "yn_function", NH_TEXT_QUESTION, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    char nh_result = yn_function(nh_p0, nh_p1, nh_p2, nh_p3);
    nh_text_end(nh_scope);
    return nh_result;
}

static inline void nh_phase4_site_5a6fb4922289dae5(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pline.impossible.raw_print.symbol_or_empty.e3b0c44298", "raw_print", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    raw_print(nh_p0);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_99eef842e5335d00(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pline.execplinehandler.pline.s.f684c73cba", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}
