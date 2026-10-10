/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_a09f9d856e241cd3(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.glyphs.to_custom_symset_entry_callback.config_error_add.unimplemented_customization_feature_ignoring_for_now.3c062a8782", "config_error_add", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    config_error_add(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_55bd0668d8ad6172(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.glyphs.to_custom_symset_entry_callback.config_error_add.unimplemented_customization_feature_ignoring_for_now.3c062a8782", "config_error_add", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    config_error_add(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_d8d399dd4a7e113b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.glyphs.add_glyph_to_cache.panic.glyphid_cache_full.7f0d48452c", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_49f587b22b3e4d6b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.glyphs.parse_id.panic.parse_id_buf_overflowed.6935884039", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}
