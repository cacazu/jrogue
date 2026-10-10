/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_9090373ffdecf97d(const char * nh_p0) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.deltrap.panic.deltrap_no_preceding_trap.6ea74017f4", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, NULL, 0, -1);
    panic(nh_p0);
    nh_text_end(nh_scope);
}

static inline void nh_phase6_native_site_9a3d65c0236e94b6(long nh_p0, const char * nh_p1, int nh_p2, const char * nh_p3) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.trap.maybe_finish_sokoban.livelog_printf.completed_d_s_sokoban_level.50bf0586f8", "livelog_printf", NH_TEXT_DEFERRED, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_INTEGER, NULL, (int64_t)nh_p2, NULL},
        {"arg_2", NH_TEXT_TEXT, nh_p3, 0, NULL, 0},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 2, -1);
    livelog_printf(nh_p0, nh_p1, nh_p2, nh_text_captured_text(nh_scope, 1, nh_p3));
    nh_text_end(nh_scope);
}
