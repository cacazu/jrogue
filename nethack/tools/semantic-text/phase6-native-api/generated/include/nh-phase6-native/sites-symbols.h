/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_553ca3bcfa5855f4(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.symbols.parse_sym_line.config_error_add.no_finish.34ab16397d", "config_error_add", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    config_error_add(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_2c0b576e6fa37618(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.symbols.parse_sym_line.config_error_add.unknown_sym_keyword.b5e05a61ea", "config_error_add", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    config_error_add(nh_p0);
    nh_text_end(nh_scope);
}
