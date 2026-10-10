/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_80a5702c9cd1502a(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.u_init.skills_for_role.panic.no_skills_found_for_role.ec3e6cd4d0", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}
