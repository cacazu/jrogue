/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_c81305b06cffb8d1(winid nh_p0, int nh_p1, const char * nh_p2, int nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.rip.genl_outrip.dump_forward_putstr.game_over.7d28f81c91", "dump_forward_putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, nh_p0);
    dump_forward_putstr(nh_p0, nh_p1, nh_p2, nh_p3);
    nh_text_end(nh_scope);
}
