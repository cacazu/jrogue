/* Modified 2026-10-02: proposed native text delivery observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static inline void nh_phase6_native_site_62e555a9d42cca81(const char * nh_p0, unsigned long nh_p1) {
    static const struct nh_text_descriptor nh_descriptor = {
        "nethack.message.do_wear.accessory_or_armor_on.panic.wearing_armor_not_worn_as_armor_lx.ae35ac7260", "panic", NH_TEXT_RAW, NH_TEXT_PLAIN
    };
    const struct nh_text_argument nh_arguments[] = {
        {"arg_1", NH_TEXT_UNSIGNED, NULL, (int64_t)nh_p1, NULL},
    };
    struct nh_text_scope *nh_scope = nh_text_begin(&nh_descriptor, nh_arguments, 1, -1);
    panic(nh_p0, nh_p1);
    nh_text_end(nh_scope);
}
