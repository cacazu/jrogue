/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_7d6bc0f6775d2dcb(const char * nh_p0, const char * nh_p1) {
    /* Native-English fallback: precision-bound text has no approved public-prefix producer. */
    nh_text_cancel_pending(); /* presentation-only owner must not leak from an outer wrapper */
    config_error_add(nh_p0, nh_p1);
}

static inline void nh_phase6_native_site_4da67e5e023cd1d8(const char * nh_p0, const char * nh_p1) {
    /* Native-English fallback: precision-bound text has no approved public-prefix producer. */
    nh_text_cancel_pending(); /* presentation-only owner must not leak from an outer wrapper */
    config_error_add(nh_p0, nh_p1);
}

static inline void nh_phase6_native_site_94f1f723b4d66c7c(const char * nh_p0, const char * nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.coloratt.add_menu_coloring_parsed.config_error_add.s_s.a5163f27b6", "config_error_add", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL, 0},
        {"arg_2", NH_TEXT_TEXT, nh_p2, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    config_error_add(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_text_captured_text(nh_scope, 1, nh_p2));
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_0351224d314183bf(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.coloratt.add_menu_coloring.config_error_add.malformed_menucolor.355a6ce6b4", "config_error_add", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    config_error_add(nh_p0);
    nh_text_end(nh_scope);
}
