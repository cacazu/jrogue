/* Modified 2026-10-02: additive phase-four source observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase4_site_f6e97312115a0c19(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.earlyarg.early_options.raw_print.player_name_expected_after_u.6f3ffb217a", "raw_print", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    raw_print(nh_p0);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_e048ebc441141281(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.earlyarg.argcheck.raw_printf.sversion_can_only_be_extended_with_sversion.9831a9940b", "raw_printf", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    raw_printf(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_55c2a62dec7400cb(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.earlyarg.dump_enums.raw_printf.enum_s.9b5c37ea32", "raw_printf", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    raw_printf(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_955b80a2a404e640(const char * nh_p0, const char * nh_p1, int nh_p2, const char * nh_p3, int nh_p4, const char * nh_p5) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.earlyarg.dump_enums.raw_printf.s_s_d_s.25a028b3e3", "raw_printf", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_TEXT, nh_p3, 0, NULL},
        {"arg_4", NH_TEXT_INTEGER, NULL, (int64_t)nh_p4, NULL},
        {"arg_5", NH_TEXT_TEXT, nh_p5, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 5, -1);
    raw_printf(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2, nh_text_captured_text(nh_scope, 2, nh_p3), nh_p4, nh_text_captured_text(nh_scope, 4, nh_p5));
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_32af1434033be53d(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.earlyarg.dump_enums.raw_print.symbol_or_empty.df3982fd61", "raw_print", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    raw_print(nh_p0);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_a91715398be713f1(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.earlyarg.dump_enums.raw_print.symbol_or_empty.e3b0c44298", "raw_print", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    raw_print(nh_p0);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase4_site_8541bd7ccc0f9589(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.earlyarg.dump_enums.raw_print.symbol_or_empty.e3b0c44298", "raw_print", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    raw_print(nh_p0);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}
