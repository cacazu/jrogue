/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_2076e35618fcc62a(const char * nh_p0, int nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.files.docompress_file.panic.error_in_docompress_file_d.945015d982", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_b982a7be94e655f9(const char * nh_p0, const char * nh_p1, int nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.files.docompress_file.panic.error_in_zlib_docompress_file_s_d.1fff93c913", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL, 0},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    panic(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_be6e23fd6353d61d(const char * nh_p0, const char * nh_p1) {
    /* Native-English fallback: precision-bound text has no approved public-prefix producer. */
    nh_text_cancel_pending(); /* presentation-only owner must not leak from an outer wrapper */
    config_error_add(nh_p0, nh_p1);
}

static inline void nh_phase6_native_site_e4cbb7dfdd1c2c9e(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.files.read_sym_file.config_error_add.missing_finish_for_symset_s.0ab0860ad5", "config_error_add", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    config_error_add(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}
