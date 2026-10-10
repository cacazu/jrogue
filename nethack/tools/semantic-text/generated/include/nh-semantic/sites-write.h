/* Modified 2026-10-02: source-selected semantic presentation bridge; upstream preserved below. */
#ifndef JROGUE_SITES_WRITE_H
#define JROGUE_SITES_WRITE_H
#include "nh-semantic.h"

static inline void nh_text_site_06fbcfc91e290118(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.write.dowrite.you.don_t_know_whether_that_s_is.df6074514d", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    You(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

#endif
