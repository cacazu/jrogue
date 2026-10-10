/* Modified 2026-10-02: source-selected semantic presentation bridge; upstream preserved below. */
#ifndef JROGUE_SITES_PAGER_H
#define JROGUE_SITES_PAGER_H
#include "nh-semantic.h"

static inline void nh_text_site_b2e83f7d010923cb(const char * nh_p0, const char * nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pager.do_look.pline.please_move_the_cursor_to_s.6109353cae", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1));
    nh_text_end(nh_scope);
}

static inline void nh_text_site_bc17ed49936c67ea(const char * nh_p0, const char * nh_p1, int nh_p2, unsigned int nh_p3, unsigned int nh_p4) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.pager.dowhatdoes.pline.no_such_command_s_char_code_d.2fa35947a9", "pline", NH_TEXT_MESSAGE, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_TEXT, nh_p1, 0, NULL},
        {"arg_2", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_3", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p3, NULL},
        {"arg_4", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p4, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 4, -1);
    pline(nh_p0, nh_text_captured_text(nh_scope, 0, nh_p1), nh_p2, nh_p3, nh_p4);
    nh_text_end(nh_scope);
}

#endif
