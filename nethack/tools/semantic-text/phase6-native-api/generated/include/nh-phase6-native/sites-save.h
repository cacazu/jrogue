/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_f80055aa59a4980a(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.save.dosave.exit_nhwindows.be_seeing_you.e4c5aead9f", "exit_nhwindows", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    exit_nhwindows(nh_p0);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_e1f216e53bdaeee0(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.save.savelev.panic.savelev_where_are_we.7f61ab98bf", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_ea822fc74a986c2b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.save.savelev_core.panic.save_on_bad_file.9655ffae10", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}
