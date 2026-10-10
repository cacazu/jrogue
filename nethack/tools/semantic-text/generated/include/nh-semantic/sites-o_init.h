/* Modified 2026-10-02: source-selected semantic presentation bridge; upstream preserved below. */
#ifndef JROGUE_SITES_O_INIT_H
#define JROGUE_SITES_O_INIT_H
#include "nh-semantic.h"

static inline void nh_text_site_36c9f9169bf1d641(winid nh_p0, int nh_p1, const char * nh_p2) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.o_init.dodiscovered.putstr.unique_items_or_relics.b5a7618a26", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}

#endif
