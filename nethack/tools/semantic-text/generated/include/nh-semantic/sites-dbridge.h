/* Modified 2026-10-02: source-selected semantic presentation bridge; upstream preserved below. */
#ifndef JROGUE_SITES_DBRIDGE_H
#define JROGUE_SITES_DBRIDGE_H
#include "nh-semantic.h"

static inline void nh_text_site_0976a8f9db1bc076(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.dbridge.destroy_drawbridge.you_hear.a_loud_crash.375d03f6b7", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_hear(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_cd1751067f63bbe1(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.dbridge.destroy_drawbridge.you_hear.a_loud_splash.b29e82a4f1", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_hear(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_text_site_8e0e6ce539c0f14b(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.dbridge.destroy_drawbridge.you_hear.a_loud_splash.b29e82a4f1", "You_hear", NH_TEXT_MESSAGE, NH_TEXT_HEAR
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    You_hear(nh_p0);
    nh_text_end(nh_scope);
}

#endif
