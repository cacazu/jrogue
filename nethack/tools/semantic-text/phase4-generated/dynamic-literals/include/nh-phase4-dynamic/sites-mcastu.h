/* Modified 2026-10-02: original selected-format semantic observations; NGPL; upstream retained. */
#include "nh-phase4-values.h"
static const struct nh_text_descriptor nh_phase4_dynamic_format_a3d78209e45a363e = {"nethack.message.dynamic.mcastu.mcast_stun_you.you.struggle_to_keep_your_balance.80dce9423a", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static const struct nh_text_descriptor nh_phase4_dynamic_format_34911f7705606b7e = {"nethack.message.dynamic.mcastu.mcast_stun_you.you.reel.009b3d5aab", "You", NH_TEXT_MESSAGE, NH_TEXT_PLAIN};

static inline void nh_phase4_dynamic_site_074d4c8bde291252(struct nh_phase4_format_value nh_p0) {
    struct nh_text_scope *nh_scope = nh_text_begin(nh_p0.descriptor, NULL, 0, -1);
    You(nh_p0.original);
    nh_text_end(nh_scope);
}
