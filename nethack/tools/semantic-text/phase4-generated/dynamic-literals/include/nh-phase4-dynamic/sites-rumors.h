/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_b80bd43f3fdb43f0 = {"nethack.message.dynamic.rumors.outoracle.putstr.the_oracle_scornfully_takes_all_your_gold.97a6853b7e", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_989d77daad298a89 = {"nethack.message.dynamic.rumors.outoracle.putstr.the_oracle_meditates_for_a_moment_and.49787dfb32", "putstr", NH_TEXT_PUTSTR, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_f7b280d7f828664b(winid nh_p0, int nh_p1, struct nh_phase4_format_value nh_p2) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p2.descriptor, NULL, 0, nh_p0);
    struct nh_text_scope *nh_previous = nh_text_emit(nh_scope);
    putstr(nh_p0, nh_p1, nh_p2.original);
    nh_text_emit(nh_previous);
    nh_text_end(nh_scope);
}
